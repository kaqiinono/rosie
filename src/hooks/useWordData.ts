'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { WordEntry } from '@/utils/type'
import { SAMPLE_WORDS } from '@/utils/english-data'

const SELECT_COLS = 'stage, unit, lesson, word, explanation, ipa, example, phonics, syllables, keywords'

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

function clearAllCache(userId: string) {
  try {
    const indexJson = localStorage.getItem(cacheIndexKey(userId))
    if (indexJson) {
      const stages: string[] = JSON.parse(indexJson)
      for (const stage of stages) {
        localStorage.removeItem(cacheDataKey(userId, stage))
      }
    }
    localStorage.removeItem(cacheIndexKey(userId))
  } catch { /* ignore */ }
}

function toRow(user_id: string, w: WordEntry) {
  return {
    user_id,
    stage: w.stage ?? null,
    unit: w.unit,
    lesson: w.lesson,
    word: w.word,
    explanation: w.explanation,
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
    void (async () => {
      // 1. 立即展示缓存（如有），让页面瞬间有内容
      const cached = readCachedVocab(user.id)
      if (cached) setVocabState(cached)

      // 2. 后台从 Supabase 拉最新数据
      const { data } = await supabase
        .from('word_entries')
        .select(SELECT_COLS)
        .eq('user_id', user.id)
        .order('unit')
        .order('lesson')

      if (data && data.length > 0) {
        const words = data.map(fromRow)
        setVocabState(words)
        writeCacheByStage(user.id, words)
      } else if (!cached) {
        // 首次使用且无缓存：写入示例数据
        await supabase.from('word_entries').insert(SAMPLE_WORDS.map(w => toRow(user.id, w)))
        setVocabState(SAMPLE_WORDS)
        writeCacheByStage(user.id, SAMPLE_WORDS)
      }
      // 若 DB 返回空但有缓存，保持缓存数据（异常情况，不清空页面）
    })()
  }, [user])

  const setVocab = useCallback(async (words: WordEntry[]) => {
    setVocabState(words)
    if (!user) return
    clearAllCache(user.id)
    await supabase.from('word_entries').delete().eq('user_id', user.id)
    if (words.length > 0) {
      await supabase.from('word_entries').insert(words.map(w => toRow(user.id, w)))
      writeCacheByStage(user.id, words)
    }
  }, [user])

  const upsertByStage = useCallback(async (words: WordEntry[]) => {
    if (!user || !words.length) return
    const stages = [...new Set(words.map(w => w.stage).filter(Boolean))] as string[]

    // 清除受影响 stage 的缓存（精确失效，不影响其他 stage）
    clearCacheForStages(user.id, stages.map(stageKey))

    for (const stage of stages) {
      await supabase.from('word_entries').delete().eq('user_id', user.id).eq('stage', stage)
    }
    await supabase.from('word_entries').insert(words.map(w => toRow(user.id, w)))
    const { data } = await supabase
      .from('word_entries')
      .select(SELECT_COLS)
      .eq('user_id', user.id)
      .order('unit')
      .order('lesson')
    if (data) {
      const allWords = data.map(fromRow)
      setVocabState(allWords)
      writeCacheByStage(user.id, allWords) // 写入完整缓存
    }
  }, [user])

  return { vocab, setVocab, upsertByStage }
}
