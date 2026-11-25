'use client'

import { createContext, useContext, useMemo } from 'react'
import { Locale } from '@svar-ui/react-core'
import { Gantt, Willow, type IColumnConfig, type ITask } from '@svar-ui/react-gantt'
import { Button, Flex, Text } from '@rosie/ui/themes'
import { courseColor } from '../../courseColors'
import { dateAfter } from '../../time'
import { DEFAULT_COURSE_PRIORITY, SUBJECTS, type TimetableCourse, type TimetableData } from '../../types'
import {
  buildCourseTimelines, calendarWeekStart, courseChartScale, timelineStatusLabels, type GanttScale,
} from './courseGanttTimeline'
import '@svar-ui/react-gantt/all.css'

type CourseTimeline = ReturnType<typeof buildCourseTimelines>[number]
const TimelineContext = createContext<{
  timelines: ReadonlyMap<string, CourseTimeline>
  position: (date: string) => number
  onOpenCourse: (course: TimetableCourse) => void
} | null>(null)

// SVAR uses the device calendar. Construct local dates from the timetable's Shanghai date labels.
const chartDate = (date: string) => new Date(date + 'T00:00:00')
const zhWeek = {
  0: { lang: 'zh-CN', calendar: { weekStart: 7 } },
  1: { lang: 'zh-CN', calendar: { weekStart: 1 } },
}
const yearMonth = (date: Date) => `${date.getFullYear()}年${date.getMonth() + 1}月`

function CourseCell({ row }: Parameters<NonNullable<IColumnConfig['cell']>>[0]) {
  const context = useContext(TimelineContext)
  const course = 'id' in row && typeof row.id === 'string' ? context?.timelines.get(row.id)?.course : undefined
  if (!course || !context) return null
  return (
    <Button type="button" size="1" variant="ghost" color="gray" title={course.name}
      className="m-0! h-auto! min-h-8 w-full min-w-0 justify-start! px-1! py-1! text-left"
      onClick={event => { event.stopPropagation(); context.onOpenCourse(course) }}>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{course.name}</span>
        <span className="block truncate text-xs font-normal text-[var(--gray-11)]">
          {course.priority ?? DEFAULT_COURSE_PRIORITY} · {SUBJECTS[course.subject]}{course.archived_at && ' · 已归档'}
        </span>
      </span>
    </Button>
  )
}

const columns: IColumnConfig[] = [{ id: 'text', header: '课程', width: 144, sort: false, cell: CourseCell }]

function CourseBar({ data }: { data: ITask }) {
  const context = useContext(TimelineContext)
  const timeline = context?.timelines.get(String(data.id))
  if (!timeline || !context) return null
  const { course, spans } = timeline
  const color = courseColor(course)
  return spans.map(span => {
    const start = context.position(span.from)
    const end = context.position(span.to)
    const last = dateAfter(span.to, -1)
    const dates = last === span.from ? span.from : `${span.from} 至 ${last}`
    const label = `${course.name}，${dates}，${timelineStatusLabels[span.status]}`
    return (
      <span key={`${span.status}:${span.from}`} role="img" aria-label={label} title={label}
        className="tasks-course-gantt-span" data-status={span.status}
        style={{ left: start, width: end - start, color: span.status === 'cancelled' ? undefined : color.value }} />
    )
  })
}

export default function CourseGanttChart({
  courses, data, from, to, today, scale, weekStartsOn, showCancelled, hideEmptyCourses, onOpenCourse,
}: {
  courses: TimetableCourse[]
  data: Pick<TimetableData, 'rules' | 'exceptions'>
  from: string
  to: string
  today: string
  scale: GanttScale
  weekStartsOn: 0 | 1
  showCancelled: boolean
  hideEmptyCourses: boolean
  onOpenCourse: (course: TimetableCourse) => void
}) {
  const rows = useMemo(() => {
    const timelines = buildCourseTimelines(courses, data, from, to, showCancelled)
    return hideEmptyCourses ? timelines.filter(row => row.spans.length > 0) : timelines
  }, [courses, data, from, to, showCancelled, hideEmptyCourses])
  const timelines = useMemo(() => new Map(rows.map(row => [row.course.id, row])), [rows])
  const axis = useMemo(() => courseChartScale(scale, from, to, weekStartsOn), [scale, from, to, weekStartsOn])
  // One transparent SVAR task establishes the row and scale. The task template draws only scheduled date spans.
  const tasks = useMemo<ITask[]>(() => rows.map(({ course }) => ({
    id: course.id, text: course.name, start: chartDate(axis.start), end: chartDate(axis.end),
  })), [rows, axis])
  const scales = useMemo(() => {
    const todayPeriod = scale === 'month' ? today.slice(0, 7) + '-01'
      : scale === 'week' ? calendarWeekStart(today, weekStartsOn) : today
    const current = chartDate(todayPeriod).getTime()
    const detail = {
      unit: scale,
      step: 1,
      format: scale === 'month' ? yearMonth : (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`,
      css: (date: Date) => date.getTime() === current ? 'tasks-course-gantt-current' : '',
    }
    return scale === 'day' ? [{ unit: 'month', step: 1, format: yearMonth }, detail] : [detail]
  }, [scale, today, weekStartsOn])
  const range = useMemo(() => ({ start: chartDate(axis.start), end: chartDate(axis.end) }), [axis])
  const hasFlexible = rows.some(row => row.spans.some(span => span.status === 'flexible'))
  const hasCancelled = rows.some(row => row.spans.some(span => span.status === 'cancelled'))

  if (!rows.length) {
    return <Text as="p" size="2" color="gray" role="status">所选时间范围内没有符合筛选的排课。</Text>
  }

  return (
    <TimelineContext.Provider value={{ timelines, position: axis.position, onOpenCourse }}>
      <div className="min-h-0 flex-1">
        <Locale words={zhWeek[weekStartsOn]}>
          <Willow fonts={false}>
            <Gantt key={`${scale}:${axis.start}:${axis.end}`} readonly autoScale={false}
              tasks={tasks} columns={columns} taskTemplate={CourseBar} scales={scales} lengthUnit={scale}
              start={range.start} end={range.end} cellWidth={axis.cellWidth} cellHeight={52} scaleHeight={30} />
          </Willow>
        </Locale>
      </div>
      {(hasFlexible || hasCancelled) && (
        <Flex align="center" gap="3" px="2" py="1" className="tasks-course-gantt-legend">
          <Text size="1" color="gray">实条 · 排课</Text>
          {hasFlexible && <Text size="1" color="gray">细彩线 · 灵活排课</Text>}
          {hasCancelled && <Text size="1" color="gray">细灰线 · 停课</Text>}
        </Flex>
      )}
    </TimelineContext.Provider>
  )
}
