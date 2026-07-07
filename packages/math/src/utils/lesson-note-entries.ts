import type { ProblemSet } from '@rosie/core'
import { isLessonSummaryProblemId } from '@rosie/math/constants'
import type { MathProblemNote } from '@rosie/math/hooks/useMathProblemNotes'
import {
  findProblemInSet,
  problemDetailHref,
  sectionSourceLabel,
} from '@rosie/math/utils/problem-location'

export type LessonNoteEntry = {
  note: MathProblemNote
  href: string | null
  sourceLabel: string | null
  problemTitle: string
}

export function buildLessonNoteEntries(
  notes: MathProblemNote[],
  lessonId: string,
  base: string,
  problems: ProblemSet,
): LessonNoteEntry[] {
  return notes
    .filter((note) => !isLessonSummaryProblemId(note.problemId))
    .map((note) => {
      const loc = findProblemInSet(problems, note.problemId)
      if (!loc) {
        return {
          note,
          href: null,
          sourceLabel: null,
          problemTitle: note.problemId,
        }
      }
      return {
        note,
        href: problemDetailHref(base, loc.section, loc.index),
        sourceLabel: sectionSourceLabel(lessonId, loc.section),
        problemTitle: loc.problem.title,
      }
    })
}
