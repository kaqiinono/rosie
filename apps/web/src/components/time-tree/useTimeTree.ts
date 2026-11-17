'use client'

import { useEffect, useRef, useState } from 'react'
import { createUserSessionStore, invalidateSessionStore, supabase, useAuth } from '@rosie/core'
import { placeTodayBubbles } from '@/lib/time-tree/engine'
import { shift, WEEKLY_SCHEDULE_VERSION, type Snapshot, type TreeAction, type TreeData } from '@/lib/time-tree/types'

const POLL_INTERVAL_MS = 45_000
const MAX_RETRY_DELAY_MS = 180_000

class TimeTreeRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
  }
}

type PollingState = {
  subscribers: number
  pendingRequests: number
  nextPollAt: number
  retryDelay: number
  schedule?: () => void
  stop?: () => void
}

const pollingByUser = new Map<string, PollingState>()

function getPollingState(userId: string): PollingState {
  const current = pollingByUser.get(userId)
  if (current) return current
  const state: PollingState = {
    subscribers: 0,
    pendingRequests: 0,
    nextPollAt: Date.now() + POLL_INTERVAL_MS,
    retryDelay: POLL_INTERVAL_MS,
  }
  pollingByUser.set(userId, state)
  return state
}

function deferPolling(polling: PollingState) {
  polling.retryDelay = Math.min(polling.retryDelay * 2, MAX_RETRY_DELAY_MS)
  polling.nextPollAt = Date.now() + polling.retryDelay
}

type RequestOptions = { revision?: number; cached?: Snapshot; background?: boolean }

async function fetchSnapshot(
  userId: string,
  action: TreeAction,
  { revision, cached, background }: RequestOptions,
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
    body: JSON.stringify({
      ...action,
      revision,
      background,
      knownRevision: cached?.revision,
      knownHomeworkRevision: cached?.homeworkRevision,
      knownDay: cached?.tree.today,
    }),
  })
  const serverTime = Date.parse(response.headers.get('X-Tree-Time') ?? '')
  const clockOffsetMs = Number.isFinite(serverTime) ? serverTime - Date.now() : 0
  if (response.status === 204 && cached) return { ...cached, clockOffsetMs }
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new TimeTreeRequestError(result?.error || '读取失败，请重试。', response.status)
  }
  const result: Snapshot = await response.json()
  return { ...result, clockOffsetMs }
}

async function request(userId: string, action: TreeAction, options: RequestOptions = {}): Promise<Snapshot> {
  const polling = getPollingState(userId)
  polling.pendingRequests += 1
  try {
    const snapshot = await fetchSnapshot(userId, action, options)
    if (snapshot.syncDeferred) {
      deferPolling(polling)
    } else if (action.kind === 'sync') {
      polling.retryDelay = POLL_INTERVAL_MS
      polling.nextPollAt = Date.now() + POLL_INTERVAL_MS
    }
    return snapshot
  } catch (error) {
    if (error instanceof TimeTreeRequestError && error.status === 503) {
      deferPolling(polling)
    } else if (action.kind === 'sync') {
      polling.nextPollAt = Date.now() + polling.retryDelay
    }
    throw error
  } finally {
    polling.pendingRequests -= 1
    polling.schedule?.()
  }
}

const store = createUserSessionStore<Snapshot | null>('time_tree', {
  empty: null,
  async fetch(id): Promise<Snapshot> {
    const cached = store.getSessionData(id) ?? undefined
    const currentSchedule = cached?.tree.weeklyScheduleVersion === WEEKLY_SCHEDULE_VERSION
    const incoming = await request(id, { kind: 'sync' }, { cached: currentSchedule ? cached : undefined, background: true })
    const current = store.getSessionData(id)
    return current && current.revision > incoming.revision ? current : incoming
  },
})

function subscribeToPolling(userId: string) {
  const polling = getPollingState(userId)
  polling.subscribers += 1
  if (polling.subscribers === 1) {
    let timer: number | undefined
    const schedule = () => {
      window.clearTimeout(timer)
      if (document.hidden || polling.pendingRequests) return
      timer = window.setTimeout(() => {
        if (!document.hidden && !polling.pendingRequests) void store.refreshInBackground(userId).catch(() => {})
      }, Math.max(0, polling.nextPollAt - Date.now()))
    }
    polling.schedule = schedule
    window.addEventListener('focus', schedule)
    document.addEventListener('visibilitychange', schedule)
    polling.stop = () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', schedule)
      document.removeEventListener('visibilitychange', schedule)
    }
    schedule()
  }
  return () => {
    polling.subscribers -= 1
    if (polling.subscribers === 0) {
      polling.stop?.()
      polling.stop = undefined
      polling.schedule = undefined
    }
  }
}

export function useTimeTree() {
  const { user, loading } = useAuth()
  const { data, error: loadError, isLoading } = store.useSessionData(user)
  const error = data && loadError instanceof TimeTreeRequestError && loadError.status === 503 ? null : loadError
  const id = user?.id
  const lock = useRef(false)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const queuedCount = useRef(0)
  const [pending, setPending] = useState<{ owner: string; revision: number; tree: TreeData } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (id) return subscribeToPolling(id)
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
      const next = await request(id, action, { revision })
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
      if (!(e instanceof TimeTreeRequestError && e.status === 503))
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
    message: message || (error instanceof TimeTreeRequestError ? error.message : error ? '无法读取生命树，请重试。' : '') ||
      (data?.syncDeferred ? '已显示上次保存的生命树，稍后自动同步。' : ''),
    error,
    isLoading: loading || isLoading,
  }
}
export type TreeController = ReturnType<typeof useTimeTree>
