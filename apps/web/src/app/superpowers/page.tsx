'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase, useAuth } from '@rosie/core'
import { AnswerChoiceGroup, LearningIcon, PageShell, StickerCard } from '@rosie/ui'
import { Button, Spinner, Theme } from '@rosie/ui/themes'
import {
  MAX_ITEMS, MIN_ESTIMATE_ITEMS, SEGMENT_SIZE,
  type AttemptAction, type AttemptView, type Decision,
} from '@rosie/english/assessment/model'
import { AssessmentRuler, AssessmentResults } from './AssessmentDetails'

const API = '/api/vocabulary-assessment'

async function requestAssessment(userId: string, action?: AttemptAction, signal?: AbortSignal) {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw new Error('请先登录再继续。')
  const response = await fetch(API, {
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

function Welcome({ pending, bankReady, onStart }: { pending: boolean; bankReady: boolean; onStart: () => void }) {
  return (
    <StickerCard as="section" size="lg" tone="white" className="mx-auto grid max-w-2xl gap-6">
      <div className="flex items-start gap-4">
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-violet-100">
          <LearningIcon name="wordCards" size={28} />
        </span>
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">我的英语词汇量</h2>
          <p className="text-text-secondary mt-2 text-base leading-relaxed">
            选出单词的英文意思。每段 12 题，想休息时可以下次继续。
          </p>
        </div>
      </div>
      <div className="border-border-light border-t pt-4 text-sm">
        <p>看到不认识的单词，点「不认识」就好。</p>
        <p className="text-text-secondary mt-1">交卷后可以看每道题的中英文释义。</p>
      </div>
      {bankReady ? (
        <Button type="button" size="4" loading={pending} onClick={onStart} className="w-full sm:w-fit">
          开始词汇测评
        </Button>
      ) : <p role="status" className="text-text-secondary text-sm">测评题库正在准备中。</p>}
    </StickerCard>
  )
}

function QuestionCard({
  attempt, pending, onAnswer, onPause,
}: {
  attempt: AttemptView
  pending: boolean
  onAnswer: (decision: Decision, optionIndex?: number, elapsedMs?: number) => void
  onPause: () => void
}) {
  const question = attempt.question
  const [selected, setSelected] = useState('')
  const openedAt = useRef<number | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    openedAt.current = performance.now()
    heading.current?.focus()
  }, [])
  if (!question) return null
  const answer = (decision: Decision, optionIndex?: number) => {
    onAnswer(decision, optionIndex, openedAt.current === null ? undefined : performance.now() - openedAt.current)
  }
  return (
    <StickerCard as="section" size="lg" className="grid gap-4">
      <div>
        <p className="text-text-secondary text-sm">选择最合适的英文释义</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 ref={heading} tabIndex={-1} lang="en" className="scroll-mt-24 break-words text-4xl font-bold sm:text-5xl">
            {question.word}
          </h2>
          <span lang="en" className="text-text-secondary text-sm">{question.partOfSpeech}</span>
        </div>
        {question.context && <p lang="en" className="mt-3 text-lg leading-relaxed">{question.context}</p>}
      </div>
      <AnswerChoiceGroup
        label="请选择单词的英文释义"
        optionLang="en"
        options={question.options.map((label, index) => ({ id: 'ABCD'[index], label }))}
        value={selected}
        onValueChange={setSelected}
        disabled={pending}
        reserveFeedbackSpace={false}
      />
      <Button type="button" size="4" className="w-full" loading={pending}
        disabled={!selected} onClick={() => answer('answer', 'ABCD'.indexOf(selected))}>
        确定答案
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="3" variant="soft" color="gray" disabled={pending} className="min-h-11"
          onClick={() => answer('unknown')}>不认识这个词</Button>
        <Button type="button" size="3" variant="soft" color="gray" disabled={pending} className="min-h-11"
          onClick={() => answer('unreadable')}>看不懂选项</Button>
        <Button type="button" size="3" variant="ghost" color="gray" disabled={pending}
          onClick={onPause} className="ml-auto min-h-11">暂停</Button>
      </div>
      {attempt.suggestRest && <p role="status" className="text-text-secondary text-sm">累了可以暂停，进度已经保存。</p>}
    </StickerCard>
  )
}

function BreakCard({
  attempt, pending, onChange,
}: {
  attempt: AttemptView
  pending: boolean
  onChange: (kind: 'continue' | 'pause' | 'finish' | 'diagnostic') => void
}) {
  const paused = attempt.phase === 'paused'
  const canFinish = attempt.answered > 0
  const recommended = attempt.offerEarlyFinish || attempt.suggestFinish
  const [confirm, setConfirm] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const title = paused ? '进度已保存'
    : attempt.answered === 24 ? '已经完成两小段！'
    : attempt.answered === 48 ? '已经完成四小段！'
    : `完成了第 ${attempt.answered / SEGMENT_SIZE} 小段！`

  return (
    <StickerCard as="section" size="lg" tone="white" className="grid gap-4">
      <header>
        <h2 ref={heading} tabIndex={-1} className="scroll-mt-24 text-2xl font-bold">{title}</h2>
        <p className="text-text-secondary mt-2 text-base">
          {recommended ? '今天测到这里也可以。交卷后就能看单词解析。'
            : '可以休息一下，下次从这里继续。'}
        </p>
      </header>
      {confirm ? (
        <div className="grid gap-3">
          <p className="text-sm">交卷后会打开单词解析，这次答卷到此结束。</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="3" loading={pending} onClick={() => onChange('finish')}>确认交卷</Button>
            <Button type="button" size="3" variant="soft" disabled={pending} onClick={() => setConfirm(false)}>返回</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {recommended && canFinish && (
            <Button type="button" size="4" disabled={pending} onClick={() => setConfirm(true)}>今天就测到这里</Button>
          )}
          <Button type="button" size="4" variant={recommended ? 'soft' : 'solid'}
            loading={pending} onClick={() => onChange('continue')}>{paused ? '继续测评' : '再做一小段'}</Button>
          {!paused && <Button type="button" size="4" variant="soft" color="gray"
            disabled={pending} onClick={() => onChange('pause')}>下次继续</Button>}
          {attempt.canAddDiagnostics && <Button type="button" size="4" variant="soft"
            disabled={pending} onClick={() => onChange('diagnostic')}>补测一小段</Button>}
          {!recommended && canFinish && <Button type="button" size="4" variant="ghost" color="gray"
            disabled={pending} onClick={() => setConfirm(true)}>交卷</Button>}
        </div>
      )}
    </StickerCard>
  )
}

function SegmentProgress({ attempt }: { attempt: AttemptView }) {
  const inQuestion = attempt.phase === 'question'
  const index = Math.max(0, attempt.answered - (inQuestion ? 0 : 1))
  const segment = Math.floor(index / SEGMENT_SIZE) + 1
  const completedInSegment = attempt.answered - (segment - 1) * SEGMENT_SIZE
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span>第 {segment} 小段</span>
        <span className="text-text-secondary">
          {inQuestion ? `第 ${completedInSegment + 1} / ${SEGMENT_SIZE} 题` : `已答 ${attempt.answered} 题`}
        </span>
      </div>
      <div role="progressbar" aria-label="本段进度" aria-valuemin={0} aria-valuemax={SEGMENT_SIZE}
        aria-valuenow={completedInSegment} className="grid grid-cols-12 gap-1 sm:gap-1.5">
        {Array.from({ length: SEGMENT_SIZE }, (_, index) => (
          <span key={index} className={`h-2 rounded-full ${index < completedInSegment ? 'bg-violet-600' :
            index === completedInSegment && inQuestion ? 'bg-violet-300' : 'bg-violet-100'}`} />
        ))}
      </div>
    </div>
  )
}

function Assessment({ userId }: { userId: string }) {
  const [attempt, setAttempt] = useState<AttemptView | null>(null)
  const [ready, setReady] = useState(false)
  const [bankReady, setBankReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    requestAssessment(userId, undefined, controller.signal).then(({ attempt, bankReady }) => {
      if (controller.signal.aborted) return
      setAttempt(attempt)
      setBankReady(bankReady)
      setReady(true)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message)
    })
    return () => controller.abort()
  }, [userId])

  async function move(action?: AttemptAction) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const response = await requestAssessment(userId, action)
      setAttempt(response.attempt)
      setBankReady(response.bankReady)
      setError(response.error)
      setReady(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '暂时无法保存，请重试。')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const start = () => move({ kind: 'start', previousId: attempt?.id ?? null })
  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      {error && (
        <StickerCard tone="warning" elevation="flat">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="alert">{error}</p>
            {!ready && <Button type="button" size="3" loading={busy} onClick={() => move()}>重试</Button>}
          </div>
        </StickerCard>
      )}
      {!ready && !error && <p role="status" className="flex items-center gap-2"><Spinner /> 正在加载进度</p>}
      {ready && !attempt && <Welcome pending={busy} bankReady={bankReady} onStart={start} />}
      {attempt?.phase === 'submitted' && <AssessmentResults key={attempt.id} attempt={attempt} pending={busy} onStart={start} />}
      {attempt && attempt.phase !== 'submitted' && (
        <>
          <SegmentProgress attempt={attempt} />
          <AssessmentRuler attempt={attempt} />
          {attempt.phase === 'question'
            ? <QuestionCard key={`${attempt.id}:${attempt.answered}`} attempt={attempt} pending={busy}
                onAnswer={(decision, optionIndex, elapsedMs) => move({
                  kind: 'answer', id: attempt.id, revision: attempt.revision, decision, optionIndex, elapsedMs,
                })}
                onPause={() => move({ kind: 'pause', id: attempt.id, revision: attempt.revision })} />
            : <BreakCard key={`${attempt.id}:${attempt.revision}`} attempt={attempt} pending={busy}
                onChange={kind => move({ kind, id: attempt.id, revision: attempt.revision })} />}
          {attempt.mainAnswered < MIN_ESTIMATE_ITEMS && (
            <p className="text-text-secondary text-sm">已答 {attempt.answered} 题 · 整次最多 {MAX_ITEMS} 题</p>
          )}
        </>
      )}
    </div>
  )
}

export default function SuperpowersPage() {
  const { user } = useAuth()
  return (
    <PageShell title="我的超能力" icon="⚡" width="default" showAccount>
      <Theme accentColor="violet" grayColor="sand" hasBackground={false}>
        {user && <Assessment key={user.id} userId={user.id} />}
      </Theme>
    </PageShell>
  )
}
