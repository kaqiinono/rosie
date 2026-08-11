import { describe, expect, it } from 'vitest'
import { contentHash, normalizeContent } from '@rosie/ai'

describe('contentHash', () => {
  it('normalizes whitespace before hashing', () => {
    expect(contentHash('hello   world')).toBe(contentHash(normalizeContent('hello world')))
  })

  it('is stable for same normalized input', () => {
    const a = contentHash('abc')
    const b = contentHash('abc')
    expect(a).toBe(b)
  })
})
