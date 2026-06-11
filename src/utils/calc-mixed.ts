import type { CalcSkeletonId, MixedOp, CalcQuestion } from './type'
import { AstNode, evalAst, makeQuestion, pickOne, randInt } from './calc-ast'
import { blockById, type CalcBlock } from './calc-blocks'

export interface SkeletonMeta {
  id: CalcSkeletonId
  label: string
  needs: ('add' | 'sub' | 'mul' | 'div')[]
  paren: boolean
  coinBase: number
}

export const SKELETONS: SkeletonMeta[] = [
  { id: 'as',         label: '加减混合',         needs: ['add', 'sub'],              paren: false, coinBase: 2 },
  { id: 'md',         label: '乘除混合',         needs: ['mul', 'div'],              paren: false, coinBase: 2 },
  { id: 'asm',        label: '加减与乘法',       needs: ['add', 'sub', 'mul'],       paren: false, coinBase: 3 },
  { id: 'asmd',       label: '加减乘除全混合',   needs: ['add', 'sub', 'mul', 'div'], paren: false, coinBase: 3 },
  { id: 'as_m_paren', label: '加减与乘法·带括号', needs: ['add', 'sub', 'mul'],       paren: true,  coinBase: 4 },
  { id: 'md_paren',   label: '乘除·带括号',       needs: ['mul', 'div'],              paren: true,  coinBase: 4 },
  { id: 'asmd_paren', label: '加减乘除·带括号',   needs: ['add', 'sub', 'mul', 'div'], paren: true,  coinBase: 4 },
]

export const skeletonMeta = (id: CalcSkeletonId): SkeletonMeta =>
  SKELETONS.find((s) => s.id === id)!

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface BlockBuckets {
  add: CalcBlock[]
  sub: CalcBlock[]
  mul: CalcBlock[]
  div: CalcBlock[]
  /** [...add, ...sub] */
  additive: CalcBlock[]
  /** [...mul, ...div] */
  multiplicative: CalcBlock[]
}

function bucketize(op: MixedOp): BlockBuckets {
  const add: CalcBlock[] = []
  const sub: CalcBlock[] = []
  const mul: CalcBlock[] = []
  const div: CalcBlock[] = []
  for (const id of op.blockIds) {
    const b = blockById(id)
    if (!b) continue
    if (b.group === 'add') add.push(b)
    else if (b.group === 'sub') sub.push(b)
    else if (b.group === 'mul') mul.push(b)
    else div.push(b)
  }
  return { add, sub, mul, div, additive: [...add, ...sub], multiplicative: [...mul, ...div] }
}

/** Magnitude of an additive operand drawn from an add/sub block. */
function additiveOperand(blocks: CalcBlock[]): number {
  if (blocks.length === 0) return randInt(1, 9)
  return pickOne(blocks).sampleTerm().value
}

/** A ×-term: value + AST from a mul block (falls back to a small product). */
function mulTerm(mul: CalcBlock[]): { ast: AstNode; value: number } {
  if (mul.length === 0) {
    const a = randInt(2, 9)
    const b = randInt(2, 9)
    return { ast: { op: 'mul', left: a, right: b }, value: a * b }
  }
  return pickOne(mul).sampleTerm()
}

/** A ÷-term: value + AST from a div block (already divisible). */
function divTerm(div: CalcBlock[]): { ast: AstNode; value: number } {
  if (div.length === 0) {
    const q = randInt(2, 9)
    const d = randInt(2, 9)
    return { ast: { op: 'div', left: d * q, right: d }, value: q }
  }
  return pickOne(div).sampleTerm()
}

/** A small factor for paren skeletons — prefer a mul block's factor, else 2–9. */
function smallFactor(mul: CalcBlock[]): number {
  if (mul.length > 0) {
    // sampleTerm gives a product; take a divisor-free small factor instead.
    const t = pickOne(mul).sampleTerm()
    if (typeof t.ast !== 'number' && t.ast.op === 'mul' && typeof t.ast.left === 'number') {
      const f = t.ast.left
      if (f >= 2 && f <= 12) return f
    }
  }
  return randInt(2, 9)
}

/** Validate: integer & non-negative answer, and every sub-result integer & ≥ 0. */
function isClean(n: AstNode): boolean {
  const v = evalAst(n)
  if (!Number.isInteger(v) || v < 0) return false
  if (typeof n === 'number') return true
  return isClean(n.left) && isClean(n.right)
}

// ---------------------------------------------------------------------------
// Per-skeleton builders. Each returns an AstNode or null (retry).
// ---------------------------------------------------------------------------

// as: t1 ± t2 (± t3), same-level left-to-right, no negative intermediate.
function buildAs(b: BlockBuckets): AstNode | null {
  const terms = b.additive.length > 0 ? b.additive : []
  const pick = (): { value: number; op: 'add' | 'sub' } => {
    if (terms.length === 0) {
      return { value: randInt(1, 9), op: Math.random() < 0.5 ? 'add' : 'sub' }
    }
    const blk = pickOne(terms)
    return { value: blk.sampleTerm().value, op: blk.op === 'sub' ? 'sub' : 'add' }
  }
  const count = randInt(2, 3) // 2 or 3 terms
  let running = randInt(1, 12)
  let ast: AstNode = running
  for (let i = 1; i < count; i++) {
    const t = pick()
    const val = Math.max(1, t.value)
    if (t.op === 'sub') {
      if (running - val < 0) {
        // flip to keep non-negative
        ast = { op: 'add', left: ast, right: val }
        running += val
      } else {
        ast = { op: 'sub', left: ast, right: val }
        running -= val
      }
    } else {
      ast = { op: 'add', left: ast, right: val }
      running += val
    }
  }
  return ast
}

// md: same-level ×/÷ chain, e.g. 6 ÷ 2 × 3 — left-to-right integer running value.
function buildMd(b: BlockBuckets): AstNode | null {
  const mul = b.mul
  const div = b.div
  // Seed with a divisible base so a following ÷ can succeed.
  const seedDiv = divTerm(div) // {a÷b, value q}
  let running: number
  let ast: AstNode
  if (typeof seedDiv.ast !== 'number' && seedDiv.ast.op === 'div') {
    ast = seedDiv.ast.left // start from the dividend (a number)
    running = evalAst(seedDiv.ast.left)
  } else {
    ast = randInt(2, 9)
    running = evalAst(ast)
  }
  const count = randInt(2, 3) // operators
  for (let i = 0; i < count; i++) {
    const useDiv = div.length > 0 && (mul.length === 0 || Math.random() < 0.5)
    if (useDiv) {
      // find a divisor of `running` from div blocks (try a few samples), else multiply
      let applied = false
      for (let t = 0; t < 6; t++) {
        const dt = divTerm(div)
        if (typeof dt.ast !== 'number' && dt.ast.op === 'div') {
          const d = evalAst(dt.ast.right)
          if (d >= 2 && running % d === 0) {
            ast = { op: 'div', left: ast, right: d }
            running = running / d
            applied = true
            break
          }
        }
      }
      if (!applied) {
        const f = mulTerm(mul)
        const factor = typeof f.ast !== 'number' && f.ast.op === 'mul'
          ? evalAst(f.ast.right) : f.value
        ast = { op: 'mul', left: ast, right: Math.max(2, factor) }
        running *= Math.max(2, factor)
      }
    } else {
      const f = mulTerm(mul)
      const factor = typeof f.ast !== 'number' && f.ast.op === 'mul'
        ? evalAst(f.ast.right) : Math.max(2, f.value)
      ast = { op: 'mul', left: ast, right: Math.max(2, factor) }
      running *= Math.max(2, factor)
    }
  }
  return ast
}

// asm: a ± (b×c). If a − (b×c) < 0, put bigger first.
function buildAsm(b: BlockBuckets): AstNode | null {
  const prod = mulTerm(b.mul)
  const a = additiveOperand(b.additive)
  const useSub = b.sub.length > 0 && (b.add.length === 0 || Math.random() < 0.5)
  if (useSub) {
    // a − (b×c) or (b×c) − a, keep ≥ 0
    if (a >= prod.value) {
      return { op: 'sub', left: a, right: prod.ast }
    }
    return { op: 'sub', left: prod.ast, right: a }
  }
  return { op: 'add', left: a, right: prod.ast }
}

// asmd: a + (b×c) − (d÷e), keep total ≥ 0, integer. (3 operators)
function buildAsmd(b: BlockBuckets): AstNode | null {
  const prod = mulTerm(b.mul)
  const quot = divTerm(b.div)
  const a = additiveOperand(b.additive)
  // base = a + prod, then subtract quot if it stays ≥ 0
  const base = a + prod.value
  if (base - quot.value < 0) return null
  // (a + b×c) − (d÷e)
  return {
    op: 'sub',
    left: { op: 'add', left: a, right: prod.ast },
    right: quot.ast,
  }
}

// as_m_paren: (a ± b) × c — inner additive group non-negative, × small factor.
function buildAsMParen(b: BlockBuckets): AstNode | null {
  const a = additiveOperand(b.additive)
  const b2 = additiveOperand(b.additive)
  const c = smallFactor(b.mul)
  const useSub = b.sub.length > 0 && (b.add.length === 0 || Math.random() < 0.5)
  let inner: AstNode
  if (useSub) {
    const hi = Math.max(a, b2)
    const lo = Math.min(a, b2)
    if (hi - lo < 0) return null
    inner = { op: 'sub', left: hi, right: lo }
  } else {
    inner = { op: 'add', left: a, right: b2 }
  }
  // mul with additive (lower-prec) left child → renderAst parenthesizes it.
  return { op: 'mul', left: inner, right: c }
}

// md_paren: a ÷ (b × c) — always uses the by-product form so the parens are
// visibly rendered (÷ and × share precedence, so (a÷b)×c would render without
// parens and be indistinguishable from plain `md`).
function buildMdParen(b: BlockBuckets): AstNode | null {
  // a ÷ (b × c) — choose b×c first, then a = (b×c) × q so it divides evenly.
  const prod = mulTerm(b.mul)
  const bc = prod.value
  if (bc < 1) return null
  const q = randInt(2, 9)
  const a = bc * q
  // div with mul (higher-prec) right child → renderAst parenthesizes it.
  return { op: 'div', left: a, right: prod.ast }
}

// asmd_paren: (a ± b) × c ÷ d — inner additive group, ×, ÷ keeping integer ≥ 0.
function buildAsmdParen(b: BlockBuckets): AstNode | null {
  const a = additiveOperand(b.additive)
  const b2 = additiveOperand(b.additive)
  const useSub = b.sub.length > 0 && (b.add.length === 0 || Math.random() < 0.5)
  let innerVal: number
  let inner: AstNode
  if (useSub) {
    const hi = Math.max(a, b2)
    const lo = Math.min(a, b2)
    inner = { op: 'sub', left: hi, right: lo }
    innerVal = hi - lo
  } else {
    inner = { op: 'add', left: a, right: b2 }
    innerVal = a + b2
  }
  if (innerVal < 1) return null
  const c = smallFactor(b.div.length > 0 ? b.div : b.mul) >= 2
    ? smallFactor(b.mul)
    : randInt(2, 9)
  const product = innerVal * Math.max(2, c)
  // choose a divisor d that divides `product`
  const candidates: number[] = []
  for (let d = 2; d <= 12; d++) if (product % d === 0) candidates.push(d)
  if (candidates.length === 0) return null
  const d = pickOne(candidates)
  // ((a±b) × c) ÷ d — inner additive forced into parens by × ; ÷ is left child of itself.
  return {
    op: 'div',
    left: { op: 'mul', left: inner, right: Math.max(2, c) },
    right: d,
  }
}

// ---------------------------------------------------------------------------
// Fallbacks (always clean, correct shape, parens where required)
// ---------------------------------------------------------------------------

function fallback(id: CalcSkeletonId): AstNode {
  switch (id) {
    case 'as':         return { op: 'add', left: 3, right: 4 }
    case 'md':         return { op: 'mul', left: { op: 'div', left: 6, right: 2 }, right: 3 }
    case 'asm':        return { op: 'add', left: 1, right: { op: 'mul', left: 2, right: 3 } }
    case 'asmd':       return {
      op: 'sub',
      left: { op: 'add', left: 10, right: { op: 'mul', left: 2, right: 3 } },
      right: { op: 'div', left: 8, right: 4 },
    }
    case 'as_m_paren': return { op: 'mul', left: { op: 'add', left: 2, right: 3 }, right: 4 }
    case 'md_paren':   return { op: 'div', left: 12, right: { op: 'mul', left: 2, right: 3 } }
    case 'asmd_paren': return {
      op: 'div',
      left: { op: 'mul', left: { op: 'add', left: 2, right: 4 }, right: 3 },
      right: 2,
    }
  }
}

const BUILDERS: Record<CalcSkeletonId, (b: BlockBuckets) => AstNode | null> = {
  as: buildAs,
  md: buildMd,
  asm: buildAsm,
  asmd: buildAsmd,
  as_m_paren: buildAsMParen,
  md_paren: buildMdParen,
  asmd_paren: buildAsmdParen,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** 组装一道混合题。内部按 op.blockIds 取块,分加减/乘除两组,重试至非负整数,兜底保证总能返回。 */
export function assembleMixed(op: MixedOp): CalcQuestion {
  const buckets = bucketize(op)
  const meta = skeletonMeta(op.skeleton)
  const build = BUILDERS[op.skeleton]
  let ast: AstNode | null = null
  for (let i = 0; i < 12; i++) {
    const candidate = build(buckets)
    if (candidate && isClean(candidate)) {
      ast = candidate
      break
    }
  }
  if (!ast) ast = fallback(op.skeleton)
  return makeQuestion(ast, 'C', 'mixed', meta.coinBase)
}

/** 校验:骨架 needs 的每个维度至少一块(加减维度满足 add 或 sub 即可)。 */
export function isMixedOpValid(op: MixedOp): boolean {
  const buckets = bucketize(op)
  const needs = skeletonMeta(op.skeleton).needs
  const needsAdditive = needs.includes('add') || needs.includes('sub')
  if (needsAdditive && buckets.additive.length === 0) return false
  if (needs.includes('mul') && buckets.mul.length === 0) return false
  if (needs.includes('div') && buckets.div.length === 0) return false
  return true
}
