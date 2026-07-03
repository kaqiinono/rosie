'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type {
  ChineseCharProfile,
  ChineseLessonCharRow,
  ChineseLessonRow,
  LessonCharGroup,
} from '../types/chineseCharData'
import type { CharTier } from '../utils/g1b/types'

const CACHE_VER = 'chinese_char_data_v4'
const FETCH_PAGE_SIZE = 1000

function cacheKey(userId: string) {
  return `${CACHE_VER}_${userId}`
}

interface CachedPayload {
  chars: ChineseCharProfile[]
  lessons: ChineseLessonRow[]
  lessonChars: ChineseLessonCharRow[]
}

function readCache(userId: string): CachedPayload | null {
  try {
    const json = localStorage.getItem(cacheKey(userId))
    if (!json) return null
    return JSON.parse(json) as CachedPayload
  } catch {
    return null
  }
}

function writeCache(userId: string, payload: CachedPayload) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

let loadGen = 0

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

  const keys = lessons.length
    ? lessons.map((l) => l.lessonKey)
    : [...byLesson.keys()]

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
  const [chars, setChars] = useState<ChineseCharProfile[]>([])
  const [lessons, setLessons] = useState<ChineseLessonRow[]>([])
  const [lessonChars, setLessonChars] = useState<ChineseLessonCharRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    const gen = ++loadGen
    setIsLoading(true)
    setError(null)
    try {
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
      if (gen !== loadGen) return

      const nextChars = charRows.map(fromCharRow)
      const nextLessons = lessonRows.map(fromLessonRow)
      const nextLessonChars = lcRows.map(fromLessonCharRow)

      setChars(nextChars)
      setLessons(nextLessons)
      setLessonChars(nextLessonChars)
      writeCache(user.id, {
        chars: nextChars,
        lessons: nextLessons,
        lessonChars: nextLessonChars,
      })
    } catch (err) {
      if (gen !== loadGen) return
      setError(err instanceof Error ? err.message : '加载字库失败')
    } finally {
      if (gen === loadGen) setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setChars([])
      setLessons([])
      setLessonChars([])
      setError(null)
      return
    }
    const cached = readCache(user.id)
    if (cached) {
      setChars(cached.chars)
      setLessons(cached.lessons)
      setLessonChars(cached.lessonChars)
    }
    void refresh()
  }, [user, refresh])

  const charByKey = useMemo(() => new Map(chars.map((c) => [c.charKey, c])), [chars])

  const lessonGroups = useMemo(
    () => buildLessonGroups(lessons, lessonChars),
    [lessons, lessonChars],
  )

  const getCharProfile = useCallback(
    (charKeyValue: string) => charByKey.get(charKeyValue),
    [charByKey],
  )

  return {
    chars,
    charByKey,
    lessons,
    lessonChars,
    lessonGroups,
    getCharProfile,
    isLoading,
    error,
    refresh,
    isReady: chars.length > 0 && lessonGroups.length > 0,
  }
}
