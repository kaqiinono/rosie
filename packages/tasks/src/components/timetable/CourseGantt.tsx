'use client'

import { useState, type RefObject } from 'react'
import dynamic from 'next/dynamic'
import { AppDialog } from '@rosie/ui'
import { Button, Flex, Heading, SegmentedControl, Spinner, Text } from '@rosie/ui/themes'
import { dateAfter } from '../../time'
import type { TimetableCalendar, TimetableCourse, TimetableData } from '../../types'
import { calendarDay, calendarWeekStart, type GanttScale } from './courseGanttTimeline'
import './course-gantt.css'

const CourseGanttChart = dynamic(() => import('./CourseGanttChart'), {
  ssr: false,
  loading: () => (
    <Flex align="center" justify="center" flexGrow="1" role="status">
      <Spinner />
      <span className="sr-only">正在加载甘特图</span>
    </Flex>
  ),
})

const daysPerWindow = 84
const viewLabels = { day: '日', week: '周', month: '月' } satisfies Record<GanttScale, string>

export default function CourseGantt({
  courses, data, calendar, today, weekStartsOn, showCancelled, returnFocusRef, onOpenCourse, onClose,
}: {
  courses: TimetableCourse[]
  data: Pick<TimetableData, 'rules' | 'exceptions'>
  calendar?: TimetableCalendar
  today: string
  weekStartsOn: 0 | 1
  showCancelled: boolean
  returnFocusRef: RefObject<HTMLButtonElement | null>
  onOpenCourse: (course: TimetableCourse) => void
  onClose: () => void
}) {
  const [windowOffset, setWindowOffset] = useState(0)
  const [scale, setScale] = useState<GanttScale>('week')
  const termEnd = calendar?.ends_on
  const termDays = termEnd && calendar ? calendarDay(termEnd) - calendarDay(calendar.starts_on) : -1
  const fullTerm = Boolean(calendar && termEnd && termDays >= 0 && termDays <= 3660)
  const anchor = calendar && calendar.starts_on > today ? calendar.starts_on : today
  const from = fullTerm && calendar ? calendar.starts_on : dateAfter(calendarWeekStart(anchor, weekStartsOn), windowOffset * daysPerWindow)
  const to = fullTerm && termEnd ? termEnd : dateAfter(from, daysPerWindow - 1)
  return (
    <AppDialog open title="课程甘特图" presentation="fullscreen" chrome="none" contentLayout="fill" returnFocusRef={returnFocusRef}
      onOpenChange={open => { if (!open) onClose() }}>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="tasks-course-gantt-panel flex min-h-0 min-w-0 flex-col bg-white">
          <Flex align="center" justify="between" gap="2" flexShrink="0" pb="2">
            <Heading as="h2" size="4" aria-hidden="true">课程甘特图</Heading>
            <Flex align="center" gap="2">
              <SegmentedControl.Root aria-label="甘特图时间刻度" value={scale}
                onValueChange={value => setScale(value as GanttScale)}>
                {Object.entries(viewLabels).map(([unit, label]) => (
                  <SegmentedControl.Item key={unit} value={unit}>{label}</SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
              <Button type="button" variant="soft" color="gray" onClick={onClose}>关闭</Button>
            </Flex>
          </Flex>
          <Flex align="center" justify="between" wrap="wrap" gap="2" flexShrink="0" pb="3">
            <Text size="2" weight="medium" className="tabular-nums" role="status">
              {calendar?.name ?? '全部课表'} · {from} 至 {to}
            </Text>
            {!fullTerm && <Flex gap="2" wrap="wrap">
              <Button size="1" variant="soft" onClick={() => setWindowOffset(value => value - 1)}>前 12 周</Button>
              {windowOffset !== 0 && <Button size="1" variant="soft" onClick={() => setWindowOffset(0)}>返回默认范围</Button>}
              <Button size="1" variant="soft" onClick={() => setWindowOffset(value => value + 1)}>后 12 周</Button>
            </Flex>}
          </Flex>
          {courses.length ? (
            <div className="tasks-course-gantt-chart flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl"
              role="region" aria-label={`课程时间线，按${viewLabels[scale]}显示`}>
              <CourseGanttChart courses={courses} data={data} from={from} to={to} today={today} scale={scale}
                weekStartsOn={weekStartsOn} showCancelled={showCancelled} onOpenCourse={onOpenCourse} />
            </div>
          ) : <Text size="2" color="gray">当前筛选下没有课程。</Text>}
        </div>
      </div>
    </AppDialog>
  )
}
