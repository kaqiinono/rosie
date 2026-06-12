import { parseSignature } from './calc-ast'
import type { CalcQuestion, ErrorTag } from './type'

export const ERROR_TAG_LABELS: Record<ErrorTag, string> = {
  carry_miss: '进位遗漏',
  order_confusion: '运算顺序混淆',
  place_value: '数位理解偏差',
  fraction_concept: '分子分母混淆',
  comprehension: '题意理解偏差',
  careless: '粗心计算失误',
  formula_misuse: '公式套用错误',
  estimation_off: '估算范围偏差',
}

/** Column-wise addition with carries DROPPED (the classic "forgot to carry" result). */
function noCarryAdd(a: number, b: number): number {
  const as = String(a).split('').reverse()
  const bs = String(b).split('').reverse()
  const len = Math.max(as.length, bs.length)
  const digits: number[] = []
  for (let i = 0; i < len; i++) {
    digits.push(((Number(as[i]) || 0) + (Number(bs[i]) || 0)) % 10)
  }
  return Number(digits.reverse().join('')) || 0
}

/** Evaluate a paren-free expression strictly left-to-right, ignoring precedence. */
function evalLeftToRight(display: string): number | null {
  const expr = display.replace(/\s*=\s*\?\s*$/, '')
  if (/[()□]/.test(expr)) return null
  const tokens = expr.match(/\d+|[+\-−×÷]/g)
  if (!tokens || tokens.length < 3) return null
  let acc = Number(tokens[0])
  for (let i = 1; i < tokens.length - 1; i += 2) {
    const op = tokens[i]
    const n = Number(tokens[i + 1])
    if (op === '+') acc += n
    else if (op === '-' || op === '−') acc -= n
    else if (op === '×') acc *= n
    else if (op === '÷') {
      if (n === 0) return null
      acc /= n
    }
  }
  return acc
}

/**
 * Deterministically classify a WRONG answer using the question's AST + display.
 * Returns null when no pattern is recognized (the answer is still recorded).
 */
export function diagnose(q: CalcQuestion, userAnswer: string): ErrorTag | null {
  const ans = q.answer

  if (ans.kind === 'fraction') {
    const um = userAnswer.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
    const dm = q.display.match(/^(\d+)\/(\d+)\s*([+−-])\s*(\d+)\/(\d+)/)
    if (um && dm && dm[3] === '+') {
      const n1 = Number(dm[1])
      const d1 = Number(dm[2])
      const n2 = Number(dm[4])
      const d2 = Number(dm[5])
      if (Number(um[1]) === n1 + n2 && Number(um[2]) === d1 + d2) return 'fraction_concept'
    }
    return null
  }

  const userNum = Number(userAnswer)
  if (!Number.isFinite(userNum)) return null

  if (ans.kind === 'decimal') {
    if (Math.abs(userNum - ans.value * 10) < 1e-9 || Math.abs(userNum - ans.value / 10) < 1e-9) {
      return 'place_value'
    }
    return Math.abs(userNum - ans.value) <= 0.2 ? 'careless' : null
  }
  if (ans.kind !== 'int') return null

  const correct = ans.value
  if (userNum === correct) return null

  if (q.arity > 1) {
    const ltr = evalLeftToRight(q.display)
    if (ltr !== null && ltr !== correct && userNum === ltr) return 'order_confusion'
  }

  if (userNum === correct * 10 || userNum === correct / 10) return 'place_value'

  if (q.arity === 1) {
    const ast = parseSignature(q.signature)
    if (typeof ast !== 'number' && ast.op === 'add' && typeof ast.left === 'number' && typeof ast.right === 'number') {
      if (userNum === noCarryAdd(ast.left, ast.right)) return 'carry_miss'
    }
  }

  if (Math.abs(userNum - correct) <= 2) return 'careless'

  return null
}
