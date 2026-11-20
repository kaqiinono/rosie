'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { describeSchedule, useHomeworkData } from '@rosie/tasks'
import { previewPractice } from '@/lib/time-tree/practicePreview'
import { AppDialog, LoadingOverlay, Moon, StickerCard, StatTile, Timer, X, type StatTileTone } from '@rosie/ui'
import { Avatar, Badge, Button, Flex, Grid, Heading, IconButton, Text, TextField } from '@rosie/ui/themes'
import { flowerQuestionProgress, weeklyHomeworkStart } from '@/lib/time-tree/flowers'
import { cycleAvailableFrom, cycleHomeworkProgress, homeworkCycleKey, isClosedHomeworkCycle } from '@/lib/time-tree/cycleHomework'
import { homeworkTomatoProgress } from '@/lib/time-tree/rewards'
import {
  clock,
  dayOf,
  elapsed,
  isInstantHomework,
  isMustDo,
  shift,
  timing,
  type TreeData,
  type WorkStep,
  type TreeAction,
} from '@/lib/time-tree/types'
import { SUBJECTS, type SubjectKey } from '@/components/tree-demo/garden/model'
import BubbleTaskIcon from '@/components/tree-demo/garden/BubbleTaskIcon'
import { kidNote, kidReward, kidTime } from './kidStepCopy'
import { HomeworkNotesDialog } from './HomeworkNotesDialog'
import FlowerCollection from './FlowerCollection'
import HomeworkContentPanel from './HomeworkContentPanel'
import HomeworkTomatoTimer from './HomeworkTomatoTimer'
import { hasWeeklyPlanPractice } from './weeklyPlanPractice'
import styles from './StepPanel.module.css'
import { finishAndPop } from './finishStep'
import type { TreeController } from './useTimeTree'

const EmbeddedCalcStartPanel = dynamic(() => import('@rosie/calc/components/EmbeddedCalcStartPanel'), {
  loading: () => <Flex position="relative" minHeight="256px"><LoadingOverlay visible placement="content" /></Flex>,
})

const SUBJECT_BADGE: Record<SubjectKey, 'red' | 'amber' | 'blue' | 'green'> = {
  chinese: 'red',
  math: 'amber',
  english: 'blue',
  life: 'green',
}

const MONTH_DAY = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric' })

export function TreeWait({ api }: { api: TreeController }) {
  if (api.isLoading) return <LoadingOverlay visible placement="content" />
  if (!api.user) {
    return (
      <Flex flexGrow="1" minHeight="50dvh" align="center" justify="center" p="4">
        <Text>请先登录。</Text>
      </Flex>
    )
  }
  return (
    <Flex flexGrow="1" minHeight="50dvh" align="center" justify="center" p="4">
      <StickerCard tone="danger" size="lg" elevation="lg" className="w-full max-w-sm" role="alert">
        <Flex direction="column" align="center" gap="3">
          <Text size="5" weight="bold" align="center">
            生命树读取失败
          </Text>
          {api.message ? (
            <Text size="3" color="gray" align="center">
              {api.message}
            </Text>
          ) : null}
          <Button loading={api.busy} onClick={api.retry}>
            重试
          </Button>
        </Flex>
      </StickerCard>
    </Flex>
  )
}

export function StepPanel({
  api,
  step,
  close,
  select,
  onFinished,
  onFinishBubble,
  homework = false,
}: {
  api: TreeController
  step: WorkStep
  close: () => void
  select: (id: string) => void
  onFinished: (step: WorkStep, tree: TreeData, bloom: boolean) => void
  onFinishBubble?: (step: WorkStep) => void
  homework?: boolean
}) {
  const tree = api.tree!
  const homeworkData = useHomeworkData()
  const template = homeworkData.data.find(item => item.id === step.occurrence.split('/')[0])
  const content = useMemo(() => step.practice ?? previewPractice(tree, step, template), [tree, step, template])
  const weeklyPlan = hasWeeklyPlanPractice(content)
  const [localNow, setNow] = useState(Date.now)
  const now = localNow + api.clockOffsetMs
  const [editingNote, setEditingNote] = useState(false)
  const [move, setMove] = useState(false)
  const [manual, setManual] = useState(false)
  const [pin, setPin] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [start, setStart] = useState(step.start ? dayOf(step.start) + 'T' + clock(step.start) : '')
  const [end, setEnd] = useState('')
  const mounted = useRef(true)
  const finishingRef = useRef(false)
  const running = tree.steps.find((s) => s.start && !s.end)
  const finishBlocked = api.busy && api.startingStepId !== step.id
  const cycle = homeworkCycleKey(step)
  const overdue = !cycle && !!step.planned && step.planned < tree.today
  const canMoveNext = !cycle || shift(step.planned && step.planned > tree.today ? step.planned : tree.today, 1) <= step.deadline
  const instant = !step.start && isInstantHomework(step)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!step.start || step.end) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [step.start, step.end])
  async function finishNow() {
    if (finishBlocked || finishingRef.current) return
    if (onFinishBubble && step.slot !== null) {
      onFinishBubble(step)
      return
    }
    finishingRef.current = true
    setFinishing(true)
    const outcome = await finishAndPop(api.run, step)
    finishingRef.current = false
    if (!outcome.ok) {
      if (mounted.current) setFinishing(false)
      return
    }
    onFinished(outcome.step, outcome.tree, outcome.bloom)
    if (mounted.current) close()
  }
  async function stopNow() {
    if (!step.start || step.end || finishBlocked || finishingRef.current) return
    finishingRef.current = true
    setStopping(true)
    try {
      const result = await api.run({ kind: 'stop', id: step.id, start: step.start })
      if (result && mounted.current) close()
    } finally {
      finishingRef.current = false
      if (mounted.current) setStopping(false)
    }
  }
  async function submit(action: TreeAction) {
    if (action.kind === 'finish') {
      await finishNow()
      return
    }
    if (api.busy) return
    if (action.kind === 'move' || action.kind === 'nextDay') {
      void api.run({ ...action, id: step.id })
      close()
      return
    }
    const result = await api.run({ ...action, id: step.id })
    if (!result) return
    if ((instant && action.kind === 'pop') || action.kind === 'completeUntimed' || action.kind === 'record') {
      const saved = result.steps.find(item => item.id === step.id)
      if (saved?.end) {
        onFinished(saved, result, action.kind === 'pop' && step.slot !== null)
      }
    }
    if (mounted.current && action.kind !== 'start') close()
  }
  async function collect(selection: NonNullable<TreeAction['flowerSelection']>) {
    if (api.busy || finishingRef.current) return
    finishingRef.current = true
    setFinishing(true)
    try {
      const result = await api.run({ kind: 'collectFlowers', id: step.id, flowerSelection: selection })
      const saved = result?.steps.find(item => item.id === step.id)
      if (result && saved?.end && mounted.current) {
        onFinished(saved, result, step.slot !== null)
        close()
      }
    } finally {
      finishingRef.current = false
      if (mounted.current) setFinishing(false)
    }
  }
  const weekStart = weeklyHomeworkStart(step)
  if (editingNote) {
    return <HomeworkNotesDialog step={step} api={api} close={() => setEditingNote(false)} />
  }
  const waitingForTomorrow = !!step.flowers?.availableFrom && step.flowers.availableFrom > tree.today
  const awaitingPractice = step.practice === undefined && !!step.practiceEntryName && !content && homeworkData.isLoading
  const href = content?.href
  const calcLink = href === '/calc' || (!!href && href.split('?')[0] === '/calc/session' &&
    new URLSearchParams(href.split('?')[1]).get('mode') === 'daily')
  // Older daily calc tasks may have only the homework name and no practice binding.
  const namedCalc = step.name.trim() === '每日口算' && !content && !step.practiceEntryName && !template?.practice_binding
  const dailyCalc = !instant && step.subject === 'math' && !step.end && !step.skipped && (calcLink || namedCalc)
  const calcDisabled = !step.planned || waitingForTomorrow || api.busy || finishing || !!(running && running.id !== step.id)
  async function startCalc() {
    if (calcDisabled) return false
    if (step.start) return true
    const result = await api.run({ kind: 'start', id: step.id })
    const saved = result?.steps.find(item => item.id === step.id)
    return mounted.current && !!saved?.start && !saved.end && !saved.skipped
  }
  const homeworkContent = dailyCalc
    ? !manual && <EmbeddedCalcStartPanel taskId={step.id} disabled={calcDisabled} beforeStart={startCalc} />
    : step.practice || (step.practice === undefined && step.practiceEntryName && !step.end && !step.skipped)
      ? <PracticePreviewPanel api={api} tree={tree} step={step} homework={homeworkData} template={template} content={content}
          compact={!!step.flowers && !homework}
          onCorrect={step.flowers && step.start && !step.end
            ? async problemId => { await api.run({ kind: 'answerHomeworkQuestion', id: step.id, problemId }) } : undefined} />
      : null
  const noteButton = (
    <Button variant="soft" disabled={api.busy} onClick={() => setEditingNote(true)}>备注</Button>
  )
  const showCompletionFooter = step.subject !== 'life' && !step.skipped &&
    ((!step.end && !!step.start) || finishing) && !manual
  const stopButton = step.start && !step.end && (
    <Button size="3" variant="soft" color="gray" disabled={finishBlocked || finishing} loading={stopping}
      onClick={() => void stopNow()}>
      停止
    </Button>
  )
  const flowerReadOnly = !!step.end || !!step.skipped || waitingForTomorrow
  const completionFooter = step.flowers && !manual ? (
    <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <Flex direction="column" gap="2" pt="3" className="border-t-2 border-kid-line">
        {step.start && !step.end && <Text size="2" color="gray">{kidTime(step, now)}</Text>}
        <FlowerCollection step={step} now={now}
          busy={api.busy || finishing} readOnly={flowerReadOnly || awaitingPractice}
          questions={flowerQuestionProgress(step, content)} save={collect} />
        {stopButton && <Flex justify="end">{stopButton}</Flex>}
        {waitingForTomorrow && <Text size="2" align="center">今天已收工，明天继续</Text>}
        {api.message && <Text color="red" role="alert">{api.message}</Text>}
      </Flex>
    </div>
  ) : showCompletionFooter ? (
    <Flex direction="column" gap="2" px="4" pb="4" pt="3"
      className="border-t-2 border-kid-line bg-kid-paper"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
      <Text size="3" weight="bold" align="center" className="tabular-nums">
        {finishing ? '正在开花…' : kidTime(step, now)}
      </Text>
      <Flex gap="2" wrap="wrap" justify="center">
        <Button size="3" color="green" disabled={finishBlocked || finishing || stopping} loading={finishing} onClick={() => void finishNow()}>
          {step.slot !== null ? '🫧 做完啦，戳破它！' : '🌸 做完啦！'}
        </Button>
        {stopButton}
      </Flex>
      {api.message && <Text color="red" align="center" size="2" role="alert">{api.message}</Text>}
    </Flex>
  ) : undefined
  const taskIcon = <BubbleTaskIcon subject={step.subject} crown={step.crown} />
  const cycleClosed = isClosedHomeworkCycle(step, tree.today)
  const cycleNext = cycle ? cycleAvailableFrom(step) : null
  if (cycle && cycleNext && !step.start && !step.end && !step.skipped && (cycleClosed || cycleNext > tree.today)) {
    const progress = cycleHomeworkProgress(tree.steps).get(cycle)
    const status = cycleClosed ? '这个周期已结束。' : cycleNext > step.deadline
      ? '今天已收工，本周期即将结束。' : `下次 ${cycleNext.slice(5).replace('-', '/')} 可做。`
    return (
      <AppDialog open title={step.name} icon={taskIcon} onOpenChange={open => { if (!open) close() }}>
        <Flex direction="column" gap="3">
          {progress && <Text>本周期已完成 {progress.done}/{progress.total} 次</Text>}
          <Text>{status}</Text>
          {step.notes && <Text>{step.notes}</Text>}
          {step.planNote && <Text>本次备注：{step.planNote}</Text>}
          <Button onClick={close}>知道了</Button>
        </Flex>
      </AppDialog>
    )
  }
  if (step.subject === 'life') {
    return (
      <AppDialog open title={step.name} icon={taskIcon} onOpenChange={open => { if (!open) close() }}>
        <Flex direction="column" gap="3">
          {step.notes && <Text>{step.notes}</Text>}
          {step.planNote && <Text>本次备注：{step.planNote}</Text>}
          {step.end ? (
            <>
              <Text>已戳破 · {dayOf(step.end)}</Text>
              <Text>🌸 {step.stages.length}　☀️ +{step.sun}　💧 +{step.water}</Text>
              <Button onClick={close}>知道了</Button>
            </>
          ) : step.skipped ? <Text>今天不用做</Text> : (
            <>
              <Text>{step.crown ? '自定义 · 0 分钟 · 今天有效，点一下就完成。' : '今天有效，点一下就完成。明天会有新的泡泡。'}</Text>
              <Button loading={api.busy} onClick={() => void submit({ kind: 'pop' })}>🌼 戳破泡泡</Button>
              {noteButton}
            </>
          )}
          {api.message && <Text color="red" role="alert">{api.message}</Text>}
        </Flex>
      </AppDialog>
    )
  }
  const scheduleSummary = weekStart
    ? `${MONTH_DAY.format(new Date(weekStart))} – ${MONTH_DAY.format(new Date(step.deadline))} · 周目标 ${step.minutes} 分钟`
    : template
      ? `${step.end || step.skipped ? '当前安排 · ' : ''}${describeSchedule(template, { compact: true, weeklyGroups: template.cycle === 'weekly' })} · ${template.cycle === 'weekly' ? '周目标' : '每次'} ${template.estimated_minutes} 分钟`
      : null
  if (!homework) {
    const subjectIcon = <Avatar size="5" radius="large" color={SUBJECT_BADGE[step.subject]} fallback={taskIcon} className="shrink-0" aria-hidden="true" />
    const note = kidNote(step)
    const reward = step.flowers ? null : kidReward(tree, step, now)
    const later = !!step.planned && step.planned > tree.today
    const other = running && running.id !== step.id ? running : null
    const spent = step.start ? Math.max(0, Math.floor((now - Date.parse(step.start)) / 60000)) : 0
    const left = step.minutes - spent
    let timeLabel = '预计'
    let timeValue: string | number = step.minutes
    let timeUnit: string | undefined = '分钟'
    let timeTone: StatTileTone = 'white'
    if (step.skipped) {
      timeLabel = '本次'
      timeValue = '休息'
      timeUnit = undefined
    } else if (step.end) {
      timeTone = 'success'
      if (step.start) {
        timeLabel = '实际'
        timeValue = elapsed(step.start, step.end)
      } else {
        timeLabel = '完成'
        timeValue = '✓'
        timeUnit = undefined
      }
    } else if (step.start) {
      if (weekStart) {
        timeLabel = '已做'
        timeValue = spent
      } else if (left >= 0) {
        timeLabel = '还剩'
        timeValue = left
        timeTone = 'accent'
      } else {
        timeLabel = '超时'
        timeValue = -left
        timeTone = 'warning'
      }
    } else if (overdue) {
      timeTone = 'warning'
    }
    const showStepTime = timeLabel !== '预计' || !weekStart && template?.estimated_minutes !== step.minutes
    const tomato = !step.end && !step.skipped && step.minutes > 0 ? homeworkTomatoProgress(step, now) : null
    return (
      <AppDialog
        open
        title={step.name}
        description={tomato ? `番茄钟共 ${tomato.rounds} 轮，随作业计时。` : undefined}
        size={weeklyPlan ? 'preview' : step.flowers ? 'form' : 'standard'}
        chrome="none"
        presentation="bottom-drawer"
        compactBottomDrawer={!weeklyPlan}
        centerBottomDrawerOnDesktop
        bottomDrawerCompanion={tomato ? <HomeworkTomatoTimer progress={tomato} /> : undefined}
        onOpenChange={(v) => {
          if (!v) close()
        }}
        closeDisabled={finishing || stopping}
        footer={completionFooter}
      >
        <Flex direction="column" gap={step.flowers ? { initial: '3', xs: '4' } : '3'}
          className={step.flowers ? 'p-4 sm:px-6 sm:pt-6' : 'p-4'}>
          {tomato && <span className="sr-only" role="status">
            {tomato.justRipened ? '种熟 1 颗' : tomato.completed === tomato.rounds ? '番茄都熟啦' : `第 ${tomato.round} / ${tomato.rounds} 轮`}
          </span>}
          {step.flowers ? (
            <Flex align="center" gap={{ initial: '2', sm: '3' }}>
              {subjectIcon}
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
                <Flex align="center" gap="2" wrap="wrap" minWidth="0">
                  <Heading as="h2" size={{ initial: '4', xs: '5' }} className="max-w-full break-words">{step.name}</Heading>
                  <Badge variant="soft" radius="full" aria-label={`优先级 ${step.priority}`} color={isMustDo(step.priority) ? 'pink' : 'gray'}>
                    {step.priority}
                  </Badge>
                </Flex>
                {(step.planned || showStepTime) && (
                  <Text as="p" size={{ initial: '2', xs: '3' }} weight="bold"
                    className="w-full text-text-secondary tabular-nums min-[520px]:w-auto sm:border-l-2 sm:border-kid-line sm:pl-4">
                    {step.planned && MONTH_DAY.format(new Date(step.planned))}
                    {step.planned && showStepTime && ' · '}
                    {showStepTime && <>{timeLabel !== '预计' && `${timeLabel} `}{timeValue}{timeUnit && ` ${timeUnit}`}</>}
                  </Text>
                )}
                {scheduleSummary && <Text as="p" size="2" color="gray" className="w-full">{scheduleSummary}</Text>}
              </div>
              <IconButton variant="soft" color="gray" className="shrink-0"
                aria-label={step.start && !step.end ? '收起，继续计时' : '关闭'} disabled={finishing || stopping} onClick={close}>
                <X size={18} aria-hidden="true" />
              </IconButton>
            </Flex>
          ) : (
          <div className={styles.taskHeader} data-rewards={reward ? true : undefined}>
            <div className={styles.taskIcon}>{subjectIcon}</div>
            <Flex direction="column" gap="1" className={styles.taskDetails}>
              <Flex align="center" gap="2" wrap="wrap" minWidth="0">
                <Heading as="h2" size="5" className="wrap-anywhere max-w-full">{step.name}</Heading>
                <Badge variant="soft" radius="full" aria-label={`优先级 ${step.priority}`} color={isMustDo(step.priority) ? 'pink' : 'gray'}>
                  {step.priority}
                </Badge>
              </Flex>
              {scheduleSummary && <Text size="2" color="gray">{scheduleSummary}</Text>}
              {step.end && <Text size="2" color="gray">{kidTime(step, now)}</Text>}
            </Flex>
            {reward && (
              <Flex align="center" gap="1" wrap="nowrap" className={styles.taskRewards}>
                <Badge size={{ initial: '1', xs: '3' }} variant="soft" radius="full" color="pink" className="tabular-nums"
                  aria-label={`${step.end ? '已获得' : '预计获得'} ${reward.flowers} 朵花`}>
                  <span aria-hidden="true">🌸</span> {reward.flowers}
                </Badge>
                <Badge size={{ initial: '1', xs: '3' }} variant="soft" radius="full" color="amber" className="tabular-nums"
                  aria-label={`${step.end ? '已获得' : '预计获得'} ${reward.sun} 阳光`}>
                  <span aria-hidden="true">☀️</span> {reward.sun}
                </Badge>
                <Badge size={{ initial: '1', xs: '3' }} variant="soft" radius="full" color="blue" className="tabular-nums"
                  aria-label={`${step.end ? '已获得' : '预计获得'} ${reward.water} 水滴`}>
                  <span aria-hidden="true">💧</span> {reward.water}
                </Badge>
              </Flex>
            )}
            <Flex align="center" gap="2" className={styles.taskTiming}>
              <StatTile
                size="sm"
                tone={timeTone}
                label={timeLabel === '预计' ? null : timeLabel}
                value={timeValue}
                unit={timeUnit}
                hint={step.planned ? <span className="tabular-nums">📅 {step.planned}</span> : undefined}
                className={styles.taskDuration}
              />
              <IconButton variant="soft" color="gray" aria-label={step.start && !step.end ? '收起，继续计时' : '关闭'} disabled={finishing || stopping} onClick={close}>
                <span aria-hidden="true">×</span>
              </IconButton>
            </Flex>
          </div>
          )}
          {note && (
            <StickerCard tone="paper" size="sm" elevation="flat" radius="md" className="w-full">
              <Text className="whitespace-pre-wrap break-words" size="3">
                {note}
              </Text>
            </StickerCard>
          )}
          {homeworkContent}
          <Flex direction="column" align="center" gap="2">
            {step.skipped || (step.end && !finishing) ? (
              <Button size="3" color="pink" onClick={close}>
                {step.skipped ? '👋 下次再来' : '🎉 太好啦'}
              </Button>
            ) : step.start || finishing ? null : instant ? (
              <Button size="3" color="green" disabled={!step.planned || api.busy} loading={api.busy}
                onClick={() => void submit({ kind: 'pop' })}>
                🌼 戳破泡泡
              </Button>
            ) : other ? (
              <Button size="3" color="amber" onClick={() => select(other.id)}>
                👉 先回去做完那个
              </Button>
            ) : (
              <Flex gap="2" wrap="wrap" justify="center">
                {!dailyCalc && !awaitingPractice && step.planned && !waitingForTomorrow && (
                  <Button
                    size="3"
                    variant={step.flowers ? 'soft' : 'solid'}
                    color={step.flowers ? 'violet' : 'pink'}
                    loading={api.busy}
                    onClick={() => void submit({ kind: 'start' })}
                  >
                    {step.flowers ? (
                      <><Timer size={18} aria-hidden="true" />{overdue ? '开始补做' : later ? '提前做' : '开始计时'}</>
                    ) : overdue ? '🌟 开始补做' : later ? '🌟 提前做' : '🌟 开始吧！'}
                  </Button>
                )}
                <Button
                  size="3"
                  variant="soft"
                  color="violet"
                  disabled={api.busy || !canMoveNext}
                  onClick={() => void submit(overdue ? { kind: 'move', day: tree.today } : { kind: 'nextDay' })}
                >
                  {step.flowers && !overdue
                    ? <><Moon size={18} aria-hidden="true" className="fill-amber-400 text-amber-600" />挪到下一天</>
                    : overdue ? '☀️ 挪到今天' : '🌙 挪到下一天'}
                </Button>
              </Flex>
            )}
          </Flex>
          {api.message && !completionFooter && (
            <Text color="red" align="center" role="alert">
              {api.message}
            </Text>
          )}
        </Flex>
      </AppDialog>
    )
  }
  return (
    <AppDialog
      open
      title={step.name}
      icon={SUBJECTS[step.subject].emoji}
      presentation={weeklyPlan ? 'bottom-drawer' : 'dialog'}
      onOpenChange={(v) => {
        if (!v) close()
      }}
      description={`${SUBJECTS[step.subject].label} · ${(weekStart || template?.estimated_minutes === step.minutes) && scheduleSummary
        ? scheduleSummary : `预计 ${step.minutes} 分钟`}`}
      closeDisabled={finishing || stopping}
      footer={completionFooter}
    >
      <Flex direction="column" gap="3">
        {scheduleSummary && !weekStart && template?.estimated_minutes !== step.minutes && <Text size="2" color="gray">{scheduleSummary}</Text>}
        {step.notes && <Text>{step.notes}</Text>}
        {step.planNote && (
          <Text className="whitespace-pre-wrap break-words"><strong>本次备注</strong>　{step.planNote}</Text>
        )}
        <Text size="2">
          计划 {step.planned ?? '未排期'} · 原排期 {step.scheduled} · 截止 {step.deadline}
        </Text>
        {homeworkContent}
        {step.start && (
          <Text>
            开始 {dayOf(step.start)} {clock(step.start)}
          </Text>
        )}
        {step.skipped ? (
          <Text>本次作业不用做</Text>
        ) : step.end && !finishing ? (
          <>
            <Text>
              完成 {dayOf(step.end)}{' '}
              {step.start && `${clock(step.end)} · 实际 ${elapsed(step.start, step.end)} 分钟 · `}
              {timing(step)}
            </Text>
            <Text>
              🌸 {step.stages.length}　☀️ +{step.sun}　💧 +{step.water}
              {step.audit.length > 0 && ' · 家长补录'}
            </Text>
            {step.tomatoes && <Text weight="bold">🍅 收获 {step.tomatoes} 颗番茄</Text>}
            {dayOf(step.end) > step.deadline && <Text>晚于作业截止日完成</Text>}
            <Button onClick={close}>知道了</Button>
          </>
        ) : manual ? (
          <>
            <label>
              实际开始（北京时间）
              <TextField.Root
                type="datetime-local"
                step="1"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              实际结束（北京时间）
              <TextField.Root
                type="datetime-local"
                step="1"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <label>
              家长密码
              <TextField.Root
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </label>
            <Button
              disabled={!start || !end || pin.length !== 6}
              loading={api.busy}
              onClick={() =>
                void submit({
                  kind: 'record',
                  start: start + '+08:00',
                  end: end + '+08:00',
                  pin,
                })
              }
            >
              保存实际时间
            </Button>
          </>
        ) : step.start || finishing ? null : (
          <>
            {instant ? null : running ? (
              <Button onClick={() => select(running.id)}>返回正在做的作业</Button>
            ) : dailyCalc || awaitingPractice ? null : (
              <Button
                disabled={!step.planned || waitingForTomorrow}
                loading={api.busy}
                onClick={() => void submit({ kind: 'start' })}
              >
                {overdue ? '开始补做' : step.planned && step.planned > tree.today ? '提前做' : '开始做'}
              </Button>
            )}
            <Grid columns="2" gap="2">
              {!step.flowers && <Button
                variant="soft"
                color="green"
                disabled={api.busy || (instant && !step.planned)}
                onClick={() => void submit({ kind: instant ? 'pop' : 'completeUntimed' })}
              >
                {instant ? '戳破泡泡' : '直接完成'}
              </Button>}
              <Button
                variant="soft"
                color="gray"
                disabled={api.busy}
                onClick={() => void submit({ kind: 'skip' })}
              >
                不用做
              </Button>
              <Button variant="soft" disabled={api.busy} onClick={() => setMove(!move)}>
                改日期
              </Button>
              <Button variant="soft" disabled={api.busy || !canMoveNext} onClick={() => void submit(overdue ? { kind: 'move', day: tree.today } : { kind: 'nextDay' })}>
                {overdue ? '挪到今天' : '挪到下一天'}
              </Button>
              {noteButton}
            </Grid>
            {move && (
              <Flex gap="2" wrap="wrap">
                {Array.from({ length: 7 }, (_, i) => shift(tree.today, i)).filter(day => !cycle || (day >= step.scheduled && day <= step.deadline)).map((day) => (
                  <Button
                    key={day}
                    disabled={api.busy}
                    variant="soft"
                    onClick={() => void submit({ kind: 'move', day })}
                  >
                    {day.slice(5)}
                  </Button>
                ))}
              </Flex>
            )}
          </>
        )}
        {(step.skipped || step.end || step.start) && !manual && !finishing && noteButton}
        {homework && !instant && !manual && !step.skipped && !step.end && !cycleClosed && (
          <Button variant="ghost" onClick={() => setManual(true)}>
            家长补录
          </Button>
        )}
        {api.message && !completionFooter && (
          <Text color="red" role="alert">
            {api.message}
          </Text>
        )}
      </Flex>
    </AppDialog>
  )
}

function PracticePreviewPanel({ api, tree, step, homework, template, content, compact, onCorrect }: {
  api: TreeController
  tree: TreeData
  step: WorkStep
  homework: ReturnType<typeof useHomeworkData>
  template: ReturnType<typeof useHomeworkData>['data'][number] | undefined
  content: WorkStep['practice'] | ReturnType<typeof previewPractice>
  compact: boolean
  onCorrect?: (problemId: string) => Promise<void>
}) {
  if (!content && !homework.isLoading && !homework.error) return null
  const rows = content?.items?.map(item => item.row) ?? (content?.row ? [content.row] : [])
  const mathBatch = step.subject === 'math' && rows.length > 0 && rows.every(row => row.values.problemId)
  const editable = mathBatch && !step.flowers && !step.end && !step.skipped && !!step.planned
  const binding = template?.practice_binding
  const completed = step.practice?.questions?.completed ?? (editable ? [] : undefined)
  const recorded = step.flowers ? step.flowers.answered ?? [] : undefined
  const first = binding?.rows.findIndex(row => row.id === rows[0]?.id) ?? -1
  const used = new Set([...rows.map(row => row.id), ...(binding ? tree.mathQuestionProgress?.[binding.key]?.completed ?? [] : [])])
  const canAppend = editable && first >= 0 && binding?.rows.slice(first).some(row => row.values.problemId && !used.has(row.id))
  return <HomeworkContentPanel
    compact={compact}
    activeHomeworkId={step.start && !step.end ? step.id : undefined}
    disabled={api.busy}
    completedRows={mathBatch && recorded ? rows.filter(row => recorded.includes(row.values.problemId)).map(row => row.id) : completed}
    addedRows={step.practice?.questions?.added}
    canAppend={canAppend}
    onEdit={editable ? async (questionEdit, rowId) => {
      await api.run({ kind: 'editMathQuestion', id: step.id, questionEdit, rowId })
    } : undefined}
    onCorrect={onCorrect}
    name={content?.name}
    row={content?.row}
    items={content?.items}
    href={content?.href}
    exhausted={content?.exhausted}
    loading={!content && homework.isLoading}
    error={!content && homework.error ? '暂时无法读取本次内容。' : undefined}
    onRetry={() => void homework.refresh().catch(() => {})}
  />
}
