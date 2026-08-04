/**
 * Math plan has two entry modes:
 * - Hub `/math/ny/plan` (`autoStart=false`) — overview only; never auto-enter practice.
 * - Practice `/math/ny/plan/practice` (`autoStart=true`) — resume mid-exit stash or start today's first undone.
 *
 * Mid-exit returnHref points at the hub; without this gate, leaving practice immediately
 * resumes the same stash and looks like "plan always jumps into practice".
 */
export function canAutoEnterMathPlanPractice(autoStart: boolean): boolean {
  return autoStart
}
