/** Shared adaptive-plan tuning defaults (DB column defaults match these). */
export const ADAPTIVE_PLAN_DEFAULTS = {
  newWordsPerDay: 10,
  reviewCap: 40,
  reviewBatchSize: 20,
  backlogFuse: 20,
  bossEveryNNew: 50,
  bossStubbornThreshold: 15,
  bossPackLimit: 50,
} as const

/** Suggested review cap when creating a plan from daily new-word quota. */
export function defaultReviewCap(newWordsPerDay: number): number {
  const n = Number.isFinite(newWordsPerDay) ? Math.max(1, Math.round(newWordsPerDay)) : 1
  return Math.max(ADAPTIVE_PLAN_DEFAULTS.reviewCap, n * 4)
}

/** Suggested reminder threshold for weak words; it never blocks the main line. */
export function defaultWeakReminderThreshold(newWordsPerBatch: number): number {
  const n = Number.isFinite(newWordsPerBatch) ? Math.max(1, Math.round(newWordsPerBatch)) : 1
  return Math.max(10, n * 2)
}

export const NEW_WORDS_PER_DAY_PRESETS = [5, 10, 15, 20, 25, 30] as const

export const NEW_WORDS_PER_DAY_MAX = 30

export function clampNewWordsPerDay(n: number): number {
  if (!Number.isFinite(n)) return ADAPTIVE_PLAN_DEFAULTS.newWordsPerDay
  return Math.min(NEW_WORDS_PER_DAY_MAX, Math.max(1, Math.round(n)))
}

export const REVIEW_CAP_OPTIONS = [20, 30, 40, 50, 60, 80, 100] as const

export const BACKLOG_FUSE_OPTIONS = [10, 15, 20, 30, 40, 50] as const

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
  title: '批次节奏',
  intro: '控制每批主线的阶段推进量，并在弱词较多时给出加练提醒；都不会中断主线。',
  reviewCap: {
    label: '单批阶段推进上限',
    detail:
      '每完成一批主线，最多同时安排多少个已进入 1–5 阶段的词继续推进。各阶段轮流取词，弱词优先。建议 ≥ 每批新词 × 4。',
    example:
      '例：每批 5 个新词、上限 40 → 该批最多再安排 40 个历史词进阶。',
  },
  backlogFuse: {
    label: '弱词提醒阈值',
    detail:
      '当答错或使用提示的弱词达到 N 个时，提醒可选加练。只提醒，不暂停新词，也不代替主线验收。',
    example: '例：阈值 10 → 弱词达到 10 个时显示加练建议，下一批主线仍照常进行。',
  },
} as const

/** Shared copy for Boss threshold UI (create + manage). */
export function bossThresholdHelp() {
  return {
    title: 'Boss 挑战触发',
    intro: '自上次 Boss 通过后，新词累积达标且已有通过第 5 阶段的词时，冻结全部 Boss 等待词进行独立默写验收。Boss 不取代主线，失败也不降阶。',
    everyNNew: {
      label: '累计新词',
      detail:
        '自上次 Boss 通过后，再累计学完 N 个新词时触发。若当时还没有 Boss 等待词，主线继续，直到至少有 1 词到达验收点。',
      example:
        '例：阈值 50 → 累计学完 50 个新词后，对当时所有 Boss 等待词进行一次完整默写。',
    },
    note: '通过条件：首轮独立正确率 ≥ 85%，并完成当轮错词加练。失败后保留原 Boss 词组，加练后重新全量验收。',
  } as const
}
