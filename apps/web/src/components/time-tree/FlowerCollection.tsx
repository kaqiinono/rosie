'use client'

import Image from 'next/image'
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
  const questionsDone = !!questions && questions.done === questions.total
  const preview = readOnly ? collected : Math.max(collected, suggested)
  const planMinutes = Math.min(preview * MINUTES_PER_FLOWER, step.minutes)
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
                  累计作业用时每满 {MINUTES_PER_FLOWER} 分钟自动选中一朵花，保存进度后收下。
                </Text>
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
        <ul role="list" aria-label="花花进度" tabIndex={0} className={styles.flowers}>
          {Array.from({ length: slots }, (_, index) => {
            const n = index + 1
            const saved = n <= collected
            const lit = n <= preview
            const stateLabel = saved ? '已收下' : lit ? '已自动选中' : '待选中'

            return (
              <li key={n} className={styles.tile} data-state={saved ? 'saved' : lit ? 'lit' : 'empty'}>
                <span className="sr-only">第 {n} 朵，{stateLabel}</span>
                <span aria-hidden="true" className={styles.sticker}>
                  <Image src="/time-tree/flower-sticker.png" alt="" width={28} height={28}
                    unoptimized draggable={false} className={styles.flower} />
                  {lit && <span className={styles.check}><Check size={9} strokeWidth={3} /></span>}
                </span>
              </li>
            )
          })}
        </ul>
        {!readOnly && (
          <Flex gap="1" wrap="wrap" justify="end">
            {!questionsDone && (
              <Button type="button" size="2" color="crimson" variant="soft" loading={busy}
                className="min-h-11 shrink-0" onClick={() => void save({ complete: false })}>
                保存进度
              </Button>
            )}
            {(!questions || questionsDone) && (
              <Button type="button" size="2" color="crimson" loading={busy}
                className="min-h-11 shrink-0" onClick={() => void save({ complete: true })}>
                {weekly ? '完成本周' : '完成整份'}
              </Button>
            )}
          </Flex>
        )}
      </div>
    </section>
  )
}
