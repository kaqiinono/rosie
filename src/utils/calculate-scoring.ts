import type { ScoringResult, Tier } from './calculate-types'
import { FIRST_CLEAR_BONUS } from './calculate-trees'

// ─── 评分参数 ────────────────────────────────────────────────────────

const STREAK_TIER_1 = 5 // 连续5题触发 ×1.5
const STREAK_TIER_2 = 10 // 连续10题触发 ×2
const STREAK_MULTIPLIER_1 = 1.5
const STREAK_MULTIPLIER_2 = 2.0
const PERFECT_BONUS = 10

/**
 * 计算单题得分。
 * 四层叠加：基础星 + 速度奖励 + 连击加成 + 满分奖励(session 级)
 */
export function scoreQuestion(
  correct: boolean,
  starsBase: number,
  withinTimeLimit: boolean,
  currentStreak: number,
): { stars: number; streakMultiplier: number } {
  if (!correct) return { stars: 0, streakMultiplier: 1 }

  let stars = starsBase

  if (withinTimeLimit) stars += 1

  const multiplier =
    currentStreak >= STREAK_TIER_2
      ? STREAK_MULTIPLIER_2
      : currentStreak >= STREAK_TIER_1
        ? STREAK_MULTIPLIER_1
        : 1.0

  stars = Math.round(stars * multiplier)

  return { stars, streakMultiplier: multiplier }
}

/**
 * 计算整个 Session 的总得分。
 */
export function scoreSession(
  questionStars: number[],
  totalCorrect: number,
  totalCount: number,
  maxStreak: number,
): ScoringResult {
  const baseStars = questionStars.reduce((s, v) => s + v, 0)

  const speedBonus = 0 // 已在单题中计算

  const streakMultiplier =
    maxStreak >= STREAK_TIER_2
      ? STREAK_MULTIPLIER_2
      : maxStreak >= STREAK_TIER_1
        ? STREAK_MULTIPLIER_1
        : 1.0

  const perfectBonus = totalCorrect === totalCount ? PERFECT_BONUS : 0

  return {
    baseStars,
    speedBonus,
    streakMultiplier,
    perfectBonus,
    totalStars: baseStars + perfectBonus,
  }
}

/**
 * 首次通关某档的额外奖励。
 */
export function firstClearBonus(tier: Tier): number {
  return FIRST_CLEAR_BONUS[tier]
}

/**
 * 判定是否通关某档。
 */
export function isTierPassed(
  correctCount: number,
  totalCount: number,
  passRate: number,
): boolean {
  if (totalCount === 0) return false
  return correctCount / totalCount >= passRate
}
