'use client'

import { Badge, Button, Flex, Text, Table } from '@rosie/ui/themes'
import type { MaterialBlock } from '../types/content'
import { useContext, useRef, type ReactNode } from 'react'
import { ImageZoomTarget, SentenceHighlightText } from '@rosie/ui'
import { ExamActivityEditContext, ExamAuthoringContext } from './ExamAuthoringRegion'
import { ExamRenderContext } from './ExamRenderContext'
import { ExamInlineAnswer } from './ExamInlineAnswer'
import { ExamInstructionToolsContext, ExamTextHeading } from './ExamTextHeading'
import { ExamAudioIcons, ExamInlineAudio, ExamTitleAudioContext } from './ExamInlineAudio'
import { ExamMaterialImage } from './ExamMaterialImage'
import { useExamImageFocus } from './ExamImageFocusContext'

export function examMediaUrl(attemptId: string, slotId: string, audience: 'student' | 'review' | 'parent' = 'student', adminRevisionId?: string) {
  if (adminRevisionId) return `/api/exams/media?revisionId=${encodeURIComponent(adminRevisionId)}&slotId=${encodeURIComponent(slotId)}`
  return `/api/exams/media?attemptId=${attemptId}&slotId=${encodeURIComponent(slotId)}&audience=${audience}`
}

export function ExamMaterialBlocks({ blocks, attemptId, onAudio, audience = 'student', adminRevisionId, renderImage }: {
  blocks: readonly MaterialBlock[]; attemptId: string; onAudio?: (slotId: string) => void; audience?: 'student' | 'review' | 'parent'; adminRevisionId?: string
  renderImage?: (slotId: string, alt: string, aspectRatio?: number, displayWidth?: number) => ReactNode
}) {
  const context = useContext(ExamRenderContext)
  const authoring = useContext(ExamAuthoringContext)
  const titleAudio = useContext(ExamTitleAudioContext)
  const instructionTools = useContext(ExamInstructionToolsContext)
  const activityEdit = useContext(ExamActivityEditContext)
  const imageFocus = useExamImageFocus()
  const handwritingOutlet = useRef<HTMLDivElement>(null)
  const content = (block: MaterialBlock, value: string, row?: number, column?: number): ReactNode => {
    const slots = block.answerSlots?.filter(slot => slot.row === row && slot.column === column) ?? []
    if (!context || !slots.length) return value
    const parts: ReactNode[] = []
    let cursor = 0
    slots.forEach(slot => {
      parts.push(value.slice(cursor, slot.start), <ExamInlineAnswer key={`${slot.questionId}:${slot.gapId ?? ''}`} slot={slot} />)
      cursor = slot.end
    })
    parts.push(value.slice(cursor))
    return parts
  }
  const passage = (start: number) => {
    if (!context || (start > 0 && blocks[start - 1].kind === 'text' && blocks[start - 1].sentences?.length)) return null
    const sequence: Extract<MaterialBlock, { kind: 'text' }>[] = []
    for (let index = start; index < blocks.length; index++) {
      const block = blocks[index]
      if (block.kind !== 'text' || !block.sentences?.length) break
      sequence.push(block)
    }
    let text = ''
    const sentences: { id: string; start: number; end: number }[] = []
    const selected: string[] = []
    sequence.forEach((block, index) => {
      if (index) text += '\n\n'
      const offset = text.length
      text += block.text
      block.sentences?.forEach(sentence => {
        const id = `${block.id}/${sentence.id}`
        sentences.push({ id, start: offset + sentence.start, end: offset + sentence.end })
        if (context.annotations[`${context.group.id}/${block.id}`]?.includes(sentence.id)) selected.push(id)
      })
    })
    return <SentenceHighlightText key={blocks[start].id} text={text} sentences={sentences} selected={selected} readOnly={context.disabled}
      onValueChange={ids => sequence.forEach(block => context.onAnnotation(`${context.group.id}/${block.id}`,
        (block.sentences ?? []).filter(sentence => ids.includes(`${block.id}/${sentence.id}`)).map(sentence => sentence.id)))} />
  }
  const consumedAudio = new Set<number>()
  return <ExamRenderContext.Provider value={context ? { ...context, handwritingOutlet } : null}><Flex direction="column" gap="4">{blocks.map((block, index) => {
    if (consumedAudio.has(index)) return null
    const render = () => { switch (block.kind) {
      case 'text': {
        const beside: Extract<MaterialBlock, { kind: 'audio' }>[] = []
        for (let next = index + 1; next < blocks.length; next++) {
          const following = blocks[next]
          if (following.kind !== 'audio') break
          consumedAudio.add(next)
          if (!titleAudio.includes(following.mediaSlotId)) beside.push(following)
        }
        const lastInstruction = block.presentation?.role === 'instruction'
          && !blocks.slice(index + 1).some(item => item.kind === 'text' && item.presentation?.role === 'instruction')
        const aside = lastInstruction && (titleAudio.length > 0 || instructionTools || activityEdit) ? <>
          {instructionTools}
          {activityEdit && <Button size="1" variant="soft" disabled={activityEdit.disabled} onClick={activityEdit.start}>编辑</Button>}
          {titleAudio.length > 0 && <ExamAudioIcons slotIds={titleAudio} />}
        </> : undefined
        const text = block.presentation ? <ExamTextHeading key={block.id} block={block} aside={aside} />
          : block.sentences?.length && context ? passage(index)
          : <div key={block.id} className="whitespace-pre-wrap text-base font-normal leading-relaxed" lang="en">{content(block, block.text)}</div>
        if (!beside.length || block.presentation?.role === 'instruction') return text
        return <Flex key={block.id} align="start" justify="between" gap="3" width="100%">
          <div className="min-w-0 flex-1">{text}</div>
          <Flex gap="2" align="center">{beside.map(item => <ExamInlineAudio key={item.id} slotId={item.mediaSlotId} />)}</Flex>
        </Flex>
      }
      case 'email': return <Flex key={block.id} direction="column" gap="2" lang="en">
        <Text size="3">From: {block.from}</Text><Text size="3">To: {block.to}</Text><Text size="3" weight="bold">{block.subject}</Text>
        {block.body.map((line, index) => <Flex key={index} direction="column" gap="1" align="start">
          <div className="text-base font-normal leading-relaxed">{content(block, line, index)}</div>
          {block.notes?.filter(note => note.paragraph === index).map((note, noteIndex) => <Badge key={noteIndex} size="2" variant="soft">{note.text}</Badge>)}
        </Flex>)}
      </Flex>
      case 'table': return <div key={block.id} className="overflow-x-auto"><Table.Root><Table.Header><Table.Row>{block.headers.map((header, index) => <Table.ColumnHeaderCell key={index}>{header}</Table.ColumnHeaderCell>)}</Table.Row></Table.Header>
        <Table.Body>{block.rows.map((row, index) => <Table.Row key={index}>{row.map((cell, column) => <Table.Cell key={column}>{content(block, cell, index, column)}</Table.Cell>)}</Table.Row>)}</Table.Body></Table.Root></div>
      case 'image': {
        const image = renderImage ? renderImage(block.mediaSlotId, block.alt, block.aspectRatio, imageFocus.expanded ? undefined : block.displayWidth)
          : <ExamMaterialImage displayWidth={block.displayWidth} src={examMediaUrl(attemptId, block.mediaSlotId, audience, adminRevisionId)} alt={block.alt} aspectRatio={block.aspectRatio} />
        return <figure key={block.id} className="min-w-0" data-exam-image-slot={block.mediaSlotId}>{imageFocus.open
          ? <ImageZoomTarget label={`放大题图：${block.alt}`} maxWidth={block.displayWidth} onOpen={event => imageFocus.open?.(event, block.mediaSlotId)}>{image}</ImageZoomTarget>
          : image}{block.caption && <figcaption className="mt-2 text-sm">{block.caption}</figcaption>}</figure>
      }
      case 'audio': return titleAudio.includes(block.mediaSlotId) ? null : onAudio ? <Flex key={block.id}><Button size="3" variant="soft" onClick={() => onAudio(block.mediaSlotId)}>🎧 播放这一段</Button></Flex> : <ExamInlineAudio key={block.id} slotId={block.mediaSlotId} />
    } }
    const rendered = render()
    if (!authoring || !context || rendered === null || block.kind === 'image' || block.kind === 'audio') return rendered
    const blockIds = [block.id]
    if (block.kind === 'text' && block.sentences?.length) {
      for (let i = index + 1; i < blocks.length && blocks[i].kind === 'text' && blocks[i].sentences?.length; i++) blockIds.push(blocks[i].id)
    }
    return <div key={block.id}>{authoring({ kind: 'blocks', groupId: context.group.id, blockIds }, rendered)}</div>
  })}<div ref={handwritingOutlet} className="empty:hidden" /></Flex></ExamRenderContext.Provider>
}
