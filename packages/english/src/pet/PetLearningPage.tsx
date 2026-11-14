'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useAuth, type WordEntry } from '@rosie/core'
import { AppDialog, FormSelect, LoadingOverlay, StatTile, StickerCard } from '@rosie/ui'
import { Badge, Button, Spinner, Switch, Tabs, TextField } from '@rosie/ui/themes'
import { useAdaptiveWordPlan } from '../hooks/useAdaptiveWordPlan'
import { useWordsContext } from '../WordsContext'
import { wordKey } from '../utils/english-helpers'
import { usePetLearning } from './usePetLearning'
import type { PetItem, PetMode, PetSession, PetStartSessionInput } from './types'
import { PET_PRIORITY_LABELS, PET_TOPICS, petTopicLabel } from './topics'
import PetSessionView from './PetSessionView'
import PetWordList from './PetWordList'

function spellingItem(word: WordEntry, listening = false): PetItem {
  return {
    id: `pet-${listening ? 'listening' : 'spelling'}-${word.id}`,
    wordEntryId: word.id,
    kind: listening ? 'listening' : 'spelling',
    prompt: listening ? '听音后填写：______' : `${word.explanation || word.chineseDef || ''}\n______`,
    acceptedAnswerSets: [[word.word]],
    spokenText: listening ? word.word : undefined,
  }
}

function skillResults(sessions: PetSession[]) {
  const result: Record<string, { correct: number; total: number }> = {}
  for (const session of sessions) {
    for (const item of session.items) {
      const answer = session.answers[item.id]
      if (!answer?.firstAnswers || answer.skippedAudio) continue
      const key = session.mode === 'review' ? 'review' : item.kind
      const keys = session.mode === 'exam' ? [key, item.options?.length ? 'part5' : 'part6'] : [key]
      for (const metric of keys) {
        const current = result[metric] ?? { correct: 0, total: 0 }
        current.total += 1
        if (answer.firstCorrect && !answer.usedHelp) current.correct += 1
        result[metric] = current
      }
    }
  }
  return result
}

export default function PetLearningPage() {
  const { user } = useAuth()
  return user ? <PetLearningContent key={user.id} user={user} /> : (
    <div className="relative min-h-[calc(100dvh-9rem)]"><LoadingOverlay visible placement="content" /></div>
  )
}

function PetLearningContent({ user }: { user: User }) {
  const router = useRouter()
  const learning = usePetLearning(user)
  const adaptive = useAdaptiveWordPlan(user)
  const { masteryMap } = useWordsContext()
  const [topic, setTopic] = useState('')
  const [priority, setPriority] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('daily')
  const [assessment, setAssessment] = useState(false)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [wrongOnly, setWrongOnly] = useState(false)
  const [showSession, setShowSession] = useState(true)
  const [finishedSession, setFinishedSession] = useState<PetSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [endOpen, setEndOpen] = useState(false)
  const [resultsTrack, setResultsTrack] = useState('daily')
  const pendingStart = useRef<{ fingerprint: string; id: string } | null>(null)
  const viewedSessionId = useRef<string | null>(null)

  const { words, contentByWordId, exerciseSets, reviewProgress, recentSessions, activeSession } = learning
  const filteredWords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return words.filter((word) => {
      const content = word.id ? contentByWordId[word.id] : undefined
      return (!topic || content?.topics.includes(topic)) &&
        (!priority || content?.priorities.includes(priority)) &&
        (!query || `${word.word} ${word.chineseDef ?? ''}`.toLocaleLowerCase().includes(query))
    })
  }, [words, contentByWordId, topic, priority, search])
  const selectedIds = useMemo(() => new Set(filteredWords.flatMap((word) => word.id ? [word.id] : [])), [filteredWords])
  const lastAttempts = useMemo(() => {
    const byItem = new Map<string, string>()
    for (const session of recentSessions) for (const item of session.items) {
      if (!session.answers[item.id]?.firstAnswers || session.answers[item.id]?.skippedAudio) continue
      const date = session.completedAt ?? session.updatedAt
      if (!byItem.has(item.id)) byItem.set(item.id, date)
    }
    return byItem
  }, [recentSessions])
  const wrongIds = useMemo(() => {
    const latest = new Map<string, boolean>()
    for (const session of recentSessions) for (const item of session.items) {
      const answer = session.answers[item.id]
      if (!latest.has(item.id) && answer?.firstAnswers && !answer.skippedAudio) latest.set(item.id, !answer.firstCorrect || answer.usedHelp)
    }
    return new Set([...latest].filter(([, wrong]) => wrong).map(([id]) => id))
  }, [recentSessions])
  const applicationItems = useMemo(() => exerciseSets.filter((set) => set.kind !== 'exam').flatMap((set) => set.items)
    .filter((item) => item.wordEntryId && selectedIds.has(item.wordEntryId))
    .sort((left, right) => (lastAttempts.get(left.id) ?? '').localeCompare(lastAttempts.get(right.id) ?? '')),
  [exerciseSets, selectedIds, lastAttempts])
  const wrongItems = applicationItems.filter((item) => wrongIds.has(item.id))
  const wrongExamSets = exerciseSets.filter((set) => set.kind === 'exam' && set.items.some((item) =>
    item.wordEntryId && selectedIds.has(item.wordEntryId) && wrongIds.has(item.id)))
  const due = reviewProgress.filter((progress) => progress.dueOn <= learning.today && selectedIds.has(progress.wordEntryId))
    .sort((left, right) => left.dueOn.localeCompare(right.dueOn))
  const stats = useMemo(() => skillResults(recentSessions.filter((session) => session.track === resultsTrack)), [recentSessions, resultsTrack])
  const petPlans = adaptive.plans.filter((plan) => plan.scope.stages?.length === 1 && plan.scope.stages[0] === 'PET')
  const currentPlan = petPlans.find((plan) => plan.status === 'active') ?? petPlans.find((plan) => plan.status === 'paused')
  const canStart = !busy && !activeSession

  const operate = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setOperationError(null)
    setNotice(null)
    try { await work() } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : '操作失败，请重试。')
    } finally { setBusy(false) }
  }

  const start = (input: PetStartSessionInput) => operate(async () => {
    const settings = { track: 'daily' as const, ...input, timerEnabled }
    const fingerprint = JSON.stringify(settings)
    const requestId = pendingStart.current?.fingerprint === fingerprint ? pendingStart.current.id : crypto.randomUUID()
    pendingStart.current = { fingerprint, id: requestId }
    await learning.startSession({ ...settings, requestId })
    pendingStart.current = null
    setFinishedSession(null)
    setShowSession(true)
  })

  const practiceWords = (mode: 'spelling' | 'listening') => start({
    mode, feedbackMode: 'training', source: mode === 'listening' ? '听音拼写' : '独立拼写',
    items: filteredWords.filter((word) => word.id).map((word) => spellingItem(word, mode === 'listening'))
      .sort((left, right) => (lastAttempts.get(left.id) ?? '').localeCompare(lastAttempts.get(right.id) ?? '')).slice(0, 5),
  })

  const practiceApplication = (mode: PetMode, items: PetItem[], title: string, specialist = false) => start({
    mode, track: specialist ? 'specialist' : 'daily', feedbackMode: specialist && assessment ? 'assessment' : 'training', source: title, items: items.slice(0, 5),
  })

  const mainline = () => operate(async () => {
    if (currentPlan) {
      router.push(`/english/words/adaptive/${currentPlan.id}${currentPlan.status === 'active' ? '/practice' : ''}`)
      return
    }
    const result = await adaptive.createPlan({
      title: 'PET 每批 5 词', scope: { stages: ['PET'] }, wordKeys: filteredWords.map(wordKey),
      masteryMap, newWordsPerDay: 5,
    })
    if (!result.ok) { setNotice('当前 PET 词汇已完成主线，可以继续跨日复习和专项练习。'); return }
    if (result.status === 'paused') setNotice('PET 计划已建立。已有其他学习计划进行中，可在计划管理中切换。')
    else router.push(`/english/words/adaptive/${result.planId}/practice`)
  })

  if (!learning.ready && learning.loading) return (
    <div className="relative min-h-[calc(100dvh-9rem)]"><LoadingOverlay visible placement="content" /></div>
  )

  if (showSession && activeSession) viewedSessionId.current = activeSession.id
  const visibleSession = activeSession ?? finishedSession ??
    recentSessions.find((session) => session.id === viewedSessionId.current)
  if (showSession && visibleSession) return <PetSessionView
    key={`${user.id}:${visibleSession.id}`} userId={user.id} initial={visibleSession}
    save={learning.saveSession} refresh={learning.refresh} complete={async (session) => {
      const result = await learning.completeSession(session)
      setFinishedSession(result)
      return result
    }} onBack={() => setShowSession(false)}
  />

  return <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Badge color="green">PET / B1 Preliminary</Badge>
        <h1 className="mt-2 text-2xl font-bold">每天积累，也能放进句子里用</h1>
        <p className="mt-2 text-sm text-[var(--wm-text-dim)]">主线学词、跨日复习和专项应用分别记录，PET 进度独立保存。</p>
      </div>
      <Button asChild variant="soft" color="gray"><Link href="/english/words/practice">单词练习</Link></Button>
    </div>

    {(learning.error || operationError) && <StickerCard tone="accent" role="alert">
      <p>{operationError ?? 'PET 内容或学习记录暂时无法加载，请重试。'}</p>
      <div className="mt-3"><Button loading={busy} onClick={() => void operate(async () => { await learning.refresh() })}>重新加载</Button></div>
    </StickerCard>}
    {learning.loading && learning.ready && <p className="inline-flex items-center gap-2 text-sm"><Spinner />正在更新练习记录</p>}
    {notice && <StickerCard tone="accent" role="status"><p>{notice}</p><div className="mt-3"><Button asChild variant="soft"><Link href="/setting/plans/english">计划管理</Link></Button></div></StickerCard>}

    {activeSession && <StickerCard tone="accent">
      <h2 className="font-bold">继续未完成的一组</h2>
      <p className="mt-1">{activeSession.source}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button onClick={() => setShowSession(true)}>继续练习</Button>
        <Button variant="soft" color="gray" onClick={() => setEndOpen(true)}>结束这一组</Button>
      </div>
      <p className="mt-2 text-sm">先完成或结束当前一组，再开始新练习。</p>
    </StickerCard>}

    {learning.ready && (words.length === 0 ? <StickerCard tone="accent">
      <h2 className="font-bold">PET 词汇尚未发布</h2>
      <p className="mt-2">发布后的词汇与配套练习会出现在这里。现在可以继续已有词库的学习。</p>
    </StickerCard> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile tone="accent" label="PET 词汇" value={words.length} unit="词" />
        <StatTile tone="accent" label="今日待复习" value={reviewProgress.filter((progress) => progress.dueOn <= learning.today).length} unit="词" hint="每次最多 10 词" />
        <StatTile tone="accent" label="跨日复习中的词" value={reviewProgress.length} unit="词" hint="与主线完成分开记录" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FormSelect value={topic} onValueChange={setTopic} ariaLabel="筛选 PET 主题" options={[{ value: '', label: '全部主题' }, ...PET_TOPICS.map(([value, label]) => ({ value, label }))]} />
        <FormSelect value={priority} onValueChange={setPriority} ariaLabel="筛选 PET 学习标签" options={[{ value: '', label: '全部标签' }, ...Object.entries(PET_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))]} />
        <div className="min-w-48 flex-1"><TextField.Root value={search} onChange={(event) => setSearch(event.target.value)} placeholder="查找单词或中文释义" aria-label="查找 PET 单词" /></div>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List>
          <Tabs.Trigger value="daily">日常积累</Tabs.Trigger>
          <Tabs.Trigger value="specialist">PET 专项</Tabs.Trigger>
          <Tabs.Trigger value="words">词汇与来源</Tabs.Trigger>
          <Tabs.Trigger value="results">练习表现</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="daily">
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <StickerCard tone="accent">
              <h2 className="text-lg font-bold">主线学词</h2>
              <p className="my-3 text-sm">认读 → 字母砖 → Boss。新建 PET 计划默认每批 5 个新词，沿用现有学习节奏。</p>
              {!currentPlan && <p className="mb-3 text-sm">新计划将加入当前筛选的 {filteredWords.length} 个词。</p>}
              <Button disabled={!canStart || (!currentPlan && !filteredWords.length) || adaptive.isLoading || Boolean(adaptive.error)} loading={busy} onClick={() => void mainline()}>
                {currentPlan ? currentPlan.status === 'active' ? '继续 PET 主线' : '查看 PET 计划' : '建立 PET 学习计划'}
              </Button>
              {adaptive.error != null && <p role="alert" className="mt-2 text-sm">学习计划加载失败。<Button variant="soft" size="1" onClick={() => void adaptive.reloadPlans()}>重试</Button></p>}
            </StickerCard>
            <StickerCard tone="accent">
              <h2 className="text-lg font-bold">到期再见一面</h2>
              <p className="my-3 text-sm">当前范围有 {due.length} 个到期词。首次独立作答决定下次复习时间，补练不会覆盖首次结果。</p>
              <Button disabled={!canStart || !due.length} loading={busy} onClick={() => {
                const ids = due.slice(0, 10).map((progress) => progress.wordEntryId)
                void start({ mode: 'review', feedbackMode: 'training', source: 'PET 跨日复习', reviewWordIds: ids,
                  items: ids.flatMap((id) => { const word = words.find((candidate) => candidate.id === id); return word ? [spellingItem(word)] : [] }) })
              }}>复习 {Math.min(10, due.length)} 词</Button>
              <div className="mt-3"><Button variant="soft" size="1" disabled={busy} onClick={() => void operate(async () => { await learning.refresh() })}>同步刚完成的主线</Button></div>
            </StickerCard>
            <StickerCard tone="accent" className="md:col-span-2">
              <h2 className="text-lg font-bold">五题小练习</h2>
              <p className="my-3 text-sm">每次最多 5 题，优先练未做过的内容，再复习较久未练的内容。输入拼写与听辨成绩分别记录。</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="soft" disabled={!canStart || !filteredWords.length} onClick={() => void practiceWords('spelling')}>独立拼写</Button>
                <Button variant="soft" disabled={!canStart || !filteredWords.length} onClick={() => void practiceWords('listening')}>听音拼写</Button>
                <Button variant="soft" disabled={!canStart || !applicationItems.some((item) => item.kind === 'context')} onClick={() => void practiceApplication('context', applicationItems.filter((item) => item.kind === 'context'), 'PET 语境五题')}>语境应用</Button>
                <Button variant="soft" disabled={!canStart || !applicationItems.some((item) => item.kind === 'word_form')} onClick={() => void practiceApplication('word_form', applicationItems.filter((item) => item.kind === 'word_form'), 'PET 词形五题')}>词形应用</Button>
              </div>
            </StickerCard>
          </div>
        </Tabs.Content>
        <Tabs.Content value="specialist">
          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-wrap gap-5">
              <label className="inline-flex items-center gap-2 text-sm"><Switch checked={assessment} onCheckedChange={setAssessment} />整组测评</label>
              <label className="inline-flex items-center gap-2 text-sm"><Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />显示计时</label>
              <label className="inline-flex items-center gap-2 text-sm"><Switch checked={wrongOnly} onCheckedChange={setWrongOnly} />只练错题</label>
            </div>
            <p className="text-sm text-[var(--wm-text-dim)]">句子专项来自配套资料；短文专项按 Part 5 / Part 6 形式编写。计时仅供练习参考。</p>
            {wrongOnly ? <StickerCard tone="accent">
              <p>当前范围有 {wrongItems.length} 道待巩固的句子／词形题，以及 {wrongExamSets.length} 组含错题的短文。</p>
              <div className="mt-3 flex flex-wrap gap-3"><Button disabled={!canStart || !wrongItems.length} onClick={() => void practiceApplication('context', wrongItems, 'PET 错题巩固', true)}>练习错题</Button>
                {wrongExamSets.map((set) => <Button key={set.id} variant="soft" disabled={!canStart} onClick={() => void start({ track: 'specialist', mode: 'exam', feedbackMode: assessment ? 'assessment' : 'training', setId: set.id, setRevision: set.revision })}>{set.title}</Button>)}
              </div>
            </StickerCard> : <div className="grid gap-3 sm:grid-cols-2">
              {exerciseSets.filter((set) => (!topic || set.topic === topic || set.items.some((item) => item.wordEntryId && selectedIds.has(item.wordEntryId))) &&
                (!priority && !search.trim() || set.items.some((item) => item.wordEntryId && selectedIds.has(item.wordEntryId))))
                .map((set) => <StickerCard key={set.id} tone="accent">
                  <div className="mb-2 flex flex-wrap gap-2"><Badge color={set.kind === 'exam' ? 'blue' : 'green'}>{set.kind === 'exam' ? set.items.every((item) => item.options?.length) ? 'Part 5 · 选择填空' : 'Part 6 · 开放填空' : set.kind === 'forms' ? '词形应用' : '句子专项'}</Badge>{set.topic && <Badge color="gray">{petTopicLabel(set.topic)}</Badge>}</div>
                  <h2 className="font-bold">{set.title}</h2>
                  <p className="my-3 text-sm">{set.items.length} 题{set.kind === 'exam' ? ' · 共用一篇短文' : ''}</p>
                  <Button variant="soft" disabled={!canStart} onClick={() => void start({ track: 'specialist', mode: set.kind, feedbackMode: assessment ? 'assessment' : 'training', setId: set.id, setRevision: set.revision })}>开始{assessment ? '测评' : '训练'}</Button>
                </StickerCard>)}
            </div>}
            {!exerciseSets.length && <p>这个词库的配套题目尚未发布，可以先做独立拼写。</p>}
          </div>
        </Tabs.Content>
        <Tabs.Content value="words"><div className="mt-5"><PetWordList words={filteredWords} contentByWordId={contentByWordId} /></div></Tabs.Content>
        <Tabs.Content value="results">
          <div className="mt-5"><FormSelect value={resultsTrack} onValueChange={setResultsTrack} ariaLabel="选择练习统计范围" options={[{ value: 'daily', label: '日常积累' }, { value: 'specialist', label: 'PET 专项' }]} /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([['spelling', '独立拼写'], ['listening', '听音拼写'], ['context', '语境应用'], ['word_form', '词形应用']] as const).map(([key, label]) => {
              const result = stats[key]
              return <StatTile key={key} tone="accent" label={label} value={result?.total ? `${Math.round(result.correct / result.total * 100)}%` : '—'} hint={result ? `首次独立答对 ${result.correct} / ${result.total}` : '还没有练习记录'} />
            })}
          </div>
          {resultsTrack === 'daily' ? <p className="mt-3 text-sm">记忆保持：{stats.review?.total ? `跨日复习首次独立答对 ${stats.review.correct} / ${stats.review.total}` : '尚无跨日复习记录'}。</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([['part5', 'Part 5 · 选择填空'], ['part6', 'Part 6 · 开放填空']] as const).map(([key, label]) => {
              const result = stats[key]
              return <StatTile key={key} tone="accent" label={label} value={result?.total ? `${Math.round(result.correct / result.total * 100)}%` : '—'} hint={result ? `首次独立答对 ${result.correct} / ${result.total}` : '还没有练习记录'} />
            })}
          </div>}
          <p className="mt-4 text-sm">这里统计专项首次独立表现；主线进阶在学习计划中查看，记忆保持由跨日复习记录。</p>
          <ul className="mt-4 flex flex-col gap-3">{recentSessions.filter((session) => session.track === resultsTrack).slice(0, 10).map((session) => <li key={session.id}><StickerCard tone="accent" size="sm"><p>{session.source}</p><p className="mt-1 text-sm">{new Date(session.completedAt ?? session.updatedAt).toLocaleString()} · {session.items.length} 题</p></StickerCard></li>)}</ul>
        </Tabs.Content>
      </Tabs.Root>
    </>)}

    <AppDialog open={endOpen} onOpenChange={setEndOpen} title="结束当前练习？" description="保留已保存的作答，本组不推进跨日复习。">
      <div className="flex justify-end gap-3">
        <Button variant="soft" color="gray" onClick={() => setEndOpen(false)}>继续保留</Button>
        <Button loading={busy} onClick={() => void operate(async () => {
          if (activeSession) await learning.abandonSession(activeSession)
          setEndOpen(false)
        })}>结束这一组</Button>
      </div>
    </AppDialog>
  </main>
}
