import type { Problem } from '@rosie/core'
import { lessonKeyFromProblemId } from './lesson-registry'

/** Video names follow business numbering; routes and progress still use real IDs. */
export function problemVideoKey(problem: Pick<Problem, 'id' | 'displayId'>): string | null {
  const lessonKey = lessonKeyFromProblemId(problem.id)
  if (!lessonKey) return null
  const displayId = problem.displayId?.trim()
  const key = displayId ? `${lessonKey}-${displayId}` : problem.id
  return /^\d+-\d+-[A-Za-z0-9][A-Za-z0-9-]{0,79}$/.test(key) ? key : null
}
