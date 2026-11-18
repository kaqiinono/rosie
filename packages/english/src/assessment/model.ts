export const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const
export const SEGMENT_SIZE = 12
export const MAX_ITEMS = 120
export const MIN_ESTIMATE_ITEMS = 48
export const MIN_VALID_PER_LEVEL = 12
export const UNREADABLE_LIMIT = 0.30
const MODEL_VERSION = 'stratified-v1'

export type Level = typeof LEVELS[number]
export type Range = { low: number; high: number }
export type Decision = 'answer' | 'unknown' | 'unreadable'
export type ReviewStatus = 'correct' | 'wrong' | 'unknown' | 'unreadable'

export type BankItem = {
  headwordId: string
  senseId: string
  senseRevision: number
  word: string
  level: Level
  partOfSpeech: string
  context: string
  definitionEn: string
  definitionZh: string
  distractors: [string, string, string]
  item_role: 'main' | 'diagnostic'
}

export type Calibration = {
  modelVersion: typeof MODEL_VERSION
  method: 'formula' | 'raw'
  maxRelativeWidth: number
  reference: string
}

export type Bank = { items: BankItem[]; calibration: Calibration | null }
export type LevelSizes = Record<Level, number>
export type Question = Omit<BankItem, 'distractors'> & { options: string[]; correctIndex: number }
export type Answer = {
  decision: Decision
  optionIndex: number | null
  item_role: Question['item_role']
  answeredAt: string
  elapsedMs: number | null
  operationId?: string
}

export type Attempt = {
  modelVersion: typeof MODEL_VERSION
  questions: Question[]
  answers: Answer[]
  sizes: LevelSizes
  calibration: Calibration | null
  phase: 'question' | 'break' | 'paused' | 'submitted'
}

export type PublicQuestion = Pick<Question, 'word' | 'partOfSpeech' | 'context' | 'options'>
export type SegmentQuestion = PublicQuestion & { id: string; index: number }
export type SeenWord = { index: number; word: string; decision: Decision }
export type QueuedAnswer = {
  operationId: string
  questionId: string
  index: number
  decision: Decision
  optionIndex?: number
  elapsedMs?: number
}
export type ReviewItem = PublicQuestion & Pick<Question, 'definitionEn' | 'definitionZh' | 'senseId'> & {
  status: ReviewStatus
  optionIndex: number | null
}

export type Band = {
  level: Level
  size: number
  answered: number
  unreadable: number
  valid: number
  proportion: number | null
}

export type AttemptView = {
  id: string
  bankVersion: string
  revision: number
  phase: Attempt['phase']
  answered: number
  mainAnswered: number
  estimatedFrom: number
  totalWords: number
  range: Range | null
  previousRange: Range | null
  liveRange: Range | null
  bands: Band[]
  isPilot: boolean
  formal: boolean
  offerEarlyFinish: boolean
  suggestFinish: boolean
  canAddDiagnostics: boolean
  suggestRest: boolean
  question: PublicQuestion | null
  nextQuestion?: PublicQuestion | null
  segment: { questions: SegmentQuestion[]; endsAttempt: boolean } | null
  answerReceipts: { index: number; operationId: string }[]
  seenWords: SeenWord[]
  review: ReviewItem[] | null
}

export type AttemptAction =
  | { kind: 'start'; previousId: string | null }
  | { kind: 'answer'; id: string; revision: number; decision: Decision; optionIndex?: number; elapsedMs?: number }
  | { kind: 'sync'; id: string; revision: number; answers: QueuedAnswer[] }
  | { kind: 'continue' | 'pause' | 'finish' | 'diagnostic'; id: string; revision: number }

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    const value = result[index]
    result[index] = result[other]
    result[other] = value
  }
  return result
}

function makeQuestion(item: BankItem, random: () => number): Question {
  const { distractors, ...target } = item
  const options = shuffle([target.definitionEn, ...distractors], random)
  return { ...target, options, correctIndex: options.indexOf(target.definitionEn) }
}

export function newAttempt(bank: Bank, random: () => number = Math.random): Attempt | null {
  const perLevelPerSegment = SEGMENT_SIZE / LEVELS.length
  const perLevel = MAX_ITEMS / LEVELS.length
  const pools = Object.fromEntries(LEVELS.map(level => [
    level,
    shuffle(bank.items.filter(item => item.item_role === 'main' && item.level === level), random),
  ])) as Record<Level, BankItem[]>

  if (LEVELS.some(level => pools[level].length < perLevel)) return null
  const questions: Question[] = []
  for (let offset = 0; offset < perLevel; offset += perLevelPerSegment) {
    const block = LEVELS.flatMap(level => pools[level].slice(offset, offset + perLevelPerSegment))
    questions.push(...shuffle(block, random).map(item => makeQuestion(item, random)))
  }

  return {
    modelVersion: MODEL_VERSION,
    questions,
    answers: [],
    sizes: Object.fromEntries(LEVELS.map(level => [level, pools[level].length])) as LevelSizes,
    calibration: bank.calibration,
    phase: 'question',
  }
}

function statusFor(question: Question, answer: Answer): ReviewStatus {
  if (answer.decision !== 'answer') return answer.decision
  return answer.optionIndex === question.correctIndex ? 'correct' : 'wrong'
}

function estimate(attempt: Attempt, count: number, lookStep = SEGMENT_SIZE) {
  const scores = Object.fromEntries(LEVELS.map(level => [level, {
    correct: 0, wrong: 0, unknown: 0, unreadable: 0,
  }])) as Record<Level, Record<ReviewStatus, number>>

  attempt.answers.slice(0, count).forEach((answer, index) => {
    const question = attempt.questions[index]
    if (answer.item_role !== 'main') return
    scores[question.level][statusFor(question, answer)]++
  })

  const wrongWeight = attempt.calibration?.method === 'raw' ? 0 : -1 / 3
  let lower = 0
  let upper = 0
  let varianceFactor = 0

  const bands: Band[] = LEVELS.map(level => {
    const { correct, wrong, unknown, unreadable } = scores[level]
    const valid = correct + wrong + unknown
    const answered = valid + unreadable
    const size = attempt.sizes[level]
    const corrected = correct + wrong * wrongWeight
    if (answered) {
      lower += (corrected + unreadable * wrongWeight) * size / answered
      upper += (corrected + unreadable) * size / answered
      varianceFactor += size * size / answered
    }
    return {
      level, size, answered, unreadable, valid,
      proportion: valid >= MIN_VALID_PER_LEVEL && unreadable / answered < UNREADABLE_LIMIT
        ? Math.max(0, Math.min(1, corrected / valid)) : null,
    }
  })

  const size = bands.reduce((sum, band) => sum + band.size, 0)
  const looks = 1 + (MAX_ITEMS - MIN_ESTIMATE_ITEMS) / lookStep
  // Bounded-score sampling margin, accounting for the frequency of updates.
  // Treat unreadable responses as unknown within the full score range.
  const margin = (1 - wrongWeight) * Math.sqrt(varianceFactor * Math.log(2 * looks / 0.05) / 2)
  const bound = (value: number) => Math.min(size, Math.max(0, value))
  const range = count >= MIN_ESTIMATE_ITEMS && bands.every(band => band.proportion !== null)
    ? { low: bound(Math.floor((lower - margin) / 10) * 10),
        high: bound(Math.ceil((upper + margin) / 10) * 10) } : null
  return { bands, size, range }
}

export function attemptView(id: string, bankVersion: string, revision: number, attempt: Attempt): AttemptView {
  const { phase, answers, questions, calibration } = attempt
  const answered = answers.length
  const mainAnswered = answers.filter(answer => answer.item_role === 'main').length
  const scheduledCount = Math.floor(mainAnswered / SEGMENT_SIZE) * SEGMENT_SIZE
  const current = estimate(attempt, scheduledCount)
  const liveRange = phase !== 'submitted' && mainAnswered >= MIN_ESTIMATE_ITEMS
    ? estimate(attempt, mainAnswered, 1).range : null
  const previousRange = scheduledCount > MIN_ESTIMATE_ITEMS
    ? estimate(attempt, scheduledCount - SEGMENT_SIZE).range : null
  const a1 = current.bands[0]
  const offerEarlyFinish = mainAnswered >= MIN_ESTIMATE_ITEMS && (
    (a1.proportion !== null && a1.proportion < 0.30) ||
    (a1.answered > 0 && a1.unreadable / a1.answered >= UNREADABLE_LIMIT)
  )
  const formal = Boolean(calibration && current.range && scheduledCount >= 72 &&
    (current.range.high - current.range.low) / current.size <= calibration.maxRelativeWidth)
  const suggestFinish = (mainAnswered === 72 || mainAnswered === 96) &&
    (formal || (mainAnswered === 96 && !calibration && current.range !== null))
  const recent = answers.slice(-4)
  const suggestRest = recent.length === 4 &&
    (recent.every(answer => answer.elapsedMs !== null && answer.elapsedMs < 900) ||
      (recent.filter(answer => answer.decision === 'unknown').length >= 3 &&
        recent.every(answer => answer.elapsedMs !== null && answer.elapsedMs < 3_000)))
  const publicQuestion = ({ word, partOfSpeech, context, options }: Question): PublicQuestion =>
    ({ word, partOfSpeech, context, options })
  const segmentEnd = Math.min(questions.length, (Math.floor(answered / SEGMENT_SIZE) + 1) * SEGMENT_SIZE)
  const segment = phase === 'question' ? {
    questions: questions.slice(answered, segmentEnd).map((question, offset) => ({
      ...publicQuestion(question), id: question.senseId, index: answered + offset,
    })),
    endsAttempt: segmentEnd === questions.length,
  } : null
  const nextQuestion = segment?.questions[1]
  const receiptStart = Math.max(0, answered - SEGMENT_SIZE)
  return {
    id, bankVersion, revision, phase, answered, mainAnswered, estimatedFrom: scheduledCount, totalWords: current.size,
    range: current.range, previousRange, liveRange, bands: current.bands,
    isPilot: !calibration, formal, offerEarlyFinish, suggestFinish, suggestRest,
    canAddDiagnostics: phase === 'break' && mainAnswered === answered && answered >= 72 &&
      answered + SEGMENT_SIZE <= MAX_ITEMS && suggestFinish,
    question: phase === 'question' ? publicQuestion(questions[answered]) : null,
    nextQuestion: nextQuestion ? publicQuestion(nextQuestion) : null,
    segment,
    answerReceipts: answers.slice(receiptStart).flatMap(({ operationId }, offset) =>
      operationId ? [{ operationId, index: receiptStart + offset }] : []),
    seenWords: phase === 'submitted' ? [] : answers.map((answer, index) => ({
      index, word: questions[index].word, decision: answer.decision,
    })),
    review: phase === 'submitted' ? answers.map((answer, index) => {
      const question = questions[index]
      return {
        ...publicQuestion(question), senseId: question.senseId, definitionEn: question.definitionEn,
        definitionZh: question.definitionZh,
        status: statusFor(question, answer), optionIndex: answer.optionIndex,
      }
    }) : null,
  }
}

export function addDiagnostics(attempt: Attempt, bank: Bank, random: () => number = Math.random) {
  const used = new Set(attempt.questions.slice(0, attempt.answers.length).map(item => item.headwordId))
  const bands = estimate(attempt, attempt.answers.length).bands
  const focus = bands.find(band => band.proportion !== null && band.proportion < 0.70)?.level
  const choices = shuffle(bank.items, random).sort((left, right) => {
    const priority = (item: BankItem) => Number(item.level === focus) * 2 + Number(item.item_role === 'diagnostic')
    return priority(right) - priority(left)
  })
  const questions: Question[] = []
  for (const item of choices) {
    if (used.has(item.headwordId)) continue
    used.add(item.headwordId)
    questions.push(makeQuestion({ ...item, item_role: 'diagnostic' }, random))
    if (questions.length === SEGMENT_SIZE) break
  }
  return questions.length === SEGMENT_SIZE
    ? { ...attempt, questions: [...attempt.questions.slice(0, attempt.answers.length), ...questions],
        phase: 'question' as const }
    : null
}
