import type { Problem } from '@rosie/core'
import { lessonKeyFromProblemId } from './lesson-registry'

export const MATH_VIDEO_DIRECTORY = '/airosie/math/ny'

export function isProblemVideoKey(key: string): boolean {
  return /^\d+-\d+-[A-Za-z0-9][A-Za-z0-9-]{0,79}$/.test(key)
}

export function problemVideoPath(key: string): string | null {
  return isProblemVideoKey(key) ? `${MATH_VIDEO_DIRECTORY}/${key}.mp4` : null
}

/** Video names follow business numbering; routes and progress still use real IDs. */
export function problemVideoKey(problem: Pick<Problem, 'id' | 'displayId'>): string | null {
  const lessonKey = lessonKeyFromProblemId(problem.id)
  if (!lessonKey) return null
  const displayId = problem.displayId?.trim()
  const key = displayId ? `${lessonKey}-${displayId}` : problem.id
  return isProblemVideoKey(key) ? key : null
}
