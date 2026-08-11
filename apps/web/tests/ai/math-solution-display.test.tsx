import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import ProblemSolutionView from '@rosie/ui/ProblemSolutionView'
import {
  buildMathSolutionFromHit,
  buildPoemReciteBlockFromHit,
} from '../../../../packages/ai/src/server/tools/lookup-passage'
import type { KnowledgeSearchHit } from '@rosie/ai'

function hit(metadata: Record<string, unknown> = {}): KnowledgeSearchHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'document-1',
    subject: 'math',
    content: [
      '题目: 例题1 · 甲乙和差',
      '步骤1: 和差公式：较大数=(和+差)÷2',
      '步骤2: 甲=(75+17)÷2=46，乙=75−46=29',
    ].join('\n'),
    metadata: {
      sourceRef: 'math:problem:2-4-L1',
      title: '例题1 · 甲乙和差',
      problemId: '2-4-L1',
      ...metadata,
    },
    similarity: 0.99,
  }
}

function supabaseWithImage(storagePath?: string): SupabaseClient {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({
      data: storagePath ? { storage_path: storagePath } : null,
      error: null,
    }),
  }
  return {
    from: () => query,
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://assets.test/${path}` } }),
      }),
    },
  } as unknown as SupabaseClient
}

describe('shared math solution display', () => {
  it('renders the same structured analysis view without interpreting AI text as HTML', () => {
    render(<ProblemSolutionView analysis={['和差公式：较大数=(和+差)÷2', '<strong>46</strong>']} />)
    expect(screen.getByText('题型分析', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('和差公式：较大数=(和+差)÷2')).toBeInTheDocument()
    expect(screen.getByText('<strong>46</strong>')).toBeInTheDocument()
  })

  it('builds authoritative solution steps and prefers an uploaded analysis image', async () => {
    const block = await buildMathSolutionFromHit(
      supabaseWithImage('analysis/2-4/2-4-L1.png'),
      hit({
        analysis: ['公式', '计算'],
        analysisImg: '/img/static.png',
        finalAnswer: '甲是46，乙是29',
      }),
    )
    expect(block).toMatchObject({
      type: 'math_solution',
      problemId: '2-4-L1',
      steps: ['公式', '计算'],
      finalAnswer: '甲是46，乙是29',
      analysisImageUrl: 'https://assets.test/analysis/2-4/2-4-L1.png',
    })
  })

  it('falls back to the static analysis image and parses existing catalog steps', async () => {
    const block = await buildMathSolutionFromHit(
      supabaseWithImage(),
      hit({ analysisImg: '/img/static.png' }),
    )
    expect(block).toMatchObject({
      steps: ['和差公式：较大数=(和+差)÷2', '甲=(75+17)÷2=46，乙=75−46=29'],
      analysisImageUrl: '/img/static.png',
    })
  })
})

describe('embedded poem block', () => {
  it('builds a stable poem reference from catalog metadata', () => {
    expect(
      buildPoemReciteBlockFromHit(
        hit({
          sourceRef: 'chinese:poem:g1b:jing-ye-si',
          title: '静夜思',
          bookSlug: 'g1b',
          poemId: 'jing-ye-si',
        }),
      ),
    ).toMatchObject({
      type: 'poem_recite',
      bookSlug: 'g1b',
      poemId: 'jing-ye-si',
      title: '静夜思',
    })
  })
})
