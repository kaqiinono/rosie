'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { todayStr } from '@rosie/core'
import { Button } from '@rosie/ui/themes'
import HomeworkJournal from '@/components/time-tree/HomeworkJournal'
import PlanCalendar from './PlanCalendar'
import TodayDashboard from './TodayDashboard'

function dateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日 ${days[d.getDay()]}`
}

/** Plan calendar page body: month grid on top, selected day's full dashboard below. */
export default function PlanCalendarDashboard() {
  return (
    <Suspense>
      <PlanCalendarDashboardBody />
    </Suspense>
  )
}

function PlanCalendarDashboardBody() {
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<string>(todayStr())
  const [homework, setHomework] = useState(() => searchParams.get('view') === 'homework')
  const isToday = selected === todayStr()

  return (
    <>
      <div className="mx-auto max-w-[640px] px-4">
        <div className="mb-3 flex gap-2">
          <Button variant={homework ? 'soft' : 'solid'} onClick={() => setHomework(false)}>
            学习计划
          </Button>
          <Button variant={homework ? 'solid' : 'soft'} onClick={() => setHomework(true)}>
            作业执行
          </Button>
        </div>
        {homework ? (
          <HomeworkJournal calendar />
        ) : (
          <>
            <PlanCalendar selectedDate={selected} onSelectDate={setSelected} />

            <div className="mt-6 mb-1 flex items-center justify-between">
              <div className="text-text-primary flex items-center gap-2 text-[15px] font-extrabold">
                <span>📋</span>
                <span>
                  {dateLabel(selected)}
                  {isToday ? '（今天）' : ''}
                </span>
              </div>
              {!isToday && (
                <Button
                  type="button"
                  onClick={() => setSelected(todayStr())}
                  variant="soft"
                  color="orange"
                  radius="full"
                  size="1"
                >
                  回到今天 ↑
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Same 640px column as TodayDashboard below so header/calendar/body
          share one aligned axis (previously the 960px dashboard looked skewed). */}
      {!homework && (
        <TodayDashboard date={selected} containerClassName="mx-auto max-w-[640px] px-4 pb-12" />
      )}
    </>
  )
}
