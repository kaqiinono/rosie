'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type {
  CalculateLevelState,
  LevelId,
  Tier,
  TierStatus,
} from '@/utils/calculate-types'
import { isLevelUnlocked } from '@/utils/calculate-trees'

interface RawRow {
  id: string
  user_id: string
  level_id: string
  tier_beginner: string
  tier_advanced: string
  tier_challenge: string
  best_accuracy_beginner: number | null
  best_accuracy_advanced: number | null
  best_accuracy_challenge: number | null
  session_count: number
  updated_at: string
}

function rowToState(row: RawRow): CalculateLevelState {
  return {
    id: row.id,
    userId: row.user_id,
    levelId: row.level_id as LevelId,
    tierBeginner: row.tier_beginner as TierStatus,
    tierAdvanced: row.tier_advanced as TierStatus,
    tierChallenge: row.tier_challenge as TierStatus,
    bestAccuracyBeginner: row.best_accuracy_beginner,
    bestAccuracyAdvanced: row.best_accuracy_advanced,
    bestAccuracyChallenge: row.best_accuracy_challenge,
    sessionCount: row.session_count,
    updatedAt: row.updated_at,
  }
}

export function useCalculateLevelState(user: User | null) {
  const [levels, setLevels] = useState<Map<LevelId, CalculateLevelState>>(new Map())
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const init = async () => {
      const { data } = await supabase
        .from('calculate_level_state')
        .select('*')
        .eq('user_id', user.id)
      if (cancelled) return
      if (data) {
        const map = new Map<LevelId, CalculateLevelState>()
        for (const row of data as RawRow[]) {
          const state = rowToState(row)
          map.set(state.levelId, state)
        }
        setLevels(map)
      }
      setIsLoading(false)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [user])

  const getTierStatus = useCallback(
    (levelId: LevelId, tier: Tier): TierStatus => {
      const state = levels.get(levelId)
      if (!state) return 'locked'
      switch (tier) {
        case 'beginner':
          return state.tierBeginner
        case 'advanced':
          return state.tierAdvanced
        case 'challenge':
          return state.tierChallenge
      }
    },
    [levels],
  )

  const isFullyPassed = useCallback(
    (levelId: LevelId): boolean => {
      const state = levels.get(levelId)
      if (!state) return false
      return (
        state.tierBeginner === 'passed' &&
        state.tierAdvanced === 'passed' &&
        state.tierChallenge === 'passed'
      )
    },
    [levels],
  )

  const passedLevelIds = useCallback((): Set<LevelId> => {
    const set = new Set<LevelId>()
    for (const [id, state] of levels) {
      if (
        state.tierBeginner === 'passed' &&
        state.tierAdvanced === 'passed' &&
        state.tierChallenge === 'passed'
      ) {
        set.add(id)
      }
    }
    return set
  }, [levels])

  const isUnlocked = useCallback(
    (levelId: LevelId): boolean => {
      return isLevelUnlocked(levelId, passedLevelIds())
    },
    [passedLevelIds],
  )

  const updateTier = useCallback(
    async (
      levelId: LevelId,
      tier: Tier,
      status: TierStatus,
      accuracy: number,
    ) => {
      if (!user) return

      const tierCol =
        tier === 'beginner'
          ? 'tier_beginner'
          : tier === 'advanced'
            ? 'tier_advanced'
            : 'tier_challenge'

      const accCol =
        tier === 'beginner'
          ? 'best_accuracy_beginner'
          : tier === 'advanced'
            ? 'best_accuracy_advanced'
            : 'best_accuracy_challenge'

      const existing = levels.get(levelId)
      const currentBest =
        tier === 'beginner'
          ? existing?.bestAccuracyBeginner
          : tier === 'advanced'
            ? existing?.bestAccuracyAdvanced
            : existing?.bestAccuracyChallenge

      const row: Record<string, unknown> = {
        user_id: user.id,
        level_id: levelId,
        [tierCol]: status,
        updated_at: new Date().toISOString(),
      }

      if (currentBest === null || currentBest === undefined || accuracy > currentBest) {
        row[accCol] = accuracy
      }

      await supabase
        .from('calculate_level_state')
        .upsert(row, { onConflict: 'user_id,level_id' })

      setLevels((prev) => {
        const next = new Map(prev)
        const old = prev.get(levelId)
        const updated: CalculateLevelState = {
          id: old?.id ?? '',
          userId: user.id,
          levelId,
          tierBeginner: tier === 'beginner' ? status : (old?.tierBeginner ?? 'locked'),
          tierAdvanced: tier === 'advanced' ? status : (old?.tierAdvanced ?? 'locked'),
          tierChallenge: tier === 'challenge' ? status : (old?.tierChallenge ?? 'locked'),
          bestAccuracyBeginner:
            tier === 'beginner' && (currentBest === null || currentBest === undefined || accuracy > currentBest)
              ? accuracy
              : (old?.bestAccuracyBeginner ?? null),
          bestAccuracyAdvanced:
            tier === 'advanced' && (currentBest === null || currentBest === undefined || accuracy > currentBest)
              ? accuracy
              : (old?.bestAccuracyAdvanced ?? null),
          bestAccuracyChallenge:
            tier === 'challenge' && (currentBest === null || currentBest === undefined || accuracy > currentBest)
              ? accuracy
              : (old?.bestAccuracyChallenge ?? null),
          sessionCount: (old?.sessionCount ?? 0) + 1,
          updatedAt: new Date().toISOString(),
        }
        next.set(levelId, updated)
        return next
      })
    },
    [user, levels],
  )

  return {
    levels,
    isLoading,
    getTierStatus,
    isFullyPassed,
    isUnlocked,
    passedLevelIds,
    updateTier,
  }
}
