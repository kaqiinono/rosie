import type { TaskData, TimetableOccurrence, TimetablePreferences, TimetableRule, CourseOccurrence, RuleInput } from './types'
import type { CourseRule } from './courseTypes'
import { atTime, dateAfter, localDate } from './time'

export const DEFAULT_TIMETABLE_PREFERENCES: TimetablePreferences = { week_start: 1, show_weekends: true, start_hour: 7, end_hour: 22, hour_height: 64, hour12: false, show_teacher: true, show_location: true, default_reminder_minutes: 10 }
const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000)
const monday = (date: string) => dayNumber(date) - (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
export function ruleOccursOn(rule: Omit<TimetableRule, 'id' | 'user_id' | 'course_id' | 'start_time' | 'end_time'>, date: string): boolean {
  if (date < rule.valid_from || (rule.valid_until && date > rule.valid_until) || (rule.disabled_from && date >= rule.disabled_from)) return false
  if (new Date(`${date}T00:00:00Z`).getUTCDay() !== rule.weekday) return false
  const anchor = rule.anchor_date || rule.valid_from
  if (rule.recurrence === 'once') return date === anchor
  const week = Math.floor((monday(date) - monday(anchor)) / 7)
  if (week < 0) return false
  return rule.recurrence === 'weeks' ? (rule.teaching_weeks || []).includes(week + 1) : week % (rule.interval_weeks || 1) === 0
}

/** Date-only editor preview; repeated matching rules share one default learning day. */
export function previewCourseDates(rules: RuleInput[], from: string, to: string): string[] {
  if (from > to || dayNumber(to) - dayNumber(from) > 3660) return []
  const dates: string[] = []
  for (let date = from; date <= to; date = dateAfter(date, 1)) if (rules.some(rule => ruleOccursOn(rule, date))) dates.push(date)
  return dates
}

/** Calendar browsing is pure: no RPC, occurrence writes or task generation. */
export function previewOccurrences(data: Pick<TaskData, 'courses' | 'exceptions' | 'occurrences'> & { rules: (TimetableRule | CourseRule)[] }, from: string, to: string): TimetableOccurrence[] {
  if (from > to || dayNumber(to) - dayNumber(from) > 3660) return []
  const result = new Map<string, TimetableOccurrence>()
  const existing = new Map(data.occurrences.map(o => [`${o.rule_id}:${o.original_date}`, o]))
  const exceptions = new Map(data.exceptions.map(e => [`${e.rule_id}:${e.original_date}`, e]))
  const inRange = (start: string, end: string) => +new Date(end) > +new Date(atTime(from, '00:00')) && +new Date(start) < +new Date(atTime(dateAfter(to, 1), '00:00'))
  for (const rule of data.rules) {
    if (rule.start_time == null || rule.end_time == null) continue
    if (data.courses.find(c => c.id === rule.course_id)?.archived_at) continue
    const dates = new Set<string>()
    for (let d = from; d <= to; d = dateAfter(d, 1)) if (ruleOccursOn(rule, d)) dates.add(d)
    for (const e of data.exceptions) if (e.rule_id === rule.id && e.starts_at && e.ends_at && inRange(e.starts_at, e.ends_at) && ruleOccursOn(rule, e.original_date)) dates.add(e.original_date)
    for (const d of dates) {
      const key = `${rule.id}:${d}`, stored = existing.get(key), e = exceptions.get(key)
      const starts_at = e?.starts_at || atTime(d, rule.start_time), ends_at = e?.ends_at || atTime(d, rule.end_time)
      const value: TimetableOccurrence = stored?.status === 'confirmed' ? { ...stored, preview: false } : { id: stored?.id || `preview:${key}`, user_id: rule.user_id, course_id: rule.course_id, rule_id: rule.id, original_date: d, starts_at, ends_at, status: e?.cancelled ? 'cancelled' : 'scheduled', confirmation: null, preview: !stored }
      if (inRange(value.starts_at, value.ends_at)) result.set(key, value)
    }
  }
  // Historical and confirmed rows retain their identity even after rules are retired.
  for (const o of data.occurrences) if ((o.status === 'confirmed' || +new Date(o.ends_at) < Date.now()) && inRange(o.starts_at, o.ends_at)) result.set(`${o.rule_id}:${o.original_date}`, { ...o, preview: false })
  return [...result.values()].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at) || a.id.localeCompare(b.id))
}
export function recurrenceLabel(rule: Omit<TimetableRule, 'id' | 'user_id' | 'course_id' | 'start_time' | 'end_time'>): string {
  if (rule.recurrence === 'once') return '仅一次'
  if (rule.recurrence === 'weeks') return `第 ${(rule.teaching_weeks || []).join('、')} 周`
  return (rule.interval_weeks || 1) === 1 ? '每周' : `每隔 ${(rule.interval_weeks || 1) - 1} 周`
}
export type PositionedOccurrence<T extends CourseOccurrence = CourseOccurrence> = { occurrence: T; column: number; columns: number }
export function layoutOccurrences<T extends CourseOccurrence>(occurrences: T[]): PositionedOccurrence<T>[] {
  const sorted = occurrences.filter(o => o.status !== 'cancelled').slice().sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
  const output: PositionedOccurrence<T>[] = []
  let group: PositionedOccurrence<T>[] = [], ends: number[] = [], groupEnd = 0
  const flush = () => { for (const item of group) item.columns = ends.length; output.push(...group); group = []; ends = [] }
  for (const occurrence of sorted) {
    const start = +new Date(occurrence.starts_at), end = +new Date(occurrence.ends_at)
    if (start >= groupEnd) flush()
    let column = ends.findIndex(e => e <= start)
    if (column < 0) column = ends.length
    ends[column] = end; groupEnd = Math.max(group.length ? groupEnd : 0, end)
    group.push({ occurrence, column, columns: 1 })
  }
  flush(); return output
}
export function timetableStats(occurrences: CourseOccurrence[]) {
  const active = occurrences.filter(o => o.status !== 'cancelled')
  const conflicts = active.filter((o, index) => active.some((p, other) => other !== index && +new Date(o.starts_at) < +new Date(p.ends_at) && +new Date(p.starts_at) < +new Date(o.ends_at))).length
  return { courses: new Set(active.map(o => o.course_id)).size, occurrences: active.length, minutes: active.reduce((n, o) => n + (+new Date(o.ends_at) - +new Date(o.starts_at)) / 60000, 0), conflicts }
}
export function nextPreviewOccurrence(data: Pick<TaskData, 'courses' | 'exceptions' | 'occurrences'> & { rules: (TimetableRule | CourseRule)[] }, after = new Date()): TimetableOccurrence | null {
  const candidates: TimetableOccurrence[] = []
  const from = localDate(after)
  for (const rule of data.rules) {
    if (rule.start_time == null || rule.end_time == null) continue
    if (data.courses.find(c => c.id === rule.course_id)?.archived_at) continue
    const anchor = rule.anchor_date || rule.valid_from
    const dates = new Set<string>()
    if (rule.recurrence === 'once') dates.add(anchor)
    else if (rule.recurrence === 'weeks') {
      for (const week of rule.teaching_weeks || []) dates.add(new Date((monday(anchor) + (week - 1) * 7 + (rule.weekday + 6) % 7) * 86400000).toISOString().slice(0, 10))
    } else {
      const interval = (rule.interval_weeks || 1) * 7
      const first = monday(anchor) + (rule.weekday + 6) % 7
      const base = Math.max(dayNumber(from), dayNumber(rule.valid_from))
      let day = first + Math.max(0, Math.ceil((base - first) / interval)) * interval
      // At most one cancelled/moved exception can hide each recurrence candidate.
      const count = data.exceptions.filter(e => e.rule_id === rule.id).length + 2
      for (let n = 0; n < count; n++, day += interval) dates.add(new Date(day * 86400000).toISOString().slice(0, 10))
    }
    for (const e of data.exceptions) if (e.rule_id === rule.id && e.starts_at && +new Date(e.starts_at) > +after) dates.add(e.original_date)
    for (const date of dates) {
      if (!ruleOccursOn(rule, date)) continue
      const exception = data.exceptions.find(e => e.rule_id === rule.id && e.original_date === date)
      if (exception?.cancelled) continue
      const stored = data.occurrences.find(o => o.rule_id === rule.id && o.original_date === date)
      const starts_at = exception?.starts_at || atTime(date, rule.start_time), ends_at = exception?.ends_at || atTime(date, rule.end_time)
      if (+new Date(starts_at) <= +after) continue
      candidates.push({ id: stored?.id || `preview:${rule.id}:${date}`, user_id: rule.user_id, course_id: rule.course_id, rule_id: rule.id, original_date: date, starts_at, ends_at, status: stored?.status === 'confirmed' ? 'confirmed' : 'scheduled', confirmation: stored?.confirmation || null, preview: !stored })
    }
  }
  return candidates.sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0] || null
}
