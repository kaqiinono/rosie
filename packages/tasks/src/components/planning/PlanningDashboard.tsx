'use client'

import { useEffect, useRef, useState } from 'react'
import { isPlanningStale } from '../../planning/status'
import type { TaskAllocation } from '../../planning/types'
import { Panel, Field, inputClass, minorClass, buttonClass, useTasks } from '../shared'
import CourseRiskList from './CourseRiskList'
import CourseGantt from './CourseGantt'
import AllocationDetails from './AllocationDetails'
import type { GanttView } from './GanttAxis'
import {
  allocationKey,
  planningDay,
  planningTime,
  riskLabels,
  planningWork,
  issueCourses,
  usefulFixedMinutes,
} from './presentation'

export default function PlanningDashboard() {
  const { api } = useTasks()
  const snapshot = api.data.planning?.snapshot
  return <PlanningDashboardContent key={`${snapshot?.input_revision}:${snapshot?.computed_at}`} />
}
function PlanningDashboardContent() {
  const { api, run, busy, notify } = useTasks()
  const status = api.data.planning
  const snapshot = status?.snapshot
  const [now, setNow] = useState(0)
  const [policy, setPolicy] = useState<'regular_only' | 'allow_weekend'>('allow_weekend')
  const [view, setView] = useState<GanttView>('dates')
  const [batch, setBatch] = useState('')
  const [detail, setDetail] = useState<TaskAllocation | null>(null)
  const [selection, setSelection] = useState<string[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const timer = setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  const detailTrigger = useRef<HTMLElement | null>(null)
  const selectAllocation = (allocation: TaskAllocation) => {
    detailTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDetail(allocation)
  }
  const closeDetail = () => {
    setDetail(null)
    detailTrigger.current?.focus()
  }
  const work = planningWork(snapshot?.input.demands ?? [], snapshot?.input.undated_work)
  const stale = now === 0 || isPlanningStale(status, now)
  const result = snapshot?.result[policy]
  const names = Object.fromEntries(api.data.courses.map((c) => [c.id, c.name]))
  const selectBatch = (key: string) => {
    setBatch(key)
    document.getElementById('planning-gantt')?.scrollIntoView({ block: 'start' })
  }
  async function adopt() {
    setError('')
    if (!snapshot || !result || isPlanningStale(status, Date.now())) {
      setError('预测已过期，请重新计算后再采用')
      return
    }
    const selected = result.allocations.filter((a) => selection.includes(allocationKey(a)))
    if (!selected.length || selected.length !== selection.length) {
      setError('所选片段已变化，请重新选择')
      return
    }
    if (
      selected.some(
        (a) =>
          a.fixed ||
          !snapshot.input.demands.some(
            (d) => d.key === a.demand_key && d.origin === 'actual' && d.task_id,
          ),
      )
    ) {
      setError('预测任务尚未生成，请先生成任务后再固定安排')
      return
    }
    if (policy !== 'allow_weekend') {
      setError('请切换允许已标记周末方案后选择片段采纳')
      return
    }
    const ok = await run(() => api.acceptPlan(snapshot.input_revision, selected))
    if (ok) {
      setSelection([])
      notify('所选片段已固定；实际完成进度不变')
    } else setError('未采纳任何片段。请查看页面错误，刷新预测并处理时间或版本冲突后重试。')
  }
  return (
    <Panel title="课程风险与容量预测">
      <p className="text-sm text-slate-600">
        预计用时用于安排；只有实际任务进度计入完成。七天均须手动标记时段，周末不会自动开放全天。
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <button
          disabled={busy}
          className={buttonClass}
          onClick={() => void run(api.requestPlanning)}
        >
          {busy ? '处理中…' : '重新计算预测'}
        </button>
        <Field label="余量紧张阈值（剩余工作比例）">
          <select
            className={inputClass}
            disabled={busy}
            value={status?.settings.tight_ratio ?? 0.2}
            onChange={(e) => void run(() => api.setPlanningSettings(Number(e.target.value)))}
          >
            {Array.from(new Set([0, 0.1, 0.2, 0.3, 0.5, 1, status?.settings.tight_ratio ?? 0.2]))
              .sort((a, b) => a - b)
              .map((v) => (
                <option key={v} value={v}>
                  {Math.round(v * 100)}%
                </option>
              ))}
          </select>
        </Field>
      </div>
      <p role="status" className="text-sm text-amber-900">
        {!snapshot
          ? '尚无预测，请先计算。'
          : stale
            ? '预测已过期：以下为历史参考，需重新计算，不能采纳或据此判断安全。'
            : '当前预测 · 仍须留意估计用时与待补信息'}
      </p>
      <p className="text-sm text-slate-600">
        后台提醒：
        {status?.background.configured
          ? '已配置，送达尚未验证；请以页面刷新结果为准。'
          : '尚未启用；关闭页面后不保证及时提醒。'}
      </p>
      {snapshot && result && (
        <>
          <p className="text-sm tabular-nums">
            计算于 {planningTime(snapshot.computed_at)} · Asia/Shanghai · 覆盖{' '}
            {planningTime(snapshot.input.now)} 至 {planningTime(snapshot.horizon_end)}
          </p>
          <Field label="比较方案">
            <select
              className={inputClass}
              value={policy}
              onChange={(e) => {
                setPolicy(e.target.value as typeof policy)
                setSelection([])
                setDetail(null)
                setError('')
              }}
            >
              <option value="regular_only">仅周中（保留已固定占用）</option>
              <option value="allow_weekend">允许已标记周末</option>
            </select>
          </Field>
          <p className="text-sm">
            当前缺口 {result.total_unallocated_minutes ?? '未知'} 分钟 · 周末有效工作{' '}
            {result.total_weekend_minutes ?? '未知'} 分钟 · 全局今天至少{' '}
            {result.today_required_minutes === null || result.today_required_minutes === undefined
              ? '未知'
              : `${result.today_required_minutes} 分钟`}{' '}
            · 今日建议{' '}
            {result.allocations
              .filter((a) => planningDay(a.start) === planningDay(snapshot.input.now))
              .reduce((n, a) => n + a.minutes, 0)}{' '}
            分钟
          </p>
          {!result.complete && (
            <p className="text-sm text-amber-900">
              信息不完整或存在硬冲突，不能给出无条件安全结论。请补齐配置 / 物料并处理冲突。
            </p>
          )}
          <CourseRiskList
            result={result}
            demands={snapshot.input.demands}
            undated={snapshot.input.undated_work}
            tasks={api.data.tasks}
            courseNames={names}
            risks={policy === 'allow_weekend' ? snapshot.risks : undefined}
            stale={stale}
            onSelectBatch={selectBatch}
          />
          {result.issues.length > 0 && (
            <details>
              <summary className="cursor-pointer py-2 font-semibold focus-visible:outline-2">
                待处理与安排提示 · {result.issues.length}
              </summary>
              <ul className="space-y-2 text-sm">
                {result.issues.map((i, n) => (
                  <li key={n} className="break-words">
                    {i.detail || '配置不完整，请检查可用时段、课程与任务。'}{' '}
                    {issueCourses(i, names, work).map((id) => (
                      <a
                        key={id}
                        className="ml-2 text-emerald-800 underline"
                        href={`/tasks/timetable?course=${encodeURIComponent(id)}`}
                      >
                        配置{names[id]}
                      </a>
                    ))}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.conflict_groups.map((g, n) => (
            <p key={n} className="text-sm text-amber-900">
              共同竞争容量：
              {g.course_ids.map((id) => names[id] ?? '独立任务').join('、') || '独立任务'} · 缺口{' '}
              {g.missing_minutes} 分钟。此组共享时段，不能单独归因某门课。
            </p>
          ))}
          <details>
            <summary className="cursor-pointer py-2 font-semibold focus-visible:outline-2">
              原有固定占用 · {snapshot.input.fixed_blocks.length} 段
            </summary>
            {snapshot.input.fixed_blocks.map((b) => (
              <p key={b.id} className="py-1 text-sm">
                {api.data.tasks.find((t) => t.id === b.task_id)?.title ?? '任务'} ·{' '}
                {planningTime(b.starts_at)} — {planningTime(b.ends_at)} · 保留占用{' '}
                {Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60000)} 分钟 ·
                本次有效工作 {usefulFixedMinutes(b, result.allocations, work)} 分钟
              </p>
            ))}
            <p className="text-sm">已完成或超出所需部分仍占用时段。请到时间安排手动移动或释放。</p>
            <a className="text-emerald-800 underline" href="/tasks/schedule">
              管理固定安排
            </a>
          </details>
          <section id="planning-gantt" className="scroll-mt-20 space-y-4">
            <h3 className="text-lg font-bold">课程甘特图</h3>
            <Field label="时间轴">
              <select
                className={inputClass}
                value={view}
                onChange={(e) => setView(e.target.value as GanttView)}
              >
                <option value="dates">自然日期</option>
                <option value="capacity">可用时段展开（非自然时间比例）</option>
              </select>
            </Field>
            {batch && (
              <button className={minorClass} onClick={() => setBatch('')}>
                查看全部课程批次
              </button>
            )}
            <CourseGantt
              result={result}
              demands={snapshot.input.demands}
              undated={snapshot.input.undated_work}
              capacity={snapshot.input.capacity}
              view={view}
              courseNames={names}
              selectedBatch={batch}
              onSelectAllocation={selectAllocation}
            />
            {detail && (
              <AllocationDetails
                allocation={detail}
                demand={work.find((d) => d.key === detail.demand_key)}
                onClose={closeDetail}
              />
            )}
          </section>
          <details>
            <summary className="cursor-pointer py-2 font-semibold focus-visible:outline-2">
              选择正式任务建议并固定
            </summary>
            <p className="text-sm">
              逐段明确选择后才保存；未来预计任务尚未生成，不能固定。仅允许已标记周末方案可采纳。
            </p>
            {result.allocations
              .filter((a) => !a.fixed)
              .map((a) => {
                const d = snapshot.input.demands.find((d) => d.key === a.demand_key)
                const eligible = d?.origin === 'actual' && !!d.task_id
                return (
                  <label key={allocationKey(a)} className="flex items-start gap-3 py-3 text-sm">
                    <input
                      type="checkbox"
                      disabled={busy || stale || !eligible || policy !== 'allow_weekend'}
                      checked={selection.includes(allocationKey(a))}
                      onChange={(e) =>
                        setSelection((old) =>
                          e.target.checked
                            ? [...old, allocationKey(a)]
                            : old.filter((k) => k !== allocationKey(a)),
                        )
                      }
                    />
                    <span>
                      {eligible
                        ? (api.data.tasks.find((t) => t.id === d?.task_id)?.title ?? '正式任务')
                        : '未来预计 · 任务尚未生成，不能采纳'}{' '}
                      · {planningTime(a.start)} — {planningTime(a.end)} · {a.minutes} 分钟
                    </span>
                  </label>
                )
              })}
            <button
              disabled={busy || stale || !selection.length}
              className={buttonClass}
              onClick={() => void adopt()}
            >
              固定所选 {selection.length} 段
            </button>
            <p role="alert" className="mt-2 text-sm text-amber-900">
              {error}
            </p>
          </details>
        </>
      )}
      {status && status.alerts.length > 0 && (
        <details>
          <summary className="cursor-pointer py-2 font-semibold focus-visible:outline-2">
            容量提醒 · 已读不等于解决
          </summary>
          {status.alerts.map((a) => (
            <div
              key={`${a.batch_key}:${a.reason}`}
              className="space-y-2 border-b border-slate-200 py-3 text-sm"
            >
              <p>
                {a.resolved_at ? '已解决' : '待处理'} · {riskLabels[a.risk.status]} · 缺口{' '}
                {a.risk.unallocated_minutes} 分钟 · {a.read_at ? '已读' : '未读'}
              </p>
              <button className={minorClass} onClick={() => selectBatch(a.batch_key)}>
                查看对应批次
              </button>
              {!a.read_at && (
                <button
                  disabled={busy}
                  className={minorClass}
                  onClick={() => void run(() => api.readPlanningAlert(a.batch_key, a.reason))}
                >
                  标为已读
                </button>
              )}
            </div>
          ))}
        </details>
      )}
    </Panel>
  )
}
