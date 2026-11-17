'use client'

import { useEffect, useRef, useState } from 'react'
import { createUserSessionStore, invalidateSessionStore, supabase, useAuth } from '@rosie/core'
import { placeTodayBubbles } from '@/lib/time-tree/engine'
import { shift, type Snapshot, type TreeAction, type TreeData } from '@/lib/time-tree/types'

class TimeTreeRequestError extends Error {}

async function request(
  userId: string,
  action: TreeAction,
  revision?: number,
  cached?: Snapshot,
): Promise<Snapshot> {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw new TimeTreeRequestError('请重新登录。')
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
  if (!response.ok) throw new TimeTreeRequestError(result.error || '读取失败，请重试。')
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
  const queue = useRef<Promise<void>>(Promise.resolve())
  const queuedCount = useRef(0)
  const [pending, setPending] = useState<{ owner: string; revision: number; tree: TreeData } | null>(null)
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
  function run(action: TreeAction, expectedRevision?: number): Promise<TreeData | null> {
    if (!id || (lock.current && action.kind !== 'pick' && action.kind !== 'pop')) {
      return Promise.resolve(null)
    }
    queuedCount.current += 1
    lock.current = true
    setBusy(true)
    // Each queued interaction reads the latest committed revision when it starts.
    const result = queue.current.then(() => execute(action, expectedRevision))
    queue.current = result.then(() => undefined, () => undefined)
    return result.finally(() => {
      queuedCount.current -= 1
      if (queuedCount.current === 0) {
        lock.current = false
        setBusy(false)
      }
    })
  }
  async function execute(action: TreeAction, expectedRevision?: number) {
    if (!id) return null
    setMessage('')
    try {
      // finish 后再 pop 时，组件还没重渲染，闭包里的 revision 已过期。
      const revision = expectedRevision ?? store.getSessionData(id)?.revision ?? data?.revision
      const saved = store.getSessionData(id)
      if (saved && (action.kind === 'start' || action.kind === 'move' || action.kind === 'nextDay')) {
        const tree = { ...saved.tree, steps: saved.tree.steps.map(step => ({ ...step })) }
        const step = tree.steps.find(item => item.id === action.id)
        if (step && !step.start && !step.end) {
          if (action.kind === 'start') {
            step.start = new Date(Date.now() + (saved.clockOffsetMs ?? 0)).toISOString()
          } else {
            const base = step.planned && step.planned > tree.today ? step.planned : tree.today
            step.planned = action.kind === 'nextDay' ? shift(base, 1) : action.day ?? step.planned
            step.slot = null
          }
          step.returned = null
          placeTodayBubbles(tree)
          setPending({ owner: id, revision: saved.revision, tree })
        }
      }
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
      setPending(null)
      await store.refreshInBackground(id).catch(() => {})
      return null
    } finally {
      setPending(null)
    }
  }
  return {
    tree: pending && pending.owner === id && pending.revision === data?.revision ? pending.tree : data?.tree ?? null,
    revision: data?.revision,
    clockOffsetMs: data?.clockOffsetMs ?? 0,
    user,
    busy,
    run,
    message: message || (error instanceof TimeTreeRequestError ? error.message : error ? '无法读取生命树，请重试。' : ''),
    error,
    isLoading: loading || isLoading,
  }
}
export type TreeController = ReturnType<typeof useTimeTree>
