'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'

export type EnglishWrongRow = {
  wordKey: string
  addedAt: string
  resolved: boolean
  resolvedAt: string | null
}

function parseRows(data: { word_key: string; added_at?: string; resolved?: boolean; resolved_at?: string | null }[]): EnglishWrongRow[] {
  return data.map(r => ({
    wordKey: r.word_key,
    addedAt: r.added_at ?? '',
    resolved: r.resolved ?? false,
    resolvedAt: r.resolved_at ?? null,
  }))
}

export function useEnglishWrong(user: User | null) {
  const [rows, setRows] = useState<EnglishWrongRow[]>([])

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('english_wrong')
      .select('word_key, added_at, resolved, resolved_at')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
    if (error) {
      const fb = await supabase
        .from('english_wrong')
        .select('word_key, added_at')
        .eq('user_id', user.id)
      if (fb.data) {
        setRows(parseRows(fb.data.map(r => ({ ...r, resolved: false, resolved_at: null }))))
      }
      return
    }
    if (data) setRows(parseRows(data))
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const wrongKeys = new Set(rows.filter(r => !r.resolved).map(r => r.wordKey))

  const addWrong = useCallback(async (wordKey: string) => {
    if (!user) return
    setRows(prev => {
      const existing = prev.find(r => r.wordKey === wordKey)
      if (existing && !existing.resolved) return prev
      const next = prev.filter(r => r.wordKey !== wordKey)
      return [{
        wordKey,
        addedAt: new Date().toISOString(),
        resolved: false,
        resolvedAt: null,
      }, ...next]
    })
    await supabase.from('english_wrong').upsert(
      { user_id: user.id, word_key: wordKey, resolved: false, resolved_at: null },
      { onConflict: 'user_id,word_key' },
    )
  }, [user])

  const markResolved = useCallback(async (wordKey: string) => {
    if (!user) return
    const now = new Date().toISOString()
    setRows(prev => {
      const existing = prev.find(r => r.wordKey === wordKey)
      if (!existing || existing.resolved) return prev
      return prev.map(r =>
        r.wordKey === wordKey ? { ...r, resolved: true, resolvedAt: now } : r,
      )
    })
    const { error } = await supabase
      .from('english_wrong')
      .update({ resolved: true, resolved_at: now })
      .eq('user_id', user.id)
      .eq('word_key', wordKey)
    if (error) {
      await supabase.from('english_wrong').delete().eq('user_id', user.id).eq('word_key', wordKey)
      setRows(prev => prev.filter(r => r.wordKey !== wordKey))
    }
  }, [user])

  const removeWrong = useCallback(async (wordKey: string) => {
    if (!user) return
    setRows(prev => prev.filter(r => r.wordKey !== wordKey))
    await supabase.from('english_wrong').delete().eq('user_id', user.id).eq('word_key', wordKey)
  }, [user])

  return { rows, wrongKeys, addWrong, markResolved, removeWrong, refetch: load }
}
