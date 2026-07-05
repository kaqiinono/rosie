import type { Problem } from '@rosie/core'
import { SEA_LESSONS } from '@rosie/math/utils/sea-data'
import {
  enumerateProblemSet,
  problemSectionLabel,
} from '@rosie/math/utils/problem-set-helpers'

export type SearchableProblem = {
  problem: Problem
  lessonId: string
  lessonTitle: string
  setName: string
  sectionLabel: string
}

export function buildProblemPool(lessonIds: string[]): SearchableProblem[] {
  const idSet = new Set(lessonIds)
  const pool: SearchableProblem[] = []
  for (const lesson of SEA_LESSONS) {
    if (!idSet.has(lesson.id)) continue
    for (const { problem, setName } of enumerateProblemSet(lesson.problems)) {
      pool.push({
        problem,
        lessonId: lesson.id,
        lessonTitle: lesson.shortTitle,
        setName,
        sectionLabel: problemSectionLabel(problem.id),
      })
    }
  }
  return pool
}

export function searchProblems(pool: SearchableProblem[], query: string, limit = 40): SearchableProblem[] {
  const q = query.trim().toLowerCase()
  if (!q) return pool.slice(0, limit)
  return pool
    .filter(
      (item) =>
        item.problem.id.toLowerCase().includes(q) ||
        item.problem.title.toLowerCase().includes(q) ||
        item.problem.text.toLowerCase().includes(q) ||
        item.problem.tagLabel.toLowerCase().includes(q) ||
        item.sectionLabel.includes(q),
    )
    .slice(0, limit)
}
