import type { ProblemSet, Problem, MathPlanProblem, MathWeeklyPlanDay, ProblemMasteryMap, MathRotatingReviewState, PerLessonRotationState, MathWeeklyLessonReviewState } from './type'
import { ensureStageInit, isGraduated } from './masteryUtils'

export function problemKey(lessonId: string, problemId: string): string {
  return `${lessonId}::${problemId}`
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function makeProblem(
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
  const allWorkbookProbs = problemSet.workbook.map((p, i) => makeProblem(lessonId, 'workbook', p, i + 1))
  const pretestProbs = problemSet.pretest.map((p, i) => makeProblem(lessonId, 'pretest', p, i + 1))

  const required: MathPlanProblem[] = [
    ...lessonProbs,
    ...homeworkProbs,
    ...allWorkbookProbs.slice(0, 6),
    ...pretestProbs,
  ]
  const optional: MathPlanProblem[] = allWorkbookProbs.slice(6)

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

/**
 * Picks the best problem for "本周旧讲" review.
 * Selects the prior lesson with the lowest min(reviewCount), breaking ties by most recent lesson (highest ID).
 * Within that lesson, picks the problem with the lowest reviewCount.
 * Skips lessons with no problems.
 */
export function pickWeeklyLessonProblem(
  priorLessonProbs: Record<string, MathPlanProblem[]>,
  reviewCounts: MathWeeklyLessonReviewState['reviewCounts'],
  excludeKeys: Set<string> = new Set(),
): { lessonId: string; problem: MathPlanProblem } | null {
  const entries = Object.entries(priorLessonProbs)
    .map(([id, probs]) => [id, probs.filter(p => !excludeKeys.has(p.key))] as [string, MathPlanProblem[]])
    .filter(([, probs]) => probs.length > 0)
  if (entries.length === 0) return null

  // Compute min reviewCount per lesson (after exclusion)
  const lessonMins = entries.map(([id, probs]) => ({
    id,
    probs,
    min: Math.min(...probs.map(p => reviewCounts[p.key] ?? 0)),
  }))

  // Sort by (min asc, id desc): lowest coverage first, most recent lesson wins ties
  lessonMins.sort((a, b) => a.min - b.min || Number(b.id) - Number(a.id))

  const best = lessonMins[0]!
  // Within best lesson, pick the problem with the lowest reviewCount
  const problem = best.probs.reduce((acc, p) =>
    (reviewCounts[p.key] ?? 0) < (reviewCounts[acc.key] ?? 0) ? p : acc,
  )
  return { lessonId: best.id, problem }
}

function initialPerLesson(): PerLessonRotationState {
  return { nextKpIndex: 0, completedKpIndexes: [], phase: 'knowledge_points' }
}

/**
 * Picks `needed` problems from one lesson's problem list, advancing that lesson's rotation state.
 * Returns the picked keys and the updated per-lesson state.
 */
function pickFromLesson(
  ls: PerLessonRotationState,
  probs: MathPlanProblem[],
  masteryMap: ProblemMasteryMap,
  needed: number,
  alreadyAssigned: Set<string>,
): { assignedKeys: string[]; newLessonState: PerLessonRotationState } {
  const total = probs.length
  if (total === 0) return { assignedKeys: [], newLessonState: ls }

  if (ls.phase === 'knowledge_points') {
    const assignedIndexes: number[] = []
    for (let i = 0; i < total && assignedIndexes.length < needed; i++) {
      const candidate = (ls.nextKpIndex + i) % total
      if (!ls.completedKpIndexes.includes(candidate)) {
        assignedIndexes.push(candidate)
      }
    }
    const assignedKeys = assignedIndexes.map(i => probs[i]!.key)
    const newCompleted = [...ls.completedKpIndexes, ...assignedIndexes]

    let newLessonState: PerLessonRotationState
    if (newCompleted.length >= total) {
      const hasErrors = probs.some(p => (masteryMap[p.key]?.incorrect ?? 0) > 0)
      newLessonState = hasErrors
        ? { nextKpIndex: 0, completedKpIndexes: newCompleted, phase: 'error_bank' }
        : { nextKpIndex: 0, completedKpIndexes: [], phase: 'knowledge_points' }
    } else {
      let next = (ls.nextKpIndex + assignedIndexes.length) % total
      while (newCompleted.includes(next) && newCompleted.length < total) {
        next = (next + 1) % total
      }
      newLessonState = { ...ls, completedKpIndexes: newCompleted, nextKpIndex: next }
    }
    return { assignedKeys, newLessonState }
  }

  // error_bank phase: pick errors not yet assigned globally
  const assignedKeys = probs
    .filter(p => (masteryMap[p.key]?.incorrect ?? 0) > 0 && !alreadyAssigned.has(p.key))
    .slice(0, needed)
    .map(p => p.key)
  const remaining = probs.filter(
    p => (masteryMap[p.key]?.incorrect ?? 0) > 0 && !alreadyAssigned.has(p.key) && !assignedKeys.includes(p.key),
  )
  const newLessonState: PerLessonRotationState = remaining.length === 0
    ? { nextKpIndex: 0, completedKpIndexes: [], phase: 'knowledge_points' }
    : ls
  return { assignedKeys, newLessonState }
}

/**
 * Assigns review problems for a given date from the next lesson in rotation.
 * Idempotent: if already assigned, returns unchanged state.
 * State advances on assignment, not on completion.
 */
export function assignRotatingReviewForDay(
  state: MathRotatingReviewState,
  date: string,
  priorLessonProbs: Record<string, MathPlanProblem[]>,
  masteryMap: ProblemMasteryMap,
  requiredCount: number,
  problemsPerDay: number,
): { assignedKeys: string[]; newState: MathRotatingReviewState } {
  if (state.dailyAssignments[date]) {
    return { assignedKeys: state.dailyAssignments[date], newState: state }
  }

  const { lessonOrder, nextLessonIndex } = state
  if (lessonOrder.length === 0) return { assignedKeys: [], newState: state }

  const needed = Math.max(1, problemsPerDay - requiredCount)
  const lessonId = lessonOrder[nextLessonIndex % lessonOrder.length]
  const lessonProbs = priorLessonProbs[lessonId] ?? []
  const lessonState = state.perLesson[lessonId] ?? initialPerLesson()
  const alreadyAssigned = new Set(Object.values(state.dailyAssignments).flat())

  const { assignedKeys, newLessonState } = pickFromLesson(
    lessonState, lessonProbs, masteryMap, needed, alreadyAssigned,
  )

  const newState: MathRotatingReviewState = {
    ...state,
    nextLessonIndex: nextLessonIndex + 1,
    perLesson: { ...state.perLesson, [lessonId]: newLessonState },
    dailyAssignments: { ...state.dailyAssignments, [date]: assignedKeys },
  }
  return { assignedKeys, newState }
}
