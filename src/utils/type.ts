export interface ModuleCardData {
  href: string
  title: string
  description: string
  tag: string
  variant: 'math' | 'english'
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
  finalQ: string
  finalUnit: string
  finalAns: number
}

export interface ProblemSet {
  pretest: Problem[]
  lesson: Problem[]
  homework: Problem[]
  workbook: Problem[]
}

export type PageName = 'home' | 'lesson' | 'homework' | 'workbook' | 'alltest' | 'pretest' | 'detail'

export interface WordEntry {
  unit: string
  lesson: string
  word: string
  explanation: string
  ipa?: string
  example?: string
  phonics?: string
}

export type QuizType = 'wordToMeaning' | 'meaningToWord' | 'spelling'

export interface DailyRecord {
  date: string
  newWords: string[]
  reviews: string[]
  scores: Record<string, number>
}

export interface WordMasteryInfo {
  correct: number
  incorrect: number
  lastSeen: string
  stage?: number          // 0-7 (normal) or 0-8 (hard); undefined = not yet initialized
  nextReviewDate?: string // "YYYY-MM-DD"
  isHard?: boolean        // true after regressing from stage >= 2
}

export type WordMasteryMap = Record<string, WordMasteryInfo>

export interface WeeklyPlanDay {
  date: string           // ISO date e.g. "2026-03-20"
  newWordKeys: string[]  // word keys for new words from active lesson
}

export interface WeekDayProgress {
  quizDone: boolean
  lastScore?: number     // percentage 0–100
  completedAt?: string   // ISO date
}

export interface WeeklyPlan {
  weekStart: string      // ISO date of the Thursday starting this week
  unit: string
  lesson: string
  days: WeeklyPlanDay[]  // 7 entries index 0=Thu … 6=Wed
  progress: Record<string, WeekDayProgress>  // keyed by date string
}

// Math weekly plan types

export interface MathPlanProblem {
  key: string       // globally unique key e.g. "35::L1"
  lessonId: string  // "35" | "36"
  section: string   // "lesson" | "homework" | "workbook" | "pretest"
  index: number     // 1-based, used to construct URL e.g. /math/ny/35/lesson/1
  title: string     // problem title
  problemId: string // original Problem.id e.g. "36-L1"
}

export interface MathWeeklyPlanDay {
  date: string                        // "YYYY-MM-DD"
  problems: MathPlanProblem[]         // required problems (ordered)
  optionalProblems: MathPlanProblem[] // optional problems (W7-12)
}

export interface MathDayProgress {
  doneKeys: string[]    // completed problem key list
  completedAt?: string  // time when all required problems were completed
}

export interface MathWeeklyPlan {
  weekStart: string                           // ISO date (same Thursday start as English)
  lessonId: string                            // "35" | "36"
  days: MathWeeklyPlanDay[]                   // 7 days
  progress: Record<string, MathDayProgress>   // key = date string
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
  planLessonId: string                              // ties state to current plan, e.g. "36"
  lessonOrder: string[]                             // ordered prior lesson IDs to cycle, e.g. ["32","33","35"]
  nextLessonIndex: number                           // index into lessonOrder for next day's assignment
  perLesson: Record<string, PerLessonRotationState> // per-lesson problem-level state
  dailyAssignments: Record<string, string[]>        // date → assigned problem keys
  dailyDoneKeys: Record<string, string[]>           // date → completed problem keys
}

export interface MathWeeklyLessonReviewState {
  planLessonId: string                    // bound to current lesson plan; reset when lesson changes
  reviewCounts: Record<string, number>    // problemKey → times selected and completed
  dailyAssignments: Record<string, string>  // date → assigned problemKey (one per day)
  dailyDoneKeys: Record<string, string[]>   // date → completed keys
  dailySkipped: Record<string, true>        // date → skipped flag
}
