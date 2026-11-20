'use client'

import { useEffect, useState } from 'react'
import { supabase, type WordEntry } from '@rosie/core'
import type { VocabularyLevel } from '../utils/vocabulary-assessment'

export const STORY_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const satisfies readonly VocabularyLevel[]

const PAGE_SIZE = 500
const EMPTY_WORDS: WordEntry[] = []

type SenseRow = {
  id: string
  headword_id: string
  headword: { spelling: string }
  written: { definitionEn?: unknown; definitionZh?: unknown }
}

async function fetchLevelWords(level: VocabularyLevel, signal: AbortSignal): Promise<WordEntry[]> {
  const entries = new Map<string, { word: string; english: Set<string>; chinese: Set<string> }>()
  let after: string | undefined

  while (!signal.aborted) {
    const query = supabase.from('vocabulary_senses')
      .select('id,headword_id,written,headword:vocabulary_headwords!inner(spelling)')
      .eq('verified', true)
      .eq('cefr', level)
      .order('id')
      .limit(PAGE_SIZE)
    if (after) query.gt('id', after)
    const { data, error } = await query.abortSignal(signal).returns<SenseRow[]>()
    if (error) throw error
    if (!data.length) break

    for (const sense of data) {
      const entry = entries.get(sense.headword_id) ?? {
        word: sense.headword.spelling,
        english: new Set<string>(),
        chinese: new Set<string>(),
      }
      const { definitionEn, definitionZh } = sense.written
      if (typeof definitionEn === 'string' && definitionEn.trim()) entry.english.add(definitionEn.trim())
      if (typeof definitionZh === 'string' && definitionZh.trim()) entry.chinese.add(definitionZh.trim())
      entries.set(sense.headword_id, entry)
    }

    if (data.length < PAGE_SIZE) break
    after = data[data.length - 1].id
  }

  return Array.from(entries, ([headwordId, entry]) => ({
    headwordId,
    word: entry.word,
    unit: 'CEFR',
    lesson: level,
    explanation: [...entry.english].join(' / '),
    chineseDef: [...entry.chinese].join(' / ') || undefined,
  }))
}

type Result = {
  userId: string
  level: VocabularyLevel
  attempt: number
  words: WordEntry[]
  status: 'loaded' | 'error'
}

export function useStoryCefrWords(userId: string | undefined, level: VocabularyLevel | null) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    if (!userId || !level) return
    const controller = new AbortController()
    const request = { userId, level, attempt }
    void fetchLevelWords(level, controller.signal).then(
      (words) => {
        if (!controller.signal.aborted) setResult({ ...request, words, status: 'loaded' })
      },
      () => {
        if (!controller.signal.aborted) setResult({ ...request, words: EMPTY_WORDS, status: 'error' })
      },
    )
    return () => controller.abort()
  }, [userId, level, attempt])

  const current = result?.userId === userId && result?.level === level && result?.attempt === attempt ? result : null
  const status = current?.status ?? (userId && level ? 'loading' : 'idle')
  return { words: current?.words ?? EMPTY_WORDS, status, retry: () => setAttempt((value) => value + 1) }
}
