import { SEA_POOL } from './sea-data'
import { gradeOf } from './lesson-grade'

export type GradeProblemStats = {
  total: number
  practiced: number
}

function buildProblemIdsByGrade(): Record<number, string[]> {
  const sets: Record<number, Set<string>> = {}
  for (const { problem, lessonId } of SEA_POOL) {
    const grade = gradeOf(lessonId)
    if (grade === undefined) continue
    if (!sets[grade]) sets[grade] = new Set()
    sets[grade].add(problem.id)
  }
  const result: Record<number, string[]> = {}
  for (const [grade, ids] of Object.entries(sets)) {
    result[Number(grade)] = [...ids]
  }
  return result
}

/** 各年级全部题目 id（与题海题库一致，模块加载时预计算）。 */
export const GRADE_PROBLEM_IDS = buildProblemIdsByGrade()

const ALL_MATH_PROBLEM_IDS = [...new Set(Object.values(GRADE_PROBLEM_IDS).flat())]

/** 全模块数学题目总数与已练数（solve_count ≥ 1 计为已练）。 */
export function allMathProblemStats(solveCount: Record<string, number>): GradeProblemStats {
  let practiced = 0
  for (const id of ALL_MATH_PROBLEM_IDS) {
    if ((solveCount[id] ?? 0) >= 1) practiced++
  }
  return { total: ALL_MATH_PROBLEM_IDS.length, practiced }
}

/** 某年级的总题数与已练习题数（solve_count ≥ 1 计为已练）。 */
export function gradeProblemStats(
  grade: number,
  solveCount: Record<string, number>,
): GradeProblemStats {
  const ids = GRADE_PROBLEM_IDS[grade] ?? []
  let practiced = 0
  for (const id of ids) {
    if ((solveCount[id] ?? 0) >= 1) practiced++
  }
  return { total: ids.length, practiced }
}
