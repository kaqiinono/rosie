import type { CalcProblemState } from '@rosie/core'
import { learningStatusFromEvidence } from './calc-mastery'
import { parseSignature, signatureOf, type AstNode } from './calc-ast'
import { enumerateFinite } from './calc-finite'

export type LearningStatus = 'unseen' | 'learning' | 'fluent' | 'mastered' | 'review-due'

export interface FormulaFamily {
  key: string
  label: string
}

export interface FiniteUniverse {
  blockId: string
  label: string
  group: 'add' | 'sub' | 'mul' | 'div'
  version: string
  size: number
  signatureAt(index: number): string
  indexOf(signature: string): number | null
  classify(signature: string): FormulaFamily[]
}

export interface CoverageBucket {
  key: string
  label: string
  total: number
  covered: number
  fluent: number
  mastered: number
  reviewDue: number
  missingSignatures: string[]
}

export interface BlockCoverage {
  blockId: string
  label: string
  group: FiniteUniverse['group']
  version: string
  total: number
  covered: number
  withinTarget: number
  fluent: number
  mastered: number
  reviewDue: number
  missingSignatures: string[]
  buckets: CoverageBucket[]
}

type NumberPair = [number, number]

function pairSignature(op: 'add' | 'sub' | 'mul' | 'div', [left, right]: NumberPair): string {
  return signatureOf({ op, left, right } as AstNode)
}

function parseNumberPair(signature: string, op: 'add' | 'sub' | 'mul' | 'div'): NumberPair | null {
  try {
    const ast = parseSignature(signature)
    if (
      typeof ast === 'number' ||
      ast.op !== op ||
      typeof ast.left !== 'number' ||
      typeof ast.right !== 'number'
    )
      return null
    return [ast.left, ast.right]
  } catch {
    return null
  }
}

function pairUniverse(
  blockId: string,
  label: string,
  group: FiniteUniverse['group'],
  op: 'add' | 'sub' | 'mul' | 'div',
  pairs: NumberPair[],
  families: (pair: NumberPair) => FormulaFamily[],
): FiniteUniverse {
  const signatures = pairs.map((pair) => pairSignature(op, pair))
  const index = new Map(signatures.map((signature, i) => [signature, i]))
  return {
    blockId,
    label,
    group,
    version: 'v1',
    size: signatures.length,
    signatureAt(i) {
      if (!Number.isInteger(i) || i < 0 || i >= signatures.length) {
        throw new RangeError(`${blockId} universe index out of range: ${i}`)
      }
      return signatures[i]
    },
    indexOf(signature) {
      return index.get(signature) ?? null
    },
    classify(signature) {
      const pair = parseNumberPair(signature, op)
      return pair && index.has(signature) ? families(pair) : []
    },
  }
}

function addFamilies([a, b]: NumberPair): FormulaFamily[] {
  const out: FormulaFamily[] = [
    { key: `left:${a}`, label: `${a}+` },
    { key: `right:${b}`, label: `+${b}` },
    { key: `result:${a + b}`, label: `和为 ${a + b}` },
  ]
  if (a === b) out.push({ key: 'structure:double', label: '加倍题' })
  if (Math.abs(a - b) === 1) out.push({ key: 'structure:adjacent', label: '相邻数' })
  if (a + b === 10) out.push({ key: 'structure:make-10', label: '凑十' })
  return out
}

function subFamilies([a, b]: NumberPair): FormulaFamily[] {
  return [
    { key: `minuend:${a}`, label: `${a}−` },
    { key: `subtrahend:${b}`, label: `−${b}` },
    { key: `result:${a - b}`, label: `差为 ${a - b}` },
  ]
}

function mulFamilies([a, b]: NumberPair): FormulaFamily[] {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return [
    { key: `left:${a}`, label: `${a}×` },
    { key: `right:${b}`, label: `×${b}` },
    { key: `fact:${lo}:${hi}`, label: `${lo}×${hi} 口诀` },
  ]
}

function divFamilies([dividend, divisor]: NumberPair): FormulaFamily[] {
  return [
    { key: `divisor:${divisor}`, label: `÷${divisor}` },
    { key: `quotient:${dividend / divisor}`, label: `商为 ${dividend / divisor}` },
  ]
}

function add10Pairs(): NumberPair[] {
  const out: NumberPair[] = []
  for (let a = 1; a <= 9; a++) for (let b = 1; a + b <= 10; b++) out.push([a, b])
  return out
}

function sub10Pairs(): NumberPair[] {
  const out: NumberPair[] = []
  for (let a = 2; a <= 10; a++) for (let b = 1; b < a; b++) out.push([a, b])
  return out
}

function add20NoCarryPairs(): NumberPair[] {
  const out: NumberPair[] = []
  for (let a = 10; a <= 18; a++) for (let b = 1; b <= 9 - (a % 10); b++) out.push([a, b])
  return out
}

function add20CarryPairs(): NumberPair[] {
  const out: NumberPair[] = []
  for (let a = 2; a <= 9; a++) for (let b = Math.max(2, 11 - a); b <= 9; b++) out.push([a, b])
  return out
}

function sub20NoBorrowPairs(): NumberPair[] {
  const out: NumberPair[] = []
  for (let a = 11; a <= 19; a++) for (let b = 1; b <= a % 10; b++) out.push([a, b])
  return out
}

function sub20BorrowPairs(): NumberPair[] {
  const out: NumberPair[] = []
  for (let a = 11; a <= 18; a++) for (let b = (a % 10) + 1; b <= 9; b++) out.push([a, b])
  return out
}

function existingFinitePairs(blockId: string, op: 'add' | 'mul' | 'div'): NumberPair[] {
  const out: NumberPair[] = []
  for (const signature of enumerateFinite(blockId)) {
    const pair = parseNumberPair(signature, op)
    if (pair) out.push(pair)
  }
  return out
}

const UNIVERSES: FiniteUniverse[] = [
  pairUniverse('add:10', '10 以内', 'add', 'add', add10Pairs(), addFamilies),
  pairUniverse('add:20a', '20 以内不进位', 'add', 'add', add20NoCarryPairs(), addFamilies),
  pairUniverse('add:20b', '20 以内进位', 'add', 'add', add20CarryPairs(), addFamilies),
  pairUniverse('sub:10', '10 以内', 'sub', 'sub', sub10Pairs(), subFamilies),
  pairUniverse('sub:20a', '20 以内不退位', 'sub', 'sub', sub20NoBorrowPairs(), subFamilies),
  pairUniverse('sub:20b', '20 以内退位', 'sub', 'sub', sub20BorrowPairs(), subFamilies),
  pairUniverse('mul:25', '×2、5', 'mul', 'mul', existingFinitePairs('mul:25', 'mul'), mulFamilies),
  pairUniverse('mul:34', '×3、4', 'mul', 'mul', existingFinitePairs('mul:34', 'mul'), mulFamilies),
  pairUniverse('mul:67', '×6、7', 'mul', 'mul', existingFinitePairs('mul:67', 'mul'), mulFamilies),
  pairUniverse('mul:89', '×8、9', 'mul', 'mul', existingFinitePairs('mul:89', 'mul'), mulFamilies),
  pairUniverse(
    'mul:29',
    '2-9 综合',
    'mul',
    'mul',
    existingFinitePairs('mul:29', 'mul'),
    mulFamilies,
  ),
  pairUniverse('div:25', '÷2、5', 'div', 'div', existingFinitePairs('div:25', 'div'), divFamilies),
  pairUniverse('div:34', '÷3、4', 'div', 'div', existingFinitePairs('div:34', 'div'), divFamilies),
  pairUniverse('div:69', '÷6-9', 'div', 'div', existingFinitePairs('div:69', 'div'), divFamilies),
  pairUniverse(
    'div:29',
    '÷2-9 综合',
    'div',
    'div',
    existingFinitePairs('div:29', 'div'),
    divFamilies,
  ),
  pairUniverse(
    'add:100-comp',
    '100 以内凑整',
    'add',
    'add',
    existingFinitePairs('add:100-comp', 'add'),
    addFamilies,
  ),
]

const UNIVERSE_BY_BLOCK = new Map(UNIVERSES.map((universe) => [universe.blockId, universe]))

export function finiteCoverageUniverses(): FiniteUniverse[] {
  return UNIVERSES
}

export function coverageUniverse(blockId: string): FiniteUniverse | null {
  return UNIVERSE_BY_BLOCK.get(blockId) ?? null
}

export function learningStatusOf(state: CalcProblemState | undefined): LearningStatus {
  return state ? learningStatusFromEvidence(state) : 'unseen'
}

function hasWithinTarget(state: CalcProblemState | undefined): boolean {
  return (
    state?.recentResults.some((result) => result.correct && result.withinLimit === true) ?? false
  )
}

export function calculateBlockCoverage(
  universe: FiniteUniverse,
  states: Map<string, CalcProblemState>,
): BlockCoverage {
  let covered = 0
  let withinTarget = 0
  let fluent = 0
  let mastered = 0
  let reviewDue = 0
  const missingSignatures: string[] = []
  const buckets = new Map<string, CoverageBucket>()

  for (let index = 0; index < universe.size; index++) {
    const signature = universe.signatureAt(index)
    const state = states.get(signature)
    const status = learningStatusOf(state)
    const isCovered = !!state && state.appearanceCount > 0
    const isWithin = hasWithinTarget(state)
    const isFluent = status === 'fluent' || status === 'mastered'
    const isMastered = status === 'mastered'
    const isReviewDue = status === 'review-due'

    if (isCovered) covered++
    else missingSignatures.push(signature)
    if (isWithin) withinTarget++
    if (isFluent) fluent++
    if (isMastered) mastered++
    if (isReviewDue) reviewDue++

    for (const family of universe.classify(signature)) {
      const bucket = buckets.get(family.key) ?? {
        key: family.key,
        label: family.label,
        total: 0,
        covered: 0,
        fluent: 0,
        mastered: 0,
        reviewDue: 0,
        missingSignatures: [],
      }
      bucket.total++
      if (isCovered) bucket.covered++
      else bucket.missingSignatures.push(signature)
      if (isFluent) bucket.fluent++
      if (isMastered) bucket.mastered++
      if (isReviewDue) bucket.reviewDue++
      buckets.set(family.key, bucket)
    }
  }

  return {
    blockId: universe.blockId,
    label: universe.label,
    group: universe.group,
    version: universe.version,
    total: universe.size,
    covered,
    withinTarget,
    fluent,
    mastered,
    reviewDue,
    missingSignatures,
    buckets: [...buckets.values()],
  }
}

export function calculateAllCoverage(states: Map<string, CalcProblemState>): BlockCoverage[] {
  return UNIVERSES.map((universe) => calculateBlockCoverage(universe, states))
}
