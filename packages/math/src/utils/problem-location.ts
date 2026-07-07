import type { Problem, ProblemSet } from '@rosie/core'
import { lessonSourceButtons } from '@rosie/math/utils/lesson-source-btns'
import { MATH_PLAN_SECTIONS } from '@rosie/math/utils/math-helpers'

const SECTION_KEYS = ['pretest', 'lesson', 'homework', 'workbook', 'supplement'] as const

export type ProblemLocation = {
  section: string
  index: number
  problem: Problem
}

export function findProblemInSet(problems: ProblemSet, problemId: string): ProblemLocation | null {
  for (const section of SECTION_KEYS) {
    const list = section === 'supplement' ? problems.supplement ?? [] : problems[section]
    const index = list.findIndex((p) => p.id === problemId)
    if (index >= 0) return { section, index, problem: list[index]! }
  }
  return null
}

export function problemDetailHref(base: string, section: string, indexInSet: number): string {
  return `${base}/${section}/${indexInSet + 1}`
}

export function sectionSourceLabel(lessonId: string, section: string): string {
  const found = lessonSourceButtons(lessonId)?.find((b) => b.key === section)
  if (found) return found.label
  return MATH_PLAN_SECTIONS.find((s) => s.key === section)?.label ?? section
}
