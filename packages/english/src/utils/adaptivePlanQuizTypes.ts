import type { QuizType, WordMasteryInfo } from '@rosie/core'
import type { AdaptivePlanWordProgress } from './adaptivePlanTypes'

/**
 * Auto-match quiz types by plan-local box (primary) with global mastery fallback.
 * Progression toward writing (C 释义→默写):
 *   Box 1 / new     → A          认读
 *   Box 2           → A/B, C     选择后立即默写强化
 *   Box 3           → A/B, C     选择后延迟默写检测
 *   Box 4–5         → C          会写考核
 */
export function quizTypesForWord(
  row: AdaptivePlanWordProgress | undefined,
  mastery?: WordMasteryInfo,
  opts?: { choiceType?: 'A' | 'B'; preferLight?: boolean },
): QuizType[] {
  const box = resolveFamiliarityBox(row, mastery)
  const choiceType = opts?.choiceType ?? 'A'

  if (box <= 1) return ['A']
  if (box === 2 || box === 3) return opts?.preferLight ? ['A'] : [choiceType, 'C']
  return ['C']
}

/**
 * §5.3.1 Boss 题型降级阶梯（有底线，不可无限降）：
 *   tier 1 — 全压力：按箱位直接考（高箱纯默写）
 *   tier 2 — 弱提示：先垫一道选择再默写（light 变体）
 *   tier 3 — 底线：四选一认读 +（高箱）常规看义拼写；到此不再降级
 */
export function bossQuizTypesForWord(
  row: AdaptivePlanWordProgress | undefined,
  mastery: WordMasteryInfo | undefined,
  tier: number,
): QuizType[] {
  const t = tier <= 1 ? 1 : tier >= 3 ? 3 : 2
  if (t === 1) return quizTypesForWord(row, mastery, { choiceType: 'B' })
  if (t === 2) return quizTypesForWord(row, mastery, { choiceType: 'A' })

  const box = resolveFamiliarityBox(row, mastery)
  if (box >= 4) return ['A', 'C']
  if (box === 3) return ['A', 'B']
  return ['A']
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
