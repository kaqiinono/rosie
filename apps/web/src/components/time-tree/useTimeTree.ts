'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createUserSessionStore, invalidateSessionStore, supabase, useAuth } from '@rosie/core'
import { placeTodayBubbles } from '@/lib/time-tree/engine'
import { applyRowChanges, type RowReceipt } from '@/lib/time-tree/rowChanges'
import { isExhaustedPendingStep, shift, type Snapshot, type TreeAction, type TreeData } from '@/lib/time-tree/types'

const POLL_INTERVAL_MS = 45_000
const MAX_RETRY_DELAY_MS = 180_000

class TimeTreeRequestError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
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

async function requireSuccessfulResponse(response: Response) {
  if (response.ok) return
  const result = await response.json().catch(() => null)
  throw new TimeTreeRequestError(result?.message || result?.error || '读取生命树失败，请重试。', response.status, result?.code)
}

async function readWindow(token: string, query = '') {
  const response = await fetch('/api/time-tree' + query, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
  await requireSuccessfulResponse(response)
  return response
}

function readClockOffset(response: Response) {
  const serverTime = Date.parse(response.headers.get('X-Tree-Time') ?? '')
  return Number.isFinite(serverTime) ? serverTime - Date.now() : 0
}

async function readScene(token: string, cached?: Snapshot): Promise<Snapshot> {
  const query = cached
    ? '?' + new URLSearchParams({ knownRevision: String(cached.revision), knownDay: cached.tree.today })
    : ''
  const response = await readWindow(token, query)
  const clockOffsetMs = readClockOffset(response)
  const scene: Snapshot = response.status === 204 && cached ? cached : await response.json()
  return { ...scene, clockOffsetMs }
}

async function fetchSnapshot(
  userId: string,
  action?: TreeAction,
  revision?: number,
): Promise<Snapshot> {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw new TimeTreeRequestError('请重新登录。')
  const token = data.session.access_token
  if (!action) return readScene(token, store.getSessionData(userId) ?? undefined)
  const options: RequestInit = {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...action,
      protocol: 2,
      operationId: crypto.randomUUID(),
      revision,
    }),
  }
  const response = await fetch('/api/time-tree', options).catch(() => fetch('/api/time-tree', options))
  await requireSuccessfulResponse(response)
  const clockOffsetMs = readClockOffset(response)
  const result: Snapshot | RowReceipt = await response.json()
  if ('tree' in result) return { ...result, clockOffsetMs }
  const latest = store.getSessionData(userId)
  if (latest && latest.revision >= result.revision) return { ...latest, clockOffsetMs }
  if (latest && latest.revision === result.baseRevision && result.delta &&
    (!result.delta.state.today || result.delta.state.today === latest.tree.today) &&
    result.delta.stepFields?.some(patch => !latest.tree.steps.some(step => step.id === patch.id)) !== true)
    return { ...latest, clockOffsetMs, revision: result.revision, tree: applyRowChanges(latest.tree, result.delta),
      historyMinutes: { ...latest.historyMinutes, ...result.delta.historyMinutes } }
  return readScene(token)
}

async function request(userId: string, action?: TreeAction, revision?: number): Promise<Snapshot> {
  const polling = getPollingState(userId)
  polling.pendingRequests += 1
  try {
    const snapshot = await fetchSnapshot(userId, action, revision)
    if (!action || action.kind === 'sync') {
      polling.retryDelay = POLL_INTERVAL_MS
      polling.nextPollAt = Date.now() + POLL_INTERVAL_MS
    }
    return snapshot
  } catch (error) {
    if (error instanceof TimeTreeRequestError && error.status === 503) {
      deferPolling(polling)
    } else if (!action || action.kind === 'sync') {
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
    const incoming = await request(id)
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

function visibleHomeworkTree(tree: TreeData): TreeData {
  const steps = tree.steps.filter(step => !isExhaustedPendingStep(tree, step))
  return steps.length === tree.steps.length ? tree : { ...tree, steps }
}

export function useTimeTree() {
  const { user, loading } = useAuth()
  const { data, error: loadError, isLoading } = store.useSessionData(user)
  const error = data && loadError instanceof TimeTreeRequestError && loadError.status === 503 ? null : loadError
  const id = user?.id
  const lock = useRef(false)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const lastExclusive = useRef(queue.current)
  const queuedCount = useRef(0)
  const startRequest = useRef<{ owner: string; stepId: string; result: Promise<TreeData | null> } | null>(null)
  const [starting, setStarting] = useState<{ owner: string; stepId: string; at: string } | null>(null)
  const [pending, setPending] = useState<{ owner: string; revision: number; tree: TreeData } | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<Error | null>(null)
  const currentTree = pending && pending.owner === id && pending.revision === data?.revision ? pending.tree : data?.tree ?? null
  const startingStepId = starting && starting.owner === id ? starting.stepId : null
  const tree = useMemo(() => {
    if (!currentTree) return null
    const visible = visibleHomeworkTree(currentTree)
    if (!starting || !startingStepId) return visible
    const target = visible.steps.find(step => step.id === startingStepId)
    if (!target?.planned || target.start || target.end || target.skipped ||
      visible.steps.some(step => step.start && !step.end)) return visible
    const preview = { ...visible, steps: visible.steps.map(step => step.id === target.id
      ? { ...step, start: starting.at, returned: null } : { ...step }) }
    placeTodayBubbles(preview)
    return preview
  }, [currentTree, starting, startingStepId])
  useEffect(() => {
    if (id) return subscribeToPolling(id)
  }, [id])
  function retry() {
    if (!id) return
    setActionError(null)
    void store.refreshInBackground(id).catch(() => {})
  }
  function run(action: TreeAction, expectedRevision?: number): Promise<TreeData | null> {
    const start = startRequest.current
    const followsStart = (action.kind === 'finish' || action.kind === 'stop') && start && start.owner === id && start.stepId === action.id
    if (!id || (lock.current && !followsStart && action.kind !== 'pick' && action.kind !== 'pop')) {
      return Promise.resolve(null)
    }
    queuedCount.current += 1
    lock.current = true
    setBusy(true)
    // Each queued interaction reads the latest committed revision when it starts.
    const barrier = action.kind === 'pop' ? lastExclusive.current : queue.current
    const result = barrier.then(async () => {
      if (followsStart) {
        const confirmed = (await start.result)?.steps.find(step => step.id === action.id)
        if (!confirmed?.start || confirmed.end || confirmed.skipped) return null
        if (action.kind === 'stop') return execute({ ...action, start: confirmed.start }, expectedRevision)
      }
      return execute(action, expectedRevision)
    })
    if (followsStart) startRequest.current = null // Queue at most one finish or stop behind this start.
    if (action.kind === 'start' && action.id) {
      startRequest.current = { owner: id, stepId: action.id, result }
      setStarting({ owner: id, stepId: action.id, at: new Date(Date.now() + (data?.clockOffsetMs ?? 0)).toISOString() })
    }
    const finished = result.then(() => undefined, () => undefined)
    if (action.kind === 'pop') queue.current = Promise.all([queue.current, finished]).then(() => undefined)
    else lastExclusive.current = queue.current = finished
    return result.finally(() => {
      if (action.kind === 'start') {
        if (startRequest.current?.result === result) startRequest.current = null
        setStarting(null)
      }
      queuedCount.current -= 1
      if (queuedCount.current === 0) {
        lock.current = false
        setBusy(false)
      }
    })
  }
  async function execute(action: TreeAction, expectedRevision?: number) {
    if (!id) return null
    setActionError(null)
    try {
      // finish 后再 pop 时，组件还没重渲染，闭包里的 revision 已过期。
      const revision = expectedRevision ?? store.getSessionData(id)?.revision ?? data?.revision
      const saved = store.getSessionData(id)
      if (saved && (action.kind === 'move' || action.kind === 'nextDay')) {
        const tree = { ...saved.tree, steps: saved.tree.steps.map(step => ({ ...step })) }
        const step = tree.steps.find(item => item.id === action.id)
        if (step && !step.start && !step.end && !isExhaustedPendingStep(tree, step)) {
          const base = step.planned && step.planned > tree.today ? step.planned : tree.today
          step.planned = action.kind === 'nextDay' ? shift(base, 1) : action.day ?? step.planned
          step.slot = null
          step.returned = null
          placeTodayBubbles(tree)
          setPending({ owner: id, revision: saved.revision, tree })
        }
      }
      const next = await request(id, action, revision)
      if ((store.getSessionData(id)?.revision ?? 0) <= next.revision)
        store.replaceSessionData(id, next)
      if (action.kind === 'acceptBox') invalidateSessionStore('draw_pool_entries')
      if (action.kind === 'openBox' || action.kind === 'openTomatoBox' || action.kind === 'acceptBox') {
        invalidateSessionStore('draw_wheel_entries')
        invalidateSessionStore('draw_workshop')
      }
      return visibleHomeworkTree(next.tree)
    } catch (e) {
      if (action.kind === 'start') setStarting(null)
      setActionError(e instanceof Error ? e : new Error('保存失败，请重试。'))
      setPending(null)
      if (!(e instanceof TimeTreeRequestError && e.status === 503))
        await store.refreshInBackground(id).catch(() => {})
      return null
    } finally {
      setPending(null)
    }
  }
  return {
    tree,
    startingStepId,
    revision: data?.revision,
    historyMinutes: data?.historyMinutes,
    clockOffsetMs: data?.clockOffsetMs ?? 0,
    user,
    busy,
    run,
    retry,
    message: actionError?.message || (error instanceof TimeTreeRequestError ? error.message : error ? '无法读取生命树，请重试。' : ''),
    syncDeferred: data?.syncDeferred === true,
    messageCode: actionError instanceof TimeTreeRequestError ? actionError.code : undefined,
    error,
    isLoading: loading || isLoading,
  }
}
export type TreeController = ReturnType<typeof useTimeTree>

type HistoryPage = { revision: number; steps: TreeData['steps']; spends: NonNullable<TreeData['tomatoSpends']> }
const historyPages = new Map<string, Promise<HistoryPage>>()

function historyPage(owner: string, revision: number, days: string[]) {
  const key = [owner, revision, ...days].join('|')
  const cached = historyPages.get(key)
  if (cached) return cached
  const pending = supabase.auth.getSession().then(async ({ data }) => {
    if (!data.session || data.session.user.id !== owner) throw new Error('请重新登录。')
    const response = await readWindow(data.session.access_token, '?days=' + days.join(','))
    const page: HistoryPage = await response.json()
    if (page.revision !== revision) historyPages.delete(key)
    return page
  }).catch(error => {
    historyPages.delete(key)
    throw error
  })
  historyPages.set(key, pending)
  if (historyPages.size > 16) historyPages.delete(historyPages.keys().next().value!)
  return pending
}

export function treeDates(from: string, through: string) {
  const days: string[] = []
  for (let day = from; day <= through; day = shift(day, 1)) days.push(day)
  return days
}

export function useTreeHistory(api: TreeController, days: string[]): TreeController {
  const today = api.tree?.today
  const from = today && shift(today, -6)
  const through = today && shift(today, 6)
  const dates = [...new Set(days.filter(day => from && through && (day < from || day > through)))].sort().join(',')
  const owner = api.user?.id
  const revision = api.revision
  const key = [owner, revision, dates].join('|')
  const [result, setResult] = useState<{ key: string; pages?: HistoryPage[]; message?: string }>()
  const [readAttempt, setReadAttempt] = useState(0)
  useEffect(() => {
    if (!dates || !owner || revision === undefined) return
    let active = true
    const list = dates.split(',')
    const requests = []
    for (let i = 0; i < list.length; i += 62) requests.push(historyPage(owner, revision, list.slice(i, i + 62)))
    void Promise.all(requests).then(async pages => {
      if (!active) return
      if (pages.some(page => page.revision !== revision)) {
        await store.refreshInBackground(owner)
        if (store.getSessionData(owner)?.revision === revision) throw new Error('进度正在同步，请重新打开日期。')
        return
      }
      setResult({ key, pages })
    }).catch(error => {
      if (active) setResult({ key, message: error instanceof Error ? error.message : '历史记录读取失败。' })
    })
    return () => { active = false }
  }, [dates, key, owner, revision, readAttempt])
  const tree = useMemo(() => {
    if (!dates || !api.tree) return api.tree
    if (result?.key !== key || !result.pages) return null
    const steps = new Map(api.tree.steps.map(step => [step.id, step]))
    const spends = new Map((api.tree.tomatoSpends ?? []).map(spend => [spend.id, spend]))
    for (const page of result.pages) {
      for (const step of page.steps) if (!steps.has(step.id)) steps.set(step.id, step)
      for (const spend of page.spends) spends.set(spend.id, spend)
    }
    return visibleHomeworkTree({ ...api.tree, steps: [...steps.values()], tomatoSpends: [...spends.values()] })
  }, [dates, key, result, api.tree])
  function retry() {
    if (!dates || !api.tree) return api.retry()
    setResult(undefined)
    setReadAttempt(attempt => attempt + 1)
  }
  const historyMessage = result?.key === key ? result.message : undefined
  return { ...api, tree, retry, message: historyMessage || api.message,
    isLoading: api.isLoading || Boolean(api.tree && !tree && !historyMessage) }
}
