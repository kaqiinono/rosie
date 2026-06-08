'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { WordEntry } from '@/utils/type'

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

let initLock: string | null = null

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

  useEffect(() => {
    if (!user) return
    if (initLock === user.id) return
    initLock = user.id
    void (async () => {
      const cached = readCachedVocab(user.id)
      if (cached) setVocabState(cached)

      const { data } = await supabase
        .from('word_entries')
        .select(SELECT_COLS)
        .order('unit')
        .order('lesson')

      if (data && data.length > 0) {
        const words = data.map(fromRow)
        setVocabState(words)
        writeCacheByStage(user.id, words)
      }
    })()
    return () => { initLock = null }
  }, [user])

  const upsertByStage = useCallback(async (words: WordEntry[]) => {
    if (!user || !words.length) return
    const stages = [...new Set(words.map(w => w.stage).filter(Boolean))] as string[]

    // 清除受影响 stage 的缓存（精确失效，不影响其他 stage）
    clearCacheForStages(user.id, stages.map(stageKey))

    for (const stage of stages) {
      await supabase.from('word_entries').delete().eq('stage', stage)
    }
    await supabase.from('word_entries').upsert(words.map(w => toRow(user.id, w)), UPSERT_OPTS)
    const { data } = await supabase
      .from('word_entries')
      .select(SELECT_COLS)
      .order('unit')
      .order('lesson')
    if (data) {
      const allWords = data.map(fromRow)
      setVocabState(allWords)
      writeCacheByStage(user.id, allWords) // 写入完整缓存
    }
  }, [user])

  return { vocab, upsertByStage }
}
