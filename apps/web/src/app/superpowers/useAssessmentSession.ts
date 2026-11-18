'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@rosie/core'
import { SEGMENT_SIZE, type AttemptAction, type AttemptView, type QueuedAnswer } from '@rosie/english/assessment/model'

type DeferredAction = 'pause' | 'finish'
type ActionKind = DeferredAction | 'continue' | 'diagnostic'
type Intent = { kind: DeferredAction; after: number }
type Journal = { attemptId: string; answers: QueuedAnswer[]; deferred?: Intent | null }

const emptyAnswers: QueuedAnswer[] = []

async function requestAssessment(userId: string, action?: AttemptAction, signal?: AbortSignal) {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw new Error('请先登录再继续。')
  const response = await fetch('/api/vocabulary-assessment', {
    method: action ? 'POST' : 'GET',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: action ? JSON.stringify(action) : undefined,
  })
  const body = await response.json().catch(() => null) as {
    attempt?: AttemptView | null
    bankReady?: boolean
    error?: string
  } | null
  if ((!response.ok && response.status !== 409) || !body || !('attempt' in body)) {
    throw new Error(body?.error ?? '暂时无法连接测评，请重试。')
  }
  return { attempt: body.attempt ?? null, bankReady: body.bankReady !== false, error: body.error ?? '' }
}

function readJournal(key: string): Journal | null {
  try {
    const data = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Journal | null
    if (typeof data?.attemptId !== 'string' || !Array.isArray(data.answers) ||
        data.answers.length > SEGMENT_SIZE || !data.answers.every(answer => answer &&
          Number.isInteger(answer.index) && typeof answer.questionId === 'string' && typeof answer.operationId === 'string') ||
        (data.deferred != null && ((data.deferred.kind !== 'pause' && data.deferred.kind !== 'finish') ||
          !Number.isInteger(data.deferred.after)))) return null
    return data
  } catch {
    return null
  }
}

function reconcile(attempt: AttemptView | null, answers: QueuedAnswer[]) {
  if (!answers.length) return answers
  const acknowledged = new Map(attempt?.answerReceipts?.map(receipt => [receipt.index, receipt.operationId]))
  const start = attempt?.answered ?? 0
  const pending = answers.filter(answer => answer.index >= start)
  const changed = answers.some(answer => answer.index < start && acknowledged.get(answer.index) !== answer.operationId)
  if (changed || (pending.length && (attempt?.phase !== 'question' || pending[0].index !== start ||
      pending.some((answer, offset) => {
        const question = attempt.segment?.questions[offset]
        return question?.id !== answer.questionId || question?.index !== answer.index
      })))) return null
  return pending
}

export function useAssessmentSession(userId: string) {
  const journalKey = `rosie-vocabulary-sync:v1:${userId}`
  const [attempt, setAttemptState] = useState<AttemptView | null>(null)
  const [ready, setReady] = useState(false)
  const [bankReady, setBankReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [storageWarning, setStorageWarning] = useState(false)
  const [pending, setPending] = useState<QueuedAnswer[]>(emptyAnswers)
  const [deferred, setDeferred] = useState<DeferredAction | null>(null)
  const current = useRef<AttemptView | null>(null)
  const queue = useRef<QueuedAnswer[]>(emptyAnswers)
  const intent = useRef<Intent | null>(null)
  const inFlight = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)

  function receive(value: AttemptView | null) {
    current.current = value
    setAttemptState(value)
  }

  function persist() {
    const answers = queue.current
    const deferred = intent.current
    try {
      if ((answers.length || deferred) && current.current) {
        const journal: Journal = { attemptId: current.current.id, answers, deferred }
        sessionStorage.setItem(journalKey, JSON.stringify(journal))
      } else {
        sessionStorage.removeItem(journalKey)
      }
      setStorageWarning(false)
    } catch {
      setStorageWarning(Boolean(answers.length || deferred))
    }
  }

  function updateQueue(answers: QueuedAnswer[]) {
    queue.current = answers
    setPending(answers)
    persist()
  }

  function setIntent(value: Intent | null) {
    intent.current = value
    setDeferred(value?.kind ?? null)
    persist()
  }

  async function flush() {
    const controller = controllerRef.current
    if (!controller || controller.signal.aborted || inFlight.current ||
        (!queue.current.length && !intent.current)) return
    if (!navigator.onLine) {
      setError('当前网络已断开，联网后会继续同步。')
      return
    }
    inFlight.current = true
    setSyncing(true)
    try {
      while (current.current && (queue.current.length || intent.current)) {
        const snapshot = current.current
        const answers = queue.current
        const nextAction = intent.current
        const action: AttemptAction | null = answers.length
          ? { kind: 'sync', id: snapshot.id, revision: snapshot.revision, answers }
          : nextAction?.after === snapshot.answered
            ? { kind: nextAction.kind, id: snapshot.id, revision: snapshot.revision } : null
        if (!action) {
          setIntent(null)
          setError('这份答卷已更新，已恢复云端进度。')
          break
        }
        const response = await requestAssessment(userId, action,
          AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]))
        if (controller.signal.aborted) return
        const remaining = response.attempt?.id === snapshot.id
          ? reconcile(response.attempt, queue.current) : null
        const acknowledgedPrefix = remaining && remaining.length < queue.current.length
        const conflict = Boolean(response.error && !acknowledgedPrefix)
        receive(response.attempt)
        if (!remaining || conflict || !answers.length || response.attempt?.phase === 'submitted') {
          setIntent(null)
        }
        updateQueue(remaining ?? emptyAnswers)
        if (!remaining || conflict) {
          setError(response.error || '这份答卷已在其他页面更新，已恢复云端进度。')
          break
        }
        setError('')
      }
    } catch {
      if (!controller.signal.aborted) setError('暂时无法同步进度，请重试。')
    } finally {
      if (!controller.signal.aborted) {
        inFlight.current = false
        setSyncing(false)
      }
    }
  }

  async function move(action?: AttemptAction) {
    const controller = controllerRef.current
    if (!controller || controller.signal.aborted || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const response = await requestAssessment(userId, action,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]))
      if (controller.signal.aborted) return
      receive(response.attempt)
      if (!action) {
        const saved = readJournal(journalKey)
        const restored = saved && saved.attemptId === response.attempt?.id
          ? reconcile(response.attempt, saved.answers) : null
        if (restored && response.attempt && saved?.deferred &&
            saved.deferred.after === response.attempt.answered + restored.length &&
            response.attempt.phase !== 'submitted' &&
            !(saved.deferred.kind === 'pause' && response.attempt.phase === 'paused')) {
          setIntent(saved.deferred)
        }
        updateQueue(restored ?? emptyAnswers)
        if (saved && !restored) setError('这份答卷已更新，已恢复云端进度。')
      }
      setBankReady(response.bankReady)
      if (response.error) setError(response.error)
      setReady(true)
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : '暂时无法读取测评，请重试。')
      }
    } finally {
      if (!controller.signal.aborted) {
        inFlight.current = false
        setBusy(false)
        if (queue.current.length || intent.current) void flush()
      }
    }
  }

  // The page keys this hook by account. Mount once per account and cancel the old requests.
  const begin = useRef(() => {
    const controller = new AbortController()
    controllerRef.current = controller
    inFlight.current = false
    void move()
    const online = () => void flush()
    window.addEventListener('online', online)
    return () => {
      controller.abort()
      window.removeEventListener('online', online)
    }
  })
  useEffect(() => begin.current(), [])

  function answer(value: QueuedAnswer) {
    const snapshot = current.current
    const expected = (snapshot?.answered ?? 0) + queue.current.length
    if (intent.current || snapshot?.phase !== 'question' || value.index !== expected ||
        snapshot.segment?.questions[queue.current.length]?.id !== value.questionId) return false
    updateQueue([...queue.current, value])
    void flush()
    return true
  }

  function change(kind: ActionKind) {
    const snapshot = current.current
    if (!snapshot || intent.current) return
    if (kind === 'pause' || kind === 'finish') {
      setIntent({ kind, after: snapshot.answered + queue.current.length })
      void flush()
      return
    }
    if (!queue.current.length) void move({ kind, id: snapshot.id, revision: snapshot.revision })
  }

  return {
    attempt, ready, bankReady, busy, syncing, error, pending, deferred, storageWarning,
    answer, change, retry: () => ready ? void flush() : void move(),
    start: () => void move({ kind: 'start', previousId: current.current?.id ?? null }),
  }
}
