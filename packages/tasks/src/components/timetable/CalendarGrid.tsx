'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import type { TimetableCourse, TimetableOccurrence, TimetablePreferences } from '../../types'
import { atTime, dateAfter, localDate } from '../../time'
import { layoutOccurrences } from '../../timetable'
import { weekdays } from '../shared'
import { clockTime, courseColor } from './presentation'

export default function CalendarGrid({
  days,
  occurrences,
  courses,
  preferences,
  onSelect,
  onAdd,
}: {
  days: string[]
  occurrences: TimetableOccurrence[]
  courses: TimetableCourse[]
  preferences: TimetablePreferences
  onSelect: (row: TimetableOccurrence) => void
  onAdd: (date: string, time: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const firstDay = days[0]
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
  }, [firstDay, days.length])
  const timelineRef = useRef<HTMLDivElement>(null)
  const [availableHeight, setAvailableHeight] = useState<number | null>(null)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const today = localDate(now)
  const active = occurrences.filter((o) => o.status !== 'cancelled')
  const minutesOn = (value: string, date: string) =>
    (+new Date(value) - +new Date(atTime(date, '00:00'))) / 60000
  const crossesMidnight = active.some(
    (o) => localDate(new Date(o.starts_at)) !== localDate(new Date(o.ends_at)),
  )
  const firstHour = crossesMidnight
    ? 0
    : Math.max(
        0,
        Math.min(
          preferences.start_hour,
          ...active.map((o) =>
            Math.floor(minutesOn(o.starts_at, localDate(new Date(o.starts_at))) / 60),
          ),
        ),
      )
  const lastHour = Math.min(
    24,
    Math.max(
      preferences.end_hour,
      ...active.map((o) => Math.ceil(minutesOn(o.ends_at, localDate(new Date(o.starts_at))) / 60)),
    ),
  )
  useEffect(() => {
    const timeline = timelineRef.current
    if (!timeline) return
    const measure = () => {
      // Document coordinates keep the scale stable while the page scrolls.
      const top = timeline.getBoundingClientRect().top + window.scrollY
      setAvailableHeight(Math.max(0, window.innerHeight - top - 24))
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (timeline.parentElement?.parentElement)
      observer.observe(timeline.parentElement.parentElement)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  const hourHeight =
    availableHeight === null
      ? preferences.hour_height
      : Math.max(
          32,
          Math.min(preferences.hour_height, availableHeight / Math.max(1, lastHour - firstHour)),
        )
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i),
    height = (lastHour - firstHour) * hourHeight
  const twoWeeks = days.length > 7
  const grid = { gridTemplateColumns: `44px repeat(${days.length}, minmax(0, 1fr))` }

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={
        twoWeeks
          ? '两周课程时间轴，向右滚动查看下周。空白小时可添加课程。'
          : '课程时间轴。空白小时可添加课程。'
      }
      tabIndex={0}
      className="border-kid-line isolate overflow-x-auto border-t bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-8)]"
    >
      <div
        className="min-w-0"
        style={{ minWidth: 44 + days.length * 64, width: twoWeeks ? 'calc(200% - 44px)' : '100%' }}
      >
        <div className="border-kid-line grid border-b bg-white" style={grid}>
          <div className="sticky left-0 z-30 flex items-center justify-center bg-white text-[11px] font-medium text-slate-500">
            时间
          </div>
          {days.map((date, index) => (
            <div
              key={date}
              className={`border-kid-line min-w-0 border-l px-0.5 py-2 text-center ${today === date ? 'bg-[var(--accent-3)]' : 'bg-white'}`}
              aria-current={today === date ? 'date' : undefined}
            >
              <div
                className={
                  days.length === 1
                    ? 'flex items-center justify-center gap-3'
                    : 'flex flex-col items-center gap-1'
                }
              >
                <span
                  className={`text-xs font-medium ${today === date ? 'text-[var(--accent-11)]' : 'text-slate-500'}`}
                >
                  {twoWeeks && index >= days.length / 2 && '下'}
                  {weekdays[new Date(`${date}T12:00:00Z`).getUTCDay()]}
                  {today === date && <span className="sr-only"> · 今天</span>}
                </span>
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-lg font-semibold tabular-nums ${today === date ? 'bg-[var(--accent-9)] text-[var(--accent-contrast)]' : 'text-slate-700'}`}
                >
                  <span className="sr-only">{Number(date.slice(5, 7))}月</span>
                  {Number(date.slice(8))}
                  <span className="sr-only">日</span>
                </span>
              </div>
            </div>
          ))}
        </div>
        <div ref={timelineRef} className="grid" style={grid}>
          <div className="border-kid-line sticky left-0 z-30 border-r bg-white" style={{ height }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-kid-line relative border-t text-right text-[11px] text-slate-500 tabular-nums"
                style={{ height: hourHeight }}
              >
                <span className="inline-block bg-white pt-1 pr-1.5">
                  {preferences.hour12
                    ? `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`
                    : `${String(hour).padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>
          {days.map((date) => {
            const dayRows = active.filter(
              (o) =>
                +new Date(o.starts_at) < +new Date(atTime(dateAfter(date, 1), '00:00')) &&
                +new Date(o.ends_at) > +new Date(atTime(date, '00:00')),
            )
            return (
              <div
                key={date}
                className={`border-kid-line relative border-l ${date === today ? 'bg-[var(--accent-2)]' : 'bg-white'}`}
                style={{ height }}
              >
                {hours.map((hour) => (
                  // native-ok: 日历网格的整点空白单元格，绝对定位铺满整行，点击添加课程
                  <button
                    key={hour}
                    type="button"
                    aria-label={`${date} ${hour}:00 添加课程`}
                    onClick={() => onAdd(date, `${String(hour).padStart(2, '0')}:00`)}
                    className="group border-kid-line absolute inset-x-0 cursor-pointer scroll-mt-32 border-t text-left hover:bg-[var(--accent-3)] focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-8)] active:bg-[var(--accent-4)]"
                    style={{ top: (hour - firstHour) * hourHeight, height: hourHeight }}
                  >
                    <span className="border-kid-line pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed" />
                    <span
                      aria-hidden="true"
                      className="absolute top-1 right-2 text-sm text-[var(--accent-11)] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      ＋
                    </span>
                  </button>
                ))}
                {layoutOccurrences(dayRows).map(({ occurrence, column, columns }) => {
                  const course = courses.find((c) => c.id === occurrence.course_id),
                    color = courseColor(course)
                  const start = Math.max(firstHour * 60, minutesOn(occurrence.starts_at, date)),
                    end = Math.min(lastHour * 60, minutesOn(occurrence.ends_at, date))
                  const blockHeight = Math.max(20, ((end - start) / 60) * hourHeight - 4)
                  const startTime = clockTime(occurrence.starts_at, preferences.hour12)
                  const label = [
                    course?.name ?? '课程',
                    `${startTime}–${clockTime(occurrence.ends_at, preferences.hour12)}`,
                    preferences.show_location && course?.location,
                    preferences.show_teacher && course?.teacher,
                    columns > 1 && '时间重叠',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  const cardTop = (start / 60 - firstHour) * hourHeight + 2
                  const horizontalPadding = blockHeight < 48 ? 'px-1 sm:px-2' : 'px-1 sm:px-2.5'
                  const lane = {
                    left: `calc(${(column / columns) * 100}% + 3px)`,
                    width: `calc(${100 / columns}% - 6px)`,
                  }
                  return (
                    <Fragment key={occurrence.id}>
                      <time
                        dateTime={occurrence.starts_at}
                        style={{ ...lane, top: cardTop - 16, height: 12, lineHeight: '12px' }}
                        className={`pointer-events-none absolute z-20 truncate border-x border-transparent text-[10px] font-normal text-slate-500 tabular-nums ${horizontalPadding}`}
                      >
                        {startTime}
                      </time>
                      {/* native-ok: 日历网格中按时间绝对定位的课程块，底色来自课程自定义颜色，内容为多行块 */}
                      <button
                        type="button"
                        onClick={() => onSelect(occurrence)}
                        aria-label={label}
                        title={label}
                        className={`shadow-sticker-sm hover:shadow-sticker active:shadow-sticker-pressed absolute z-10 cursor-pointer scroll-mt-32 rounded-xl border-2 border-black/10 text-left transition-[transform,box-shadow] duration-150 hover:-translate-y-px focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-8)] active:translate-y-px motion-reduce:transition-none ${horizontalPadding} ${blockHeight < 48 ? 'py-px' : 'py-1.5'}`}
                        style={{
                          ...lane,
                          top: cardTop,
                          height: blockHeight,
                          backgroundColor: color.background,
                          color: color.text,
                        }}
                      >
                        <span className="flex h-full flex-col overflow-hidden">
                          <strong className="min-w-0 truncate text-[13px] leading-[14px]">
                            {course?.name ?? '课程'}
                          </strong>
                          {blockHeight >= 88 && preferences.show_location && course?.location && (
                            <span className="block truncate text-[11px] leading-4">
                              {course.location}
                            </span>
                          )}
                          {blockHeight >= 108 && preferences.show_teacher && course?.teacher && (
                            <span className="block truncate text-[11px] leading-4">
                              {course.teacher}
                            </span>
                          )}
                          {blockHeight >= 68 && columns > 1 && (
                            <span className="mt-auto block shrink-0 truncate text-[10px] leading-4 font-medium">
                              ⚠ 重叠
                            </span>
                          )}
                        </span>
                      </button>
                    </Fragment>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
