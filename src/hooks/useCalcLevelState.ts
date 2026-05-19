'use client'

import { useCallback, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CalcLevel, CalcLevelStateInfo, CalcLevelStatus } from '@/utils/type'

interface LevelStateRow {
  level: number
  status: CalcLevelStatus
  abc_passed_date: string | null
  review_r1_date: string | null
  review_r2_date: string | null
  review_r3_date: string | null
  session_count_in_level: number
  warmup_complete: boolean
  warmup_answered: number
  last_session_accuracy: number | null
  consecutive_poor_sessions: number
}

function rowToState(r: LevelStateRow): CalcLevelStateInfo {
  return {
    level: r.level === 99 ? 'C' : r.level,
    status: r.status,
    abcPassedDate: r.abc_passed_date,
    reviewR1Date: r.review_r1_date,
    reviewR2Date: r.review_r2_date,
    reviewR3Date: r.review_r3_date,
    sessionCountInLevel: r.session_count_in_level,
    warmupComplete: r.warmup_complete,
    warmupAnswered: r.warmup_answered,
    lastSessionAccuracy: r.last_session_accuracy,
    consecutivePoorSessions: r.consecutive_poor_sessions,
  }
}

function defaultLevelState(level: CalcLevel): CalcLevelStateInfo {
  return {
    level,
    status: 'practicing',
    abcPassedDate: null,
    reviewR1Date: null,
    reviewR2Date: null,
    reviewR3Date: null,
    sessionCountInLevel: 0,
    warmupComplete: false,
    warmupAnswered: 0,
    lastSessionAccuracy: null,
    consecutivePoorSessions: 0,
  }
}

function levelToInt(level: CalcLevel): number {
  return level === 'C' ? 99 : level
}

function stateToRow(s: CalcLevelStateInfo, userId: string) {
  return {
    user_id: userId,
    level: levelToInt(s.level),
    status: s.status,
    abc_passed_date: s.abcPassedDate,
    review_r1_date: s.reviewR1Date,
    review_r2_date: s.reviewR2Date,
    review_r3_date: s.reviewR3Date,
    session_count_in_level: s.sessionCountInLevel,
    warmup_complete: s.warmupComplete,
    warmup_answered: s.warmupAnswered,
    last_session_accuracy: s.lastSessionAccuracy,
    consecutive_poor_sessions: s.consecutivePoorSessions,
    updated_at: new Date().toISOString(),
  }
}

export interface UseCalcLevelStateReturn {
  levelStates: Map<number | 'C', CalcLevelStateInfo>
  isLoading: boolean
  loadForLevels: (levels: CalcLevel[]) => Promise<void>
  getLevelState: (level: CalcLevel) => CalcLevelStateInfo
  /** Record a session's outcome at a level: bumps warmup counter and stores accuracy. */
  recordSessionAtLevel: (level: CalcLevel, answered: number, accuracy: number) => Promise<void>
  /** Persist a full LevelStateInfo (overwrites). Used by the Phase 5 state machine. */
  upsertLevelState: (state: CalcLevelStateInfo) => Promise<void>
}

export function useCalcLevelState(user: User | null): UseCalcLevelStateReturn {
  const [levelStates, setLevelStates] = useState<Map<number | 'C', CalcLevelStateInfo>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const userId = user?.id ?? null

  const loadForLevels = useCallback(
    async (levels: CalcLevel[]) => {
      if (!userId || levels.length === 0) return
      setIsLoading(true)
      const intLevels = levels.map(levelToInt)
      const { data } = await supabase
        .from('calc_level_state')
        .select(
          'level,status,abc_passed_date,review_r1_date,review_r2_date,review_r3_date,session_count_in_level,warmup_complete,warmup_answered,last_session_accuracy,consecutive_poor_sessions',
        )
        .eq('user_id', userId)
        .in('level', intLevels)
      const rows = (data ?? []) as LevelStateRow[]
      setLevelStates((prev) => {
        const next = new Map(prev)
        for (const r of rows) next.set(rowToState(r).level, rowToState(r))
        return next
      })
      setIsLoading(false)
    },
    [userId],
  )

  const getLevelState = useCallback(
    (level: CalcLevel): CalcLevelStateInfo => {
      return levelStates.get(level) ?? defaultLevelState(level)
    },
    [levelStates],
  )

  const recordSessionAtLevel = useCallback(
    async (level: CalcLevel, answered: number, accuracy: number) => {
      const prev = levelStates.get(level) ?? defaultLevelState(level)
      const nextWarmupAnswered = prev.warmupAnswered + answered
      const nextWarmupComplete = prev.warmupComplete || nextWarmupAnswered >= 10
      const next: CalcLevelStateInfo = {
        ...prev,
        sessionCountInLevel: prev.sessionCountInLevel + 1,
        warmupAnswered: nextWarmupAnswered,
        warmupComplete: nextWarmupComplete,
        lastSessionAccuracy: accuracy,
        consecutivePoorSessions:
          accuracy < 0.6 && prev.warmupComplete
            ? prev.consecutivePoorSessions + 1
            : 0,
      }
      setLevelStates((prevMap) => {
        const m = new Map(prevMap)
        m.set(level, next)
        return m
      })
      if (!userId) return
      try {
        await supabase
          .from('calc_level_state')
          .upsert(stateToRow(next, userId), { onConflict: 'user_id,level' })
      } catch {
        /* ignore */
      }
    },
    [userId, levelStates],
  )

  const upsertLevelState = useCallback(
    async (next: CalcLevelStateInfo) => {
      setLevelStates((prevMap) => {
        const m = new Map(prevMap)
        m.set(next.level, next)
        return m
      })
      if (!userId) return
      try {
        await supabase
          .from('calc_level_state')
          .upsert(stateToRow(next, userId), { onConflict: 'user_id,level' })
      } catch {
        /* ignore */
      }
    },
    [userId],
  )

  return useMemo(
    () => ({
      levelStates,
      isLoading,
      loadForLevels,
      getLevelState,
      recordSessionAtLevel,
      upsertLevelState,
    }),
    [
      levelStates,
      isLoading,
      loadForLevels,
      getLevelState,
      recordSessionAtLevel,
      upsertLevelState,
    ],
  )
}
