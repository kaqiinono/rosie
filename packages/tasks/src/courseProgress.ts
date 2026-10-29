import type { CourseInput } from './types'
import type { CourseRuleInput, EventIdentity, NormalizedCourseInput, NormalizedCourseRuleInput } from './courseTypes'

function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('invalid_date')
}
function clockSeconds(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) throw new Error('invalid_time_range')
  const [hours, minutes, seconds = 0] = value.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds
}

/** Pure validation; calendar dates are Shanghai dates, never host-local Date values. */
export function normalizeCourseInput(course: CourseInput, rules: CourseRuleInput[]): NormalizedCourseInput {
  const kind = course.course_type ?? 'timetabled'
  if (kind !== 'timetabled' && kind !== 'flexible') throw new Error('invalid_course_type')
  if (rules.length < 1 || rules.length > 100) throw new Error('rules_required')
  const normalized = rules.map((rule): NormalizedCourseRuleInput => {
    if (rule.kind && rule.kind !== kind) throw new Error('course_rule_type_mismatch')
    if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) throw new Error('invalid_weekday')
    assertDate(rule.valid_from)
    if (rule.valid_until !== null) {
      assertDate(rule.valid_until)
      // A retired rule may end the day before it starts, as in the legacy schema.
      if (Date.parse(`${rule.valid_until}T00:00:00Z`) < Date.parse(`${rule.valid_from}T00:00:00Z`) - 86400000) throw new Error('invalid_date_range')
    }
    if (rule.anchor_date !== undefined) assertDate(rule.anchor_date)
    if (rule.disabled_from != null) assertDate(rule.disabled_from)
    const recurrence = rule.recurrence ?? 'weekly'
    if (!['weekly', 'once', 'weeks'].includes(recurrence)) throw new Error('invalid_recurrence')
    const interval = rule.interval_weeks ?? 1
    if (!Number.isInteger(interval) || interval < 1 || interval > 520) throw new Error('invalid_interval_weeks')
    const weeks = rule.teaching_weeks ?? []
    if (weeks.length > 520 || weeks.some(week => !Number.isInteger(week) || week < 1 || week > 520)) throw new Error('invalid_teaching_week')
    if (recurrence === 'weeks' && weeks.length === 0) throw new Error('teaching_weeks_required')
    const base = { ...rule, recurrence, interval_weeks: interval, teaching_weeks: [...weeks], anchor_date: rule.anchor_date ?? rule.valid_from }
    if (kind === 'flexible') {
      if (rule.start_time != null || rule.end_time != null) throw new Error('flexible_rule_has_time')
      return { ...base, kind, start_time: null, end_time: null }
    }
    if (!rule.start_time || !rule.end_time) throw new Error('timetabled_rule_requires_time')
    if (clockSeconds(rule.end_time) <= clockSeconds(rule.start_time)) throw new Error('invalid_time_range')
    return { ...base, kind, start_time: rule.start_time, end_time: rule.end_time }
  })
  return { course: { ...course, course_type: kind, auto_assign: course.auto_assign ?? false, auto_advance: course.auto_advance ?? false }, rules: normalized }
}

export function deriveCourseEventKey(input: EventIdentity): string {
  assertDate(input.on_date)
  const identity = input.kind === 'timetabled' ? input.rule_id : input.course_id
  if (!identity || !identity.trim() || (input.kind === 'flexible' && input.extra_event_id !== undefined && !input.extra_event_id.trim())) throw new Error('invalid_event_identity')
  const key = `${input.kind}:${encodeURIComponent(identity)}:${input.on_date}`
  return input.kind === 'flexible' && input.extra_event_id !== undefined ? `${key}:extra:${encodeURIComponent(input.extra_event_id)}` : key
}
