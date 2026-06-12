import { parseSignature, OP_SYMBOL } from './calc-ast'
import type { CalcQuestion } from './type'

/** Glyph used for the hidden operand. Matches the blank form QuestionDisplay already supports. */
const BLANK = '□'

/**
 * Convert a single-op question into an inverse "blank" form, hiding one operand:
 *   add(48,57)=105  →  "48 + □ = 105" (answer 57)   or   "□ + 57 = 105" (answer 48)
 *
 * Returns null for anything that isn't a single binary op over two number leaves
 * (arity !== 1, or a parsed signature that isn't `{op, left:number, right:number}`).
 * Keeps signature / level / category / coinBase / isChallenge / source* so proficiency
 * and attribution continue tracking the same underlying fact.
 */
export function toInverseQuestion(q: CalcQuestion): CalcQuestion | null {
  if (q.arity !== 1) return null
  const ast = parseSignature(q.signature)
  if (typeof ast === 'number') return null
  const { op, left, right } = ast
  if (typeof left !== 'number' || typeof right !== 'number') return null

  const sym = OP_SYMBOL[op]
  const c = q.answer
  const hideRight = Math.random() < 0.5
  const display = hideRight
    ? `${left} ${sym} ${BLANK} = ${c}`
    : `${BLANK} ${sym} ${right} = ${c}`
  const answer = hideRight ? right : left

  return { ...q, display, answer }
}
