'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { StickerCard } from '@rosie/ui'
import { Badge, Button, Spinner } from '@rosie/ui/themes'
import { ExerciseView } from '../grammar/components/ExerciseView'
import type { GrammarExerciseGroup } from '../grammar/types'
import type { PetSession, PetSessionAction } from './types'
import { usePetSessionActions } from './usePetSessionActions'
import { speakPetWord } from './speech'

type Props = {
  userId: string
  initial: PetSession
  save: (session: PetSession, action: PetSessionAction) => Promise<PetSession>
  complete: (session: PetSession) => Promise<PetSession>
  refresh: () => Promise<void>
  onBack: () => void
}

function elapsedLabel(startedAt: string, until: number): string {
  const seconds = Math.max(0, Math.floor((until - Date.parse(startedAt)) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function PetSessionView({ userId, initial, save, complete, refresh, onBack }: Props) {
  const actions = usePetSessionActions({ userId, initial, save, complete })
  const { session, states, changeItem, enqueue, pendingCount, error, completing, flush, finish } = actions
  const [now, setNow] = useState(() => Date.now())
  const [playing, setPlaying] = useState<string | null>(null)
  const [audioErrors, setAudioErrors] = useState<Set<string>>(new Set())
  const [heard, setHeard] = useState<Set<string>>(new Set())
  const [skipping, setSkipping] = useState<Set<string>>(new Set())
  const audio = useRef<AbortController | null>(null)
  const completed = session.status === 'completed'
  const assessment = session.feedbackMode === 'assessment'

  useEffect(() => {
    if (!session.timerEnabled || completed) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session.timerEnabled, completed])

  useEffect(() => () => audio.current?.abort(), [])

  const play = async (itemId: string, text: string) => {
    audio.current?.abort()
    const controller = new AbortController()
    audio.current = controller
    setPlaying(itemId)
    const ok = await speakPetWord(text, controller.signal)
    if (controller.signal.aborted) return
    setPlaying(null)
    if (ok) {
      setHeard((previous) => new Set(previous).add(itemId))
      setAudioErrors((previous) => new Set([...previous].filter((id) => id !== itemId)))
    } else setAudioErrors((previous) => new Set(previous).add(itemId))
  }

  const group = useMemo<GrammarExerciseGroup>(() => ({
    section: session.source,
    instruction: assessment ? '完成整组后提交，提交前不显示答案。' : '填入适合句子的词；需要时可以查看答案，再练一次。',
    items: session.items.map((item, index) => ({
      number: index + 1,
      type: item.options?.length ? 'multiple_choice' : 'fill_blank',
      prompt: item.kind === 'listening' ? '听音后填写：______' : item.prompt,
      answer: item.acceptedAnswerSets[0]?.join(' / ') ?? '',
      acceptedAnswerSets: item.acceptedAnswerSets,
      options: item.options,
      explanation: [item.explanation, item.translation].filter(Boolean).join('\n'),
    })),
  }), [session.items, session.source, assessment])

  const answeredCount = session.items.filter((item, index) => {
    if (session.answers[item.id]?.skippedAudio) return true
    const state = states[index + 1]
    return assessment
      ? (state?.values.length ?? 0) === item.acceptedAnswerSets[0]?.length && state?.values.every((value) => value.trim())
      : Boolean(state?.first)
  }).length
  const firstAnswers = Object.values(session.answers).filter((answer) => answer.firstAnswers && !answer.skippedAudio)
  const independent = firstAnswers.filter((answer) => answer.firstCorrect && !answer.usedHelp).length
  const disabledItems = session.items.flatMap((item, index) =>
    skipping.has(item.id) || session.answers[item.id]?.skippedAudio ||
      (item.kind === 'listening' && !heard.has(item.id) && !session.answers[item.id]?.firstAnswers)
      ? [index + 1] : [],
  )

  const leave = async () => {
    try { await flush(); onBack() } catch { /* Keep the session open with retry feedback. */ }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{session.source}</h1>
          <p className="mt-1 text-sm text-[var(--wm-text-dim)]">
            {assessment ? '测评模式 · 整组提交' : '训练模式 · 逐题反馈'} · {session.items.length} 题
          </p>
        </div>
        <Button variant="soft" color="gray" onClick={() => void leave()} disabled={completing}>
          {completed ? '返回 PET' : '保存并返回'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3" role="status" aria-live="polite">
        <Badge color="green">已完成 {answeredCount} / {session.items.length}</Badge>
        {session.timerEnabled && <Badge color="gray">用时 {elapsedLabel(session.startedAt, session.completedAt ? Date.parse(session.completedAt) : now)}</Badge>}
        {pendingCount > 0 && <span className="inline-flex items-center gap-2 text-sm"><Spinner />正在保存</span>}
        {pendingCount === 0 && !error && <span className="text-sm text-[var(--wm-text-dim)]">答案已保存</span>}
      </div>

      {error && <StickerCard tone="accent" role="alert">
        <p>答案尚未保存成功，当前内容仍然保留。</p>
        <p className="mt-2 text-sm">{error}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button onClick={() => void flush().catch(() => undefined)}>重试保存</Button>
          <Button variant="soft" onClick={() => void refresh().catch(() => undefined)}>同步其他设备的记录</Button>
        </div>
      </StickerCard>}

      {completed && <StickerCard tone="accent">
        <h2 className="text-lg font-bold">本轮完成</h2>
        <p className="mt-2">首次独立答对 {independent} / {firstAnswers.length} 题。</p>
        <p className="mt-1 text-sm">提示和补练单独记录，不覆盖首次结果；音频不可用的题目不计错。</p>
      </StickerCard>}

      {session.passage && <StickerCard tone="accent" as="article">
        <h2 className="mb-3 font-bold">阅读短文</h2>
        <p className="whitespace-pre-line text-lg leading-8" lang="en">{session.passage}</p>
      </StickerCard>}

      {session.wordPool.length > 0 && (!assessment || completed) && <StickerCard tone="accent">
        <p className="mb-3 text-sm">词汇池 · 根据句子使用正确形式</p>
        <div className="flex flex-wrap gap-2">{session.wordPool.map((word, index) => <Badge key={`${word}-${index}`} color="green">{word}</Badge>)}</div>
      </StickerCard>}

      {!completed && session.items.some((item) => item.kind === 'listening') && <StickerCard tone="accent">
        <h2 className="font-bold">先听一听</h2>
        <div className="mt-3 flex flex-col gap-3">
          {session.items.map((item, index) => item.kind === 'listening' && (
            <div key={item.id} className="flex flex-wrap items-center gap-3">
              <Button variant="soft" loading={playing === item.id} onClick={() => void play(item.id, item.spokenText ?? item.acceptedAnswerSets[0]?.[0] ?? '')} disabled={skipping.has(item.id) || Boolean(session.answers[item.id]?.skippedAudio)}>
                播放第 {index + 1} 题
              </Button>
              {heard.has(item.id) && <Badge color="green">已播放</Badge>}
              {audioErrors.has(item.id) && !skipping.has(item.id) && !session.answers[item.id]?.skippedAudio && !states[index + 1]?.first && <>
                <span className="text-sm">音频无法播放，可以重试或跳过。</span>
                <Button variant="soft" color="gray" onClick={() => {
                  setSkipping((previous) => new Set(previous).add(item.id))
                  enqueue({ type: 'skip_audio', itemId: item.id })
                }}>跳过，不计错</Button>
              </>}
              {session.answers[item.id]?.skippedAudio && <Badge color="gray">已跳过</Badge>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm">每题播放成功后即可作答。</p>
      </StickerCard>}

      <ExerciseView
        groups={[group]}
        isAdmin={false}
        pageImages={[]}
        onGroupResult={() => undefined}
        onPreviewFigure={() => undefined}
        practice={{
          mode: assessment ? 'assessment' : 'practice',
          disabled: completing || completed || Boolean(error),
          disabledItems,
          submitted: completed,
          states,
          onItemChange: changeItem,
        }}
      />

      {!completed && <div className="flex flex-wrap items-center gap-3">
        <Button size="3" loading={completing} disabled={answeredCount !== session.items.length || Boolean(error)} onClick={() => void finish()}>
          {assessment ? '提交整组' : '完成本轮'}
        </Button>
        <span className="text-sm text-[var(--wm-text-dim)]">{answeredCount < session.items.length ? '完成每道题后提交。' : '提交后保留首次作答结果。'}</span>
      </div>}
    </div>
  )
}
