'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { refreshSessionStore } from '@rosie/core'
import type { ExamAnswer, ExamAttemptReview, ExamAttemptView } from '../types/attempts'
import { examRequest, ExamRequestError, examErrorMessage } from './examApi'
import { attemptListStore } from './learningCatalog'

type Action = 'save' | 'submit' | 'start-section' | 'help' | 'interrupt' | 'resume'
type Pending = { action: Action; body: string }

// JSONB object ordering is not learner input order. Compare maps canonically.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}
const same = (left: unknown, right: unknown) => canonical(left) === canonical(right)
function changes<T>(local: Record<string, T>, saved: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(local).filter(([id, value]) => !same(value, saved[id])))
}
function rebase<T>(local: Record<string, T>, previous: Record<string, T>, next: Record<string, T>): Record<string, T> {
  return { ...next, ...changes(local, previous) }
}
function concurrentChanges<T>(local: Record<string, T>, previous: Record<string, T>, next: Record<string, T>): boolean {
  return Object.entries(changes(local, previous)).some(([id, value]) => !same(previous[id], next[id]) && !same(value, next[id]))
}

export function useExamAttempt(userId: string, id: string) {
  const [view, setView] = useState<ExamAttemptView | null>(null)
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({})
  const [annotations, setAnnotations] = useState<Record<string, string[]>>({})
  const localAnnotations = useRef<Record<string, string[]>>({})
  const [help, setHelp] = useState<ExamAttemptReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [savedLabel, setSavedLabel] = useState('')
  const current = useRef<ExamAttemptView | null>(null)
  const localAnswers = useRef<Record<string, ExamAnswer>>({})
  const pendingCommand = useRef<Pending | null>(null)
  const inFlight = useRef(false)
  const blocked = useRef(false)
  const mounted = useRef(true)
  const refreshAfterWrite = useRef(false)
  const reloadCurrent = useRef<(discard?: boolean) => Promise<void>>(async () => undefined)
  const position = useRef<(() => number) | null>(null)
  const path = `/api/exams/attempts/${id}`

  const reload = useCallback(async (discard = true) => {
    if (inFlight.current) { if (!discard) refreshAfterWrite.current = true; return }
    inFlight.current = true
    const initial = current.current === null
    if (initial) setLoading(true)
    else setRefreshing(true)
    if (discard || pendingCommand.current === null) setError(null)
    try {
      const [loaded] = await Promise.all([
        examRequest<ExamAttemptView>(userId, path),
        examRequest(userId, '/api/exams/media/session', { method: 'POST' }),
      ])
      if (!mounted.current) return
      let data = loaded
      const listening = data.state.sections.listening
      if (initial && data.state.mode === 'mock' && data.state.currentSectionId === 'listening'
        && listening?.status === 'active' && listening.startedAt && Date.parse(data.serverNow) - Date.parse(listening.startedAt) > 3000) {
        data = await examRequest<ExamAttemptView>(userId, `${path}/interrupt`, { method: 'POST', body: JSON.stringify({
          requestId: crypto.randomUUID(), expectedVersion: data.version,
        }) })
      }
      if (!mounted.current) return
      const previous = current.current
      if (!discard && previous) {
        if (concurrentChanges(localAnswers.current, previous.state.answers, data.state.answers)
          || (data.annotationPersistence && concurrentChanges(localAnnotations.current, previous.state.annotations ?? {}, data.state.annotations ?? {}))) {
          throw new ExamRequestError('exam_conflict', 409)
        }
        localAnswers.current = rebase(localAnswers.current, previous.state.answers, data.state.answers)
        setAnswers(localAnswers.current)
        if (data.annotationPersistence) {
          localAnnotations.current = rebase(localAnnotations.current, previous.state.annotations ?? {}, data.state.annotations ?? {})
          setAnnotations(localAnnotations.current)
        }
      }
      current.current = data; setView(data)
      if (discard) {
        localAnswers.current = data.state.answers; setAnswers(data.state.answers)
        localAnnotations.current = data.state.annotations ?? {}; setAnnotations(localAnnotations.current)
        pendingCommand.current = null; setPending(null); setHelp(null)
      }
      blocked.current = pendingCommand.current !== null
      setSavedLabel(same(localAnswers.current, data.state.answers) && (!data.annotationPersistence || same(localAnnotations.current, data.state.annotations ?? {})) ? '已读取保存进度' : '已读取进度，仍有未保存输入')
    } catch (failure) { if (mounted.current) { setError(failure); blocked.current = true } }
    finally {
      inFlight.current = false
      if (mounted.current) { setLoading(false); setRefreshing(false) }
    }
  }, [path, userId])
  reloadCurrent.current = reload

  useEffect(() => {
    mounted.current = true
    void reload()
    return () => { mounted.current = false }
  }, [reload])

  const execute = useCallback(async (command: Pending): Promise<boolean> => {
    if (inFlight.current) return false
    const previous = current.current
    const sent = JSON.parse(command.body) as { answers?: Record<string, ExamAnswer>; annotations?: Record<string, string[]> }
    inFlight.current = true; pendingCommand.current = command
    setBusy(true); setPending(command); setError(null); setSavedLabel('保存中')
    try {
      const result = await examRequest<ExamAttemptView | { attempt: ExamAttemptView; review: ExamAttemptReview }>(userId,
        command.action === 'save' ? path : `${path}/${command.action}`, { method: command.action === 'save' ? 'PATCH' : 'POST', body: command.body })
      if (!mounted.current) return true
      const data = 'attempt' in result ? result.attempt : result
      // Acknowledge the sent snapshot, retaining only edits made while it was in flight.
      localAnswers.current = rebase(localAnswers.current, { ...previous?.state.answers, ...sent.answers }, data.state.answers)
      setAnswers(localAnswers.current)
      if (data.annotationPersistence) {
        localAnnotations.current = rebase(localAnnotations.current, { ...previous?.state.annotations, ...sent.annotations }, data.state.annotations ?? {})
        setAnnotations(localAnnotations.current)
      }
      current.current = data; setView(data)
      if ('review' in result) setHelp(result.review)
      pendingCommand.current = null; setPending(null); blocked.current = false
      setSavedLabel(same(localAnswers.current, data.state.answers) && (!data.annotationPersistence || same(localAnnotations.current, data.state.annotations ?? {})) ? '已保存' : '仍有新输入待保存')
      if (command.action !== 'save') {
        void attemptListStore.refreshInBackground(userId).catch(() => undefined)
        for (const days of [14, 28]) void refreshSessionStore(`exams-reports:${days}`, userId).catch(() => undefined)
      }
      return true
    } catch (failure) {
      if (!mounted.current) return false
      setError(failure); blocked.current = true; setSavedLabel('未确认保存')
      if (failure instanceof ExamRequestError && failure.status >= 400 && failure.status < 500 && failure.status !== 429) {
        pendingCommand.current = null; setPending(null)
      }
      return false
    } finally {
      inFlight.current = false
      if (mounted.current) {
        setBusy(false)
        if (refreshAfterWrite.current) { refreshAfterWrite.current = false; void reloadCurrent.current(false) }
      }
    }
  }, [path, userId])

  const send = useCallback(async (action: Action, extra: Record<string, unknown> = {}) => {
    const data = current.current
    if (!data || inFlight.current || pendingCommand.current) return false
    const scopeQuestions = new Set<string>(data.groups.filter(group => group.sectionId === data.state.currentSectionId).flatMap(group => group.questions.filter(question => question.scoring.kind !== 'example').map(question => question.id)))
    const scoped = Object.fromEntries(Object.entries(changes(localAnswers.current, data.state.answers)).filter(([questionId]) => scopeQuestions.has(questionId)))
    const command: Record<string, unknown> = { requestId: crypto.randomUUID(), expectedVersion: data.version, ...extra }
    if (action === 'save' || action === 'submit') {
      command.answers = scoped
      const groups = data.groups.filter(group => group.sectionId === data.state.currentSectionId)
      const scopeBlocks = new Set(groups.flatMap(group => [...group.instructions, ...group.questions.flatMap(q => [...q.prompt]), ...data.materials.filter(material => group.materialIds.includes(material.id)).flatMap(material => [...material.blocks])].filter(block => block.sentences?.length).map(block => `${group.id}/${block.id}`)))
      if (data.annotationPersistence) command.annotations = Object.fromEntries(Object.entries(changes(localAnnotations.current, data.state.annotations ?? {})).filter(([id]) => scopeBlocks.has(id)))
    }
    if (action === 'save' && data.state.currentSectionId === 'listening' && position.current) command.playbackPositionMs = position.current()
    return execute({ action, body: JSON.stringify(command) })
  }, [execute])

  const dirty = view !== null && (!same(answers, view.state.answers) || (view.annotationPersistence === true && !same(annotations, view.state.annotations ?? {})))
  const active = view?.state.currentSectionId ? view.state.sections[view.state.currentSectionId]?.status === 'active' : false
  useEffect(() => {
    if (!dirty || !active || blocked.current || busy || pending || refreshing) return
    const timer = setTimeout(() => { void send('save') }, 900)
    return () => clearTimeout(timer)
  }, [dirty, active, answers, annotations, send, busy, pending, refreshing])

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !inFlight.current && !blocked.current) void send('save')
    }, 15000)
    return () => clearInterval(timer)
  }, [active, send])

  const changeAnswer = (questionId: string, answer: ExamAnswer) => {
    localAnswers.current = { ...localAnswers.current, [questionId]: answer }
    setAnswers(localAnswers.current)
    setSavedLabel('尚未保存')
  }
  const changeAnnotation = (blockId: string, ids: string[]) => {
    localAnnotations.current = { ...localAnnotations.current, [blockId]: ids }
    setAnnotations(localAnnotations.current); setSavedLabel(current.current?.annotationPersistence ? '尚未保存' : '标记仅保留在本页')
  }
  return { view, answers, annotations, changeAnnotation, help, loading, refreshing, busy, error: error ? examErrorMessage(error) : null, pending, dirty, savedLabel,
    changeAnswer, send, reload, retry: () => pendingCommand.current ? execute(pendingCommand.current) : current.current ? send('save') : reload(), position }
}
