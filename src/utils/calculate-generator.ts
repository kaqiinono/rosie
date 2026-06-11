import type {
  CalculateQuestion,
  CalculateTopicState,
  ChoiceOption,
  LevelId,
  QuestionType,
  Variant,
} from './calculate-types'
import { getLevel, getTreeForLevel } from './calculate-trees'
import { nextDifficulty } from './calculate-irt'
import { topicWeight, weightedSample, isReviewDue } from './calculate-mastery'
import { generateChoices } from './calculate-distractor'
import { generateAdvancedParams } from './calculate-gen-advanced'

// ─── Pipeline: KnowledgeSelector → ParamGenerator → QuestionRenderer → DifficultyChecker

let _qid = 0
function nextId(): string {
  return `q_${Date.now()}_${++_qid}`
}

// ─── 主入口 ──────────────────────────────────────────────────────────

export interface GenerateOptions {
  levelId: LevelId
  theta: number
  count: number
  topicStates: CalculateTopicState[]
  today: string
  tier: 'beginner' | 'advanced' | 'challenge'
}

/**
 * 为指定关卡生成一组题目。
 * Pipeline: 选知识点 → 生成参数 → 渲染题目 → 难度校验
 */
export function generateQuestions(opts: GenerateOptions): CalculateQuestion[] {
  const level = getLevel(opts.levelId)
  if (!level) return []

  const tree = getTreeForLevel(opts.levelId)
  if (!tree) return []

  const treeId = tree.id
  const questions: CalculateQuestion[] = []
  let targetDiff = nextDifficulty(opts.theta)

  for (let i = 0; i < opts.count; i++) {
    // 1. KnowledgeSelector — 选知识点/变体
    const variant = pickVariant(opts.tier, i)

    // 2. ParamGenerator — 生成参数
    const params = generateParams(treeId, opts.levelId, targetDiff)
    if (!params) continue

    // 3. QuestionRenderer — 渲染题目
    const qType = pickQuestionType(level.questionTypes, opts.tier)
    const q = renderQuestion(params, opts.levelId, qType, variant, level.starsPerQuestion)

    // 4. DifficultyChecker — 分配难度值
    q.difficulty = targetDiff

    questions.push(q)
    targetDiff = nextDifficulty(opts.theta)
  }

  return questions
}

/**
 * 错题专项模式：根据用户错题对应的关卡，重新生成题目。
 */
export function generateMistakesSession(
  mistakeLevelIds: LevelId[],
  theta: number,
  maxCount: number,
): CalculateQuestion[] {
  if (mistakeLevelIds.length === 0) return []

  const questions: CalculateQuestion[] = []
  const count = Math.min(maxCount, mistakeLevelIds.length * 2)
  let targetDiff = nextDifficulty(theta)

  for (let i = 0; i < count; i++) {
    const levelId = mistakeLevelIds[i % mistakeLevelIds.length]
    const level = getLevel(levelId)
    if (!level) continue
    const tree = getTreeForLevel(levelId)
    if (!tree) continue

    const variant = pickVariant('beginner', i)
    const params = generateParams(tree.id, levelId, targetDiff)
    if (!params) continue

    const qType = pickQuestionType(level.questionTypes, 'beginner')
    const q = renderQuestion(params, levelId, qType, variant, level.starsPerQuestion)
    q.difficulty = targetDiff
    questions.push(q)

    targetDiff = nextDifficulty(theta)
  }

  return questions
}

/**
 * 日常 Session 模式：跨关卡混合出题。
 * 根据知识点权重采样，优先薄弱点和即将遗忘的知识。
 */
export function generateDailySession(
  unlockedLevels: LevelId[],
  theta: number,
  count: number,
  topicStates: CalculateTopicState[],
  today: string,
): CalculateQuestion[] {
  const questions: CalculateQuestion[] = []

  // 按权重采样关卡
  const weights = unlockedLevels.map((lvId) => {
    const states = topicStates.filter((s) => s.topicId.startsWith(lvId))
    const avgMastery =
      states.length > 0 ? states.reduce((s, t) => s + t.masteryRate, 0) / states.length : 0
    const hasReviewDue = states.some((s) => isReviewDue(s, today))
    return topicWeight({
      masteryRate: avgMastery,
      daysSinceLastSeen: 3,
      recentCorrectStreak: 0,
      isCurrentLevelPriority: hasReviewDue,
    })
  })

  let targetDiff = nextDifficulty(theta)

  for (let i = 0; i < count; i++) {
    const idx = weightedSample(weights)
    const levelId = unlockedLevels[idx]
    const level = getLevel(levelId)
    if (!level) continue

    const tree = getTreeForLevel(levelId)
    if (!tree) continue

    const variant = pickVariant('beginner', i)
    const params = generateParams(tree.id, levelId, targetDiff)
    if (!params) continue

    const qType = pickQuestionType(level.questionTypes, 'beginner')
    const q = renderQuestion(params, levelId, qType, variant, level.starsPerQuestion)
    q.difficulty = targetDiff
    questions.push(q)

    targetDiff = nextDifficulty(theta)
  }

  return questions
}

// ─── 变体选择 ────────────────────────────────────────────────────────

function pickVariant(tier: string, index: number): Variant {
  if (tier === 'beginner') return 'A'
  if (tier === 'advanced') {
    return index % 3 === 0 ? 'B' : index % 3 === 1 ? 'C' : 'A'
  }
  // challenge: 均匀分布
  const variants: Variant[] = ['A', 'B', 'C']
  return variants[index % 3]
}

function pickQuestionType(available: QuestionType[], tier: string): QuestionType {
  if (tier === 'beginner' && available.includes('choice')) return 'choice'
  if (available.length === 1) return available[0]
  return available[Math.floor(Math.random() * available.length)]
}

// ─── 参数生成 ────────────────────────────────────────────────────────

interface QuestionParams {
  a: number
  b: number
  op: string
  answer: number
  display: string
  hint?: string
  explanation?: string
  /** 余数 (仅除法有余数时) */
  remainder?: number
  /** 分数答案：分子 */
  numerator?: number
  /** 分数答案：分母 */
  denominator?: number
  /** 应用题分步 */
  steps?: { label: string; formula: string; result: string }[]
  /** 固定选项（如 > < = 等非数字选择题） */
  fixedChoices?: string[]
  /** 固定答案（与 fixedChoices 配合使用） */
  fixedAnswer?: string
}

function generateParams(
  treeId: string,
  levelId: LevelId,
  difficulty: number,
): QuestionParams | null {
  const n = parseInt(levelId.split('-')[1])

  switch (treeId) {
    case 'AS':
      return generateAS(n, difficulty)
    case 'MU':
      return generateMU(n, difficulty)
    case 'DI':
      return generateDI(n, difficulty)
    default: {
      const advanced = generateAdvancedParams(treeId, levelId, difficulty)
      if (advanced) return advanced as QuestionParams
      return generateAS(1, difficulty)
    }
  }
}

// ─── AS 加减法生成器 ─────────────────────────────────────────────────

function generateAS(level: number, diff: number): QuestionParams {
  const isAdd = Math.random() > 0.4

  switch (level) {
    case 1: { // 10以内
      const a = randInt(1, 9)
      const b = isAdd ? randInt(1, 10 - a) : randInt(1, a)
      return asParams(a, b, isAdd)
    }
    case 2: { // 20以内不进位
      const a = randInt(10, 19)
      const b = isAdd ? randInt(1, 20 - a) : randInt(1, a % 10)
      return asParams(a, Math.max(1, b), isAdd)
    }
    case 3: { // 20以内进退位
      if (isAdd) {
        const a = randInt(5, 9)
        const b = randInt(20 - a - 9, 20 - a)
        return asParams(a, clampPos(b), true)
      }
      const a = randInt(11, 18)
      const b = randInt(a - 9, a - 1)
      return asParams(a, clampPos(b), false)
    }
    case 4: { // 100以内不进位
      const tens = randInt(1, 8) * 10
      const ones = randInt(0, 9)
      const a = tens + ones
      const bTens = randInt(0, 9 - Math.floor(a / 10)) * 10
      const bOnes = isAdd ? randInt(0, 9 - ones) : randInt(0, ones)
      const b = bTens + bOnes
      return asParams(a, Math.max(1, b), isAdd)
    }
    case 5: { // 100以内进退位
      if (isAdd) {
        const a = randInt(15, 85)
        const b = randInt(Math.max(1, 100 - a - 20), Math.min(99, 100 - a))
        return asParams(a, clampPos(b), true)
      }
      const a = randInt(20, 99)
      const b = randInt(1, a)
      return asParams(a, b, false)
    }
    case 6: { // 1000以内
      const a = randInt(100, 900)
      const b = randInt(50, Math.min(999 - a, 500))
      return asParams(a, b, isAdd)
    }
    case 7: { // 万以内 + 连加连减
      const a = randInt(1000, 8000)
      const b = randInt(500, 3000)
      return asParams(a, b, isAdd)
    }
    default:
      return asParams(randInt(1, 9), randInt(1, 9), true)
  }
}

function asParams(a: number, b: number, isAdd: boolean): QuestionParams {
  const answer = isAdd ? a + b : a - b
  const op = isAdd ? '+' : '-'
  return {
    a,
    b,
    op,
    answer,
    display: `${a} ${op} ${b} = ?`,
  }
}

// ─── MU 乘法生成器 ──────────────────────────────────────────────────

function generateMU(level: number, diff: number): QuestionParams {
  switch (level) {
    case 1: { // ×1,2,5
      const factors = [1, 2, 5]
      const a = factors[randInt(0, 2)]
      const b = randInt(1, 9)
      return mulParams(a, b)
    }
    case 2: { // ×3,4
      const a = Math.random() > 0.5 ? 3 : 4
      const b = randInt(1, 9)
      return mulParams(a, b)
    }
    case 3: { // ×6,7
      const a = Math.random() > 0.5 ? 6 : 7
      const b = randInt(1, 9)
      return mulParams(a, b)
    }
    case 4: { // ×8,9
      const a = Math.random() > 0.5 ? 8 : 9
      const b = randInt(1, 9)
      return mulParams(a, b)
    }
    case 5: { // 九九综合
      const a = randInt(1, 9)
      const b = randInt(1, 9)
      return mulParams(a, b)
    }
    case 6: { // 两位数×一位数
      const a = randInt(11, 99)
      const b = randInt(2, 9)
      return mulParams(a, b)
    }
    case 7: { // 两位数×两位数
      const a = randInt(11, 99)
      const b = randInt(11, 99)
      return mulParams(a, b)
    }
    default:
      return mulParams(randInt(1, 9), randInt(1, 9))
  }
}

function mulParams(a: number, b: number): QuestionParams {
  return {
    a,
    b,
    op: '×',
    answer: a * b,
    display: `${a} × ${b} = ?`,
  }
}

// ─── DI 除法生成器 ──────────────────────────────────────────────────

function generateDI(level: number, diff: number): QuestionParams {
  switch (level) {
    case 1: { // ÷1,2,5
      const divisors = [1, 2, 5]
      const b = divisors[randInt(0, 2)]
      const quotient = randInt(1, 9)
      return divParams(quotient * b, b)
    }
    case 2: { // ÷3,4
      const b = Math.random() > 0.5 ? 3 : 4
      const quotient = randInt(1, 9)
      return divParams(quotient * b, b)
    }
    case 3: { // ÷6~9
      const b = randInt(6, 9)
      const quotient = randInt(1, 9)
      return divParams(quotient * b, b)
    }
    case 4: { // 表内综合
      const b = randInt(1, 9)
      const quotient = randInt(1, 9)
      return divParams(quotient * b, b)
    }
    case 5: { // 有余数
      const b = randInt(2, 9)
      const quotient = randInt(1, 9)
      const remainder = randInt(1, b - 1)
      const a = quotient * b + remainder
      return {
        a,
        b,
        op: '÷',
        answer: quotient,
        remainder,
        display: `${a} ÷ ${b} = ? … ?`,
        hint: '商和余数分别填写',
      }
    }
    case 6: { // 多位数÷一位数
      const b = randInt(2, 9)
      const quotient = randInt(11, 99)
      return divParams(quotient * b, b)
    }
    default:
      return divParams(12, 3)
  }
}

function divParams(a: number, b: number): QuestionParams {
  return {
    a,
    b,
    op: '÷',
    answer: a / b,
    display: `${a} ÷ ${b} = ?`,
  }
}

// ─── 渲染题目对象 ────────────────────────────────────────────────────

function renderQuestion(
  params: QuestionParams,
  levelId: LevelId,
  qType: QuestionType,
  variant: Variant,
  starsBase: number,
): CalculateQuestion {
  let { display } = params
  const { answer } = params
  // 固定选项题（如比较大小 > <）
  if (params.fixedAnswer) {
    return buildQ(levelId, qType, display, params.fixedAnswer, variant, starsBase, params)
  }

  const answerStr =
    params.numerator !== undefined && params.denominator !== undefined
      ? `${params.numerator}/${params.denominator}`
      : params.remainder !== undefined
        ? `${params.answer}…${params.remainder}`
        : String(answer)

  const supportsVariant =
    !params.remainder && params.numerator === undefined && params.denominator === undefined

  // 变体 B: 逆运算 a ○ ? = c
  if (variant === 'B' && supportsVariant) {
    display = `${params.a} ${params.op} ? = ${answer}`
    const newAnswer = String(params.b)
    return buildQ(levelId, qType, display, newAnswer, variant, starsBase, params)
  }

  // 变体 C: ? ○ b = c
  if (variant === 'C' && supportsVariant) {
    display = `? ${params.op} ${params.b} = ${answer}`
    const newAnswer = String(params.a)
    return buildQ(levelId, qType, display, newAnswer, variant, starsBase, params)
  }

  return buildQ(levelId, qType, display, answerStr, variant, starsBase, params)
}

function buildQ(
  levelId: LevelId,
  qType: QuestionType,
  display: string,
  answerStr: string,
  variant: Variant,
  starsBase: number,
  params: QuestionParams,
): CalculateQuestion {
  const effectiveType = params.fixedChoices ? 'choice' as const : qType

  const q: CalculateQuestion = {
    id: nextId(),
    levelId,
    type: effectiveType,
    display,
    answer: answerStr,
    variant,
    difficulty: 0.5,
    starsBase,
    hint: params.hint,
    explanation: params.explanation,
    steps: params.steps,
  }

  if (effectiveType === 'choice') {
    if (params.fixedChoices && params.fixedChoices.length > 0) {
      q.options = params.fixedChoices.map((v) => ({
        value: v,
        distractorType: v === answerStr ? null : ('close_number' as const),
      }))
    } else {
      const numAnswer = parseFloat(answerStr)
      if (!isNaN(numAnswer)) {
        q.options = generateChoices(numAnswer, levelId)
      }
    }
  }

  return q
}

// ─── 工具函数 ────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clampPos(n: number): number {
  return Math.max(1, n)
}
