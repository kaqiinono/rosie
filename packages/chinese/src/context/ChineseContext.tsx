'use client'

import React, { createContext, useContext, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import type { WordMasteryInfo } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { useCharMastery, type CharMasteryMap, type CharMasteryResult } from '../hooks/useCharMastery'
import { useChineseCharData } from '../hooks/useChineseCharData'
import { useChineseWeeklyPlan } from '../hooks/useChineseWeeklyPlan'
import {
  useChineseWrong,
  type ChineseWrongItemType,
  type ChineseWrongKind,
  type ChineseWrongRow,
} from '../hooks/useChineseWrong'
import type { ChineseCharProfile, ChineseLessonRow, LessonCharGroup } from '../types/chineseCharData'
import type { CharTrack } from '../utils/chinese-helpers'
import { masteryKey } from '../utils/chinese-helpers'
import type { ChineseWeeklyPlan, ChineseWeekDayProgress } from '../utils/chineseWeeklyPlan'

interface ChineseContextValue {
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
  } = useChineseWeeklyPlan(user, lessonGroups)

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
        chars,
        charByKey,
        lessons,
        lessonGroups,
        getCharProfile,
        isCharDataLoading,
        charDataError,
        isCharDataReady,
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
