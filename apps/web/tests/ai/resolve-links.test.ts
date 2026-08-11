import { describe, expect, it } from 'vitest'
import {
  findManifestByHref,
  isAllowedHref,
  resolveActionsForHits,
  resolveActionsForSourceRefs,
} from '@rosie/ai'

describe('resolve-links', () => {
  it('allows internal href prefixes', () => {
    expect(isAllowedHref('/math/ny/1/35/lesson/foo')).toBe(true)
    expect(isAllowedHref('https://example.com')).toBe(false)
  })

  it('returns empty actions for unknown source refs', () => {
    expect(resolveActionsForSourceRefs(['unknown:ref'])).toEqual([])
  })

  it('uses a safe metadata href when the generated manifest is stale', () => {
    expect(
      resolveActionsForHits([
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          subject: 'chinese',
          content: '课文',
          similarity: 0.9,
          metadata: { href: '/chinese/g2b/reading/u1-l1', title: '古诗二首' },
        },
      ]),
    ).toContainEqual({
      type: 'navigate',
      href: '/chinese/g2b/reading/u1-l1',
      label: '打开：古诗二首',
    })
  })

  it('resolves the active learning content from an exact page route', () => {
    expect(findManifestByHref('/math/ny/1/12/homework/1')).toMatchObject({
      sourceRef: 'math:problem:1-12-H1',
      problemId: '1-12-H1',
    })
    expect(findManifestByHref('/english/words/reading/4a-u5l1')).toMatchObject({
      sourceRef: 'english:reading:4A:Unit 5:Lesson 1',
    })
  })
})
