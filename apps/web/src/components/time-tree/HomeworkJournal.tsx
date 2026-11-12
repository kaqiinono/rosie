'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'
import { clock, dayOf, elapsed, shift, timing, type WorkStep } from '@/lib/time-tree/types'
import { SUBJECTS } from '@/components/tree-demo/garden/model'
import { useTimeTree } from './useTimeTree'
import { StepPanel, TreeWait } from './StepPanel'

interface DayTotals {
  plan: number
  done: number
  completed: number
  early: number
  onTime: number
  late: number
  milliseconds: number
}
function emptyTotals(): DayTotals {
  return { plan: 0, done: 0, completed: 0, early: 0, onTime: 0, late: 0, milliseconds: 0 }
}

function estimatedMinutes(steps: WorkStep[]) {
  return steps.reduce((total, step) => total + step.minutes, 0)
}

function journalDays(steps: WorkStep[]) {
  const groups = new Map<string, WorkStep[]>()
  const days = new Map<string, DayTotals>()
  function entry(day: string) {
    const existing = days.get(day)
    if (existing) return existing
    const created = emptyTotals()
    days.set(day, created)
    return created
  }
  for (const step of steps) {
    if (step.skipped) continue
    const group = groups.get(step.occurrence)
    if (group) group.push(step)
    else groups.set(step.occurrence, [step])
    if (!step.start || !step.end) continue
    const end = Date.parse(step.end)
    let cursor = Date.parse(step.start)
    while (cursor < end) {
      const day = dayOf(new Date(cursor))
      const midnight = Date.parse(shift(day, 1) + 'T00:00:00+08:00')
      const next = Math.min(midnight, end)
      entry(day).milliseconds += next - cursor
      cursor = next
    }
  }
  for (const parts of groups.values()) {
    const finished = parts.every((s) => s.end)
    const planned = parts
      .map((s) => s.planned)
      .filter((d): d is string => !!d)
      .sort()
      .at(-1)
    if (planned) {
      entry(planned).plan++
      if (finished) entry(planned).done++
    }
    if (!finished) continue
    const completionDays = parts.map((s) => dayOf(s.end!))
    const actual = entry(completionDays.sort().at(-1)!)
    actual.completed++
    if (parts.some((s) => !s.start)) continue
    const margins = parts.map((s) => elapsed(s.start!, s.end!) - s.minutes)
    if (margins.some((m) => m > 0)) actual.late++
    else if (margins.some((m) => m < 0)) actual.early++
    else actual.onTime++
  }
  return days
}

export default function HomeworkJournal({ calendar = false }: { calendar?: boolean }) {
  const api = useTimeTree()
  const [selected, select] = useState<string | null>(null)
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [id, setId] = useState<string | null>(null)
  const records = api.tree?.steps
  const byDay = useMemo(() => journalDays(records ?? []), [records])
  if (!api.tree)
    return (
      <section className="flex min-h-[50dvh] flex-col">
        <TreeWait api={api} />
      </section>
    )
  const tree = api.tree
  const date = selected ?? tree.today
  const weekday = new Date(date + 'T12:00Z').getUTCDay()
  const from = period === 'week' ? shift(date, -(weekday + 6) % 7) : date.slice(0, 7) + '-01'
  const until = period === 'week' ? shift(from, 7) : shift(from, 32).slice(0, 7) + '-01'
  const days: string[] = []
  for (let d = from; d < until; d = shift(d, 1)) days.push(d)
  const summary = emptyTotals()
  for (const day of days) {
    const counts = byDay.get(day)
    if (counts)
      for (const key of Object.keys(summary) as (keyof DayTotals)[]) summary[key] += counts[key]
  }
  const step = tree.steps.find((s) => s.id === id)
  const planned = tree.steps.filter((s) => !s.skipped && s.planned === date)
  const finished = tree.steps.filter((s) => s.end && dayOf(s.end) === date)
  const overdue = tree.steps.filter((s) => !s.skipped && !s.end && s.planned !== null && s.planned < date)
  const parked = calendar
    ? tree.steps.filter((s) => !s.skipped && !s.end && s.planned === null && s.scheduled === date)
    : []
  const skipped = calendar
    ? tree.steps.filter((s) => s.skipped && (s.planned ?? s.scheduled) === date)
    : []
  function row(s: WorkStep) {
    return (
      <Button
        key={s.id}
        variant="soft"
        color={s.skipped ? 'gray' : s.end ? 'green' : s.start ? 'amber' : 'sky'}
        onClick={() => setId(s.id)}
      >
        {SUBJECTS[s.subject].emoji} {s.name} ·{' '}
        {s.skipped ? '不用做' : s.end
          ? (s.start ? clock(s.end) + ' ' : '') + timing(s)
          : s.start
            ? '◷ 进行中'
            : s.planned
              ? s.minutes + ' 分钟'
              : '先不做'}
      </Button>
    )
  }
  return (
    <StickerCard as="section" className="my-3">
      <Flex direction="column" gap="3">
        <Flex gap="2" align="center" wrap="wrap">
          <Text as="div" size="5" weight="bold">
            {calendar ? '作业日历' : '今天的作业'}
          </Text>
          <Button asChild size="1" variant="soft">
            <Link href="/time-tree">🌳 去生命树</Link>
          </Button>
          {!calendar && (
            <Button asChild size="1" variant="soft">
              <Link href="/today/calendar?view=homework">作业日历</Link>
            </Button>
          )}
        </Flex>
        {calendar && summary && (
          <>
            <Flex gap="2" align="center" wrap="wrap">
              <Button
                size="1"
                onClick={() => select(period === 'week' ? shift(from, -7) : shift(from, -1))}
              >
                上一{period === 'week' ? '周' : '月'}
              </Button>
              <Button
                variant={period === 'week' ? 'solid' : 'soft'}
                onClick={() => setPeriod('week')}
              >
                周
              </Button>
              <Button
                variant={period === 'month' ? 'solid' : 'soft'}
                onClick={() => setPeriod('month')}
              >
                月
              </Button>
              <Button size="1" onClick={() => select(until)}>
                下一{period === 'week' ? '周' : '月'}
              </Button>
              <Button size="1" variant="soft" onClick={() => select(tree.today)}>
                今天
              </Button>
            </Flex>
            <Text>
              {from} — {shift(until, -1)}
            </Text>
            <Text size="2">
              计划完成 {summary.done}/{summary.plan}{' '}
              {summary.plan > 0
                ? '（' + Math.round((100 * summary.done) / summary.plan) + '%）'
                : ''}{' '}
              · 实际完成 {summary.completed} 件 · 累计 {Math.round(summary.milliseconds / 60000)}{' '}
              分钟 · 提前 {summary.early} 件 · 按时 {summary.onTime} 件 · 超时 {summary.late} 件
            </Text>
            <div className="grid grid-cols-7 gap-1">
              {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
                <Text align="center" key={d} size="1">
                  周{d}
                </Text>
              ))}
              {Array.from({ length: (new Date(from + 'T12:00Z').getUTCDay() + 6) % 7 }, (_, i) => (
                <span key={i} />
              ))}
              {days.map((d) => {
                const counts = byDay.get(d) ?? emptyTotals()
                return (
                  <div key={d} className="flex flex-col items-center gap-1">
                    <Button
                      aria-label={d + ' 计划' + counts.plan + ' 实际完成' + counts.completed}
                      size="1"
                      variant={date === d ? 'solid' : 'soft'}
                      onClick={() => select(d)}
                    >
                      {Number(d.slice(-2))}
                    </Button>
                    <Text size="1">
                      {counts.plan} / {counts.completed}
                    </Text>
                  </div>
                )
              })}
            </div>
            <Text size="1" color="gray">
              日期下方为计划件数 / 实际完成件数
            </Text>
          </>
        )}
        <Text weight="bold">{date} · 当天计划 · 预计 {estimatedMinutes(planned)} 分钟</Text>
        <Flex gap="2" wrap="wrap">
          {planned.length ? planned.map(row) : <Text size="2">当天没有排入作业。</Text>}
        </Flex>
        {calendar && (
          <>
            <Text weight="bold">当天实际完成</Text>
            <Flex gap="2" wrap="wrap">
              {finished.length ? finished.map(row) : <Text size="2">还没有完成记录。</Text>}
            </Flex>
          </>
        )}
        {skipped.length > 0 && (
          <>
            <Badge color="gray">当天不用做</Badge>
            <Flex gap="2" wrap="wrap">{skipped.map(row)}</Flex>
          </>
        )}
        {parked.length > 0 && (
          <>
            <Badge color="gray">当天先不做</Badge>
            <Flex gap="2" wrap="wrap">{parked.map(row)}</Flex>
          </>
        )}
        {!calendar && overdue.length > 0 && (
          <>
            <Badge color="amber">补做计划 · 预计 {estimatedMinutes(overdue)} 分钟</Badge>
            <Flex gap="2" wrap="wrap">
              {overdue.map(row)}
            </Flex>
          </>
        )}
        {step && (
          <StepPanel
            key={step.id}
            api={api}
            step={step}
            select={setId}
            close={() => setId(null)}
            homework
          />
        )}
      </Flex>
    </StickerCard>
  )
}
