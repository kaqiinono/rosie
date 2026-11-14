'use client'

import { useMemo } from 'react'
import { createUserSessionStore, supabase, useAuth } from '@rosie/core'
import { comparePracticeEntriesByUpdatedDesc, validateEntry, type PracticeEntry } from './practiceEntries'

const store = createUserSessionStore<PracticeEntry[]>('task_practice_entries', {
  empty: [],
  async fetch(userId) {
    const rows: PracticeEntry[] = []
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.from('task_practice_entries').select('*')
        .eq('user_id', userId).order('updated_at', { ascending: false }).order('id').range(offset, offset + 99)
      if (error) throw error
      rows.push(...(data as PracticeEntry[]))
      if (data.length < 100) return rows.sort(comparePracticeEntriesByUpdatedDesc)
    }
  },
})
export function usePracticeEntries() {
  const { user } = useAuth()
  const state = store.useSessionData(user)
  const data = useMemo(() => [...state.data].sort(comparePracticeEntriesByUpdatedDesc), [state.data])
  async function save(input: Pick<PracticeEntry, 'name' | 'subject' | 'path' | 'rows'>, existing?: PracticeEntry) {
    if (!user) throw new Error('请先登录')
    validateEntry(input)
    const values = { ...input, name: input.name.trim(), updated_at: new Date().toISOString() }
    const query = existing
      ? supabase.from('task_practice_entries').update(values).eq('id', existing.id).eq('user_id', user.id).eq('updated_at', existing.updated_at)
      : supabase.from('task_practice_entries').insert({ ...values, user_id: user.id })
    const { data, error } = await query.select('*').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('入口已在其他页面更新，请重新打开后编辑')
    store.patchSessionData(user.id, (rows) => [...rows.filter((r) => r.id !== data.id), data as PracticeEntry].sort(comparePracticeEntriesByUpdatedDesc))
  }
  async function remove(entry: PracticeEntry) {
    if (!user) throw new Error('请先登录')
    const { data, error } = await supabase.from('task_practice_entries').delete()
      .eq('user_id', user.id).eq('id', entry.id).eq('updated_at', entry.updated_at).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('入口已更新，请刷新后重试')
    store.patchSessionData(user.id, (rows) => rows.filter((r) => r.id !== entry.id))
  }
  return { ...state, data, user, save, remove, refresh: () => user ? store.refreshInBackground(user.id) : Promise.resolve() }
}
