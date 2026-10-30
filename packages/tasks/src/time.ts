import { buildCapacityIntervals } from './planning/availability'
import { subtract, wholeMinutes } from './planning/intervals'
import type {
  AvailabilityDayState,
  TaskExam,
  AvailabilityWindow,
  CourseOccurrence,
  TaskTimeBlock,
} from './types'

export function localDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}
export function atTime(date: string, time: string): string {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+08:00`).toISOString()
}
export function dateAfter(date: string, days: number): string {
  return localDate(new Date(new Date(atTime(date, '12:00')).getTime() + days * 86400000))
}
export function displayTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
export type Interval = { start: number; end: number }
export function freeIntervals(
  date: string,
  windows: AvailabilityWindow[],
  courses: CourseOccurrence[],
  blocks: TaskTimeBlock[],
  now = Date.now(),
  day_states: AvailabilityDayState[] = [],
  exams: TaskExam[] = [],
): Interval[] {
  const start = Math.max(now, Date.parse(atTime(date, '00:00')))
  const end = atTime(dateAfter(date, 1), '00:00')
  const { capacity } = buildCapacityIntervals({
    now: new Date(start).toISOString(),
    horizon_end: end,
    day_states,
    windows,
    courses,
    exams,
  })
  return wholeMinutes(
    subtract(
      capacity.map((c) => ({ start: Date.parse(c.start), end: Date.parse(c.end) })),
      blocks.map((b) => ({ start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) })),
    ),
  )
}
export function blockNeedsReschedule(
  block: TaskTimeBlock,
  windows: AvailabilityWindow[],
  courses: CourseOccurrence[],
  blocks: TaskTimeBlock[],
): boolean {
  return !freeIntervals(
    localDate(new Date(block.starts_at)),
    windows,
    courses,
    blocks.filter((b) => b.id !== block.id),
    0,
  ).some((w) => w.start <= +new Date(block.starts_at) && w.end >= +new Date(block.ends_at))
}
