import { SOURCE_LABELS } from '@rosie/core'
import {
  LEGACY_TO_LESSON_KEY,
  migrateProblemIdForAudit,
} from '@rosie/math/admin/legacy-migration-map'
import { SEA_LESSONS, SEA_POOL } from './sea-data'

export type MathProblemLookup = {
  problemId: string
  title: string
  lessonId: string
  section: string
  href: string
  lessonLabel: string
  sectionLabel: string
}

const LESSON_TITLE = new Map(SEA_LESSONS.map(l => [l.id, l.shortTitle]))

function toLookup(
  problemId: string,
  title: string,
  lessonId: string,
  section: string,
  href: string,
): MathProblemLookup {
  return {
    problemId,
    title,
    lessonId,
    section,
    href,
    lessonLabel: LESSON_TITLE.get(lessonId) ?? `第${lessonId}讲`,
    sectionLabel: SOURCE_LABELS[section] ?? section,
  }
}

export const MATH_PROBLEM_BY_ID = new Map<string, MathProblemLookup>(
  SEA_POOL.map(({ problem, lessonId, section, href }) => [
    problem.id,
    toLookup(problem.id, problem.title, lessonId, section, href),
  ]),
)

/** Resolve a stored problem_id to display metadata (handles legacy / shortened IDs). */
export function lookupMathProblem(problemId: string): MathProblemLookup | undefined {
  const direct = MATH_PROBLEM_BY_ID.get(problemId)
  if (direct) return direct

  const migrated = migrateProblemIdForAudit(problemId)
  if (migrated) {
    const hit = MATH_PROBLEM_BY_ID.get(migrated)
    if (hit) return hit
  }

  const parts = problemId.split('-')
  if (parts.length >= 3 && /^\d+$/.test(parts[0]!) && /^\d+$/.test(parts[1]!)) {
    const lessonKey = `${parts[0]}-${parts[1]}`
    const shortId = parts.slice(2).join('-')
    const short = MATH_PROBLEM_BY_ID.get(shortId)
    if (short?.lessonId === lessonKey) return short
  }

  const legacyPrefix = parts[0]!
  const lessonKey = LEGACY_TO_LESSON_KEY[legacyPrefix]
  if (lessonKey && parts.length >= 2) {
    const shortId = parts.slice(1).join('-')
    const short = MATH_PROBLEM_BY_ID.get(shortId)
    if (short?.lessonId === lessonKey) return short
  }

  return undefined
}
