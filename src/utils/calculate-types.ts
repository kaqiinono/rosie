// ─────────────────────────────────────────────────────────────────────────
// 计算模块 v2 — 类型定义
// ─────────────────────────────────────────────────────────────────────────

/** 技能树 ID */
export type TreeId =
  | 'NS' // 数感基础
  | 'AS' // 加减法
  | 'MU' // 乘法
  | 'DI' // 除法
  | 'MX' // 四则混合
  | 'DE' // 小数
  | 'FR' // 分数
  | 'PC' // 百分数
  | 'NG' // 负数
  | 'PW' // 幂与根
  | 'AP' // 综合应用

/** 关卡 ID，格式 "AS-1", "MU-5" 等 */
export type LevelId = `${TreeId}-${number}`

/** 关卡内的三档难度 */
export type Tier = 'beginner' | 'advanced' | 'challenge'

/** 每档的状态 */
export type TierStatus = 'locked' | 'practicing' | 'passed'

/** 题目类型 */
export type QuestionType =
  | 'choice'       // 选择题 (4选1)
  | 'fill'         // 填空题 (数字键盘)
  | 'vertical'     // 竖式计算
  | 'fraction_vis' // 分数可视化 (饼图+滑块)
  | 'number_line'  // 数轴拖拽
  | 'step_solve'   // 分步应用题
  | 'equation_fill' // 等式填空

/** 运算符 */
export type Op = '+' | '-' | '×' | '÷'

/** 变体类型 */
export type Variant = 'A' | 'B' | 'C'

/** 错误模式标签 */
export type ErrorTag =
  | 'carry_miss'       // 进位遗漏
  | 'order_confusion'  // 运算顺序混淆
  | 'place_value'      // 数位理解偏差
  | 'fraction_concept' // 分子分母混淆
  | 'comprehension'    // 题意理解偏差
  | 'careless'         // 粗心计算失误
  | 'formula_misuse'   // 公式套用错误
  | 'estimation_off'   // 估算范围偏差

/** 干扰项类型 */
export type DistractorType =
  | 'carry_omit'     // 进位遗漏
  | 'order_swap'     // 顺序混淆
  | 'place_shift'    // 位值错误
  | 'close_number'   // 相近数字
  | 'denom_add'      // 分母直加
  | 'op_confusion'   // 符号混淆

// ─── 题目 ──────────────────────────────────────────────────────────────

export interface ChoiceOption {
  value: string
  distractorType: DistractorType | null // null = 正确答案
}

export interface CalculateQuestion {
  id: string
  levelId: LevelId
  type: QuestionType
  display: string
  answer: string
  variant: Variant
  difficulty: number // 0.1 ~ 0.9 (IRT b 值)
  starsBase: number
  options?: ChoiceOption[] // 选择题时有
  hint?: string
  explanation?: string
  /** 竖式计算：进位格的正确值 */
  carryDigits?: number[]
  /** 分步应用题：每步的正确算式和结果 */
  steps?: StepAnswer[]
}

export interface StepAnswer {
  label: string
  formula: string
  result: string
}

// ─── 答题结果 ──────────────────────────────────────────────────────────

export interface QuestionResult {
  questionId: string
  levelId: LevelId
  correct: boolean
  userAnswer: string
  timeMs: number
  variant: Variant
  errorTag: ErrorTag | null
  distractorType: DistractorType | null
}

// ─── 技能树 & 关卡配置 ─────────────────────────────────────────────────

export interface TreeConfig {
  id: TreeId
  name: string
  icon: string
  color: string // tailwind color class
  levels: LevelConfig[]
  prerequisites: LevelId[] // 前置关卡（其他树的）
}

export interface LevelConfig {
  id: LevelId
  name: string
  description: string
  starsPerQuestion: number
  bankSize: number
  questionTypes: QuestionType[]
  /** 关卡内前置（同一树内的上一关） */
  prevLevel: LevelId | null
}

export interface TierConfig {
  tier: Tier
  questionCount: number
  passRate: number // 0.70 / 0.80 / 0.85
  hasTimeLimit: boolean
  includesVariants: boolean
}

// ─── 用户状态 ──────────────────────────────────────────────────────────

export interface CalculateSettings {
  userId: string
  unlockedLevels: LevelId[]
  thetaPerTree: Record<TreeId, number>
  soundEnabled: boolean
  focusMode: boolean
  dailyTarget: number
  createdAt: string
  updatedAt: string
}

export interface CalculateTopicState {
  id: string
  userId: string
  topicId: string // "AS-3:carry_add"
  masteryRate: number // 0~1
  reviewInterval: number // days
  nextReviewDate: string | null // YYYY-MM-DD
  errorTags: ErrorTag[]
  attemptCount: number
  correctCount: number
  recentResults: TopicAttempt[]
  updatedAt: string
}

export interface TopicAttempt {
  correct: boolean
  timeMs: number
  variant: Variant
}

export interface CalculateLevelState {
  id: string
  userId: string
  levelId: LevelId
  tierBeginner: TierStatus
  tierAdvanced: TierStatus
  tierChallenge: TierStatus
  bestAccuracyBeginner: number | null
  bestAccuracyAdvanced: number | null
  bestAccuracyChallenge: number | null
  sessionCount: number
  updatedAt: string
}

// ─── Session ──────────────────────────────────────────────────────────

export type CalculateMode = 'daily' | 'level' | 'mistakes'

export interface CalculateSession {
  id?: string
  userId: string
  date: string // YYYY-MM-DD
  mode: CalculateMode
  levelId: LevelId | null
  tier: Tier | null
  count: number
  correctCount: number
  wrongCount: number
  timeSpentSec: number
  starsEarned: number
  maxStreak: number
  errorSummary: Record<ErrorTag, number>
  startedAt: string
  finishedAt: string
}

// ─── 错题 ──────────────────────────────────────────────────────────────

export interface CalculateMistake {
  id?: string
  userId: string
  questionSignature: string
  levelId: LevelId
  userAnswer: string
  correctAnswer: string
  errorTag: ErrorTag | null
  distractorType: DistractorType | null
  consecutiveCorrect: number
  resolved: boolean
  createdAt: string
  updatedAt: string
}

// ─── 事件日志 ──────────────────────────────────────────────────────────

export type CalculateEventType =
  | 'level_unlock'
  | 'tier_pass'
  | 'mastery_achieved'
  | 'review_due'
  | 'error_pattern_detected'

export interface CalculateEvent {
  id?: string
  userId: string
  eventType: CalculateEventType
  levelId: LevelId | null
  detail: Record<string, unknown>
  createdAt: string
}

// ─── IRT ──────────────────────────────────────────────────────────────

export interface IRTState {
  theta: number // 当前能力值
  lastUpdated: string
}

// ─── 评分 ──────────────────────────────────────────────────────────────

export interface ScoringResult {
  baseStars: number
  speedBonus: number
  streakMultiplier: number
  perfectBonus: number
  totalStars: number
}

export interface FirstClearBonus {
  beginner: number // 20
  advanced: number // 30
  challenge: number // 50
}
