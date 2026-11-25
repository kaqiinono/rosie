import { dateAfter, localDate } from '../../time'
import { previewCourseDates, previewOccurrences } from '../../timetable'
import type { CourseRule, TimetableCourse, TimetableData } from '../../types'

export type GanttScale = 'day' | 'week' | 'month'
type TimelineStatus = 'scheduled' | 'flexible' | 'cancelled'
type CourseSpan = { from: string; to: string; status: TimelineStatus }

export const timelineStatusLabels = { scheduled: '排课', flexible: '灵活排课', cancelled: '停课' }
export const calendarDay = (date: string) => Date.parse(date + 'T00:00:00Z') / 86_400_000

export function calendarWeekStart(date: string, weekday: 0 | 1) {
  const day = new Date(date + 'T00:00:00Z').getUTCDay()
  return dateAfter(date, -((day - weekday + 7) % 7))
}

function nextMonth(date: string) {
  const next = new Date(date.slice(0, 7) + '-01T00:00:00Z')
  next.setUTCMonth(next.getUTCMonth() + 1)
  return next.toISOString().slice(0, 10)
}

export function courseChartScale(scale: GanttScale, from: string, to: string, weekStartsOn: 0 | 1) {
  const start = scale === 'month' ? from.slice(0, 7) + '-01'
    : scale === 'week' ? calendarWeekStart(from, weekStartsOn) : from
  const end = scale === 'month' ? nextMonth(to)
    : scale === 'week' ? dateAfter(calendarWeekStart(to, weekStartsOn), 7) : dateAfter(to, 1)
  const cellWidth = { day: 46, week: 64, month: 116 }[scale]
  const origin = calendarDay(start)
  const monthOrigin = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7))

  function position(date: string) {
    const day = calendarDay(date)
    if (scale !== 'month') return (day - origin) * cellWidth / (scale === 'week' ? 7 : 1)
    const first = calendarDay(date.slice(0, 7) + '-01')
    const month = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7))
    return (month - monthOrigin + (day - first) / (calendarDay(nextMonth(date)) - first)) * cellWidth
  }

  return { start, end, cellWidth, position }
}

export function buildCourseTimelines(
  courses: TimetableCourse[], data: Pick<TimetableData, 'rules' | 'exceptions'>,
  from: string, to: string, showCancelled: boolean,
) {
  const rows = courses.map(course => ({
    course, dates: { scheduled: new Set<string>(), flexible: new Set<string>(), cancelled: new Set<string>() },
  }))
  const byCourse = new Map(rows.map(row => [row.course.id, row]))
  const rules = data.rules.filter(rule => byCourse.has(rule.course_id))
  const occurrences = previewOccurrences({
    rules, exceptions: data.exceptions,
    courses: courses.map(course => course.archived_at ? { ...course, archived_at: null } : course),
  }, from, to)

  for (const occurrence of occurrences) {
    if (occurrence.status === 'cancelled' && !showCancelled) continue
    const row = byCourse.get(occurrence.course_id)
    if (!row) continue
    const archivedAt = row.course.archived_at
    if (archivedAt && Date.parse(occurrence.starts_at) >= Date.parse(archivedAt)) continue
    const dates = row.dates[occurrence.status]
    const start = localDate(new Date(occurrence.starts_at))
    const finish = localDate(new Date(Date.parse(occurrence.ends_at) - 1))
    for (let date = start < from ? from : start; date <= to && date <= finish; date = dateAfter(date, 1)) {
      dates.add(date)
    }
  }

  const flexibleRules = new Map<string, CourseRule[]>()
  for (const rule of rules) {
    if (rule.kind !== 'flexible') continue
    const group = flexibleRules.get(rule.course_id)
    if (group) group.push(rule)
    else flexibleRules.set(rule.course_id, [rule])
  }

  return rows.map(({ course, dates }) => {
    const flexible = flexibleRules.get(course.id)
    if (flexible) {
      const archivedOn = course.archived_at ? localDate(new Date(course.archived_at)) : to
      for (const date of previewCourseDates(flexible, from, archivedOn < to ? archivedOn : to)) {
        dates.flexible.add(date)
      }
    }

    const spans: CourseSpan[] = []
    const statuses: TimelineStatus[] = ['scheduled', 'flexible', 'cancelled']
    for (const status of statuses) {
      let span: CourseSpan | undefined
      for (const date of Array.from(dates[status]).sort()) {
        if (span?.to === date) {
          span.to = dateAfter(date, 1)
        } else {
          span = { from: date, to: dateAfter(date, 1), status }
          spans.push(span)
        }
      }
    }
    return { course, spans }
  })
}
