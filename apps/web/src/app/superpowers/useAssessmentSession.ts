'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@rosie/core'
import { SEGMENT_SIZE, type AttemptAction, type AttemptView, type QueuedAnswer } from '@rosie/english/assessment/model'

type Deferred = 'pause' | 'finish'
type ActionKind = Deferred | 'continue' | 'diagnostic'
type Intent = { kind: Deferred; after: number }
type Branch = { id: string; start: number }
type Journal = { attemptId: string; answers: QueuedAnswer[]; deferred?: Intent | null; branch?: Branch | null; snapshot?: AttemptView }
type ResponseBody = { attempt?: AttemptView | null; bankReady?: boolean; pilotAvailable?: boolean
  legacyId?: string; pilotId?: string; error?: string }
const empty: QueuedAnswer[] = []

async function request(userId: string, device: string, signal: AbortSignal, action?: AttemptAction, attemptId?: string | null) {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user.id !== userId) throw new Error('请先登录再继续。')
  const url = '/api/vocabulary-assessment' + (!action && attemptId ? '?attempt=' + encodeURIComponent(attemptId) : '')
  const response = await fetch(url, { method: action ? 'POST' : 'GET', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, 'X-Assessment-Device': device },
    body: action ? JSON.stringify(action) : undefined })
  const body: ResponseBody | null = await response.json().catch(() => null)
  if ((!response.ok && response.status !== 409) || !body || !('attempt' in body)) {
    throw new Error(body?.error ?? '暂时无法连接测评，请重试。')
  }
  return body
}

function questionsFor(snapshot: AttemptView, branch: Branch | null) {
  const current = snapshot.segment?.questions ?? []
  if (!branch || snapshot.activeSegmentId === branch.id) return current
  const offer = snapshot.fallback?.questions ?? []
  return offer[0]?.segmentId === branch.id ? [...current, ...offer] : current
}

function reconcile(snapshot: AttemptView, journal: Journal) {
  if (journal.attemptId !== snapshot.id) return null
  const receipts = new Map(snapshot.answerReceipts.map(r => [r.index, r.operationId]))
  if (journal.answers.some(a => a.index < snapshot.answered && receipts.get(a.index) !== a.operationId)) return null
  const branch = snapshot.activeSegmentId === journal.branch?.id ? null : journal.branch ?? null
  if (branch && (snapshot.phase === 'submitted' ||
      snapshot.fallback?.questions[0]?.segmentId !== branch.id)) return null
  const available = questionsFor(snapshot, branch)
  const pending = journal.answers.filter(a => a.index >= snapshot.answered)
  if (pending.some((a, i) => {
    const q = available[i]
    return a.index !== snapshot.answered + i || q?.index !== a.index || q.id !== a.questionId || q.segmentId !== a.segmentId
  })) return null
  return { pending, branch }
}

function stored(key: string, storage: Storage): Journal | null {
  const data = JSON.parse(storage.getItem(key) ?? 'null') as Journal | null
  if (!data || typeof data.attemptId !== 'string' || !Array.isArray(data.answers) ||
      data.answers.length > 2 * SEGMENT_SIZE) return null
  return data
}

export function useAssessmentSession(userId: string) {
  const prefix = 'rosie-vocabulary-sync:v2:' + userId + ':'
  const [attempt, setAttempt] = useState<AttemptView | null>(null)
  const [ready, setReady] = useState(false)
  const [bankReady, setBankReady] = useState(false)
  const [pilotAvailable, setPilotAvailable] = useState(false)
  const [other, setOther] = useState<{ legacyId?: string; pilotId?: string }>({})
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [displaced, setDisplaced] = useState<Journal | null>(null)
  const [storageWarning, setStorageWarning] = useState(false)
  const [pending, setPending] = useState<QueuedAnswer[]>(empty)
  const [deferred, setDeferred] = useState<Deferred | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [online, setOnline] = useState(true)
  const [unconfirmedAdvance, setUnconfirmedAdvance] = useState(false)
  const current = useRef<AttemptView | null>(null)
  const queue = useRef<QueuedAnswer[]>(empty)
  const branch = useRef<Branch | null>(null)
  const intent = useRef<Intent | null>(null)
  const device = useRef('')
  const restoring = useRef<Journal | null>(null)
  const inFlight = useRef(false)
  const controller = useRef<AbortController | null>(null)

  function receive(value: AttemptView | null) {
    current.current = value
    setAttempt(value)
  }

  function journal(): Journal | null {
    const snapshot = current.current
    return snapshot && (queue.current.length || branch.current || intent.current)
      ? { attemptId: snapshot.id, snapshot, answers: queue.current, branch: branch.current, deferred: intent.current } : null
  }

  function persist() {
    const data = journal()
    const key = prefix + device.current
    try {
      if (data) localStorage.setItem(key, JSON.stringify(data))
      else localStorage.removeItem(key)
      setStorageWarning(false)
    } catch { setStorageWarning(Boolean(data)) }
    setSelectedBranch(branch.current)
    setPending(queue.current)
    setDeferred(intent.current?.kind ?? null)
  }

  function apply(body: ResponseBody) {
    receive(body.attempt ?? null)
    if (body.bankReady !== undefined) setBankReady(body.bankReady)
    if (body.pilotAvailable !== undefined) setPilotAvailable(body.pilotAvailable)
    if ('legacyId' in body || 'pilotId' in body) setOther({ legacyId: body.legacyId, pilotId: body.pilotId })
  }

  function preserveConflict(saved: Journal) {
    // The other device's branch wins the CAS. Keep a copy of displaced local
    // choices so they can be inspected without attaching them to different items.
    setDisplaced(saved)
    try { localStorage.setItem(prefix + 'conflict:' + saved.attemptId + ':' + device.current, JSON.stringify(saved)) }
    catch { setStorageWarning(true) }
  }

  async function flush() {
    const owner = controller.current
    if (!owner || owner.signal.aborted || inFlight.current || !navigator.onLine || !journal()) return
    inFlight.current = true
    setSyncing(true)
    try {
      while (current.current && journal()) {
        const snapshot = current.current
        const base = { id: snapshot.id, revision: snapshot.revision }
        let action: AttemptAction
        if (branch.current && snapshot.answered === branch.current.start && snapshot.activeSegmentId !== branch.current.id) {
          action = { ...base, kind: 'fallback', segmentId: branch.current.id }
        } else if (queue.current.length) {
          const end = (Math.floor(snapshot.answered / SEGMENT_SIZE) + 1) * SEGMENT_SIZE
          action = { ...base, kind: 'sync', answers: queue.current.filter(a => a.index < end) }
        } else if (intent.current && intent.current.after === snapshot.answered) {
          action = { ...base, kind: intent.current.kind }
        } else break
        const body = await request(userId, device.current, AbortSignal.any([owner.signal, AbortSignal.timeout(15_000)]), action)
        if (owner.signal.aborted) return
        const saved = journal()!
        const next = body.attempt
        const merged = next && reconcile(next, saved)
        if (!merged || !next) {
          preserveConflict(saved)
          apply(body)
          queue.current = empty
          branch.current = null
          intent.current = null
          persist()
          setError('另一台设备已更新答卷。这里显示云端进度，本机冲突记录已单独保留。')
          break
        }
        apply(body)
        const progressed = merged.pending.length < queue.current.length || merged.branch?.id !== branch.current?.id
        queue.current = merged.pending
        branch.current = merged.branch
        if (action.kind === 'pause' || action.kind === 'finish' || next.phase === 'submitted') intent.current = null
        persist()
        if (body.error && !progressed) { setError(body.error); break }
        setError('')
      }
    } catch (failure) {
      if (!owner.signal.aborted) setError(failure instanceof Error && failure.message === '请先登录再继续。'
        ? failure.message : '暂时无法同步，答案已留在本机。')
    } finally {
      if (!owner.signal.aborted) { inFlight.current = false; setSyncing(false) }
    }
  }

  async function move(action?: AttemptAction, saved?: Journal | null) {
    const owner = controller.current
    if (!owner || owner.signal.aborted || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    if (action?.kind === 'continue' || action?.kind === 'diagnostic') setUnconfirmedAdvance(true)
    try {
      const restore = saved ?? restoring.current
      const target = restore?.attemptId ?? new URLSearchParams(location.search).get('attempt')
      const body = await request(userId, device.current, AbortSignal.any([owner.signal, AbortSignal.timeout(15_000)]), action, target)
      if (owner.signal.aborted) return
      const pendingWork = journal() ?? restore
      restoring.current = null
      setUnconfirmedAdvance(false)
      const merged = pendingWork && body.attempt && reconcile(body.attempt, pendingWork)
      apply(body)
      if (body.attempt) {
        try {
          const archived = stored(prefix + 'conflict:' + body.attempt.id + ':' + device.current, localStorage)
          setDisplaced(archived)
        } catch { /* The in-memory copy is available until the page closes. */ }
      }
      if (pendingWork) {
        if (!merged) preserveConflict(pendingWork)
        queue.current = merged?.pending ?? empty
        branch.current = merged?.branch ?? null
        const deferred = pendingWork.deferred
        intent.current = merged && deferred && deferred.after === (body.attempt?.answered ?? 0) + merged.pending.length &&
          body.attempt?.phase !== 'submitted' && !(deferred.kind === 'pause' && body.attempt?.phase === 'paused') ? deferred : null
        persist()
      }
      if (body.attempt && action?.kind === 'start') {
        const url = new URL(location.href)
        url.searchParams.set('attempt', body.attempt.id)
        history.replaceState(history.state, '', url)
      }
      setReady(true)
      setError(pendingWork && !merged ? '已恢复云端进度，本机冲突记录已单独保留。' : body.error ?? '')
    } catch (failure) {
      if (!owner.signal.aborted) setError(failure instanceof Error ? failure.message : '暂时无法读取测评。')
    } finally {
      if (!owner.signal.aborted) { inFlight.current = false; setBusy(false); if (journal()) void flush() }
    }
  }

  const begin = useRef(() => {
    const owner = new AbortController()
    controller.current = owner
    inFlight.current = false
    const target = new URLSearchParams(location.search).get('attempt')
    const tabKey = prefix + 'device'
    const fresh = crypto.randomUUID()
    const mount = (id: string, recover: boolean) => {
      if (owner.signal.aborted) return
      device.current = id
      let saved: Journal | null = null
      try {
        sessionStorage.setItem(tabKey, id)
        if (recover) saved = stored(prefix + id, localStorage)
        const oldKey = 'rosie-vocabulary-sync:v1:' + userId
        if (!saved) {
          const old = stored(oldKey, sessionStorage)
          if (old && (!target || old.attemptId === target)) {
            localStorage.setItem(prefix + id, JSON.stringify(old))
            sessionStorage.removeItem(oldKey)
            saved = old
          }
        }
      } catch { setStorageWarning(true) }
      if (saved?.snapshot && saved.snapshot.id === saved.attemptId) {
        receive(saved.snapshot)
        queue.current = saved.answers
        branch.current = saved.branch ?? null
        intent.current = saved.deferred ?? null
        persist()
        setReady(true)
      }
      restoring.current = saved
      setOnline(navigator.onLine)
      void move(undefined, saved)
    }

    let candidate: string = fresh
    try {
      const own = sessionStorage.getItem(tabKey)
      if (own && (!target || !stored(prefix + own, localStorage) ||
          stored(prefix + own, localStorage)?.attemptId === target)) candidate = own
      else if (navigator.locks) {
        const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix) &&
          /^[a-f0-9-]{36}$/i.test(key.slice(prefix.length)) && (!target || stored(key, localStorage)?.attemptId === target))
        if (keys.length === 1) candidate = keys[0].slice(prefix.length)
      }
    } catch { setStorageWarning(true) }
    // A copied tab must not overwrite the original tab's unsent answers.
    // Release the device journal on navigation so reopening the tab can recover it.
    async function claim(id: string): Promise<void> {
      await navigator.locks.request(prefix + id, { ifAvailable: true }, async lock => {
        if (owner.signal.aborted) return
        if (!lock) return claim(crypto.randomUUID())
        mount(id, true)
        await new Promise<void>(resolve => owner.signal.addEventListener('abort', () => resolve(), { once: true }))
      })
    }
    if (navigator.locks) void claim(candidate).catch(() => mount(fresh, false))
    else mount(candidate, true)
    const reconnect = () => { setOnline(true); if (!device.current) return; if (journal()) void flush(); else void move() }
    const disconnect = () => setOnline(false)
    window.addEventListener('online', reconnect)
    window.addEventListener('offline', disconnect)
    return () => { owner.abort(); window.removeEventListener('online', reconnect); window.removeEventListener('offline', disconnect) }
  })
  useEffect(() => begin.current(), [])

  const hasPending = Boolean(pending.length || selectedBranch || deferred)
  useEffect(() => {
    if (!hasPending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasPending])

  const available = attempt ? questionsFor(attempt, selectedBranch) : []
  const canFallback = Boolean(!busy && !unconfirmedAdvance && !deferred && !selectedBranch && attempt?.fallback?.questions.length &&
    attempt.answered + pending.length === attempt.fallback.questions[0].index && (pending.length || !online || error))
  function answer(value: QueuedAnswer) {
    if (intent.current || !current.current) return false
    const q = questionsFor(current.current, branch.current)[queue.current.length]
    if (!q || q.index !== value.index || q.id !== value.questionId || q.segmentId !== value.segmentId) return false
    queue.current = [...queue.current, value]
    persist()
    void flush()
    return true
  }

  function change(kind: ActionKind) {
    const snapshot = current.current
    if (!snapshot || intent.current) return
    if (kind === 'continue' && canFallback && snapshot.fallback) {
      const first = snapshot.fallback.questions[0]
      if (!first.segmentId) return
      branch.current = { id: first.segmentId, start: first.index }
      persist()
      void flush()
    } else if (kind === 'pause' || kind === 'finish') {
      intent.current = { kind, after: snapshot.answered + queue.current.length }
      persist()
      void flush()
    } else if (!journal()) void move({ kind, id: snapshot.id, revision: snapshot.revision })
  }
  const conflictRows = displaced?.snapshot && displaced.attemptId === attempt?.id
    ? displaced.answers.map(a => {
        const q = questionsFor(displaced.snapshot!, displaced.branch ?? null).find(q => q.index === a.index)
        const choice = a.decision === 'unknown' ? '不认识' : a.decision === 'unreadable' ? '看不懂' : q?.options[a.optionIndex ?? -1]
        return { index: a.index, word: q?.word ?? a.questionId, choice }
      }) : []
  function dismissConflict() {
    if (!displaced) return
    try { localStorage.removeItem(prefix + 'conflict:' + displaced.attemptId + ':' + device.current) }
    catch { setStorageWarning(true) }
    setDisplaced(null)
  }
  return { attempt, ready, bankReady, busy, syncing, error, pending, deferred, storageWarning, available, other,
    conflictRows, dismissConflict, hasPending, canFallback, pilotAvailable, online, answer, change, retry: () => journal() ? void flush() : void move(),
    start: () => void move({ kind: 'start', version: pilotAvailable ? 2 : undefined, previousId: current.current?.id ?? null }) }
}
