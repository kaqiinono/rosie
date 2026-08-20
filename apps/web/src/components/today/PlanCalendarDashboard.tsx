'use client'

import { useState } from 'react'
import { todayStr } from '@rosie/core'
import PlanCalendar from './PlanCalendar'
import TodayDashboard from './TodayDashboard'

function dateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日 ${days[d.getDay()]}`
}

/** Plan calendar page body: month grid on top, selected day's full dashboard below. */
export default function PlanCalendarDashboard() {
  const [selected, setSelected] = useState<string>(todayStr())
  const isToday = selected === todayStr()

  return (
    <>
      <div className="mx-auto max-w-[640px] px-4">
        <PlanCalendar selectedDate={selected} onSelectDate={setSelected} />

        <div className="mb-1 mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-extrabold text-text-primary">
            <span>📋</span>
            <span>
              {dateLabel(selected)}
              {isToday ? '（今天）' : ''}
            </span>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelected(todayStr())}
              className="cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold text-orange-700 transition-opacity hover:opacity-70"
              style={{ background: 'rgba(251,146,60,.1)', border: '1.5px solid rgba(251,146,60,.25)' }}
            >
              回到今天 ↑
            </button>
          )}
        </div>
      </div>

      <TodayDashboard date={selected} />
    </>
  )
}
