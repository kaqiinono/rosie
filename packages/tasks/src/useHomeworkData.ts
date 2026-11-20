'use client'

import { createUserSessionStore, refreshSessionStore, supabase, useAuth } from '@rosie/core'
import type { Homework, HomeworkInput } from './homework'

async function loadHomework(userId: string): Promise<Homework[]> {
  const rows: Homework[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from('task_homework')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id')
      .range(offset, offset + 499)
    if (error) throw error
    rows.push(...((data ?? []) as Homework[]))
    if (!data || data.length < 500) break
  }
  return rows
}

const store = createUserSessionStore<Homework[]>('task_homework', {
  empty: [],
  fetch: loadHomework,
})

function payload(input: HomeworkInput): HomeworkInput {
  return { ...input, name: input.name.trim(), notes: input.notes.trim() }
}

async function syncExecution(userId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user.id !== userId) return
    await fetch('/api/time-tree', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind: 'sync', protocol: 2, operationId: crypto.randomUUID(), returnScene: false }),
    })
  } catch {
    // The template write is complete. The scheduled job can retry its saved revision.
  }
  await refreshSessionStore('time_tree', userId).catch(() => undefined)
}

export function useHomeworkData() {
  const { user } = useAuth()
  const { data, isLoading, error } = store.useSessionData(user)

  function owner(): string {
    if (!user) throw new Error('请先登录。')
    return user.id
  }

  async function refresh() {
    if (user) await store.refreshInBackground(user.id)
  }

  /** 先写 Supabase，再 patch 会话缓存。 */
  async function create(input: HomeworkInput): Promise<Homework> {
    const userId = owner()
    const { data: row, error: writeError } = await supabase
      .from('task_homework')
      .insert({ ...payload(input), user_id: userId })
      .select('*')
      .single()
    if (writeError) throw new Error(writeError.message)
    const created = row as Homework
    store.patchSessionData(userId, (prev) => [created, ...prev])
    await syncExecution(userId)
    return created
  }

  async function update(id: string, input: HomeworkInput): Promise<Homework> {
    const userId = owner()
    const { data: row, error: writeError } = await supabase
      .from('task_homework')
      .update(payload(input))
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .single()
    if (writeError) throw new Error(writeError.message)
    const updated = row as Homework
    store.patchSessionData(userId, (prev) => prev.map((item) => (item.id === id ? updated : item)))
    await syncExecution(userId)
    return updated
  }

  async function setEnabled(id: string, enabled: boolean): Promise<void> {
    const userId = owner()
    const { data: row, error: writeError } = await supabase
      .from('task_homework')
      .update({ enabled })
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .single()
    if (writeError) throw new Error(writeError.message)
    const updated = row as Homework
    store.patchSessionData(userId, (prev) => prev.map((item) => (item.id === id ? updated : item)))
    await syncExecution(userId)
  }

  async function remove(id: string): Promise<void> {
    const userId = owner()
    const { error: writeError } = await supabase
      .from('task_homework')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
    if (writeError) throw new Error(writeError.message)
    store.patchSessionData(userId, (prev) => prev.filter((item) => item.id !== id))
    await syncExecution(userId)
  }

  return { user, data, isLoading, error, refresh, create, update, setEnabled, remove }
}
