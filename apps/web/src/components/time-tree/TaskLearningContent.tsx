'use client'

import dynamic from 'next/dynamic'
import { StickerCard, LoadingOverlay } from '@rosie/ui'
import { Badge, Flex, Spinner, Text } from '@rosie/ui/themes'
import { practiceSelectionPath, type PracticeEntryRow } from '@rosie/tasks'
import type { PracticePreview } from '@/lib/time-tree/practicePreview'
import type { WorkStep } from '@/lib/time-tree/types'
import PracticeResources from './PracticeResources'

const MathPracticeContent = dynamic(() => import('./MathPracticeContent'), { loading: () => <Flex direction="column" minHeight="256px"><LoadingOverlay visible placement="content" /></Flex> })

type Props = {
  step: WorkStep
  content: PracticePreview | null
  loading: boolean
  error: boolean
}

export default function TaskLearningContent({ step, content, loading, error }: Props) {
  const rows = content?.rows ?? (content?.row ? [content.row] : [])
  const hasContent = !!(content?.name.trim() || rows.length || content?.exhausted)
  const showLearning = loading || error || hasContent
  const notes = step.notes.trim()
  const planNote = step.planNote?.trim()
  if (!showLearning && !notes && !planNote) return null
  return (
    <Flex direction="column" gap="3">
      {showLearning && (
        <StickerCard as="section" aria-label="要学这些" tone="white" size="sm" elevation="flat" radius="md">
          <Flex direction="column" gap="2">
            <Flex gap="2" align="center" wrap="wrap">
              <Text size="2" weight="bold">📖 要学这些</Text>
              {content?.provisional && <Badge variant="soft" radius="full" color="amber">先看看</Badge>}
            </Flex>
            {loading ? (
              <Flex gap="2" align="center" role="status"><Spinner /><Text size="2">正在翻开这一页…</Text></Flex>
            ) : error ? (
              <Text size="2" color="red" role="alert">这一页没翻开，再试一次吧。</Text>
            ) : content ? (
              <>
                {content.name.trim() && <Text size="2" className="whitespace-pre-wrap break-words">{content.name}</Text>}
                {content.provisional && <Text size="2" color="gray">先按现在的进度看一眼，开始的时候可能会变。</Text>}
                {content.exhausted ? (
                  <Text size="2" color="gray">这些练习都做完啦。可以换一换，或者先在纸上学。</Text>
                ) : (
                  rows.map((row, index) => <Flex key={`${row.id}:${index}`} direction="column" gap="2">
                    {rows.length > 1 && <Text size="2" weight="bold">第 {index + 1} 项 / 共 {rows.length} 项</Text>}
                    <LearningRow row={row} activeHomeworkId={step.start && !step.end ? step.id : undefined} />
                  </Flex>)
                )}
              </>
            ) : null}
          </Flex>
        </StickerCard>
      )}
      {notes && (
        <StickerCard as="section" aria-label="作业说明" variant="quote" size="sm" radius="md">
          <Flex direction="column" gap="1">
            <Text size="2" weight="bold">📝 小纸条</Text>
            <Text as="p" size="3" className="whitespace-pre-wrap break-words">{notes}</Text>
          </Flex>
        </StickerCard>
      )}
      {planNote && (
        <StickerCard as="section" aria-label="本次备注" variant="quote" size="sm" radius="md">
          <Flex direction="column" gap="1">
            <Text size="2" weight="bold">✨ 这次记得</Text>
            <Text as="p" size="3" className="whitespace-pre-wrap break-words">{planNote}</Text>
          </Flex>
        </StickerCard>
      )}
    </Flex>
  )
}

function LearningRow({ row, activeHomeworkId }: { row: PracticeEntryRow; activeHomeworkId?: string }) {
  const path = practiceSelectionPath(row).map((part) => part.label.trim()).filter(Boolean).join(' / ')
  return <Flex direction="column" gap="2">
    {path && <Text size="2" color="gray" className="break-words">{path}</Text>}
    {row.label.trim() && <Text size="3" weight="bold" className="break-words">{row.label}</Text>}
    {row.values.problemId ? <MathPracticeContent row={row} /> : <PracticeResources row={row} activeHomeworkId={activeHomeworkId} />}
  </Flex>
}
