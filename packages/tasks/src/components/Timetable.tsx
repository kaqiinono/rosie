'use client'

import { useEffect, useRef, useState } from 'react'
import type { TaskCourse, TimetableOccurrence } from '../types'
import { SUBJECTS } from '../types'
import { dateAfter, localDate } from '../time'
import { DEFAULT_TIMETABLE_PREFERENCES, previewOccurrences, recurrenceLabel, timetableStats } from '../timetable'
import { Field, inputClass, buttonClass, minorClass, useTasks, weekdays } from './shared'
import CalendarGrid from './timetable/CalendarGrid'
import MonthCalendar from './timetable/MonthCalendar'
import CourseEditor from './timetable/CourseEditor'
import CourseDetails from './timetable/CourseDetails'
import CalendarSettings from './timetable/CalendarSettings'
import TimetableTools from './timetable/TimetableTools'
import ExamManager from './timetable/ExamManager'
import { clockTime, courseColor, statusLabel } from './timetable/presentation'

type View = 'day' | 'week' | 'month' | 'agenda' | 'courses'
type Editor = { course?: TaskCourse; duplicate?: boolean; date: string; time?: string }
const cardActionClass = 'flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40'

function CourseActionIcon({ action }: { action: 'view' | 'edit' | 'copy' | 'archive' | 'restore' }) {
  const paths = {
    view: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    edit: <><path d="m16 3 5 5M4 15l-1 6 6-1L21 8a2.8 2.8 0 0 0-5-5L4 15Z" /></>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    archive: <><rect x="3" y="3" width="18" height="5" rx="1" /><path d="M5 8v12h14V8M10 12h4" /></>,
    restore: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
  }
  return <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[action]}</svg>
}

export default function Timetable() {
  const { api } = useTasks()
  const preferences = { ...DEFAULT_TIMETABLE_PREFERENCES, ...api.data.preferences[0]?.settings }
  const [date, setDate] = useState(localDate), [view, setView] = useState<View>('day')
  const [calendar, setCalendar] = useState(''), [subject, setSubject] = useState(''), [query, setQuery] = useState(''), [courseFilter, setCourseFilter] = useState('')
  const [archived, setArchived] = useState(false), [showCancelled, setShowCancelled] = useState(true)
  const [editor, setEditor] = useState<Editor | null>(null), [selection, setSelection] = useState<{ course: TaskCourse; occurrence?: TimetableOccurrence; initialAction?: 'detail' | 'archive' } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search), requested = params.get('date')
    if (requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && Number.isFinite(Date.parse(requested))) setDate(requested)
    setCourseFilter(params.get('course') ?? '')
    if (window.matchMedia('(min-width: 768px)').matches) setView('week')
  }, [])
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(), week = dateAfter(date, -((weekday - preferences.week_start + 7) % 7))
  const monthStart = date.slice(0, 7) + '-01'
  const monthEnd = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10)
  const monthFrom = dateAfter(monthStart, -((new Date(monthStart + 'T12:00:00Z').getUTCDay() - preferences.week_start + 7) % 7))
  const monthTo = dateAfter(monthEnd, (preferences.week_start + 6 - new Date(monthEnd + 'T12:00:00Z').getUTCDay() + 7) % 7)
  const from = view === 'month' ? monthFrom : view === 'day' ? date : week
  const to = view === 'month' ? monthTo : view === 'day' ? date : dateAfter(week, view === 'agenda' ? 27 : view === 'week' ? 13 : 6)
  const courses = api.data.courses.filter(course => !!course.archived_at === archived && (!calendar || course.calendar_id === calendar) && (!subject || course.subject === subject) && (!courseFilter || course.id === courseFilter) && `${course.name} ${course.teacher ?? ''} ${course.location ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const courseIds = new Set(courses.map(course => course.id)), allRows = previewOccurrences(api.data, from, to).filter(row => courseIds.has(row.course_id))
  const rows = allRows.filter(row => showCancelled || row.status !== 'cancelled'), stats = timetableStats(view === 'month' ? allRows.filter(row => localDate(new Date(row.starts_at)).startsWith(date.slice(0, 7))) : allRows)
  const days = view === 'day' ? [date] : Array.from({ length: view === 'week' ? 14 : 7 }, (_, i) => dateAfter(week, i)).filter(day => preferences.show_weekends || ![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()))
  const exams = api.data.exams.filter(exam => (!calendar || exam.calendar_id === calendar) && (!courseFilter || exam.course_id === courseFilter))
  const choose = (occurrence: TimetableOccurrence) => { const course = api.data.courses.find(c => c.id === occurrence.course_id); if (course) setSelection({ course, occurrence }) }
  const step = view === 'day' ? 1 : view === 'agenda' ? 28 : 7
  const navigate = (direction: number) => {
    if (view === 'month') {
      const target = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1 + direction, 1))
      setDate(target.toISOString().slice(0, 10))
    } else setDate(dateAfter(date, direction * step))
  }
  const today = localDate()
  const weekDays = Array.from({ length: 7 }, (_, i) => dateAfter(week, i))
  const filterCount = [calendar, subject, courseFilter, archived, !showCancelled].filter(Boolean).length
  const shortDate = (value: string) => `${Number(value.slice(5, 7))}月${Number(value.slice(8))}日`
  const rangeTitle = view === 'courses' ? (archived ? '已归档课程' : '全部课程')
    : view === 'month' ? `${Number(date.slice(5, 7))}月`
      : view === 'day' ? `${shortDate(date)} · ${weekdays[weekday]}`
        : `${shortDate(from)} — ${from.slice(0, 4) !== to.slice(0, 4) ? to.slice(0, 4) + '年' : ''}${shortDate(to)}`
  const agendaDays = Array.from(new Set(rows.map(row => localDate(new Date(row.starts_at)))))
  const resetFilters = () => { setCalendar(''); setSubject(''); setCourseFilter(''); setArchived(false); setShowCancelled(true) }

  return <div className="space-y-5">
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="课表">
      <header className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <div className="min-w-0 border-l-[3px] border-emerald-800 pl-3 sm:pl-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{rangeTitle}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-slate-500">
            <span>{view === 'courses' ? '课程资料' : `${(view === 'month' ? date : from).slice(0, 4)} 年`} · {api.data.calendars.find(item => item.id === calendar)?.name || '全部课表'}</span>
            <span aria-hidden="true" className="text-slate-300">/</span>
            {view === 'courses' ? <span>{courses.length} 门课程{archived && ' · 已归档'}</span> : <><span><strong className="font-semibold text-slate-700">{stats.courses}</strong> 门课</span><span><strong className="font-semibold text-slate-700">{stats.occurrences}</strong> 课次</span><span><strong className="font-semibold text-slate-700">{Math.round(stats.minutes / 6) / 10}</strong> 小时</span></>}
            {view !== 'courses' && stats.conflicts > 0 && <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-800">⚠ {stats.conflicts} 课次时间重叠</span>}
          </p>
        </div>
        <button type="button" onClick={() => setEditor({ date })} className={`${buttonClass} min-h-11 shrink-0`}><span aria-hidden="true" className="mr-1 text-lg leading-none">＋</span>新建课程</button>
      </header>

      <div className="space-y-2 border-t border-slate-100 px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {view !== 'courses' && <>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5">
                <button type="button" aria-label="上一时段" onClick={() => navigate(-1)} className="flex h-10 w-8 cursor-pointer items-center justify-center rounded-lg text-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-700">‹</button>
                <button type="button" onClick={() => setDate(today)} className="min-h-10 cursor-pointer rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-700">今天</button>
                <button type="button" aria-label="下一时段" onClick={() => navigate(1)} className="flex h-10 w-8 cursor-pointer items-center justify-center rounded-lg text-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-700">›</button>
              </div>
              <label className="w-[136px] min-w-0"><span className="sr-only">跳转日期</span><input type="date" value={date} onChange={e => { if (e.target.value) setDate(e.target.value) }} className={`${inputClass} min-h-11 tabular-nums`} /></label>
            </>}
          </div>
          <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-slate-100 p-1" role="group" aria-label="课表视图">
            {([['day', '日'], ['week', '周'], ['month', '月'], ['agenda', '日程'], ['courses', '课程']] as const).map(([value, label]) => <button type="button" key={value} aria-label={`${label}视图`} aria-pressed={view === value} onClick={() => setView(value)} className={`min-h-10 shrink-0 cursor-pointer rounded-lg px-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700 ${view === value ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 active:bg-white'}`}>{label}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <label className="block"><span className="sr-only">搜索课程、教师或地点</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input ref={searchRef} type="search" value={query} onChange={e => setQuery(e.target.value)} className={`${inputClass} min-h-11 pl-9 pr-11`} placeholder="搜索课程、教师或地点" /></label>
            {query && <button type="button" aria-label="清空搜索" onClick={() => { setQuery(''); searchRef.current?.focus() }} className="absolute right-1 top-1 flex size-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-700">×</button>}
          </div>
          <button type="button" aria-expanded={showFilters} aria-controls="timetable-filters" onClick={() => setShowFilters(value => !value)} className={`${minorClass} flex min-h-11 shrink-0 items-center gap-2`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4"><path d="M4 7h16M7 12h10M10 17h4" /></svg>筛选{filterCount > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-emerald-800 text-[11px] text-white">{filterCount}</span>}<span aria-hidden="true" className="text-slate-400">{showFilters ? '−' : '+'}</span>
          </button>
          <button type="button" aria-expanded={showTools} aria-controls="timetable-tools" onClick={() => setShowTools(value => !value)} className={`${minorClass} flex min-h-11 shrink-0 items-center gap-1.5`}><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-4"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>更多</button>
        </div>
        <div id="timetable-tools" hidden={!showTools}>
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2"><CalendarSettings calendarId={calendar} onCalendarChange={setCalendar} /><TimetableTools calendarId={calendar} onCalendarChange={setCalendar} /></div>
        </div>
        <div id="timetable-filters" hidden={!showFilters}>
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
              <Field label="课表 / 学期"><select value={calendar} onChange={e => setCalendar(e.target.value)} className={inputClass}><option value="">全部课表</option>{api.data.calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="科目"><select value={subject} onChange={e => setSubject(e.target.value)} className={inputClass}><option value="">全部科目</option>{Object.entries(SUBJECTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
              <label className="flex min-h-10 cursor-pointer items-center gap-2"><input type="checkbox" checked={archived} onChange={e => { setArchived(e.target.checked); if (e.target.checked) setView('courses') }} className="size-4 accent-emerald-800" />已归档课程</label>
              <label className="flex min-h-10 cursor-pointer items-center gap-2"><input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} className="size-4 accent-emerald-800" />显示停课记录</label>
              {filterCount > 0 && <button type="button" onClick={resetFilters} className="min-h-10 cursor-pointer rounded-lg px-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700 sm:ml-auto">重置筛选</button>}
            </div>
          </div>
        </div>
        {filterCount > 0 && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600" aria-label="当前筛选">
          {calendar && <span className="rounded-md bg-slate-100 px-2 py-1">课表：{api.data.calendars.find(item => item.id === calendar)?.name || '指定课表'}</span>}
          {subject && <span className="rounded-md bg-slate-100 px-2 py-1">科目：{Object.entries(SUBJECTS).find(([key]) => key === subject)?.[1]}</span>}
          {archived && <span className="rounded-md bg-slate-100 px-2 py-1">已归档</span>}
          {!showCancelled && <span className="rounded-md bg-slate-100 px-2 py-1">隐藏停课</span>}
          {courseFilter && <button type="button" onClick={() => setCourseFilter('')} aria-label="清除指定课程筛选" className="cursor-pointer rounded-md bg-emerald-50 px-2 py-2 text-emerald-800 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700">{api.data.courses.find(course => course.id === courseFilter)?.name || '指定课程'}<span aria-hidden="true" className="ml-2">×</span></button>}
        </div>}
      </div>

      {view === 'day' && <div className="grid grid-cols-7 gap-1 border-t border-slate-100 px-3 py-3 md:hidden" role="group" aria-label="选择本周日期">
        {weekDays.map(day => <button type="button" key={day} onClick={() => setDate(day)} aria-label={`${day}${day === today ? ' 今天' : ''}`} aria-pressed={day === date} className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 ${day === date ? 'bg-emerald-800 text-white' : day === today ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100' : 'text-slate-500 hover:bg-slate-100'}`}><span className="text-[11px]">{day === today ? '今天' : weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()]}</span><span className="text-lg font-semibold tabular-nums">{Number(day.slice(8))}</span></button>)}
      </div>}

      {view === 'day' || view === 'week' ? <>
        <CalendarGrid days={days} occurrences={rows} courses={api.data.courses} exams={exams} preferences={preferences} onSelect={choose} onAdd={(day, time) => setEditor({ date: day, time })} />
        {!allRows.length && <div className="border-t border-slate-100 px-4 py-6 text-center"><p className="text-sm font-semibold text-slate-700">这段时间没有匹配课程</p><p className="mt-1 text-xs text-slate-500">调整筛选，或添加一门课程开始安排。</p><button type="button" onClick={() => setEditor({ date })} className={`${minorClass} mt-3`}>新建课程</button></div>}
        {showCancelled && rows.some(row => row.status === 'cancelled') && <div className="border-t border-slate-100 bg-slate-50/60 p-4"><h3 className="mb-2 text-xs font-semibold text-slate-500">停课记录</h3><div className="flex flex-wrap gap-2">{rows.filter(row => row.status === 'cancelled').map(row => <button type="button" key={row.id} className={minorClass} onClick={() => choose(row)}>{courses.find(c => c.id === row.course_id)?.name} · {localDate(new Date(row.starts_at))} {clockTime(row.starts_at, preferences.hour12)}</button>)}</div></div>}
      </> : view === 'month' ? <MonthCalendar month={date.slice(0, 7)} from={monthFrom} to={monthTo} courses={api.data.courses} occurrences={rows} exams={exams} onSelect={choose} onDay={day => { setDate(day); setView('day') }} onAdd={day => setEditor({ date: day })} /> : view === 'agenda' ? <div className="border-t border-slate-200">
        {agendaDays.map(day => <section key={day} aria-label={`${shortDate(day)}日程`} className="border-b border-slate-100 last:border-b-0">
          <h3 className="flex items-center gap-2 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-600 sm:px-6"><span className={day === today ? 'text-emerald-800' : ''}>{shortDate(day)}</span><span className="font-normal text-slate-500">{weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()]}</span>{day === today && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-800">今天</span>}</h3>
          <div className="divide-y divide-slate-100">{rows.filter(row => localDate(new Date(row.starts_at)) === day).map(row => {
            const course = courses.find(c => c.id === row.course_id), color = courseColor(course)
            return <button type="button" key={row.id} onClick={() => choose(row)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-4 text-left hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700 sm:gap-5 sm:px-6">
              <span className="w-20 shrink-0 tabular-nums"><span className="block text-sm font-semibold text-slate-800">{clockTime(row.starts_at, preferences.hour12)}</span><span className="mt-1 block text-xs text-slate-500">{clockTime(row.ends_at, preferences.hour12)}</span></span>
              <span className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: color.border }} />
              <span className="min-w-0 flex-1"><strong className={`block truncate text-sm text-slate-800 ${row.status === 'cancelled' ? 'line-through' : ''}`}>{course?.name}</strong><span className="mt-1 block truncate text-xs text-slate-500">{[preferences.show_location && course?.location, preferences.show_teacher && course?.teacher].filter(Boolean).join(' · ')}</span></span>
              <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${row.status === 'confirmed' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{statusLabel[row.status]}</span><span aria-hidden="true" className="hidden text-slate-400 sm:block">›</span>
            </button>
          })}</div>
        </section>)}
        {!rows.length && <div className="px-4 py-12 text-center"><p className="text-sm font-semibold text-slate-700">未来四周没有匹配课程</p><p className="mt-2 text-xs text-slate-500">试试调整日期或筛选条件。</p></div>}
      </div> : <div className="grid gap-4 border-t border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
        {courses.map(course => {
          const color = courseColor(course)
          return <article key={course.id} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-sm motion-reduce:transition-none">
            <button type="button" onClick={() => setSelection({ course })} className="flex w-full min-w-0 flex-1 cursor-pointer flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700">
            <div className="min-h-28 w-full shrink-0 px-5 py-4 text-slate-800" style={{ backgroundColor: color.background }}><div className="mb-3 flex min-h-6 items-center justify-between gap-2 text-xs"><span className="rounded-md bg-white/65 px-2 py-1 font-medium text-slate-600">{SUBJECTS[course.subject]}</span>{course.archived_at && <span className="rounded-md bg-white/65 px-2 py-1 text-slate-600">已归档</span>}</div><strong className="block truncate text-base font-semibold">{course.name}</strong></div>
            <div className="flex w-full flex-1 flex-col gap-4 p-5"><p className="truncate text-xs text-slate-500">{[course.teacher, course.location].filter(Boolean).join(' · ') || '教师与地点未填写'}</p><div className="space-y-2">{api.data.rules.filter(r => r.course_id === course.id && (!r.disabled_from || r.disabled_from > today) && (!r.valid_until || r.valid_until >= today)).map(rule => <p key={rule.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs"><span className="font-medium tabular-nums text-slate-700">{weekdays[rule.weekday]} {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}</span><span className="text-slate-500">{recurrenceLabel(rule)}</span></p>)}</div></div>
            </button>
            <footer aria-label={`${course.name}操作`} className="grid grid-cols-4 gap-1 border-t border-slate-100 p-2">
              <button type="button" aria-label={`查看${course.name}`} onClick={() => setSelection({ course })} className={`${cardActionClass} text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100`}><CourseActionIcon action="view" />查看</button>
              <button type="button" aria-label={`编辑${course.name}`} disabled={!!course.archived_at} title={course.archived_at ? '恢复课程后可编辑' : undefined} onClick={() => setEditor({ course, date })} className={`${cardActionClass} text-slate-600 enabled:hover:bg-slate-100 enabled:active:bg-slate-200`}><CourseActionIcon action="edit" />编辑</button>
              <button type="button" aria-label={`复制${course.name}`} onClick={() => setEditor({ course, duplicate: true, date })} className={`${cardActionClass} text-slate-600 hover:bg-slate-100 active:bg-slate-200`}><CourseActionIcon action="copy" />复制</button>
              <button type="button" aria-label={`${course.archived_at ? '查看并恢复' : '归档'}${course.name}`} onClick={() => setSelection({ course, initialAction: course.archived_at ? 'detail' : 'archive' })} className={`${cardActionClass} text-slate-500 hover:bg-amber-50 hover:text-amber-800 active:bg-amber-100`}><CourseActionIcon action={course.archived_at ? 'restore' : 'archive'} />{course.archived_at ? '恢复' : '归档'}</button>
            </footer>
          </article>
        })}
        {!courses.length && <div className="col-span-full px-4 py-10 text-center"><p className="text-sm font-semibold text-slate-700">没有匹配课程</p><p className="mt-2 text-xs text-slate-500">调整筛选，或新建第一门课程。</p><button type="button" onClick={() => setEditor({ date })} className={`${minorClass} mt-4`}>新建课程</button></div>}
      </div>}
      {view !== 'courses' && view !== 'agenda' && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500 sm:px-6"><span>{view === 'month' ? '点击日期查看当天 · 点击 ＋ 添加课程' : view === 'week' ? '向右滑动查看下周 · 点击课程查看详情 · 点击空白时段添加课程' : '点击课程查看详情 · 点击空白时段添加课程'}</span><span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-700" />{view === 'week' ? '周课表' : view === 'day' ? '日课表' : '月课表'}</span></footer>}
    </section>
    <ExamManager calendarId={calendar} courseId={courseFilter || undefined} />
    {editor && <CourseEditor {...editor} calendarId={calendar || undefined} onClose={() => setEditor(null)} />}
    {selection && <CourseDetails key={selection.occurrence?.id ?? selection.course.id} {...selection} onSelectOccurrence={choose} onClose={() => setSelection(null)} onEdit={duplicate => { setEditor({ course: selection.course, duplicate, date: selection.occurrence?.original_date ?? date }); setSelection(null) }} />}
  </div>
}
