'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Check, Info } from '@rosie/ui'
import { Button, Flex, Heading, IconButton, Popover, Text } from '@rosie/ui/themes'
import { flowerBudget, MINUTES_PER_FLOWER, weeklyHomeworkStart } from '@/lib/time-tree/flowers'
import type { TreeAction, WorkStep } from '@/lib/time-tree/types'
import styles from './FlowerCollection.module.css'

type Selection = NonNullable<TreeAction['flowerSelection']>

export default function FlowerCollection({ step, now, busy, readOnly, questions, save }: {
  step: WorkStep
  now: number
  busy: boolean
  readOnly: boolean
  questions: { done: number; total: number } | null
  save: (selection: Selection) => Promise<void>
}) {
  const collected = step.flowers!.collected
  const weekly = !!weeklyHomeworkStart(step)
  const title = weekly ? '本周进度' : '作业进度'
  const { slots, suggested } = flowerBudget(step, now)
  const [selected, select] = useState<number | null>(null)
  const questionsDone = !!questions && questions.done === questions.total
  // With tracked questions, the last flower opens when all questions are done.
  const lastSelectable = questions && !questionsDone ? slots - 1 : slots
  const position = Math.max(collected, Math.min(selected ?? collected, lastSelectable))
  const complete = questions ? questionsDone : selected !== null && position === slots
  const preview = complete && !readOnly ? slots : position
  const suggestedPosition = Math.min(suggested, lastSelectable)
  const showSuggestion = !readOnly && !complete && selected === null && suggestedPosition > collected
  const planMinutes = Math.min((readOnly ? collected : preview) * MINUTES_PER_FLOWER, step.minutes)
  const planLabel = planMinutes > collected * MINUTES_PER_FLOWER ? '保存后' : '已完成'

  return (
    <section aria-label={title} className={styles.progress}>
      <Flex direction="column" gap="1" className={styles.summary}>
        <Flex align="center" gap="1">
          <Heading as="h3" size="3">{title}</Heading>
          <Popover.Root>
            <Popover.Trigger>
              <IconButton type="button" size="1" variant="soft" color="gray" data-soft-outline="none" aria-label="花花进度说明">
                <Info size={14} aria-hidden="true" />
              </IconButton>
            </Popover.Trigger>
            <Popover.Content side="top" align="start" sideOffset={6} size="1" width="16rem"
              maxWidth="calc(100vw - 32px)" aria-label="花花进度说明">
              <Flex direction="column" gap="1">
                <Text as="p" size="2">
                  每朵花约代表{weekly ? '本周作业' : '本份作业'} {MINUTES_PER_FLOWER} 分钟，可以分几次做完。
                </Text>
                {showSuggestion && <Text as="p" size="2" color="gray">
                  按用时可点到第 {suggestedPosition} 朵
                </Text>}
              </Flex>
            </Popover.Content>
          </Popover.Root>
        </Flex>
        <Text role="status" size="1" color="gray" className="tabular-nums">
          {planLabel} {planMinutes} / {step.minutes} 分钟
          {questions && ` · 已答 ${questions.done} / ${questions.total} 题`}
        </Text>
      </Flex>
      <div className={styles.actions}>
        <div role="group" aria-label="花花进度" className={styles.flowers}>
          {Array.from({ length: slots }, (_, index) => {
            const n = index + 1
            const saved = n <= collected
            const lit = n <= preview
            const chosen = !readOnly && n === selected && n <= lastSelectable
            const locked = n > lastSelectable
            // Older sessions may already have every flower but still need an explicit finish.
            const canConfirmSavedLast = !questions && n === slots && n === collected
            const stateLabel = chosen ? '本次选到这里' : saved ? '已收下' : lit ? '本次点亮'
              : locked ? '做完所有题目后点亮' : '待点亮'

            return (
              <IconButton key={n} type="button" variant="ghost" color="pink" radius="full"
                className={styles.tile}
                aria-label={`第 ${n} 朵，${stateLabel}`}
                aria-pressed={chosen}
                data-state={saved ? 'saved' : lit ? 'lit' : 'empty'}
                disabled={busy || readOnly || questionsDone || locked || (saved && !canConfirmSavedLast)}
                onClick={() => select(chosen ? null : n)}>
                <span aria-hidden="true" className={styles.sticker}>
                  <Image src="/time-tree/flower-sticker.png" alt="" width={28} height={28}
                    unoptimized draggable={false} className={styles.flower} />
                  {lit && <span className={styles.check}><Check size={9} strokeWidth={3} /></span>}
                </span>
              </IconButton>
            )
          })}
        </div>
        {!readOnly && (
          <Button type="button" size="2" color="crimson" loading={busy}
            className="min-h-11 shrink-0"
            onClick={() => void save({ position: preview, complete })}>
            {complete ? weekly ? '完成本周' : '完成整份' : '保存进度'}
          </Button>
        )}
      </div>
    </section>
  )
}
