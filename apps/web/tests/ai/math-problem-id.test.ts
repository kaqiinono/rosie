import { describe, expect, it } from 'vitest'
import { resolveMathProblemId, type KnowledgeSearchHit } from '@rosie/ai'

function hit(metadata: KnowledgeSearchHit['metadata']): KnowledgeSearchHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'document-1',
    subject: 'math',
    content: '题目内容',
    metadata,
    similarity: 1,
  }
}

describe('resolveMathProblemId', () => {
  it('completes a short problem id with its lesson id', () => {
    expect(resolveMathProblemId(hit({ problemId: 'P1', lessonId: '1-35' }))).toBe('1-35-P1')
  })

  it('unwraps a problem id stored as a source ref', () => {
    expect(resolveMathProblemId(hit({ problemId: 'math:problem:1-35-P1' }))).toBe('1-35-P1')
  })

  it('uses the stable source ref when problemId metadata is absent', () => {
    expect(resolveMathProblemId(hit({ sourceRef: 'math:problem:1-35-P1' }))).toBe('1-35-P1')
  })
})
