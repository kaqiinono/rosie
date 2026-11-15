'use client'

import { useEffect, useRef, useState } from 'react'
import { createUserSessionStore, invalidateSessionStore, supabase, useAuth } from '@rosie/core'
import type { Snapshot, TreeAction } from '@/lib/time-tree/types'

async function request(
  userId: string,
  action: TreeAction,
  revision?: number,
  cached?: Snapshot,
): Promise<Snapshot> {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw new Error('请重新登录。')
  const response = await fetch('/api/time-tree', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + data.session.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...action, revision, knownRevision: cached?.revision }),
  })
  const serverTime = Date.parse(response.headers.get('X-Tree-Time') ?? '')
  const clockOffsetMs = Number.isFinite(serverTime) ? serverTime - Date.now() : 0
  if (response.status === 204 && cached) return { ...cached, clockOffsetMs }
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '读取失败，请重试。')
  return { ...(result as Snapshot), clockOffsetMs }
}
const store = createUserSessionStore<Snapshot | null>('time_tree', {
  empty: null,
  async fetch(id): Promise<Snapshot> {
    const cached = store.getSessionData(id)
    const incoming = await request(id, { kind: 'sync' }, undefined, cached ?? undefined)
    const current = store.getSessionData(id)
    return current && current.revision > incoming.revision ? current : incoming
  },
})

export function useTimeTree() {
  const { user, loading } = useAuth()
  const { data, error, isLoading } = store.useSessionData(user)
  const id = user?.id
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!id) return
    const refresh = () => {
      if (!document.hidden && !lock.current) void store.refreshInBackground(id).catch(() => {})
    }
    const interval = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [id])
  async function run(action: TreeAction, expectedRevision?: number) {
    if (!id || lock.current) return null
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      // finish 后再 pop 时，组件还没重渲染，闭包里的 revision 已过期。
      const revision = expectedRevision ?? store.getSessionData(id)?.revision ?? data?.revision
      const next = await request(id, action, revision)
      if ((store.getSessionData(id)?.revision ?? 0) <= next.revision)
        store.replaceSessionData(id, next)
      if (action.kind === 'acceptBox') invalidateSessionStore('draw_pool_entries')
      if (action.kind === 'openBox' || action.kind === 'acceptBox') {
        invalidateSessionStore('draw_wheel_entries')
        invalidateSessionStore('draw_workshop')
      }
      return next.tree
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败，请重试。')
      await store.refreshInBackground(id).catch(() => {})
      return null
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return {
    tree: data?.tree ?? null,
    revision: data?.revision,
    clockOffsetMs: data?.clockOffsetMs ?? 0,
    user,
    busy,
    run,
    message: message || (error ? '作业同步失败，请刷新重试。' : ''),
    error,
    isLoading: loading || isLoading,
  }
}
export type TreeController = ReturnType<typeof useTimeTree>
