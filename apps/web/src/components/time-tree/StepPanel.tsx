'use client'

import { useEffect, useRef, useState } from 'react'
import { AppDialog, LoadingOverlay, StickerCard } from '@rosie/ui'
import { Avatar, Badge, Button, Flex, Grid, Heading, IconButton, Text, TextField } from '@rosie/ui/themes'
import {
  clock,
  dayOf,
  elapsed,
  isMustDo,
  shift,
  timing,
  type TreeData,
  type WorkStep,
  type TreeAction,
} from '@/lib/time-tree/types'
import { SUBJECTS, type SubjectKey } from '@/components/tree-demo/garden/model'
import { kidNote, kidReward, kidTime } from './kidStepCopy'
import { HomeworkNotesDialog } from './HomeworkNotesDialog'
import HomeworkContentPanel from './HomeworkContentPanel'
import { finishAndPop } from './finishStep'
import type { TreeController } from './useTimeTree'

const SUBJECT_BADGE: Record<SubjectKey, 'red' | 'amber' | 'blue' | 'green'> = {
  chinese: 'red',
  math: 'amber',
  english: 'blue',
  life: 'green',
}

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
          <Button loading={api.busy} onClick={() => void api.run({ kind: 'sync' })}>
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
  onBeforeFinish,
  homework = false,
}: {
  api: TreeController
  step: WorkStep
  close: () => void
  select: (id: string) => void
  onFinished?: (step: WorkStep, tree: TreeData, bloom: boolean) => void
  /** 记账前记下泡泡中心。记账之后泡泡会从树上消失。 */
  onBeforeFinish?: (step: WorkStep) => void
  homework?: boolean
}) {
  const tree = api.tree!
  const [localNow, setNow] = useState(Date.now)
  const now = localNow + api.clockOffsetMs
  const [editingNote, setEditingNote] = useState(false)
  const [move, setMove] = useState(false)
  const [manual, setManual] = useState(false)
  const [pin, setPin] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [start, setStart] = useState(step.start ? dayOf(step.start) + 'T' + clock(step.start) : '')
  const [end, setEnd] = useState('')
  const mounted = useRef(true)
  const finishingRef = useRef(false)
  const prepareKey = useRef('')
  const [prepareAttempt, setPrepareAttempt] = useState(0)
  const [preparing, setPreparing] = useState(false)
  const [prepareError, setPrepareError] = useState('')
  const running = tree.steps.find((s) => s.start && !s.end)
  const overdue = !!step.planned && step.planned < tree.today
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
  useEffect(() => {
    if (step.subject === 'life' || !step.practiceEntryName || step.practice !== undefined || step.end || step.skipped || !step.planned || api.busy) return
    const requestKey = `${step.id}:${prepareAttempt}`
    if (prepareKey.current === requestKey) return
    prepareKey.current = requestKey
    queueMicrotask(() => {
      if (prepareKey.current !== requestKey) return
      setPreparing(true)
      setPrepareError('')
    })
    void api.run({ kind: 'preparePractice', id: step.id }).then((result) => {
      if (!mounted.current || prepareKey.current !== requestKey) return
      setPreparing(false)
      if (!result) setPrepareError('暂时无法读取本次内容，请重试。')
    })
  }, [step.id, step.subject, step.practiceEntryName, step.practice, step.end, step.skipped, step.planned, tree.today, prepareAttempt, api])
  async function finishNow() {
    if (api.busy || finishingRef.current) return
    finishingRef.current = true
    onBeforeFinish?.(step)
    setFinishing(true)
    const outcome = await finishAndPop(api.run, step)
    finishingRef.current = false
    if (!outcome.ok) {
      if (mounted.current) setFinishing(false)
      return
    }
    onFinished?.(outcome.step, outcome.tree, outcome.bloom)
    if (mounted.current) close()
  }
  async function submit(action: TreeAction) {
    if (action.kind === 'finish') {
      await finishNow()
      return
    }
    const result = await api.run({ ...action, id: step.id })
    if (!result) return
    if (action.kind !== 'start') close()
  }
  if (editingNote) {
    return <HomeworkNotesDialog step={step} api={api} close={() => setEditingNote(false)} />
  }
  const homeworkContent = step.practice || preparing || prepareError ? (
    <HomeworkContentPanel
      name={step.practice?.name}
      row={step.practice?.row}
      items={step.practice?.items}
      href={step.practice?.href}
      exhausted={step.practice?.exhausted}
      loading={!step.practice && preparing}
      error={!step.practice && prepareError ? api.message || prepareError : undefined}
      disabled={api.busy}
      onRetry={() => setPrepareAttempt((n) => n + 1)}
    />
  ) : null
  const noteButton = (
    <Button variant="soft" disabled={api.busy} onClick={() => setEditingNote(true)}>备注</Button>
  )
  const showCompletionFooter = step.subject !== 'life' && !step.skipped &&
    ((!step.end && !!step.start) || finishing) && !manual
  const completionFooter = showCompletionFooter ? (
    <Flex direction="column" gap="2" px="4" pb="4" pt="3"
      className="border-t-2 border-kid-line bg-kid-paper"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
      <Text size="2" weight="bold" align="center" className="tabular-nums">
        {finishing ? '正在开花…' : kidTime(step, now)}
      </Text>
      <Flex gap="2" wrap="wrap" justify="center">
        <Button size="3" color="green" loading={api.busy || finishing} onClick={() => void finishNow()}>
          {step.slot !== null ? '🫧 做完啦，戳破它！' : '🌸 做完啦！'}
        </Button>
        <Button size="3" variant="soft" color="gray" disabled={api.busy || finishing} onClick={close}>
          收起，继续计时
        </Button>
      </Flex>
      {api.message && <Text color="red" align="center" size="2" role="alert">{api.message}</Text>}
    </Flex>
  ) : undefined
  if (step.subject === 'life') {
    return (
      <AppDialog open title={step.name} icon="🌱" onOpenChange={open => { if (!open) close() }} closeDisabled={api.busy}>
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
              <Text>今天有效，点一下就完成。明天会有新的泡泡。</Text>
              <Button loading={api.busy} onClick={() => void submit({ kind: 'pop' })}>🌼 戳破泡泡</Button>
              {noteButton}
            </>
          )}
          {api.message && <Text color="red" role="alert">{api.message}</Text>}
        </Flex>
      </AppDialog>
    )
  }
  if (!homework) {
    const subject = SUBJECTS[step.subject]
    const note = kidNote(step)
    const reward = kidReward(tree, step, now)
    const later = !!step.planned && step.planned > tree.today
    const other = running && running.id !== step.id ? running : null
    const busy = api.busy || finishing
    return (
      <AppDialog
        open
        title={step.name}
        chrome="none"
        onOpenChange={(v) => {
          if (!v) close()
        }}
        closeDisabled={busy}
        footer={completionFooter}
      >
        <Flex direction="column" gap="3" p="4">
          <Flex align="start" gap="3">
            <Avatar size="5" radius="large" color={SUBJECT_BADGE[step.subject]} fallback={subject.emoji} aria-hidden="true" />
            <Flex direction="column" align="start" gap="1" minWidth="0" flexGrow="1">
              <Badge variant="soft" radius="full" color={SUBJECT_BADGE[step.subject]}>
                {subject.label}
              </Badge>
              {step.planned === tree.today && (
                <Badge variant="soft" radius="full" color={isMustDo(step.priority) ? 'pink' : 'gray'}>
                  {isMustDo(step.priority) ? '今天要做' : '可以明天做'}
                </Badge>
              )}
              <Heading as="h2" size="5" className="break-words max-w-full">{step.name}</Heading>
              {!showCompletionFooter && <Text size="2" color="gray">{kidTime(step, now)}</Text>}
              {step.planned && <Text size="2" color="gray">计划日期 {step.planned}</Text>}
            </Flex>
            <IconButton variant="soft" color="gray" aria-label={step.start && !step.end ? '收起，继续计时' : '关闭'} disabled={busy} onClick={close}>
              <span aria-hidden="true">×</span>
            </IconButton>
          </Flex>
          {note && (
            <StickerCard tone="paper" size="sm" elevation="flat" radius="md" className="w-full">
              <Text className="whitespace-pre-wrap break-words" size="3">
                {note}
              </Text>
            </StickerCard>
          )}
          {reward && (
            <StickerCard tone="accent" size="sm" elevation="sm" radius="md" className="w-full">
              <Text size="3" weight="bold">
                {reward}
              </Text>
            </StickerCard>
          )}
          {homeworkContent}
          <Flex direction="column" align="center" gap="2">
            {step.skipped || (step.end && !finishing) ? (
              <Button size="3" color="pink" onClick={close}>
                {step.skipped ? '👋 下次再来' : '🎉 太好啦'}
              </Button>
            ) : step.start || finishing ? null : other ? (
              <Button size="3" color="amber" onClick={() => select(other.id)}>
                👉 先回去做完那个
              </Button>
            ) : (
              <Flex gap="2" wrap="wrap" justify="center">
                {step.planned && (
                  <Button
                    size="3"
                    color="pink"
                    loading={api.busy}
                    onClick={() => void submit({ kind: 'start' })}
                  >
                    {overdue ? '🌟 开始补做' : later ? '🌟 提前做' : '🌟 开始吧！'}
                  </Button>
                )}
                <Button
                  size="3"
                  variant="soft"
                  color="violet"
                  disabled={api.busy}
                  onClick={() => void submit(overdue ? { kind: 'move', day: tree.today } : { kind: 'nextDay' })}
                >
                  {overdue ? '☀️ 挪到今天' : '🌙 挪到下一天'}
                </Button>
              </Flex>
            )}
          </Flex>
          {api.message && !showCompletionFooter && (
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
      onOpenChange={(v) => {
        if (!v) close()
      }}
      description={SUBJECTS[step.subject].label + ' · 预计 ' + step.minutes + ' 分钟'}
      closeDisabled={api.busy || finishing}
      footer={completionFooter}
    >
      <Flex direction="column" gap="3">
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
            {running ? (
              <Button onClick={() => select(running.id)}>返回正在做的作业</Button>
            ) : (
              <Button
                disabled={!step.planned}
                loading={api.busy}
                onClick={() => void submit({ kind: 'start' })}
              >
                {overdue ? '开始补做' : step.planned && step.planned > tree.today ? '提前做' : '开始做'}
              </Button>
            )}
            <Grid columns="2" gap="2">
              <Button
                variant="soft"
                color="green"
                disabled={api.busy}
                onClick={() => void submit({ kind: 'completeUntimed' })}
              >
                直接完成
              </Button>
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
              <Button variant="soft" disabled={api.busy} onClick={() => void submit(overdue ? { kind: 'move', day: tree.today } : { kind: 'nextDay' })}>
                {overdue ? '挪到今天' : '挪到下一天'}
              </Button>
              {noteButton}
            </Grid>
            {move && (
              <Flex gap="2" wrap="wrap">
                {Array.from({ length: 7 }, (_, i) => shift(tree.today, i)).map((day) => (
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
        {homework && !manual && !step.skipped && !step.end && (
          <Button variant="ghost" onClick={() => setManual(true)}>
            家长补录
          </Button>
        )}
        {api.message && !showCompletionFooter && (
          <Text color="red" role="alert">
            {api.message}
          </Text>
        )}
      </Flex>
    </AppDialog>
  )
}
