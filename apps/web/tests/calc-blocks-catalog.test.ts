import { describe, it, expect } from 'vitest'
import {
  blockById,
  BLOCKS,
  VERTICAL_BLOCK_IDS,
  isFiniteBlock,
  enumerateFinite,
  missingTargetIds,
  needsDivMidRemainder,
} from '@rosie/calc'

describe('mid-late catalog', () => {
  it('removes mul:2d1d and adds split / new ids', () => {
    expect(blockById('mul:2d1d')).toBeUndefined()
    for (const id of [
      'add:100-comp', 'sub:round',
      'mul:2d1d-nc', 'mul:2d1d-c', 'mul:3d1d-nc', 'mul:3d1d-c',
      'div:2d1d-borrow', 'mul:zeros', 'div:zeros',
    ]) {
      expect(blockById(id)?.id).toBe(id)
    }
    expect(BLOCKS.some((b) => b.id === 'div:multi')).toBe(true)
  })

  it('add:100-comp is Finite with both-order U', () => {
    expect(isFiniteBlock('add:100-comp')).toBe(true)
    const U = enumerateFinite('add:100-comp')
    expect(U).toContain('add(34,66)')
    expect(U).toContain('add(66,34)')
    expect(U.filter((s) => s === 'add(50,50)')).toHaveLength(1)
  })

  it('vertical set includes multi-digit drills but not zeros', () => {
    expect(VERTICAL_BLOCK_IDS.has('mul:2d1d-nc')).toBe(true)
    expect(VERTICAL_BLOCK_IDS.has('mul:3d1d-c')).toBe(true)
    expect(VERTICAL_BLOCK_IDS.has('div:2d1d-borrow')).toBe(true)
    expect(VERTICAL_BLOCK_IDS.has('add:100-comp')).toBe(true)
    expect(VERTICAL_BLOCK_IDS.has('sub:round')).toBe(true)
    expect(VERTICAL_BLOCK_IDS.has('mul:zeros')).toBe(false)
    expect(VERTICAL_BLOCK_IDS.has('div:zeros')).toBe(false)
    expect(VERTICAL_BLOCK_IDS.has('mul:2d1d')).toBe(false)
  })

  it('div:multi samples have no mid remainder; borrow block does', () => {
    const multi = blockById('div:multi')!
    const borrow = blockById('div:2d1d-borrow')!
    for (let i = 0; i < 25; i++) {
      const q1 = multi.generateSingle()
      const m1 = /^(\d+) ÷ (\d+)/.exec(q1.display)!
      const d1 = Number(m1[1]), div1 = Number(m1[2])
      if (d1 >= 10 && d1 <= 99) expect(needsDivMidRemainder(d1, div1)).toBe(false)

      const q2 = borrow.generateSingle()
      const m2 = /^(\d+) ÷ (\d+)/.exec(q2.display)!
      expect(needsDivMidRemainder(Number(m2[1]), Number(m2[2]))).toBe(true)
    }
  })

  it('TIME_TARGETS cover all blocks', () => {
    expect(missingTargetIds()).toEqual([])
  })
})
