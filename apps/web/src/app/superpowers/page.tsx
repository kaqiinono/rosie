'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@rosie/core'
import { LearningIcon, LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Button, Theme } from '@rosie/ui/themes'
import {
  MAX_ITEMS, MIN_ESTIMATE_ITEMS, SEGMENT_SIZE,
  type AttemptView, type Decision, type SegmentQuestion,
} from '@rosie/english/assessment/model'
import { AssessmentRuler, AssessmentResults, AssessmentSeenWords } from './AssessmentDetails'
import { useAssessmentSession } from './useAssessmentSession'
import motion from './question-motion.module.css'

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
        <p className="text-text-secondary mt-1">每答完一题，就可以在「测过的单词」里看英文释义和结果。</p>
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
  question, suggestRest = false, outgoing = false, onAnswer, onPause,
}: {
  question: SegmentQuestion
  suggestRest?: boolean
  outgoing?: boolean
  onAnswer?: (decision: Decision, optionIndex?: number, elapsedMs?: number) => void
  onPause?: () => void
}) {
  const openedAt = useRef<number | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (outgoing) return
    openedAt.current = performance.now()
    heading.current?.focus({ preventScroll: true })
  }, [outgoing])
  function answer(clickedAt: number, decision: Decision, optionIndex?: number) {
    const start = openedAt.current
    const elapsedMs = start !== null && clickedAt >= start ? clickedAt - start : undefined
    onAnswer?.(decision, optionIndex, elapsedMs)
  }
  return (
    <StickerCard as="section" size="lg" className="grid gap-4">
      <div className="text-center">
        <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
          <h2 ref={heading} tabIndex={-1} lang="en" className="scroll-mt-24 break-words text-4xl font-bold sm:text-5xl">
            {question.word}
          </h2>
          <span lang="en" className="text-text-secondary text-sm">{question.partOfSpeech}</span>
        </div>
        {question.context && <p lang="en" className="mt-3 text-lg leading-relaxed">{question.context}</p>}
      </div>
      <div role="group" aria-label="英文释义选项" className="grid auto-rows-fr grid-cols-2 gap-2.5 sm:gap-3">
        {question.options.map((definition, index) => (
          <StickerCard key={definition} asChild size="none" radius="md" elevation="sm"
            className="min-h-20 min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-8)]">
            <Button type="button" lang="en" variant="ghost" color="gray" disabled={outgoing}
              className="m-0 h-auto justify-start px-3 py-3 text-left text-sm leading-snug whitespace-normal break-words sm:px-4 sm:text-base"
              onClick={event => answer(event.timeStamp, 'answer', index)}>
              {definition}
            </Button>
          </StickerCard>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button type="button" size="3" variant="soft" color="gray" disabled={outgoing} className="min-h-11 min-w-0 justify-center px-2"
          onClick={event => answer(event.timeStamp, 'unknown')}>不认识</Button>
        <Button type="button" size="3" variant="soft" color="gray" disabled={outgoing} className="min-h-11 min-w-0 justify-center px-2"
          onClick={event => answer(event.timeStamp, 'unreadable')}>看不懂</Button>
        <Button type="button" size="3" variant="soft" color="gray" disabled={outgoing} className="min-h-11 min-w-0 justify-center px-2"
          onClick={onPause}>暂停</Button>
      </div>
      {suggestRest && <p role="status" className="text-text-secondary text-sm">累了可以暂停休息。</p>}
    </StickerCard>
  )
}

function BreakCard({
  phase, answered, attempt, pending, syncFailed, canFallback, onChange,
}: {
  phase: 'break' | 'paused'
  answered: number
  attempt: AttemptView
  pending: boolean
  canFallback: boolean
  syncFailed: boolean
  onChange: (kind: 'continue' | 'pause' | 'finish' | 'diagnostic') => void
}) {
  const paused = phase === 'paused'
  const canFinish = answered > 0
  const canChooseEnd = !pending || syncFailed
  const canContinue = attempt.canContinue !== false || canFallback
  const actions = Number(canContinue) + Number(!paused) + Number(canFinish)
  const recommended = attempt.offerEarlyFinish || attempt.suggestFinish
  const [confirm, setConfirm] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const title = paused ? (attempt.phase === 'paused' ? '进度已保存' : '测评已暂停')
    : answered === 24 ? '已经完成两小段！'
    : answered === 48 ? '已经完成四小段！'
    : `完成了第 ${answered / SEGMENT_SIZE} 小段！`

  return (
    <StickerCard as="section" size="lg" tone="white" className="grid gap-4">
      <header>
        <h2 ref={heading} tabIndex={-1} className="scroll-mt-24 text-2xl font-bold">{title}</h2>
        <p className="text-text-secondary mt-2 text-base">
          {canFallback ? '下一小段已下载，可以先答，联网后一起保存。'
            : syncFailed ? '本机进度待同步，联网后可以继续。'
            : pending ? '正在同步本段进度…'
            : attempt.version === 2 && answered === 24 ? '已经答了 24 题，休息一下眼睛吧。'
            : recommended ? '今天测到这里也可以。交卷后可以一起回顾所有答过的题。'
            : '可以休息一下，下次从这里继续。'}
        </p>
        {answered > 0 && (
          <p role="status" className="text-text-secondary mt-2 text-sm">
            {attempt.answered === answered ? `已云端保存 ${answered} 题，可以下次继续。`
              : `已云端保存 ${attempt.answered} 题，另有 ${answered - attempt.answered} 题待同步。`}
          </p>
        )}
      </header>
      {confirm ? (
        <div className="grid gap-3">
          <p className="text-sm">交卷后会打开单词解析，这次答卷到此结束。</p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="4" loading={pending && !syncFailed} disabled={!canChooseEnd} onClick={() => onChange('finish')}>确认交卷</Button>
            <Button type="button" size="4" variant="soft" color="gray" disabled={!canChooseEnd} onClick={() => setConfirm(false)}>返回</Button>
          </div>
        </div>
      ) : (
        <div className={`grid items-center gap-2 ${actions === 3 ? 'grid-cols-3' : actions === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canContinue && <Button type="button" size="4" variant={recommended ? 'soft' : 'solid'} className="min-w-0 px-2 text-sm sm:text-base"
            loading={pending && !syncFailed && !canFallback} disabled={pending && !canFallback}
            onClick={() => onChange('continue')}>{canFallback ? '答已下载的一段' : paused ? '继续测评' : '再做一小段'}</Button>}
          {!paused && <Button type="button" size="4" variant="soft" color="gray"
            className="min-w-0 px-2 text-sm sm:text-base" disabled={!canChooseEnd} onClick={() => onChange('pause')}>下次继续</Button>}
          {canFinish && <Button type="button" size="4" variant={recommended ? 'solid' : 'outline'}
            className="min-w-0 px-2 text-sm sm:text-base" disabled={!canChooseEnd} onClick={() => setConfirm(true)}>交卷</Button>}
          {attempt.canAddDiagnostics && <Button type="button" size="4" variant="soft"
            className="col-span-full" disabled={pending} onClick={() => onChange('diagnostic')}>补测一小段</Button>}
        </div>
      )}
    </StickerCard>
  )
}

function SegmentProgress({ answered, inQuestion }: { answered: number; inQuestion: boolean }) {
  const index = Math.max(0, answered - (inQuestion ? 0 : 1))
  const segment = Math.floor(index / SEGMENT_SIZE) + 1
  const completedInSegment = answered - (segment - 1) * SEGMENT_SIZE
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span>第 {segment} 小段</span>
        <span className="text-text-secondary">
          {inQuestion ? `第 ${completedInSegment + 1} / ${SEGMENT_SIZE} 题` : `已答 ${answered} 题`}
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
  const session = useAssessmentSession(userId)
  const { attempt, ready, bankReady, busy, syncing, error, pending, deferred, storageWarning } = session
  const [transition, setTransition] = useState<{ from: SegmentQuestion; to: number; attemptId: string } | null>(null)
  const answered = (attempt?.answered ?? 0) + pending.length
  const question = !deferred && attempt?.phase !== 'submitted'
    ? session.available[pending.length] : undefined
  const outgoing = transition && attempt?.id === transition.attemptId && question?.index === transition.to
    ? transition.from : null
  const finishing = deferred === 'finish' || (
    attempt?.phase === 'question' && attempt.segment?.endsAttempt &&
    pending.length > 0 && pending.length === attempt.segment.questions.length
  )
  const waiting = busy || session.hasPending
  const seenWords = [...(attempt?.seenWords ?? []), ...pending.flatMap(({ index }, offset) => {
    const word = session.available[offset]?.word
    return word ? [{ index, word, status: 'pending' as const }] : []
  })]

  function answer(decision: Decision, optionIndex?: number, elapsedMs?: number) {
    if (!attempt || !question) return
    const accepted = session.answer({
      operationId: crypto.randomUUID(), questionId: question.id, segmentId: question.segmentId, index: question.index,
      decision, optionIndex, elapsedMs,
    })
    if (accepted && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTransition({ from: question, to: question.index + 1, attemptId: attempt.id })
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      {attempt && attempt.phase !== 'submitted' && (
        <>
          <SegmentProgress answered={answered} inQuestion={Boolean(question)} />
          {question ? (
            <div className="relative isolate overflow-clip pb-1">
              {outgoing && (
                <div key={`out:${outgoing.id}`} aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 ${motion.slideOut}`}
                  onAnimationEnd={() => setTransition(value => value?.from.id === outgoing.id ? null : value)}>
                  <QuestionCard question={outgoing} outgoing />
                </div>
              )}
              <div key={`in:${question.id}`} className={outgoing ? motion.slideIn : undefined}>
                <QuestionCard question={question} suggestRest={attempt.suggestRest}
                  onAnswer={answer} onPause={() => { setTransition(null); session.change('pause') }} />
              </div>
            </div>
          ) : finishing ? (
            <StickerCard as="section" size="lg" elevation="flat">
              <p role="status">已完成作答，{error ? '等待同步后查看结果。' : '正在同步答卷…'}</p>
            </StickerCard>
          ) : (
            <BreakCard key={`${attempt.id}:${answered}:${deferred === 'pause' || attempt.phase === 'paused'}`}
              phase={deferred === 'pause' || attempt.phase === 'paused' ? 'paused' : 'break'}
              answered={answered} attempt={attempt} pending={waiting}
              canFallback={session.canFallback} syncFailed={!session.online || Boolean(error && session.hasPending)}
              onChange={kind => { setTransition(null); session.change(kind) }} />
          )}
        </>
      )}
      {error && (
        <StickerCard tone="warning" elevation="flat">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="alert">{error}</p>
            <Button type="button" size="3" loading={busy || syncing} onClick={session.retry}>重试</Button>
          </div>
        </StickerCard>
      )}
      {session.conflictRows.length > 0 &&
        <details className="text-sm">
          <summary className="cursor-pointer">查看本机与云端有冲突的作答</summary>
          <ul className="my-2 grid gap-1">
            {session.conflictRows.map(row => <li key={row.index}>第 {row.index + 1} 题 · <span lang="en">{row.word}</span> · {row.choice}</li>)}
          </ul>
          <Button size="2" variant="soft" onClick={session.dismissConflict}>已核对，清除本机冲突记录</Button>
        </details>}
      {attempt?.resumedElsewhere && <p role="status" className="text-text-secondary text-sm">这里显示已同步的进度。另一台设备上待保存的答案会在原设备联网后同步。</p>}
      {!session.online && ready && <p role="status" className="text-text-secondary text-sm">当前离线，可继续答已下载的题。联网后会自动保存。</p>}
      {storageWarning && <p role="status" className="text-text-secondary text-sm">浏览器暂时无法保存待同步答案，请保持页面打开。</p>}
      {!ready && !error && (
        <div className="flex min-h-[60dvh] flex-col">
          <LoadingOverlay visible placement="content" />
        </div>
      )}
      {ready && !attempt && <Welcome pending={busy} bankReady={bankReady} onStart={session.start} />}
      {attempt?.phase === 'submitted' && <AssessmentResults key={attempt.id} attempt={attempt} pending={busy} onStart={session.start} />}
      {attempt && attempt.phase !== 'submitted' && (
        <>
          <AssessmentRuler attempt={attempt} live answered={answered} />
          <AssessmentSeenWords key={attempt.id} words={seenWords} />
          {attempt.version !== 2 && attempt.mainAnswered < MIN_ESTIMATE_ITEMS && (
            <p className="text-text-secondary text-sm">已答 {answered} 题 · 整次最多 {MAX_ITEMS} 题</p>
          )}
        </>
      )}
      {attempt && !session.hasPending && !busy && ((attempt.version !== 2 && session.pilotAvailable &&
        attempt.phase !== 'submitted') || (attempt.version === 2 && session.other.legacyId)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {attempt.version !== 2 && session.pilotAvailable && (
            <>
              <span className="text-text-secondary">旧版 · {attempt.totalWords} 词题库</span>
              {session.other.pilotId ? <a className="font-semibold underline" href={`?attempt=${session.other.pilotId}`}>打开新版答卷</a>
                : <Button type="button" size="2" variant="soft" onClick={session.start}>试试 4,000 词新版</Button>}
            </>
          )}
          {attempt.version === 2 && session.other.legacyId &&
            <a className="text-text-secondary underline" href={`?attempt=${session.other.legacyId}`}>查看或继续旧版答卷</a>}
        </div>
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
