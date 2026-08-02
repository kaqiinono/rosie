'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchViewableDraftProblemIds } from '@rosie/math/utils/math-scratch-db'

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

  const [draftProblemIds, setDraftProblemIds] = useState<Set<string>>(() => new Set())
  const [draftsReady, setDraftsReady] = useState(false)

  useEffect(() => {
    if (!userId || !key) {
      setDraftProblemIds(new Set())
      setDraftsReady(true)
      return
    }

    let cancelled = false
    void fetchViewableDraftProblemIds(userId, key.split('\0')).then((next) => {
      if (cancelled) return
      setDraftProblemIds(next)
      setDraftsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [userId, key, refreshKey])

  return { draftProblemIds, draftsReady }
}
