/**
 * Math plan has two entry modes:
 * - Hub `/math/ny/plan` (`autoStart=false`) — overview only; never auto-enter practice.
 * - Practice `/math/ny/plan/practice` (`autoStart=true`) — resume `queue:plan` stash
 *   or start today's first undone required problem.
 *
 * Plan mid-exit lives in scope `queue:plan` only — sea/lesson/mistakes use other scopes.
 */
import { todayStr } from '@rosie/core'
import type { MathPracticeSnapshot } from '@rosie/math/utils/practice-queue-snapshot'

export const MATH_PLAN_HUB_HREF = '/math/ny/plan'
export const MATH_PLAN_PRACTICE_HREF = '/math/ny/plan/practice'

export function canAutoEnterMathPlanPractice(autoStart: boolean): boolean {
  return autoStart
}

/** Exit target after any queue started or resumed from the plan entry. */
export function mathPlanPracticeReturnHref(): string {
  return MATH_PLAN_HUB_HREF
}

/**
 * Resume only same-day plan queues whose problem set still matches today's required list.
 * Cross-day stashes (or overnight sessions whose date was refreshed but items are stale)
 * must not jump the child to「第 3 题」of yesterday's run.
 */
export function isResumablePlanPracticeSnapshot(
  snap: MathPracticeSnapshot,
  todayProblemIds: string[],
  today = todayStr(),
): boolean {
  if (snap.date !== today) return false
  if (todayProblemIds.length === 0) return false
  if (snap.items.length !== todayProblemIds.length) return false
  const todaySet = new Set(todayProblemIds)
  return snap.items.every((item) => todaySet.has(item.problemId))
}
