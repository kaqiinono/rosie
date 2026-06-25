import type { RobotTask, RobotTaskStatus } from './robot-types'

export const STATUS_LABELS: Record<RobotTaskStatus, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  EXPIRED: '已过期',
  COMPLETED: '已完成',
}

/** Parse "HH:MM" to minutes since midnight; returns NaN on malformed/out-of-range input. */
function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return NaN
  return h * 60 + min
}

/**
 * Time-derived status. Completion is the only persisted state (completedAt);
 * the other three are a pure function of the clock vs the HH:MM window.
 * Window is inclusive of both start and end. Malformed/out-of-range times → NOT_STARTED.
 *
 * Assumes a same-day window (startTime <= endTime). An inverted window
 * (startTime > endTime, e.g. an overnight task) is out of scope and yields
 * no IN_PROGRESS state by design.
 */
export function deriveStatus(task: RobotTask, now: Date = new Date()): RobotTaskStatus {
  if (task.completedAt) return 'COMPLETED'
  const start = toMinutes(task.startTime)
  const end = toMinutes(task.endTime)
  if (Number.isNaN(start) || Number.isNaN(end)) return 'NOT_STARTED'
  const cur = now.getHours() * 60 + now.getMinutes()
  if (cur < start) return 'NOT_STARTED'
  if (cur <= end) return 'IN_PROGRESS'
  return 'EXPIRED'
}
