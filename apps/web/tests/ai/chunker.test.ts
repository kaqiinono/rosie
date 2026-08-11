import { describe, expect, it } from 'vitest'
import { chunkDocument } from '@rosie/ai'

describe('chunkDocument', () => {
  it('keeps structured short content as one chunk', () => {
    const chunks = chunkDocument({
      subject: 'english',
      title: 'apple',
      content: 'apple /ˈæpəl/ 苹果',
      metadata: { structured: true },
    })
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.chunkIndex).toBe(0)
  })

  it('splits long text at sentence boundaries', () => {
    const long = '第一句。'.repeat(120)
    const chunks = chunkDocument({
      subject: 'chinese',
      title: '课文',
      content: long,
      metadata: {},
    })
    expect(chunks.length).toBeGreaterThan(1)
  })
})
