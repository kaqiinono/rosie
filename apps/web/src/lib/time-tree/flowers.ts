import { WEEKLY_HOMEWORK_ORDINAL } from '@rosie/tasks'
import type { StepPractice } from './practice'
import { dayOf, shift, type WorkStep } from './types'

export const MINUTES_PER_FLOWER = 10

export function weeklyHomeworkStart(step: WorkStep): string | undefined {
  const [, cycle, start, ordinal] = step.occurrence.split('/')
  if (cycle === 'weekly' && ordinal === WEEKLY_HOMEWORK_ORDINAL) return start
}

/** A flexible weekly goal has its own progress and no fixed daily minute allocation. */
export function dayPlanMinutes(step: WorkStep) {
  return weeklyHomeworkStart(step) ? 0 : step.minutes
}

export function isWeeklyPartialReceipt(step: WorkStep) {
  return !!weeklyHomeworkStart(step) && !!step.end && !!step.flowers && !step.flowers.complete
}

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
  const plannedSlots = Math.ceil(step.minutes / MINUTES_PER_FLOWER)
  const suggested = Math.floor(elapsedMs / (MINUTES_PER_FLOWER * 60_000))
  if (weeklyHomeworkStart(step)) return { elapsedMs, suggested: Math.min(plannedSlots, suggested), slots: plannedSlots }
  return { elapsedMs, suggested, slots: Math.max(plannedSlots, suggested) }
}

/** Keep the same practice reservation and a separate, immutable daily receipt. */
export function nextFlowerSession(step: WorkStep, today: string, sessionNumber: number): WorkStep {
  const weekly = !!weeklyHomeworkStart(step)
  const day = shift(dayOf(step.end!), weekly ? 0 : 1)
  const planned = weekly ? (today > step.deadline ? step.deadline : today) : day
  const next = structuredClone(step)
  return {
    ...next, id: step.occurrence + '/session-' + day + (weekly ? '-' + sessionNumber : ''),
    flowers: { ...next.flowers!, availableFrom: day },
    scheduled: day, planned, start: null, end: null, settled: false,
    popped: false, slot: null, returned: null, stages: [], sun: 0, water: 0, audit: [],
  }
}
