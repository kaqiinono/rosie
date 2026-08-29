import type { CalcProblemState } from '@rosie/core'
import { parseSignature } from './calc-ast'
import { learningStatusOf } from './calc-coverage'
import { hasIndependentAttempt } from './calc-evidence'

export interface RuleCoverage {
  key: string
  label: string
  target: number
  covered: number
  mastered: number
  signatures: string[]
}

const RULES = [
  { key: 'add-zero', label: '加0不变', target: 3 },
  { key: 'sub-zero', label: '减0不变', target: 3 },
  { key: 'self-sub', label: '相同数相减为0', target: 3 },
  { key: 'mul-zero', label: '乘0为0', target: 3 },
  { key: 'mul-one', label: '乘1不变', target: 3 },
  { key: 'div-one', label: '除以1不变', target: 3 },
  { key: 'self-div', label: '非0数除以自身为1', target: 3 },
  { key: 'zero-div', label: '0除以非0数为0', target: 3 },
] as const

export function classifyRuleSignature(signature: string): string | null {
  try {
    const node = parseSignature(signature)
    if (typeof node === 'number' || typeof node.left !== 'number' || typeof node.right !== 'number')
      return null
    if (node.op === 'add' && (node.left === 0 || node.right === 0)) return 'add-zero'
    if (node.op === 'sub' && node.right === 0) return 'sub-zero'
    if (node.op === 'sub' && node.left === node.right) return 'self-sub'
    if (node.op === 'mul' && (node.left === 0 || node.right === 0)) return 'mul-zero'
    if (node.op === 'mul' && (node.left === 1 || node.right === 1)) return 'mul-one'
    if (node.op === 'div' && node.right === 1) return 'div-one'
    if (node.op === 'div' && node.left !== 0 && node.left === node.right) return 'self-div'
    if (node.op === 'div' && node.left === 0 && node.right !== 0) return 'zero-div'
    return null
  } catch {
    return null
  }
}

export function calculateRuleCoverage(states: Map<string, CalcProblemState>): RuleCoverage[] {
  return RULES.map((rule) => {
    const matching = [...states.values()].filter(
      (state) => hasIndependentAttempt(state) && classifyRuleSignature(state.signature) === rule.key,
    )
    return {
      ...rule,
      covered: Math.min(rule.target, matching.length),
      mastered: Math.min(
        rule.target,
        matching.filter((state) => learningStatusOf(state) === 'mastered').length,
      ),
      signatures: matching.slice(0, rule.target).map((state) => state.signature),
    }
  })
}
