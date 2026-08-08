'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, invalidateSessionStore, supabase } from '@rosie/core'
import type { WordEntry } from '@rosie/core'
import { compareStages, wordKey } from '../utils/english-helpers'
import {
  archiveAdaptiveProgressForDeletedKeys,
  migrateAdaptiveProgressKey,
} from './useAdaptiveWordPlan'

const SELECT_COLS =
  'stage, unit, lesson, word, explanation, chinese_def, ipa, example, phonics, syllables, keywords, vocab_type, image_path, image_match_score, image_match_query, image_source, image_pexels_id'

const CACHE_VER = 'word_cache_v5'
/** v4 cached the entire word library locally; purge it on first use. */
const LEGACY_CACHE_PREFIX = 'word_cache_v4_'
const NULL_STAGE = '__null__'

let legacyCachePurged = false
function purgeLegacyFullCache() {
  if (legacyCachePurged) return
  legacyCachePurged = true
  try {
    const drop: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith(LEGACY_CACHE_PREFIX)) drop.push(k)
    }
    drop.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

function stageKey(stage: string | undefined) {
  return stage ?? NULL_STAGE
}

function cacheDataKey(userId: string, stage: string) {
  return `${CACHE_VER}_${userId}_${stage}`
}

function cacheIndexKey(userId: string) {
  return `${CACHE_VER}_${userId}_stages`
}

function stageIndexCacheKey(userId: string) {
  return `${CACHE_VER}_${userId}_stage_index`
}

function readCachedStageVocab(userId: string, stage: string): WordEntry[] | null {
  try {
    const json = localStorage.getItem(cacheDataKey(userId, stage))
    if (!json) return null
    const { data } = JSON.parse(json) as { data: WordEntry[] }
    return data
  } catch {
    return null
  }
}

/**
 * The local cache holds at most ONE textbook: writing a stage evicts every
 * previously cached stage, so switching textbooks never accumulates data.
 */
function writeStageCache(userId: string, stage: string, words: WordEntry[]) {
  try {
    const indexJson = localStorage.getItem(cacheIndexKey(userId))
    const existing: string[] = indexJson ? JSON.parse(indexJson) : []
    for (const s of existing) {
      if (s !== stage) localStorage.removeItem(cacheDataKey(userId, s))
    }
    localStorage.setItem(cacheDataKey(userId, stage), JSON.stringify({ data: words }))
    localStorage.setItem(cacheIndexKey(userId), JSON.stringify([stage]))
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

// Full-library loads are never written to localStorage — only the single
// active textbook is cached (see writeStageCache).
async function fetchWordEntries(_userId: string): Promise<WordEntry[]> {
  return fetchAllWordEntries()
}

async function fetchStageWordEntries(stage: string): Promise<WordEntry[]> {
  const all: WordEntry[] = []
  let from = 0
  while (true) {
    let q = supabase.from('word_entries').select(SELECT_COLS)
    q = stage === NULL_STAGE ? q.is('stage', null) : q.eq('stage', stage)
    const { data, error } = await q
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

const stageFetchInflight = new Map<string, Promise<WordEntry[]>>()

/**
 * Fetch one stage's vocab, dedupe concurrent requests, and cache the result
 * locally. Called on every stage switch so the cache stays fresh.
 */
export function fetchStageVocab(userId: string, stage: string): Promise<WordEntry[]> {
  const key = stageKey(stage)
  const mapKey = `${userId}::${key}`
  const existing = stageFetchInflight.get(mapKey)
  if (existing) return existing
  const promise = fetchStageWordEntries(key)
    .then((words) => {
      writeStageCache(userId, key, words)
      stageFetchInflight.delete(mapKey)
      return words
    })
    .catch((err) => {
      stageFetchInflight.delete(mapKey)
      throw err
    })
  stageFetchInflight.set(mapKey, promise)
  return promise
}

/**
 * Lightweight stage metadata: distinct stages + lesson→stage map. Powers the
 * textbook switcher without downloading every word library.
 */
export interface StageIndex {
  stages: string[]
  lessonStage: Record<string, string>
}

export const EMPTY_STAGE_INDEX: StageIndex = { stages: [], lessonStage: {} }

async function fetchStageIndex(): Promise<StageIndex> {
  const lessonStage: Record<string, string> = {}
  const stageSet = new Set<string>()
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('word_entries')
      .select('stage, unit, lesson')
      .range(from, from + FETCH_PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const row of data) {
      const st = (row.stage as string | null) ?? NULL_STAGE
      stageSet.add(st)
      const lessonKey = `${row.unit}::${row.lesson}`
      if (!(lessonKey in lessonStage)) lessonStage[lessonKey] = st
    }
    if (data.length < FETCH_PAGE_SIZE) break
    from += FETCH_PAGE_SIZE
  }
  return {
    stages: [...stageSet].filter((s) => s !== NULL_STAGE).sort(compareStages),
    lessonStage,
  }
}

function readCachedStageIndex(userId: string): StageIndex | null {
  try {
    const json = localStorage.getItem(stageIndexCacheKey(userId))
    if (!json) return null
    return JSON.parse(json) as StageIndex
  } catch {
    return null
  }
}

/** Stage list + lesson→stage map; hydrate from cache, refresh in background. */
export function useStageIndex(user: User | null): StageIndex {
  const userId = user?.id ?? null
  const [index, setIndex] = useState<StageIndex>(() => {
    if (!userId) return EMPTY_STAGE_INDEX
    return readCachedStageIndex(userId) ?? EMPTY_STAGE_INDEX
  })

  useEffect(() => {
    if (!userId) return
    purgeLegacyFullCache()
    const cached = readCachedStageIndex(userId)
    if (cached) setIndex(cached)
    let cancelled = false
    void fetchStageIndex()
      .then((fresh) => {
        if (cancelled) return
        try {
          localStorage.setItem(stageIndexCacheKey(userId), JSON.stringify(fresh))
        } catch {
          /* ignore */
        }
        setIndex(fresh)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [userId])

  return index
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
    vocab_type: w.vocabType ?? null,
    image_path: w.imagePath ?? null,
    image_match_score: w.imageMatchScore ?? null,
    image_match_query: w.imageMatchQuery ?? null,
    image_source: w.imageSource ?? null,
    image_pexels_id: w.imagePexelsId ?? null,
  }
}

function fromRow(row: Record<string, unknown>): WordEntry {
  const vt = row.vocab_type
  const src = row.image_source
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
    vocabType:
      vt === 'Target' || vt === 'Context' || vt === 'Extension' ? vt : undefined,
    imagePath: (row.image_path as string) ?? undefined,
    imageMatchScore: (row.image_match_score as number) ?? undefined,
    imageMatchQuery: (row.image_match_query as string) ?? undefined,
    imageSource: src === 'pexels' || src === 'upload' ? src : undefined,
    imagePexelsId: (row.image_pexels_id as string) ?? undefined,
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

/**
 * Pass `opts` to stay textbook-scoped (never loads the full library into the
 * session store). `stage: null` waits for the caller to resolve a textbook;
 * `stage: string` loads that one book (local cache keeps at most one).
 * Omit `opts` for admin/full-library pages.
 */
export function useWordData(user: User | null, opts?: { stage: string | null }) {
  const userId = user?.id ?? null
  const isStageScoped = opts !== undefined
  const scopeStage = opts?.stage ?? null

  useEffect(() => {
    if (!userId || isStageScoped) return
    purgeLegacyFullCache()
  }, [userId, isStageScoped])

  // Stage mode must not trigger the full-library session-store fetch.
  const { data: fullVocab, isLoading: fullLoading } = wordEntriesStore.useSessionData(
    isStageScoped ? null : user,
  )

  const [stageVocab, setStageVocab] = useState<WordEntry[]>([])
  const [stageLoading, setStageLoading] = useState(true)

  useEffect(() => {
    if (!userId || !isStageScoped) return
    if (!scopeStage) {
      setStageVocab([])
      setStageLoading(true)
      return
    }
    const key = stageKey(scopeStage)
    let cancelled = false
    setStageLoading(true)
    // Cache-first hydrate, then always re-request so the cache stays fresh.
    const cached = readCachedStageVocab(userId, key)
    if (cached) {
      setStageVocab(cached)
      setStageLoading(false)
    } else {
      setStageVocab([])
    }
    void fetchStageVocab(userId, key)
      .then((words) => {
        if (cancelled) return
        setStageVocab(words)
        setStageLoading(false)
      })
      .catch(() => {
        if (!cancelled) setStageLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, isStageScoped, scopeStage])

  const vocab = isStageScoped ? stageVocab : fullVocab
  const isLoading = isStageScoped ? !scopeStage || stageLoading : fullLoading

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
      if (scopeStage) {
        const fresh = await fetchStageVocab(user.id, stageKey(scopeStage))
        setStageVocab(fresh)
      } else {
        await reloadWordEntries(user.id)
      }
    },
    [user, scopeStage],
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
        return prev.map((x) => (isSameWordEntry(x, original) ? updated : x))
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
        return prev.map((x) =>
          (x.stage ?? '') === oldStage ? { ...x, stage: newStage } : x,
        )
      })
    },
    [user],
  )

  return { vocab, upsertByStage, addWords, updateWord, deleteWord, deleteStage, renameStage, isLoading }
}
