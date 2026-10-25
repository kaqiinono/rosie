'use client'

import { useEffect, useRef, useState } from 'react'
import type { TaskCourse, TaskExam, TimetableOccurrence, TimetablePreferences } from '../../types'
import { atTime, dateAfter, localDate } from '../../time'
import { layoutOccurrences } from '../../timetable'
import { weekdays } from '../shared'
import { clockTime, courseColor, statusLabel } from './presentation'

export default function CalendarGrid({ days, occurrences, courses, exams, preferences, onSelect, onAdd }: { days: string[]; occurrences: TimetableOccurrence[]; courses: TaskCourse[]; exams: TaskExam[]; preferences: TimetablePreferences; onSelect: (row: TimetableOccurrence) => void; onAdd: (date: string, time: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const firstDay = days[0]
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
  }, [firstDay, days.length])
  const timelineRef = useRef<HTMLDivElement>(null)
  const [availableHeight, setAvailableHeight] = useState<number | null>(null)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer) }, [])
  const today = localDate(now)
  const active = occurrences.filter(o => o.status !== 'cancelled')
  const minutesOn = (value: string, date: string) => (+new Date(value) - +new Date(atTime(date, '00:00'))) / 60000
  const crossesMidnight = active.some(o => localDate(new Date(o.starts_at)) !== localDate(new Date(o.ends_at)))
  const firstHour = crossesMidnight ? 0 : Math.max(0, Math.min(preferences.start_hour, ...active.map(o => Math.floor(minutesOn(o.starts_at, localDate(new Date(o.starts_at))) / 60))))
  const lastHour = Math.min(24, Math.max(preferences.end_hour, ...active.map(o => Math.ceil(minutesOn(o.ends_at, localDate(new Date(o.starts_at))) / 60))))
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
    if (timeline.parentElement?.parentElement) observer.observe(timeline.parentElement.parentElement)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  const hourHeight = availableHeight === null ? preferences.hour_height : Math.max(32, Math.min(preferences.hour_height, availableHeight / Math.max(1, lastHour - firstHour)))
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i), height = (lastHour - firstHour) * hourHeight
  const twoWeeks = days.length > 7
  const grid = { gridTemplateColumns: `44px repeat(${days.length}, minmax(0, 1fr))` }

  return <div ref={scrollRef} role="region" aria-label={twoWeeks ? "两周课程时间轴，向右滚动查看下周。空白小时可添加课程。" : "课程时间轴。空白小时可添加课程。"} tabIndex={0} className="isolate overflow-x-auto border-t border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700">
    <div className="min-w-0" style={{ minWidth: 44 + days.length * 64, width: twoWeeks ? 'calc(200% - 44px)' : '100%' }}>
      <div className="grid border-b border-slate-200 bg-white" style={grid}>
        <div className="sticky left-0 z-30 flex items-center justify-center bg-white text-[11px] font-medium text-slate-500">时间</div>
        {days.map((date, index) => <div key={date} className={`border-l border-slate-100 min-w-0 px-0.5 py-2 text-center ${today === date ? 'bg-emerald-50/80' : 'bg-white'}`} aria-current={today === date ? 'date' : undefined}>
          <div className={days.length === 1 ? 'flex items-center justify-center gap-3' : 'flex flex-col items-center gap-1'}>
            <span className={`text-xs font-medium ${today === date ? 'text-emerald-800' : 'text-slate-500'}`}>{twoWeeks && index >= days.length / 2 && '下'}{weekdays[new Date(`${date}T12:00:00Z`).getUTCDay()]}{today === date && <span className="sr-only"> · 今天</span>}</span>
            <span className={`flex size-8 items-center justify-center rounded-full text-lg font-semibold tabular-nums ${today === date ? 'bg-emerald-800 text-white' : 'text-slate-700'}`}><span className="sr-only">{Number(date.slice(5, 7))}月</span>{Number(date.slice(8))}<span className="sr-only">日</span></span>
          </div>
          {exams.filter(exam => localDate(new Date(exam.starts_at)) === date).map(exam => <p key={exam.id} title={`${exam.title} ${clockTime(exam.starts_at)}`} className="mt-2 truncate rounded-md bg-amber-50 px-1.5 py-1 text-[11px] font-medium text-amber-800">考试 · {exam.title}</p>)}
        </div>)}
      </div>
      <div ref={timelineRef} className="grid" style={grid}>
        <div className="sticky left-0 z-30 border-r border-slate-200 bg-white" style={{ height }}>{hours.map(hour => <div key={hour} className="relative border-t border-slate-100 text-right text-[11px] tabular-nums text-slate-500" style={{ height: hourHeight }}><span className="inline-block bg-white pr-1.5 pt-1">{preferences.hour12 ? `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}` : `${String(hour).padStart(2, '0')}:00`}</span></div>)}</div>
        {days.map(date => {
          const dayRows = active.filter(o => +new Date(o.starts_at) < +new Date(atTime(dateAfter(date, 1), '00:00')) && +new Date(o.ends_at) > +new Date(atTime(date, '00:00')))
          const nowMinute = minutesOn(now.toISOString(), date)
          return <div key={date} className={`relative border-l border-slate-100 ${date === today ? 'bg-emerald-50/30' : 'bg-white'}`} style={{ height }}>
            {hours.map(hour => <button key={hour} type="button" aria-label={`${date} ${hour}:00 添加课程`} onClick={() => onAdd(date, `${String(hour).padStart(2, '0')}:00`)} className="group absolute inset-x-0 scroll-mt-32 cursor-pointer border-t border-slate-100 text-left hover:bg-emerald-50/80 active:bg-emerald-100/70 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600" style={{ top: (hour - firstHour) * hourHeight, height: hourHeight }}><span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100/80" /><span aria-hidden="true" className="absolute right-2 top-1 text-sm text-emerald-700 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">＋</span></button>)}
            {layoutOccurrences(dayRows).map(({ occurrence, column, columns }) => {
              const course = courses.find(c => c.id === occurrence.course_id), color = courseColor(course)
              const start = Math.max(firstHour * 60, minutesOn(occurrence.starts_at, date)), end = Math.min(lastHour * 60, minutesOn(occurrence.ends_at, date))
              const blockHeight = Math.max(20, (end - start) / 60 * hourHeight - 4)
              const label = [course?.name ?? '课程', `${clockTime(occurrence.starts_at, preferences.hour12)}–${clockTime(occurrence.ends_at, preferences.hour12)}`, preferences.show_location && course?.location, preferences.show_teacher && course?.teacher, statusLabel[occurrence.status], columns > 1 && '时间重叠'].filter(Boolean).join(' · ')
              return <button key={occurrence.id} type="button" onClick={() => onSelect(occurrence)} aria-label={label} title={label} className={`absolute z-10 scroll-mt-32 cursor-pointer overflow-hidden rounded-lg border border-black/5 text-left shadow-sm transition-[filter,box-shadow] hover:brightness-95 hover:shadow-md active:brightness-90 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-900 motion-reduce:transition-none ${blockHeight < 48 ? 'px-1 py-px sm:px-2' : 'px-1 py-1.5 sm:px-2.5'}`} style={{ top: (start / 60 - firstHour) * hourHeight + 2, height: blockHeight, left: `calc(${column / columns * 100}% + 3px)`, width: `calc(${100 / columns}% - 6px)`, backgroundColor: color.background, color: color.text }}>
                <span className="flex h-full flex-col gap-0.5 overflow-hidden">
                  <strong className="block shrink-0 truncate text-[13px] leading-4">{course?.name ?? '课程'}</strong>
                  {blockHeight >= 88 && preferences.show_location && course?.location && <span className="block truncate text-[11px] leading-4">{course.location}</span>}
                  {blockHeight >= 108 && preferences.show_teacher && course?.teacher && <span className="block truncate text-[11px] leading-4">{course.teacher}</span>}
                  {blockHeight >= 68 && <span className="mt-auto block shrink-0 truncate text-[10px] font-medium leading-4">{statusLabel[occurrence.status]}{columns > 1 && ' · ⚠ 重叠'}</span>}
                </span>
              </button>
            })}
            {today === date && nowMinute >= firstHour * 60 && nowMinute <= lastHour * 60 && <div aria-label={`当前时间 ${clockTime(now.toISOString(), preferences.hour12)}`} className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-rose-500" style={{ top: (nowMinute / 60 - firstHour) * hourHeight }}><span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-rose-500 ring-2 ring-white" /></div>}
          </div>
        })}
      </div>
    </div>
  </div>
}
