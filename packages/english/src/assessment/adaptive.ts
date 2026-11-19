// Server-side policy. Only the public projections are returned to the browser.
import { answerView, MAX_ITEMS, SEGMENT_SIZE, segmentQuestion, shuffle, type Answer, type Attempt,
  type AttemptView, type Question } from './model'
import { cellIndex, frequencyEstimate, FREQUENCY_BANDS, MAX_MAIN, TOTAL_WORDS } from './frequency'

export type Item = {
  itemId: string; word: string; referenceHeadword: string | null; catalogHeadwordId: string | null
  band: number | null; quartile: number | null; partOfSpeech: string; context: string
  definitionEn: string; definitionZh: string; distractors: string[]
  legacySource: { senseId: string } | null
}
export type PilotBank = { referenceVersion: string; main: Item[]; diagnostic: Item[] }
type PilotQuestion = Omit<Question, 'level'> & { band: number | null; quartile: number | null; segmentId: string }
type Mode = 'placement' | 'adaptive' | 'fallback' | 'diagnostic'
type Log = {
  id: string; parent: string | null; mode: Mode; seed: number; revision: number; start: number
  evidence: ReturnType<typeof frequencyEstimate>['cells']; range: AttemptView['liveRange']
  remaining: number[]; quotas: number[]; items: string[]; device: string
  alternateItems: string[]; depletedCells: number[]; acceptedRevision?: number
}
type Block = { log: Log; questions: PilotQuestion[] }
export type PilotAttempt = {
  modelVersion: 'frequency-v2-pilot-1'; policy: 'segment-1'; referenceVersion: string
  bankVersion: string; excluded: string[]; questions: PilotQuestion[]; answers: Answer[]
  checkpoints: { main: number; range: AttemptView['liveRange']; bands: AttemptView['bands'] }[]
  phase: Attempt['phase']; segments: Log[]; fallback: Block | null; diagnosticLeft: number
}

const representative = (item: Item) => item.referenceHeadword ?? item.word.toLowerCase()
const cell = (item: Item) => cellIndex(item.band!, item.quartile!)

function randomFrom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function remainingPool(state: PilotAttempt, items: Item[]) {
  const used = new Set([...state.excluded, ...state.questions.map(q => q.headwordId)])
  return items.filter(item => !used.has(representative(item)))
}

function selectBlock(state: PilotAttempt, bank: PilotBank, mode: Mode, revision: number,
  device: string, id: string, seed: number): Block | null {
  const random = randomFrom(seed)
  const score = frequencyEstimate(state.questions, state.answers)
  const diagnostic = mode === 'diagnostic'
  const pool = shuffle(remainingPool(state, diagnostic ? bank.diagnostic : bank.main), random)
  const reserved = new Set(state.fallback?.questions.map(q => q.headwordId))
  // Never substitute another branch after it has been adopted. At selection time
  // prefer fresh items outside the unused offer, retaining scarce cells if needed.
  if (mode === 'adaptive') pool.sort((a, b) => Number(reserved.has(representative(a))) - Number(reserved.has(representative(b))))
  const remaining = Array<number>(16).fill(0)
  const quotas = Array<number>(16).fill(0)
  const bandQuota = [0, 0, 0, 0]
  const counts = Array<number>(16).fill(0)
  for (const item of pool) if (item.band && item.quartile) remaining[cell(item)]++
  for (const q of state.questions) if (q.item_role === 'main' && q.band && q.quartile) counts[cellIndex(q.band, q.quartile)]++
  const chosen: Item[] = []
  if (diagnostic) {
    const priorities = score.bands.map(b => b.proportion === null ? 0 : 1 - b.proportion)
    pool.sort((a, b) => (b.band ? priorities[b.band - 1] : 0) - (a.band ? priorities[a.band - 1] : 0))
    chosen.push(...pool.slice(0, SEGMENT_SIZE))
  } else {
    if (mode === 'placement' && FREQUENCY_BANDS.some(b => pool.filter(i => i.band === b).length < 3)) return null
    for (let slot = 0; slot < SEGMENT_SIZE; slot++) {
      const available = FREQUENCY_BANDS.filter(b => bandQuota[b - 1] < 7 && pool.some(i => i.band === b))
      if (!available.length) return null
      const utility = (b: number) => {
        const k = bandQuota[b - 1]
        if (mode !== 'adaptive') return -k
        if (k === 0) return 1
        const n = score.bands[b - 1].valid
        return score.gains[b - 1] * (n + 1) * (n + 2) / ((n + k + 1) * (n + k + 2))
      }
      const band = available.sort((a, b) => utility(b) - utility(a))[0]
      const candidates = pool.filter(i => i.band === band)
      if (mode === 'placement' && slot === 0) candidates.sort((a, b) => a.quartile! - b.quartile!)
      const least = Math.min(...candidates.map(i => counts[cell(i)] + quotas[cell(i)]))
      const picked = candidates.find(i => counts[cell(i)] + quotas[cell(i)] === least)!
      chosen.push(picked)
      pool.splice(pool.indexOf(picked), 1)
      quotas[cell(picked)]++
      bandQuota[band - 1]++
    }
  }
  if (chosen.length !== SEGMENT_SIZE) return null
  const order = mode === 'placement' ? chosen : shuffle(chosen, random)
  const questions = order.map((item): PilotQuestion => {
    const options = shuffle([item.definitionEn, ...item.distractors], random)
    return { segmentId: id, senseId: item.itemId, senseRevision: 1, headwordId: representative(item),
      word: item.word, band: item.band, quartile: item.quartile, partOfSpeech: item.partOfSpeech,
      context: item.context, definitionEn: item.definitionEn, definitionZh: item.definitionZh,
      item_role: diagnostic ? 'diagnostic' : 'main', options, correctIndex: options.indexOf(item.definitionEn) }
  })
  if (diagnostic) for (const i of chosen) if (i.band && i.quartile) quotas[cell(i)]++
  return { log: { id, mode, parent: state.segments.at(-1)?.id ?? null, seed, revision,
    device, start: state.questions.length, evidence: score.cells, range: score.range,
    remaining, quotas, depletedCells: remaining.flatMap((count, i) => count ? [] : [i]),
    alternateItems: mode === 'adaptive' ? (state.fallback?.log.items ?? []) : [],
    items: questions.map(q => q.senseId) }, questions }
}

export function issueSegment(state: PilotAttempt, bank: PilotBank, mode: Mode, revision: number,
  device: string, makeId: () => string, makeSeed: () => number, fallbackId?: string): PilotAttempt | null {
  if (state.answers.length !== state.questions.length) return null
  const diagnostic = mode === 'diagnostic'
  const eligible = diagnostic
    ? state.answers.length >= 48 && state.diagnosticLeft >= SEGMENT_SIZE &&
      state.answers.filter(a => a.item_role === 'diagnostic').length < 24
    : state.questions.length < MAX_MAIN && !state.questions.some(q => q.item_role === 'diagnostic')
  if (!eligible || state.questions.length + SEGMENT_SIZE > MAX_ITEMS) return null
  const block = mode === 'fallback' ? state.fallback
    : selectBlock(state, bank, mode, revision, device, makeId(), makeSeed())
  if (!block || (mode === 'fallback' && (block.log.id !== fallbackId || block.log.device !== device ||
      block.log.parent !== state.segments.at(-1)?.id))) return null
  const next: PilotAttempt = { ...state, phase: 'question', questions: [...state.questions, ...block.questions],
    segments: [...state.segments, { ...block.log, acceptedRevision: state.segments.length ? revision + 1 : 0 }], fallback: null }
  next.diagnosticLeft = remainingPool(next, bank.diagnostic).length
  if (!diagnostic && next.questions.length < MAX_MAIN) {
    next.fallback = selectBlock(next, bank, 'fallback', revision, device, makeId(), makeSeed())
  }
  return next
}

export function startPilot(bank: PilotBank, version: string, excluded: string[], device: string,
  makeId: () => string, makeSeed: () => number) {
  const initial: PilotAttempt = { modelVersion: 'frequency-v2-pilot-1', policy: 'segment-1', checkpoints: [],
    referenceVersion: bank.referenceVersion, bankVersion: version, excluded, phase: 'question',
    questions: [], answers: [], segments: [], fallback: null, diagnosticLeft: 0 }
  return issueSegment(initial, bank, 'placement', 0, device, makeId, makeSeed)
}

export function pilotView(id: string, bankVersion: string, revision: number, state: PilotAttempt, device: string): AttemptView {
  const { answers, questions, phase } = state
  const answered = answers.length
  const score = frequencyEstimate(questions, answers)
  const diagnostics = answered - score.main
  const canContinue = answered < questions.length || Boolean(state.fallback)
  const canAddDiagnostics = answered === questions.length && phase !== 'submitted' &&
    score.main >= 48 && diagnostics < 24 && state.diagnosticLeft >= SEGMENT_SIZE && answered + SEGMENT_SIZE <= MAX_ITEMS
  const offerEarlyFinish = score.main >= 48 && (score.edge === 'floor' || score.edge === 'reading')
  const recent = answers.slice(-4)
  return {
    ...answerView(phase, questions, answers, MAX_ITEMS),
    id, bankVersion, revision, phase, answered, version: 2, activeSegmentId: state.segments.at(-1)?.id, mainAnswered: score.main, estimatedFrom: score.main,
    totalWords: TOTAL_WORDS, bands: score.bands, liveRange: score.range, range: score.range, previousRange: null,
    isPilot: true, formal: false, edge: score.edge, canContinue, offerEarlyFinish, canAddDiagnostics,
    suggestFinish: score.main >= 72 || (!canContinue && phase !== 'question'),
    suggestRest: recent.length === 4 && recent.every(a => a.elapsedMs !== null && a.elapsedMs < 900),
    resumedElsewhere: phase !== 'submitted' && state.segments.at(-1)?.device !== device,
    fallback: phase !== 'submitted' && state.fallback?.log.device === device ? {
      questions: state.fallback.questions.map((q, offset) => segmentQuestion(q, questions.length + offset)),
      endsAttempt: false } : null,
  }
}
