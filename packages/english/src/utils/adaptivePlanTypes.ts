export type AdaptivePlanMode = 'normal' | 'review_only' | 'boss'
export type AdaptivePlanStatus = 'active' | 'completed' | 'archived'
export type AdaptiveWordStatus =
  | 'NOT_STARTED'
  | 'LEARNING_PENDING'
  | 'LEARNING'
  | 'MASTERED'

export type AdaptivePlanScope = {
  stages?: string[]
  lessonKeys?: string[] // `unit::lesson`
}

export type AdaptivePlanStats = {
  bossFailStreak: number
  bossQuestionTier: number // 1 hard … 3 floor
  everActivatedCount: number
  totalActivatedCount: number
  lastBossActivatedCount: number
}

export type AdaptiveWordPlan = {
  id: string
  userId: string
  title: string
  scope: AdaptivePlanScope
  newWordsPerDay: number
  reviewCap: number
  reviewBatchSize: number
  backlogFuse: number
  bossEveryNNew: number
  bossStubbornThreshold: number
  mode: AdaptivePlanMode
  status: AdaptivePlanStatus
  stats: AdaptivePlanStats
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type AdaptivePlanWordProgress = {
  id?: string
  planId: string
  userId: string
  wordKey: string
  status: AdaptiveWordStatus
  boxIndex: number | null
  targetBox: 1 | 3 | null
  streakWrong: number
  nextReviewDate: string | null
  introducedOn: string | null
  archivedAt?: string | null
}

export type PlanWordInit = {
  word_key: string
  status: 'NOT_STARTED' | 'LEARNING_PENDING' | 'MASTERED'
  target_box: 1 | 3 | null
}
