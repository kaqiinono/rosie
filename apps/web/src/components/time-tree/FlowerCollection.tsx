'use client'

import { useState } from 'react'
import { useHomeworkData } from '@rosie/tasks'
import { previewPractice } from '@/lib/time-tree/practicePreview'
import { Button, Flex, Switch, Text } from '@rosie/ui/themes'
import { flowerBudget, flowerQuestionProgress } from '@/lib/time-tree/flowers'
import type { TreeAction, TreeData, WorkStep } from '@/lib/time-tree/types'

type Selection = NonNullable<TreeAction['flowerSelection']>

export default function FlowerCollection({ tree, step, now, busy, readOnly, save }: {
  tree: TreeData
  step: WorkStep
  now: number
  busy: boolean
  readOnly: boolean
  save: (selection: Selection) => Promise<void>
}) {
  const progress = step.flowers!
  const { slots, suggested } = flowerBudget(step, now)
  const [selected, select] = useState<number | null>(null)
  const [complete, setComplete] = useState(false)
  const [prompt, setPrompt] = useState(false)
  const homework = useHomeworkData()
  const practice = step.practice === undefined && step.practiceEntryName
    ? previewPractice(tree, step, homework.data.find(item => item.id === step.occurrence.split('/')[0]))
    : step.practice
  const questions = flowerQuestionProgress(step, practice)
  const position = selected ?? progress.collected
  const final = questions ? questions.done === questions.total : complete
  async function submit(skip = false) {
    if (!skip && selected === null && slots > progress.collected && !prompt) {
      setPrompt(true)
      return
    }
    if (!skip && selected === null && slots > progress.collected && !final) return
    await save({ position: skip ? progress.collected : position, complete })
  }
  return <Flex direction="column" gap="2" align="center">
    <Flex wrap="wrap" align="center" justify="center" gap="1" aria-label="花朵与题目进度">
      {Array.from({ length: slots }, (_, i) => {
        const n = i + 1
        const lit = n <= position
        return <Button key={n} type="button" variant="ghost" color={lit ? 'pink' : 'gray'}
          aria-label={`第 ${n} 朵，${lit ? '已点亮' : '待点亮'}`} aria-pressed={lit}
          disabled={busy || readOnly || n <= progress.collected}
          style={{ minWidth: 38, minHeight: 40, margin: 0, opacity: 1 }}
          onClick={() => { select(n); setPrompt(false) }}>
          <span aria-hidden="true" className="text-2xl">{lit ? '🌸' : '❀'}</span>
        </Button>
      })}
      {questions && <Text weight="bold" aria-label={`已完成 ${questions.done} 题，共 ${questions.total} 题`}>
        {questions.done}/{questions.total}
      </Text>}
    </Flex>
    {!readOnly && <>
      {!questions && <Text as="label" size="2">
        <Switch checked={complete} disabled={busy} onCheckedChange={setComplete} /> 整份做完了
      </Text>}
      {suggested > progress.collected && <Text size="1" color="gray">按用时可点到第 {suggested} 朵</Text>}
      {prompt && <Text role="status" size="2">今天做到哪朵啦？点亮它吧。</Text>}
      <Button color="green" size="3" loading={busy} onClick={() => void submit()}>完成本次</Button>
      {prompt && !final && <Button variant="ghost" disabled={busy} onClick={() => void submit(true)}>只保存本次进度</Button>}
    </>}
  </Flex>
}
