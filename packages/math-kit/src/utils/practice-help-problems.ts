import type { Problem, ProblemSet } from '@rosie/core'
import type { PracticeHelpProblem } from '@rosie/math-kit/utils/practice-queue-types'

const HELP_SECTION_ORDER = ['lesson', 'homework', 'pretest', 'workbook', 'supplement'] as const

function sectionProblems(
  problemSet: ProblemSet,
  section: (typeof HELP_SECTION_ORDER)[number],
): Problem[] {
  if (section === 'supplement') return problemSet.supplement ?? []
  return problemSet[section]
}

/** Same lesson + exact tag; excludes the current problem and favors classroom examples. */
export function findHelpProblems(
  problemSet: ProblemSet,
  current: Problem,
): PracticeHelpProblem[] {
  return HELP_SECTION_ORDER.flatMap((section, sectionOrder) =>
    sectionProblems(problemSet, section).map((problem, problemOrder) => ({
      problem,
      section,
      sectionOrder,
      problemOrder,
    })),
  )
    .filter(({ problem }) => problem.id !== current.id && problem.tag === current.tag)
    .sort((a, b) => {
      if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder
      const screenshotOrder =
        Number(Boolean(b.problem.analysisImg)) - Number(Boolean(a.problem.analysisImg))
      if (screenshotOrder !== 0) return screenshotOrder
      const difficultyOrder =
        Math.abs(a.problem.difficulty - current.difficulty) -
        Math.abs(b.problem.difficulty - current.difficulty)
      if (difficultyOrder !== 0) return difficultyOrder
      return a.problemOrder - b.problemOrder
    })
    .map(({ problem, section }) => ({ problem, section }))
}
