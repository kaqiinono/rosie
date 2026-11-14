'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { refreshSessionStore, useAuth } from '@rosie/core'
import { FormSelect, StickerCard } from '@rosie/ui'
import { Button, Flex, Spinner, Text, TextArea, TextField } from '@rosie/ui/themes'
import type { ExamAttemptView } from '../types/attempts'
import type { ExamHandwritingDecision } from '../types/assessment'
import { examErrorMessage, examRequest, ExamRequestError } from '../client/examApi'
import { handwritingAssessmentStore } from '../client/handwriting'
import { attemptListStore } from '../client/learningCatalog'
import { ExamGapAnswer } from './ExamGapAnswer'

const choices: { id: ExamHandwritingDecision; label: string }[] = [
  { id: 'correct', label: '正确' }, { id: 'incorrect', label: '错误' }, { id: 'unclear', label: '看不清，待确认' },
]
export function ExamHandwritingGradingPanel({ attemptId, view, onSaved, ownerId }: {
  attemptId: string; view: ExamAttemptView; onSaved: () => void; ownerId?: string
}) {
  const { user } = useAuth()
  const questions = view.groups.filter(group => view.state.sections[group.sectionId]?.status === 'submitted')
    .flatMap(group => group.questions).filter(question => {
      const answer = view.state.answers[question.id]
      return question.answerType === 'gap_fill' && !question.optionPoolId && question.scoring.kind === 'objective'
        && answer?.type === 'gap_fill' && Object.keys(answer.ink ?? {}).length > 0
    })
  const store = useMemo(() => handwritingAssessmentStore(attemptId, ownerId), [attemptId, ownerId])
  const data = store.useSessionData(questions.length && view.handwritingAvailable ? user : null)
  const [selected, setSelected] = useState('')
  const question = questions.find(item => item.id === selected) ?? questions[0]
  const [editing, setEditing] = useState(false)
  const [decision, setDecision] = useState<ExamHandwritingDecision | null>(null)
  const [comment, setComment] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadBusy, setLoadBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<unknown>(null)
  const pending = useRef<string | null>(null)
  const lock = useRef(false)
  const outlet = useRef<HTMLDivElement>(null)
  const refreshPromise = useRef<Promise<void> | null>(null)
  const requestedVersion = useRef<string | null>(null)
  const refreshRecords = useCallback(() => {
    if (!user) return Promise.resolve()
    if (refreshPromise.current) return refreshPromise.current
    setLoadBusy(true)
    const request = store.refreshInBackground(user.id).catch(() => undefined).finally(() => {
      refreshPromise.current = null; setLoadBusy(false)
    })
    refreshPromise.current = request
    return request
  }, [store, user])
  useEffect(() => {
    if (!user || !questions.length || !view.handwritingAvailable || data.isLoading || data.error || !data.data.version || data.data.version === view.version) return
    if (requestedVersion.current === view.version) return
    requestedVersion.current = view.version
    void refreshRecords()
  }, [user, questions.length, view.handwritingAvailable, view.version, data.isLoading, data.error, data.data.version, refreshRecords])
  if (!questions.length || !question || question.answerType !== 'gap_fill') return null
  const answer = view.state.answers[question.id]
  const history = data.data.reviews.filter(item => item.questionId === question.id)
  const latest = history[history.length - 1]
  const reference = data.data.references.find(item => item.questionId === question.id)
  const frozen = busy || !!pending.current
  async function refresh() {
    if (!user || loadBusy) return
    await refreshRecords()
    onSaved()
  }
  async function save() {
    if (!user || !question || !decision || lock.current) return
    lock.current = true; setBusy(true); setError(null); setMessage('')
    pending.current ??= JSON.stringify({ requestId: crypto.randomUUID(), expectedVersion: view.version, questionId: question.id,
      decision, comment, ...(ownerId ? { ownerId } : { pin }) })
    try {
      await examRequest(user.id, `/api/exams/attempts/${attemptId}/handwriting-grades`, { method: 'POST', body: pending.current })
      pending.current = null; setPin(''); setEditing(false); setDecision(null); setComment(''); setMessage('批阅已保存')
      onSaved()
      void refreshRecords()
      if (!ownerId) {
        void attemptListStore.refreshInBackground(user.id).catch(() => undefined)
        for (const days of [14, 28]) void refreshSessionStore(`exams-reports:${days}`, user.id).catch(() => undefined)
      }
    } catch (failure) {
      setError(failure)
      if (failure instanceof ExamRequestError && failure.status >= 400 && failure.status < 500 && failure.status !== 429) pending.current = null
    } finally { lock.current = false; setBusy(false) }
  }
  return <StickerCard as="section" size="lg"><Flex direction="column" gap="4">
    <Text weight="bold" size="4">手写答案与批阅</Text>
    <FormSelect ariaLabel="手写题目" value={question.id} disabled={frozen} options={questions.map(item => ({ value: item.id,
      label: `${item.location.sectionId} Part ${item.location.partNumber} · 第 ${item.location.questionNumber} 题` }))}
      onValueChange={id => { setSelected(id); setDecision(null); setComment(''); setPin(''); setEditing(false); setError(null); setMessage('') }} />
    {question.gaps.map(gap => <Flex key={gap.id} gap="2" wrap="wrap" align="center"><Text>{gap.label}：</Text>
      <ExamGapAnswer label={`${question.location.questionNumber} · ${gap.label}`} gapId={gap.id} maxWords={gap.maxWords ?? undefined}
        answer={answer?.type === 'gap_fill' ? answer : undefined} readOnly inlineTarget={outlet} onChange={() => undefined} />
    </Flex>)}
    <div ref={outlet} className="empty:hidden" />
    <Text role="status">{latest ? latest.decision === 'unclear' ? '字迹待确认 · 暂不计分'
      : `已批阅：${latest.decision === 'correct' ? '正确' : '错误'} · ${latest.points} / ${latest.maxPoints}` : '已提交 · 等待家长批阅 · 暂不计分'}</Text>
    {latest?.comment && <Text>家长留言：{latest.comment}</Text>}
    {data.isLoading || loadBusy ? <Flex gap="2" align="center"><Spinner /><Text>正在读取批阅记录…</Text></Flex> : null}
    {!view.handwritingAvailable && <Text>手写批阅暂不可用，请稍后重新读取。</Text>}
    {data.error ? <Text role="alert" color="red">{examErrorMessage(data.error)}</Text> : null}
    {view.handwritingAvailable && <Flex gap="3" wrap="wrap">
      <Button disabled={frozen || data.isLoading || !!data.error || !data.data.version} onClick={() => setEditing(value => !value)}>{editing ? '收起批阅' : ownerId ? '管理员批阅' : '家长批阅'}</Button>
      <Button variant="soft" loading={loadBusy} disabled={frozen || data.isLoading} onClick={() => void refresh()}>重新读取批阅</Button>
    </Flex>}
    {editing && <Flex direction="column" gap="3">
      <Text>参考答案：{reference?.acceptedAnswerSets.map(set => set.map(item => `${question.gaps.find(gap => gap.id === item.gapId)?.label ?? item.gapId}：${item.value}`).join('；')).join(' / ') || '未提供'}</Text>
      <Text size="2" color="gray">对照整题所有空位和原始笔迹批阅；任一字迹不能确认时，选择“看不清，待确认”。</Text>
      <Flex gap="2" wrap="wrap">{choices.map(item => <Button key={item.id} disabled={frozen} variant={decision === item.id ? 'solid' : 'soft'} aria-pressed={decision === item.id} onClick={() => setDecision(item.id)}>{item.label}</Button>)}</Flex>
      <TextArea aria-label="给孩子的批阅留言" placeholder="给孩子的留言（选填）" maxLength={4000} value={comment} disabled={frozen} onChange={event => setComment(event.target.value)} />
      {!ownerId && <TextField.Root aria-label="家长 PIN" placeholder="家长 PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} disabled={frozen} onChange={event => setPin(event.target.value)} />}
      <Flex><Button loading={busy} disabled={!pending.current && (!decision || (!ownerId && !/^\d{6}$/.test(pin)))} onClick={() => void save()}>{pending.current ? '重试原批阅' : '保存批阅'}</Button></Flex>
    </Flex>}
    {message && <Text role="status">{message}</Text>}
    {error ? <Text role="alert" color="red">{examErrorMessage(error)}</Text> : null}
    {history.length > 0 && <Flex direction="column" gap="2"><Text weight="bold">批阅记录</Text>{[...history].reverse().map(item => <Text key={item.id} size="2">
      {new Date(item.reviewedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} · {choices.find(choice => choice.id === item.decision)?.label}
      {item.points !== null ? ` · ${item.points} / ${item.maxPoints}` : ' · 暂不计分'}{item.comment ? ` · ${item.comment}` : ''}
    </Text>)}</Flex>}
  </Flex></StickerCard>
}
