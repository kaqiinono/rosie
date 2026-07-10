'use client'

import { useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, invalidateSessionStore, supabase } from '@rosie/core'
import type { WordEntry } from '@rosie/core'
import { wordKey } from '../utils/english-helpers'
import {
  archiveAdaptiveProgressForDeletedKeys,
  migrateAdaptiveProgressKey,
} from './useAdaptiveWordPlan'

const SELECT_COLS =
  'stage, unit, lesson, word, explanation, chinese_def, ipa, example, phonics, syllables, keywords'

const CACHE_VER = 'word_cache_v2'
const NULL_STAGE = '__null__'

function stageKey(stage: string | undefined) {
  return stage ?? NULL_STAGE
}

function cacheDataKey(userId: string, stage: string) {
  return `${CACHE_VER}_${userId}_${stage}`
}

function cacheIndexKey(userId: string) {
  return `${CACHE_VER}_${userId}_stages`
}

function readCachedVocab(userId: string): WordEntry[] | null {
  try {
    const indexJson = localStorage.getItem(cacheIndexKey(userId))
    if (!indexJson) return null
    const stages: string[] = JSON.parse(indexJson)
    const all: WordEntry[] = []
    for (const stage of stages) {
      const json = localStorage.getItem(cacheDataKey(userId, stage))
      if (!json) return null
      const { data } = JSON.parse(json) as { data: WordEntry[] }
      all.push(...data)
    }
    return all
  } catch {
    return null
  }
}

function writeCacheByStage(userId: string, words: WordEntry[]) {
  try {
    const byStage = new Map<string, WordEntry[]>()
    for (const w of words) {
      const k = stageKey(w.stage)
      if (!byStage.has(k)) byStage.set(k, [])
      byStage.get(k)!.push(w)
    }
    const stages = [...byStage.keys()]
    const indexJson = localStorage.getItem(cacheIndexKey(userId))
    if (indexJson) {
      const oldStages: string[] = JSON.parse(indexJson)
      for (const s of oldStages) {
        if (!stages.includes(s)) {
          localStorage.removeItem(cacheDataKey(userId, s))
        }
      }
    }
    localStorage.setItem(cacheIndexKey(userId), JSON.stringify(stages))
    for (const [stage, stageWords] of byStage) {
      localStorage.setItem(cacheDataKey(userId, stage), JSON.stringify({ data: stageWords }))
    }
  } catch {
    /* ignore */
  }
}

function clearCacheForStages(userId: string, stages: string[]) {
  try {
    for (const stage of stages) {
      localStorage.removeItem(cacheDataKey(userId, stage))
    }
    const indexJson = localStorage.getItem(cacheIndexKey(userId))
    if (indexJson) {
      const existing: string[] = JSON.parse(indexJson)
      const updated = existing.filter((s) => !stages.includes(s))
      localStorage.setItem(cacheIndexKey(userId), JSON.stringify(updated))
    }
  } catch {
    /* ignore */
  }
}

const UPSERT_OPTS = { onConflict: 'unit,lesson,word,stage', ignoreDuplicates: false } as const
const FETCH_PAGE_SIZE = 1000
const UPSERT_CHUNK = 500

function isSameWordEntry(a: WordEntry, b: WordEntry): boolean {
  return (
    (a.stage ?? '') === (b.stage ?? '') &&
    a.unit === b.unit &&
    a.lesson === b.lesson &&
    a.word === b.word
  )
}

/**
 * wordKey (unit::lesson::word) ignores stage, so a key only leaves the vocab
 * when no other stage still carries the same word. Only those keys should have
 * their adaptive-plan progress archived.
 */
export function keysRemovedFromVocab(deleted: WordEntry[], remaining: WordEntry[]): string[] {
  const remainingKeys = new Set(remaining.map((x) => wordKey(x)))
  return [...new Set(deleted.map((x) => wordKey(x)))].filter((k) => !remainingKeys.has(k))
}

async function deleteWordRow(w: WordEntry): Promise<void> {
  let q = supabase
    .from('word_entries')
    .delete()
    .eq('unit', w.unit)
    .eq('lesson', w.lesson)
    .eq('word', w.word)
  if (w.stage) q = q.eq('stage', w.stage)
  else q = q.is('stage', null)
  const { error } = await q
  if (error) throw error
}

async function fetchAllWordEntries(): Promise<WordEntry[]> {
  const all: WordEntry[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('word_entries')
      .select(SELECT_COLS)
      .order('stage', { nullsFirst: true })
      .order('unit')
      .order('lesson')
      .range(from, from + FETCH_PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data.map(fromRow))
    if (data.length < FETCH_PAGE_SIZE) break
    from += FETCH_PAGE_SIZE
  }
  return all
}

async function fetchWordEntries(userId: string): Promise<WordEntry[]> {
  const words = await fetchAllWordEntries()
  writeCacheByStage(userId, words)
  return words
}

async function upsertWordRows(creator: string, words: WordEntry[]) {
  const rows = words.map((w) => toRow(creator, w))
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK)
    const { error } = await supabase.from('word_entries').upsert(chunk, UPSERT_OPTS)
    if (error) throw error
  }
}

function toRow(creator: string, w: WordEntry) {
  return {
    creator,
    stage: w.stage ?? null,
    unit: w.unit,
    lesson: w.lesson,
    word: w.word,
    explanation: w.explanation,
    chinese_def: w.chineseDef ?? null,
    ipa: w.ipa ?? null,
    example: w.example ?? null,
    phonics: w.phonics ?? null,
    syllables: w.syllables ?? null,
    keywords: w.keywords ?? null,
  }
}

function fromRow(row: Record<string, unknown>): WordEntry {
  return {
    stage: (row.stage as string) ?? undefined,
    unit: row.unit as string,
    lesson: row.lesson as string,
    word: row.word as string,
    explanation: row.explanation as string,
    chineseDef: (row.chinese_def as string) ?? undefined,
    ipa: (row.ipa as string) ?? undefined,
    example: (row.example as string) ?? undefined,
    phonics: (row.phonics as string) ?? undefined,
    syllables: (row.syllables as string[]) ?? undefined,
    keywords: (row.keywords as [string, string][]) ?? undefined,
  }
}

export const wordEntriesStore = createUserSessionStore<WordEntry[]>('word_entries', {
  fetch: fetchWordEntries,
  empty: [],
})

async function reloadWordEntries(userId: string): Promise<void> {
  wordEntriesStore.invalidate(userId)
  wordEntriesStore.ensureLoaded(userId)
}

export function useWordData(user: User | null) {
  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    const snapshot = wordEntriesStore.getSnapshot(userId)
    if (snapshot.status === 'idle') {
      const cached = readCachedVocab(userId)
      if (cached) {
        // Optimistic hydrate — always follow with a network refresh so a stale
        // 1000-row cache (Supabase default page size) cannot block full vocab.
        wordEntriesStore.replaceSessionData(userId, cached)
        wordEntriesStore.invalidate(userId)
      }
    }
  }, [userId])

  const { data: vocab, isLoading } = wordEntriesStore.useSessionData(user)

  const upsertByStage = useCallback(
    async (words: WordEntry[]) => {
      if (!user || !words.length) return
      const stages = [...new Set(words.map((w) => w.stage).filter(Boolean))] as string[]
      clearCacheForStages(user.id, stages.map(stageKey))
      for (const stage of stages) {
        await supabase.from('word_entries').delete().eq('stage', stage)
      }
      await upsertWordRows(user.id, words)
      invalidateSessionStore('word_entries')
      await reloadWordEntries(user.id)
    },
    [user],
  )

  const addWords = useCallback(
    async (words: WordEntry[]) => {
      if (!user || !words.length) return
      await upsertWordRows(user.id, words)
      clearCacheForStages(user.id, [...new Set(words.map((w) => stageKey(w.stage)))])
      wordEntriesStore.patchSessionData(user.id, (prev) => {
        const next = [...prev]
        for (const w of words) {
          const idx = next.findIndex((x) => isSameWordEntry(x, w))
          if (idx >= 0) next[idx] = w
          else next.push(w)
        }
        writeCacheByStage(user.id, next)
        return next
      })
    },
    [user],
  )

  const updateWord = useCallback(
    async (original: WordEntry, updated: WordEntry) => {
      if (!user) return
      const base = supabase
        .from('word_entries')
        .update(toRow(user.id, updated))
        .eq('unit', original.unit)
        .eq('lesson', original.lesson)
        .eq('word', original.word)
      await (original.stage ? base.eq('stage', original.stage) : base.is('stage', null))
      clearCacheForStages(user.id, [stageKey(original.stage), stageKey(updated.stage)])
      wordEntriesStore.patchSessionData(user.id, (prev) => {
        const next = prev.map((x) => (isSameWordEntry(x, original) ? updated : x))
        writeCacheByStage(user.id, next)
        return next
      })
      // Renaming unit/lesson/word changes the wordKey — carry adaptive-plan
      // progress to the new key (only when the old key truly left the vocab).
      const oldKey = wordKey(original)
      const newKey = wordKey(updated)
      if (oldKey !== newKey) {
        const remaining = wordEntriesStore.getSessionData(user.id) ?? []
        if (keysRemovedFromVocab([original], remaining).length > 0) {
          await migrateAdaptiveProgressKey(user.id, oldKey, newKey)
        }
      }
    },
    [user],
  )

  const deleteWord = useCallback(
    async (w: WordEntry) => {
      if (!user) return
      wordEntriesStore.patchSessionData(user.id, (prev) => prev.filter((x) => !isSameWordEntry(x, w)))
      try {
        await deleteWordRow(w)
        clearCacheForStages(user.id, [stageKey(w.stage)])
        wordEntriesStore.patchSessionData(user.id, (prev) => {
          writeCacheByStage(user.id, prev)
          return prev
        })
        const remaining = wordEntriesStore.getSessionData(user.id) ?? []
        await archiveAdaptiveProgressForDeletedKeys(
          user.id,
          keysRemovedFromVocab([w], remaining),
        )
      } catch (err) {
        invalidateSessionStore('word_entries')
        await reloadWordEntries(user.id)
        throw err
      }
    },
    [user],
  )

  const deleteStage = useCallback(
    async (stage: string) => {
      if (!user || !stage) return
      const deleted = (wordEntriesStore.getSessionData(user.id) ?? []).filter(
        (x) => (x.stage ?? '') === stage,
      )
      wordEntriesStore.patchSessionData(user.id, (prev) => prev.filter((x) => (x.stage ?? '') !== stage))
      try {
        const { error } = await supabase.from('word_entries').delete().eq('stage', stage)
        if (error) throw error
        clearCacheForStages(user.id, [stageKey(stage)])
        wordEntriesStore.patchSessionData(user.id, (prev) => {
          writeCacheByStage(user.id, prev)
          return prev
        })
        const remaining = wordEntriesStore.getSessionData(user.id) ?? []
        await archiveAdaptiveProgressForDeletedKeys(
          user.id,
          keysRemovedFromVocab(deleted, remaining),
        )
      } catch (err) {
        invalidateSessionStore('word_entries')
        await reloadWordEntries(user.id)
        throw err
      }
    },
    [user],
  )

  const renameStage = useCallback(
    async (oldStage: string, newStage: string) => {
      if (!user || !newStage.trim() || oldStage === newStage) return
      await supabase.from('word_entries').update({ stage: newStage }).eq('stage', oldStage)
      clearCacheForStages(user.id, [stageKey(oldStage), stageKey(newStage)])
      wordEntriesStore.patchSessionData(user.id, (prev) => {
        const next = prev.map((x) =>
          (x.stage ?? '') === oldStage ? { ...x, stage: newStage } : x,
        )
        writeCacheByStage(user.id, next)
        return next
      })
    },
    [user],
  )

  return { vocab, upsertByStage, addWords, updateWord, deleteWord, deleteStage, renameStage, isLoading }
}
