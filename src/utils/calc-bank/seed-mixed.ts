import type { CalcCategory, CalcLevel, CalcOp, CalcQuestion } from '../type'
import { bankSeed, mulberry32 } from './rng'

/**
 * Lv.15 / Lv.17 — two-operator mixed expressions.
 * Combinatorial space is too large to enumerate, so we pre-generate `target`
 * distinct signatures via a per-user seeded RNG. The bank is stable for that user.
 *
 *   Lv.15 → 60 题 (operand range ≤ 10)
 *   Lv.17 → 80 题 (operand range ≤ 20)
 */

const TARGET_SIZE: Record<number, number> = {
  15: 60,
  17: 80,
}

const COIN_BASE: Record<number, number> = {
  15: 3,
  17: 3,
}

const OPERAND_RANGE: Record<number, number> = {
  15: 10,
  17: 20,
}

const OP_SYMBOL: Record<CalcOp, string> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
}

type AstNode = number | { op: CalcOp; left: AstNode; right: AstNode }

function precedence(op: CalcOp): number {
  return op === 'add' || op === 'sub' ? 1 : 2
}

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

function renderAst(n: AstNode, parentPrec = 0): string {
  if (typeof n === 'number') return String(n)
  const p = precedence(n.op)
  const left = renderAst(n.left, p)
  const right = renderAst(n.right, p + 1)
  const inner = `${left} ${OP_SYMBOL[n.op]} ${right}`
  return p < parentPrec ? `(${inner})` : inner
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function pickOp(rng: () => number): CalcOp {
  const ops: CalcOp[] = ['add', 'sub', 'mul', 'div']
  return ops[Math.floor(rng() * ops.length)]
}

/** Try to produce one valid two-operator AST. May return null. */
function tryGenTwoOp(rng: () => number, maxOperand: number): AstNode | null {
  const op1 = pickOp(rng)
  const op2 = pickOp(rng)
  const useParen = rng() < 0.5
  const a = randInt(rng, 1, maxOperand)
  const b = randInt(rng, 1, maxOperand)
  const c = randInt(rng, 1, maxOperand)

  let ast: AstNode
  if (useParen) {
    const inner = { op: op1, left: a, right: b }
    const innerVal = evalAst(inner)
    if (!Number.isFinite(innerVal) || innerVal < 0 || !Number.isInteger(innerVal)) return null
    if (op2 === 'div' && (c === 0 || innerVal % c !== 0)) return null
    ast = { op: op2, left: inner, right: c }
  } else {
    const p1 = precedence(op1)
    const p2 = precedence(op2)
    if (p1 < p2) {
      const inner = { op: op2, left: b, right: c }
      const innerVal = evalAst(inner)
      if (op2 === 'div' && (c === 0 || b % c !== 0)) return null
      if (!Number.isInteger(innerVal) || innerVal < 0) return null
      ast = { op: op1, left: a, right: inner }
    } else {
      const inner = { op: op1, left: a, right: b }
      const innerVal = evalAst(inner)
      if (op1 === 'div' && (b === 0 || a % b !== 0)) return null
      if (!Number.isInteger(innerVal) || innerVal < 0) return null
      if (op2 === 'div' && (c === 0 || innerVal % c !== 0)) return null
      ast = { op: op2, left: inner, right: c }
    }
  }

  const result = evalAst(ast)
  if (!Number.isFinite(result) || result < 0 || !Number.isInteger(result)) return null
  if (result > maxOperand * maxOperand) return null
  return ast
}

function astToQuestion(
  ast: AstNode,
  level: CalcLevel,
  category: CalcCategory,
  coinBase: number,
): CalcQuestion {
  return {
    display: `${renderAst(ast)} = ?`,
    signature: signatureOf(ast),
    arity: 2,
    level,
    answer: evalAst(ast),
    isChallenge: false,
    category,
    coinBase,
  }
}

/** Returns the seeded mixed bank for Lv.15 or Lv.17, or null otherwise. */
export function seedMixedBank(level: CalcLevel, userId: string): CalcQuestion[] | null {
  if (level !== 15 && level !== 17) return null
  const target = TARGET_SIZE[level]
  const maxOperand = OPERAND_RANGE[level]
  const coin = COIN_BASE[level]
  const rng = mulberry32(bankSeed(userId, level))
  const seen = new Set<string>()
  const out: CalcQuestion[] = []
  let attempts = 0
  const maxAttempts = target * 50
  while (out.length < target && attempts < maxAttempts) {
    attempts++
    const ast = tryGenTwoOp(rng, maxOperand)
    if (!ast) continue
    const sig = signatureOf(ast)
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push(astToQuestion(ast, level, 'mixed', coin))
  }
  return out
}
