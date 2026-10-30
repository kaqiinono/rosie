import type { TaskStatus } from './types'
export type ProgressTask = {
  status: TaskStatus
  progress_mode: 'percentage' | 'items'
  completion_percent: number
  estimated_minutes: number
  selection_state?: 'ready' | 'pending' | 'no_homework'
  items: { id: string; done: boolean; cancelled?: boolean }[]
}
function remainingFraction(task: ProgressTask): [number, number] {
  if (task.status === 'completed' || task.status === 'cancelled') return [0, 1]
  if (task.selection_state === 'pending') return [1, 1]
  if (task.progress_mode === 'percentage') return [100 - task.completion_percent, 100]
  const valid = task.items.filter((item) => !item.cancelled)
  return valid.length ? [valid.filter((item) => !item.done).length, valid.length] : [1, 1]
}
export function getTaskCompletion(task: ProgressTask): number {
  if (task.status === 'cancelled') return 0
  const [remaining, total] = remainingFraction(task)
  return 1 - remaining / total
}
export function getRemainingMinutes(task: ProgressTask): number {
  const [remaining, total] = remainingFraction(task)
  return Math.ceil((task.estimated_minutes * remaining) / total)
}
export function mergeTaskSnapshot<T extends { revision: number }>(current: T, incoming: T): T {
  return current.revision > incoming.revision ? current : incoming
}
