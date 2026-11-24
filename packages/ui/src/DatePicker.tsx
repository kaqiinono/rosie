'use client'

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Button, Flex, IconButton, Popover, Text } from './themes'

export type DatePickerProps = {
  label: string
  /** 已选日期为 YYYY-MM-DD，空字符串表示未选择。 */
  value: string
  onValueChange: (value: string) => void
  min?: string
  clearable?: boolean
  placeholder?: string
}

const FIRST_DATE = '0001-01-01'
const LAST_DATE = '9999-12-31'
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const DATE_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
const shanghaiDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' })
const chineseDate = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long', timeZone: 'UTC' })

const toDate = (value: string) => new Date(`${value}T00:00:00Z`)
const weekday = (date: Date) => (date.getUTCDay() + 6) % 7

function dateKey(date: Date) {
  const year = date.getUTCFullYear()
  if (year < 1) return FIRST_DATE
  if (year > 9999) return LAST_DATE
  return date.toISOString().slice(0, 10)
}

function shiftDay(value: string, days: number) {
  const date = toDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return dateKey(date)
}

function shiftMonth(value: string, months: number) {
  const date = toDate(value)
  const day = date.getUTCDate()
  date.setUTCMonth(date.getUTCMonth() + months + 1, 0)
  date.setUTCDate(Math.min(day, date.getUTCDate()))
  return dateKey(date)
}

export function DatePicker({
  label,
  value,
  onValueChange,
  min,
  clearable = false,
  placeholder = '选择日期',
}: DatePickerProps) {
  const headingId = useId()
  const [open, setOpen] = useState(false)
  const [today, setToday] = useState('')
  const [activeDate, setActiveDate] = useState(FIRST_DATE)
  const activeButton = useRef<HTMLButtonElement>(null)
  const focusActiveDay = useRef(false)
  const earliest = min || FIRST_DATE
  const month = activeDate.slice(0, 7)
  const [year, monthNumber] = month.split('-').map(Number)
  const firstDay = toDate(`${month}-01`)
  const lastDay = toDate(`${month}-01`)
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0)
  const leadingDays = weekday(firstDay)
  const monthDays = lastDay.getUTCDate()
  const weekCount = Math.ceil((leadingDays + monthDays) / 7)
  const previousMonth = shiftMonth(activeDate, -1)
  const nextMonth = shiftMonth(activeDate, 1)
  const previousMonthKey = previousMonth.slice(0, 7)
  const displayValue = value ? chineseDate.format(toDate(value)) : placeholder

  useEffect(() => {
    if (focusActiveDay.current) {
      focusActiveDay.current = false
      activeButton.current?.focus()
    }
  }, [activeDate])

  function changeOpen(next: boolean) {
    if (next) {
      const currentDay = shanghaiDate.format(new Date())
      const initial = value || min || currentDay
      setActiveDate(initial < earliest ? earliest : initial)
      setToday(currentDay)
    }
    setOpen(next)
  }

  function selectDate(next: string) {
    if (next !== value) onValueChange(next)
    setOpen(false)
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    let next: string
    const step = DATE_STEPS[event.key]
    if (step !== undefined) {
      next = shiftDay(activeDate, step)
    } else if (event.key === 'Home' || event.key === 'End') {
      const position = weekday(toDate(activeDate))
      next = shiftDay(activeDate, event.key === 'Home' ? -position : 6 - position)
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const months = event.shiftKey ? 12 : 1
      next = shiftMonth(activeDate, event.key === 'PageUp' ? -months : months)
    } else {
      return
    }
    event.preventDefault()
    const target = next < earliest ? earliest : next
    if (target !== activeDate) {
      focusActiveDay.current = true
      setActiveDate(target)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger>
        <Button
          type="button"
          variant="outline"
          color="gray"
          className="w-full min-w-0 justify-between"
          aria-label={`${label}，${displayValue}`}
          aria-invalid={Boolean(value && value < earliest) || undefined}
        >
          <Text color={value ? undefined : 'gray'} className="truncate tabular-nums">
            {displayValue}
          </Text>
          <CalendarDays size={16} className="shrink-0" aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        size="1"
        align="start"
        width="20rem"
        maxWidth="calc(100vw - 1.5rem)"
        maxHeight="var(--radix-popover-content-available-height)"
        collisionPadding={12}
        className="overflow-y-auto"
        aria-label={label}
        onOpenAutoFocus={(event) => {
          if (activeButton.current) {
            event.preventDefault()
            activeButton.current.focus()
          }
        }}
      >
        <Flex align="center" justify="between" gap="2" mb="2">
          <IconButton
            type="button"
            variant="soft"
            color="gray"
            aria-label="上个月"
            disabled={previousMonthKey === month || previousMonthKey < earliest.slice(0, 7)}
            onClick={() => setActiveDate(previousMonth < earliest ? earliest : previousMonth)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </IconButton>
          <Text id={headingId} size="3" weight="bold" aria-live="polite">
            {year}年{monthNumber}月
          </Text>
          <IconButton
            type="button"
            variant="soft"
            color="gray"
            aria-label="下个月"
            disabled={nextMonth.slice(0, 7) === month}
            onClick={() => setActiveDate(nextMonth)}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </IconButton>
        </Flex>
        <table
          role="grid"
          aria-labelledby={headingId}
          onKeyDown={onGridKeyDown}
          className="w-full table-fixed text-center"
        >
          <thead>
            <tr>
              {WEEKDAYS.map((day) => (
                <th key={day} scope="col" aria-label={`周${day}`} className="h-8 font-normal">
                  <Text size="1" color="gray">
                    {day}
                  </Text>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: weekCount }, (_, week) => (
              <tr key={week}>
                {WEEKDAYS.map((dayLabel, column) => {
                  const day = week * 7 + column + 1 - leadingDays
                  if (day < 1 || day > monthDays) return <td key={dayLabel} />
                  const key = `${month}-${String(day).padStart(2, '0')}`
                  const selected = key === value
                  const current = key === today
                  const active = key === activeDate
                  return (
                    <td key={dayLabel} className="h-10 align-middle" aria-selected={selected}>
                      <IconButton
                        ref={active ? activeButton : undefined}
                        type="button"
                        size="2"
                        variant={selected ? 'solid' : current ? 'soft' : 'ghost'}
                        color={selected || current ? undefined : 'gray'}
                        highContrast={!selected && !current}
                        aria-label={chineseDate.format(toDate(key))}
                        aria-current={current ? 'date' : undefined}
                        disabled={key < earliest}
                        tabIndex={active ? 0 : -1}
                        onClick={() => selectDate(key)}
                      >
                        <span className="min-w-4 tabular-nums">{day}</span>
                      </IconButton>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <Flex justify={clearable ? 'between' : 'end'} gap="2" mt="2">
          {clearable && (
            <Button
              type="button"
              variant="soft"
              color="gray"
              disabled={!value}
              onClick={() => selectDate('')}
            >
              清空
            </Button>
          )}
          <Button
            type="button"
            variant="soft"
            disabled={today < earliest}
            onClick={() => selectDate(today)}
          >
            今天
          </Button>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  )
}
