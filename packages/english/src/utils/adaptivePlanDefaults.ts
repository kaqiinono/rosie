/** Shared adaptive-plan tuning defaults (DB column defaults match these). */
export const ADAPTIVE_PLAN_DEFAULTS = {
  newWordsPerDay: 10,
  reviewCap: 40,
  reviewBatchSize: 20,
  backlogFuse: 50,
  bossEveryNNew: 50,
  bossStubbornThreshold: 15,
  bossPackLimit: 50,
} as const

/** Suggested review cap when creating a plan from daily new-word quota. */
export function defaultReviewCap(newWordsPerDay: number): number {
  const n = Number.isFinite(newWordsPerDay) ? Math.max(1, Math.round(newWordsPerDay)) : 1
  return Math.max(ADAPTIVE_PLAN_DEFAULTS.reviewCap, n * 4)
}

export const NEW_WORDS_PER_DAY_PRESETS = [5, 10, 15, 20, 25, 30] as const

export const NEW_WORDS_PER_DAY_MAX = 30

export function clampNewWordsPerDay(n: number): number {
  if (!Number.isFinite(n)) return ADAPTIVE_PLAN_DEFAULTS.newWordsPerDay
  return Math.min(NEW_WORDS_PER_DAY_MAX, Math.max(1, Math.round(n)))
}

export const REVIEW_CAP_OPTIONS = [20, 30, 40, 50, 60, 80, 100] as const

export const BACKLOG_FUSE_OPTIONS = [30, 40, 50, 60, 80, 100] as const

/** 0 = disable quantitative Boss trigger. */
export const BOSS_EVERY_N_NEW_OPTIONS = [0, 25, 30, 40, 50, 75, 100] as const

export const BOSS_STUBBORN_THRESHOLD_OPTIONS = [10, 15, 20, 25, 30, 50] as const

export const BOSS_PACK_LIMIT_OPTIONS = [15, 20, 25, 30, 40, 50, 75] as const

export function clampReviewCap(n: number): number {
  if (!Number.isFinite(n)) return ADAPTIVE_PLAN_DEFAULTS.reviewCap
  return Math.min(150, Math.max(5, Math.round(n)))
}

export function clampBacklogFuse(n: number): number {
  if (!Number.isFinite(n)) return ADAPTIVE_PLAN_DEFAULTS.backlogFuse
  return Math.min(200, Math.max(10, Math.round(n)))
}

export function clampBossEveryNNew(n: number): number {
  if (!Number.isFinite(n)) return ADAPTIVE_PLAN_DEFAULTS.bossEveryNNew
  if (n <= 0) return 0
  return Math.min(200, Math.max(10, Math.round(n)))
}

export function clampBossStubbornThreshold(n: number): number {
  if (!Number.isFinite(n)) return ADAPTIVE_PLAN_DEFAULTS.bossStubbornThreshold
  return Math.min(100, Math.max(1, Math.round(n)))
}

export function clampBossPackLimit(n: number): number {
  if (!Number.isFinite(n)) return ADAPTIVE_PLAN_DEFAULTS.bossPackLimit
  return Math.min(100, Math.max(5, Math.round(n)))
}

export function bossEveryNNewLabel(n: number): string {
  return n <= 0 ? '关' : String(n)
}

/** Shared copy for review scheduling UI (create + manage). */
export const REVIEW_SCHEDULE_HELP = {
  title: '复习调度',
  intro: '控制每天到期复习的规模，以及复习积压过多时是否暂停拉新词。',
  reviewCap: {
    label: '复习上限',
    detail:
      '每天最多安排多少个「已到期」复习词（nextReviewDate ≤ 今天）。只练到期的词，不会提前拉未来箱位。建议 ≥ 每日新词 × 4。',
    example:
      '例：每天 5 新词、复习上限 40 → 某天最多 40 个到期词进任务；未到期的树箱词不会因此被拉来练。',
  },
  backlogFuse: {
    label: '复习熔断',
    detail:
      '当计划中「已到期」的学习中词超过 N 个时，当天进入「仅复习」模式：只练到期复习，不再拉新词，直到积压回落。',
    example: '例：熔断 50 → 到期复习超过 50 个时暂停新学，先清积压。',
  },
} as const

/** Shared copy for Boss threshold UI (create + manage). */
export function bossThresholdHelp(bossPackLimit: number) {
  return {
    title: 'Boss 日触发与题量',
    intro: `满足以下任一触发条件时，当天进入 Boss 模式（👹）：当天不拉新词，从全部「学习中」单词抽最多 ${bossPackLimit} 题考核。通过（首轮正确率 ≥ 85%）后恢复普通模式，并重新累计新词计数。`,
    everyNNew: {
      label: '累计新词',
      detail:
        '自上次 Boss 通过后，再累计学完 N 个新词时触发。上次通过时会记录当时已激活总数；之后每新学 1 词，计数 +1，满 N 即触发。设为「关」可关闭此条件。',
      example:
        '例：每天 5 词、阈值 50 → 约在第 11 天（累计 50 词）出现第一次 Boss；词库不足 50 词则不会出现定量 Boss。',
    },
    stubborn: {
      label: '顽固词数量',
      detail:
        '「顽固词」= 还在学习中、且至少在不同天里各答错过一次（还没被某次全对清零）的词。当这类词达到 N 个时也触发 Boss，与累计新词无关。',
      example: '例：阈值 15 → 有 15 个词反复答错、降箱后仍学不会时，即使新词未满也会进入 Boss。',
    },
    packLimit: {
      label: 'Boss 题包上限',
      detail:
        'Boss 日当天最多考核多少个「学习中」词。优先抽顽固词多、复习日更近的词。调小可减轻 Boss 日负担（如 56 词计划不必一次考满 50 个）。',
      example: '例：上限 25 → D11 Boss 日最多练 25 词，其余留到下次 Boss 或正常复习。',
    },
    note: 'Boss 日练到的词在轨迹总览表显示 👹（箱位未变）或对应箱位/👑（有升箱或毕业）。',
  } as const
}
