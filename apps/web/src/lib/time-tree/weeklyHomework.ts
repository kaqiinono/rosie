import { homeworkPeriod, WEEKLY_HOMEWORK_ORDINAL, type Homework } from '@rosie/tasks'
import { MINUTES_PER_FLOWER } from './flowers'
import { calendarPractice, type StepPractice } from './practice'
import { dayOf, WEEKLY_SCHEDULE_VERSION, type TreeData, type WorkStep } from './types'

export function weeklyOccurrence(templateId: string, start: string) {
  return [templateId, 'weekly', start, WEEKLY_HOMEWORK_ORDINAL].join('/')
}

export function usesWeeklyHomework(template: Homework) {
  return template.cycle === 'weekly' && template.subject !== 'life'
}

export function createWeeklyHomework(template: Homework, start: string, end: string, planned: string): WorkStep {
  const occurrence = weeklyOccurrence(template.id, start)
  const binding = template.practice_binding
  return {
    id: occurrence + '/0',
    occurrence,
    name: template.name,
    notes: template.notes,
    subject: template.subject,
    priority: template.priority,
    minutes: template.estimated_minutes,
    scheduled: planned,
    planned,
    deadline: end,
    start: null,
    end: null,
    settled: false,
    popped: false,
    slot: null,
    returned: null,
    sun: 0,
    water: 0,
    stages: [],
    audit: [],
    flowers: { collected: 0, elapsedMs: 0, complete: false },
    practiceBindingKey: binding?.progression ? undefined : binding?.key,
    practiceEntryName: binding?.name,
    practice: binding?.progression ? calendarPractice(binding, start, occurrence) : undefined,
  }
}

function practiceItems(practice: StepPractice | null | undefined) {
  if (!practice) return []
  return practice.items?.length ? practice.items : practice.row && practice.href ? [{ row: practice.row, href: practice.href }] : []
}

function mergeWeekPractice(week: WorkStep, peers: WorkStep[], base: WorkStep | undefined, template: Homework) {
  const binding = template.practice_binding
  if (!binding?.progression?.enabled || binding.progression.mode !== 'homework') {
    if (base && (base.start || base.flowers?.availableFrom) && base.practice !== undefined) return base.practice
    return week.practice
  }
  const practice = week.practice ?? base?.practice
  if (!practice) return practice
  const items = new Map(practiceItems(practice).map(item => [item.row.id, item]))
  for (const peer of peers) {
    for (const item of practiceItems(peer.practice)) items.set(item.row.id, item)
  }
  const rows = [...items.values()]
  if (!rows.length) return practice
  return { ...practice, items: rows, row: rows[0].row, href: rows[0].href, exhausted: false }
}

/** Preserve the receipts that already paid rewards, then consolidate only the remaining work. */
export function syncWeeklyHomework(tree: TreeData, templates: Homework[]) {
  const byId = new Map(templates.filter(usesWeeklyHomework).map(template => [template.id, template]))
  const weeks = new Map<string, { template: Homework; start: string; end: string; count: number; peers: WorkStep[] }>()
  const existing = new Set(tree.steps.map(step => step.occurrence))
  for (const step of tree.steps) {
    const [id, cycle, start, ordinal] = step.occurrence.split('/')
    const template = byId.get(id)
    if (!template || cycle !== 'weekly' || !start || !/^\d+$/.test(ordinal ?? '')) continue
    const occurrence = weeklyOccurrence(id, start)
    if (existing.has(occurrence)) continue
    const period = homeworkPeriod(template, start)
    if (!period || period.start !== start || period.end < tree.today) continue
    const week = weeks.get(occurrence) ?? { template, start, end: period.end, count: period.count, peers: [] }
    week.peers.push(step)
    weeks.set(occurrence, week)
  }

  const replaced = new Set<string>()
  const consolidated: WorkStep[] = []
  for (const [occurrence, { template, start, end, count, peers }] of weeks) {
    const pending = peers.filter(step => !step.end && !step.skipped)
    const resolved = new Set(peers.filter(step => step.skipped || step.end && (!step.flowers || step.flowers.complete))
      .map(step => step.occurrence))
    if (!pending.length && resolved.size >= count) continue
    const base = pending.find(step => step.start) ??
      pending.find(step => step.flowers?.availableFrom) ??
      pending.find(step => step.planned && step.planned !== step.scheduled)
    const available = [start, tree.today, tree.firstDay, dayOf(template.created_at)].sort().at(-1)!
    if (available > end) continue
    const week = createWeeklyHomework(template, start, end, available)
    if (base) {
      week.id = base.id
      week.planned = base.planned ?? available
      week.start = base.start
      week.audit = base.audit
      week.returned = base.returned
    }
    week.planNote = [...new Set(pending.map(step => step.planNote).filter(Boolean))].join('\n') || undefined
    week.practice = mergeWeekPractice(week, peers, base, template)
    const receipts = peers.filter(step => step.end)
    const collected = receipts.reduce((total, step) => total + step.stages.length, 0)
    const elapsedMs = receipts.reduce((total, step) =>
      total + (step.start ? Math.max(0, Date.parse(step.end!) - Date.parse(step.start)) : 0), 0)
    const answered = new Set<string>()
    for (const step of peers) {
      for (const id of step.flowers?.answered ?? []) answered.add(id)
      const completed = new Set(step.practice?.questions?.completed)
      for (const { row } of practiceItems(step.practice)) {
        if (completed.has(row.id) && row.values.problemId) answered.add(row.values.problemId)
      }
    }
    week.flowers = {
      collected: Math.min(collected, Math.ceil(week.minutes / MINUTES_PER_FLOWER)),
      elapsedMs,
      complete: false,
      ...(answered.size ? { answered: [...answered] } : null),
      ...(receipts.length ? { availableFrom: available } : null),
    }
    const previousKeys = new Set(peers.map(step => step.occurrence))
    for (const [key, cursor] of Object.entries(tree.practiceProgress ?? {})) {
      if (cursor.activeOccurrence && previousKeys.has(cursor.activeOccurrence)) {
        cursor.activeOccurrence = week.practice?.key === key && !week.practice.calendarBased ? occurrence : null
      }
    }
    for (const step of pending) replaced.add(step.id)
    consolidated.push(week)
  }
  if (consolidated.length)
    tree.steps = [...tree.steps.filter(step => !replaced.has(step.id)), ...consolidated]
  tree.weeklyScheduleVersion = WEEKLY_SCHEDULE_VERSION
}
