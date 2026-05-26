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

export type QuizType = 'wordToMeaning' | 'meaningToWord' | 'spelling'

export interface DailyRecord {
  date: string
  newWords: string[]
  reviews: string[]
  scores: Record<string, number>
}

export interface ReviewRecord {
  date: string // "YYYY-MM-DD"
  correct: boolean
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

export interface CalcQuestion {
  display: string // "3 + 5 × 2 = ?"
  signature: string // canonical: "add(3,mul(5,2))"
  arity: 1 | 2 | 3
  level: CalcLevel
  answer: number
  isChallenge: boolean
  category: CalcCategory
  /** Per-question coin (before streak bonus). Challenge questions already include ×2 here. */
  coinBase: number
}

export interface CalcSettings {
  enableAddSub: boolean
  enableMulDiv: boolean
  enableMixed: boolean
  currentLevel: number // 1..18 — advanced by adaptive logic (capped at MAX_NUMERIC_LEVEL)
  adaptive: boolean
  soundEnabled: boolean
  lastCount: number // 20/30/50/100
  lastTimeLimit: number // seconds, 0=unlimited
  /** Global session counter — incremented every time a session finishes. Used by cold-problem rescue. */
  sessionCounter: number
  /** User-configured time limit overrides in milliseconds, keyed by category bucket (see calc-time-limits.ts). */
  timeLimitOverrides: Record<string, number>
  /**
   * Free-practice mode. When true, sessions are built from `freeModeLevels` (a user-picked subset),
   * the mastery state machine / adaptive level-up is skipped, and the single "currentLevel" cursor
   * is unused for question generation. Problem-state attempts are still recorded.
   */
  freeMode: boolean
  /** Levels the user picked for free-practice mode. May include 'C' (challenge). */
  freeModeLevels: CalcLevel[]
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
  shortMasteredAt: string | null // YYYY-MM-DD
  reviewR1Due: string | null
  reviewR2Due: string | null
  reviewR3Due: string | null
  longMastered: boolean
  lastSeenSession: number | null
  timesSeenThisRound: number
  consecutiveWrong: number
  forcedNext: boolean
  updatedAt: string
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
}

export interface CalcMistake {
  id?: string
  signature: string
  display: string
  answer: number
  level: CalcLevel
  category: CalcCategory
  lastWrongAt: string
  consecutiveCorrect: number // ≥3 ⇒ resolved
  resolved: boolean
}
