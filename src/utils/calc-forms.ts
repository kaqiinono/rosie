import type { CalcQuestion } from './type'

/**
 * Phase 3 — form variation per master.md §4.3.
 *
 * Each problem (identified by signature) cycles through three forms:
 *   form 0 — standard           e.g. `6 × 7 = ?`
 *   form 1 — inverse operation  e.g. `42 ÷ 6 = ?`     (for mul) or `□ × 6 = 42` (for div)
 *   form 2 — fill-in-the-blank  e.g. `6 × □ = 42`
 *
 * Form choice is `appearance_count % 3`. Form transformations DO NOT change the
 * signature — proficiency tracking remains per-signature.
 *
 * Nested/AST signatures (e.g. mixed two-op) and challenge questions are exempt:
 * they always render in form 0.
 */

const FORM_COUNT = 3
export type FormIdx = 0 | 1 | 2

interface ParsedFlat {
  op: 'add' | 'sub' | 'mul' | 'div'
  left: number
  right: number
}

const FLAT_SIG = /^(add|sub|mul|div)\((\d+),(\d+)\)$/

function parseFlat(sig: string): ParsedFlat | null {
  const m = FLAT_SIG.exec(sig)
  if (!m) return null
  return { op: m[1] as ParsedFlat['op'], left: Number(m[2]), right: Number(m[3]) }
}

export function pickForm(appearanceCount: number): FormIdx {
  return (Math.max(0, appearanceCount) % FORM_COUNT) as FormIdx
}

/**
 * Apply a form variation. Returns a NEW question with updated `display`+`answer`.
 * `signature` is preserved so the same problem maps to the same proficiency record.
 *
 * Non-flat signatures and challenge questions are returned unchanged (form 0).
 */
export function applyForm(q: CalcQuestion, formIdx: FormIdx): CalcQuestion {
  if (q.isChallenge || formIdx === 0) return q
  const parsed = parseFlat(q.signature)
  if (!parsed) return q
  const { op, left, right } = parsed

  switch (op) {
    case 'add': {
      const sum = left + right
      if (formIdx === 1) {
        // (a+b) − a = ? → b
        return { ...q, display: `${sum} − ${left} = ?`, answer: right }
      }
      // a + □ = (a+b) → b
      return { ...q, display: `${left} + □ = ${sum}`, answer: right }
    }
    case 'sub': {
      const diff = left - right
      if (formIdx === 1) {
        // (a−b) + b = ? → a
        return { ...q, display: `${diff} + ${right} = ?`, answer: left }
      }
      // a − □ = (a−b) → b
      return { ...q, display: `${left} − □ = ${diff}`, answer: right }
    }
    case 'mul': {
      const product = left * right
      if (formIdx === 1) {
        // (a·b) ÷ a = ? → b
        return { ...q, display: `${product} ÷ ${left} = ?`, answer: right }
      }
      // a × □ = (a·b) → b
      return { ...q, display: `${left} × □ = ${product}`, answer: right }
    }
    case 'div': {
      // div(p, d), where p = d * q; standard answer is q = p / d
      const p = left
      const d = right
      const quotient = p / d
      if (formIdx === 1) {
        // q × d = ? → p (multiplicative recovery of the dividend)
        return { ...q, display: `${quotient} × ${d} = ?`, answer: p }
      }
      // p ÷ □ = q → d (blank divisor)
      return { ...q, display: `${p} ÷ □ = ${quotient}`, answer: d }
    }
  }
}
