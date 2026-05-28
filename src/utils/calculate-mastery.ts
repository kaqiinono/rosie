import type { CalculateTopicState, ErrorTag, TopicAttempt } from './calculate-types'

// ─── SM-2 简化版参数 ─────────────────────────────────────────────────

const INTERVAL_MULTIPLIER = 2.5
const MAX_INTERVAL_DAYS = 21
const MASTERED_STREAK = 3

// ─── 知识点权重（出题选择用） ────────────────────────────────────────

interface WeightInput {
  masteryRate: number
  daysSinceLastSeen: number
  recentCorrectStreak: number
  isCurrentLevelPriority: boolean
}

/**
 * 计算知识点的出题权重。权重越高越容易被选中。
 * 公式来自 docs/caculation.md §4.2
 */
export function topicWeight(input: WeightInput): number {
  const base = 1.0
  return (
    base +
    0.4 * (1 - input.masteryRate) +
    0.3 * Math.min(input.daysSinceLastSeen / 14, 1) +
    -0.2 * Math.min(input.recentCorrectStreak / 5, 1) +
    (input.isCurrentLevelPriority ? 0.1 : 0)
  )
}

/**
 * 从权重分布中按概率采样一个索引。
 */
export function weightedSample(weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) return 0
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return weights.length - 1
}

// ─── SM-2 间隔更新 ──────────────────────────────────────────────────

export interface MasteryUpdate {
  masteryRate: number
  reviewInterval: number
  nextReviewDate: string // YYYY-MM-DD
  isMastered: boolean
}

/**
 * 根据答题结果更新知识点的掌握度和复习间隔。
 */
export function updateMastery(
  state: CalculateTopicState,
  correct: boolean,
  today: string,
): MasteryUpdate {
  const attempts = state.attemptCount + 1
  const corrects = state.correctCount + (correct ? 1 : 0)
  const rate = attempts > 0 ? corrects / attempts : 0

  let interval: number
  let isMastered = false

  if (correct) {
    interval = Math.min(
      Math.round(state.reviewInterval * INTERVAL_MULTIPLIER),
      MAX_INTERVAL_DAYS,
    )
    const streak = recentCorrectStreak(state.recentResults, correct)
    if (streak >= MASTERED_STREAK) {
      isMastered = true
    }
  } else {
    interval = 1
  }

  const nextDate = addDays(today, interval)

  return {
    masteryRate: rate,
    reviewInterval: interval,
    nextReviewDate: nextDate,
    isMastered,
  }
}

/**
 * 计算最近连续正确次数（包含本次）。
 */
function recentCorrectStreak(recent: TopicAttempt[], currentCorrect: boolean): number {
  if (!currentCorrect) return 0
  let streak = 1
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].correct) streak++
    else break
  }
  return streak
}

/**
 * 判断知识点是否需要复习（today >= nextReviewDate）。
 */
export function isReviewDue(state: CalculateTopicState, today: string): boolean {
  if (!state.nextReviewDate) return false
  return today >= state.nextReviewDate
}

/**
 * 自动检测错误标签。根据干扰项类型映射到错误模式。
 */
export function detectErrorTag(
  distractorType: string | null,
): ErrorTag | null {
  if (!distractorType) return 'careless'
  const map: Record<string, ErrorTag> = {
    carry_omit: 'carry_miss',
    order_swap: 'order_confusion',
    place_shift: 'place_value',
    close_number: 'careless',
    denom_add: 'fraction_concept',
    op_confusion: 'order_confusion',
  }
  return map[distractorType] ?? 'careless'
}

/**
 * 填空题错误诊断 (PRD 4.2)。
 * 通过分析用户答案与正确答案的差值推断错误类型。
 */
export function diagnoseBlank(
  userAnswer: number,
  correctAnswer: number,
  levelId: string,
): ErrorTag {
  const diff = userAnswer - correctAnswer

  if (diff === 0) return 'careless'

  if (Math.abs(diff) === correctAnswer * 10 || Math.abs(diff) === correctAnswer / 10) {
    return 'place_value'
  }

  const absDiff = Math.abs(diff)
  const tree = levelId.split('-')[0]

  if (tree === 'AS') {
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(correctAnswer))))
    if (absDiff === magnitude || absDiff === magnitude * 10) {
      return 'carry_miss'
    }
  }

  if (tree === 'MX') {
    return 'order_confusion'
  }

  if (tree === 'FR') {
    if (correctAnswer !== 0 && Math.abs(userAnswer - 1 / correctAnswer) < 0.01) {
      return 'fraction_concept'
    }
    return 'fraction_concept'
  }

  if (absDiff <= 2) return 'careless'

  if (absDiff >= correctAnswer * 0.5) return 'estimation_off'

  return 'careless'
}

// ─── 日期工具 ────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}
