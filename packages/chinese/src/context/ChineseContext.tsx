'use client'

import React, { createContext, useContext, useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import type { WordMasteryInfo } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { useCharMastery, type CharMasteryMap, type CharMasteryResult } from '../hooks/useCharMastery'
import { useChineseCharData } from '../hooks/useChineseCharData'
import { useChineseWeeklyPlan } from '../hooks/useChineseWeeklyPlan'
import { useActiveChineseBook } from '../hooks/useActiveChineseBook'
import {
  useChineseWrong,
  type ChineseWrongItemType,
  type ChineseWrongKind,
  type ChineseWrongRow,
} from '../hooks/useChineseWrong'
import type { ChineseCharProfile, ChineseLessonRow, LessonCharGroup } from '../types/chineseCharData'
import type { CharTrack } from '../utils/chinese-helpers'
import { charKey, masteryKey, parseBookSlug } from '../utils/chinese-helpers'
import type { ChineseBookSlug } from '../utils/chinese-books'
import { getChineseBook } from '../utils/chinese-books'
import type { ChineseWeeklyPlan, ChineseWeekDayProgress } from '../utils/chineseWeeklyPlan'

interface ChineseContextValue {
  bookSlug: ChineseBookSlug
  bookLabel: string
  charKeyForBook: (ch: string) => string
  user: User | null
  masteryMap: CharMasteryMap
  recordBatch: (results: CharMasteryResult[]) => void
  getMastery: (charKeyValue: string, track: CharTrack) => WordMasteryInfo
  weeklyPlan: ChineseWeeklyPlan | null
  allPlans: ChineseWeeklyPlan[]
  currentWeekStart: string | null
  defaultParams: {
    weekStartDay: number
    newRecognizePerDay: number
    newWritePerDay: number
  } | null
  savePlan: (plan: ChineseWeeklyPlan) => Promise<ChineseWeeklyPlan>
  generatePlan: (lessonKey?: string) => Promise<ChineseWeeklyPlan>
  updateDayProgress: (date: string, progress: ChineseWeekDayProgress) => Promise<void>
  isPlanLoading: boolean
  chars: ChineseCharProfile[]
  charByKey: Map<string, ChineseCharProfile>
  lessons: ChineseLessonRow[]
  lessonGroups: LessonCharGroup[]
  getCharProfile: (charKeyValue: string) => ChineseCharProfile | undefined
  isCharDataLoading: boolean
  charDataError: string | null
  isCharDataReady: boolean
  wrongRows: ChineseWrongRow[]
  unresolvedWrong: ChineseWrongRow[]
  addWrong: (itemKey: string, itemType: ChineseWrongItemType, wrongKind: ChineseWrongKind) => Promise<void>
  markWrongResolved: (itemKey: string, wrongKind: ChineseWrongKind) => Promise<void>
}

const ChineseContext = createContext<ChineseContextValue | null>(null)

export function ChineseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const bookSlug = useActiveChineseBook()
  const bookMeta = getChineseBook(bookSlug)
  const { masteryMap, recordBatch: recordBatchRaw, getMastery } = useCharMastery(user)
  const {
    rows: wrongRows,
    unresolved: unresolvedWrong,
    addWrong,
    markResolved: markWrongResolved,
  } = useChineseWrong(user)
  const {
    chars,
    charByKey,
    lessons,
    lessonChars,
    lessonGroups,
    getCharProfile,
    isLoading: isCharDataLoading,
    error: charDataError,
    isReady: isCharDataReady,
  } = useChineseCharData(user)
  const {
    weeklyPlan,
    allPlans,
    currentWeekStart,
    defaultParams,
    savePlan,
    generatePlan,
    updateDayProgress,
    isLoading: isPlanLoading,
  } = useChineseWeeklyPlan(user, lessonGroups, bookSlug)

  const bookFilter = useMemo(() => parseBookSlug(bookSlug), [bookSlug])

  const filteredLessons = useMemo(() => {
    if (!bookFilter) return lessons
    return lessons.filter(
      (l) => l.grade === bookFilter.grade && l.semester === bookFilter.semester,
    )
  }, [lessons, bookFilter])

  const filteredLessonKeys = useMemo(
    () => new Set(filteredLessons.map((l) => l.lessonKey)),
    [filteredLessons],
  )

  const filteredChars = useMemo(() => {
    const prefix = `${bookSlug}::`
    return chars.filter((c) => c.charKey.startsWith(prefix))
  }, [chars, bookSlug])

  const filteredLessonChars = useMemo(
    () => lessonChars.filter((lc) => filteredLessonKeys.has(lc.lessonKey)),
    [lessonChars, filteredLessonKeys],
  )

  const filteredLessonGroups = useMemo(
    () =>
      lessonGroups.filter((g) => filteredLessonKeys.has(g.lessonKey)),
    [lessonGroups, filteredLessonKeys],
  )

  const filteredCharByKey = useMemo(
    () => new Map(filteredChars.map((c) => [c.charKey, c])),
    [filteredChars],
  )

  const charKeyForBook = useCallback((ch: string) => charKey(ch, bookSlug), [bookSlug])

  const getFilteredCharProfile = useCallback(
    (charKeyValue: string) => filteredCharByKey.get(charKeyValue),
    [filteredCharByKey],
  )

  const recordBatch = useCallback(
    (results: CharMasteryResult[]) => {
      recordBatchRaw(results)
      for (const r of results) {
        const key = masteryKey(r.charKey, r.track)
        if (r.correct) void markWrongResolved(key, r.track === 'write' ? 'stroke' : 'pinyin')
        else void addWrong(key, 'char', r.track === 'write' ? 'stroke' : 'pinyin')
      }
    },
    [recordBatchRaw, addWrong, markWrongResolved],
  )

  return (
    <ChineseContext.Provider
      value={{
        bookSlug,
        bookLabel: bookMeta?.label ?? bookSlug,
        charKeyForBook,
        user,
        masteryMap,
        recordBatch,
        getMastery,
        weeklyPlan,
        allPlans,
        currentWeekStart,
        defaultParams,
        savePlan,
        generatePlan,
        updateDayProgress,
        isPlanLoading,
        chars: filteredChars,
        charByKey: filteredCharByKey,
        lessons: filteredLessons,
        lessonGroups: filteredLessonGroups,
        getCharProfile: getFilteredCharProfile,
        isCharDataLoading,
        charDataError,
        isCharDataReady: filteredChars.length > 0 && filteredLessonGroups.length > 0,
        wrongRows,
        unresolvedWrong,
        addWrong,
        markWrongResolved,
      }}
    >
      {children}
    </ChineseContext.Provider>
  )
}

export function useChineseContext() {
  const ctx = useContext(ChineseContext)
  if (!ctx) throw new Error('useChineseContext must be used within ChineseProvider')
  return ctx
}
