import type { CalcCategory, CalcLevel, CalcOp, CalcQuestion } from '../type'

const OP_SYMBOL: Record<CalcOp, string> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
}

/** Build a flat (single-op) CalcQuestion from two operands. */
export function buildFlatQuestion(
  op: CalcOp,
  left: number,
  right: number,
  level: CalcLevel,
  category: CalcCategory,
  coinBase: number,
): CalcQuestion {
  const display = `${left} ${OP_SYMBOL[op]} ${right} = ?`
  const signature = `${op}(${left},${right})`
  let answer: number
  switch (op) {
    case 'add': answer = left + right; break
    case 'sub': answer = left - right; break
    case 'mul': answer = left * right; break
    case 'div': answer = left / right; break
  }
  return { display, signature, arity: 1, level, answer, isChallenge: false, category, coinBase }
}
