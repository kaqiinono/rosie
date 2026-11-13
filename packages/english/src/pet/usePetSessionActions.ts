'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { STORAGE_KEYS } from '@rosie/core'
import type { ExerciseItemState } from '../grammar/components/ExerciseView'
import type { PetSession, PetSessionAction } from './types'

type States = Record<number, ExerciseItemState | undefined>
type Pending = { sessionId: string; states: States; actions: PetSessionAction[] }
type SessionActions = {
  userId: string
  initial: PetSession
  save: (session: PetSession, action: PetSessionAction) => Promise<PetSession>
  complete: (session: PetSession) => Promise<PetSession>
}

export function petSessionStates(session: PetSession): States {
  return Object.fromEntries(session.items.map((item, index) => {
    const answer = session.answers[item.id]
    if (!answer) return [index + 1, { values: [] }]
    const latest = answer.retries.at(-1)
    const values = session.status === 'completed'
      ? latest?.answers ?? answer.firstAnswers ?? []
      : answer.draftAnswers ?? latest?.answers ?? answer.firstAnswers ?? []
    const judged = latest?.answers ?? answer.firstAnswers
    const editing = session.status !== 'completed' && JSON.stringify(values) !== JSON.stringify(judged)
    return [index + 1, {
      values,
      ...(answer.firstAnswers ? {
        first: { values: answer.firstAnswers, correct: answer.firstCorrect === true, helped: answer.usedHelp },
      } : {}),
      status: editing || answer.firstCorrect === null ? undefined : (latest?.correct ?? answer.firstCorrect) ? 'correct' : 'wrong',
      helped: answer.usedHelp,
      revealed: answer.revealed ?? (answer.usedHelp && !answer.firstAnswers && answer.draftAnswers === undefined),
      retries: answer.retries.length,
    } satisfies ExerciseItemState]
  }))
}

function pendingStates(session: PetSession, local: States, actions: PetSessionAction[]): States {
  const cloud = petSessionStates(session)
  if (session.status !== 'active') return cloud
  const changed = new Set(actions.flatMap((action) => 'itemId' in action ? [action.itemId] : []))
  for (const [index, item] of session.items.entries()) {
    const number = index + 1
    const saved = local[number]
    if (!changed.has(item.id) || !saved) continue
    const remote = cloud[number]
    cloud[number] = {
      ...saved,
      first: remote?.first ?? saved.first,
      helped: remote?.helped || saved.helped,
    }
  }
  return cloud
}

/** Serial, replayable writes. A failed request remains at the head of the queue. */
export function usePetSessionActions({ userId, initial, save, complete }: SessionActions) {
  const storageKey = `${STORAGE_KEYS.PET_PENDING_SESSION}:${userId}:${initial.id}`
  const [restored] = useState<Pending | null>(() => {
    if (initial.status !== 'active') return null
    try {
      const raw = localStorage.getItem(storageKey)
      const pending = raw ? JSON.parse(raw) as Pending : null
      return pending?.sessionId === initial.id && pending.states && Array.isArray(pending.actions) && pending.actions.length > 0 ? pending : null
    } catch { return null }
  })
  const [session, setSession] = useState(initial)
  const [states, setStates] = useState<States>(() => restored ? pendingStates(initial, restored.states, restored.actions) : petSessionStates(initial))
  const [pendingCount, setPendingCount] = useState(restored?.actions.length ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const current = useRef(initial)
  const statesRef = useRef(states)
  const queue = useRef<PetSessionAction[]>(restored?.actions ?? [])
  const running = useRef<Promise<void> | null>(null)
  const alive = useRef(true)
  const saveRef = useRef(save)
  saveRef.current = save
  const incoming = useRef(initial)
  incoming.current = initial

  const persist = useCallback(() => {
    try {
      if (current.current.status !== 'active' || queue.current.length === 0) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, JSON.stringify({
        sessionId: initial.id, states: statesRef.current, actions: queue.current,
      } satisfies Pending))
    } catch { /* Server saves still work when browser storage is unavailable. */ }
  }, [storageKey, initial.id])

  const reconcile = useCallback(() => {
    const snapshot = incoming.current
    if (snapshot.version <= current.current.version) return
    current.current = snapshot
    if (snapshot.status !== 'active') queue.current = []
    statesRef.current = pendingStates(snapshot, statesRef.current, queue.current)
    persist()
    if (alive.current) {
      setSession(snapshot)
      setPendingCount(queue.current.length)
      setStates(statesRef.current)
      if (snapshot.status !== 'active') setError(null)
    }
  }, [persist])

  const flush = useCallback((): Promise<void> => {
    if (running.current) return running.current
    const task = async () => {
      if (alive.current) setError(null)
      while (queue.current.length) {
        const result = await saveRef.current(current.current, queue.current[0])
        current.current = result
        queue.current.shift()
        statesRef.current = pendingStates(result, statesRef.current, queue.current)
        persist()
        if (alive.current) {
          setSession(result)
          setStates(statesRef.current)
          setPendingCount(queue.current.length)
        }
      }
    }
    running.current = task().catch((cause: unknown) => {
      if (alive.current) setError(cause instanceof Error ? cause.message : '保存失败，请重试。')
      throw cause
    }).finally(() => {
      running.current = null
      reconcile()
    })
    return running.current
  }, [persist, reconcile])

  const enqueue = useCallback((action: PetSessionAction) => {
    const entry = { ...action, requestId: crypto.randomUUID() }
    const last = queue.current.at(-1)
    // Do not replace the request currently in flight.
    if (action.type === 'draft' && last?.type === 'draft' && last.itemId === action.itemId && queue.current.length > 1) {
      queue.current[queue.current.length - 1] = entry
    } else queue.current.push(entry)
    setPendingCount(queue.current.length)
    persist()
    void flush().catch(() => undefined)
  }, [persist, flush])

  const changeItem = useCallback((number: number, state: ExerciseItemState) => {
    const item = current.current.items[number - 1]
    if (!item || current.current.status !== 'active') return
    const previous = statesRef.current[number]
    statesRef.current = { ...statesRef.current, [number]: state }
    setStates(statesRef.current)
    if (state.helped && !previous?.helped) enqueue({ type: 'help', itemId: item.id })
    if (state.status && (!previous?.status || !previous.first)) {
      enqueue({ type: 'answer', itemId: item.id, answers: state.values })
    } else if (JSON.stringify(previous?.values) !== JSON.stringify(state.values) || (previous?.revealed && !state.revealed)) {
      enqueue({ type: 'draft', itemId: item.id, answers: state.values })
    }
    persist()
  }, [enqueue, persist])

  const finish = useCallback(async () => {
    setCompleting(true)
    setError(null)
    try {
      await flush()
      const result = await complete(current.current)
      current.current = result
      statesRef.current = petSessionStates(result)
      setStates(statesRef.current)
      setSession(result)
      persist()
      return result
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交失败，答案仍保留，请重试。')
      return null
    } finally { setCompleting(false) }
  }, [complete, flush, persist])

  useEffect(() => {
    alive.current = true
    if (queue.current.length) void flush().catch(() => undefined)
    return () => { alive.current = false }
  }, [flush])

  useEffect(() => {
    if (!running.current) reconcile()
  }, [initial, reconcile])

  return { session, states, changeItem, enqueue, pendingCount, error, completing, flush, finish }
}
