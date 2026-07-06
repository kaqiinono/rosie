import type { Problem } from '@rosie/core'
import { SEA_LESSONS } from '@rosie/math/utils/sea-data'
import {
  enumerateProblemSet,
  problemSectionLabel,
  problemSetSourceButtons,
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
        sectionLabel: problemSectionLabel(problem.id, lesson.id),
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
  const labels = new Map<string, string>()
  for (const id of lessonIds) {
    const lesson = SEA_LESSONS.find((l) => l.id === id)
    if (!lesson) continue
    for (const btn of problemSetSourceButtons(lesson.problems, lesson.id)) {
      if (!labels.has(btn.key)) labels.set(btn.key, btn.label)
    }
  }
  return [...labels.entries()].map(([key, label]) => ({ key, label }))
}

export function aggregateTypeButtons(
  lessonIds: string[],
): { key: string; label: string }[] {
  const labels = new Map<string, string>()
  for (const lesson of SEA_LESSONS) {
    if (!lessonIds.includes(lesson.id)) continue
    for (const t of lesson.types) {
      labels.set(t.tag, t.label)
    }
  }
  return [...labels.entries()].map(([key, label]) => ({ key, label }))
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
