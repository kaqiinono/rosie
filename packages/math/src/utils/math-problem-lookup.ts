import { SOURCE_LABELS } from '@rosie/core'
import { SEA_LESSONS, SEA_POOL } from './sea-data'

export type MathProblemLookup = {
  problemId: string
  title: string
  lessonId: string
  section: string
  href: string
  lessonLabel: string
  sectionLabel: string
}

const LESSON_TITLE = new Map(SEA_LESSONS.map(l => [l.id, l.shortTitle]))

export const MATH_PROBLEM_BY_ID = new Map<string, MathProblemLookup>(
  SEA_POOL.map(({ problem, lessonId, section, href }) => [
    problem.id,
    {
      problemId: problem.id,
      title: problem.title,
      lessonId,
      section,
      href,
      lessonLabel: LESSON_TITLE.get(lessonId) ?? `第${lessonId}讲`,
      sectionLabel: SOURCE_LABELS[section] ?? section,
    },
  ]),
)
