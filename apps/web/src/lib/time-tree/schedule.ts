import type { Homework } from '@rosie/tasks'
import { flowersForMinutes } from '@/components/tree-demo/garden/model'
import { dayOf, shift, type TreeData, type WorkStep } from './types'
import { bindPractice, calendarPractice } from './practice'

const diff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
const weekday = (day: string) => new Date(day + 'T12:00Z').getUTCDay()
const isWeekend = (day: string) => weekday(day) === 0 || weekday(day) === 6

/** Content follows template edits until completion; execution and placement stay intact. */
function syncHomeworkContent(tree: TreeData, templates: Homework[]) {
  const byId = new Map(templates.map(template => [template.id, template]))
  const groups = new Map<string, WorkStep[]>()
  for (const step of [...tree.steps, ...(tree.weekendExcludedSteps ?? [])]) {
    const peers = groups.get(step.occurrence) ?? []
    peers.push(step)
    groups.set(step.occurrence, peers)
  }
  for (const [occurrence, peers] of groups) {
    const template = byId.get(occurrence.split('/')[0])
    if (!template) continue
    const binding = template.practice_binding
    const day = peers.map(step => step.scheduled).sort()[0]
    const pending = peers.filter(step => !step.end && !step.skipped && !step.settled)
    for (const step of pending) {
      const index = Number(step.id.split('/').at(-1))
      step.name = peers.length === 1 ? template.name : `${template.name}（${index + 1}/${peers.length}）`
      step.notes = template.notes
      step.subject = template.subject
      step.priority = template.priority
      step.practiceEntryName = binding?.name
      // A stable binding keeps its authored date snapshot, including after manual moves.
      if (binding && step.practice?.key === binding.key) continue
      const previous = step.practice && tree.practiceProgress?.[step.practice.key]
      if (previous?.activeOccurrence === occurrence) previous.activeOccurrence = null
      if (!binding) step.practice = null
      else if (binding.progression) step.practice = calendarPractice(binding, day)
      else delete step.practice
    }
    // A running legacy task must keep a valid reservation for completion. Pending
    // legacy work continues to bind lazily, rather than reserving every future day.
    for (const step of pending) {
      if (step.start && step.practice === undefined) bindPractice(tree, step, template)
    }
  }
}

function period(t: Homework, day: string) {
  if (t.cycle === 'daily' && t.include_weekends === false && isWeekend(day)) return null
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

/** Reconcile only untouched, current/future daily weekend occurrences, as whole split groups. */
function syncWeekendTasks(tree: TreeData, templates: Homework[]) {
  const byId = new Map(templates.map((template) => [template.id, template]))
  const archived = tree.weekendExcludedSteps ?? []
  const retained: WorkStep[] = []
  const ids = new Set(tree.steps.map((step) => step.id))
  for (const step of archived) {
    const template = byId.get(step.occurrence.split('/')[0])
    if (template?.enabled && template.cycle === 'daily' && template.include_weekends !== false && step.scheduled >= tree.today) {
      if (!ids.has(step.id)) { tree.steps.push(step); ids.add(step.id) }
    } else retained.push(step)
  }
  const groups = new Map<string, WorkStep[]>()
  for (const step of tree.steps) {
    const group = groups.get(step.occurrence) ?? []
    group.push(step)
    groups.set(step.occurrence, group)
  }
  const excluded = new Set<string>()
  for (const [occurrence, steps] of groups) {
    const [templateId, cycle, originalDay] = occurrence.split('/')
    const template = byId.get(templateId)
    if (!template?.enabled || template.cycle !== 'daily' || template.include_weekends !== false ||
      cycle !== 'daily' || !originalDay || originalDay < tree.today || !isWeekend(originalDay)) continue
    if (steps.some((step) => step.start || step.end || step.skipped || step.audit.length ||
      step.scheduled < tree.today || !step.planned || step.planned < tree.today || !isWeekend(step.planned))) continue
    excluded.add(occurrence)
    for (const step of steps) {
      step.slot = null
      // Release legacy preview reservations without consumption. Calendar snapshots
      // are already authored for this occurrence and survive disabling weekends.
      if (!step.practice?.calendarBased) delete step.practice
      retained.push(step)
    }
    for (const progress of Object.values(tree.practiceProgress ?? {})) {
      if (progress.activeOccurrence === occurrence) progress.activeOccurrence = null
    }
  }
  if (excluded.size) tree.steps = tree.steps.filter((step) => !excluded.has(step.occurrence))
  if (retained.length || tree.weekendExcludedSteps) tree.weekendExcludedSteps = retained
}

/** Spread occurrences across their window. Keys survive revisiting overlapping seven-day views. */
export function schedule(tree: TreeData, templates: Homework[], from: string, through: string, fillCurrentWindow = false) {
  const enabledLife = new Set(templates.filter(t => t.enabled && t.subject === 'life').map(t => t.id))
  const removed = new Set<string>()
  const retain = (step: WorkStep) => {
    if (step.subject !== 'life' || step.end) return true
    const keep = enabledLife.has(step.occurrence.split('/')[0]) && step.scheduled === tree.today &&
      step.occurrence.split('/')[1] === 'daily' && step.id.endsWith('/0')
    if (!keep) removed.add(step.occurrence)
    else { step.start = null; step.stages = [0] }
    return keep
  }
  tree.steps = tree.steps.filter(retain)
  tree.weekendExcludedSteps = tree.weekendExcludedSteps?.filter(retain)
  for (const progress of Object.values(tree.practiceProgress ?? {})) {
    if (progress.activeOccurrence && removed.has(progress.activeOccurrence)) progress.activeOccurrence = null
  }
  templates = templates.map(t => t.subject === 'life'
    ? { ...t, cycle: 'daily', include_weekends: true, practice_binding: null }
    : t)
  if (!fillCurrentWindow) {
    syncWeekendTasks(tree, templates)
    syncHomeworkContent(tree, templates)
  }
  for (const step of tree.steps) {
    if (!fillCurrentWindow && !step.skipped && !step.end && !step.start && !step.planned && step.scheduled) step.planned = step.scheduled
  }
  const existing = new Set([
    ...tree.steps,
    ...(fillCurrentWindow ? tree.weekendExcludedSteps ?? [] : []),
  ].map((s) => s.occurrence))
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
      if (t.subject === 'life' && (day !== tree.today || tree.steps.some(s =>
        s.occurrence.startsWith(t.id + '/') && s.scheduled === day && s.end))) continue
      if (day < first) continue
      const p = period(t, day)
      if (!p || day > p.end) continue
      const offset = diff(day, p.start)
      const ordinal = Math.ceil(((offset + 1) * p.count) / p.span) - 1
      const windowStart = shift(p.start, Math.floor((ordinal * p.span) / p.count))
      if (day !== windowStart && day !== first && !(fillCurrentWindow && day === from)) continue
      const windowEnd = shift(p.start, Math.floor(((ordinal + 1) * p.span) / p.count) - 1)
      const occurrence = [t.id, t.cycle, p.start, ordinal].join('/')
      if (existing.has(occurrence)) continue
      existing.add(occurrence)
      const practice = t.practice_binding?.progression ? calendarPractice(t.practice_binding, day) : undefined
      const parts =
        t.subject !== 'life' && t.estimated_minutes > 60 ? [60, t.estimated_minutes - 60] : [t.estimated_minutes]
      parts.forEach((minutes, index) => {
        const flowers =
          t.subject === 'life' && index < parts.length - 1
            ? 0
            : flowersForMinutes(t.subject, minutes)
        let planned: string | null = null
        let lowestLoad = Infinity
        for (let d = day; d <= windowEnd && d <= through; d = shift(d, 1)) {
          const used = load.get(d) ?? 0
          if (used < lowestLoad) {
            planned = d
            lowestLoad = used
          }
        }
        if (planned) load.set(planned, (load.get(planned) ?? 0) + flowers)
        const step: WorkStep = {
          ...(practice ? { practice: structuredClone(practice) } : {}),
          id: occurrence + '/' + index,
          occurrence,
          practiceEntryName: t.practice_binding?.name,
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
