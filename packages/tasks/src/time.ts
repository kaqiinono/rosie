import type { AvailabilityWindow, CourseOccurrence, TaskTimeBlock } from './types'

export function localDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
}
export function atTime(date: string, time: string): string { return new Date(`${date}T${time.slice(0, 5)}:00+08:00`).toISOString() }
export function dateAfter(date: string, days: number): string { return localDate(new Date(new Date(atTime(date, '12:00')).getTime() + days * 86400000)) }
export function displayTime(value: string): string { return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) }
export type Interval = { start: number; end: number }
export function freeIntervals(date: string, windows: AvailabilityWindow[], courses: CourseOccurrence[], blocks: TaskTimeBlock[], now = Date.now()): Interval[] {
  const weekday = new Date(atTime(date, '12:00')).getUTCDay()
  const overrides = windows.filter(w => w.on_date === date)
  const selected = overrides.length ? overrides : windows.filter(w => !w.on_date && w.weekday === weekday)
  const busy = [...courses.filter(c => c.status !== 'cancelled').map(c => ({ start: +new Date(c.starts_at), end: +new Date(c.ends_at) })), ...blocks.map(b => ({ start: +new Date(b.starts_at), end: +new Date(b.ends_at) }))]
  const sorted = selected.filter(w => !w.unavailable).map(w => ({ start: Math.max(now, +new Date(atTime(date, w.start_time))), end: +new Date(atTime(date, w.end_time)) })).filter(w => w.end > w.start).sort((a, b) => a.start - b.start)
  const merged: Interval[] = []
  for (const w of sorted) {
    const last = merged[merged.length - 1]
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end)
    else merged.push({ ...w })
  }
  return busy.reduce<Interval[]>((free, b) => free.flatMap(w => b.end <= w.start || b.start >= w.end ? [w] : [{ start: w.start, end: Math.min(w.end, b.start) }, { start: Math.max(w.start, b.end), end: w.end }].filter(x => x.end > x.start)), merged)
}
export function blockNeedsReschedule(block: TaskTimeBlock, windows: AvailabilityWindow[], courses: CourseOccurrence[], blocks: TaskTimeBlock[]): boolean {
  return !freeIntervals(localDate(new Date(block.starts_at)), windows, courses, blocks.filter(b => b.id !== block.id), 0).some(w => w.start <= +new Date(block.starts_at) && w.end >= +new Date(block.ends_at))
}
