import type { CalcQuestion } from '@rosie/core'
import { makeQuestion, parseSignature, signatureOf, type AstNode, type CalcOp } from './calc-ast'
import { hasAnyCarry, hasConsecutiveCarries, needsDivMidRemainder } from './calc-block-gens'
import { remainderAnswer } from './calc-answer'

export interface IntegerFact {
  op: CalcOp
  left: number
  right: number
}

export interface IntegerCurriculum {
  blockId: string
  version: number
  count(): number
  contains(question: IntegerFact): boolean
  canonicalize(question: IntegerFact): IntegerFact
  rank(question: IntegerFact): number | null
  unrank(index: number): IntegerFact
  difficultyKey(question: IntegerFact): readonly number[]
  stageOf(question: IntegerFact): string
  stageCount(stageId: string): number
  neighbors(index: number, before: number, after: number): IntegerFact[]
  displayVariant(question: IntegerFact, seed: number): IntegerFact
}

export const INTEGER_CURRICULUM_VERSION = 1

export function evaluateIntegerFact(q: IntegerFact): number {
  switch (q.op) {
    case 'add': return q.left + q.right
    case 'sub': return q.left - q.right
    case 'mul': return q.left * q.right
    case 'div': return q.left / q.right
  }
}

/** Global curriculum gate. Excluded facts are never generated, covered, or reviewed. */
export function isGloballyEligible(q: IntegerFact): boolean {
  if (!Number.isInteger(q.left) || !Number.isInteger(q.right)) return false
  if (q.left <= 0 || q.right <= 0) return false
  if (q.op === 'mul' && (q.left === 1 || q.right === 1)) return false
  if (q.op === 'div' && q.right === 1) return false
  const result = evaluateIntegerFact(q)
  return Number.isFinite(result) && result !== 0 && result !== 1
}

export function canonicalizeIntegerFact(q: IntegerFact): IntegerFact {
  if ((q.op === 'add' || q.op === 'mul') && q.left > q.right) {
    return { ...q, left: q.right, right: q.left }
  }
  return q
}

export function coverageSignature(q: IntegerFact): string {
  const c = canonicalizeIntegerFact(q)
  return signatureOf({ op: c.op, left: c.left, right: c.right } as AstNode)
}

export function factFromSignature(signature: string): IntegerFact | null {
  try {
    const ast = parseSignature(signature)
    if (typeof ast === 'number' || typeof ast.left !== 'number' || typeof ast.right !== 'number') return null
    return { op: ast.op, left: ast.left, right: ast.right }
  } catch {
    return null
  }
}

function digits(n: number): number { return Math.max(1, String(Math.abs(n)).length) }

function columnMetrics(left: number, right: number, mode: 'add' | 'sub') {
  let a = left, b = right, carry = 0, count = 0, run = 0, maxRun = 0, active = 0, crossingZero = 0
  while (a > 0 || b > 0) {
    const da = a % 10, db = b % 10
    if (da !== 0 || db !== 0) active++
    let hit = false
    if (mode === 'add') {
      hit = da + db + carry >= 10
      carry = hit ? 1 : 0
    } else {
      const adjusted = da - carry
      hit = adjusted < db
      if (hit && da === 0) crossingZero++
      carry = hit ? 1 : 0
    }
    if (hit) { count++; run++; maxRun = Math.max(maxRun, run) } else run = 0
    a = Math.floor(a / 10); b = Math.floor(b / 10)
  }
  return { count, maxRun, active, crossingZero }
}

function trailingZeros(n: number): number {
  let x = n, count = 0
  while (x > 0 && x % 10 === 0) { count++; x /= 10 }
  return count
}

function mulCarryMetrics(left: number, right: number) {
  const small = Math.min(left, right), large = Math.max(left, right)
  if (small > 9) return { count: 0, maxRun: 0 }
  const mask = String(large).split('').reverse().map(Number).map((d) => d * small >= 10)
  let count = 0, run = 0, maxRun = 0
  for (const hit of mask) {
    if (hit) { count++; run++; maxRun = Math.max(maxRun, run) } else run = 0
  }
  return { count, maxRun }
}

export function integerDifficultyKey(raw: IntegerFact): readonly number[] {
  const q = canonicalizeIntegerFact(raw)
  const result = evaluateIntegerFact(q)
  if (q.op === 'add') {
    const m = columnMetrics(q.left, q.right, 'add')
    return [Math.max(digits(q.left), digits(q.right)), m.count, m.maxRun, m.active, digits(q.right), result, q.left, q.right]
  }
  if (q.op === 'sub') {
    const m = columnMetrics(q.left, q.right, 'sub')
    return [digits(q.left), m.count, m.maxRun, m.crossingZero, m.active, result, q.left, q.right]
  }
  if (q.op === 'mul') {
    const m = mulCarryMetrics(q.left, q.right)
    const nonZero = `${q.left}${q.right}`.split('').filter((d) => d !== '0').length
    const partials = digits(q.left) * digits(q.right)
    return [digits(q.left) * 10 + digits(q.right), nonZero, partials, m.count, m.maxRun,
      trailingZeros(q.left) + trailingZeros(q.right), result, q.left, q.right]
  }
  const quotient = q.left / q.right
  const quotientText = Number.isInteger(quotient) ? String(quotient) : ''
  return [digits(q.right), digits(Math.floor(quotient)), digits(q.left), q.left % q.right === 0 ? 0 : 1,
    [...quotientText].filter((d) => d === '0').length, q.left % q.right, q.left, q.right]
}

function compareKey(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

function stageId(q: IntegerFact): string {
  const k = integerDifficultyKey(q)
  if (q.op === 'add') return `add:d${k[0]}:carry${k[1]}:run${k[2]}:active${k[3]}`
  if (q.op === 'sub') return `sub:d${k[0]}:borrow${k[1]}:run${k[2]}:zero${k[3]}`
  if (q.op === 'mul') return `mul:d${k[0]}:carry${k[3]}:run${k[4]}`
  return `div:d${k[0]}:steps${k[2]}:rem${k[3]}`
}

type FactBuilder = () => Iterable<IntegerFact>

function makeMaterializedCurriculum(
  blockId: string,
  build: FactBuilder,
  keyOf: (question: IntegerFact) => readonly number[] = integerDifficultyKey,
): IntegerCurriculum {
  let factsCache: IntegerFact[] | null = null
  let rankCache: Map<string, number> | null = null
  const facts = () => {
    if (factsCache) return factsCache
    const bySignature = new Map<string, IntegerFact>()
    for (const raw of build()) {
      const fact = canonicalizeIntegerFact(raw)
      if (isGloballyEligible(fact)) bySignature.set(coverageSignature(fact), fact)
    }
    factsCache = [...bySignature.values()].sort((a, b) => compareKey(keyOf(a), keyOf(b)))
    rankCache = new Map(factsCache.map((q, index) => [coverageSignature(q), index]))
    return factsCache
  }
  const api: IntegerCurriculum = {
    blockId,
    version: INTEGER_CURRICULUM_VERSION,
    count: () => facts().length,
    contains: (q) => isGloballyEligible(q) && (rankCache ?? (facts(), rankCache!)).has(coverageSignature(q)),
    canonicalize: canonicalizeIntegerFact,
    rank: (q) => {
      if (!isGloballyEligible(q)) return null
      facts()
      return rankCache!.get(coverageSignature(q)) ?? null
    },
    unrank: (index) => {
      const q = facts()[index]
      if (!q) throw new RangeError(`curriculum index out of range: ${blockId}#${index}`)
      return q
    },
    difficultyKey: keyOf,
    stageOf: stageId,
    stageCount: (id) => facts().filter((q) => stageId(q) === id).length,
    neighbors: (index, before, after) => facts().slice(Math.max(0, index - before), index + after + 1),
    displayVariant: (q, seed) => (q.op === 'add' || q.op === 'mul') && seed % 2 === 1
      ? { ...q, left: q.right, right: q.left }
      : q,
  }
  return api
}

function* pairs(op: CalcOp, aMin: number, aMax: number, bMin: number, bMax: number): Iterable<IntegerFact> {
  for (let a = aMin; a <= aMax; a++) for (let b = bMin; b <= bMax; b++) yield { op, left: a, right: b }
}

const curriculumBuilders: Record<string, FactBuilder> = {
  'add:10': function* () { for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) if (a + b <= 10) yield { op: 'add', left: a, right: b } },
  'add:20a': function* () { for (const q of pairs('add', 10, 19, 1, 9)) if (q.left + q.right <= 19 && columnMetrics(q.left, q.right, 'add').count === 0) yield q },
  'add:20b': function* () { for (const q of pairs('add', 2, 9, 2, 9)) if (q.left + q.right >= 11 && q.left + q.right <= 18) yield q },
  'add:100a': function* () { for (const q of pairs('add', 10, 89, 1, 89)) if (q.left + q.right <= 99 && columnMetrics(q.left, q.right, 'add').count === 0) yield q },
  'add:100b': function* () { for (const q of pairs('add', 10, 89, 1, 89)) if (q.left + q.right <= 99 && columnMetrics(q.left, q.right, 'add').count >= 1) yield q },
  'add:100-comp': function* () { for (let a = 1; a <= 50; a++) yield { op: 'add', left: a, right: 100 - a } },
  'sub:100a': function* () { for (const q of pairs('sub', 10, 99, 1, 98)) if (q.left - q.right >= 2 && columnMetrics(q.left, q.right, 'sub').count === 0) yield q },
  'sub:100b': function* () { for (const q of pairs('sub', 10, 100, 1, 99)) if (q.left - q.right >= 2 && columnMetrics(q.left, q.right, 'sub').count >= 1) yield q },
  'sub:round': function* () { for (let b = 1; b <= 98; b++) if (100 - b >= 2) yield { op: 'sub', left: 100, right: b }; for (let b = 1; b <= 998; b++) if (1000 - b >= 2) yield { op: 'sub', left: 1000, right: b } },
  'sub:10': function* () { for (const q of pairs('sub', 1, 10, 1, 9)) if (q.left - q.right >= 2) yield q },
  'sub:20a': function* () { for (const q of pairs('sub', 10, 20, 1, 9)) if (q.left - q.right >= 2 && columnMetrics(q.left, q.right, 'sub').count === 0) yield q },
  'sub:20b': function* () { for (const q of pairs('sub', 11, 18, 1, 9)) if (q.left - q.right >= 2 && columnMetrics(q.left, q.right, 'sub').count >= 1) yield q },
  'mul:25': function* () { for (const k of [2, 5]) for (let b = 2; b <= 9; b++) yield { op: 'mul', left: k, right: b } },
  'mul:34': function* () { for (const k of [3, 4]) for (let b = 2; b <= 9; b++) yield { op: 'mul', left: k, right: b } },
  'mul:67': function* () { for (const k of [6, 7]) for (let b = 2; b <= 9; b++) yield { op: 'mul', left: k, right: b } },
  'mul:89': function* () { for (const k of [8, 9]) for (let b = 2; b <= 9; b++) yield { op: 'mul', left: k, right: b } },
  'mul:29': function* () { yield* pairs('mul', 2, 9, 2, 9) },
  'mul:1012': function* () { for (const k of [10, 11, 12]) for (let b = 2; b <= 12; b++) yield { op: 'mul', left: k, right: b } },
  'mul:1319': function* () { for (let k = 13; k <= 19; k++) for (let b = 2; b <= 19; b++) yield { op: 'mul', left: k, right: b } },
  'mul:219': function* () { yield* pairs('mul', 2, 19, 2, 19) },
  'mul:2d1d-nc': function* () { for (const q of pairs('mul', 11, 99, 2, 9)) if (!hasAnyCarry(q.left, q.right)) yield q },
  'mul:2d1d-c': function* () { for (const q of pairs('mul', 11, 99, 2, 9)) if (hasAnyCarry(q.left, q.right)) yield q },
  'mul:3d1d-nc': function* () { for (const q of pairs('mul', 100, 999, 2, 9)) if (!hasAnyCarry(q.left, q.right)) yield q },
  'mul:3d1d-c': function* () { for (const q of pairs('mul', 100, 999, 2, 9)) if (hasConsecutiveCarries(q.left, q.right, 2)) yield q },
  'mul:zeros': function* () {
    for (let a = 2; a <= 900; a++) for (let b = Math.max(2, a); b <= 900; b++) {
      if ((a % 10 === 0 || b % 10 === 0) && a * b <= 9999 && trailingZeros(a) + trailingZeros(b) <= 2) yield { op: 'mul', left: a, right: b }
    }
  },
  'mul:2d': function* () { yield* pairs('mul', 11, 99, 11, 99) },
  'div:25': function* () { for (const d of [2, 5]) for (let q = 2; q <= 9; q++) yield { op: 'div', left: d * q, right: d } },
  'div:34': function* () { for (const d of [3, 4]) for (let q = 2; q <= 9; q++) yield { op: 'div', left: d * q, right: d } },
  'div:69': function* () { for (let d = 6; d <= 9; d++) for (let q = 2; q <= 9; q++) yield { op: 'div', left: d * q, right: d } },
  'div:29': function* () { for (let d = 2; d <= 9; d++) for (let q = 2; q <= 9; q++) yield { op: 'div', left: d * q, right: d } },
  'div:1012': function* () { for (let d = 10; d <= 12; d++) for (let q = 2; q <= 12; q++) yield { op: 'div', left: d * q, right: d } },
  'div:1319': function* () { for (let d = 13; d <= 19; d++) for (let q = 2; q <= 19; q++) yield { op: 'div', left: d * q, right: d } },
  'div:219': function* () { for (let d = 2; d <= 19; d++) for (let q = 2; q <= 19; q++) yield { op: 'div', left: d * q, right: d } },
  'div:multi': function* () { for (let d = 2; d <= 9; d++) for (let q = 11; d * q <= 99; q++) if (!needsDivMidRemainder(d * q, d)) yield { op: 'div', left: d * q, right: d } },
  'div:2d1d-borrow': function* () { for (let d = 2; d <= 9; d++) for (let q = 11; d * q <= 99; q++) if (needsDivMidRemainder(d * q, d)) yield { op: 'div', left: d * q, right: d } },
  'div:zeros': function* () { for (let d = 2; d <= 900; d++) for (let q = 2; d * q <= 9999; q++) if ((d % 10 === 0 || d * q % 10 === 0) && trailingZeros(d) + trailingZeros(q) <= 2) yield { op: 'div', left: d * q, right: d } },
  'div:rem': function* () { for (let d = 2; d <= 9; d++) for (let q = 2; q <= 9; q++) for (let r = 1; r < d; r++) yield { op: 'div', left: d * q + r, right: d } },
}

const CURRICULA = new Map<string, IntegerCurriculum>()

export function curriculumForBlock(blockId: string): IntegerCurriculum | null {
  const cached = CURRICULA.get(blockId)
  if (cached) return cached
  const build = curriculumBuilders[blockId]
  if (!build) return null
  const curriculum = makeMaterializedCurriculum(
    blockId,
    build,
    blockId === 'add:10' ? (q) => [q.left, q.right] : integerDifficultyKey,
  )
  CURRICULA.set(blockId, curriculum)
  return curriculum
}

export function questionFromCurriculum(blockId: string, index: number, seed = index): CalcQuestion | null {
  const curriculum = curriculumForBlock(blockId)
  if (!curriculum) return null
  const fact = curriculum.displayVariant(curriculum.unrank(index), seed)
  const category = fact.op === 'add' || fact.op === 'sub' ? 'addsub' : 'muldiv'
  if (blockId === 'div:rem') {
    const quotient = Math.floor(fact.left / fact.right)
    return {
      display: `${fact.left} ÷ ${fact.right} = ?`,
      signature: `div(${fact.left},${fact.right})`,
      arity: 1,
      level: 0,
      answer: remainderAnswer(quotient, fact.left % fact.right),
      isChallenge: false,
      category,
      coinBase: 2,
    }
  }
  return makeQuestion({ op: fact.op, left: fact.left, right: fact.right }, 0, category, category === 'addsub' ? 1 : 2)
}
