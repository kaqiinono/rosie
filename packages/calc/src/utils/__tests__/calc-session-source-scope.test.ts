import { describe, expect, it } from 'vitest'
import type { CalcSettings, MixedOp } from '@rosie/core'
import { DEFAULT_CALC_SETTINGS } from '../../hooks/useCalcSettings'
import { calcSessionSourceScope } from '../calc-session-source-scope'

function mixedOperation(overrides: Partial<MixedOp> = {}): MixedOp {
  return {
    id: 'mixed-1',
    skeleton: 'asm',
    blockIds: ['add:20b', 'sub:20b', 'mul:29'],
    enabled: true,
    count: 100,
    seconds: 0,
    ...overrides,
  }
}

describe('calcSessionSourceScope', () => {
  it('includes referenced blocks and mixed ids for a mixed-only strategy', () => {
    const settings: CalcSettings = {
      ...DEFAULT_CALC_SETTINGS,
      selectedBlocks: [],
      mixedOps: [mixedOperation()],
    }

    expect(calcSessionSourceScope(settings)).toEqual({
      blockIds: ['add:20b', 'sub:20b', 'mul:29'],
      mixedOpIds: ['mixed-1'],
    })
  })

  it('deduplicates shared blocks and ignores disabled mixed operations', () => {
    const settings: CalcSettings = {
      ...DEFAULT_CALC_SETTINGS,
      selectedBlocks: [{ id: 'mul:29', count: 100, seconds: 0 }],
      mixedOps: [
        mixedOperation(),
        mixedOperation({ id: 'mixed-disabled', enabled: false, blockIds: ['div:29'] }),
      ],
    }

    expect(calcSessionSourceScope(settings)).toEqual({
      blockIds: ['mul:29', 'add:20b', 'sub:20b'],
      mixedOpIds: ['mixed-1'],
    })
  })
})
