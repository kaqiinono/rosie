'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { dateAfter, localDate } from '../time'
import { nextPreviewOccurrence, previewOccurrences } from '../timetable'
import { useTasks } from './shared'

const timeLabel = (value: string) => new Date(value).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false })

export default function TodayCourseSummary() {
  const { api } = useTasks()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setNow(Date.now()) }, 60000)
    return () => window.clearInterval(timer)
  }, [])
  const today = localDate(new Date(now))
  const upcoming = useMemo(() => previewOccurrences(api.data, today, dateAfter(today, 35)).filter(o => o.status !== 'cancelled'), [api.data, today])
  const todays = upcoming.filter(o => localDate(new Date(o.starts_at)) === today)
  const next = upcoming.find(o => +new Date(o.ends_at) > now) ?? nextPreviewOccurrence(api.data, new Date(now))
  const nextCourse = next && api.data.courses.find(c => c.id === next.course_id)
  const exams = api.data.exams.filter(e => +new Date(e.ends_at) >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 3)
  return <section aria-label="今日课程概览" className="overflow-hidden rounded-2xl border border-emerald-900/15 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-950 px-5 py-4 text-white">
      <div><p className="text-xs tracking-widest text-emerald-200">{today.replaceAll('-', ' / ')}</p><h2 className="mt-1 text-lg font-bold">今天的课 · {todays.length} 次</h2></div>
      <Link href={`/tasks/timetable?date=${today}`} className="rounded-lg border border-white/30 px-3 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">打开课表 →</Link>
    </div>
    <div className="space-y-4 p-5">
      <p className="text-sm text-slate-600">{next ? <><span className="font-semibold text-emerald-900">{+new Date(next.starts_at) <= now ? '正在上课' : '接下来'}</span> · {nextCourse?.name ?? '课程'} · {localDate(new Date(next.starts_at)) === today ? '' : `${localDate(new Date(next.starts_at))} `}{timeLabel(next.starts_at)}—{timeLabel(next.ends_at)}{nextCourse?.location ? ` · ${nextCourse.location}` : ''}</> : '还没有待上的课程，可以打开课表添加安排。'}</p>
      {todays.length > 0 && <ul className="grid gap-2 sm:grid-cols-2">{todays.map(o => {
        const course = api.data.courses.find(c => c.id === o.course_id)
        return <li key={o.id}><Link href={`/tasks/timetable?date=${today}&course=${encodeURIComponent(o.course_id)}`} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-emerald-400 focus-visible:outline-2 focus-visible:outline-emerald-700"><span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(course?.color ?? '') ? course?.color : '#047857' }} /><div className="min-w-0"><p className="truncate text-sm font-semibold">{course?.name ?? '课程'}</p><p className="mt-1 text-xs tabular-nums text-slate-500">{timeLabel(o.starts_at)}—{timeLabel(o.ends_at)} · {o.status === 'confirmed' ? '已确认' : +new Date(o.ends_at) <= now ? '待确认' : '待上课'}</p></div></Link></li>
      })}</ul>}
      {exams.length > 0 && <div className="border-t border-slate-100 pt-3"><h3 className="text-sm font-semibold text-slate-700">近期考试</h3><ul className="mt-2 space-y-2">{exams.map(exam => <li key={exam.id}><Link href={`/tasks/timetable?date=${localDate(new Date(exam.starts_at))}`} className="text-sm text-amber-800 hover:underline">{exam.title} · {localDate(new Date(exam.starts_at))} {timeLabel(exam.starts_at)} · {Math.max(0, Math.ceil((+new Date(exam.starts_at) - now) / 86400000))} 天内</Link></li>)}</ul></div>}
      <p className="text-xs text-slate-500">提醒仅在任务管理内展示，不发送系统通知。</p>
    </div>
  </section>
}
