import type { PracticeBinding, PracticeProgression } from './practiceEntries'
import { EMPTY_HOMEWORK, HOMEWORK_CYCLES, validateHomework } from './homework'
import { homeworkPeriod, shiftHomeworkDate, type HomeworkSchedule } from './homeworkSchedule'

const DAY = 86400000
const dateNumber = (day: string) => Date.parse(`${day}T00:00:00Z`)

export function defaultPracticeProgression(day: string): PracticeProgression {
  return { enabled: true, mode: 'daily', amount: 1, weekday: 1, anchorDate: day, skipWeekends: false }
}

export function validatePracticeProgression(rule: PracticeProgression): void {
  const amount = rule.amount ?? 1
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('推进数量须为正整数。')
  const date = dateNumber(rule.anchorDate)
  if (typeof rule.enabled !== 'boolean' || typeof rule.skipWeekends !== 'boolean' ||
    !['daily', 'weekly', 'homework'].includes(rule.mode) || !Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(rule.anchorDate) || !Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== rule.anchorDate) {
    throw new Error('课程推进设置无效，请重新设置。')
  }
  if (rule.mode === 'homework') {
    const schedule = rule.schedule
    if (!schedule || !Object.hasOwn(HOMEWORK_CYCLES, schedule.cycle) ||
      validateHomework({ ...EMPTY_HOMEWORK, ...schedule, name: '课程排期' }) ||
      (schedule.cycle === 'weekly' && [schedule.start_weekday, schedule.end_weekday].some(
        day => day == null || !Number.isInteger(day) || day < 0 || day > 6)) ||
      [schedule.start_date, schedule.end_date].some(day => day != null &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(dateNumber(day)) ||
          new Date(dateNumber(day)).toISOString().slice(0, 10) !== day))) {
      throw new Error('作业排期无效，请重新保存作业。')
    }
  }
}

/** Count recurrence windows, never executions or the mutable planned date. */
function homeworkOffset(schedule: HomeworkSchedule, anchor: string, day: string, occurrence?: string): number {
  const [, cycle, periodStart, ordinalText] = occurrence?.split('/') ?? []
  if (cycle === schedule.cycle && /^\d{4}-\d{2}-\d{2}$/.test(periodStart ?? '')) {
    const period = homeworkPeriod(schedule, periodStart)
    const ordinal = Number(ordinalText)
    if (period && period.start === periodStart && Number.isInteger(ordinal) && ordinal >= 0 && ordinal < period.count) {
      day = shiftHomeworkDate(period.start, Math.floor(ordinal * period.span / period.count))
    }
  }
  let count = 0
  let cursor = anchor
  if (schedule.start_date && schedule.start_date > cursor) cursor = schedule.start_date
  while (cursor <= day) {
    if (schedule.end_date && cursor > schedule.end_date) break
    const period = homeworkPeriod(schedule, cursor)
    if (!period) { cursor = shiftHomeworkDate(cursor, 1); continue }
    for (let ordinal = 0; ordinal < period.count; ordinal++) {
      const start = shiftHomeworkDate(period.start, Math.floor(ordinal * period.span / period.count))
      const end = shiftHomeworkDate(period.start, Math.floor((ordinal + 1) * period.span / period.count) - 1)
      // Saving halfway through a window keeps its current occurrence as the first group.
      if (end >= anchor && start <= day) count++
    }
    cursor = schedule.cycle === 'weekly'
      ? shiftHomeworkDate(period.start, 7)
      : shiftHomeworkDate(period.end, 1)
  }
  return Math.max(0, count - 1)
}

/** Pure date resolution: previews, generation and execution agree without consuming a cursor. */
export function scheduledPracticeRow(binding: PracticeBinding, day: string, occurrence?: string) {
  const rule = binding.progression
  if (!rule) throw new Error('尚未设置课程推进方式。')
  validatePracticeProgression(rule)
  let anchor = dateNumber(rule.anchorDate)
  if (rule.mode !== 'homework' && rule.skipWeekends) {
    while ([0, 6].includes(new Date(anchor).getUTCDay())) anchor += DAY
  }
  const days = Math.max(0, Math.floor((dateNumber(day) - anchor) / DAY))
  if (!Number.isFinite(days)) throw new Error('课程日期无效。')
  const weekday = new Date(anchor).getUTCDay()
  let offset = 0
  if (rule.enabled && rule.mode === 'homework') {
    offset = homeworkOffset(rule.schedule!, rule.anchorDate, day, occurrence)
  } else if (rule.enabled && rule.mode === 'weekly') {
    const firstAdvance = ((rule.weekday - weekday + 6) % 7) + 1
    offset = days < firstAdvance ? 0 : 1 + Math.floor((days - firstAdvance) / 7)
  } else if (rule.enabled) {
    offset = days
    if (rule.skipWeekends) {
      offset = Math.floor(days / 7) * 5
      for (let i = 1; i <= days % 7; i++) {
        if (![0, 6].includes((weekday + i) % 7)) offset++
      }
    }
  }
  if (!binding.rows.length) return { row: null, rows: [], exhausted: false }
  const start = binding.rows.findIndex((row) => row.id === binding.startId)
  if (start < 0) throw new Error('课程开始项不存在，请重新选择。')
  const amount = rule.amount ?? 1
  const first = start + offset * amount
  const rows = binding.rows.slice(first, first + amount)
  return { row: rows[0] ?? null, rows, exhausted: rows.length === 0 }
}
