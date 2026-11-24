'use client'

import { IconButton } from '@rosie/ui/themes'
import type { TimetableCourse, TimetableOccurrence } from '../../types'
import { atTime, dateAfter, localDate } from '../../time'
import { weekdays } from '../shared'
import { clockTime, courseColor, statusLabel } from './presentation'

type Props = {
  month: string
  hour12: boolean
  from: string
  to: string
  courses: TimetableCourse[]
  occurrences: TimetableOccurrence[]
  onSelect: (row: TimetableOccurrence) => void
  onDay: (date: string) => void
  onAdd: (date: string) => void
}

export default function MonthCalendar({
  month,
  hour12,
  from,
  to,
  courses,
  occurrences,
  onSelect,
  onDay,
  onAdd,
}: Props) {
  const days: string[] = []
  for (let day = from; day <= to; day = dateAfter(day, 1)) days.push(day)
  const weeks = Array.from({ length: days.length / 7 }, (_, index) =>
    days.slice(index * 7, (index + 1) * 7),
  )
  const today = localDate()
  const coursesById = new Map(courses.map((course) => [course.id, course]))

  return (
    <table
      className="border-kid-line w-full table-fixed border-collapse border-t"
      aria-label={`${month.slice(0, 4)}年${Number(month.slice(5))}月课表`}
    >
      <thead className="border-kid-line border-b bg-slate-50">
        <tr>
          {days.slice(0, 7).map((day) => (
            <th
              key={day}
              scope="col"
              className="py-1.5 text-center text-xs font-semibold text-slate-600"
            >
              {weekdays[new Date(day + 'T12:00:00Z').getUTCDay()]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]} className="border-kid-line h-20 border-b last:border-b-0">
            {week.map((day) => {
              const start = +new Date(atTime(day, '00:00'))
              const end = +new Date(atTime(dateAfter(day, 1), '00:00'))
              const lessons = occurrences.filter(
                (row) => +new Date(row.starts_at) < end && +new Date(row.ends_at) > start,
              )
              const visibleLessons = lessons.slice(0, lessons.length > 3 ? 2 : 3)
              const hiddenCount = lessons.length - visibleLessons.length
              const inMonth = day.startsWith(month)
              const isToday = day === today

              return (
                <td
                  key={day}
                  className={`border-kid-line border-r p-0.5 align-top last:border-r-0 sm:px-1.5 ${isToday ? 'bg-[var(--accent-2)]' : inMonth ? 'bg-white' : 'bg-slate-50'}`}
                >
                  <div className="mb-0.5 flex min-h-6 items-center justify-between px-0.5">
                    <IconButton
                      size="1"
                      radius="full"
                      variant={isToday ? 'solid' : 'ghost'}
                      color={isToday ? undefined : 'gray'}
                      highContrast={inMonth}
                      onClick={() => onDay(day)}
                      aria-label={day + ' 查看日课表'}
                      aria-current={isToday ? 'date' : undefined}
                    >
                      <span className="flex size-4 items-center justify-center text-xs font-semibold tabular-nums">
                        {Number(day.slice(8))}
                      </span>
                    </IconButton>
                    <IconButton
                      size="1"
                      variant="ghost"
                      color="gray"
                      onClick={() => onAdd(day)}
                      aria-label={day + ' 添加课程'}
                    >
                      <span className="text-xs leading-none">+</span>
                    </IconButton>
                  </div>
                  <div className="flex min-w-0 flex-col gap-px">
                    {visibleLessons.map((row) => {
                      const course = coursesById.get(row.course_id)
                      const color = courseColor(course)
                      const name = course?.name ?? '课程'
                      const startTime = clockTime(row.starts_at, hour12)
                      const continues = localDate(new Date(row.starts_at)) < day
                      const label = `${name} · ${continues ? '跨日续课 · ' : ''}${startTime} · ${statusLabel[row.status]}`
                      return (
                        <button // native-ok: 按课程自定义配色的一行色块，铺满日历单元格
                          key={row.id}
                          type="button"
                          onClick={() => onSelect(row)}
                          aria-label={label}
                          title={label}
                          className={`flex w-full min-w-0 cursor-pointer items-center gap-1 rounded-sm px-0.5 text-left text-xs leading-4 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-8)] active:brightness-90 sm:px-1 ${row.status === 'cancelled' ? 'line-through' : ''}`}
                          style={{ backgroundColor: color.background, color: color.text }}
                        >
                          <time
                            dateTime={row.starts_at}
                            className="hidden shrink-0 tabular-nums lg:inline"
                          >
                            {continues ? '续' : startTime}
                          </time>
                          <span className="min-w-0 truncate">{name}</span>
                        </button>
                      )
                    })}
                    {hiddenCount > 0 && (
                      <IconButton
                        size="1"
                        variant="ghost"
                        color="gray"
                        mx="1"
                        my="1"
                        className="min-w-0 max-w-full self-start"
                        aria-label={`${day} 还有 ${hiddenCount} 节课程，查看日课表`}
                        onClick={() => onDay(day)}
                      >
                        <span className="truncate text-xs leading-none tabular-nums">
                          +{hiddenCount}
                        </span>
                      </IconButton>
                    )}
                  </div>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
