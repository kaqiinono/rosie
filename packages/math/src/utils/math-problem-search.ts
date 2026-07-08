import type { Problem } from '@rosie/core'
import { SEA_LESSONS } from '@rosie/math/utils/sea-data'
import { resolveLesson } from '@rosie/math/utils/lesson-registry'
import {
  enumerateProblemSet,
  problemSectionLabel,
  problemSetSourceButtons,
} from '@rosie/math/utils/problem-set-helpers'

/**
 * Canonicalize a lesson id (lessonKey 或 legacyId) 为 lessonKey，未登记时原样返回。
 * 迁移期 SEA_LESSONS[].id 仍为 legacyId，而筛选器传入 lessonKey，需两侧归一后再比较。
 */
function canonicalLessonId(id: string): string {
  return resolveLesson(id)?.lessonKey ?? id
}
export type SearchableProblem = {
  problem: Problem
  lessonId: string
  lessonTitle: string
  setName: string
  sectionLabel: string
}

export function buildProblemPool(lessonIds: string[]): SearchableProblem[] {
  const idSet = new Set(lessonIds.map(canonicalLessonId))
  const pool: SearchableProblem[] = []
  for (const lesson of SEA_LESSONS) {
    if (!idSet.has(canonicalLessonId(lesson.id))) continue
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
  const idSet = new Set(lessonIds.map(canonicalLessonId))
  const labels = new Map<string, string>()
  for (const lesson of SEA_LESSONS) {
    if (!idSet.has(canonicalLessonId(lesson.id))) continue
    for (const btn of problemSetSourceButtons(lesson.problems, lesson.id)) {
      if (!labels.has(btn.key)) labels.set(btn.key, btn.label)
    }
  }
  return [...labels.entries()].map(([key, label]) => ({ key, label }))
}

export function aggregateTypeButtons(
  lessonIds: string[],
): { key: string; label: string }[] {
  const idSet = new Set(lessonIds.map(canonicalLessonId))
  const labels = new Map<string, string>()
  for (const lesson of SEA_LESSONS) {
    if (!idSet.has(canonicalLessonId(lesson.id))) continue
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
