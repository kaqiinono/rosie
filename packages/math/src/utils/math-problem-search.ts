import type { Problem } from '@rosie/core'
import { SEA_LESSONS } from '@rosie/math/utils/sea-data'
import { problemDisplayId } from '@rosie/math-kit/utils/problem-display-id'
import {
  enumerateProblemSet,
  problemSectionLabel,
  problemSetSourceButtons,
} from '@rosie/math-kit/utils/problem-set-helpers'

export type SearchableProblem = {
  problem: Problem
  lessonId: string
  lessonTitle: string
  setName: string
  sectionLabel: string
  /** Only a parent confirmed by the complete business number; never inferred from adjacency. */
  relatedExampleTitle?: string
}

export function buildProblemPool(lessonIds: string[]): SearchableProblem[] {
  const idSet = new Set(lessonIds)
  const pool: SearchableProblem[] = []
  for (const lesson of SEA_LESSONS) {
    if (!idSet.has(lesson.id)) continue
    const seenProblemIds = new Set<string>()
    for (const { problem, setName } of enumerateProblemSet(lesson.problems)) {
      if (seenProblemIds.has(problem.id)) continue
      seenProblemIds.add(problem.id)

      const parent = setName === 'lesson'
        ? problemDisplayId(problem).match(/^L([1-9]\d*)-[1-9]\d*[a-z]?$/)
        : null
      pool.push({
        problem,
        lessonId: lesson.id,
        lessonTitle: lesson.shortTitle,
        setName,
        sectionLabel: problemSectionLabel(problem.id, lesson.id),
        relatedExampleTitle: parent ? `例题${parent[1]}` : undefined,
      })
    }
  }
  return pool
}

export function filterProblemPool(
  pool: SearchableProblem[],
  sourceFilter: ReadonlySet<string>,
  typeFilter: ReadonlySet<string>,
): SearchableProblem[] {
  return pool.filter(
    (item) => sourceFilter.has(item.setName) && typeFilter.has(item.problem.tag),
  )
}

export function aggregateSourceButtons(lessonIds: string[]): { key: string; label: string }[] {
  const idSet = new Set(lessonIds)
  const labels = new Map<string, string>()
  for (const lesson of SEA_LESSONS) {
    if (!idSet.has(lesson.id)) continue
    for (const btn of problemSetSourceButtons(lesson.problems, lesson.id)) {
      if (!labels.has(btn.key)) labels.set(btn.key, btn.label)
    }
  }
  return [...labels.entries()].map(([key, label]) => ({ key, label }))
}

export function aggregateTypeButtons(
  lessonIds: string[],
): { key: string; label: string }[] {
  const idSet = new Set(lessonIds)
  const labels = new Map<string, string>()
  for (const lesson of SEA_LESSONS) {
    if (!idSet.has(lesson.id)) continue
    for (const t of lesson.types) {
      labels.set(t.tag, t.label)
    }
  }
  return [...labels.entries()].map(([key, label]) => ({ key, label }))
}

/**
 * Searches the complete supplied pool. Callers that render a type-ahead list may
 * opt into a limit, but administrative matching must retain every filtered item.
 */
export function searchProblems(
  pool: SearchableProblem[],
  query: string,
  limit?: number,
): SearchableProblem[] {
  const q = query.trim().toLowerCase()
  const results = q
    ? pool.filter(
        (item) =>
          item.problem.id.toLowerCase().includes(q) ||
          item.problem.title.toLowerCase().includes(q) ||
          item.problem.text.toLowerCase().includes(q) ||
          item.problem.tagLabel.toLowerCase().includes(q) ||
          item.sectionLabel.includes(q),
      )
    : pool

  return limit === undefined ? results : results.slice(0, limit)
}
