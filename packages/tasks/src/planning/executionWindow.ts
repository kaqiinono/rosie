import { atTime, localDate } from '../time'
import type { PlanningIssue } from './types'
export type ExecutionWindowTask = {
  id: string
  created_at: string
  release_at?: string | null
  due_at: string | null
  recovery_due_at?: string | null
}
export type TaskExecutionWindow = {
  release_at: string
  due_at: string | null
  deadline_source: 'original' | 'explicit_recovery' | 'suggested_recovery' | 'missing'
  issue: PlanningIssue | null
}
/** Read-only execution target. Never modifies the original due/recovery metadata. */
export function getTaskExecutionWindow(
  task: ExecutionWindowTask,
  now: string,
): TaskExecutionWindow {
  const clock = Date.parse(now)
  const result: TaskExecutionWindow = {
    release_at: task.release_at ?? task.created_at,
    due_at: task.due_at,
    deadline_source: task.due_at ? 'original' : 'missing',
    issue: null,
  }
  const issue = (code: string, detail: string) => {
    result.issue = { code, affected_keys: [task.id], detail }
    return result
  }
  if (
    !Number.isFinite(clock) ||
    !Number.isFinite(Date.parse(result.release_at)) ||
    (task.due_at !== null && !Number.isFinite(Date.parse(task.due_at)))
  )
    return issue('execution_window_invalid', '任务时间无效，请检查可开始和截止时间')
  if (task.due_at === null) return issue('missing_deadline', '请先设置任务截止或目标时间')
  if (Date.parse(task.due_at) < clock) {
    if (task.recovery_due_at && Date.parse(task.recovery_due_at) > clock) {
      result.due_at = task.recovery_due_at
      result.deadline_source = 'explicit_recovery'
    } else {
      result.due_at = atTime(localDate(new Date(clock)), '23:59')
      result.deadline_source = 'suggested_recovery'
      if (Date.parse(result.due_at) <= clock)
        return issue('recovery_window_elapsed', '今天的建议补做时间已过，请设置新的补做目标')
    }
  }
  return result
}
