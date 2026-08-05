import type { MathPlanProblem, ProblemSet, Problem } from '@rosie/core'
import type { PracticeQueueItem } from '@rosie/math-kit/utils/practice-queue-types'
import type { MathPracticeQueueItemRef } from '@rosie/math-kit/utils/practice-queue-snapshot'
import { lessonByKey, routeForLesson } from '@rosie/math-kit/utils/lesson-registry'

const SECTIONS = ['lesson', 'homework', 'pretest', 'workbook', 'supplement'] as const

function sectionProblems(ps: ProblemSet, section: (typeof SECTIONS)[number]): Problem[] {
  if (section === 'supplement') return ps.supplement ?? []
  return ps[section]
}

function detailHref(lessonId: string, section: string, index: number): string {
  const entry = lessonByKey(lessonId)
  const base = entry ? routeForLesson(entry) : `/math/ny/${lessonId}`
  return `${base}/${section}/${index}`
}

export function findProblemInSets(
  problemSets: Record<string, ProblemSet>,
  lessonId: string,
  problemId: string,
): { problem: Problem; section: string; index: number } | null {
  const ps = problemSets[lessonId]
  if (!ps) return null
  for (const section of SECTIONS) {
    const list = sectionProblems(ps, section)
    const index = list.findIndex((p) => p.id === problemId)
    if (index >= 0) return { problem: list[index], section, index }
  }
  return null
}

/** Resolve a stored plan row to the live Problem (for draft pad / practice). */
export function resolveMathPlanProblem(
  mp: MathPlanProblem,
  problemSets: Record<string, ProblemSet>,
): Problem | null {
  const direct = findProblemInSets(problemSets, mp.lessonId, mp.problemId)?.problem
  if (direct) return direct
  // Lesson id on the plan row can lag renames — fall back to scanning by problem id.
  for (const lessonId of Object.keys(problemSets)) {
    if (lessonId === mp.lessonId) continue
    const hit = findProblemInSets(problemSets, lessonId, mp.problemId)?.problem
    if (hit) return hit
  }
  return null
}

export function mathPlanProblemToQueueItem(
  mp: MathPlanProblem,
  problemSets: Record<string, ProblemSet>,
): PracticeQueueItem | null {
  const found = findProblemInSets(problemSets, mp.lessonId, mp.problemId)
  if (!found) return null
  return {
    problem: found.problem,
    section: mp.section,
    lessonId: mp.lessonId,
    detailHref: detailHref(mp.lessonId, found.section, found.index),
  }
}

export function mathPlanProblemsToQueueItems(
  problems: MathPlanProblem[],
  problemSets: Record<string, ProblemSet>,
): PracticeQueueItem[] {
  const items: PracticeQueueItem[] = []
  const seen = new Set<string>()
  for (const mp of problems) {
    const item = mathPlanProblemToQueueItem(mp, problemSets)
    if (!item || seen.has(item.problem.id)) continue
    seen.add(item.problem.id)
    items.push(item)
  }
  return items
}

/** Rebuild queue items from a sessionStorage snapshot (problem refs only). */
export function rehydratePracticeQueueItems(
  refs: MathPracticeQueueItemRef[],
  problemSets: Record<string, ProblemSet>,
): PracticeQueueItem[] {
  const items: PracticeQueueItem[] = []
  for (const ref of refs) {
    const found = findProblemInSets(problemSets, ref.lessonId, ref.problemId)
    if (!found) continue
    items.push({
      problem: found.problem,
      section: ref.section || found.section,
      lessonId: ref.lessonId,
      detailHref: ref.detailHref || detailHref(ref.lessonId, found.section, found.index),
    })
  }
  return items
}
