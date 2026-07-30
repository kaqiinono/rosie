import type { MathPlanProblem, ProblemSet, Problem } from '@rosie/core'
import type { PracticeQueueItem } from '@rosie/math/utils/practice-queue-types'
import { lessonByKey, routeForLesson } from '@rosie/math/utils/lesson-registry'

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

export function mathPlanProblemToQueueItem(
  mp: MathPlanProblem,
  problemSets: Record<string, ProblemSet>,
): PracticeQueueItem | null {
  const ps = problemSets[mp.lessonId]
  if (!ps) return null
  for (const section of SECTIONS) {
    const found = sectionProblems(ps, section).find((p) => p.id === mp.problemId)
    if (found) {
      return {
        problem: found,
        section: mp.section,
        lessonId: mp.lessonId,
        detailHref: detailHref(mp.lessonId, mp.section, mp.index),
      }
    }
  }
  return null
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
