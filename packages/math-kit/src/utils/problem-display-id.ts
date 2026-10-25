import type { Problem } from '@rosie/core'

/** Remove only a canonical or legacy lesson prefix; keep the entire question suffix. */
export function problemIdSuffix(problemId: string): string {
  return problemId.replace(/^\d+(?:-\d+)?-(?=[PLHWS]\d)/, '')
}

/** Business question number only. Always use problem.id for persistence and navigation. */
export function problemDisplayId(problem: Pick<Problem, 'id' | 'displayId'>): string {
  return problem.displayId ?? problemIdSuffix(problem.id)
}

/** Prefer an explicit number; otherwise omit the lesson prefix, preserving the full question suffix. */
export function problemCardDisplayId(problem: Pick<Problem, 'id' | 'displayId'>): string {
  return problem.displayId?.trim() || problemIdSuffix(problem.id)
}
