'use client'

import { useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'

export type MathWrongRow = {
  problemId: string
  addedAt: string
  resolved: boolean
  resolvedAt: string | null
}

function parseRows(
  data: {
    problem_id: string
    added_at?: string
    resolved?: boolean
    resolved_at?: string | null
  }[],
): MathWrongRow[] {
  return data.map((r) => ({
    problemId: r.problem_id,
    addedAt: r.added_at ?? '',
    resolved: r.resolved ?? false,
    resolvedAt: r.resolved_at ?? null,
  }))
}

async function fetchWrongRows(userId: string): Promise<MathWrongRow[]> {
  const { data, error } = await supabase
    .from('math_wrong')
    .select('problem_id, added_at, resolved, resolved_at')
    .eq('user_id', userId)
  if (error) {
    const fallback = await supabase
      .from('math_wrong')
      .select('problem_id, added_at')
      .eq('user_id', userId)
    if (fallback.data) {
      return parseRows(fallback.data.map((r) => ({ ...r, resolved: false, resolved_at: null })))
    }
    return []
  }
  return data ? parseRows(data) : []
}

export const mathWrongStore = createUserSessionStore<MathWrongRow[]>('math_wrong', {
  fetch: fetchWrongRows,
  empty: [],
})

export function useMathWrong(user: User | null) {
  const { data: rows, isLoading } = mathWrongStore.useSessionData(user)

  const wrongIds = useMemo(
    () => new Set(rows.filter((r) => !r.resolved).map((r) => r.problemId)),
    [rows],
  )

  const loadWrong = useCallback(async () => {
    if (!user) return
    mathWrongStore.invalidate(user.id)
    mathWrongStore.ensureLoaded(user.id)
  }, [user])

  const removeWrong = useCallback(async (problemId: string) => {
    if (!user) return
    mathWrongStore.patchSessionData(user.id, (prev) =>
      prev.filter((r) => r.problemId !== problemId),
    )
    await supabase
      .from('math_wrong')
      .delete()
      .eq('user_id', user.id)
      .eq('problem_id', problemId)
  }, [user])

  const markResolved = useCallback(async (problemId: string) => {
    if (!user) return
    const now = new Date().toISOString()
    mathWrongStore.patchSessionData(user.id, (prev) =>
      prev.map((r) =>
        r.problemId === problemId ? { ...r, resolved: true, resolvedAt: now } : r,
      ),
    )
    const { error } = await supabase
      .from('math_wrong')
      .update({ resolved: true, resolved_at: now })
      .eq('user_id', user.id)
      .eq('problem_id', problemId)
    if (error) {
      await supabase.from('math_wrong').delete().eq('user_id', user.id).eq('problem_id', problemId)
      mathWrongStore.patchSessionData(user.id, (prev) =>
        prev.filter((r) => r.problemId !== problemId),
      )
    }
  }, [user])

  const addWrong = useCallback(
    (problemId: string) => {
      if (!user) return
      const now = new Date().toISOString()
      mathWrongStore.patchSessionData(user.id, (prev) => {
        if (prev.some((r) => r.problemId === problemId && !r.resolved)) return prev
        const without = prev.filter((r) => r.problemId !== problemId)
        return [
          ...without,
          { problemId, addedAt: now, resolved: false, resolvedAt: null },
        ]
      })
      void supabase.from('math_wrong').upsert(
        { user_id: user.id, problem_id: problemId, resolved: false, resolved_at: null },
        { onConflict: 'user_id,problem_id' },
      )
    },
    [user],
  )

  return { wrongIds, rows, removeWrong, markResolved, addWrong, refetchWrong: loadWrong, isLoading }
}
