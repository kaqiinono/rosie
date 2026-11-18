'use client'

import Link from 'next/link'
import { StickerCard } from '@rosie/ui'
import { Button, Flex, Text } from '@rosie/ui/themes'
import type { ExamDraftInput } from '../../validation/contracts'
import type { ExamOption, MaterialBlock } from '../../types/content'
import { ImageSizeControl } from './ImageSizeControl'
import { resizeDraftImage } from './resizeDraftImage'

type Props = {
  draft: ExamDraftInput
  revisionId: string
  questionId?: string
  onChange: (draft: ExamDraftInput) => void
  onOpenImage: (slotId: string) => void
  onOpenSource: (page: number) => void
  editingDisabled: boolean
  navigationDisabled: boolean
}

/** Authoring controls stay outside the student-facing paper projection. */
export function ExamImageTools({ draft, revisionId, questionId, onChange, onOpenImage, onOpenSource, editingDisabled, navigationDisabled }: Props) {
  const group = draft.content.groups.find(item => item.questions.some(question => question.id === questionId))
  if (!group) return null
  const images = new Map<string, { label: string; width?: number }>()
  const collectBlocks = (blocks: readonly MaterialBlock[]) => {
    for (const block of blocks) if (block.kind === 'image') images.set(block.mediaSlotId, { label: block.alt, width: block.displayWidth })
  }
  const collectOptions = (options: readonly ExamOption[]) => {
    for (const option of options) if (option.imageSlotId && !images.has(option.imageSlotId)) images.set(option.imageSlotId, { label: option.label, width: option.displayWidth })
  }
  for (const material of draft.content.materials) if (group.materialIds.includes(material.id)) collectBlocks(material.blocks)
  collectBlocks(group.instructions)
  for (const pool of group.optionPools) collectOptions(pool.options)
  for (const question of group.questions) {
    collectBlocks(question.prompt)
    if (question.answerType === 'single_choice' || question.answerType === 'multiple_choice') collectOptions(question.options)
    if (question.answerType === 'matching') for (const item of question.items) collectBlocks(item.prompt)
  }
  for (const activity of group.activities ?? []) if (activity.imageSlotId && !images.has(activity.imageSlotId)) images.set(activity.imageSlotId, { label: activity.title, width: activity.imageDisplayWidth })
  const resize = (slotId: string, displayWidth: number | undefined) => {
    if (editingDisabled) return
    onChange(resizeDraftImage(draft, slotId, displayWidth))
  }
  const bindingHref = `/admin/sync?${new URLSearchParams({ panel: 'exams', revisionId, sectionId: group.sectionId, partNumber: String(group.partNumber) })}`
  return <Flex direction="column" gap="3">
    <Flex gap="2" wrap="wrap">
      {[...new Set(group.provenance.sources.map(source => source.pdfPage))].map(page => <Button key={page} size="1" variant="soft" onClick={() => onOpenSource(page)}>原书 PDF {page}</Button>)}
      {group.sectionId === 'listening' && (navigationDisabled
        ? <Button size="1" variant="soft" disabled>绑定听力音频</Button>
        : <Button size="1" variant="soft" asChild><Link href={bindingHref}>绑定听力音频</Link></Button>)}
    </Flex>
    {images.size > 0 && <Text weight="bold">题组图片 · 尺寸与裁切</Text>}
    {[...images].map(([slotId, image]) => <StickerCard key={slotId} tone="paper" elevation="flat" size="sm">
      <Flex direction="column" gap="3">
        <Text size="2" weight="bold">{image.label || draft.content.mediaSlots.find(slot => slot.id === slotId)?.sourceTrackLabel || slotId}</Text>
        <ImageSizeControl value={image.width} disabled={editingDisabled} onChange={width => resize(slotId, width)} />
        <Flex><Button size="1" variant="soft" disabled={navigationDisabled || editingDisabled} onClick={() => onOpenImage(slotId)}>查看／裁切图片</Button></Flex>
      </Flex>
    </StickerCard>)}
  </Flex>
}
