import type {
  AdaptivePlanMode,
  AdaptivePlanScope,
  AdaptivePlanStats,
  AdaptivePlanStatus,
  AdaptivePlanWordProgress,
  AdaptiveWordPlan,
  AdaptiveWordStatus,
} from './adaptivePlanTypes'

export type AdaptiveWordPlanRow = {
  id: string
  user_id: string
  title: string
  scope: unknown
  new_words_per_day: number
  review_cap: number
  review_batch_size: number
  backlog_fuse: number
  boss_every_n_new: number
  boss_stubborn_threshold: number
  boss_pack_limit: number
  mode: string
  status: string
  stats: unknown
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type AdaptivePlanProgressRow = {
  id?: string
  plan_id: string
  user_id: string
  word_key: string
  status: string
  box_index: number | null
  target_box: number | null
  streak_wrong: number
  next_review_date: string | null
  introduced_on: string | null
  archived_at: string | null
}

const DEFAULT_STATS: AdaptivePlanStats = {
  bossFailStreak: 0,
  bossQuestionTier: 1,
  everActivatedCount: 0,
  totalActivatedCount: 0,
  lastBossActivatedCount: 0,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOrDefault(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function stringArrayOrUndefined(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const strings = value.filter((item): item is string => typeof item === 'string')
  return strings.length > 0 ? strings : undefined
}

function parseScope(value: unknown): AdaptivePlanScope {
  if (!isRecord(value)) return {}
  return {
    ...(stringArrayOrUndefined(value.stages) ? { stages: stringArrayOrUndefined(value.stages) } : {}),
    ...(stringArrayOrUndefined(value.lessonKeys)
      ? { lessonKeys: stringArrayOrUndefined(value.lessonKeys) }
      : {}),
  }
}

function parseStats(value: unknown): AdaptivePlanStats {
  if (!isRecord(value)) return DEFAULT_STATS
  return {
    bossFailStreak: numberOrDefault(value.bossFailStreak, DEFAULT_STATS.bossFailStreak),
    bossQuestionTier: numberOrDefault(value.bossQuestionTier, DEFAULT_STATS.bossQuestionTier),
    everActivatedCount: numberOrDefault(
      value.everActivatedCount,
      DEFAULT_STATS.everActivatedCount,
    ),
    totalActivatedCount: numberOrDefault(
      value.totalActivatedCount,
      DEFAULT_STATS.totalActivatedCount,
    ),
    lastBossActivatedCount: numberOrDefault(
      value.lastBossActivatedCount,
      DEFAULT_STATS.lastBossActivatedCount,
    ),
  }
}

function parseMode(value: string): AdaptivePlanMode {
  return value === 'review_only' || value === 'boss' ? value : 'normal'
}

function parsePlanStatus(value: string): AdaptivePlanStatus {
  return value === 'completed' || value === 'archived' ? value : 'active'
}

function parseWordStatus(value: string): AdaptiveWordStatus {
  if (
    value === 'LEARNING_PENDING' ||
    value === 'LEARNING' ||
    value === 'MASTERED'
  ) {
    return value
  }
  return 'NOT_STARTED'
}

function parseTargetBox(value: number | null): 1 | 3 | null {
  return value === 1 || value === 3 ? value : null
}

/** DB Row (snake_case) -> app model (camelCase). */
export function mapPlanRowToModel(row: AdaptiveWordPlanRow): AdaptiveWordPlan {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    scope: parseScope(row.scope),
    newWordsPerDay: numberOrDefault(row.new_words_per_day, 10),
    reviewCap: numberOrDefault(row.review_cap, 40),
    reviewBatchSize: numberOrDefault(row.review_batch_size, 20),
    backlogFuse: numberOrDefault(row.backlog_fuse, 50),
    bossEveryNNew: numberOrDefault(row.boss_every_n_new, 50),
    bossStubbornThreshold: numberOrDefault(row.boss_stubborn_threshold, 15),
    bossPackLimit: numberOrDefault(row.boss_pack_limit, 50),
    mode: parseMode(row.mode),
    status: parsePlanStatus(row.status),
    stats: parseStats(row.stats),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.archived_at ? { archivedAt: row.archived_at } : {}),
  }
}

/** DB Row (snake_case) -> app model (camelCase). */
export function mapProgressRowToModel(row: AdaptivePlanProgressRow): AdaptivePlanWordProgress {
  return {
    ...(row.id ? { id: row.id } : {}),
    planId: row.plan_id,
    userId: row.user_id,
    wordKey: row.word_key,
    status: parseWordStatus(row.status),
    boxIndex: row.box_index,
    targetBox: parseTargetBox(row.target_box),
    streakWrong: row.streak_wrong,
    nextReviewDate: row.next_review_date,
    introducedOn: row.introduced_on,
    archivedAt: row.archived_at,
  }
}

/** App model -> Insert/Update payload (snake_case) for upsert. */
export function mapPlanModelToRow(plan: AdaptiveWordPlan): Record<string, unknown> {
  return {
    id: plan.id,
    user_id: plan.userId,
    title: plan.title,
    scope: plan.scope,
    new_words_per_day: plan.newWordsPerDay,
    review_cap: plan.reviewCap,
    review_batch_size: plan.reviewBatchSize,
    backlog_fuse: plan.backlogFuse,
    boss_every_n_new: plan.bossEveryNNew,
    boss_stubborn_threshold: plan.bossStubbornThreshold,
    boss_pack_limit: plan.bossPackLimit,
    mode: plan.mode,
    status: plan.status,
    stats: plan.stats,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
    archived_at: plan.archivedAt ?? null,
  }
}

/** App model -> Insert/Update payload (snake_case) for upsert. */
export function mapProgressModelToRow(row: AdaptivePlanWordProgress): Record<string, unknown> {
  return {
    ...(row.id ? { id: row.id } : {}),
    plan_id: row.planId,
    user_id: row.userId,
    word_key: row.wordKey,
    status: row.status,
    box_index: row.boxIndex,
    target_box: row.targetBox,
    streak_wrong: row.streakWrong,
    next_review_date: row.nextReviewDate,
    introduced_on: row.introducedOn,
    archived_at: row.archivedAt ?? null,
  }
}
