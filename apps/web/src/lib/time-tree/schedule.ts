import { homeworkPeriod as period, type Homework } from '@rosie/tasks'
import { flowersForMinutes } from '@/components/tree-demo/garden/model'
import { dayOf, isExhaustedPendingStep, PRACTICE_SCHEDULE_VERSION, shift, type TreeData, type WorkStep } from './types'
import { planMathQuestions } from './mathQuestions'
import { bindPractice, calendarPractice } from './practice'
import { weeklyHomeworkStart } from './flowers'
import { createWeeklyHomework, syncWeeklyHomework, usesWeeklyHomework, weeklyOccurrence } from './weeklyHomework'

const diff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
const weekday = (day: string) => new Date(day + 'T12:00Z').getUTCDay()
const isWeekend = (day: string) => weekday(day) === 0 || weekday(day) === 6

function usesFlowerSessions(template: Homework): boolean {
  return template.subject !== 'life' && ['biweekly', 'three_weekly'].includes(template.cycle)
}

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
      if (step.scheduled < tree.today && (!step.planned || step.planned < tree.today) && isExhaustedPendingStep(tree, step)) continue
      // The next session inherits the exact same work, even after template edits.
      if (step.flowers && (step.start || step.flowers.availableFrom || template.subject === 'life')) continue
      const index = Number(step.id.split('/').at(-1))
      step.name = peers.length === 1 ? template.name : `${template.name}（${index + 1}/${peers.length}）`
      step.notes = template.notes
      step.subject = template.subject
      step.priority = template.priority
      step.practiceBindingKey = binding?.progression ? undefined : binding?.key
      step.practiceEntryName = binding?.name
      if (weeklyHomeworkStart(step) && usesWeeklyHomework(template)) step.minutes = template.estimated_minutes
      // A stable binding keeps its authored date snapshot, including after manual moves.
      if (binding && step.practice?.key === binding.key) continue
      const previous = step.practice && tree.practiceProgress?.[step.practice.key]
      if (previous?.activeOccurrence === occurrence) previous.activeOccurrence = null
      if (!binding) step.practice = null
      else if (binding.progression) step.practice = calendarPractice(binding, day, occurrence)
      else delete step.practice
    }
    // A running legacy task must keep a valid reservation for completion. Pending
    // legacy work continues to bind lazily, rather than reserving every future day.
    for (const step of pending) {
      if (step.start && step.practice === undefined) bindPractice(tree, step, template)
    }
  }
}

/** Upgrade untouched occurrences once, preserving their frozen course and notes. */
function syncFlowerSessions(tree: TreeData, templates: Homework[]) {
  const byId = new Map(templates.filter(template => template.enabled && usesFlowerSessions(template))
    .map(template => [template.id, template]))
  const groups = new Map<string, WorkStep[]>()
  for (const step of tree.steps) {
    const peers = groups.get(step.occurrence) ?? []
    peers.push(step)
    groups.set(step.occurrence, peers)
  }
  const mergedIds = new Set<string>()
  for (const [occurrence, peers] of groups) {
    const [templateId, cycle, cycleStart, ordinalText] = occurrence.split('/')
    const template = byId.get(templateId)
    if (!template || cycle !== template.cycle || !cycleStart) continue
    if (peers.some(step => step.flowers || step.start || step.end || step.skipped || step.settled ||
      step.audit.length || step.returned || step.practice?.questions || step.stages.some(stage => stage > 0) ||
      step.scheduled < tree.today || step.planned !== step.scheduled)) continue
    const window = period(template, cycleStart)
    const ordinal = Number(ordinalText)
    if (!window || window.start !== cycleStart || !Number.isInteger(ordinal) || ordinal < 0 ||
      ordinal >= window.count || peers.some(step => step.deadline !== window.end)) continue
    peers.sort((a, b) => a.id.localeCompare(b.id))
    const first = peers[0]
    if (peers.some(step => step.practice?.key !== first.practice?.key)) continue
    const windowStart = shift(window.start, Math.floor((ordinal * window.span) / window.count))
    const start = [windowStart, tree.firstDay, dayOf(template.created_at), tree.today].sort().at(-1)!
    if (start > first.deadline) continue
    first.minutes = peers.reduce((sum, step) => sum + step.minutes, 0)
    first.planNote = [...new Set(peers.map(step => step.planNote).filter(Boolean))].join('\n') || undefined
    first.name = template.name
    first.scheduled = start
    first.planned = start
    first.slot = null
    first.stages = []
    first.flowers = { collected: 0, elapsedMs: 0, complete: false }
    for (const peer of peers.slice(1)) mergedIds.add(peer.id)
  }
  if (mergedIds.size) tree.steps = tree.steps.filter(step => !mergedIds.has(step.id))
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
    if (steps.some((step) => step.start || step.end || step.skipped || step.practice?.questions || step.audit.length ||
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
    if (step.crown) return step.scheduled === tree.today
    const keep = enabledLife.has(step.occurrence.split('/')[0]) && step.scheduled === tree.today &&
      step.occurrence.split('/')[1] === 'daily' && step.id.endsWith('/0')
    if (!keep) removed.add(step.occurrence)
    else {
      step.start = null
      step.stages = [0]
      step.minutes = 0
    }
    return keep
  }
  tree.steps = tree.steps.filter(retain)
  tree.weekendExcludedSteps = tree.weekendExcludedSteps?.filter(retain)
  for (const progress of Object.values(tree.practiceProgress ?? {})) {
    if (progress.activeOccurrence && removed.has(progress.activeOccurrence)) progress.activeOccurrence = null
  }
  templates = templates.map(t => t.subject === 'life'
    ? { ...t, cycle: 'daily', include_weekends: true, estimated_minutes: 0, practice_binding: null }
    : t)
  if (!fillCurrentWindow) {
    syncWeekendTasks(tree, templates)
    syncWeeklyHomework(tree, templates)
    syncFlowerSessions(tree, templates)
    syncHomeworkContent(tree, templates)
    tree.practiceScheduleVersion = PRACTICE_SCHEDULE_VERSION
  }
  for (const step of tree.steps) {
    if (!fillCurrentWindow && !step.skipped && !step.end && !step.start && !step.planned && step.scheduled) step.planned = step.scheduled
  }
  const existing = new Set([
    ...tree.steps,
    ...(fillCurrentWindow ? tree.weekendExcludedSteps ?? [] : []),
  ].map((s) => s.occurrence))
  // Legacy receipts continue to occupy their week even when there is no remaining task to consolidate.
  for (const occurrence of [...existing]) {
    const [id, cycle, start] = occurrence.split('/')
    if (cycle === 'weekly' && start) existing.add(weeklyOccurrence(id, start))
  }
  const load = new Map<string, number>()
  for (const s of tree.steps)
    if (!s.skipped && s.planned && !isExhaustedPendingStep(tree, s)) load.set(s.planned, (load.get(s.planned) ?? 0) + s.stages.length)
  const active = templates
    .filter((t) => t.enabled)
    .sort((a, b) => a.priority.localeCompare(b.priority) || a.id.localeCompare(b.id))
  for (const t of active.sort(
    (a, b) => Number(b.cycle === 'daily') - Number(a.cycle === 'daily'),
  )) {
    const binding = t.practice_binding
    if (binding && !binding.progression && tree.practiceProgress?.[binding.key]?.exhausted) continue
    const segmented = usesFlowerSessions(t)
    const mathCanRefill = t.subject === 'math' && !segmented && binding?.progression?.enabled && binding.progression.mode !== 'homework' &&
      binding.rows.some(row => row.values.problemId)
    const first = dayOf(t.created_at) > tree.firstDay ? dayOf(t.created_at) : tree.firstDay
    for (let day = from; day <= through; day = shift(day, 1)) {
      if (t.subject === 'life' && (day !== tree.today || tree.steps.some(s =>
        s.occurrence.startsWith(t.id + '/') && s.scheduled === day && s.end))) continue
      if (day < first) continue
      const p = period(t, day)
      if (!p || day > p.end) continue
      if (usesWeeklyHomework(t)) {
        const occurrence = weeklyOccurrence(t.id, p.start)
        if (existing.has(occurrence) || day !== [p.start, first, from].sort().at(-1)) continue
        const step = createWeeklyHomework(t, p.start, p.end, day)
        if (isExhaustedPendingStep(tree, step)) continue
        existing.add(occurrence)
        tree.steps.push(step)
        continue
      }
      const offset = diff(day, p.start)
      const ordinal = Math.ceil(((offset + 1) * p.count) / p.span) - 1
      const windowStart = shift(p.start, Math.floor((ordinal * p.span) / p.count))
      if (day !== windowStart && day !== first && !(fillCurrentWindow && day === from)) continue
      const windowEnd = shift(p.start, Math.floor(((ordinal + 1) * p.span) / p.count) - 1)
      const occurrence = [t.id, t.cycle, p.start, ordinal].join('/')
      if (existing.has(occurrence)) continue
      const practice = binding?.progression ? calendarPractice(binding, day, occurrence) : undefined
      if (practice?.exhausted && !mathCanRefill) continue
      existing.add(occurrence)
      const parts =
        !segmented && t.subject !== 'life' && t.estimated_minutes > 60 ? [60, t.estimated_minutes - 60] : [t.estimated_minutes]
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
        if (segmented) planned = day
        if (planned && !practice?.exhausted) load.set(planned, (load.get(planned) ?? 0) + flowers)
        const step: WorkStep = {
          ...(segmented ? { flowers: { collected: 0, elapsedMs: 0, complete: false } } : {}),
          ...(practice ? { practice: structuredClone(practice) } : {}),
          id: occurrence + '/' + index,
          occurrence,
          practiceBindingKey: binding?.progression ? undefined : binding?.key,
          practiceEntryName: binding?.name,
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
          stages: Array.from({ length: segmented ? 0 : flowers }, () => 0),
          audit: [],
        }
        tree.steps.push(step)
      })
    }
  }
  for (const template of templates) planMathQuestions(tree, template)
  // A missed daily session stays a single pending bubble until the deadline.
  for (const step of tree.steps) {
    if (!step.flowers || step.start || step.end || step.skipped || !step.planned) continue
    if (step.planned < tree.today && tree.today <= step.deadline) step.planned = tree.today
    if (step.flowers.availableFrom && step.flowers.availableFrom > step.deadline &&
        step.planned === step.flowers.availableFrom && tree.today >= step.planned) step.planned = step.deadline
  }
}
