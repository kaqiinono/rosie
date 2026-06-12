import {
  AstNode, CalcOp, makeQuestion, randInt, pickOne,
} from './calc-ast'
import type { CalcQuestion } from './type'
import { remainderAnswer } from './calc-answer'

export interface CalcBlock {
  id: string
  op: CalcOp
  label: string
  group: 'add' | 'sub' | 'mul' | 'div' | 'decimal'
  /** When true, buildSession never reconstructs this block's facts from a signature
   *  (their answers don't round-trip through the integer AST, e.g. remainder). */
  noResurface?: boolean
  generateSingle(): CalcQuestion
  sampleTerm(): { ast: AstNode; value: number }
}

function addBlock(id: string, label: string, gen: () => [number, number]): CalcBlock {
  return {
    id, op: 'add', label, group: 'add',
    generateSingle() {
      const [a, b] = gen()
      return makeQuestion({ op: 'add', left: a, right: b }, 0, 'addsub', 1)
    },
    sampleTerm() { const [a] = gen(); return { ast: a, value: a } },
  }
}
function subBlock(id: string, label: string, gen: () => [number, number]): CalcBlock {
  return {
    id, op: 'sub', label, group: 'sub',
    generateSingle() {
      const [a, b] = gen()
      return makeQuestion({ op: 'sub', left: a, right: b }, 0, 'addsub', 1)
    },
    sampleTerm() { const [a] = gen(); return { ast: a, value: a } },
  }
}
function mulBlock(id: string, label: string, gen: () => [number, number]): CalcBlock {
  return {
    id, op: 'mul', label, group: 'mul',
    generateSingle() {
      const [a, b] = gen()
      return makeQuestion({ op: 'mul', left: a, right: b }, 0, 'muldiv', 2)
    },
    sampleTerm() {
      const [a, b] = gen()
      return { ast: { op: 'mul', left: a, right: b }, value: a * b }
    },
  }
}
function divBlock(id: string, label: string, gen: () => [number, number]): CalcBlock {
  return {
    id, op: 'div', label, group: 'div',
    generateSingle() {
      const [a, b] = gen()
      return makeQuestion({ op: 'div', left: a, right: b }, 0, 'muldiv', 2)
    },
    sampleTerm() {
      const [a, b] = gen()
      return { ast: { op: 'div', left: a, right: b }, value: a / b }
    },
  }
}
function remainderBlock(
  id: string,
  label: string,
  gen: () => { dividend: number; divisor: number; quotient: number; remainder: number },
): CalcBlock {
  return {
    id,
    op: 'div',
    label,
    group: 'div',
    noResurface: true,
    generateSingle(): CalcQuestion {
      const { dividend, divisor, quotient, remainder } = gen()
      return {
        display: `${dividend} ÷ ${divisor} = ?`,
        signature: `div(${dividend},${divisor})`,
        arity: 1,
        level: 0,
        answer: remainderAnswer(quotient, remainder),
        isChallenge: false,
        category: 'muldiv',
        coinBase: 2,
      }
    },
    sampleTerm() {
      // Remainder blocks shouldn't compose into mixed ops; provide a benign exact-div term.
      const d = randInt(2, 9)
      const q = randInt(2, 9)
      return { ast: { op: 'div', left: d * q, right: d }, value: q }
    },
  }
}

const addGen = {
  r10: (): [number, number] => { const a = randInt(0, 10); return [a, randInt(0, 10 - a)] },
  r20a: (): [number, number] => { const a = randInt(10, 19); return [a, randInt(0, 9 - (a % 10))] },
  r20b: (): [number, number] => { const a = randInt(2, 9); return [a, randInt(Math.max(2, 11 - a), 9)] },
  r100a: (): [number, number] => {
    const aT = randInt(1, 8) * 10, aO = randInt(0, 9)
    const bT = randInt(0, 9 - aT / 10) * 10, bO = randInt(0, 9 - aO)
    return [aT + aO, bT + bO]
  },
  r100b: (): [number, number] => {
    let a: number, b: number, t = 0
    do { a = randInt(10, 89); b = randInt(10, 99 - a); t++ } while ((a % 10) + (b % 10) < 10 && t < 6)
    return [a, b]
  },
  r1000: (): [number, number] => { const a = randInt(100, 899); return [a, randInt(50, Math.min(999 - a, 500))] },
  r10000: (): [number, number] => { const a = randInt(1000, 8000); return [a, randInt(500, Math.min(9999 - a, 3000))] },
}
const subGen = {
  r10: (): [number, number] => { const a = randInt(0, 10); return [a, randInt(0, a)] },
  r20a: (): [number, number] => { const a = randInt(10, 20); return [a, randInt(0, a % 10)] },
  // a capped at 18: a=19 (units 9) has no single-digit borrow subtrahend → randInt(10,9) degenerates to b=10.
  r20b: (): [number, number] => { const a = randInt(11, 18); return [a, randInt((a % 10) + 1, 9)] },
  r100a: (): [number, number] => {
    const aT = randInt(2, 9) * 10, aO = randInt(0, 9)
    const bT = randInt(0, aT / 10 - 1) * 10, bO = randInt(0, aO)
    return [aT + aO, bT + bO]
  },
  r100b: (): [number, number] => {
    let a: number, b: number, t = 0
    do { a = randInt(21, 100); b = randInt(11, a - 1); t++ } while ((a % 10) >= (b % 10) && t < 6)
    return [a, b]
  },
  r1000: (): [number, number] => { const a = randInt(100, 999); return [a, randInt(50, a - 1)] },
  r10000: (): [number, number] => { const a = randInt(1000, 9999); return [a, randInt(100, a - 1)] },
}
function mulKey(keys: readonly number[], otherMin: number, otherMax: number) {
  return (): [number, number] => {
    const k = pickOne(keys), o = randInt(otherMin, otherMax)
    return Math.random() < 0.5 ? [k, o] : [o, k]
  }
}
function mulBoth(min: number, max: number) {
  return (): [number, number] => [randInt(min, max), randInt(min, max)]
}
function divKey(divisors: readonly number[], qMin: number, qMax: number) {
  return (): [number, number] => { const d = pickOne(divisors), q = randInt(qMin, qMax); return [d * q, d] }
}
function divRange(dMin: number, dMax: number, qMin: number, qMax: number) {
  return (): [number, number] => { const d = randInt(dMin, dMax), q = randInt(qMin, qMax); return [d * q, d] }
}

export const BLOCKS: CalcBlock[] = [
  addBlock('add:10', '10 以内', addGen.r10),
  addBlock('add:20a', '20 以内不进位', addGen.r20a),
  addBlock('add:20b', '20 以内进位', addGen.r20b),
  addBlock('add:100a', '100 以内不进位', addGen.r100a),
  addBlock('add:100b', '100 以内进位', addGen.r100b),
  addBlock('add:1000', '1000 以内', addGen.r1000),
  addBlock('add:10000', '万以内', addGen.r10000),
  subBlock('sub:10', '10 以内', subGen.r10),
  subBlock('sub:20a', '20 以内不退位', subGen.r20a),
  subBlock('sub:20b', '20 以内退位', subGen.r20b),
  subBlock('sub:100a', '100 以内不退位', subGen.r100a),
  subBlock('sub:100b', '100 以内退位', subGen.r100b),
  subBlock('sub:1000', '1000 以内', subGen.r1000),
  subBlock('sub:10000', '万以内', subGen.r10000),
  mulBlock('mul:25', '×2、5', mulKey([2, 5], 2, 9)),
  mulBlock('mul:34', '×3、4', mulKey([3, 4], 2, 9)),
  mulBlock('mul:67', '×6、7', mulKey([6, 7], 2, 9)),
  mulBlock('mul:89', '×8、9', mulKey([8, 9], 2, 9)),
  mulBlock('mul:29', '2-9 综合', mulBoth(2, 9)),
  mulBlock('mul:1012', '×10-12', mulKey([10, 11, 12], 2, 12)),
  mulBlock('mul:1319', '×13-19', mulKey([13, 14, 15, 16, 17, 18, 19], 2, 19)),
  mulBlock('mul:219', '2-19 综合', mulBoth(2, 19)),
  mulBlock('mul:2d1d', '两位数×一位数', () => [randInt(11, 99), randInt(2, 9)]),
  mulBlock('mul:2d', '两位数×两位数', mulBoth(11, 99)),
  divBlock('div:25', '÷2、5', divKey([2, 5], 2, 9)),
  divBlock('div:34', '÷3、4', divKey([3, 4], 2, 9)),
  divBlock('div:69', '÷6-9', divKey([6, 7, 8, 9], 2, 9)),
  divBlock('div:29', '÷2-9 综合', divRange(2, 9, 2, 9)),
  divBlock('div:1012', '÷10-12', divKey([10, 11, 12], 2, 12)),
  divBlock('div:1319', '÷13-19', divKey([13, 14, 15, 16, 17, 18, 19], 2, 19)),
  divBlock('div:219', '÷2-19 综合', divRange(2, 19, 2, 19)),
  divBlock('div:multi', '多位数÷一位数', divRange(2, 9, 11, 99)),
  remainderBlock('div:rem', '有余数除法', () => {
    const divisor = randInt(2, 9)
    const quotient = randInt(2, 9)
    const remainder = randInt(1, divisor - 1)
    return { dividend: divisor * quotient + remainder, divisor, quotient, remainder }
  }),
]

const BLOCK_MAP = new Map(BLOCKS.map((b) => [b.id, b]))
export function blockById(id: string): CalcBlock | undefined { return BLOCK_MAP.get(id) }
export function blocksByGroup(group: CalcBlock['group']): CalcBlock[] {
  return BLOCKS.filter((b) => b.group === group)
}
export const BLOCK_GROUPS: { group: CalcBlock['group']; label: string }[] = [
  { group: 'add', label: '加法' },
  { group: 'sub', label: '减法' },
  { group: 'mul', label: '乘法' },
  { group: 'div', label: '除法' },
  { group: 'decimal', label: '小数' },
]

/** Block ids whose questions can be answered in a column ("竖式") layout.
 *  add/sub: multi-digit; mul: two-digit × one-digit; div: multi-digit ÷ one-digit. */
export const VERTICAL_BLOCK_IDS = new Set<string>([
  'add:1000', 'add:10000',
  'sub:1000', 'sub:10000',
  'mul:2d1d',
  'div:multi',
])

/** Blocks whose answers need the商/余 RemainderPad — excluded from the number-pad-only modal. */
export const REMAINDER_BLOCK_IDS = new Set<string>(['div:rem'])
