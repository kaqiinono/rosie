import { describe, it, expect } from 'vitest'
import { normalizeMixedOps, normalizeSelectedBlocks } from '@rosie/calc'
import type { MixedOp } from '@rosie/core'

describe('normalizeSelectedBlocks', () => {
  it('expands mul:2d1d into nc + c preserving counts', () => {
    expect(
      normalizeSelectedBlocks([
        { id: 'add:10', count: 10, seconds: 0 },
        { id: 'mul:2d1d', count: 15, seconds: 8 },
      ]),
    ).toEqual([
      { id: 'add:10', count: 10, seconds: 0 },
      { id: 'mul:2d1d-nc', count: 15, seconds: 8 },
      { id: 'mul:2d1d-c', count: 15, seconds: 8 },
    ])
  })

  it('dedupes if nc/c already present', () => {
    expect(
      normalizeSelectedBlocks([
        { id: 'mul:2d1d-nc', count: 5, seconds: 0 },
        { id: 'mul:2d1d', count: 10, seconds: 0 },
      ]),
    ).toEqual([
      { id: 'mul:2d1d-nc', count: 5, seconds: 0 },
      { id: 'mul:2d1d-c', count: 10, seconds: 0 },
    ])
  })

  it('is idempotent', () => {
    const once = normalizeSelectedBlocks([{ id: 'mul:2d1d', count: 20, seconds: 0 }])
    expect(normalizeSelectedBlocks(once)).toEqual(once)
  })
})

describe('normalizeMixedOps', () => {
  const base = (blockIds: string[]): MixedOp => ({
    id: 'op-1',
    skeleton: 'as_md',
    blockIds,
    enabled: true,
    count: 20,
    seconds: 0,
  })

  it('expands mul:2d1d in blockIds to nc + c', () => {
    expect(normalizeMixedOps([base(['add:10', 'mul:2d1d'])])).toEqual([
      base(['add:10', 'mul:2d1d-nc', 'mul:2d1d-c']),
    ])
  })

  it('dedupes nc/c when already present (first-wins)', () => {
    expect(normalizeMixedOps([base(['mul:2d1d-nc', 'mul:2d1d'])])).toEqual([
      base(['mul:2d1d-nc', 'mul:2d1d-c']),
    ])
  })

  it('is idempotent', () => {
    const once = normalizeMixedOps([base(['mul:2d1d'])])
    expect(normalizeMixedOps(once)).toEqual(once)
  })
})
