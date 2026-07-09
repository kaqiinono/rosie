import { describe, it, expect } from 'vitest'
import { normalizeSelectedBlocks } from '@rosie/calc'

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
