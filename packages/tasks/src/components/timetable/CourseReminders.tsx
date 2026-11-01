'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TimetableData } from '../../types'
import { previewOccurrences } from '../../timetable'
import { dateAfter, displayTime, localDate } from '../../time'

export default function CourseReminders({ data }: { data: TimetableData }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, 15_000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [])
  const today = localDate(new Date(now))
  const reminders = useMemo(() => {
    const courses = new Map(data.courses.filter(c => !c.archived_at && c.reminder_minutes != null).map(c => [c.id, c]))
    if (!courses.size) return []
    const rows = previewOccurrences(data, today, dateAfter(today, 7))
    return rows.flatMap(row => {
      const course = courses.get(row.course_id)
      if (row.status === 'cancelled' || course?.reminder_minutes == null) return []
      const start = Date.parse(row.starts_at)
      return [{ id: row.id, name: course.name, start: row.starts_at,
        from: start - course.reminder_minutes * 60_000, until: Math.min(start + 60_000, Date.parse(row.ends_at)) }]
    })
  }, [data, today])
  const due = reminders.filter(row => row.from <= now && now < row.until)
  return due.length ? <aside aria-label="课前提醒" role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
    <strong>课前提醒</strong>
    {due.map(row => <p key={row.id}>{displayTime(row.start)} · {row.name}</p>)}
  </aside> : null
}
