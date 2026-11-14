'use client'

import { useMemo, useRef, useState } from 'react'
import { createUserSessionStore, useAuth } from '@rosie/core'
import { FormSelect } from '@rosie/ui'
import { Button, Flex, Spinner, Text } from '@rosie/ui/themes'
import { examRequest, ExamRequestError } from '../client/examApi'
import { EXAM_REFLECTION_REASON_LABELS, EXAM_REFLECTION_REASONS, type ExamReflectionCommand,
  type ExamReflectionList, type ExamReflectionReason, type ExamQuestionReflectionRecord } from '../types/reflection'

type Props = { attemptId: string; questionId: string }
const stores = new Map<string, ReturnType<typeof createUserSessionStore<ExamReflectionList>>>()

function reflectionStore(attemptId: string) {
  let store = stores.get(attemptId)
  if (!store) {
    store = createUserSessionStore<ExamReflectionList>(`exam-reflections:${attemptId}`, {
      empty: { items: [] }, fetch: userId => examRequest(userId, `/api/exams/attempts/${encodeURIComponent(attemptId)}/reflections`),
    })
    stores.set(attemptId, store)
  }
  return store
}

type EditorProps = Props & {
  userId: string
  store: ReturnType<typeof reflectionStore>
  record: ExamQuestionReflectionRecord | undefined
  loading: boolean
  loadError: unknown
}

function ReflectionEditor({ attemptId, questionId, userId, store, record, loading, loadError }: EditorProps) {
  const [edit, setEdit] = useState<{ reason: ExamReflectionReason | null; expectedVersion: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [needsReload, setNeedsReload] = useState(false)
  const [state, setState] = useState<'idle' | 'saved' | 'failed' | 'conflict'>('idle')
  const [error, setError] = useState<unknown>(null)
  const pending = useRef<{ command: ExamReflectionCommand; body: string } | null>(null)
  const lock = useRef(false)
  const reason = edit ? edit.reason : record?.reason ?? null
  const frozen = pending.current !== null

  async function save() {
    if (lock.current || loading || loadError || needsReload || (!edit && !pending.current)) return
    lock.current = true; setBusy(true); setError(null)
    if (!pending.current && edit) {
      const command: ExamReflectionCommand = { requestId: crypto.randomUUID(), questionId,
        expectedVersion: edit.expectedVersion, reason: edit.reason }
      pending.current = { command, body: JSON.stringify(command) }
    }
    const request = pending.current
    if (!request) { lock.current = false; setBusy(false); return }
    try {
      const saved = await examRequest<ExamQuestionReflectionRecord>(userId, `/api/exams/attempts/${encodeURIComponent(attemptId)}/reflections`, {
        method: 'POST', body: request.body,
      })
      store.patchSessionData(userId, previous => ({ items: [...previous.items.filter(item => item.questionId !== saved.questionId), saved]
        .sort((a, b) => a.questionId.localeCompare(b.questionId)) }))
      pending.current = null
      if (saved.reason === request.command.reason) { setEdit(null); setState('saved'); setNeedsReload(false) }
      else {
        // An acknowledged old request may return a newer choice from another tab.
        // Preserve this editor's draft instead of silently accepting that choice.
        setEdit({ reason: request.command.reason, expectedVersion: saved.version })
        setState('conflict'); setNeedsReload(false)
      }
    } catch (failure) {
      setError(failure)
      if (failure instanceof ExamRequestError && failure.status === 409) {
        pending.current = null; setNeedsReload(true); setState('conflict')
      } else setState('failed')
    } finally { lock.current = false; setBusy(false) }
  }

  async function reload() {
    if (lock.current || refreshing || pending.current) return
    setRefreshing(true)
    try {
      await store.refreshInBackground(userId)
      const latest = store.getSessionData(userId)?.items.find(item => item.questionId === questionId)
      setEdit(previous => previous ? { ...previous, expectedVersion: latest?.version ?? null } : null)
      setNeedsReload(false); setError(null); setState('idle')
    } catch (failure) { setError(failure) }
    finally { setRefreshing(false) }
  }

  let message = state === 'saved' ? (reason === null ? '已清空自查原因。' : '自查原因已保存。') : edit ? '本地选择尚未保存。' : '可选：这是你自己的想法，不影响题目分数。'
  if (state === 'conflict') message = needsReload ? '服务器记录已更新。本地选择已保留，请先读取最新记录，再决定是否保存。'
    : '原保存已确认，服务器随后有了新选择。本地选择仍保留，可核对后再次保存。'
  if (state === 'failed') message = error instanceof ExamRequestError && error.status === 401 ? '登录已过期，本地选择仍保留。登录后重试原保存。'
    : error instanceof ExamRequestError && error.code === 'exam_reflection_unavailable' ? '这题尚未提交或属于例题，当前不能保存自查原因。'
      : '保存尚未确认，本地选择仍保留。重试会发送同一条保存请求。'

  return <Flex direction="column" gap="3">
    <Text weight="bold" size="3">我的自查原因（可不填）</Text>
    {(loading || refreshing) && <Flex gap="2" align="center"><Spinner /><Text size="2" role="status">正在读取自查记录…</Text></Flex>}
    <FormSelect ariaLabel="可选自查原因" size="3" value={reason ?? ''} disabled={loading || refreshing || busy || frozen || !!loadError}
      options={[{ value: '', label: '不填写／清空' }, ...EXAM_REFLECTION_REASONS.map(value => ({ value, label: EXAM_REFLECTION_REASON_LABELS[value] }))]}
      onValueChange={value => {
        const next = EXAM_REFLECTION_REASONS.find(item => item === value) ?? null
        setEdit(previous => next === (record?.reason ?? null) ? null : { reason: next, expectedVersion: previous ? previous.expectedVersion : record?.version ?? null })
        setError(null); setState(needsReload ? 'conflict' : 'idle')
      }} />
    <Flex gap="3" wrap="wrap"><Button size="3" variant="soft" loading={busy} disabled={loading || refreshing || !!loadError || needsReload || (!edit && !frozen)} onClick={() => void save()}>
      {frozen ? '重试原保存' : state === 'conflict' ? '保存我的选择' : reason === null ? '保存清空' : '保存自查原因'}
    </Button>
      {!frozen && (needsReload || !!loadError || (error !== null && state !== 'failed')) && <Button size="3" variant="soft" loading={refreshing} disabled={busy} onClick={() => void reload()}>读取最新记录</Button>}
    </Flex>
    <Text as="p" size="2" role={state === 'failed' || state === 'conflict' || loadError ? 'alert' : 'status'}>
      {loadError ? '自查记录读取失败，请重试读取；没有把读取失败当作未填写。' : busy ? '正在保存自查原因…' : message}
    </Text>
    {state === 'conflict' && !needsReload && <Text size="2">服务器当前记录：{record?.reason ? EXAM_REFLECTION_REASON_LABELS[record.reason] : '未填写'}。</Text>}
  </Flex>
}

export function ExamQuestionReflection({ attemptId, questionId }: Props) {
  const { user } = useAuth()
  const store = useMemo(() => reflectionStore(attemptId), [attemptId])
  const { data, isLoading, error } = store.useSessionData(user)
  if (!user) return null
  return <ReflectionEditor key={`${user.id}:${attemptId}:${questionId}`} attemptId={attemptId} questionId={questionId} userId={user.id}
    store={store} record={data.items.find(item => item.questionId === questionId)} loading={isLoading} loadError={error} />
}
