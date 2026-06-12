import { ReactNode } from 'react'
import type { ProblemDifficulty } from './difficulty'

export interface ModuleCardData {
  href: string
  title: string
  description: string
  tag: string
  variant: 'math' | 'english' | 'reading' | 'today' | 'calc'
  stats: string[]
  enterText: string
  icon: string
}

export interface CourseCardData {
  href: string
  title: string
  description: string
  icon: string
  lectureNum: string
  tags: string[]
  variant: 'blue' | 'amber' | 'violet'
}

export type FruitItem = {
  emoji: string
  name: string
}

export type Lesson34Mode = 'merge' | 'split'

export interface RatioInput {
  id: string
  ans: number
  unit?: string
}

export interface OpInput {
  id: string
  ans: string
}

export type RatioColValue = string | RatioInput

export interface DualSceneConfig {
  initA: number
  unitA: string
  targetA: number
  initB: number
  unitB: string
  targetB: number
  totalBase: number
  unitC: string
  labelA: string
  labelB: string
  labelC: string
  isReverse?: boolean
  targetTotal?: number
  guiALabel?: string
  guiBLabel?: string
  expALabel?: string
  expBLabel?: string
}

export interface BlockScene {
  init: number
  perPart: number
  unit: number
  target: number
  total: number
  answer?: number
  rightUnit?: string
  leftUnit?: string
  leftLabel?: string
  rightLabel?: string
  hint?: string
  expandUnit?: string
}

export interface Problem {
  id: string
  title: string
  tag: string
  tagLabel: string
  /** 难度 1–5 星：1 入门，5 挑战 */
  difficulty: ProblemDifficulty
  text: string
  analysis: string[]
  type: 'ratio3' | 'ratio3b' | 'none'
  rows?: (string | RatioInput)[]
  rows2?: (string | RatioInput)[]
  rcols?: RatioColValue[]
  ops?: OpInput[]
  hasBlocks?: boolean
  blockScene?: BlockScene
  dualSc?: DualSceneConfig
  startDate?: string
  endDate?: string
  startWeekday?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  endWeekday?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  totalDays?: 28 | 29 | 30 | 31
  finalQ: string
  finalUnit: string
  finalAns: number
  figureNode?: ReactNode
  /**
   * Solution-area image path (relative to /public), e.g. `/img/math/41-P5.png`.
   * Rendered inside the 题解 panel via `AnalysisImage`. Works in `.ts` data files
   * since it's a plain string — for fully custom JSX diagrams, use `figureNode`.
   */
  analysisImg?: string
}

export interface ProblemSet {
  pretest: Problem[]
  lesson: Problem[]
  homework: Problem[]
  workbook: Problem[]
  supplement?: Problem[]
}

export type PageName =
  | 'home'
  | 'lesson'
  | 'homework'
  | 'workbook'
  | 'alltest'
  | 'pretest'
  | 'detail'

export interface WordEntry {
  stage?: string
  unit: string
  lesson: string
  word: string
  explanation: string
  chineseDef?: string
  ipa?: string
  example?: string
  phonics?: string
  syllables?: string[]
  keywords?: [string, string][]
}

export interface DailyRecord {
  date: string
  newWords: string[]
  reviews: string[]
  scores: Record<string, number>
}

export interface ReviewRecord {
  date: string // "YYYY-MM-DD"
  correct: boolean
  /** Where the review came from. Absent on legacy rows = treat as 'flashcard'. */
  source?: 'flashcard' | 'recall'
}

export interface WordMasteryInfo {
  correct: number
  incorrect: number
  lastSeen: string
  stage?: number // 0-7 (normal) or 0-8 (hard); undefined = not yet initialized
  nextReviewDate?: string // "YYYY-MM-DD"
  isHard?: boolean // true after regressing from stage >= 2
  reviewHistory?: ReviewRecord[] // chronological review log
}

export type WordMasteryMap = Record<string, WordMasteryInfo>

export interface WeeklyPlanDay {
  date: string // ISO date e.g. "2026-03-20"
  newWordKeys: string[] // word keys for new words from active lesson
}

export interface WeekDayProgress {
  quizDone: boolean
  lastScore?: number // 最近一次完成（子任务或全天）的得分 0–100
  completedAt?: string // ISO date
  consolidateDone?: boolean // 必记子任务已完成
  previewDone?: boolean // 预习子任务已完成
  consolidateScore?: number // 0–100
  previewScore?: number // 0–100
  /** True once the learner has scrolled past 50% of the focus-lesson passage on this day. */
  readingDone?: boolean
}

export interface EnglishWeeklyReport {
  version: 1
  weekRangeLabel: string
  unitLessonLabel: string
  generatedAt: string
  execution: {
    daysInWeek: number
    daysWithQuiz: number
    dayCompletionRatePercent: number
    averageQuizScore: number | null
    highScoreDays: number
    lowScoreDays: number
  }
  byDay: {
    date: string
    weekdayLabel: string
    displayDate: string
    hadSession: boolean
    lastScore: number | null
  }[]
  vocabulary: {
    totalPlanWordKeys: number
    consolidateCount: number
    previewCount: number
    consolidateMet: number
    newWordSlotsPerDay: number
  }
  spotlightWords: {
    word: string
    kind: 'consolidate' | 'preview'
    stage: number
    level: 0 | 1 | 2 | 3
  }[]
  narrative: string[]
  suggestions: string[]
}

export interface WeekCompletion {
  completedAt: string
  report: EnglishWeeklyReport
}

export interface WeeklyPlan {
  id?: string // Supabase UUID primary key; undefined until first save
  weekStart: string // ISO date of the Thursday starting this week
  unit: string
  lesson: string
  weekStartDay: number // 0–6, 4 = Thursday
  newWordsPerDay: number // default 3
  days: WeeklyPlanDay[] // 7 entries index 0=Thu … 6=Wed
  progress: Record<string, WeekDayProgress> // keyed by date string
  /** Set when the learner marks the week complete; stored inside progress_data JSON. */
  weekCompletion?: WeekCompletion
  /**
   * Lessons (keys `unit::lesson`) whose new words count as 预习 for this plan.
   * When set (including `[]`), classification is explicit. When omitted, legacy
   * heuristic applies (latest lesson in vocab among multi-lesson plans = preview).
   */
  previewLessonKeys?: string[]
  /**
   * Per-wordKey override for 必记 vs 预习. When present for a key, wins over
   * `previewLessonKeys` / legacy heuristic. Stored in `plan_data` JSON.
   */
  wordKinds?: Record<string, 'consolidate' | 'preview'>
  /**
   * The single lesson key (`unit::lesson`) marked as this week's "重点" focus.
   * Drives passage-aware behaviour: reading entrypoint, Type D question generation,
   * passage sentence on word cards. Must be a 必记 lesson (not preview).
   */
  focusLessonKey?: string
}

// Math weekly plan types

export interface MathPlanProblem {
  key: string // globally unique key e.g. "35::L1"
  lessonId: string // "35" | "36"
  section: string // "lesson" | "homework" | "workbook" | "pretest"
  index: number // 1-based, used to construct URL e.g. /math/ny/35/lesson/1
  title: string // problem title
  problemId: string // original Problem.id e.g. "36-L1"
}

export interface MathWeeklyPlanDay {
  date: string // "YYYY-MM-DD"
  problems: MathPlanProblem[] // required problems (ordered)
  optionalProblems: MathPlanProblem[] // optional problems (W7-12)
}

export interface MathDayProgress {
  doneKeys: string[] // completed problem key list
  completedAt?: string // time when all required problems were completed
}

export interface MathWeeklyPlan {
  weekStart: string // ISO date (same Thursday start as English)
  lessonId: string // "35" | "36"
  weekStartDay: number // 0–6, 4 = Thursday
  problemsPerDay: number // default 3
  days: MathWeeklyPlanDay[] // 7 days
  progress: Record<string, MathDayProgress> // key = date string
}

export type ProblemMasteryMap = Record<string, WordMasteryInfo>

export type KpRotationPhase = 'knowledge_points' | 'error_bank'

// Per-lesson rotation state (problem-level cycling within one lesson)
export interface PerLessonRotationState {
  nextKpIndex: number
  completedKpIndexes: number[]
  phase: KpRotationPhase
}

export interface MathRotatingReviewState {
  planLessonId: string // ties state to current plan, e.g. "36"
  lessonOrder: string[] // ordered prior lesson IDs to cycle, e.g. ["32","33","35"]
  nextLessonIndex: number // index into lessonOrder for next day's assignment
  perLesson: Record<string, PerLessonRotationState> // per-lesson problem-level state
  dailyAssignments: Record<string, string[]> // date → assigned problem keys
  dailyDoneKeys: Record<string, string[]> // date → completed problem keys
}

export interface MathWeeklyLessonReviewState {
  planLessonId: string // bound to current lesson plan; reset when lesson changes
  reviewCounts: Record<string, number> // problemKey → times selected and completed
  dailyAssignments: Record<string, string> // date → assigned problemKey (one per day)
  dailyDoneKeys: Record<string, string[]> // date → completed keys
  dailySkipped: Record<string, true> // date → skipped flag
}

// ─────────────────────────────────────────────────────────────────────────
// 口算 (Mental Arithmetic) module — /calc
// ─────────────────────────────────────────────────────────────────────────

export type CalcOp = 'add' | 'sub' | 'mul' | 'div'
export type CalcCategory = 'addsub' | 'muldiv' | 'mixed'
export type CalcLevel = number | 'C'

/** A question's canonical answer. `int` is the only kind produced before Phase 3b/3c;
 *  `decimal`/`remainder`/`fraction` are defined now so the answer helpers are complete. */
export type CalcAnswer =
  | { kind: 'int'; value: number }
  | { kind: 'decimal'; value: number; places: number }
  | { kind: 'remainder'; quotient: number; remainder: number }
  | { kind: 'fraction'; num: number; den: number }

export type ErrorTag =
  | 'carry_miss'
  | 'order_confusion'
  | 'place_value'
  | 'fraction_concept'
  | 'comprehension'
  | 'careless'
  | 'formula_misuse'
  | 'estimation_off'

export interface CalcQuestion {
  display: string // "3 + 5 × 2 = ?"
  signature: string // canonical: "add(3,mul(5,2))"
  arity: 1 | 2 | 3
  level: CalcLevel
  answer: CalcAnswer
  isChallenge: boolean
  category: CalcCategory
  /** Per-question coin (before streak bonus). Challenge questions already include ×2 here. */
  coinBase: number
  /** Attribution: which building block produced this question (set by buildSession). */
  sourceBlockId?: string
  /** Attribution: which mixed-op generator produced this question (set by buildSession). */
  sourceMixedOpId?: string
  /** How this question is answered. Absent/'pad' = number pad; 'vertical' = column (竖式) layout. */
  answerMode?: 'pad' | 'vertical'
}

export type CalcSkeletonId =
  | 'as'          // 加减混合
  | 'md'          // 乘除混合
  | 'asm'         // 加减与乘法
  | 'asmd'        // 加减乘除全混合
  | 'as_m_paren'  // 加减与乘法·带括号
  | 'md_paren'    // 乘除·带括号
  | 'asmd_paren'  // 加减乘除·带括号

export interface MixedOp {
  id: string            // uuid
  skeleton: CalcSkeletonId
  blockIds: string[]    // 选中的积木块 ID
  enabled: boolean
  label?: string
}

export interface CalcSettings {
  selectedBlocks: string[]   // 单运算练习选中的积木块 ID
  mixedOps: MixedOp[]        // 编排出的混合运算
  soundEnabled: boolean
  /** When true, ~30% of single-op questions render as an inverse blank form (48 + □ = 105). */
  includeInverse: boolean
  /** When true, questions from vertical-capable blocks are answered in 竖式 layout. */
  verticalForBigNumbers: boolean
  lastCount: number          // 20/30/50/100
  lastTimeLimit: number       // seconds, 0=unlimited
  sessionCounter: number      // 每次 session 完成自增
  timeLimitOverrides: Record<string, number>
}

// ─────────────────────────────────────────────────────────────────────────
// 口算 mastery system (per master.md)
// ─────────────────────────────────────────────────────────────────────────

export type CalcProblemStatus = 'active' | 'review' | 'mastered' | 'forced'

export interface QuestionAttempt {
  correct: boolean
  timeMs: number
  /** Whether the first attempt landed within the configured time limit.
   *  Optional for backward compat with rows written before Phase 4. */
  withinLimit?: boolean
}

export interface CalcProblemState {
  signature: string
  level: CalcLevel
  proficiency: number // 0..5
  attemptCount: number
  appearanceCount: number
  recentResults: QuestionAttempt[] // most-recent at the end, capped at 10
  status: CalcProblemStatus
  consecutiveWrong: number
  updatedAt: string
  /** Attribution: which building block this problem was drawn from. */
  blockId?: string
  /** Attribution: which mixed-op generator this problem was drawn from. */
  mixedOpId?: string
  // ── Legacy spaced-repetition fields (no longer written/read by the new
  //    lightweight proficiency logic; kept optional to avoid a DB migration). ──
  shortMasteredAt?: string | null // YYYY-MM-DD
  reviewR1Due?: string | null
  reviewR2Due?: string | null
  reviewR3Due?: string | null
  longMastered?: boolean
  lastSeenSession?: number | null
  timesSeenThisRound?: number
  forcedNext?: boolean
}

export type CalcLevelStatus =
  | 'practicing'
  | 'abc_passed'
  | 'review_r1'
  | 'review_r2'
  | 'review_r3'
  | 'mastered'

export interface CalcLevelStateInfo {
  level: CalcLevel
  status: CalcLevelStatus
  abcPassedDate: string | null
  reviewR1Date: string | null
  reviewR2Date: string | null
  reviewR3Date: string | null
  sessionCountInLevel: number
  warmupComplete: boolean
  warmupAnswered: number
  lastSessionAccuracy: number | null
  consecutivePoorSessions: number
}

/**
 * Voucher category is a free-text slug stored in voucher_templates.category.
 * Old code referenced a fixed enum; templates are now data, so this is an
 * opaque string. Use {@link VoucherTemplate} for display + price lookup.
 */
export type VoucherCategory = string

export interface VoucherTemplate {
  category: string
  label: string
  emoji: string
  /** Tailwind gradient utility class, e.g. 'from-indigo-500 to-purple-500'. */
  gradient: string
  priceYellow: number
  priceRed: number
  priceBlue: number
  sortOrder: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Voucher {
  id: string
  category: VoucherCategory
  redeemedAt: string
  usedAt: string | null
  coinsSpent: number
}

export type CalcMode = 'daily' | 'free' | 'mistakes'

export interface CalcSession {
  id?: string
  date: string // YYYY-MM-DD
  startedAt: string
  finishedAt: string
  count: number
  correctCount: number
  retryCount: number
  wrongCount: number
  challengeCorrect: number
  timeSpentSec: number
  /**
   * Stars earned in this session (derived from star_sessions via ref_id join).
   * Not stored on calc_sessions itself — the canonical ledger is star_sessions.
   * Pass it to {@link CalcWallet.recordSession} and it will be persisted as a
   * star_sessions row with source='calc' and ref_id pointing at the new session.
   */
  coinsEarned: number
  mode: CalcMode
  maxStreak: number
  topLevel: CalcLevel
  /** First-attempt solve time (ms) per question, in order. Empty for legacy rows. */
  questionTimesMs?: number[]
}

export interface CalcMistake {
  id?: string
  signature: string
  display: string
  answer: CalcAnswer
  level: CalcLevel
  category: CalcCategory
  lastWrongAt: string
  consecutiveCorrect: number // ≥3 ⇒ resolved
  resolved: boolean
  /** The session number during which this mistake was last recorded (for carry-over make-up). */
  sessionNo?: number
  /** The child's (final-wrong) answer, for review. */
  userAnswer?: string
  /** Deterministic error classification, or null when unrecognized. */
  errorTag?: ErrorTag | null
}

// ─────────────────────────────────────────────────────────────────────────
// Quiz / rescue-queue types (English word-learning module)
// ─────────────────────────────────────────────────────────────────────────

export type QuizType = 'A' | 'B' | 'C' | 'D'

export type RescueSeverity = 'half' | 'eaten'

/**
 * `false` = no reinforcement phase active yet (main round not finished).
 * Once main round completes, becomes 'half-only' | 'eaten-only' | 'both'
 * depending on what's in the rescue queue.
 */
export type ReinforcementPhase = false | 'half-only' | 'eaten-only' | 'both'

export type RescueRole =
  | 'flashcard'
  | 'reinforce-step1'   // 被吃阶梯：A 类识别桥
  | 'reinforce-step2'   // 被吃阶梯：原题型再考
  | 'reinforce-half'    // 半对补练（同题型）

export interface QuizQuestion {
  word: WordEntry
  type: QuizType
  /** C 类补练时露出多少字母（半字母露出），undefined = 全 mask */
  revealedHalf?: number
  /** 标记此题来自补练队列；undefined = 主轮原题 */
  rescueRole?: RescueRole
}

export type RescueStage =
  | 'pending'
  | 'flashcard_done'
  | 'reinforce1_done'
  | 'consolidated'
  | 'still_half'
  | 'saved'
  | 'lost'

export interface RescueQueueItem {
  wordKey: string
  entry: WordEntry
  severity: RescueSeverity
  originalType: QuizType
  stage: RescueStage
  monsterIdx?: number
  /** Unix timestamp in ms; used for sort order within the rescue queue. */
  enqueuedAtMs: number
}
