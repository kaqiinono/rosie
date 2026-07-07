'use client'

import { useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'

export type EnglishWrongRow = {
  wordKey: string
  addedAt: string
  resolved: boolean
  resolvedAt: string | null
}

function parseRows(
  data: {
    word_key: string
    added_at?: string
    resolved?: boolean
    resolved_at?: string | null
  }[],
): EnglishWrongRow[] {
  return data.map((r) => ({
    wordKey: r.word_key,
    addedAt: r.added_at ?? '',
    resolved: r.resolved ?? false,
    resolvedAt: r.resolved_at ?? null,
  }))
}

async function fetchEnglishWrong(userId: string): Promise<EnglishWrongRow[]> {
  const { data, error } = await supabase
    .from('english_wrong')
    .select('word_key, added_at, resolved, resolved_at')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  if (error) {
    const fb = await supabase
      .from('english_wrong')
      .select('word_key, added_at')
      .eq('user_id', userId)
    if (fb.data) {
      return parseRows(fb.data.map((r) => ({ ...r, resolved: false, resolved_at: null })))
    }
    return []
  }
  return data ? parseRows(data) : []
}

export const englishWrongStore = createUserSessionStore<EnglishWrongRow[]>('english_wrong', {
  fetch: fetchEnglishWrong,
  empty: [],
})

export function useEnglishWrong(user: User | null) {
  const { data: rows, isLoading } = englishWrongStore.useSessionData(user)

  const wrongKeys = useMemo(
    () => new Set(rows.filter((r) => !r.resolved).map((r) => r.wordKey)),
    [rows],
  )

  const load = useCallback(async () => {
    if (!user) return
    englishWrongStore.invalidate(user.id)
    englishWrongStore.ensureLoaded(user.id)
  }, [user])

  const addWrong = useCallback(
    async (wordKeyValue: string) => {
      if (!user) return
      const now = new Date().toISOString()
      englishWrongStore.patchSessionData(user.id, (prev) => {
        const existing = prev.find((r) => r.wordKey === wordKeyValue)
        if (existing && !existing.resolved) return prev
        const next = prev.filter((r) => r.wordKey !== wordKeyValue)
        return [
          { wordKey: wordKeyValue, addedAt: now, resolved: false, resolvedAt: null },
          ...next,
        ]
      })
      await supabase.from('english_wrong').upsert(
        { user_id: user.id, word_key: wordKeyValue, resolved: false, resolved_at: null },
        { onConflict: 'user_id,word_key' },
      )
    },
    [user],
  )

  const markResolved = useCallback(
    async (wordKeyValue: string) => {
      if (!user) return
      const now = new Date().toISOString()
      englishWrongStore.patchSessionData(user.id, (prev) => {
        const existing = prev.find((r) => r.wordKey === wordKeyValue)
        if (!existing || existing.resolved) return prev
        return prev.map((r) =>
          r.wordKey === wordKeyValue ? { ...r, resolved: true, resolvedAt: now } : r,
        )
      })
      const { error } = await supabase
        .from('english_wrong')
        .update({ resolved: true, resolved_at: now })
        .eq('user_id', user.id)
        .eq('word_key', wordKeyValue)
      if (error) {
        await supabase
          .from('english_wrong')
          .delete()
          .eq('user_id', user.id)
          .eq('word_key', wordKeyValue)
        englishWrongStore.patchSessionData(user.id, (prev) =>
          prev.filter((r) => r.wordKey !== wordKeyValue),
        )
      }
    },
    [user],
  )

  const removeWrong = useCallback(
    async (wordKeyValue: string) => {
      if (!user) return
      englishWrongStore.patchSessionData(user.id, (prev) =>
        prev.filter((r) => r.wordKey !== wordKeyValue),
      )
      await supabase
        .from('english_wrong')
        .delete()
        .eq('user_id', user.id)
        .eq('word_key', wordKeyValue)
    },
    [user],
  )

  return { rows, wrongKeys, addWrong, markResolved, removeWrong, refetch: load, isLoading }
}
