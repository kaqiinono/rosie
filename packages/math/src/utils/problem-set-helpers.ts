import type { Problem, ProblemSet } from '@rosie/core'
import { SOURCE_LABELS } from '@rosie/core'

const SOURCE_ORDER = ['pretest', 'lesson', 'homework', 'workbook', 'supplement'] as const

export type ProblemWithSource = { problem: Problem; setName: string }

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

/** Source filter buttons for non-empty sections in a problem bank. */
export function problemSetSourceButtons(problems: ProblemSet): { key: string; label: string }[] {
  return SOURCE_ORDER
    .filter((key) => (problems[key]?.length ?? 0) > 0)
    .map((key) => ({ key, label: SOURCE_LABELS[key] ?? key }))
}

/** Flatten all sections of a lesson problem bank into one list. */
export function flattenProblemSet(problems: ProblemSet): Problem[] {
  return enumerateProblemSet(problems).map(({ problem }) => problem)
}

/** Section label for admin UI. */
export function problemSectionLabel(problemId: string): string {
  const suffix = problemId.split('-')[1] ?? ''
  if (suffix.startsWith('P')) return '课前测'
  if (suffix.startsWith('L')) return '例题'
  if (suffix.startsWith('H')) return '作业'
  if (suffix.startsWith('W')) return '练习册'
  if (suffix.startsWith('S')) return '补充'
  return '题目'
}
