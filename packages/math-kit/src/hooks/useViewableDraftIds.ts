'use client'

import { useMemo } from 'react'
import { useDraftQuery } from './useDraftQuery'
import { fetchViewableDraftProblemIds } from '@rosie/math-kit/utils/math-scratch-db'

const NO_DRAFTS = new Set<string>()

/**
 * One batched presence load for a list of problem ids (plan page).
 * Avoids per-card problemHasViewableDraft storms.
 *
 * Deps are intentionally primitives only (`userId`, sorted id key, `refreshKey`)
 * so AuthContext / parent array identity cannot retrigger the fetch.
 */
export function useViewableDraftIds(
  user: { id: string } | null,
  problemIds: string[],
  /** Bump to refetch (e.g. after practice session ends). */
  refreshKey = 0,
): { draftProblemIds: Set<string>; draftsReady: boolean } {
  const userId = user?.id ?? null

  const key = useMemo(() => {
    const unique = [...new Set(problemIds)].filter(Boolean)
    unique.sort()
    return unique.join('\0')
  }, [problemIds])

  const load = useMemo(
    () => userId && key ? () => fetchViewableDraftProblemIds(userId, key.split('\0')) : null,
    [userId, key],
  )
  const ids = useDraftQuery(load, refreshKey)
  return { draftProblemIds: ids ?? NO_DRAFTS, draftsReady: !load || ids !== undefined }
}
