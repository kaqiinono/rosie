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

// ─────────────────────────────────────────────────────────────────────
// Per-level generators
// ─────────────────────────────────────────────────────────────────────

// Level 1: 10 以内加减
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

// Level 2: 20 以内加减 不进退位
function genL2(): CalcQuestion {
  const op = pickOp<CalcOp>(['add', 'sub'])
  if (op === 'add') {
    // a + b ≤ 20, units digit of a + units digit of b < 10
    const a = randInt(10, 19)
    const aOnes = a % 10
    const bOnes = randInt(0, 9 - aOnes)
    return makeQuestion({ op, left: a, right: bOnes }, 2, 'addsub', 1)
  }
  // subtraction, no borrow: units digit of a ≥ units digit of b
  const a = randInt(10, 20)
  const aOnes = a % 10
  const b = randInt(0, aOnes + Math.floor((a - aOnes) / 10) * 10)
  // simpler: subtract within the ones place
  const bSafe = Math.min(b, aOnes + ((a >= 10) ? 9 : 0))
  return makeQuestion({ op, left: a, right: Math.min(bSafe, a) }, 2, 'addsub', 1)
}

// Level 3: 20 以内加减 进退位
function genL3(): CalcQuestion {
  const op = pickOp<CalcOp>(['add', 'sub'])
  if (op === 'add') {
    // a + b: a single-digit, sum 11..19
    const a = randInt(2, 9)
    const b = randInt(Math.max(2, 11 - a), 9)
    return makeQuestion({ op, left: a, right: b }, 3, 'addsub', 1)
  }
  // sub with borrow: a 11..19, b 2..9 with b > a%10
  const a = randInt(11, 19)
  const aOnes = a % 10
  const b = randInt(aOnes + 1, 9)
  return makeQuestion({ op, left: a, right: b }, 3, 'addsub', 1)
}

// Level 4: 乘法口诀 1-5
function genL4(): CalcQuestion {
  const a = randInt(1, 5)
  const b = randInt(1, 5)
  return makeQuestion({ op: 'mul', left: a, right: b }, 4, 'muldiv', 1)
}

// Level 5: 100 以内加减 不进退位
function genL5(): CalcQuestion {
  const op = pickOp<CalcOp>(['add', 'sub'])
  if (op === 'add') {
    // generate without carry on ones, sum ≤ 100
    const aT = randInt(1, 8) * 10
    const aO = randInt(0, 9)
    const bT = randInt(0, 9 - Math.floor(aT / 10)) * 10
    const bO = randInt(0, 9 - aO)
    return makeQuestion({ op, left: aT + aO, right: bT + bO }, 5, 'addsub', 2)
  }
  const aT = randInt(2, 9) * 10
  const aO = randInt(0, 9)
  const bT = randInt(0, Math.floor(aT / 10) - 1) * 10
  const bO = randInt(0, aO)
  return makeQuestion({ op, left: aT + aO, right: bT + bO }, 5, 'addsub', 2)
}

// Level 6: 乘法口诀 1-9
function genL6(): CalcQuestion {
  const a = randInt(1, 9)
  const b = randInt(1, 9)
  return makeQuestion({ op: 'mul', left: a, right: b }, 6, 'muldiv', 2)
}

// Level 7: 除法 结果 1-9
function genL7(): CalcQuestion {
  const a = randInt(1, 9)
  const b = randInt(1, 9)
  const product = a * b
  // ask: product ÷ a = b OR product ÷ b = a
  const askByA = Math.random() < 0.5
  const left = product
  const right = askByA ? a : b
  return makeQuestion({ op: 'div', left, right }, 7, 'muldiv', 2)
}

// Level 8: 100 以内加减 含进退位
function genL8(): CalcQuestion {
  const op = pickOp<CalcOp>(['add', 'sub'])
  if (op === 'add') {
    // Force a carry by ensuring (a%10)+(b%10) >= 10
    let a: number, b: number, tries = 0
    do {
      a = randInt(10, 89)
      b = randInt(10, 99 - a)
      tries += 1
    } while (((a % 10) + (b % 10) < 10) && tries < 6)
    return makeQuestion({ op, left: a, right: b }, 8, 'addsub', 2)
  }
  let a: number, b: number, tries = 0
  do {
    a = randInt(21, 100)
    b = randInt(11, a - 1)
    tries += 1
  } while (((a % 10) >= (b % 10)) && tries < 6)
  return makeQuestion({ op, left: a, right: b }, 8, 'addsub', 2)
}

// Level 9: 乘除 10-12
function genL9(): CalcQuestion {
  const isMul = Math.random() < 0.5
  const a = randInt(10, 12)
  const b = randInt(2, 12)
  if (isMul) return makeQuestion({ op: 'mul', left: a, right: b }, 9, 'muldiv', 3)
  const product = a * b
  return makeQuestion({ op: 'div', left: product, right: Math.random() < 0.5 ? a : b }, 9, 'muldiv', 3)
}

// Two-operator helpers
function genTwoOp(maxOperand: number): AstNode {
  // 50% natural precedence (a OP1 b OP2 c), 50% with parens forcing left grouping
  const ops: CalcOp[] = ['add', 'sub', 'mul', 'div']

  // Strategy: try up to 8 times to build a non-negative-integer 2-op expression
  for (let i = 0; i < 8; i++) {
    const op1 = pickOp(ops)
    const op2 = pickOp(ops)
    const useParen = Math.random() < 0.5
    const a = randInt(1, maxOperand)
    const b = randInt(1, maxOperand)
    const c = randInt(1, maxOperand)

    // Make sure division is exact when used
    let ast: AstNode
    if (useParen) {
      // (a OP1 b) OP2 c — evaluate inner first
      const inner = { op: op1, left: a, right: b }
      const innerVal = evalAst(inner)
      if (!Number.isFinite(innerVal) || innerVal < 0 || !Number.isInteger(innerVal)) continue
      if (op2 === 'div' && (innerVal % c !== 0 || c === 0)) continue
      ast = { op: op2, left: inner, right: c }
    } else {
      // Natural precedence
      // If op1 is add/sub and op2 is mul/div, AST: a OP1 (b OP2 c)
      // If op1 is mul/div and op2 is add/sub, AST: (a OP1 b) OP2 c (natural left grouping)
      // If both same precedence, left-to-right: (a OP1 b) OP2 c
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
    if (result > maxOperand * maxOperand) continue   // keep answer bounded
    return ast
  }
  // Fallback: simple add
  return { op: 'add', left: randInt(1, maxOperand), right: randInt(1, maxOperand) }
}

// Level 10: 两运算符混合（20 以内）
function genL10(): CalcQuestion {
  const ast = genTwoOp(10)
  return makeQuestion(ast, 10, 'mixed', 3)
}

// Level 11: 乘除 13-19
function genL11(): CalcQuestion {
  const isMul = Math.random() < 0.5
  const a = randInt(13, 19)
  const b = randInt(2, 19)
  if (isMul) return makeQuestion({ op: 'mul', left: a, right: b }, 11, 'muldiv', 3)
  const product = a * b
  return makeQuestion({ op: 'div', left: product, right: Math.random() < 0.5 ? a : b }, 11, 'muldiv', 3)
}

// Level 12: 两运算符混合（100 以内 含括号）
function genL12(): CalcQuestion {
  const ast = genTwoOp(20)   // operands up to 20; with mul, can reach ≤400 but most stay ≤100
  return makeQuestion(ast, 12, 'mixed', 3)
}

// Level C: 三运算符 含括号
function genLC(): CalcQuestion {
  // Build by combining a two-op result with one more op
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
  // fallback challenge
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
  { level: 1,  category: 'addsub', label: '10 以内加减',           generate: genL1 },
  { level: 2,  category: 'addsub', label: '20 以内加减（不进退位）', generate: genL2 },
  { level: 3,  category: 'addsub', label: '20 以内加减（进退位）',  generate: genL3 },
  { level: 4,  category: 'muldiv', label: '乘法 1-5',              generate: genL4 },
  { level: 5,  category: 'addsub', label: '100 以内加减（不进退位）', generate: genL5 },
  { level: 6,  category: 'muldiv', label: '乘法 1-9',              generate: genL6 },
  { level: 7,  category: 'muldiv', label: '除法（结果 1-9）',       generate: genL7 },
  { level: 8,  category: 'addsub', label: '100 以内加减（进退位）',  generate: genL8 },
  { level: 9,  category: 'muldiv', label: '乘除 10-12',           generate: genL9 },
  { level: 10, category: 'mixed',  label: '两运算符混合（20 内）',  generate: genL10 },
  { level: 11, category: 'muldiv', label: '乘除 13-19',           generate: genL11 },
  { level: 12, category: 'mixed',  label: '两运算符混合（100 内）', generate: genL12 },
  { level: 'C', category: 'mixed', label: '挑战：三运算符',         generate: genLC },
]

export function levelSpec(level: CalcLevel): LevelSpec {
  const found = LEVELS.find(l => l.level === level)
  return found ?? LEVELS[0]
}

/** Format level for display: "Lv.6" or "挑战" */
export function formatLevel(level: CalcLevel): string {
  return level === 'C' ? '挑战' : `Lv.${level}`
}
