import type { BatchStatus, TaskAllocation } from '../../planning/types'
export const riskLabels: Record<BatchStatus, string> = {
  weekday_feasible: '周中可完成',
  tight: '余量紧张',
  weekend_required: '需周末备用',
  adjustment_required: '需调整安排',
  insufficient: '容量不足',
  incomplete: '信息不完整',
  completed: '无剩余工作',
}
export const riskOrder: Record<BatchStatus, number> = {
  incomplete: 0,
  insufficient: 1,
  adjustment_required: 2,
  weekend_required: 3,
  tight: 4,
  weekday_feasible: 5,
  completed: 6,
}
export function planningTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
export function planningDay(value: string) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
}
export function allocationKey(a: TaskAllocation) {
  return JSON.stringify([a.demand_key, a.start, a.end, a.fixed])
}

/** View metadata only. A null due_at never becomes a movable scheduling demand. */
export type PlanningWork = Pick<
  import('../../planning/types').TaskDemand,
  'key' | 'task_id' | 'course_id' | 'origin' | 'release_at' | 'remaining_minutes'
> & {
  batch_key: string
  due_at: string | null
  deadline_source?: import('../../planning/types').TaskDemand['deadline_source']
}
export function planningWork(
  demands: import('../../planning/types').TaskDemand[],
  undated: import('../../planning/types').UndatedWork[] = [],
): PlanningWork[] {
  return [...demands, ...undated.map((w) => ({ ...w, batch_key: w.key, due_at: null }))]
}
export function issueCourses(
  issue: import('../../planning/types').PlanningIssue,
  names: Record<string, string>,
  work: PlanningWork[],
) {
  return Object.keys(names).filter(
    (id) =>
      issue.affected_keys.includes(id) ||
      work.some(
        (w) =>
          w.course_id === id &&
          issue.affected_keys.some((k) => k === w.key || k === w.task_id || k === w.batch_key),
      ),
  )
}
export function usefulFixedMinutes(
  block: import('../../types').TaskTimeBlock,
  allocations: TaskAllocation[],
  work: PlanningWork[],
) {
  return allocations
    .filter(
      (a) =>
        a.fixed &&
        Date.parse(a.start) >= Date.parse(block.starts_at) &&
        Date.parse(a.end) <= Date.parse(block.ends_at) &&
        work.some((w) => w.key === a.demand_key && w.task_id === block.task_id),
    )
    .reduce((n, a) => n + a.minutes, 0)
}
