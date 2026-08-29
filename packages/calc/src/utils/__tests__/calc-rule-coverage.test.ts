import { describe, expect, it } from 'vitest'
import type { CalcProblemState, QuestionAttempt } from '@rosie/core'
import { coverageUniverse } from '../calc-coverage'
import { calculateRuleCoverage, classifyRuleSignature } from '../calc-rule-coverage'

function ind(sessionNo: number, date: string, overrides: Partial<QuestionAttempt> = {}): QuestionAttempt {
  return {
    correct: true,
    timeMs: 1000,
    withinLimit: true,
    evidenceKind: 'independent',
    sessionNo,
    date,
    ...overrides,
  }
}

function masteredEvidence(): QuestionAttempt[] {
  return [
    ind(1, '2026-01-01'),
    ind(2, '2026-01-01'),
    ind(3, '2026-01-01'),
    ind(4, '2026-01-02', { evidenceKind: 'recall' }),
  ]
}

function state(signature: string, recentResults: QuestionAttempt[]): CalcProblemState {
  return {
    signature,
    level: 1,
    proficiency: 0,
    attemptCount: recentResults.length,
    appearanceCount: recentResults.length,
    recentResults,
    status: 'active',
    consecutiveWrong: 0,
    consecutiveCorrect: recentResults.filter((r) => r.correct).length,
    updatedAt: '2026-01-02',
  }
}

describe('classifyRuleSignature 正向匹配', () => {
  it('八条规则逐一命中', () => {
    expect(classifyRuleSignature('add(0,5)')).toBe('add-zero')
    expect(classifyRuleSignature('add(5,0)')).toBe('add-zero')
    expect(classifyRuleSignature('sub(5,0)')).toBe('sub-zero')
    expect(classifyRuleSignature('sub(5,5)')).toBe('self-sub')
    expect(classifyRuleSignature('mul(0,7)')).toBe('mul-zero')
    expect(classifyRuleSignature('mul(7,0)')).toBe('mul-zero')
    expect(classifyRuleSignature('mul(1,9)')).toBe('mul-one')
    expect(classifyRuleSignature('mul(9,1)')).toBe('mul-one')
    expect(classifyRuleSignature('div(9,1)')).toBe('div-one')
    expect(classifyRuleSignature('div(7,7)')).toBe('self-div')
    expect(classifyRuleSignature('div(0,7)')).toBe('zero-div')
  })

  it('乘0优先于乘1', () => {
    expect(classifyRuleSignature('mul(0,1)')).toBe('mul-zero')
    expect(classifyRuleSignature('mul(1,0)')).toBe('mul-zero')
  })
})

describe('classifyRuleSignature 无误匹配', () => {
  it('普通算式与边界算式不归入任何规则', () => {
    expect(classifyRuleSignature('add(3,4)')).toBeNull()
    expect(classifyRuleSignature('sub(9,4)')).toBeNull()
    expect(classifyRuleSignature('mul(6,7)')).toBeNull()
    expect(classifyRuleSignature('div(8,2)')).toBeNull()
    expect(classifyRuleSignature('sub(0,5)')).toBeNull()
    expect(classifyRuleSignature('div(0,0)')).toBeNull()
    expect(classifyRuleSignature('add(0,0)')).toBe('add-zero')
    expect(classifyRuleSignature('garbage')).toBeNull()
    expect(classifyRuleSignature('add(add(1,2),3)')).toBeNull()
  })

  it('核心有限题库全量扫描零误匹配', () => {
    for (const blockId of ['add:10', 'sub:10', 'mul:29', 'div:29']) {
      const universe = coverageUniverse(blockId)
      if (!universe) throw new Error(`缺少题库：${blockId}`)
      for (let i = 0; i < universe.size; i++) {
        const signature = universe.signatureAt(i)
        if (classifyRuleSignature(signature) !== null) {
          throw new Error(`${blockId} 题库中的 ${signature} 被误判为规则题`)
        }
      }
    }
  })
})

describe('calculateRuleCoverage', () => {
  it('覆盖与掌握按 target 封顶，排除未出现的题', () => {
    const states = new Map<string, CalcProblemState>()
    const addZero = ['add(0,1)', 'add(0,2)', 'add(0,3)', 'add(0,4)', 'add(0,5)']
    addZero.forEach((signature, index) => {
      states.set(
        signature,
        state(signature, index < 2 ? masteredEvidence() : [ind(index + 1, '2026-01-01')]),
      )
    })
    states.set('add(9,9)', state('add(9,9)', []))

    const rows = calculateRuleCoverage(states)
    expect(rows).toHaveLength(8)

    const row = rows.find((candidate) => candidate.key === 'add-zero')
    if (!row) throw new Error('缺少 add-zero 规则行')
    expect(row.target).toBe(3)
    expect(row.covered).toBe(3)
    expect(row.mastered).toBe(2)
    expect(row.signatures).toHaveLength(3)

    for (const other of rows) {
      if (other.key !== 'add-zero') {
        expect(other.covered).toBe(0)
        expect(other.mastered).toBe(0)
        expect(other.signatures).toHaveLength(0)
      }
    }
  })
})
