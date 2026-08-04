/**
 * Math plan has two entry modes:
 * - Hub `/math/ny/plan` (`autoStart=false`) — overview only; never auto-enter practice.
 * - Practice `/math/ny/plan/practice` (`autoStart=true`) — resume `queue:plan` stash
 *   or start today's first undone required problem.
 *
 * Plan mid-exit lives in scope `queue:plan` only — sea/lesson/mistakes use other scopes.
 */
export const MATH_PLAN_HUB_HREF = '/math/ny/plan'
export const MATH_PLAN_PRACTICE_HREF = '/math/ny/plan/practice'

export function canAutoEnterMathPlanPractice(autoStart: boolean): boolean {
  return autoStart
}

/** Exit target after any queue started or resumed from the plan entry. */
export function mathPlanPracticeReturnHref(): string {
  return MATH_PLAN_HUB_HREF
}
