'use client'
import { useEffect, useRef } from 'react'
import { StickerCard } from '@rosie/ui'
import { Badge, Flex, Text } from '@rosie/ui/themes'
import type { ExamImageTask } from '../../types/imageTasks'
import { ExamGroupRenderer } from '../ExamGroupRenderer'
import { ExamOptionImage } from '../ExamOptionImage'
import { ExamMaterialImage } from '../ExamMaterialImage'

export function ImageQuestionPreview({ task, previewUrl }: { task: ExamImageTask; previewUrl: string | null }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const selected = root.current?.querySelector<HTMLElement>('[data-crop-target]')
    if (selected && root.current) root.current.scrollTop = Math.max(0, selected.offsetTop - root.current.offsetTop - 100)
  }, [task.slot.id])
  const picture = (slotId: string, alt: string, aspectRatio?: number, displayWidth?: number) => slotId === task.slot.id
    ? <StickerCard tone="info" elevation="flat" data-crop-target><Flex direction="column" gap="2">
      <Badge>当前图片位置</Badge>
      <ExamMaterialImage src={previewUrl} alt={alt} aspectRatio={aspectRatio} displayWidth={displayWidth} message={!previewUrl ? '裁切后在此预览' : undefined} />
    </Flex></StickerCard>
    : <ExamMaterialImage alt={alt} aspectRatio={aspectRatio} displayWidth={displayWidth} message="其他图片位置" />
  return <div ref={root} className="relative max-h-[78dvh] overflow-auto">
    <Flex direction="column" gap="4">
      {task.group && <Text weight="bold">{task.group.sectionId} · Part {task.group.partNumber}</Text>}
      {task.group && <ExamGroupRenderer handwritingEnabled group={task.group} materials={task.materials} attemptId="" answers={{}} onAnswer={() => undefined} disabled
        renderImage={picture} renderOptionImage={option => option.imageSlotId === task.slot.id && previewUrl
          ? <ExamOptionImage src={previewUrl} alt={option.label} region={option.imageRegion} displayWidth={option.displayWidth} /> : <ExamMaterialImage alt={option.label} message={option.imageSlotId === task.slot.id ? '裁切后在此预览' : '其他图片位置'} />} />}
    </Flex>
  </div>
}
