'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'

export type ChineseWrongKind = 'pinyin' | 'stroke' | 'phrase' | 'recite' | 'accumulation'
export type ChineseWrongItemType = 'char' | 'phrase' | 'accumulation' | 'poem'

export type ChineseWrongRow = {
  itemKey: string
  itemType: ChineseWrongItemType
  wrongKind: ChineseWrongKind
  addedAt: string
  resolved: boolean
  resolvedAt: string | null
}

function parseRows(
  data: {
    item_key: string
    item_type: string
    wrong_kind: string
    added_at?: string
    resolved?: boolean
    resolved_at?: string | null
  }[],
): ChineseWrongRow[] {
  return data.map((r) => ({
    itemKey: r.item_key,
    itemType: r.item_type as ChineseWrongItemType,
    wrongKind: r.wrong_kind as ChineseWrongKind,
    addedAt: r.added_at ?? '',
    resolved: r.resolved ?? false,
    resolvedAt: r.resolved_at ?? null,
  }))
}

export function useChineseWrong(user: User | null) {
  const [rows, setRows] = useState<ChineseWrongRow[]>([])

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('chinese_wrong_items')
      .select('item_key, item_type, wrong_kind, added_at, resolved, resolved_at')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
    if (!error && data) setRows(parseRows(data))
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const unresolved = rows.filter((r) => !r.resolved)

  const addWrong = useCallback(
    async (
      itemKey: string,
      itemType: ChineseWrongItemType,
      wrongKind: ChineseWrongKind,
    ) => {
      if (!user) return
      setRows((prev) => {
        const existing = prev.find(
          (r) => r.itemKey === itemKey && r.wrongKind === wrongKind && !r.resolved,
        )
        if (existing) return prev
        return [
          {
            itemKey,
            itemType,
            wrongKind,
            addedAt: new Date().toISOString(),
            resolved: false,
            resolvedAt: null,
          },
          ...prev.filter((r) => !(r.itemKey === itemKey && r.wrongKind === wrongKind)),
        ]
      })
      await supabase.from('chinese_wrong_items').upsert(
        {
          user_id: user.id,
          item_key: itemKey,
          item_type: itemType,
          wrong_kind: wrongKind,
          resolved: false,
          resolved_at: null,
        },
        { onConflict: 'user_id,item_key,wrong_kind' },
      )
    },
    [user],
  )

  const markResolved = useCallback(
    async (itemKey: string, wrongKind: ChineseWrongKind) => {
      if (!user) return
      const now = new Date().toISOString()
      setRows((prev) =>
        prev.map((r) =>
          r.itemKey === itemKey && r.wrongKind === wrongKind
            ? { ...r, resolved: true, resolvedAt: now }
            : r,
        ),
      )
      await supabase
        .from('chinese_wrong_items')
        .update({ resolved: true, resolved_at: now })
        .eq('user_id', user.id)
        .eq('item_key', itemKey)
        .eq('wrong_kind', wrongKind)
    },
    [user],
  )

  const removeWrong = useCallback(
    async (itemKey: string, wrongKind: ChineseWrongKind) => {
      if (!user) return
      setRows((prev) => prev.filter((r) => !(r.itemKey === itemKey && r.wrongKind === wrongKind)))
      await supabase
        .from('chinese_wrong_items')
        .delete()
        .eq('user_id', user.id)
        .eq('item_key', itemKey)
        .eq('wrong_kind', wrongKind)
    },
    [user],
  )

  return { rows, unresolved, addWrong, markResolved, removeWrong, refetch: load }
}
