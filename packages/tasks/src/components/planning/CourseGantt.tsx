'use client'
import { useEffect, useRef } from 'react'
import type {
  PlanningResult,
  TaskDemand,
  CapacityInterval,
  TaskAllocation,
  UndatedWork,
} from '../../planning/types'
import { minorClass } from '../shared'
import GanttAxis, { type GanttView } from './GanttAxis'
import { allocationKey, planningDay, planningTime, planningWork } from './presentation'
type Props = {
  result: PlanningResult
  demands: TaskDemand[]
  undated?: UndatedWork[]
  capacity: CapacityInterval[]
  view: GanttView
  onSelectAllocation: (allocation: TaskAllocation) => void
  courseNames?: Record<string, string>
  selectedBatch?: string
}
export default function CourseGantt({
  result,
  demands,
  undated = [],
  capacity,
  view,
  onSelectAllocation,
  courseNames = {},
  selectedBatch,
}: Props) {
  const work = planningWork(demands, undated)
  const scroller = useRef<HTMLDivElement>(null)
  const selectedWork = work.filter((w) => w.batch_key === selectedBatch)
  const allocationStarts = result.allocations
    .filter((a) => selectedWork.some((w) => w.key === a.demand_key))
    .map((a) => Date.parse(a.start))
  const targetTime = Math.min(
    ...(allocationStarts.length
      ? allocationStarts
      : selectedWork.map((w) =>
          Date.parse(w.release_at) > Date.parse(result.computed_at)
            ? Date.parse(w.release_at)
            : Date.parse(w.due_at ?? result.computed_at),
        )),
  )
  const targetDay = Number.isFinite(targetTime)
    ? planningDay(new Date(targetTime).toISOString())
    : null
  useEffect(() => {
    const root = scroller.current
    if (!root || !targetDay) return
    const target = root.querySelector<HTMLElement>(`[data-planning-day="${targetDay}"]`)
    const first = root.querySelector<HTMLElement>('[data-planning-day]')
    if (target && first)
      root.scrollTo?.({ left: Math.max(0, target.offsetLeft - first.offsetLeft), behavior: 'auto' })
  }, [targetDay, selectedBatch, view, result.computed_at])
  const courses = Array.from(new Set(work.map((d) => d.course_id)))
  const start = planningDay(result.computed_at),
    end = planningDay(result.horizon_end)
  const days: string[] = []
  for (
    let t = Date.parse(`${start}T00:00:00+08:00`);
    planningDay(new Date(t).toISOString()) <= end;
    t += 86400000
  )
    days.push(planningDay(new Date(t).toISOString()))
  const shown = result.allocations.filter(
    (a) =>
      !selectedBatch ||
      work.some((d) => d.key === a.demand_key && d.batch_key === selectedBatch) ||
      a.demand_key === selectedBatch,
  )
  return (
    <div className="space-y-4">
      <GanttAxis capacity={capacity} view={view} />
      <p className="text-sm">
        正式建议：实线 · 未来预计：虚线 ·
        已固定：双线。已固定表示占用时间，不表示已完成。周末仅人工时段计容量。
      </p>
      <button
        className={`${minorClass} hidden md:inline-flex`}
        onClick={() => scroller.current?.scrollTo?.({ left: 0, behavior: 'auto' })}
      >
        回到今天
      </button>
      <div
        ref={scroller}
        className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block"
        tabIndex={0}
        aria-label="甘特图，可横向滚动"
      >
        {Object.entries(result.batch_metrics)
          .filter(([key]) => !selectedBatch || key === selectedBatch)
          .map(([batchKey, metric]) => (
            <div key={batchKey} className="flex min-w-max border-b border-slate-200">
              <div className="sticky left-0 z-10 w-52 shrink-0 space-y-2 border-r border-slate-200 bg-white p-3 text-sm">
                <h4 className="font-bold">
                  {courseNames[work.find((d) => d.batch_key === batchKey)?.course_id ?? ''] ??
                    '独立任务'}{' '}
                  · 批次
                </h4>
                <p>剩余 {metric.remaining_minutes} 分钟</p>
                <p>周末有效工作 {metric.weekend_minutes} 分钟</p>
                <p>缺口 {metric.unallocated_minutes} 分钟</p>
              </div>
              {(view === 'dates'
                ? days.map((day) => ({
                    key: day,
                    start: `${day}T00:00:00+08:00`,
                    end: `${day}T23:59:59+08:00`,
                    minutes: 1440,
                  }))
                : capacity
              ).map((slot) => {
                const day = planningDay(slot.start)
                const weekend = [0, 6].includes(new Date(`${day}T12:00:00+08:00`).getUTCDay())
                return (
                  <div
                    key={slot.key}
                    data-planning-day={day}
                    className={`w-52 shrink-0 space-y-2 border-r border-slate-200 p-3 ${weekend ? 'bg-amber-50' : 'bg-white'}`}
                  >
                    <p className="font-semibold">
                      {day}
                      {weekend ? ' · 周末备用' : ''}
                    </p>
                    {view === 'capacity' && (
                      <p className="text-xs">
                        {planningTime(slot.start)} — {planningTime(slot.end)} · {slot.minutes} 分钟
                      </p>
                    )}
                    {shown
                      .filter(
                        (a) =>
                          (work.some((d) => d.key === a.demand_key && d.batch_key === batchKey) ||
                            a.demand_key === batchKey) &&
                          Date.parse(a.start) < Date.parse(slot.end) &&
                          Date.parse(a.end) > Date.parse(slot.start),
                      )
                      .map((a) => {
                        const d = work.find((d) => d.key === a.demand_key)
                        return (
                          <button
                            key={allocationKey(a)}
                            className={`${minorClass} block w-full text-left ${a.fixed ? 'border-4 border-double' : d?.origin === 'forecast' ? 'border-dashed' : 'border-solid'}`}
                            onClick={() => onSelectAllocation(a)}
                          >
                            {d?.course_id ? (courseNames[d.course_id] ?? '课程') : '独立任务'} ·{' '}
                            {a.fixed
                              ? '已固定'
                              : d?.origin === 'forecast'
                                ? '未来预计'
                                : '正式建议'}
                            <br />
                            {a.minutes} 分钟
                          </button>
                        )
                      })}
                    {work
                      .filter(
                        (d) =>
                          d.batch_key === batchKey &&
                          d.due_at !== null &&
                          planningDay(d.due_at) === day &&
                          (!selectedBatch || selectedBatch === d.batch_key),
                      )
                      .map((d) => (
                        <p key={d.key} className="border-l-2 border-slate-700 pl-2 text-xs">
                          截止点 · {d.due_at && planningTime(d.due_at)}
                        </p>
                      ))}
                  </div>
                )
              })}
            </div>
          ))}
      </div>
      <div className="space-y-3 md:hidden">
        <h3 className="font-bold">每日聚合</h3>
        {Array.from(new Set(shown.map((a) => planningDay(a.start)))).map((day) => (
          <details key={day} className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer focus-visible:outline-2">
              {day} ·{' '}
              {shown.filter((a) => planningDay(a.start) === day).reduce((n, a) => n + a.minutes, 0)}{' '}
              分钟有效工作
            </summary>
            {shown
              .filter((a) => planningDay(a.start) === day)
              .map((a) => (
                <button
                  key={allocationKey(a)}
                  className={`${minorClass} mt-2 block`}
                  onClick={() => onSelectAllocation(a)}
                >
                  {planningTime(a.start)} — {planningTime(a.end)} ·{' '}
                  {a.fixed ? '已固定' : '预计安排'} · {a.minutes} 分钟
                </button>
              ))}
          </details>
        ))}
      </div>
      <h3 className="font-bold">课程 / 任务可读明细</h3>
      {courses.map((course) => (
        <details key={course ?? 'independent'} className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer rounded py-2 font-semibold focus-visible:outline-2">
            {course ? (courseNames[course] ?? '课程') : '独立任务'} · 展开任务
          </summary>
          {work
            .filter(
              (d) => d.course_id === course && (!selectedBatch || d.batch_key === selectedBatch),
            )
            .map((d) => (
              <details key={d.key} className="mt-2 rounded-lg bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm break-words focus-visible:outline-2">
                  {d.origin === 'forecast' ? '未来预计任务' : '正式任务'} · 可开始{' '}
                  {planningTime(d.release_at)} ·{' '}
                  {d.due_at ? `截止 ${planningTime(d.due_at)}` : '未设置截止，仅固定承诺'} · 剩余{' '}
                  {d.remaining_minutes} 分钟
                </summary>
                {d.task_id && (
                  <a
                    className="block py-2 text-emerald-800 underline"
                    href={`/tasks?task=${encodeURIComponent(d.task_id)}#task-${encodeURIComponent(d.task_id)}`}
                  >
                    定位原始任务
                  </a>
                )}
                {shown
                  .filter((a) => a.demand_key === d.key)
                  .map((a) => (
                    <button
                      key={allocationKey(a)}
                      className={`${minorClass} mb-2 block text-left`}
                      onClick={() => onSelectAllocation(a)}
                    >
                      {a.fixed ? '已固定 ▥' : d.origin === 'forecast' ? '未来预计 ┄' : '正式建议 ━'}{' '}
                      · {planningTime(a.start)} — {planningTime(a.end)} · {a.minutes} 分钟
                      {a.kind === 'weekend_reserve' ? ' · 周末备用' : ''}
                    </button>
                  ))}
              </details>
            ))}
        </details>
      ))}
      {!shown.length && (
        <p className="text-sm text-amber-900">暂无有效工作分配。请查看缺口、固定占用与待配置项。</p>
      )}
    </div>
  )
}
