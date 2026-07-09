import type { QuizType, WordMasteryInfo } from '@rosie/core'
import type { AdaptivePlanWordProgress } from './adaptivePlanTypes'

/**
 * Auto-match quiz types by plan-local box (primary) with global mastery fallback.
 * Progression toward writing (C 释义→默写):
 *   Box 1 / new     → A          认读
 *   Box 2           → A, B       双向选择
 *   Box 3           → B, C       开始默写
 *   Box 4–5         → C          会写考核
 *
 * Step1 温故可传 `preferLight: true`：高箱仍保留一道选择题垫手，再考默写。
 */
export function quizTypesForWord(
  row: AdaptivePlanWordProgress | undefined,
  mastery?: WordMasteryInfo,
  opts?: { preferLight?: boolean },
): QuizType[] {
  const box = resolveFamiliarityBox(row, mastery)
  const light = opts?.preferLight === true

  if (box <= 1) return ['A']
  if (box === 2) return light ? ['A'] : ['A', 'B']
  if (box === 3) return light ? ['A', 'C'] : ['B', 'C']
  // box 4–5
  return light ? ['B', 'C'] : ['C']
}

/** Map plan row / mastery into a 1–5 familiarity band for quiz selection. */
export function resolveFamiliarityBox(
  row: AdaptivePlanWordProgress | undefined,
  mastery?: WordMasteryInfo,
): number {
  if (row?.status === 'LEARNING' && row.boxIndex != null) {
    return clampBox(row.boxIndex)
  }
  if (row?.status === 'LEARNING_PENDING' && row.targetBox != null) {
    return clampBox(row.targetBox)
  }
  if (row?.status === 'MASTERED') return 5

  const stage = mastery?.stage ?? 0
  if (stage <= 0) return 1
  if (stage <= 2) return 2
  if (stage <= 3) return 3
  if (stage <= 4) return 4
  return 5
}

function clampBox(n: number): number {
  if (n < 1) return 1
  if (n > 5) return 5
  return n
}
