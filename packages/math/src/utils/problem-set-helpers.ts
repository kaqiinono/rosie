import type { Problem, ProblemSet } from '@rosie/core'

/** Flatten all sections of a lesson problem bank into one list. */
export function flattenProblemSet(problems: ProblemSet): Problem[] {
  return [
    ...problems.pretest,
    ...problems.lesson,
    ...problems.homework,
    ...problems.workbook,
    ...(problems.supplement ?? []),
  ]
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
