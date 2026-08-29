import type { CalcPresentationKey, CalcQuestion } from '@rosie/core'
import { parseSignature } from './calc-ast'

export type PresentationKey = CalcPresentationKey

export const PRESENTATION_COEFFICIENTS: Record<PresentationKey, number> = {
  standard: 1.0,
  'inverse-blank': 1.3,
  vertical: 1.5,
  'fraction-input': 1.4,
  'remainder-input': 1.3,
}

/**
 * 从签名推导知识事实键。
 * add/mul 可交换 → 归一化为小参数在前；
 * sub/div 顺序敏感 → 保持原签名。
 * 复合签名（混合运算）→ 保持原签名。
 */
export function conceptKeyOf(signature: string): string {
  try {
    const ast = parseSignature(signature)
    if (typeof ast === 'number') return signature
    if (ast.op !== 'add' && ast.op !== 'mul') return signature
    if (typeof ast.left !== 'number' || typeof ast.right !== 'number') return signature
    const lo = Math.min(ast.left, ast.right)
    const hi = Math.max(ast.left, ast.right)
    return `${ast.op}(${lo},${hi})`
  } catch {
    return signature
  }
}

/**
 * 判断一个知识事实是否为「加倍/自乘」形式（两个操作数相同）。
 */
export function isSelfConcept(conceptKey: string): boolean {
  try {
    const ast = parseSignature(conceptKey)
    if (typeof ast === 'number') return false
    return ast.op === 'add' || ast.op === 'mul'
      ? typeof ast.left === 'number' && ast.left === ast.right
      : false
  } catch {
    return false
  }
}

/**
 * 从一道题推导其展示模式键。
 */
export function presentationKeyOf(question: CalcQuestion): PresentationKey {
  if (question.answerMode === 'vertical') return 'vertical'
  if (question.display.includes('□')) return 'inverse-blank'
  if (question.answer.kind === 'fraction') return 'fraction-input'
  if (question.answer.kind === 'remainder') return 'remainder-input'
  return 'standard'
}
