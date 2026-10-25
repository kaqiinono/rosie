'use client'

import { useEffect, useRef } from 'react'
import TimetableDialog from './TimetableDialog'
import { courseButtonClass, courseFocusClass, courseInputClass } from './courseFormStyles'

type Option = { value: string; label: string }
type WheelProps = { label: string; options: Option[]; value: string; onChange: (value: string) => void }

const rowHeight = 56
const dayOptions: Option[] = [
  { value: 'every', label: '每天' }, { value: 'workdays', label: '工作日' },
  ...[1, 2, 3, 4, 5, 6, 0].map((day, index) => ({ value: String(day), label: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index] })),
]
const hourOptions = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: String(hour).padStart(2, '0') + '点' }))
const minuteOptions = Array.from({ length: 60 }, (_, minute) => ({ value: String(minute), label: String(minute).padStart(2, '0') + '分' }))
const durationOptions = Array.from({ length: 48 }, (_, index) => ({ value: String((index + 1) * 5), label: String((index + 1) * 5) + '分钟' }))

function WheelColumn({ label, options, value, onChange }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const index = options.findIndex(option => option.value === value)
    if (index >= 0 && ref.current) ref.current.scrollTop = index * rowHeight
  }, [options, value])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return <div className="min-w-0 flex-1">
    <p className="h-9 text-center text-xs font-semibold text-slate-500">{label}</p>
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-14 -translate-y-1/2 border-y border-emerald-100 bg-emerald-50" />
      <div ref={ref} aria-label={label} onScroll={e => {
        if (timer.current) clearTimeout(timer.current)
        const target = e.currentTarget
        timer.current = setTimeout(() => { const option = options[Math.max(0, Math.min(options.length - 1, Math.round(target.scrollTop / rowHeight)))]; if (option && option.value !== value) onChange(option.value) }, 100)
      }} className="relative z-10 h-[280px] snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth [scrollbar-width:thin] motion-reduce:scroll-auto">
        <div className="h-28" aria-hidden="true" />
        {options.map(option => <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => { onChange(option.value); ref.current?.scrollTo({ top: options.indexOf(option) * rowHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }} className={`${courseFocusClass} flex h-14 w-full cursor-pointer snap-center items-center justify-center whitespace-nowrap px-1 text-sm hover:bg-emerald-50/70 active:bg-emerald-100 sm:text-lg ${option.value === value ? 'font-semibold text-emerald-900' : 'font-medium text-slate-500'}`}>{option.label}</button>)}
        <div className="h-28" aria-hidden="true" />
      </div>
    </div>
  </div>
}

export default function CourseTimeWheel({ days, start, end, once, date, onDaysChange, onTimeChange, onDateChange, onClose }: { days: number[]; start: string; end: string; once: boolean; date: string; onDaysChange: (days: number[]) => void; onTimeChange: (start: number, duration: number) => void; onDateChange: (date: string) => void; onClose: () => void }) {
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5))
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5))
  const duration = endMinutes - startMinutes
  const dayValue = days.length === 7 ? 'every' : days.length === 5 && [1, 2, 3, 4, 5].every(day => days.includes(day)) ? 'workdays' : days.length === 1 ? String(days[0]) : 'custom'
  const daysForValue = (value: string) => value === 'every' ? [0, 1, 2, 3, 4, 5, 6] : value === 'workdays' ? [1, 2, 3, 4, 5] : [Number(value)]
  const weekdayOptions = dayValue === 'custom' ? [{ value: 'custom', label: '多个星期' }, ...dayOptions] : dayOptions
  const availableDurations = durationOptions.filter(option => startMinutes + Number(option.value) < 1440)
  if (!availableDurations.some(option => option.value === String(duration))) availableDurations.unshift({ value: String(duration), label: String(duration) + '分钟' })
  return <TimetableDialog bare title="设置上课时间" onClose={onClose} className="max-w-2xl! scroll-pt-24">
    <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6"><h2 className="text-lg font-semibold text-slate-900">设置上课时间</h2><button autoFocus type="button" onClick={onClose} className={courseButtonClass}>完成</button></header>
    <div className="bg-white p-4 sm:p-6">
      {once && <label className="mb-3 flex items-center gap-3 text-sm">上课日期<input type="date" value={date} onChange={e => onDateChange(e.target.value)} className={courseInputClass} /></label>}
      <div className="flex gap-1.5 sm:gap-3">
        {once ? <div className="min-w-0 flex-1"><p className="h-9 text-center text-xs font-semibold text-slate-500">日期</p><div className="flex h-[280px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-1 text-center text-sm text-slate-500">按上方日期</div></div> : <WheelColumn label="星期" options={weekdayOptions} value={dayValue} onChange={value => { if (value !== 'custom') onDaysChange(daysForValue(value)) }} />}
        <WheelColumn label="开始时间" options={hourOptions} value={String(Math.floor(startMinutes / 60))} onChange={value => onTimeChange(Number(value) * 60 + startMinutes % 60, duration)} />
        <WheelColumn label="分钟" options={minuteOptions} value={String(startMinutes % 60)} onChange={value => onTimeChange(Math.floor(startMinutes / 60) * 60 + Number(value), duration)} />
        <WheelColumn label="时长" options={availableDurations} value={String(duration)} onChange={value => onTimeChange(startMinutes, Number(value))} />
      </div>
    </div>
  </TimetableDialog>
}
