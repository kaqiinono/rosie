'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { buildSession, checkAnswer, formatAnswer } from '@rosie/calc'
import { isAcceptedSpelling } from '@rosie/english'
import { planAssignmentId } from '@rosie/math-kit/utils/math-helpers'
import { sanitizeProblemText } from '@rosie/math-kit/utils/sanitize-problem-text'
import { StickerCard } from '@rosie/ui'
import { Button, TextField } from '@rosie/ui/themes'
import type { OfflineMathQuestion, OfflineState } from '@/lib/offline/store'
import { dayOf } from '@/lib/time-tree/types'

type Update = (state: OfflineState) => OfflineState
type Props = { state: OfflineState; change: (update: Update) => Promise<void> }

function useRecording(change: Props['change']) {
  const pending = useRef(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function record(update: Update, success: string) {
    if (pending.current) return false
    pending.current = true
    setSaving(true)
    try {
      await change(update)
      setFeedback(success)
      return true
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '本机保存失败，请重试。')
      return false
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  return { record, saving, feedback }
}

function Feedback({ text }: { text: string }) {
  return text && <p role="status" className="text-text-secondary text-sm">{text}</p>
}

export function CalcPractice({ state, change }: Props) {
  const [answer, setAnswer] = useState('')
  const started = useRef(0)
  const { record, saving, feedback } = useRecording(change)
  const draft = state.calc
  const settings = state.pack?.calc
  const question = draft?.questions[draft.answers.length]

  useEffect(() => { started.current = performance.now() }, [draft?.id, draft?.answers.length])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = answer.trim()
    if (!draft || !question || !value) return
    const correct = checkAnswer(value, question.answer)
    const ms = Math.max(0, Math.round(performance.now() - started.current))
    const saved = await record((current) => {
      if (current.calc?.id !== draft.id || current.calc.answers.length !== draft.answers.length) {
        throw new Error('练习进度已更新。')
      }
      const next = { ...draft, answers: [...draft.answers, { value, ms }] }
      if (next.answers.length < next.questions.length) return { ...current, calc: next }
      return { ...current, calc: undefined,
        queue: [...current.queue, { kind: 'calc', id: draft.id, finishedAt: new Date().toISOString(), draft: next }] }
    }, correct ? '答对了！' : '正确答案是 ' + formatAnswer(question.answer) + '。')
    if (saved) setAnswer('')
  }

  return <StickerCard className="grid gap-3">
    <h2 className="text-lg font-bold">口算</h2>
    {draft && question ? <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
      <p className="text-sm">{draft.answers.length + 1} / {draft.questions.length}</p>
      <p className="text-2xl font-bold">{question.display}</p>
      <TextField.Root aria-label="口算答案" value={answer} onChange={(event) => setAnswer(event.target.value)}
        placeholder="输入答案" autoComplete="off" />
      <Button type="submit" disabled={saving || !answer.trim()}>提交答案</Button>
    </form> : settings && <Button disabled={saving} onClick={() => void record((current) => ({
      ...current,
      calc: current.calc ?? {
        id: crypto.randomUUID(), startedAt: new Date().toISOString(), settings,
        questions: buildSession(settings, { problemStates: new Map() }), answers: [],
      },
    }), '')}>开始一组</Button>}
    <Feedback text={feedback} />
  </StickerCard>
}

export function EnglishPractice({ state, change }: Props) {
  const [answer, setAnswer] = useState('')
  const { record, saving, feedback } = useRecording(change)
  const round = state.pack?.english
  const day = round?.day
  const answers = state.english?.roundId === round?.id ? state.english?.answers ?? [] : []
  const question = round?.questions[answers.length]
  if (!round || !day) return null

  async function submit(value: string) {
    const cleaned = value.trim()
    if (!round || !question || !day || !cleaned) return
    const correct = question.choices ? cleaned === question.answer : isAcceptedSpelling(cleaned, question.word)
    const saved = await record((current) => {
      if (current.pack?.english?.id !== round.id ||
        (current.english?.roundId === round.id && current.english.answers.length !== answers.length)) {
        throw new Error('练习进度已更新。')
      }
      const next = [...answers, cleaned]
      const english = { roundId: round.id, answers: next }
      if (next.length < round.questions.length) return { ...current, english }
      return { ...current, english,
        queue: [...current.queue, { kind: 'english', id: round.id, day, round, answers: next }] }
    }, correct ? '答对了！' : '正确答案是 ' + question.answer + '。')
    if (saved) setAnswer('')
  }

  return <StickerCard className="grid gap-3">
    <h2 className="font-bold">{round.name}</h2>
    {question ? <>
      <p className="text-sm">{answers.length + 1} / {round.questions.length}</p>
      <p className="text-xl font-bold">{question.prompt}</p>
      {question.choices ? <div className="flex flex-wrap gap-2">
        {question.choices.map((choice) => <Button key={choice} disabled={saving} variant="soft"
          onClick={() => void submit(choice)}>{choice}</Button>)}
      </div> : <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void submit(answer) }}>
        <TextField.Root aria-label="拼写答案" value={answer} onChange={(event) => setAnswer(event.target.value)}
          autoComplete="off" autoCapitalize="none" />
        <Button type="submit" disabled={saving || !answer.trim()}>提交答案</Button>
      </form>}
    </> : <p>本轮已完成。</p>}
    <Feedback text={feedback} />
  </StickerCard>
}

function LocalImage({ blob, alt }: { blob: Blob; alt: string }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (!image.current) return
    const url = URL.createObjectURL(blob)
    image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt={alt} className="mx-auto max-h-72 max-w-full object-contain" />
}

function assignmentKey(question: OfflineMathQuestion, day: string) {
  return question.assignment ? planAssignmentId(question.assignment, day) : question.id
}

function MathQuestion({ question, change, day, planId }: Omit<Props, 'state'> & {
  question: OfflineMathQuestion; day: string; planId: string
}) {
  const [answers, setAnswers] = useState<string[]>([])
  const [analysis, setAnalysis] = useState(false)
  const { record, saving, feedback } = useRecording(change)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (question.questions.some((_, index) => !answers[index]?.trim())) return
    const correct = question.questions.every((part, index) => Number(answers[index]) === part.answer)
    const key = assignmentKey(question, day)
    void record((current) => {
      const completed = current.math?.day === day ? current.math.completed : []
      if (current.pack?.day !== day || completed.includes(key)) throw new Error('练习进度已更新。')
      return {
        ...current,
        math: { day, completed: correct ? [...completed, key] : completed },
        queue: [...current.queue, {
          kind: 'math', id: crypto.randomUUID(), day, planId,
          questionId: question.id, assignment: question.assignment, section: question.section,
          answer: answers.join('|'), correct,
        }],
      }
    }, correct ? '答对了，已保存在本机。' : '再想一想，这次答题已保存。')
  }

  return <form className="flex flex-col gap-3" onSubmit={submit}>
    <h2 className="text-lg font-bold">{question.title}</h2>
    <div className="whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeProblemText(question.text) }} />
    {question.images.map((blob, index) => <LocalImage key={index} blob={blob} alt="题目插图" />)}
    {question.questions.map((part, index) => <label className="grid gap-1" key={index}>
      {part.label || '第 ' + (index + 1) + ' 问'}
      <TextField.Root value={answers[index] ?? ''} inputMode="decimal"
        onChange={(event) => setAnswers((previous) => question.questions.map((_, position) =>
          index === position ? event.target.value : previous[position] ?? ''))} />
    </label>)}
    <Feedback text={feedback} />
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={saving}>提交答案</Button>
      {feedback && <Button type="button" variant="soft" onClick={() => setAnalysis((previous) => !previous)}>
        {analysis ? '收起题解' : '查看题解'}
      </Button>}
    </div>
    {analysis && <div className="grid gap-2">
      {question.analysis.map((line, index) => <div key={index}
        dangerouslySetInnerHTML={{ __html: sanitizeProblemText(line) }} />)}
      {question.solutionImage && <LocalImage blob={question.solutionImage} alt="题解插图" />}
    </div>}
  </form>
}

export function MathPractice({ state, change }: Props) {
  const pack = state.pack
  if (!pack?.math) return null
  const completed = state.math?.day === pack.day ? state.math.completed : []
  const question = pack.math.questions.find((item) => !completed.includes(assignmentKey(item, pack.day)))
  return <StickerCard>
    {question ? <MathQuestion key={assignmentKey(question, pack.day)} question={question}
      day={pack.day} planId={pack.math.planId} change={change} /> : <p>本机可做的数学题已完成。</p>}
  </StickerCard>
}

export function TreePractice({ state, change }: Props) {
  const [clock, setClock] = useState(Date.now)
  const { record, saving, feedback } = useRecording(change)
  const tree = state.pack?.tree
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  if (!tree) return null
  const today = dayOf(new Date(clock))
  return <>
    {!tree.tasks.length && <StickerCard>这份学习单没有作业。</StickerCard>}
    {tree.tasks.map((task) => {
      const saved = state.tasks[task.id]
      const startedAt = saved?.startedAt ?? task.start
      const seconds = startedAt ? Math.max(0, Math.floor((clock - Date.parse(startedAt)) / 1_000)) : 0
      const canRecord = task.canComplete && task.proof && task.planned === today
      return <StickerCard key={task.id} className="grid gap-2">
        <h2 className="font-bold">{task.name}</h2>
        {task.notes && <p className="whitespace-pre-line text-sm">{task.notes}</p>}
        <p className="text-text-secondary text-sm">{task.completed ? '已完成' : saved?.end ? '已完成 · 待结算' :
          canRecord && startedAt ? Math.floor(seconds / 60) + ' 分 ' + seconds % 60 + ' 秒' :
            canRecord ? '计划 ' + task.minutes + ' 分钟' : '完成需联网'}</p>
        {canRecord && !task.completed && !saved?.end &&
          <Button className="justify-self-start" disabled={saving} onClick={() => void record((current) => {
            if (current.tasks[task.id]?.end) return current
            const start = current.tasks[task.id]?.startedAt ?? task.start
            if (!start) {
              const running = current.pack?.tree?.tasks.some((item) => !item.completed && item.id !== task.id &&
                (item.start || current.tasks[item.id]?.startedAt) && !current.tasks[item.id]?.end)
              if (running) throw new Error('请先完成正在计时的作业。')
              return { ...current, tasks: { ...current.tasks, [task.id]: { startedAt: new Date().toISOString() } } }
            }
            const end = new Date().toISOString()
            if (dayOf(end) !== task.planned) throw new Error('作业已跨日，请联网后继续。')
            return { ...current, tasks: { ...current.tasks, [task.id]: { startedAt: start, end } },
              queue: [...current.queue, { kind: 'tree', id: crypto.randomUUID(), stepId: task.id,
                day: task.planned, revision: tree.revision, start, end, proof: task.proof! }] }
          }, '')}>{startedAt ? '做完了' : '开始计时'}</Button>}
      </StickerCard>
    })}
    <Feedback text={feedback} />
  </>
}
