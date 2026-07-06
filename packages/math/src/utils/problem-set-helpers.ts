import type { Problem, ProblemSet } from '@rosie/core'
import { SOURCE_LABELS } from '@rosie/core'
import { lessonSourceButtons } from '@rosie/math/utils/lesson-source-btns'

const SOURCE_ORDER = ['pretest', 'lesson', 'homework', 'workbook', 'supplement'] as const

export type ProblemWithSource = { problem: Problem; setName: string }

export function setNameFromProblemId(problemId: string): string | null {
  const suffix = problemId.split('-')[1] ?? ''
  if (suffix.startsWith('P')) return 'pretest'
  if (suffix.startsWith('L')) return 'lesson'
  if (suffix.startsWith('H')) return 'homework'
  if (suffix.startsWith('W')) return 'workbook'
  if (suffix.startsWith('S')) return 'supplement'
  return null
}

/** Strip leading emoji from a filter button label (e.g. "📒 附加题" → "附加题"). */
export function labelText(fullLabel: string): string {
  const space = fullLabel.indexOf(' ')
  return space >= 0 ? fullLabel.slice(space + 1) : fullLabel
}

/** Enumerate all problems with their ProblemSet section key. */
export function enumerateProblemSet(problems: ProblemSet): ProblemWithSource[] {
  const result: ProblemWithSource[] = []
  for (const setName of SOURCE_ORDER) {
    const list = problems[setName]
    if (!list?.length) continue
    for (const problem of list) {
      result.push({ problem, setName })
    }
  }
  return result
}

/** Source filter buttons for non-empty sections, using the lesson's FilterPanel labels. */
export function problemSetSourceButtons(
  problems: ProblemSet,
  lessonId: string,
): { key: string; label: string }[] {
  const btns = lessonSourceButtons(lessonId)
  if (btns) {
    return btns.filter((btn) => (problems[btn.key as keyof ProblemSet]?.length ?? 0) > 0)
  }
  return SOURCE_ORDER.filter((key) => (problems[key]?.length ?? 0) > 0).map((key) => ({
    key,
    label: SOURCE_LABELS[key] ?? key,
  }))
}

/** Flatten all sections of a lesson problem bank into one list. */
export function flattenProblemSet(problems: ProblemSet): Problem[] {
  return enumerateProblemSet(problems).map(({ problem }) => problem)
}

/** Section label for a ProblemSet key — uses the lesson's FilterPanel source button text when available. */
export function problemSetSectionLabel(setName: string, lessonId?: string): string {
  if (lessonId) {
    const btn = lessonSourceButtons(lessonId)?.find((b) => b.key === setName)
    if (btn) return btn.label
  }
  const fallback = SOURCE_LABELS[setName]
  return fallback ?? setName
}

/** Section label for admin UI — derived from the lesson's source button text. */
export function problemSectionLabel(problemId: string, lessonId?: string): string {
  const setName = setNameFromProblemId(problemId)
  if (!setName) return '题目'
  if (lessonId) {
    const btn = lessonSourceButtons(lessonId)?.find((b) => b.key === setName)
    if (btn) return labelText(btn.label)
  }
  const fallback = SOURCE_LABELS[setName]
  return fallback ? labelText(fallback) : '题目'
}
