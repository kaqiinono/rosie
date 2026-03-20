import type { ProblemSet, Problem, MathPlanProblem, MathWeeklyPlanDay, ProblemMasteryMap } from './type'
import { ensureStageInit, isGraduated } from './masteryUtils'

export function problemKey(lessonId: string, problemId: string): string {
  return `${lessonId}::${problemId}`
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeProblem(
  lessonId: string,
  section: string,
  problem: Problem,
  index: number,
): MathPlanProblem {
  return {
    key: problemKey(lessonId, problem.id),
    lessonId,
    section,
    index,
    title: problem.title,
    problemId: problem.id,
  }
}

export function buildMathWeeklyPlan(
  lessonId: string,
  problemSet: ProblemSet,
  weekStart: string,
  problemsPerDay = 3,
): MathWeeklyPlanDay[] {
  const lessonProbs = problemSet.lesson.map((p, i) => makeProblem(lessonId, 'lesson', p, i + 1))
  const homeworkProbs = problemSet.homework.map((p, i) => makeProblem(lessonId, 'homework', p, i + 1))
  const pretestProbs = problemSet.pretest.map((p, i) => makeProblem(lessonId, 'pretest', p, i + 1))

  const required: MathPlanProblem[] = [
    ...lessonProbs,
    ...homeworkProbs,
    ...pretestProbs,
  ]
  const optional: MathPlanProblem[] = []

  // Distribute required problems across 7 days at problemsPerDay per day
  const [year, month, day] = weekStart.split('-').map(Number)
  const days: MathWeeklyPlanDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(year, month - 1, day + i)
    return {
      date: toLocalDateStr(d),
      problems: [],
      optionalProblems: [],
    }
  })

  required.forEach((prob, idx) => {
    const dayIdx = Math.min(Math.floor(idx / problemsPerDay), 6)
    days[dayIdx].problems.push(prob)
  })

  // Add optional problems to the last day that has required problems (or day 6)
  const lastFilledDay = Math.min(Math.floor((required.length - 1) / problemsPerDay), 6)
  days[lastFilledDay].optionalProblems = optional

  return days
}

export function getMathReviewProblemsForDay(
  today: string,
  allPriorKeys: string[],
  masteryMap: ProblemMasteryMap,
  thisWeekKeys: Set<string>,
  maxCount = 5,
): string[] {
  const candidates = allPriorKeys
    .filter(key => {
      if (thisWeekKeys.has(key)) return false
      const m = masteryMap[key]
      if (!m) return false
      if (isGraduated(m)) return false
      const initialized = ensureStageInit(m, today)
      const due = initialized.nextReviewDate ?? today
      return due <= today
    })
    .map(key => {
      const m = ensureStageInit(masteryMap[key]!, today)
      const overdueDays = Math.max(
        0,
        Math.floor((Date.parse(today) - Date.parse(m.nextReviewDate ?? today)) / 86400000),
      )
      return { key, overdueDays, stage: m.stage ?? 0 }
    })
    .sort((a, b) => b.overdueDays - a.overdueDays || a.stage - b.stage)
    .slice(0, maxCount)
    .map(({ key }) => key)

  return candidates
}
