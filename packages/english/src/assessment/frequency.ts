// Pilot estimates use a fixed reference population, independent of the question pool.
import { MIN_VALID_PER_LEVEL, UNREADABLE_LIMIT, type Answer, type Band, type Range } from './model'

export const FREQUENCY_BANDS = [1, 2, 3, 4] as const
export const QUARTILES = [1, 2, 3, 4] as const
export const CELL_WORDS = 250
export const TOTAL_WORDS = 4000
export const MAX_MAIN = 96
export const FIRST_RANGE_VALID_PER_BAND = 2
type Evidence = { correct: number; wrong: number; unknown: number; unreadable: number }
type ScoreQuestion = { band: number | null; quartile: number | null; correctIndex: number }
export type DisplayRange = Range & { center: number }

function empty(): Evidence {
  return { correct: 0, wrong: 0, unknown: 0, unreadable: 0 }
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const valid = (e: Evidence) => e.correct + e.wrong + e.unknown
const net = (e: Evidence) => e.correct - e.wrong / 3
export const cellIndex = (band: number, quartile: number) => 4 * (band - 1) + quartile - 1

export function frequencyEstimate(questions: ScoreQuestion[], answers: Answer[]) {
  const cells = Array.from({ length: 16 }, empty)
  let main = 0
  answers.forEach((answer, index) => {
    if (answer.item_role !== 'main') return
    const q = questions[index]
    if (q?.band == null || q.quartile == null) throw new Error('Missing main item stratum')
    const status = answer.decision === 'answer'
      ? answer.optionIndex === q.correctIndex ? 'correct' : 'wrong' : answer.decision
    cells[cellIndex(q.band, q.quartile)][status]++
    main++
  })

  let center = 0
  let unknownWords = 0
  let lowerBase = 0
  let lowerVar = 0
  let upperVar = 0
  const gains: number[] = []
  const bands: Band[] = []
  const shares: number[] = []
  for (const band of FREQUENCY_BANDS) {
    const group = cells.slice((band - 1) * 4, band * 4)
    const n = group.reduce((sum, cell) => sum + valid(cell), 0)
    const unreadable = group.reduce((sum, cell) => sum + cell.unreadable, 0)
    const answered = n + unreadable
    const prior = clamp((group.reduce((sum, cell) => sum + net(cell), 0) + 1) / (n + 2))
    let knownWords = 0
    let measuredWeight = 0
    let inverseSize = 0
    let bandCenter = 0
    for (const cell of group) {
      const v = valid(cell)
      const count = v + cell.unreadable
      // A single pooled pseudo-observation limits jumps in sparse quartiles.
      bandCenter += CELL_WORDS * (net(cell) + prior) / (v + 1)
      const weight = count ? CELL_WORDS * v / count : 0
      knownWords += v ? weight * net(cell) / v : 0
      measuredWeight += weight
      if (v) inverseSize += weight ** 2 / v
    }
    bandCenter = 1000 * clamp(bandCenter / 1000)
    knownWords = Math.max(0, Math.min(measuredWeight, knownWords))
    center += bandCenter
    shares.push(bandCenter / 1000)
    bands.push({ level: `第 ${band} 千词段`, size: 1000, answered, valid: n, unreadable,
      proportion: n >= MIN_VALID_PER_LEVEL && unreadable / answered < UNREADABLE_LIMIT ? bandCenter / 1000 : null })
    lowerBase += knownWords
    unknownWords += 1000 - measuredWeight
    // Wilson-style pilot bounds on the bounded score [-1/3, 1].
    // Missing strata and unreadable responses retain their full unknown mass.
    if (inverseSize > 0) {
      const effective = measuredWeight ** 2 / inverseSize
      const mean = knownWords / measuredWeight
      const p = (3 * mean + 1) / 4
      const z = 1.96
      const denom = 1 + z ** 2 / effective
      const middle = (p + z ** 2 / (2 * effective)) / denom
      const radius = z / denom * Math.sqrt(p * (1 - p) / effective + z ** 2 / (4 * effective ** 2))
      lowerVar += (measuredWeight * (mean - clamp((4 * (middle - radius) - 1) / 3))) ** 2
      upperVar += (measuredWeight * (clamp((4 * (middle + radius) - 1) / 3) - mean)) ** 2
    }
    const readability = (n + 1) / (answered + 1)
    gains.push(readability * (0.06 + prior * (1 - prior)) / ((n + 1) * (n + 2)))
  }

  const rough = Math.round(center / 50) * 50
  const range: DisplayRange | null = main >= 12 && bands.every(b => b.valid >= FIRST_RANGE_VALID_PER_BAND)
    ? { center: rough,
        low: Math.max(0, Math.min(rough, 50 * Math.floor((lowerBase - Math.sqrt(lowerVar)) / 50))),
        high: Math.min(TOTAL_WORDS, Math.max(rough, 50 * Math.ceil((lowerBase + unknownWords + Math.sqrt(upperVar)) / 50))) }
    : null
  const reading = bands.some(b => b.answered >= 3 && b.unreadable / b.answered >= UNREADABLE_LIMIT)
  const edge = main < 24 ? null : reading ? 'reading' as const
    : bands.every(b => b.valid >= 3) && shares.every(p => p >= 0.90) ? 'ceiling' as const
    : shares[0] < 0.3 ? 'floor' as const : null
  return { range, bands, main, edge, gains, cells }
}
