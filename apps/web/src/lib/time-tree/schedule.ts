import type { Homework } from '@rosie/tasks'
import { capacityOf, flowersForMinutes } from '@/components/tree-demo/garden/model'
import { dayOf, shift, type TreeData, type WorkStep } from './types'

const diff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
const weekday = (day: string) => new Date(day + 'T12:00Z').getUTCDay()

function period(t: Homework, day: string) {
  let start = day
  let span = 1
  let count = 1
  if (t.cycle === 'weekly') {
    start = shift(day, -((weekday(day) - t.start_weekday! + 7) % 7))
    span = ((t.end_weekday! - t.start_weekday! + 7) % 7) + 1
    count = t.times_per_week!
  } else if (t.cycle === 'monthly') {
    start = day.slice(0, 7) + '-01'
    span = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate()
    count = t.times_per_cycle!
  } else if (t.cycle !== 'daily') {
    const anchor = t.start_date!
    if (day < anchor || (t.end_date && day > t.end_date)) return null
    span = t.cycle === 'custom' ? 7 : t.cycle === 'biweekly' ? 14 : 21
    start = shift(anchor, Math.floor(diff(day, anchor) / span) * span)
    if (t.end_date) span = Math.min(span, diff(t.end_date, start) + 1)
    count = t.times_per_cycle ?? t.times_per_week!
  }
  return { start, end: shift(start, span - 1), count: Math.min(count, span), span }
}

/** Spread occurrences across their window. Keys survive revisiting overlapping seven-day views. */
export function schedule(tree: TreeData, templates: Homework[], from: string, through: string) {
  const existing = new Set(tree.steps.map((s) => s.occurrence))
  const load = new Map<string, number>()
  for (const s of tree.steps)
    if (!s.skipped && s.planned) load.set(s.planned, (load.get(s.planned) ?? 0) + s.stages.length)
  const active = templates
    .filter((t) => t.enabled)
    .sort((a, b) => a.priority.localeCompare(b.priority) || a.id.localeCompare(b.id))
  for (const t of active.sort(
    (a, b) => Number(b.cycle === 'daily') - Number(a.cycle === 'daily'),
  )) {
    const first = dayOf(t.created_at) > tree.firstDay ? dayOf(t.created_at) : tree.firstDay
    for (let day = from; day <= through; day = shift(day, 1)) {
      if (day < first) continue
      const p = period(t, day)
      if (!p || day > p.end) continue
      const offset = diff(day, p.start)
      const ordinal = Math.ceil(((offset + 1) * p.count) / p.span) - 1
      const windowStart = shift(p.start, Math.floor((ordinal * p.span) / p.count))
      if (day !== windowStart && day !== first) continue
      const windowEnd = shift(p.start, Math.floor(((ordinal + 1) * p.span) / p.count) - 1)
      const occurrence = [t.id, t.cycle, p.start, ordinal].join('/')
      if (existing.has(occurrence)) continue
      existing.add(occurrence)
      const parts =
        t.estimated_minutes > 60 ? [60, t.estimated_minutes - 60] : [t.estimated_minutes]
      parts.forEach((minutes, index) => {
        const flowers =
          t.subject === 'life' && index < parts.length - 1
            ? 0
            : flowersForMinutes(t.subject, minutes)
        let planned: string | null = null
        let lowestLoad = Infinity
        for (let d = day; d <= windowEnd && d <= through; d = shift(d, 1)) {
          const used = load.get(d) ?? 0
          if (used < lowestLoad && used + flowers <= capacityOf(d)) {
            planned = d
            lowestLoad = used
          }
        }
        if (planned) load.set(planned, (load.get(planned) ?? 0) + flowers)
        const step: WorkStep = {
          id: occurrence + '/' + index,
          occurrence,
          name: parts.length === 1 ? t.name : t.name + '（' + (index + 1) + '/2）',
          notes: t.notes,
          subject: t.subject,
          priority: t.priority,
          minutes,
          scheduled: planned ?? day,
          planned,
          deadline: p.end,
          start: null,
          end: null,
          settled: false,
          popped: false,
          slot: null,
          returned: null,
          sun: 0,
          water: 0,
          stages: Array.from({ length: flowers }, () => 0),
          audit: [],
        }
        tree.steps.push(step)
      })
    }
  }
}
