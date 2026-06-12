import { BLOCKS, blockById, VERTICAL_BLOCK_IDS, type CalcBlock } from './calc-blocks'
import { makeQuestion, parseSignature } from './calc-ast'
import { assembleMixed, isMixedOpValid } from './calc-mixed'
import { toInverseQuestion } from './calc-inverse'
import type {
  CalcCategory,
  CalcLevel,
  CalcMistake,
  CalcProblemState,
  CalcQuestion,
  CalcSettings,
  MixedOp,
} from './type'

/** Coin reward including streak bonus. coinBase already accounts for ×2 on challenge questions. */
export function coinReward(question: CalcQuestion, streak: number): number {
  let bonus = 0
  if (streak >= 10) bonus = 2
  else if (streak >= 5) bonus = 1
  return question.coinBase + bonus
}

export interface BuildCtx {
  problemStates: Map<string, CalcProblemState>
}

type Source =
  | { kind: 'block'; block: CalcBlock }
  | { kind: 'mixed'; op: MixedOp }

/**
 * Build a session of `count` questions using a weakness-weighted strategy.
 *
 * Sources = selected single-op blocks + enabled/valid mixed ops. The `count`
 * is allocated across sources, weighted toward weak (low-proficiency / never
 * practiced) ones, with a per-source floor of 1 when `count >= sources.length`.
 * Within a block source, ~35% of its allocation resurfaces its weakest specific
 * facts (via `parseSignature`); the rest is generated fresh. Mixed sources are
 * always generated fresh via `assembleMixed`. Every produced question is tagged
 * with its source for later attribution.
 *
 * `carried` are the previous session's still-unresolved mistakes, appended as
 * make-up questions ON TOP of `count` (total length = count + carried.length,
 * truncated so carried never exceeds `count`). They are mixed into the shuffle
 * so they aren't predictably first.
 */
export function buildSession(
  settings: CalcSettings,
  count: number,
  ctx: BuildCtx,
  carried: CalcMistake[] = [],
): CalcQuestion[] {
  // 1. Sources
  const sources: Source[] = []
  for (const id of settings.selectedBlocks) {
    const block = blockById(id)
    if (block) sources.push({ kind: 'block', block })
  }
  for (const op of settings.mixedOps) {
    if (op.enabled && isMixedOpValid(op)) sources.push({ kind: 'mixed', op })
  }
  if (sources.length === 0) sources.push({ kind: 'block', block: BLOCKS[0] }) // 兜底 add:10

  const states = [...ctx.problemStates.values()]

  // 2. Per-source proficiency → weight
  const weights = sources.map((src) => {
    const matching = src.kind === 'block'
      ? states.filter((s) => s.blockId === src.block.id)
      : states.filter((s) => s.mixedOpId === src.op.id)
    const p = matching.length > 0
      ? matching.reduce((acc, s) => acc + s.proficiency, 0) / matching.length
      : 0
    return Math.max(0.05, 1 - p / 5)
  })

  // 3. Allocate `count` across sources
  const alloc = allocate(count, weights)

  // 4. Generate per source
  const out: CalcQuestion[] = []
  sources.forEach((src, i) => {
    const n = alloc[i]
    if (n <= 0) return
    if (src.kind === 'block') {
      out.push(...generateBlock(src.block, n, states))
    } else {
      for (let k = 0; k < n; k++) {
        const q = assembleMixed(src.op)
        out.push({ ...q, sourceMixedOpId: src.op.id })
      }
    }
  })

  // 4.4 Tag questions from vertical-capable blocks so the session renders a 竖式 layout.
  if (settings.verticalForBigNumbers) {
    for (let i = 0; i < out.length; i++) {
      const q = out[i]
      if (q.sourceBlockId && VERTICAL_BLOCK_IDS.has(q.sourceBlockId)) {
        out[i] = { ...q, answerMode: 'vertical' }
      }
    }
  }

  // 4.5 Optionally rewrite ~30% of eligible single-op block questions into the
  // inverse blank form (48 + □ = 105). Only block-sourced arity-1 questions are
  // eligible; mixed-op and carried questions are left as-is.
  if (settings.includeInverse) {
    for (let i = 0; i < out.length; i++) {
      const q = out[i]
      if (q.sourceBlockId && q.arity === 1 && q.answerMode !== 'vertical' && Math.random() < 0.3) {
        const inv = toInverseQuestion(q)
        if (inv) out[i] = inv
      }
    }
  }

  // 5. Append carried-over make-up questions (capped at `count` for safety).
  const carry = carried.slice(0, count)
  for (const m of carry) {
    // Inverse mistakes are stored as a complete blank equation ("48 + □ = 105");
    // normal mistakes are stored as a bare LHS needing "= ?". Detect by the blank glyph.
    const expr = m.display.replace(/\s*=\s*\?\s*$/, '')
    const display = expr.includes('□') ? expr : `${expr} = ?`
    out.push({
      display,
      signature: m.signature,
      arity: 1,
      level: m.level,
      answer: m.answer,
      isChallenge: false,
      category: m.category,
      coinBase: 1,
    })
  }

  // 6. Shuffle the WHOLE thing (Fisher-Yates) so carried ones aren't predictably first.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Allocate `count` units across sources weighted by `weights`. Sum === count. */
function allocate(count: number, weights: number[]): number[] {
  const m = weights.length
  if (m === 0) return []
  const alloc = new Array<number>(m).fill(0)
  if (count <= 0) return alloc

  if (count >= m) {
    // base of 1 each, then distribute the remainder via largest-remainder
    for (let i = 0; i < m; i++) alloc[i] = 1
    const remaining = count - m
    const sumW = weights.reduce((a, b) => a + b, 0)
    const ideals = weights.map((w) => (sumW > 0 ? (remaining * w) / sumW : remaining / m))
    const floors = ideals.map((x) => Math.floor(x))
    for (let i = 0; i < m; i++) alloc[i] += floors[i]
    let leftover = remaining - floors.reduce((a, b) => a + b, 0)
    const order = ideals
      .map((x, i) => ({ i, frac: x - Math.floor(x) }))
      .sort((a, b) => b.frac - a.frac)
    let k = 0
    while (leftover > 0) {
      alloc[order[k % m].i] += 1
      leftover--
      k++
    }
  } else {
    // fewer slots than sources: give 1 each to the `count` weakest (highest w)
    const order = weights
      .map((w, i) => ({ i, w }))
      .sort((a, b) => b.w - a.w)
    for (let k = 0; k < count; k++) alloc[order[k].i] = 1
  }
  return alloc
}

/** Generate `n` questions for a single block source, resurfacing weak facts. */
function generateBlock(block: CalcBlock, n: number, states: CalcProblemState[]): CalcQuestion[] {
  const category: CalcCategory = block.group === 'add' || block.group === 'sub' ? 'addsub' : 'muldiv'
  const coinBase = category === 'addsub' ? 1 : 2
  const out: CalcQuestion[] = []

  const resurfaceN = block.noResurface ? 0 : Math.round(0.35 * n)
  const weak = states
    .filter((s) => s.blockId === block.id && s.status !== 'mastered')
    .sort((a, b) => a.proficiency - b.proficiency || b.consecutiveWrong - a.consecutiveWrong)
    .slice(0, resurfaceN)

  for (const s of weak) {
    const ast = parseSignature(s.signature)
    out.push(makeQuestion(ast, 0, category, coinBase))
  }

  const fresh = n - out.length
  for (let k = 0; k < fresh; k++) {
    out.push(block.generateSingle())
  }

  return out.map((q) => ({ ...q, sourceBlockId: block.id }))
}

/**
 * Time-limit bonus stars earned at session end (unchanged).
 *   ≤1 min  → ×1.0 per question
 *   ≤3 min  → ×0.6
 *   ≤5 min  → ×0.5
 *   ≤10 min → ×0.3
 *   > 10 min → 0
 */
export function calcTimeBonus(count: number, timeLimitSec: number, timeSpentSec: number): number {
  if (timeLimitSec <= 0) return 0
  if (timeSpentSec <= 60) return count
  if (timeSpentSec <= 180) return Math.round(count * 0.6)
  if (timeSpentSec <= 300) return Math.round(count * 0.5)
  if (timeSpentSec <= 600) return Math.round(count * 0.3)
  return 0
}

export function timeLimitBonusPreview(count: number, timeLimitSec: number): number {
  return calcTimeBonus(count, timeLimitSec, timeLimitSec)
}

// Voucher prices, labels and gradients live in the `voucher_templates` DB table
// and are accessed via `useVoucherCatalog`. The previously hardcoded constants
// were migrated by docs/voucher-templates.sql.

export function levelKey(level: CalcLevel): string {
  return typeof level === 'number' ? String(level) : level
}

export function parseLevelKey(key: string): CalcLevel {
  if (key === 'C') return 'C'
  const n = Number(key)
  return Number.isFinite(n) ? n : 1
}

export function categoryLabel(cat: CalcCategory): string {
  switch (cat) {
    case 'addsub':
      return '加减法'
    case 'muldiv':
      return '乘除法'
    case 'mixed':
      return '混合运算'
  }
}

/**
 * Pie-eligibility for a fraction question: same-denominator add/sub with a proper
 * (≤ 1) non-negative answer. Returns the two operand numerators, the shared
 * denominator, and the op — or null (caller falls back to the FractionPad keypad).
 * Parses the display so it also works for carried mistakes (no sourceBlockId).
 */
export function fractionPieSpec(
  q: CalcQuestion,
): { operands: [number, number]; den: number; op: '+' | '−' } | null {
  if (q.answer.kind !== 'fraction') return null
  if (q.answer.num < 0 || q.answer.num > q.answer.den) return null
  const m = q.display.match(/^(\d+)\/(\d+)\s*([+−-])\s*(\d+)\/(\d+)\s*=/)
  if (!m) return null
  const d1 = Number(m[2])
  const d2 = Number(m[5])
  if (d1 !== d2) return null
  return { operands: [Number(m[1]), Number(m[4])], den: d1, op: m[3] === '+' ? '+' : '−' }
}
