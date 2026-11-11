'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  Flex,
  Grid,
  IconButton,
  Popover,
  SegmentedControl,
  Select,
  Tabs,
  Text,
  TextField,
} from '@rosie/ui/themes'
import type { TimetableCourse, TimetableOccurrence } from '../types'
import { SUBJECTS } from '../types'
import { dateAfter, localDate } from '../time'
import {
  DEFAULT_TIMETABLE_PREFERENCES,
  previewOccurrences,
  recurrenceLabel,
  timetableStats,
} from '../timetable'
import { useTimetable, weekdays } from './shared'
import CalendarGrid from './timetable/CalendarGrid'
import MonthCalendar from './timetable/MonthCalendar'
import CourseEditor from './timetable/CourseEditor'
import CourseDetails from './timetable/CourseDetails'
import CalendarSettings from './timetable/CalendarSettings'
import { clockTime, courseColor, statusLabel } from './timetable/presentation'
import { StickerCard } from '@rosie/ui'
import { useRouter } from 'next/navigation'
import {
  TASK_SECTIONS,
  isTimetableSection,
  sectionHref,
  type TaskSection,
  type TimetableSection,
} from './taskSections'

// 同级模块：课程表（按日/周/月粒度展示）、日程、课程在页内切换；作业是独立路由 /tasks/homework
type Section = TimetableSection
type Granularity = 'day' | 'week' | 'month'
type View = Granularity | 'agenda' | 'courses'
type Editor = { course?: TimetableCourse; duplicate?: boolean; date: string; time?: string }
const granularities = [
  ['day', '日'],
  ['week', '周'],
  ['month', '月'],
] as const

function CourseActionIcon({
  action,
}: {
  action: 'view' | 'edit' | 'copy' | 'archive' | 'restore'
}) {
  const paths = {
    view: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    edit: (
      <>
        <path d="m16 3 5 5M4 15l-1 6 6-1L21 8a2.8 2.8 0 0 0-5-5L4 15Z" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    archive: (
      <>
        <rect x="3" y="3" width="18" height="5" rx="1" />
        <path d="M5 8v12h14V8M10 12h4" />
      </>
    ),
    restore: (
      <>
        <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
      </>
    ),
  }
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[action]}
    </svg>
  )
}

export default function Timetable() {
  const { api } = useTimetable()
  const router = useRouter()
  const preferences = { ...DEFAULT_TIMETABLE_PREFERENCES, ...api.data.preferences[0]?.settings }
  const [date, setDate] = useState(localDate),
    [section, setSection] = useState<Section>('schedule'),
    [granularity, setGranularity] = useState<Granularity>('week')
  const view: View = section === 'schedule' ? granularity : section
  const [calendar, setCalendar] = useState(''),
    [subject, setSubject] = useState(''),
    [query, setQuery] = useState(''),
    [courseFilter, setCourseFilter] = useState('')
  const [archived, setArchived] = useState(false),
    [showCancelled, setShowCancelled] = useState(true)
  const [editor, setEditor] = useState<Editor | null>(null),
    [selection, setSelection] = useState<{
      course: TimetableCourse
      occurrence?: TimetableOccurrence
      initialAction?: 'detail' | 'archive'
    } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      requested = params.get('date')
    if (
      requested &&
      /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
      Number.isFinite(Date.parse(requested))
    )
      setDate(requested)
    setCourseFilter(params.get('course') ?? '')
    const requestedSection = params.get('section')
    if (isTimetableSection(requestedSection)) setSection(requestedSection)
  }, [])
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(),
    week = dateAfter(date, -((weekday - preferences.week_start + 7) % 7))
  const monthStart = date.slice(0, 7) + '-01'
  const monthEnd = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10)
  const monthFrom = dateAfter(
    monthStart,
    -((new Date(monthStart + 'T12:00:00Z').getUTCDay() - preferences.week_start + 7) % 7),
  )
  const monthTo = dateAfter(
    monthEnd,
    (preferences.week_start + 6 - new Date(monthEnd + 'T12:00:00Z').getUTCDay() + 7) % 7,
  )
  const from = view === 'month' ? monthFrom : view === 'day' ? date : week
  const to =
    view === 'month'
      ? monthTo
      : view === 'day'
        ? date
        : dateAfter(week, view === 'agenda' ? 27 : view === 'week' ? 13 : 6)
  const courses = api.data.courses.filter(
    (course) =>
      !!course.archived_at === archived &&
      (!calendar || course.calendar_id === calendar) &&
      (!subject || course.subject === subject) &&
      (!courseFilter || course.id === courseFilter) &&
      `${course.name} ${course.teacher ?? ''} ${course.location ?? ''}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  )
  const courseIds = new Set(courses.map((course) => course.id)),
    allRows = previewOccurrences(api.data, from, to).filter((row) => courseIds.has(row.course_id))
  const rows = allRows.filter((row) => showCancelled || row.status !== 'cancelled'),
    stats = timetableStats(
      view === 'month'
        ? allRows.filter((row) => localDate(new Date(row.starts_at)).startsWith(date.slice(0, 7)))
        : allRows,
    )
  const days =
    view === 'day'
      ? [date]
      : Array.from({ length: view === 'week' ? 14 : 7 }, (_, i) => dateAfter(week, i)).filter(
          (day) =>
            preferences.show_weekends || ![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()),
        )
  const choose = (occurrence: TimetableOccurrence) => {
    const course = api.data.courses.find((c) => c.id === occurrence.course_id)
    if (course) setSelection({ course, occurrence })
  }
  const step = view === 'day' ? 1 : view === 'agenda' ? 28 : 7
  const navigate = (direction: number) => {
    if (view === 'month') {
      const target = new Date(
        Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) + direction, 0),
      )
      target.setUTCDate(Math.min(Number(date.slice(8)), target.getUTCDate()))
      setDate(target.toISOString().slice(0, 10))
    } else setDate(dateAfter(date, direction * step))
  }
  const today = localDate()
  const weekDays = Array.from({ length: 7 }, (_, i) => dateAfter(week, i))
  const filterCount = [calendar, subject, courseFilter, archived, !showCancelled].filter(
    Boolean,
  ).length
  const shortDate = (value: string) => `${Number(value.slice(5, 7))}月${Number(value.slice(8))}日`
  const rangeTitle =
    view === 'courses'
      ? archived
        ? '已归档课程'
        : '全部课程'
      : view === 'month'
        ? `${Number(date.slice(5, 7))}月`
        : view === 'day'
          ? `${shortDate(date)} · ${weekdays[weekday]}`
          : `${shortDate(from)} — ${from.slice(0, 4) !== to.slice(0, 4) ? to.slice(0, 4) + '年' : ''}${shortDate(to)}`
  const agendaDays = Array.from(new Set(rows.map((row) => localDate(new Date(row.starts_at)))))
  const periodLabel = view === 'month' ? `${date.slice(0, 4)}年${rangeTitle}` : rangeTitle
  const resetFilters = () => {
    setCalendar('')
    setSubject('')
    setCourseFilter('')
    setArchived(false)
    setShowCancelled(true)
  }

  const dateInput = (
    <TextField.Root
      aria-label="跳转日期"
      type="date"
      value={date}
      onChange={(e) => {
        if (e.target.value) setDate(e.target.value)
      }}
    />
  )

  return (
    <div className="min-w-0">
      <StickerCard
        as="section"
        size="none"
        elevation="lg"
        className="min-w-0 overflow-hidden"
        aria-label="课表"
      >
        <Tabs.Root
          value={section}
          onValueChange={(value) => {
            if (value === 'homework') router.push(sectionHref(value as TaskSection))
            else setSection(value as Section)
          }}
        >
          <div className="px-3 pt-1 sm:px-5">
            <Tabs.List size="2" aria-label="课程安排模块">
              {TASK_SECTIONS.map(([value, label]) => (
                <Tabs.Trigger key={value} value={value}>
                  {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </div>
          <Flex direction="column" gap="3" px={{ initial: '3', sm: '5' }} py="3">
            <Flex wrap="wrap" align="center" gap="2">
              {section === 'schedule' && (
                <SegmentedControl.Root
                  aria-label="课程表粒度"
                  value={granularity}
                  onValueChange={(value) => setGranularity(value as Granularity)}
                >
                  {granularities.map(([value, label]) => (
                    <SegmentedControl.Item key={value} value={value}>
                      {label}
                    </SegmentedControl.Item>
                  ))}
                </SegmentedControl.Root>
              )}
              {view !== 'courses' && (
                <>
                  <IconButton variant="soft" aria-label="上一时段" onClick={() => navigate(-1)}>
                    ‹
                  </IconButton>
                  <Button variant="soft" onClick={() => setDate(today)}>
                    今天
                  </Button>
                  <IconButton variant="soft" aria-label="下一时段" onClick={() => navigate(1)}>
                    ›
                  </IconButton>
                  {view === 'day' ? (
                    dateInput
                  ) : (
                    <Popover.Root>
                      <Popover.Trigger>
                        <Button variant="soft" aria-label={periodLabel + '，选择跳转日期'}>
                          {periodLabel} ▾
                        </Button>
                      </Popover.Trigger>
                      <Popover.Content size="1">{dateInput}</Popover.Content>
                    </Popover.Root>
                  )}
                </>
              )}
              <div className="min-w-40 flex-1">
                <TextField.Root
                  ref={searchRef}
                  type="search"
                  aria-label="搜索课程、教师或地点"
                  placeholder="搜索课程、教师或地点"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                >
                  {query && (
                    <TextField.Slot side="right">
                      <IconButton
                        size="1"
                        variant="ghost"
                        aria-label="清空搜索"
                        onClick={() => {
                          setQuery('')
                          searchRef.current?.focus()
                        }}
                      >
                        ×
                      </IconButton>
                    </TextField.Slot>
                  )}
                </TextField.Root>
              </div>
              <Button
                variant="soft"
                aria-controls="timetable-filters"
                aria-expanded={showFilters}
                onClick={() => setShowFilters(!showFilters)}
              >
                筛选{filterCount > 0 && <Badge>{filterCount}</Badge>}
              </Button>
              <CalendarSettings calendarId={calendar} onCalendarChange={setCalendar} />
              {section === 'courses' && (
                <Button onClick={() => setEditor({ date })}>新建课程</Button>
              )}
            </Flex>
            <div id="timetable-filters" hidden={!showFilters}>
              <div className="border-kid-line space-y-4 rounded-xl border-2 bg-slate-50 p-4">
                <Flex wrap="wrap" gap="3" align="center">
                  <Select.Root
                    value={calendar || 'all'}
                    onValueChange={(v) => setCalendar(v === 'all' ? '' : v)}
                  >
                    <Select.Trigger aria-label="课表 / 学期" />
                    <Select.Content>
                      <Select.Item value="all">全部课表</Select.Item>
                      {api.data.calendars.map((c) => (
                        <Select.Item key={c.id} value={c.id}>
                          {c.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                  <Select.Root
                    value={subject || 'all'}
                    onValueChange={(v) => setSubject(v === 'all' ? '' : v)}
                  >
                    <Select.Trigger aria-label="科目" />
                    <Select.Content>
                      <Select.Item value="all">全部科目</Select.Item>
                      {Object.entries(SUBJECTS).map(([key, label]) => (
                        <Select.Item key={key} value={key}>
                          {label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                  <Text as="label" size="2">
                    <Checkbox
                      mr="2"
                      checked={archived}
                      onCheckedChange={(v) => {
                        setArchived(v === true)
                        if (v === true) setSection('courses')
                      }}
                    />
                    已归档课程
                  </Text>
                  <Text as="label" size="2">
                    <Checkbox
                      mr="2"
                      checked={showCancelled}
                      onCheckedChange={(v) => setShowCancelled(v === true)}
                    />
                    显示停课记录
                  </Text>
                  {filterCount > 0 && (
                    <Button variant="soft" onClick={resetFilters}>
                      重置筛选
                    </Button>
                  )}
                </Flex>
              </div>
            </div>
            {filterCount > 0 && (
              <Flex wrap="wrap" align="center" gap="2" aria-label="当前筛选">
                {calendar && (
                  <Badge>
                    课表：
                    {api.data.calendars.find((item) => item.id === calendar)?.name || '指定课表'}
                  </Badge>
                )}
                {subject && (
                  <Badge>
                    科目：{Object.entries(SUBJECTS).find(([key]) => key === subject)?.[1]}
                  </Badge>
                )}
                {archived && <Badge color="gray">已归档</Badge>}
                {!showCancelled && <Badge color="gray">隐藏停课</Badge>}
                {courseFilter && (
                  <Button
                    size="1"
                    variant="soft"
                    aria-label="清除指定课程筛选"
                    onClick={() => setCourseFilter('')}
                  >
                    {api.data.courses.find((c) => c.id === courseFilter)?.name || '指定课程'} ×
                  </Button>
                )}
              </Flex>
            )}
            <Flex wrap="wrap" align="center" gap="2">
              <Text size="1" color="gray">
                {api.data.calendars.find((item) => item.id === calendar)?.name || '全部课表'}
              </Text>
              <Text size="1" color="gray" aria-hidden="true">
                ·
              </Text>
              {view === 'courses' ? (
                <Text size="1" color="gray">
                  {courses.length} 门课程{archived && ' · 已归档'}
                </Text>
              ) : (
                <>
                  <Text size="1" color="gray">
                    <Text weight="bold" highContrast>
                      {stats.courses}
                    </Text>{' '}
                    门课
                  </Text>
                  <Text size="1" color="gray">
                    <Text weight="bold" highContrast>
                      {stats.occurrences}
                    </Text>{' '}
                    课次
                  </Text>
                  <Text size="1" color="gray">
                    <Text weight="bold" highContrast>
                      {Math.round(stats.minutes / 6) / 10}
                    </Text>{' '}
                    小时
                  </Text>
                  {stats.conflicts > 0 && (
                    <Badge color="amber">⚠ {stats.conflicts} 课次时间重叠</Badge>
                  )}
                </>
              )}
            </Flex>
          </Flex>
          <Tabs.Content key={view} value={section}>
            {view === 'day' && (
              <div
                className="border-kid-line grid grid-cols-7 gap-1 border-t px-3 py-3 md:hidden"
                role="group"
                aria-label="选择本周日期"
              >
                {weekDays.map((day) => (
                  <Button
                    key={day}
                    size="1"
                    variant={day === date ? 'solid' : 'soft'}
                    color={day === date || day === today ? undefined : 'gray'}
                    onClick={() => setDate(day)}
                    aria-label={day + (day === today ? ' 今天' : '')}
                    aria-pressed={day === date}
                  >
                    {day === today
                      ? '今'
                      : weekdays[new Date(day + 'T12:00:00Z').getUTCDay()].slice(-1)}
                    {Number(day.slice(8))}
                  </Button>
                ))}
              </div>
            )}

            {view === 'day' || view === 'week' ? (
              <>
                <CalendarGrid
                  days={days}
                  occurrences={rows}
                  courses={api.data.courses}
                  preferences={preferences}
                  onSelect={choose}
                  onAdd={(day, time) => setEditor({ date: day, time })}
                />
                {!allRows.length && (
                  <div className="border-kid-line border-t px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-slate-700">这段时间没有匹配课程</p>
                    <p className="mt-1 text-xs text-slate-500">
                      调整筛选，或添加一门课程开始安排。
                    </p>
                    <Button mt="3" onClick={() => setEditor({ date })}>
                      新建课程
                    </Button>
                  </div>
                )}
                {showCancelled && rows.some((row) => row.status === 'cancelled') && (
                  <div className="border-kid-line border-t bg-slate-50/60 p-4">
                    <h3 className="mb-2 text-xs font-semibold text-slate-500">停课记录</h3>
                    <div className="flex flex-wrap gap-2">
                      {rows
                        .filter((row) => row.status === 'cancelled')
                        .map((row) => (
                          <Button variant="soft" size="1" key={row.id} onClick={() => choose(row)}>
                            {courses.find((c) => c.id === row.course_id)?.name} ·{' '}
                            {localDate(new Date(row.starts_at))}{' '}
                            {clockTime(row.starts_at, preferences.hour12)}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : view === 'month' ? (
              <MonthCalendar
                hour12={preferences.hour12}
                month={date.slice(0, 7)}
                from={monthFrom}
                to={monthTo}
                courses={api.data.courses}
                occurrences={rows}
                onSelect={choose}
                onDay={(day) => {
                  setDate(day)
                  setGranularity('day')
                }}
                onAdd={(day) => setEditor({ date: day })}
              />
            ) : view === 'agenda' ? (
              <div className="border-kid-line border-t">
                {agendaDays.map((day) => (
                  <section
                    key={day}
                    aria-label={`${shortDate(day)}日程`}
                    className="border-kid-line border-b last:border-b-0"
                  >
                    <h3 className="flex items-center gap-2 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-600 sm:px-6">
                      <span className={day === today ? 'text-[var(--accent-11)]' : ''}>
                        {shortDate(day)}
                      </span>
                      <span className="font-normal text-slate-500">
                        {weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()]}
                      </span>
                      {day === today && <Badge>今天</Badge>}
                    </h3>
                    <div className="divide-kid-line divide-y">
                      {rows
                        .filter((row) => localDate(new Date(row.starts_at)) === day)
                        .map((row) => {
                          const course = courses.find((c) => c.id === row.course_id),
                            color = courseColor(course)
                          return (
                            <button // native-ok: 整块可点击容器（内含多行内容），Radix Button 是 inline-flex 居中，不适用
                              type="button"
                              key={row.id}
                              onClick={() => choose(row)}
                              className="flex w-full cursor-pointer items-center gap-3 px-4 py-4 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-8)] active:bg-slate-100 sm:gap-5 sm:px-6"
                            >
                              <span className="w-20 shrink-0 tabular-nums">
                                <span className="block text-sm font-semibold text-slate-800">
                                  {clockTime(row.starts_at, preferences.hour12)}
                                </span>
                                <span className="mt-1 block text-xs text-slate-500">
                                  {clockTime(row.ends_at, preferences.hour12)}
                                </span>
                              </span>
                              <span
                                className="h-10 w-1 shrink-0 rounded-full"
                                style={{ backgroundColor: color.border }}
                              />
                              <span className="min-w-0 flex-1">
                                <strong
                                  className={`block truncate text-sm text-slate-800 ${row.status === 'cancelled' ? 'line-through' : ''}`}
                                >
                                  {course?.name}
                                </strong>
                                <span className="mt-1 block truncate text-xs text-slate-500">
                                  {[
                                    preferences.show_location && course?.location,
                                    preferences.show_teacher && course?.teacher,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </span>
                              <Badge color={row.status === 'cancelled' ? 'gray' : undefined}>
                                {statusLabel[row.status]}
                              </Badge>
                              <span aria-hidden="true" className="hidden text-slate-400 sm:block">
                                ›
                              </span>
                            </button>
                          )
                        })}
                    </div>
                  </section>
                ))}
                {!rows.length && (
                  <div className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-700">未来四周没有匹配课程</p>
                    <p className="mt-2 text-xs text-slate-500">试试调整日期或筛选条件。</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-kid-line grid gap-4 border-t bg-slate-50/50 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                {courses.map((course) => {
                  const color = courseColor(course)
                  const activeRules = api.data.rules
                    .filter(
                      (r) =>
                        r.course_id === course.id &&
                        (!r.disabled_from || r.disabled_from > today) &&
                        (!r.valid_until || r.valid_until >= today),
                    )
                    .sort(
                      (a, b) =>
                        (b.weekday || 7) - (a.weekday || 7) ||
                        (b.start_time ?? '').localeCompare(a.start_time ?? ''),
                    )
                  return (
                    <article
                      key={course.id}
                      className="group border-kid-line shadow-sticker ease-spring hover:border-kid-line-strong flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border-2 bg-white transition-[transform,border-color] duration-200 hover:-translate-y-0.5 motion-reduce:transition-none"
                    >
                      <button // native-ok: 整块可点击容器（内含多行内容），Radix Button 是 inline-flex 居中，不适用
                        type="button"
                        onClick={() => setSelection({ course })}
                        className="flex w-full min-w-0 flex-1 cursor-pointer flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-8)]"
                      >
                        <div
                          className="flex w-full shrink-0 items-center justify-between gap-3 px-4 py-3 text-slate-800"
                          style={{ backgroundColor: color.background }}
                        >
                          <strong className="min-w-0 truncate text-base font-semibold">
                            {course.name}
                          </strong>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <Badge color="gray" variant="surface">
                              {SUBJECTS[course.subject]}
                            </Badge>
                            {course.archived_at && (
                              <Badge color="gray" variant="surface">
                                已归档
                              </Badge>
                            )}
                          </span>
                        </div>
                        <div className="flex w-full flex-1 flex-col gap-2 px-4 py-3">
                          <p className="truncate text-xs text-slate-500">
                            {[course.teacher, course.location].filter(Boolean).join(' · ') ||
                              '教师与地点未填写'}
                          </p>
                          <div className="space-y-1.5">
                            {activeRules.map((rule) => (
                              <p
                                key={rule.id}
                                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs"
                              >
                                <span className="font-medium text-slate-700 tabular-nums">
                                  {weekdays[rule.weekday]}{' '}
                                  {rule.kind === 'flexible'
                                    ? '自由课程'
                                    : `${rule.start_time.slice(0, 5)}–${rule.end_time.slice(0, 5)}`}
                                </span>
                                <span className="text-slate-500">{recurrenceLabel(rule)}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      </button>
                      <footer
                        aria-label={`${course.name}操作`}
                        className="border-kid-line border-t p-2"
                      >
                        <Grid columns="4" gap="1">
                          <Button
                            variant="soft"
                            aria-label={`查看${course.name}`}
                            onClick={() => setSelection({ course })}
                          >
                            <CourseActionIcon action="view" />
                            查看
                          </Button>
                          <Button
                            variant="soft"
                            color="gray"
                            aria-label={`编辑${course.name}`}
                            disabled={!!course.archived_at}
                            title={course.archived_at ? '恢复课程后可编辑' : undefined}
                            onClick={() => setEditor({ course, date })}
                          >
                            <CourseActionIcon action="edit" />
                            编辑
                          </Button>
                          <Button
                            variant="soft"
                            color="gray"
                            aria-label={`复制${course.name}`}
                            onClick={() => setEditor({ course, duplicate: true, date })}
                          >
                            <CourseActionIcon action="copy" />
                            复制
                          </Button>
                          <Button
                            variant="soft"
                            color="amber"
                            aria-label={`${course.archived_at ? '查看并恢复' : '归档'}${course.name}`}
                            onClick={() =>
                              setSelection({
                                course,
                                initialAction: course.archived_at ? 'detail' : 'archive',
                              })
                            }
                          >
                            <CourseActionIcon action={course.archived_at ? 'restore' : 'archive'} />
                            {course.archived_at ? '恢复' : '归档'}
                          </Button>
                        </Grid>
                      </footer>
                    </article>
                  )
                })}
                {!courses.length && (
                  <div className="col-span-full px-4 py-10 text-center">
                    <p className="text-sm font-semibold text-slate-700">没有匹配课程</p>
                    <p className="mt-2 text-xs text-slate-500">调整筛选，或新建第一门课程。</p>
                    <Button mt="3" onClick={() => setEditor({ date })}>
                      新建课程
                    </Button>
                  </div>
                )}
              </div>
            )}
            {view !== 'courses' && view !== 'agenda' && (
              <footer className="border-kid-line flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-[11px] text-slate-500 sm:px-6">
                <span>
                  {view === 'month'
                    ? '点击日期查看当天 · 点击 ＋ 添加课程'
                    : view === 'week'
                      ? '向右滑动查看下周 · 点击课程查看详情 · 点击空白时段添加课程'
                      : '点击课程查看详情 · 点击空白时段添加课程'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--accent-9)]" />
                  {view === 'week' ? '周课表' : view === 'day' ? '日课表' : '月课表'}
                </span>
              </footer>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </StickerCard>
      {editor && (
        <CourseEditor
          {...editor}
          calendarId={calendar || undefined}
          onClose={() => setEditor(null)}
        />
      )}
      {selection && (
        <CourseDetails
          key={selection.occurrence?.id ?? selection.course.id}
          {...selection}
          onClose={() => setSelection(null)}
          onEdit={(duplicate) => {
            setEditor({
              course: selection.course,
              duplicate,
              date: selection.occurrence?.original_date ?? date,
            })
            setSelection(null)
          }}
        />
      )}
    </div>
  )
}
