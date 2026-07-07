'use client'

import { useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, invalidateSessionStore, supabase } from '@rosie/core'
import type {
  ChineseCharProfile,
  ChineseLessonCharRow,
  ChineseLessonRow,
  LessonCharGroup,
} from '../types/chineseCharData'
import type { CharTier } from '../utils/g1b/types'

const CACHE_VER = 'chinese_char_data_v4'
const FETCH_PAGE_SIZE = 1000

export interface ChineseCharDataPayload {
  chars: ChineseCharProfile[]
  lessons: ChineseLessonRow[]
  lessonChars: ChineseLessonCharRow[]
}

function cacheKey(userId: string) {
  return `${CACHE_VER}_${userId}`
}

function readCache(userId: string): ChineseCharDataPayload | null {
  try {
    const json = localStorage.getItem(cacheKey(userId))
    if (!json) return null
    return JSON.parse(json) as ChineseCharDataPayload
  } catch {
    return null
  }
}

function writeCache(userId: string, payload: ChineseCharDataPayload) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

function fromCharRow(row: Record<string, unknown>): ChineseCharProfile {
  return {
    charKey: row.char_key as string,
    char: row.char as string,
    grade: row.grade as number,
    semester: row.semester as '上' | '下',
    pinyin: row.pinyin as string,
    pinyinAlt: (row.pinyin_alt as string[]) ?? [],
    radical: row.radical as string,
    radicalName: row.radical_name as string,
    structure: (row.structure as string) ?? '',
    strokeCount: row.stroke_count as number,
    phrases: (row.phrases as string[]) ?? [],
    tiers: (row.tiers as CharTier[]) ?? [],
  }
}

function fromLessonRow(row: Record<string, unknown>): ChineseLessonRow {
  return {
    lessonKey: row.lesson_key as string,
    grade: row.grade as number,
    semester: row.semester as '上' | '下',
    unit: row.unit as number,
    lesson: row.lesson as number,
    lessonTitle: row.lesson_title as string,
    lessonKind: row.lesson_kind as ChineseLessonRow['lessonKind'],
    unitType: (row.unit_type as ChineseLessonRow['unitType']) ?? undefined,
    sortOrder: (row.sort_order as number) ?? 0,
    recallPhrases: (row.recall_phrases as string[]) ?? [],
  }
}

function fromLessonCharRow(row: Record<string, unknown>): ChineseLessonCharRow {
  const charKey = row.char_key as string
  return {
    lessonKey: row.lesson_key as string,
    charKey,
    char: charKey.split('::').pop() ?? charKey,
    track: row.track as CharTier,
    sortOrder: row.sort_order as number,
    pinyinInLesson: row.pinyin_in_lesson as string,
  }
}

async function fetchAllRows<T>(
  table: string,
  select: string,
  order: string,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  const orderCols = order.split(',').map((col) => col.trim()).filter(Boolean)
  while (true) {
    let query = supabase.from(table).select(select)
    for (const col of orderCols) {
      query = query.order(col, { ascending: true })
    }
    const { data, error } = await query.range(from, from + FETCH_PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < FETCH_PAGE_SIZE) break
    from += FETCH_PAGE_SIZE
  }
  return all
}

async function fetchChineseCharData(userId: string): Promise<ChineseCharDataPayload> {
  const [charRows, lessonRows, lcRows] = await Promise.all([
    fetchAllRows<Record<string, unknown>>(
      'chinese_char_entries',
      'char_key,char,grade,semester,pinyin,pinyin_alt,radical,radical_name,structure,stroke_count,phrases,tiers',
      'char_key',
    ),
    fetchAllRows<Record<string, unknown>>(
      'chinese_lessons',
      'lesson_key,grade,semester,unit,lesson,lesson_title,lesson_kind,unit_type,sort_order,recall_phrases',
      'sort_order',
    ),
    fetchAllRows<Record<string, unknown>>(
      'chinese_lesson_chars',
      'lesson_key,char_key,track,sort_order,pinyin_in_lesson',
      'lesson_key,sort_order',
    ),
  ])

  const payload: ChineseCharDataPayload = {
    chars: charRows.map(fromCharRow),
    lessons: lessonRows.map(fromLessonRow),
    lessonChars: lcRows.map(fromLessonCharRow),
  }
  writeCache(userId, payload)
  return payload
}

export const chineseCharDataStore = createUserSessionStore<ChineseCharDataPayload>(
  'chinese_chars',
  {
    fetch: fetchChineseCharData,
    empty: { chars: [], lessons: [], lessonChars: [] },
  },
)

export function buildLessonGroups(
  lessons: ChineseLessonRow[],
  lessonChars: ChineseLessonCharRow[],
): LessonCharGroup[] {
  const lessonMap = new Map(lessons.map((l) => [l.lessonKey, l]))
  const byLesson = new Map<string, ChineseLessonCharRow[]>()

  for (const lc of lessonChars) {
    if (!byLesson.has(lc.lessonKey)) byLesson.set(lc.lessonKey, [])
    byLesson.get(lc.lessonKey)!.push(lc)
  }

  const keys = lessons.length ? lessons.map((l) => l.lessonKey) : [...byLesson.keys()]

  const groups: LessonCharGroup[] = []
  for (const lessonKey of keys) {
    const meta = lessonMap.get(lessonKey)
    const rows = (byLesson.get(lessonKey) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
    const recognize = rows.filter((r) => r.track === 'recognize')
    const write = rows.filter((r) => r.track === 'write')
    if (!meta && rows.length === 0) continue
    groups.push({
      lessonKey,
      unit: meta?.unit ?? 0,
      lesson: meta?.lesson ?? 0,
      lessonTitle: meta?.lessonTitle ?? lessonKey,
      lessonKind: meta?.lessonKind ?? 'lesson',
      recognize: recognize.map((r) => r.char),
      recognizePinyin: recognize.map((r) => r.pinyinInLesson),
      write: write.map((r) => r.char),
      writePinyin: write.map((r) => r.pinyinInLesson),
    })
  }
  return groups
}

export function useChineseCharData(user: User | null) {
  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    const snapshot = chineseCharDataStore.getSnapshot(userId)
    if (snapshot.status === 'idle') {
      const cached = readCache(userId)
      if (cached) chineseCharDataStore.replaceSessionData(userId, cached)
    }
  }, [userId])

  const { data, isLoading, error } = chineseCharDataStore.useSessionData(user)

  const refresh = useCallback(async () => {
    if (!user) return
    invalidateSessionStore('chinese_chars')
    chineseCharDataStore.ensureLoaded(user.id)
  }, [user])

  const charByKey = useMemo(() => new Map(data.chars.map((c) => [c.charKey, c])), [data.chars])

  const lessonGroups = useMemo(
    () => buildLessonGroups(data.lessons, data.lessonChars),
    [data.lessons, data.lessonChars],
  )

  const getCharProfile = useCallback(
    (charKeyValue: string) => charByKey.get(charKeyValue),
    [charByKey],
  )

  return {
    chars: data.chars,
    charByKey,
    lessons: data.lessons,
    lessonChars: data.lessonChars,
    lessonGroups,
    getCharProfile,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refresh,
    isReady: data.chars.length > 0 && lessonGroups.length > 0,
  }
}
