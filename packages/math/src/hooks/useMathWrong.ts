'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'

export type MathWrongRow = {
  problemId: string
  addedAt: string
  resolved: boolean
  resolvedAt: string | null
}

function parseRows(data: { problem_id: string; added_at?: string; resolved?: boolean; resolved_at?: string | null }[]): MathWrongRow[] {
  return data.map(r => ({
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
      return parseRows(fallback.data.map(r => ({ ...r, resolved: false, resolved_at: null })))
    }
    return []
  }
  return data ? parseRows(data) : []
}

export function useMathWrong(user: User | null) {
  const [rows, setRows] = useState<MathWrongRow[]>([])

  const loadWrong = useCallback(async () => {
    if (!user) return
    setRows(await fetchWrongRows(user.id))
  }, [user])

  useEffect(() => {
    if (!user) return
    void fetchWrongRows(user.id).then(setRows)
  }, [user])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadWrong()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadWrong])

  const wrongIds = new Set(rows.filter(r => !r.resolved).map(r => r.problemId))

  const removeWrong = useCallback(async (problemId: string) => {
    if (!user) return
    setRows(prev => prev.filter(r => r.problemId !== problemId))
    await supabase
      .from('math_wrong')
      .delete()
      .eq('user_id', user.id)
      .eq('problem_id', problemId)
  }, [user])

  const markResolved = useCallback(async (problemId: string) => {
    if (!user) return
    const now = new Date().toISOString()
    setRows(prev => prev.map(r =>
      r.problemId === problemId ? { ...r, resolved: true, resolvedAt: now } : r,
    ))
    const { error } = await supabase
      .from('math_wrong')
      .update({ resolved: true, resolved_at: now })
      .eq('user_id', user.id)
      .eq('problem_id', problemId)
    if (error) {
      await supabase.from('math_wrong').delete().eq('user_id', user.id).eq('problem_id', problemId)
      setRows(prev => prev.filter(r => r.problemId !== problemId))
    }
  }, [user])

  return { wrongIds, rows, removeWrong, markResolved, refetchWrong: loadWrong }
}
