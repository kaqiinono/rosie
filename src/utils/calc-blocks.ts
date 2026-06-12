import {
  AstNode, CalcOp, makeQuestion, OP_SYMBOL, randInt, pickOne,
} from './calc-ast'
import type { CalcCategory, CalcQuestion } from './type'
import { decimalAnswer, fractionAnswer, remainderAnswer } from './calc-answer'

export interface CalcBlock {
  id: string
  op: CalcOp
  label: string
  group: 'add' | 'sub' | 'mul' | 'div' | 'decimal' | 'fraction'
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

function decimalBlock(
  id: string,
  label: string,
  gen: () => { left: number; right: number; op: CalcOp; value: number; places: number },
): CalcBlock {
  return {
    id,
    op: 'add',
    label,
    group: 'decimal',
    noResurface: true,
    generateSingle(): CalcQuestion {
      const { left, right, op, value, places } = gen()
      const category: CalcCategory = op === 'add' || op === 'sub' ? 'addsub' : 'muldiv'
      return {
        display: `${String(left)} ${OP_SYMBOL[op]} ${String(right)} = ?`,
        signature: `${op}(${left},${right})`,
        arity: 1,
        level: 0,
        answer: decimalAnswer(value, places),
        isChallenge: false,
        category,
        coinBase: 2,
      }
    },
    sampleTerm() {
      const a = randInt(2, 9)
      return { ast: a, value: a }
    },
  }
}

type Frac = { num: number; den: number }

function fractionBlock(
  id: string,
  label: string,
  gen: () => { left: Frac; right: Frac | number; op: CalcOp; value: Frac },
): CalcBlock {
  const fmt = (x: Frac | number): string => (typeof x === 'number' ? String(x) : `${x.num}/${x.den}`)
  return {
    id,
    op: 'add',
    label,
    group: 'fraction',
    noResurface: true,
    generateSingle(): CalcQuestion {
      const { left, right, op, value } = gen()
      const category: CalcCategory = op === 'add' || op === 'sub' ? 'addsub' : 'muldiv'
      return {
        display: `${fmt(left)} ${OP_SYMBOL[op]} ${fmt(right)} = ?`,
        signature: `frac:${op}(${fmt(left)},${fmt(right)})`,
        arity: 1,
        level: 0,
        answer: fractionAnswer(value.num, value.den),
        isChallenge: false,
        category,
        coinBase: 2,
      }
    },
    sampleTerm() {
      const a = randInt(2, 9)
      return { ast: a, value: a }
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
  decimalBlock('dec:add1', '一位小数加减', () => {
    const isAdd = Math.random() < 0.5
    const a = randInt(1, 8) * 10 + randInt(1, 9)
    const b = randInt(1, 8) * 10 + randInt(1, 9)
    if (isAdd) return { left: a / 10, right: b / 10, op: 'add', value: (a + b) / 10, places: 1 }
    const hi = Math.max(a, b)
    const lo = Math.min(a, b)
    return { left: hi / 10, right: lo / 10, op: 'sub', value: (hi - lo) / 10, places: 1 }
  }),
  decimalBlock('dec:add2', '两位小数加减', () => {
    const isAdd = Math.random() < 0.5
    const a = randInt(1, 8) * 100 + randInt(1, 9) * 10 + randInt(1, 9)
    const b = randInt(1, 8) * 100 + randInt(1, 9) * 10 + randInt(1, 9)
    if (isAdd) return { left: a / 100, right: b / 100, op: 'add', value: (a + b) / 100, places: 2 }
    const hi = Math.max(a, b)
    const lo = Math.min(a, b)
    return { left: hi / 100, right: lo / 100, op: 'sub', value: (hi - lo) / 100, places: 2 }
  }),
  decimalBlock('dec:mulInt', '小数×整数', () => {
    const a = randInt(1, 8) * 10 + randInt(1, 9)
    const k = randInt(2, 9)
    return { left: a / 10, right: k, op: 'mul', value: (a * k) / 10, places: 1 }
  }),
  decimalBlock('dec:divInt', '小数÷整数', () => {
    const q = randInt(1, 8) * 10 + randInt(1, 9)
    const d = randInt(2, 9)
    return { left: (q * d) / 10, right: d, op: 'div', value: q / 10, places: 1 }
  }),
  fractionBlock('frac:add-same', '同分母加减', () => {
    const den = randInt(3, 9)
    if (Math.random() < 0.5) {
      const a = randInt(1, den - 1)
      const b = randInt(1, den - 1)
      return { left: { num: a, den }, right: { num: b, den }, op: 'add', value: { num: a + b, den } }
    }
    const a = randInt(2, den - 1)
    const b = randInt(1, a - 1)
    return { left: { num: a, den }, right: { num: b, den }, op: 'sub', value: { num: a - b, den } }
  }),
  fractionBlock('frac:add-diff', '异分母加减', () => {
    for (let t = 0; t < 12; t++) {
      const d1 = randInt(2, 6)
      const d2 = pickOne([2, 3, 4, 5, 6].filter((x) => x !== d1))
      const a = randInt(1, d1 - 1)
      const b = randInt(1, d2 - 1)
      const isAdd = Math.random() < 0.5
      let L = { num: a, den: d1 }
      let R = { num: b, den: d2 }
      if (!isAdd && L.num * R.den < R.num * L.den) [L, R] = [R, L]
      const num = isAdd ? L.num * R.den + R.num * L.den : L.num * R.den - R.num * L.den
      if (num > 0) return { left: L, right: R, op: isAdd ? 'add' : 'sub', value: { num, den: L.den * R.den } }
    }
    return { left: { num: 1, den: 2 }, right: { num: 1, den: 3 }, op: 'add', value: { num: 5, den: 6 } }
  }),
  fractionBlock('frac:mul-int', '分数×整数', () => {
    const den = randInt(2, 9)
    const a = randInt(1, den - 1)
    const k = randInt(2, 9)
    return { left: { num: a, den }, right: k, op: 'mul', value: { num: a * k, den } }
  }),
  fractionBlock('frac:mul-frac', '分数×分数', () => {
    const d1 = randInt(2, 6)
    const d2 = randInt(2, 6)
    const a = randInt(1, d1 - 1)
    const b = randInt(1, d2 - 1)
    return { left: { num: a, den: d1 }, right: { num: b, den: d2 }, op: 'mul', value: { num: a * b, den: d1 * d2 } }
  }),
  fractionBlock('frac:div-int', '分数÷整数', () => {
    const den = randInt(2, 9)
    const a = randInt(1, den - 1)
    const k = randInt(2, 9)
    return { left: { num: a, den }, right: k, op: 'div', value: { num: a, den: den * k } }
  }),
  fractionBlock('frac:div-frac', '分数÷分数', () => {
    const d1 = randInt(2, 6)
    const d2 = randInt(2, 6)
    const a = randInt(1, d1 - 1)
    const b = randInt(1, d2 - 1)
    return { left: { num: a, den: d1 }, right: { num: b, den: d2 }, op: 'div', value: { num: a * d2, den: d1 * b } }
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
  { group: 'fraction', label: '分数' },
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
