import { describe, expect, it } from 'vitest'
import type { CalcProblemState, MixedOp, QuestionAttempt } from '@rosie/core'
import { blockById } from '../calc-blocks'
import {
  calculateAllStructureCoverage,
  calculateStructureCoverage,
  mixedStructureModels,
  structureCoverageModels,
} from '../calc-structure-coverage'

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

function state(
  signature: string,
  blockId: string,
  recentResults: QuestionAttempt[],
  overrides: Partial<CalcProblemState> = {},
): CalcProblemState {
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
    blockId,
    ...overrides,
  }
}

function seededRandom(seed: number): () => number {
  let current = seed >>> 0
  return () => {
    current = (current * 1664525 + 1013904223) >>> 0
    return current / 0x100000000
  }
}

function modelOf(id: string) {
  const model = structureCoverageModels().find((candidate) => candidate.id === id)
  if (!model) throw new Error(`未找到结构模型：${id}`)
  return model
}

function mixedOp(id: string, skeleton: MixedOp['skeleton'], enabled = true): MixedOp {
  return { id, skeleton, blockIds: [], enabled, count: 10, seconds: null }
}

describe('结构模型分类完备性', () => {
  it('每个模型的生成样本都能分类，且不产生未声明的结构格 key', () => {
    const originalRandom = Math.random
    Math.random = seededRandom(20260829)
    try {
      for (const model of structureCoverageModels()) {
        const block = blockById(model.id)
        if (!block) throw new Error(`结构模型缺少题型：${model.id}`)
        const declared = new Set(model.cells.map((cell) => cell.key))
        if (declared.size !== model.cells.length) {
          throw new Error(`${model.id} 存在重复结构格 key`)
        }
        for (let i = 0; i < 1500; i++) {
          const signature = block.generateSingle().signature
          const keys = model.classify(signature)
          if (keys.length === 0) {
            throw new Error(`${model.id} 出现未分类样本：${signature}`)
          }
          for (const key of keys) {
            if (!declared.has(key)) {
              throw new Error(`${model.id} classify 返回未声明 key：${key}（样本 ${signature}）`)
            }
          }
        }
      }
    } finally {
      Math.random = originalRandom
    }
  })

  it('混合运算模型只覆盖启用的编排，并按根运算与深度分类', () => {
    const models = mixedStructureModels([
      mixedOp('op-as', 'as'),
      mixedOp('op-md', 'md'),
      mixedOp('op-off', 'as', false),
    ])
    expect(models.map((model) => model.id)).toEqual(['mixed:op-as', 'mixed:op-md'])

    const addSub = models[0]
    expect(addSub.classify('add(3,sub(9,4))')).toEqual(['root:addsub', 'depth:2'])
    expect(addSub.classify('sub(add(add(1,2),3),4)')).toEqual(['root:addsub', 'depth:3'])

    const mulDiv = models[1]
    expect(mulDiv.classify('mul(6,div(8,2))')).toEqual(['root:muldiv', 'depth:2'])
    expect(mulDiv.classify('div(mul(3,4),2)')).toEqual(['root:muldiv', 'depth:2'])
    expect(mulDiv.classify('42')).toEqual([])
  })
})

describe('classify 定向用例', () => {
  it('add:1000 数位分段与进位格', () => {
    expect(modelOf('add:1000').classify('add(234,150)')).toEqual(['left:low', 'right:low', 'carry:no'])
    expect(modelOf('add:1000').classify('add(567,389)')).toEqual([
      'left:mid',
      'right:high',
      'carry:yes',
      'carry-place:ones',
      'carry-place:tens',
    ])
  })

  it('sub:1000 数位分段与退位格', () => {
    expect(modelOf('sub:1000').classify('sub(987,123)')).toEqual(['left:high', 'right:low', 'borrow:no'])
    expect(modelOf('sub:1000').classify('sub(503,178)')).toEqual([
      'left:mid',
      'right:low',
      'borrow:yes',
      'borrow-place:ones',
      'borrow-place:tens',
    ])
  })

  it('div:rem 按余数相对大小分档', () => {
    expect(modelOf('div:rem').classify('div(17,5)')).toEqual(['left:low', 'right:mid', 'remainder:small'])
    expect(modelOf('div:rem').classify('div(11,4)')).toEqual(['left:low', 'right:low', 'remainder:large'])
  })

  it('分数模型按运算与分母分档', () => {
    const model = structureCoverageModels().find((candidate) => candidate.id.startsWith('frac:add'))
    if (!model) throw new Error('未找到分数加法结构模型')
    expect(model.classify('frac:add(1/2,1/2)')).toEqual(['op:add', 'den:small'])
    expect(model.classify('frac:add(1/5,2/5)')).toEqual(['op:add', 'den:mid'])
    expect(model.classify('add(1,2)')).toEqual([])
  })

  it('小数模型按运算与结果量级分档', () => {
    const model = modelOf('dec:add1')
    expect(model.classify('add(0.3,0.4)')).toEqual(['op:add', 'magnitude:lt1'])
    expect(model.classify('add(3.25,4.5)')).toEqual(['op:add', 'magnitude:1to10'])
    expect(model.classify('add(6.5,7.25)')).toEqual(['op:add', 'magnitude:gt10'])
  })
})

describe('calculateStructureCoverage', () => {
  it('仅统计来源题型且实际出现过的题', () => {
    const model = modelOf('add:1000')
    const states = [
      state('add(234,150)', 'add:1000', masteredEvidence()),
      state('add(567,389)', 'add:1000', [ind(1, '2026-01-01')]),
      state('add(111,222)', 'add:1000', []),
      state('add(234,150)', 'sub:1000', masteredEvidence()),
    ]
    const coverage = calculateStructureCoverage(model, states)
    const byKey = new Map(coverage.cells.map((cell) => [cell.key, cell]))

    expect(coverage.total).toBe(model.cells.length)
    expect(byKey.get('left:low')?.covered).toBe(true)
    expect(byKey.get('left:low')?.fluent).toBe(true)
    expect(byKey.get('left:low')?.mastered).toBe(true)
    expect(byKey.get('left:mid')?.covered).toBe(true)
    expect(byKey.get('left:mid')?.mastered).toBe(false)
    expect(byKey.get('left:high')?.covered).toBe(false)
    expect(coverage.covered).toBe(coverage.cells.filter((cell) => cell.covered).length)
    expect(coverage.mastered).toBe(coverage.cells.filter((cell) => cell.mastered).length)
  })

  it('calculateAllStructureCoverage 包含静态模型与启用的混合模型', () => {
    const result = calculateAllStructureCoverage(new Map(), [
      mixedOp('op-as', 'as'),
      mixedOp('op-md', 'md'),
      mixedOp('op-off', 'as', false),
    ])
    expect(result.length).toBe(structureCoverageModels().length + 2)
    expect(result.map((item) => item.id)).toContain('mixed:op-as')
    expect(result.map((item) => item.id)).not.toContain('mixed:op-off')
  })
})
