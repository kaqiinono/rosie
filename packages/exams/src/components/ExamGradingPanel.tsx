'use client'

import { useEffect, useRef, useState } from 'react'
import { refreshSessionStore, useAuth } from '@rosie/core'
import { FormSelect, StickerCard } from '@rosie/ui'
import { Button, Flex, Text, TextArea, TextField } from '@rosie/ui/themes'
import type { ExamAttemptView } from '../types/attempts'
import type { ExamManualReview } from '../types/assessment'
import { KET_SCHOOLS_2020_TEMPLATE } from '../templates/ket-schools-2020-v1'
import { examRequest, examErrorMessage, ExamRequestError } from '../client/examApi'
import { ExamHandwritingGradingPanel } from './ExamHandwritingGradingPanel'
import { ExamSpeakingRecorder } from './ExamSpeakingRecorder'

function RubricGradingPanel({ attemptId, view, onSaved, ownerId }: { attemptId: string; view: ExamAttemptView; onSaved: () => void; ownerId?: string }) {
  const { user } = useAuth()
  const questions = view.groups.filter(group => view.state.sections[group.sectionId]?.status === 'submitted').flatMap(group => group.questions).filter(question => question.scoring.kind === 'manual')
  const [selected, setSelected] = useState('')
  const question = questions.find(item => item.id === selected) ?? questions[0]
  const rubricId = question?.scoring.kind === 'manual' ? question.scoring.rubricId : null
  const rubric = KET_SCHOOLS_2020_TEMPLATE.rubrics.find(item => item.id === rubricId)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [comment, setComment] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [history, setHistory] = useState<ExamManualReview[]>([])
  const pending = useRef<string | null>(null)
  const lock = useRef(false)
  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    void examRequest<{ reviews: ExamManualReview[] }>(user.id, `/api/exams/attempts/${attemptId}/grades${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setHistory(result.reviews) }).catch(failure => { if (!controller.signal.aborted) setError(failure) })
    return () => controller.abort()
  }, [attemptId, user, view.version, ownerId])
  if (!questions.length || !question || !rubric) return null
  async function save() {
    if (!user || !question || !rubric || lock.current) return
    lock.current = true; setBusy(true); setError(null)
    pending.current ??= JSON.stringify({ requestId: crypto.randomUUID(), expectedVersion: view.version, questionId: question.id,
      dimensions: rubric.dimensions.map(dimension => ({ dimensionId: dimension.id, score: Number(scores[dimension.id]) })), comment, ...(ownerId ? { ownerId } : { pin }) })
    try {
      await examRequest(user.id, `/api/exams/attempts/${attemptId}/grades`, { method: 'POST', body: pending.current })
      pending.current = null; setPin(''); setScores({}); setComment(''); onSaved()
      if (!ownerId) for (const days of [14, 28]) void refreshSessionStore(`exams-reports:${days}`, user.id).catch(() => undefined)
    } catch (failure) {
      setError(failure)
      if (failure instanceof ExamRequestError && failure.status >= 400 && failure.status < 500 && failure.status !== 429) pending.current = null
    } finally { lock.current = false; setBusy(false) }
  }
  return <StickerCard as="section" size="lg"><Flex direction="column" gap="4">
    <Text as="p" size="4" weight="bold">{ownerId ? '管理员批改' : '家长批改'}</Text><Text as="p" size="2">保留每次评分与评语。口语分项用于本次亲子训练，不合成官方标准分。</Text>
    <FormSelect ariaLabel="待批改题目" size="3" disabled={busy || !!pending.current} value={question.id} options={questions.map(item => ({ value: item.id, label: `${item.location.sectionId} Part ${item.location.partNumber} · ${item.location.questionNumber}` }))}
      onValueChange={id => { setSelected(id); setScores({}); setComment('') }} />
    {question.answerType === 'speaking' && <ExamSpeakingRecorder attemptId={attemptId} question={question} answer={view.state.answers[question.id]} disabled ownerId={ownerId} version={view.version} onChange={() => undefined} onServerChange={onSaved} />}
    {rubric.dimensions.map(dimension => <label key={dimension.id} className="flex flex-col gap-2"><Text>{dimension.label}（0–5）</Text>
      <FormSelect ariaLabel={dimension.label} size="3" disabled={busy || !!pending.current} value={scores[dimension.id] ?? ''} options={[{ value: '', label: '尚未评分' }, ...Array.from({ length: 6 }, (_, score) => ({ value: String(score), label: String(score) }))]}
        onValueChange={value => setScores(previous => ({ ...previous, [dimension.id]: value }))} /></label>)}
    <TextArea aria-label="批改评语" size="3" rows={4} resize="vertical" value={comment} disabled={busy || !!pending.current} onChange={event => setComment(event.target.value)} />
    {!ownerId && <TextField.Root aria-label="家长 PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} disabled={busy || !!pending.current} onChange={event => setPin(event.target.value)} />}
    <Flex><Button size="3" loading={busy} disabled={!pending.current && ((!ownerId && !/^\d{6}$/.test(pin)) || rubric.dimensions.some(dimension => !/^[0-5]$/.test(scores[dimension.id] ?? '')))} onClick={() => void save()}>{pending.current ? '重试原批改' : '保存批改'}</Button></Flex>
    {error ? <Text role="alert" color="red">{examErrorMessage(error)}</Text> : null}
    {history.filter(item => item.questionId === question.id).map(item => <Flex key={item.id} direction="column" gap="2"><Text size="2" color="gray">{new Date(item.reviewedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} · {item.points} / {item.maxPoints}</Text><Text as="p">{item.comment}</Text></Flex>)}
  </Flex></StickerCard>
}

export function ExamGradingPanel(props: { attemptId: string; view: ExamAttemptView; onSaved: () => void; ownerId?: string }) {
  const { user } = useAuth()
  if (!user) return null
  const key = `${user.id}:${props.ownerId ?? 'self'}:${props.attemptId}`
  return <Flex direction="column" gap="5">
    <ExamHandwritingGradingPanel key={`ink:${key}`} {...props} />
    <RubricGradingPanel key={`rubric:${key}`} {...props} />
  </Flex>
}
