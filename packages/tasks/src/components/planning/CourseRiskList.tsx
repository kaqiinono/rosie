'use client'

import type { PlanningResult, TaskDemand } from '../../planning/types'
import type { BatchRisk } from '../../planning/risk'
import type { TaskInstance } from '../../types'
import { getTaskCompletion } from '../../taskProgress'
import { minorClass } from '../shared'
import { planningTime, riskLabels, riskOrder } from './presentation'

type Props = {
  result: PlanningResult
  onSelectBatch: (key: string) => void
  demands?: TaskDemand[]
  tasks?: TaskInstance[]
  courseNames?: Record<string, string>
  risks?: Record<string, BatchRisk>
  stale?: boolean
}
export default function CourseRiskList({
  result,
  onSelectBatch,
  demands = [],
  tasks = [],
  courseNames = {},
  risks = {},
  stale = false,
}: Props) {
  const entries = Object.entries(result.batch_metrics).sort(([a, x], [b, y]) => {
    const severity =
      riskOrder[risks[a]?.status ?? x.status] - riskOrder[risks[b]?.status ?? y.status]
    const due = (key: string) =>
      Math.min(...demands.filter((d) => d.batch_key === key).map((d) => Date.parse(d.due_at)))
    return severity || due(a) - due(b) || a.localeCompare(b)
  })
  return (
    <div className="space-y-3">
      {!entries.length && (
        <p className="text-sm text-slate-600">
          当前没有可计算批次。请检查课程、任务与七天可用时段配置；这不代表容量充足。
        </p>
      )}
      {entries.map(([key, m]) => {
        const batch = demands.filter((d) => d.batch_key === key)
        const course = batch.find((d) => d.course_id)?.course_id
        const ids = new Set(batch.flatMap((d) => (d.task_id ? [d.task_id] : [])))
        const actual = tasks.filter(
          (t) => (course ? t.course_id === course : ids.has(t.id)) && t.status !== 'cancelled',
        )
        const weight = actual.reduce((n, t) => n + t.estimated_minutes, 0)
        const completion = weight
          ? Math.round(
              (actual.reduce((n, t) => n + t.estimated_minutes * getTaskCompletion(t), 0) /
                weight) *
                100,
            )
          : null
        const status = stale
          ? '预测已过期'
          : !result.complete
            ? '信息不完整'
            : riskLabels[risks[key]?.status ?? m.status]
        const due = batch.map((d) => d.due_at).sort()[0]
        const safe =
          !stale && result.complete && (risks[key]?.status ?? m.status) === 'weekday_feasible'
        return (
          <article
            key={key}
            className={`space-y-2 rounded-xl border p-4 ${safe ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">
                {course ? (courseNames[course] ?? '课程') : '独立任务'} · {status}
              </h3>
              <button className={minorClass} onClick={() => onSelectBatch(key)}>
                查看批次与原始任务
              </button>
            </div>
            <p className="text-sm">
              {due ? `目标 ${planningTime(due)}` : '未设置截止 · 仅固定承诺'}
              {batch.some((d) => d.origin === 'forecast') ? ' · 含未来预计任务' : ' · 正式任务'}
              {m.certainty !== 'confirmed' ? ' · 用时为估计 / 信息待补齐' : ''}
            </p>
            {batch.some(
              (d) =>
                d.deadline_source === 'suggested_recovery' ||
                d.deadline_source === 'explicit_recovery',
            ) && (
              <p className="text-sm text-amber-900">
                原截止已逾期；这里评估补做目标，不代表原截止按时完成。
                {batch.some((d) => d.deadline_source === 'suggested_recovery')
                  ? '使用建议补做目标，尚未保存。'
                  : '使用明确补做目标。'}
              </p>
            )}
            <p className="text-sm">
              实际完成（按预计用时加权）：
              {completion === null ? '暂无实际任务数据' : `${completion}%`} · 剩余工作覆盖：
              {m.remaining_minutes
                ? Math.round(
                    ((m.remaining_minutes - m.unallocated_minutes) / m.remaining_minutes) * 100,
                  )
                : 0}
              %
            </p>
            <p className="text-sm tabular-nums">
              剩余 {m.remaining_minutes} 分钟 · 周中 {m.weekday_minutes} 分钟 · 周末有效工作{' '}
              {m.weekend_minutes} 分钟 · 缺口 {m.unallocated_minutes} 分钟
            </p>
            <p className="text-sm">
              独立余量：
              {m.extra_capacity_minutes === null
                ? '未知 / 不适用'
                : `${m.extra_capacity_minutes} 分钟`}{' '}
              · 本批今天至少：
              {m.today_required_minutes === null ? '未知' : `${m.today_required_minutes} 分钟`}
            </p>
          </article>
        )
      })}
      <p className="text-xs text-slate-600">
        各批次独立余量与今天最低用时共享容量，不可相加。安排覆盖率不会增加实际完成进度。
      </p>
    </div>
  )
}
