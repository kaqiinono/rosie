'use client'

import { useEffect, useState } from 'react'
import { supabase, type WordEntry } from '@rosie/core'
import type { VocabularyLevel } from '../utils/vocabulary-assessment'

export const STORY_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const satisfies readonly VocabularyLevel[]

const PAGE_SIZE = 500

type LevelWords = { words: WordEntry[]; cefrLabels: ReadonlyMap<string, string> }
const EMPTY_LEVEL_WORDS: LevelWords = { words: [], cefrLabels: new Map() }

type SenseRow = {
  id: string
  headword_id: string
  cefr: VocabularyLevel
  headword: { spelling: string }
  written: { definitionEn?: unknown; definitionZh?: unknown }
}

async function fetchLevelWords(levels: readonly VocabularyLevel[], signal: AbortSignal): Promise<LevelWords> {
  const entries = new Map<string, { word: string; levels: Set<VocabularyLevel>; english: Set<string>; chinese: Set<string> }>()
  let after: string | undefined

  while (!signal.aborted) {
    const query = supabase.from('vocabulary_senses')
      .select('id,headword_id,cefr,written,headword:vocabulary_headwords!inner(spelling)')
      .eq('verified', true)
      .in('cefr', levels)
      .order('id')
      .limit(PAGE_SIZE)
    if (after) query.gt('id', after)
    const { data, error } = await query.abortSignal(signal).returns<SenseRow[]>()
    if (error) throw error
    if (!data.length) break

    for (const sense of data) {
      const entry = entries.get(sense.headword_id) ?? {
        word: sense.headword.spelling,
        levels: new Set<VocabularyLevel>(),
        english: new Set<string>(),
        chinese: new Set<string>(),
      }
      const { definitionEn, definitionZh } = sense.written
      entry.levels.add(sense.cefr)
      if (typeof definitionEn === 'string' && definitionEn.trim()) entry.english.add(definitionEn.trim())
      if (typeof definitionZh === 'string' && definitionZh.trim()) entry.chinese.add(definitionZh.trim())
      entries.set(sense.headword_id, entry)
    }

    if (data.length < PAGE_SIZE) break
    after = data[data.length - 1].id
  }

  const cefrLabels = new Map<string, string>()
  const words = Array.from(entries, ([headwordId, entry]) => {
    const label = STORY_CEFR_LEVELS.filter((level) => entry.levels.has(level)).join(' / ')
    cefrLabels.set(headwordId, label)
    return {
      headwordId,
      word: entry.word,
      unit: 'CEFR',
      lesson: label,
      explanation: [...entry.english].join(' / '),
      chineseDef: [...entry.chinese].join(' / ') || undefined,
    }
  })
  return { words, cefrLabels }
}

type Result = {
  userId: string
  levels: readonly VocabularyLevel[]
  attempt: number
  data: LevelWords
  status: 'loaded' | 'error'
}

export function useStoryCefrWords(userId: string | undefined, levels: readonly VocabularyLevel[]) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    if (!userId || !levels.length) return
    const controller = new AbortController()
    const request = { userId, levels, attempt }
    void fetchLevelWords(levels, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ ...request, data, status: 'loaded' })
      },
      () => {
        if (!controller.signal.aborted) setResult({ ...request, data: EMPTY_LEVEL_WORDS, status: 'error' })
      },
    )
    return () => controller.abort()
  }, [userId, levels, attempt])

  const current = result?.userId === userId && result?.levels === levels && result?.attempt === attempt ? result : null
  const status = current?.status ?? (userId && levels.length ? 'loading' : 'idle')
  return { ...(current?.data ?? EMPTY_LEVEL_WORDS), status, retry: () => setAttempt((value) => value + 1) }
}
