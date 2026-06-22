'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type { WordEntry } from '@rosie/core'

const SELECT_COLS = 'stage, unit, lesson, word, explanation, chinese_def, ipa, example, phonics, syllables, keywords'

// localStorage 缓存：按 stage 分 key，避免单词量大时整体缓存过重
// key 格式：word_cache_v1_{userId}_{stage}（stage 为空用 __null__）
const CACHE_VER = 'word_cache_v1'
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
      if (!json) return null // 缓存不完整，放弃
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
  } catch { /* localStorage 可能已满，静默忽略 */ }
}

function clearCacheForStages(userId: string, stages: string[]) {
  try {
    for (const stage of stages) {
      localStorage.removeItem(cacheDataKey(userId, stage))
    }
    const indexJson = localStorage.getItem(cacheIndexKey(userId))
    if (indexJson) {
      const existing: string[] = JSON.parse(indexJson)
      const updated = existing.filter(s => !stages.includes(s))
      localStorage.setItem(cacheIndexKey(userId), JSON.stringify(updated))
    }
  } catch { /* ignore */ }
}

const UPSERT_OPTS = { onConflict: 'unit,lesson,word,stage', ignoreDuplicates: false } as const
const FETCH_PAGE_SIZE = 1000
const UPSERT_CHUNK = 500

/** 并发 fetch 代数：仅最新一次 refresh/初始加载可写回 vocab，避免删除后被旧请求覆盖。 */
let loadGen = 0

function isSameWordEntry(a: WordEntry, b: WordEntry): boolean {
  return (
    (a.stage ?? '') === (b.stage ?? '') &&
    a.unit === b.unit &&
    a.lesson === b.lesson &&
    a.word === b.word
  )
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

/** Supabase/PostgREST 默认最多返回 1000 行，必须分页拉全量。 */
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

export function useWordData(user: User | null) {
  const [vocab, setVocabState] = useState<WordEntry[]>([])

  // 从 DB 重新读取全量词库并刷新本地状态 + 缓存。空结果也会写入（用于删空场景）。
  const refresh = useCallback(async () => {
    if (!user) return
    const gen = ++loadGen
    const words = await fetchAllWordEntries()
    if (gen !== loadGen) return
    setVocabState(words)
    writeCacheByStage(user.id, words)
  }, [user])

  useEffect(() => {
    if (!user) {
      setVocabState([])
      return
    }
    const cached = readCachedVocab(user.id)
    if (cached) setVocabState(cached)
    void refresh()
  }, [user, refresh])

  const upsertByStage = useCallback(async (words: WordEntry[]) => {
    if (!user || !words.length) return
    const stages = [...new Set(words.map(w => w.stage).filter(Boolean))] as string[]

    // 清除受影响 stage 的缓存（精确失效，不影响其他 stage）
    clearCacheForStages(user.id, stages.map(stageKey))

    for (const stage of stages) {
      await supabase.from('word_entries').delete().eq('stage', stage)
    }
    await upsertWordRows(user.id, words)
    await refresh()
  }, [user, refresh])

  // —— 按行 / 按词库的增量 CRUD（供管理后台使用，绝不整库替换）——

  /** 增量 upsert 一批单词（按复合键冲突即更新），不删除任何 stage。单个添加传长度 1 的数组。 */
  const addWords = useCallback(async (words: WordEntry[]) => {
    if (!user || !words.length) return
    await upsertWordRows(user.id, words)
    clearCacheForStages(user.id, [...new Set(words.map(w => stageKey(w.stage)))])
    await refresh()
  }, [user, refresh])

  /** 按原复合键定位后更新（支持改键字段：拼写 / unit / lesson / stage）。 */
  const updateWord = useCallback(async (original: WordEntry, updated: WordEntry) => {
    if (!user) return
    const base = supabase
      .from('word_entries')
      .update(toRow(user.id, updated))
      .eq('unit', original.unit)
      .eq('lesson', original.lesson)
      .eq('word', original.word)
    await (original.stage ? base.eq('stage', original.stage) : base.is('stage', null))
    clearCacheForStages(user.id, [stageKey(original.stage), stageKey(updated.stage)])
    await refresh()
  }, [user, refresh])

  /** 按复合键删除单个单词。 */
  const deleteWord = useCallback(async (w: WordEntry) => {
    if (!user) return
    setVocabState((prev) => prev.filter((x) => !isSameWordEntry(x, w)))
    try {
      await deleteWordRow(w)
      clearCacheForStages(user.id, [stageKey(w.stage)])
      await refresh()
    } catch (err) {
      await refresh()
      throw err
    }
  }, [user, refresh])

  /** 删除整个词库（stage 下全部单词）。UI 层需二次确认。 */
  const deleteStage = useCallback(async (stage: string) => {
    if (!user || !stage) return
    setVocabState((prev) => prev.filter((x) => (x.stage ?? '') !== stage))
    try {
      const { error } = await supabase.from('word_entries').delete().eq('stage', stage)
      if (error) throw error
      clearCacheForStages(user.id, [stageKey(stage)])
      await refresh()
    } catch (err) {
      await refresh()
      throw err
    }
  }, [user, refresh])

  /** 重命名词库：批量把 oldStage 的单词改到 newStage。 */
  const renameStage = useCallback(async (oldStage: string, newStage: string) => {
    if (!user || !newStage.trim() || oldStage === newStage) return
    await supabase.from('word_entries').update({ stage: newStage }).eq('stage', oldStage)
    clearCacheForStages(user.id, [stageKey(oldStage), stageKey(newStage)])
    await refresh()
  }, [user, refresh])

  return { vocab, upsertByStage, addWords, updateWord, deleteWord, deleteStage, renameStage }
}
