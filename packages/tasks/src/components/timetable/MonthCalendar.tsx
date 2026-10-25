'use client'

import type { TaskCourse, TaskExam, TimetableOccurrence } from '../../types'
import { atTime, dateAfter, localDate } from '../../time'
import { weekdays } from '../shared'
import { clockTime, courseColor, statusLabel } from './presentation'

type Props = { month: string; from: string; to: string; courses: TaskCourse[]; occurrences: TimetableOccurrence[]; exams: TaskExam[]; onSelect: (row: TimetableOccurrence) => void; onDay: (date: string) => void; onAdd: (date: string) => void }

export default function MonthCalendar({ month, from, to, courses, occurrences, exams, onSelect, onDay, onAdd }: Props) {
  const days: string[] = []
  for (let day = from; day <= to; day = dateAfter(day, 1)) days.push(day)
  const today = localDate()

  return <div className="overflow-x-auto border-t border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700" tabIndex={0} role="region" aria-label="月课表，可横向滚动">
    <div className="min-w-[700px]">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70">{days.slice(0, 7).map(day => <div key={day} className="py-3 text-center text-xs font-medium text-slate-500">{weekdays[new Date(day + 'T12:00:00Z').getUTCDay()]}</div>)}</div>
      <div className="grid grid-cols-7">{days.map(day => {
        const start = +new Date(atTime(day, '00:00')), end = +new Date(atTime(dateAfter(day, 1), '00:00'))
        const lessons = occurrences.filter(row => +new Date(row.starts_at) < end && +new Date(row.ends_at) > start)
        const dayExams = exams.filter(exam => +new Date(exam.starts_at) < end && +new Date(exam.ends_at) > start)
        const inMonth = day.startsWith(month)
        return <section key={day} aria-label={day} className={`min-h-44 border-b border-r border-slate-100 p-2 ${day === today ? 'bg-emerald-50/30' : inMonth ? 'bg-white' : 'bg-slate-50/80'}`}>
          <div className="mb-2 flex items-center justify-between gap-1">
            <button type="button" onClick={() => onDay(day)} aria-label={day + ' 查看日课表'} aria-current={day === today ? 'date' : undefined} className={`flex size-10 cursor-pointer items-center justify-center rounded-full text-sm font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 ${day === today ? 'bg-emerald-800 text-white hover:bg-emerald-900' : inMonth ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-500 hover:bg-slate-200'}`}>{Number(day.slice(8))}</button>
            <button type="button" onClick={() => onAdd(day)} aria-label={day + ' 添加课程'} className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-800 active:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700">＋</button>
          </div>
          <div className="space-y-1.5">{lessons.slice(0, 3).map(row => {
            const course = courses.find(item => item.id === row.course_id), color = courseColor(course)
            const label = `${course?.name ?? '课程'} · ${clockTime(row.starts_at)} · ${statusLabel[row.status]}`
            return <button key={row.id} type="button" onClick={() => onSelect(row)} aria-label={label} title={label} className={`block w-full cursor-pointer truncate rounded-md px-2 py-2 text-left text-xs font-medium hover:brightness-95 active:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 ${row.status === 'cancelled' ? 'line-through' : ''}`} style={{ backgroundColor: color.background, color: color.text }}><span className="mr-1.5 text-[11px] tabular-nums">{localDate(new Date(row.starts_at)) < day ? '续' : clockTime(row.starts_at)}</span>{course?.name ?? '课程'}{row.status === 'cancelled' && ' · 停课'}</button>
          })}
            {lessons.length > 3 && <button type="button" onClick={() => onDay(day)} className="min-h-9 w-full cursor-pointer rounded-md px-2 py-1 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700">还有 {lessons.length - 3} 节课 →</button>}
            {dayExams.map(exam => <p key={exam.id} title={exam.title + ' · ' + clockTime(exam.starts_at)} className="truncate rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-800">考试 · {exam.title}</p>)}
          </div>
        </section>
      })}</div>
    </div>
  </div>
}
