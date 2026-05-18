import type { CalcCategory, CalcLevel, CalcOp, CalcQuestion } from './type'

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickOp<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const OP_SYMBOL: Record<CalcOp, string> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
}

// Build a unary number node — represented as a number primitive in the AST
type AstNode = number | { op: CalcOp; left: AstNode; right: AstNode }

function evalAst(n: AstNode): number {
  if (typeof n === 'number') return n
  const l = evalAst(n.left)
  const r = evalAst(n.right)
  switch (n.op) {
    case 'add': return l + r
    case 'sub': return l - r
    case 'mul': return l * r
    case 'div': return l / r
  }
}

function signatureOf(n: AstNode): string {
  if (typeof n === 'number') return String(n)
  return `${n.op}(${signatureOf(n.left)},${signatureOf(n.right)})`
}

function precedence(op: CalcOp): number {
  return op === 'add' || op === 'sub' ? 1 : 2
}

/** Stringify AST with parens only where precedence requires them. */
function renderAst(n: AstNode, parentPrec = 0): string {
  if (typeof n === 'number') return String(n)
  const p = precedence(n.op)
  const left = renderAst(n.left, p)
  const right = renderAst(n.right, p + 1)   // right-leaning: 10-(4-1) needs parens
  const inner = `${left} ${OP_SYMBOL[n.op]} ${right}`
  return p < parentPrec ? `(${inner})` : inner
}

function arityOf(n: AstNode): number {
  if (typeof n === 'number') return 0
  return 1 + arityOf(n.left) + arityOf(n.right)
}

function makeQuestion(
  ast: AstNode,
  level: CalcLevel,
  category: CalcCategory,
  coinBase: number,
  isChallenge = false,
): CalcQuestion {
  const display = `${renderAst(ast)} = ?`
  const signature = signatureOf(ast)
  const answer = evalAst(ast)
  const arity = arityOf(ast) as 1 | 2 | 3
  return { display, signature, arity, level, answer, isChallenge, category, coinBase }
}

/** Generate a multiplication where ONE factor is drawn from `key` set, the other from 1-9. */
function genMulWithKey(key: readonly number[], level: CalcLevel, coinBase: number): CalcQuestion {
  const keyFactor = pickOp(key)
  const otherFactor = randInt(1, 9)
  // Randomize order so display shows e.g. "3×7" or "7×3"
  const left = Math.random() < 0.5 ? keyFactor : otherFactor
  const right = left === keyFactor ? otherFactor : keyFactor
  return makeQuestion({ op: 'mul', left, right }, level, 'muldiv', coinBase)
}

/** Generate a division where divisor is drawn from `key` set, quotient is 1-9. */
function genDivWithKey(key: readonly number[], level: CalcLevel, coinBase: number): CalcQuestion {
  const divisor = pickOp(key)
  const quotient = randInt(1, 9)
  const dividend = divisor * quotient
  return makeQuestion({ op: 'div', left: dividend, right: divisor }, level, 'muldiv', coinBase)
}

// ─────────────────────────────────────────────────────────────────────
// Per-level generators
// ─────────────────────────────────────────────────────────────────────

// === 第一阶段 · 加减法与数感建立 ===

// Lv.1: 10 以内加减
function genL1(): CalcQuestion {
  const op = pickOp<CalcOp>(['add', 'sub'])
  if (op === 'add') {
    const a = randInt(0, 10)
    const b = randInt(0, 10 - a)
    return makeQuestion({ op, left: a, right: b }, 1, 'addsub', 1)
  }
  const a = randInt(0, 10)
  const b = randInt(0, a)
  return makeQuestion({ op, left: a, right: b }, 1, 'addsub', 1)
}

// Lv.2: 20 以内加减（不进退位）
function genL2(): CalcQuestion {
  const op = pickOp<CalcOp>(['add', 'sub'])
  if (op === 'add') {
    const a = randInt(10, 19)
    const aOnes = a % 10
    const bOnes = randInt(0, 9 - aOnes)
    return makeQuestion({ op, left: a, right: bOnes }, 2, 'addsub', 1)
  }
  const a = randInt(10, 20)
  const aOnes = a % 10
  const b = randInt(0, aOnes)
  return makeQuestion({ op, left: a, right: b }, 2, 'addsub', 1)
}

// Lv.3: 20 以内加减（进退位）
function genL3(): CalcQuestion {
  const op = pickOp<CalcOp>(['add', 'sub'])
  if (op === 'add') {
    const a = randInt(2, 9)
    const b = randInt(Math.max(2, 11 - a), 9)
    return makeQuestion({ op, left: a, right: b }, 3, 'addsub', 1)
  }
  const a = randInt(11, 19)
  const aOnes = a % 10
  const b = randInt(aOnes + 1, 9)
  return makeQuestion({ op, left: a, right: b }, 3, 'addsub', 1)
}

// Lv.4: 100 以内加减（不进退位）
function genL4(): CalcQuestion {
  const op = pickOp<CalcOp>(['add', 'sub'])
  if (op === 'add') {
    const aT = randInt(1, 8) * 10
    const aO = randInt(0, 9)
    const bT = randInt(0, 9 - Math.floor(aT / 10)) * 10
    const bO = randInt(0, 9 - aO)
    return makeQuestion({ op, left: aT + aO, right: bT + bO }, 4, 'addsub', 2)
  }
  const aT = randInt(2, 9) * 10
  const aO = randInt(0, 9)
  const bT = randInt(0, Math.floor(aT / 10) - 1) * 10
  const bO = randInt(0, aO)
  return makeQuestion({ op, left: aT + aO, right: bT + bO }, 4, 'addsub', 2)
}

// Lv.5: 100 以内加减（进退位）
function genL5(): CalcQuestion {
  const op = pickOp<CalcOp>(['add', 'sub'])
  if (op === 'add') {
    let a: number, b: number, tries = 0
    do {
      a = randInt(10, 89)
      b = randInt(10, 99 - a)
      tries += 1
    } while (((a % 10) + (b % 10) < 10) && tries < 6)
    return makeQuestion({ op, left: a, right: b }, 5, 'addsub', 2)
  }
  let a: number, b: number, tries = 0
  do {
    a = randInt(21, 100)
    b = randInt(11, a - 1)
    tries += 1
  } while (((a % 10) >= (b % 10)) && tries < 6)
  return makeQuestion({ op, left: a, right: b }, 5, 'addsub', 2)
}

// === 第二阶段 · 乘法口诀（由易到难拆分） ===

// Lv.6: 乘法 1、2、5
function genL6(): CalcQuestion {
  return genMulWithKey([1, 2, 5], 6, 2)
}

// Lv.7: 乘法 3、4
function genL7(): CalcQuestion {
  return genMulWithKey([3, 4], 7, 2)
}

// Lv.8: 乘法 6、7
function genL8(): CalcQuestion {
  return genMulWithKey([6, 7], 8, 2)
}

// Lv.9: 乘法 8、9
function genL9(): CalcQuestion {
  return genMulWithKey([8, 9], 9, 2)
}

// Lv.10: 乘法 1-9 综合
function genL10(): CalcQuestion {
  const a = randInt(1, 9)
  const b = randInt(1, 9)
  return makeQuestion({ op: 'mul', left: a, right: b }, 10, 'muldiv', 2)
}

// === 第三阶段 · 除法（与乘法口诀对应拆分） ===

// Lv.11: 除法 ÷1、÷2、÷5（结果 1-9）
function genL11(): CalcQuestion {
  return genDivWithKey([1, 2, 5], 11, 2)
}

// Lv.12: 除法 ÷3、÷4（结果 1-9）
function genL12(): CalcQuestion {
  return genDivWithKey([3, 4], 12, 2)
}

// Lv.13: 除法 ÷6、÷7、÷8、÷9（结果 1-9）
function genL13(): CalcQuestion {
  return genDivWithKey([6, 7, 8, 9], 13, 2)
}

// Lv.14: 乘除混合（1-9 范围）
function genL14(): CalcQuestion {
  const isMul = Math.random() < 0.5
  if (isMul) {
    const a = randInt(1, 9)
    const b = randInt(1, 9)
    return makeQuestion({ op: 'mul', left: a, right: b }, 14, 'muldiv', 2)
  }
  const divisor = randInt(1, 9)
  const quotient = randInt(1, 9)
  return makeQuestion({ op: 'div', left: divisor * quotient, right: divisor }, 14, 'muldiv', 2)
}

// === 第四阶段 · 混合运算与拓展（压轴） ===

// Two-operator helpers
function genTwoOp(maxOperand: number): AstNode {
  const ops: CalcOp[] = ['add', 'sub', 'mul', 'div']

  for (let i = 0; i < 8; i++) {
    const op1 = pickOp(ops)
    const op2 = pickOp(ops)
    const useParen = Math.random() < 0.5
    const a = randInt(1, maxOperand)
    const b = randInt(1, maxOperand)
    const c = randInt(1, maxOperand)

    let ast: AstNode
    if (useParen) {
      const inner = { op: op1, left: a, right: b }
      const innerVal = evalAst(inner)
      if (!Number.isFinite(innerVal) || innerVal < 0 || !Number.isInteger(innerVal)) continue
      if (op2 === 'div' && (innerVal % c !== 0 || c === 0)) continue
      ast = { op: op2, left: inner, right: c }
    } else {
      const p1 = precedence(op1)
      const p2 = precedence(op2)
      if (p1 < p2) {
        const inner = { op: op2, left: b, right: c }
        const innerVal = evalAst(inner)
        if (op2 === 'div' && (c === 0 || b % c !== 0)) continue
        if (!Number.isInteger(innerVal) || innerVal < 0) continue
        ast = { op: op1, left: a, right: inner }
      } else {
        const inner = { op: op1, left: a, right: b }
        const innerVal = evalAst(inner)
        if (op1 === 'div' && (b === 0 || a % b !== 0)) continue
        if (!Number.isInteger(innerVal) || innerVal < 0) continue
        if (op2 === 'div' && (c === 0 || innerVal % c !== 0)) continue
        ast = { op: op2, left: inner, right: c }
      }
    }

    const result = evalAst(ast)
    if (!Number.isFinite(result) || result < 0 || !Number.isInteger(result)) continue
    if (result > maxOperand * maxOperand) continue
    return ast
  }
  return { op: 'add', left: randInt(1, maxOperand), right: randInt(1, maxOperand) }
}

// Lv.15: 两运算符混合（20 以内）
function genL15(): CalcQuestion {
  const ast = genTwoOp(10)
  return makeQuestion(ast, 15, 'mixed', 3)
}

// Lv.16: 乘除拓展 ×10、×11、×12
function genL16(): CalcQuestion {
  const isMul = Math.random() < 0.5
  const key = pickOp([10, 11, 12])
  const other = randInt(2, 12)
  if (isMul) {
    const left = Math.random() < 0.5 ? key : other
    const right = left === key ? other : key
    return makeQuestion({ op: 'mul', left, right }, 16, 'muldiv', 3)
  }
  return makeQuestion({ op: 'div', left: key * other, right: key }, 16, 'muldiv', 3)
}

// Lv.17: 两运算符混合（100 以内 含括号）
function genL17(): CalcQuestion {
  const ast = genTwoOp(20)
  return makeQuestion(ast, 17, 'mixed', 3)
}

// Lv.18: 乘除拓展 ×13-19（终极）
function genL18(): CalcQuestion {
  const isMul = Math.random() < 0.5
  const key = randInt(13, 19)
  const other = randInt(2, 19)
  if (isMul) {
    const left = Math.random() < 0.5 ? key : other
    const right = left === key ? other : key
    return makeQuestion({ op: 'mul', left, right }, 18, 'muldiv', 4)
  }
  return makeQuestion({ op: 'div', left: key * other, right: key }, 18, 'muldiv', 4)
}

// Challenge: 三运算符 含括号
function genLC(): CalcQuestion {
  for (let i = 0; i < 8; i++) {
    const inner = genTwoOp(10)
    const innerVal = evalAst(inner)
    if (innerVal < 0 || !Number.isInteger(innerVal)) continue
    const op = pickOp<CalcOp>(['add', 'sub', 'mul'])
    const right = randInt(1, 9)
    const ast: AstNode = { op, left: inner, right }
    const result = evalAst(ast)
    if (!Number.isInteger(result) || result < 0 || result > 200) continue
    if (arityOf(ast) !== 3) continue
    return makeQuestion(ast, 'C', 'mixed', 6, true)
  }
  const fallback: AstNode = { op: 'add', left: { op: 'mul', left: 3, right: 2 }, right: { op: 'add', left: 4, right: 5 } as AstNode } as AstNode
  return makeQuestion(fallback, 'C', 'mixed', 6, true)
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export interface LevelSpec {
  level: CalcLevel
  category: CalcCategory
  label: string
  generate: () => CalcQuestion
}

export const LEVELS: LevelSpec[] = [
  { level: 1,  category: 'addsub', label: '10 以内加减',              generate: genL1 },
  { level: 2,  category: 'addsub', label: '20 以内加减（不进退位）',    generate: genL2 },
  { level: 3,  category: 'addsub', label: '20 以内加减（进退位）',     generate: genL3 },
  { level: 4,  category: 'addsub', label: '100 以内加减（不进退位）',   generate: genL4 },
  { level: 5,  category: 'addsub', label: '100 以内加减（进退位）',    generate: genL5 },
  { level: 6,  category: 'muldiv', label: '乘法 1、2、5',             generate: genL6 },
  { level: 7,  category: 'muldiv', label: '乘法 3、4',                generate: genL7 },
  { level: 8,  category: 'muldiv', label: '乘法 6、7',                generate: genL8 },
  { level: 9,  category: 'muldiv', label: '乘法 8、9',                generate: genL9 },
  { level: 10, category: 'muldiv', label: '乘法 1-9 综合',            generate: genL10 },
  { level: 11, category: 'muldiv', label: '除法 ÷1、÷2、÷5',          generate: genL11 },
  { level: 12, category: 'muldiv', label: '除法 ÷3、÷4',              generate: genL12 },
  { level: 13, category: 'muldiv', label: '除法 ÷6、÷7、÷8、÷9',      generate: genL13 },
  { level: 14, category: 'muldiv', label: '乘除混合（1-9）',          generate: genL14 },
  { level: 15, category: 'mixed',  label: '两运算符混合（20 内）',     generate: genL15 },
  { level: 16, category: 'muldiv', label: '乘除拓展 ×10、×11、×12',  generate: genL16 },
  { level: 17, category: 'mixed',  label: '两运算符混合（100 内）',    generate: genL17 },
  { level: 18, category: 'muldiv', label: '乘除拓展 ×13-19',         generate: genL18 },
  { level: 'C', category: 'mixed', label: '挑战：三运算符',           generate: genLC },
]

export function levelSpec(level: CalcLevel): LevelSpec {
  const found = LEVELS.find(l => l.level === level)
  return found ?? LEVELS[0]
}

/** Format level for display: "Lv.6" or "挑战" */
export function formatLevel(level: CalcLevel): string {
  return level === 'C' ? '挑战' : `Lv.${level}`
}
