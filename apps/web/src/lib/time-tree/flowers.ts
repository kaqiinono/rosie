import type { StepPractice } from './practice'
import { dayOf, shift, type WorkStep } from './types'

export function flowerQuestionProgress(step: WorkStep,
  practice: Pick<StepPractice, 'items' | 'row' | 'exhausted'> | null | undefined = step.practice,
) {
  if (!step.flowers || !practice || practice.exhausted) return null
  const { items, row } = practice
  const rows = items?.length ? items.map(item => item.row) : row ? [row] : []
  const ids = new Set(rows.map(item => item.values.problemId).filter(Boolean))
  if (!ids.size) return null
  const answered = new Set(step.flowers.answered)
  const done = [...ids].filter(id => answered.has(id)).length
  return { ids, done, total: ids.size }
}

export function flowerBudget(step: WorkStep, now: number) {
  const current = step.start && !step.end ? Math.max(0, now - Date.parse(step.start)) : 0
  const elapsedMs = (step.flowers?.elapsedMs ?? 0) + current
  const suggested = Math.floor(elapsedMs / 600000)
  return { elapsedMs, suggested, slots: Math.max(Math.ceil(step.minutes / 10), suggested) }
}

/** Keep the same practice reservation and a separate, immutable daily receipt. */
export function nextFlowerSession(step: WorkStep): WorkStep {
  const day = shift(dayOf(step.end!), 1)
  const next = structuredClone(step)
  return {
    ...next, id: step.occurrence + '/session-' + day,
    flowers: { ...next.flowers!, availableFrom: day },
    scheduled: day, planned: day, start: null, end: null, settled: false,
    popped: false, slot: null, returned: null, stages: [], sun: 0, water: 0, audit: [],
  }
}
