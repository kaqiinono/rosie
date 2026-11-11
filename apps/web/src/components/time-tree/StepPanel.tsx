'use client'

import { useEffect, useState } from 'react'
import { AppDialog, LoadingOverlay, StickerCard } from '@rosie/ui'
import { Button, Flex, Text, TextField } from '@rosie/ui/themes'
import {
  clock,
  dayOf,
  elapsed,
  shift,
  timing,
  type WorkStep,
  type TreeAction,
} from '@/lib/time-tree/types'
import { SUBJECTS } from '@/components/tree-demo/garden/model'
import type { TreeController } from './useTimeTree'

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
  homework = false,
}: {
  api: TreeController
  step: WorkStep
  close: () => void
  select: (id: string) => void
  onFinished?: (step: WorkStep) => void
  homework?: boolean
}) {
  const tree = api.tree!
  const [now, setNow] = useState(Date.now)
  const [move, setMove] = useState(false)
  const [manual, setManual] = useState(false)
  const [pin, setPin] = useState('')
  const [start, setStart] = useState(step.start ? dayOf(step.start) + 'T' + clock(step.start) : '')
  const [end, setEnd] = useState('')
  const running = tree.steps.find((s) => s.start && !s.end)
  const overdue = !!step.planned && step.planned < tree.today
  useEffect(() => {
    if (!step.start || step.end) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [step.start, step.end])
  async function submit(action: TreeAction) {
    const result = await api.run({ ...action, id: step.id })
    if (!result) return
    if (action.kind === 'finish') {
      const done = result.steps.find((s) => s.id === step.id)
      if (done) onFinished?.(done)
    }
    close()
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
      closeDisabled={api.busy}
    >
      <Flex direction="column" gap="3">
        {step.notes && <Text>{step.notes}</Text>}
        <Text size="2">
          计划 {step.planned ?? '先不做'} · 原排期 {step.scheduled} · 截止 {step.deadline}
        </Text>
        {step.start && (
          <Text>
            开始 {dayOf(step.start)} {clock(step.start)}
          </Text>
        )}
        {step.end ? (
          <>
            <Text>
              完成 {dayOf(step.end)} {clock(step.end)} · 实际 {elapsed(step.start!, step.end)} 分钟
              · {timing(step)}
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
        ) : step.start ? (
          <>
            <Text>
              已经做了 {Math.max(0, Math.floor((now - Date.parse(step.start)) / 60000))} 分钟
            </Text>
            <Button
              color="green"
              loading={api.busy}
              onClick={() => void submit({ kind: 'finish' })}
            >
              完成了
            </Button>
            <Button variant="soft" onClick={close}>
              继续做
            </Button>
          </>
        ) : (
          <>
            {running ? (
              <Button onClick={() => select(running.id)}>返回正在做的作业</Button>
            ) : (
              <Button
                disabled={!step.planned || step.planned > tree.today}
                loading={api.busy}
                onClick={() => void submit({ kind: 'start' })}
              >
                {overdue ? '开始补做' : '开始做'}
              </Button>
            )}
            {step.slot !== null && (
              <Button
                variant="soft"
                disabled={api.busy}
                onClick={() => void submit({ kind: 'return' })}
              >
                放回花苞
              </Button>
            )}
            {(overdue || step.slot === null) && (
              <Button variant="soft" onClick={() => setMove(!move)}>
                改到其他日期
              </Button>
            )}
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
                <Button
                  disabled={api.busy}
                  variant="soft"
                  onClick={() => void submit({ kind: 'move', day: null })}
                >
                  先不做
                </Button>
              </Flex>
            )}
          </>
        )}
        {homework && !manual && !step.end && (
          <Button variant="ghost" onClick={() => setManual(true)}>
            家长补录起止时间
          </Button>
        )}
        {api.message && (
          <Text color="red" role="alert">
            {api.message}
          </Text>
        )}
      </Flex>
    </AppDialog>
  )
}
