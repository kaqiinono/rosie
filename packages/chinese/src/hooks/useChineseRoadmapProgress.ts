'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase, useAuth } from '@rosie/core'
import type { ChineseLessonCharRow, ChineseLessonRow, LessonCharGroup } from '../types/chineseCharData'
import type { CharTier } from '../utils/g1b/types'
import {
  normalizeMasteryMapForBook,
  parseBookSlug,
} from '../utils/chinese-helpers'
import { buildChineseRoadmap, type RoadmapNode } from '../utils/chinese-roadmap'
import { getChineseBook, type ChineseBookSlug } from '../utils/chinese-books'
import { buildLessonGroups } from './useChineseCharData'
import { useCharMastery, type CharMasteryMap } from './useCharMastery'
import { useActiveChineseBook } from './useActiveChineseBook'

export type ChineseRoadmapCatalog = {
  lessons: ChineseLessonRow[]
  lessonGroups: LessonCharGroup[]
}

/** Per-user cache of book-scoped roadmap catalog (lessons + lesson chars only). */
type RoadmapCatalogCache = Partial<Record<ChineseBookSlug, ChineseRoadmapCatalog>>

const FETCH_PAGE_SIZE = 1000

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

async function fetchLessonCharsForKeys(lessonKeys: string[]): Promise<ChineseLessonCharRow[]> {
  if (lessonKeys.length === 0) return []
  const all: ChineseLessonCharRow[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('chinese_lesson_chars')
      .select('lesson_key,char_key,track,sort_order,pinyin_in_lesson')
      .in('lesson_key', lessonKeys)
      .order('lesson_key', { ascending: true })
      .order('sort_order', { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data.map((r) => fromLessonCharRow(r as Record<string, unknown>)))
    if (data.length < FETCH_PAGE_SIZE) break
    from += FETCH_PAGE_SIZE
  }
  return all
}

async function fetchBookRoadmapCatalog(bookSlug: ChineseBookSlug): Promise<ChineseRoadmapCatalog> {
  const parsed = parseBookSlug(bookSlug)
  if (!parsed) return { lessons: [], lessonGroups: [] }

  const { data: lessonRows, error } = await supabase
    .from('chinese_lessons')
    .select(
      'lesson_key,grade,semester,unit,lesson,lesson_title,lesson_kind,unit_type,sort_order,recall_phrases',
    )
    .eq('grade', parsed.grade)
    .eq('semester', parsed.semester)
    .order('sort_order', { ascending: true })

  if (error) throw error
  const lessons = (lessonRows ?? []).map((r) => fromLessonRow(r as Record<string, unknown>))
  const lessonKeys = lessons.map((l) => l.lessonKey)
  const lessonChars = await fetchLessonCharsForKeys(lessonKeys)
  return {
    lessons,
    lessonGroups: buildLessonGroups(lessons, lessonChars),
  }
}

export const chineseRoadmapCatalogStore = createUserSessionStore<RoadmapCatalogCache>(
  'chinese_roadmap_catalog',
  {
    // Books are loaded lazily per slug; this fetch only establishes the user slot.
    fetch: async () => ({}),
    empty: {},
  },
)

const bookInflight = new Map<string, Promise<ChineseRoadmapCatalog>>()

/** Lazy-load + cache one book's lessons + lessonGroups (shared by progress + admin). */
export function ensureBookCatalog(
  userId: string,
  bookSlug: ChineseBookSlug,
): Promise<ChineseRoadmapCatalog> {
  const cached = chineseRoadmapCatalogStore.getSessionData(userId)?.[bookSlug]
  if (cached) return Promise.resolve(cached)

  const inflightKey = `${userId}:${bookSlug}`
  const existing = bookInflight.get(inflightKey)
  if (existing) return existing

  const promise = fetchBookRoadmapCatalog(bookSlug)
    .then((payload) => {
      chineseRoadmapCatalogStore.patchSessionData(userId, (prev) => ({
        ...prev,
        [bookSlug]: payload,
      }))
      return payload
    })
    .finally(() => {
      bookInflight.delete(inflightKey)
    })

  bookInflight.set(inflightKey, promise)
  return promise
}

export type ChineseRoadmapProgress = {
  bookSlug: ChineseBookSlug
  bookLabel: string
  lessons: ChineseLessonRow[]
  lessonGroups: LessonCharGroup[]
  masteryMap: CharMasteryMap
  isCharDataLoading: boolean
  isCharDataReady: boolean
  currentNode: RoadmapNode | null
  allDone: boolean
  done: number
  total: number
  lessonDone: boolean
  hasChinese: boolean
}

/**
 * Homepage /today progress for 语文闯关 — loads only active-book lessons +
 * lesson_chars + shared mastery. Skips char_entries, wrong book, and weekly plans.
 */
export function useChineseRoadmapProgress(user?: User | null): ChineseRoadmapProgress {
  const { user: authUser } = useAuth()
  const resolvedUser = user === undefined ? authUser : user
  const bookSlug = useActiveChineseBook()
  const bookMeta = getChineseBook(bookSlug)
  const { masteryMap: rawMastery, isLoading: masteryLoading } = useCharMastery(resolvedUser)
  const { data: catalogCache, isLoading: cacheSlotLoading } =
    chineseRoadmapCatalogStore.useSessionData(resolvedUser)
  const [bookFetchError, setBookFetchError] = useState(false)

  const catalog = catalogCache[bookSlug]
  const bookLoading = !!resolvedUser && !catalog && !bookFetchError

  useEffect(() => {
    if (!resolvedUser) return
    if (catalogCache[bookSlug]) {
      setBookFetchError(false)
      return
    }
    let cancelled = false
    setBookFetchError(false)
    void ensureBookCatalog(resolvedUser.id, bookSlug).catch(() => {
      if (!cancelled) setBookFetchError(true)
    })
    return () => {
      cancelled = true
    }
  }, [resolvedUser, bookSlug, catalogCache])

  const masteryMap = useMemo(
    () => normalizeMasteryMapForBook(rawMastery, bookSlug),
    [rawMastery, bookSlug],
  )

  const lessons = catalog?.lessons ?? []
  const lessonGroups = catalog?.lessonGroups ?? []
  // Ready once the active-book catalog has been fetched (even if empty).
  const isCharDataReady = !!catalog && lessons.length > 0
  const isCharDataLoading = masteryLoading || cacheSlotLoading || bookLoading

  const roadmap = useMemo(
    () => (isCharDataReady ? buildChineseRoadmap(lessons, lessonGroups, masteryMap, bookSlug) : null),
    [isCharDataReady, lessons, lessonGroups, masteryMap, bookSlug],
  )
  const currentNode = roadmap?.nodes.find((n) => n.state === 'current') ?? null
  const allDone = isCharDataReady && !currentNode
  const done = currentNode?.status.correct ?? 0
  const total = currentNode?.status.total ?? 0
  const lessonDone = total > 0 && done >= total

  return {
    bookSlug,
    bookLabel: bookMeta?.label ?? bookSlug,
    lessons,
    lessonGroups,
    masteryMap,
    isCharDataLoading,
    isCharDataReady,
    currentNode,
    allDone,
    done,
    total,
    lessonDone,
    hasChinese: isCharDataReady,
  }
}
