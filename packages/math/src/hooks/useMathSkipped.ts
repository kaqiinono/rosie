'use client'

import { useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import {
  isMathSkipReason,
  type MathSkipEntry,
  type MathSkipReason,
} from '@rosie/math/utils/math-skip-reasons'

export type MathSkippedMap = Record<string, MathSkipEntry>

async function fetchSkippedMap(userId: string): Promise<MathSkippedMap> {
  const { data } = await supabase
    .from('math_skipped')
    .select('problem_id, reason, note, added_at')
    .eq('user_id', userId)
  const map: MathSkippedMap = {}
  for (const row of data ?? []) {
    const reasonRaw = (row.reason as string | null) ?? 'later'
    const reason: MathSkipReason = isMathSkipReason(reasonRaw) ? reasonRaw : 'later'
    map[row.problem_id as string] = {
      reason,
      note: (row.note as string | null) ?? undefined,
      addedAt: (row.added_at as string | null) ?? '',
    }
  }
  return map
}

export const mathSkippedStore = createUserSessionStore<MathSkippedMap>('math_skipped', {
  fetch: fetchSkippedMap,
  empty: {},
})

export function useMathSkipped(user: User | null) {
  const { data: skippedMap, isLoading } = mathSkippedStore.useSessionData(user)

  const skippedIds = useMemo(() => new Set(Object.keys(skippedMap)), [skippedMap])

  const isSkipped = useCallback(
    (problemId: string) => problemId in skippedMap,
    [skippedMap],
  )

  const getSkipEntry = useCallback(
    (problemId: string): MathSkipEntry | undefined => skippedMap[problemId],
    [skippedMap],
  )

  const addSkipped = useCallback(
    (problemId: string, reason: MathSkipReason, note?: string) => {
      if (!user) return
      const trimmedNote = reason === 'other' ? note?.trim() || undefined : undefined
      const now = new Date().toISOString()
      const entry: MathSkipEntry = { reason, note: trimmedNote, addedAt: now }
      mathSkippedStore.patchSessionData(user.id, (prev) => ({
        ...prev,
        [problemId]: entry,
      }))
      void supabase
        .from('math_skipped')
        .upsert(
          {
            user_id: user.id,
            problem_id: problemId,
            reason,
            note: trimmedNote ?? null,
            added_at: now,
          },
          { onConflict: 'user_id,problem_id' },
        )
        .then(({ error }) => {
          if (error) {
            console.error('[math_skipped] upsert error:', error)
            mathSkippedStore.patchSessionData(user.id, (prev) => {
              const next = { ...prev }
              delete next[problemId]
              return next
            })
          }
        })
    },
    [user],
  )

  const clearSkipped = useCallback(
    (problemId: string) => {
      if (!user) return
      if (!(problemId in skippedMap)) return
      const removed = skippedMap[problemId]
      mathSkippedStore.patchSessionData(user.id, (prev) => {
        const next = { ...prev }
        delete next[problemId]
        return next
      })
      void supabase
        .from('math_skipped')
        .delete()
        .eq('user_id', user.id)
        .eq('problem_id', problemId)
        .then(({ error }) => {
          if (error) {
            console.error('[math_skipped] delete error:', error)
            if (removed) {
              mathSkippedStore.patchSessionData(user.id, (prev) => ({
                ...prev,
                [problemId]: removed,
              }))
            }
          }
        })
    },
    [user, skippedMap],
  )

  return {
    skippedMap,
    skippedIds,
    isSkipped,
    getSkipEntry,
    addSkipped,
    clearSkipped,
    isLoading,
  }
}
