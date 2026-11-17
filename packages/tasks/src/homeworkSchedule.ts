import type { Homework } from './homework'

/** The recurrence fields frozen with an occurrence-based course rule. */
export type HomeworkSchedule = Pick<Homework,
  'cycle' | 'include_weekends' | 'times_per_week' | 'times_per_cycle' |
  'start_weekday' | 'end_weekday' | 'start_date' | 'end_date'>

const diff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
export const shiftHomeworkDate = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

export function homeworkScheduleSnapshot(input: HomeworkSchedule): HomeworkSchedule {
  return {
    cycle: input.cycle,
    include_weekends: input.include_weekends ?? true,
    times_per_week: input.times_per_week,
    times_per_cycle: input.times_per_cycle,
    start_weekday: input.start_weekday,
    end_weekday: input.end_weekday,
    start_date: input.start_date,
    end_date: input.end_date,
  }
}

/** Shared by garden generation and course selection; counts use identical windows. */
export function homeworkPeriod(t: HomeworkSchedule, day: string) {
  const weekday = new Date(`${day}T12:00Z`).getUTCDay()
  if (t.cycle === 'daily' && t.include_weekends === false && [0, 6].includes(weekday)) return null
  let start = day
  let span = 1
  let count = 1
  if (t.cycle === 'weekly') {
    start = shiftHomeworkDate(day, -((weekday - t.start_weekday! + 7) % 7))
    span = ((t.end_weekday! - t.start_weekday! + 7) % 7) + 1
    count = t.times_per_week!
  } else if (t.cycle === 'monthly') {
    start = day.slice(0, 7) + '-01'
    span = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate()
    count = t.times_per_cycle!
  } else if (t.cycle !== 'daily') {
    const anchor = t.start_date!
    if (day < anchor || (t.end_date && day > t.end_date)) return null
    span = t.cycle === 'custom' ? 7 : t.cycle === 'biweekly' ? 14 : 21
    start = shiftHomeworkDate(anchor, Math.floor(diff(day, anchor) / span) * span)
    if (t.end_date) span = Math.min(span, diff(t.end_date, start) + 1)
    count = t.times_per_cycle ?? t.times_per_week!
  }
  return { start, end: shiftHomeworkDate(start, span - 1), count: Math.min(count, span), span }
}
