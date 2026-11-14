'use client'

import { useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AppDialog } from '@rosie/ui'
import type { ExamActivity, Material, QuestionGroup } from '../types/content'
import { ExamAuthoringContext } from './ExamAuthoringRegion'
import { ExamImageFocusContext } from './ExamImageFocusContext'
import { ExamAudioTransport, ExamSharedAudioContext, ExamTitleAudioContext } from './ExamInlineAudio'
import { questionPromptBlocks, titleAudioSlotIds } from './examPromptPresentation'

/** The audio engine remains mounted outside the dialog; answers remain owner-controlled. */
export function ExamActivityFrame({ activity, group, materials, children }: {
  activity: ExamActivity; group: QuestionGroup; materials: readonly Material[]; children: ReactNode
}) {
  const authoring = useContext(ExamAuthoringContext)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const targetSlot = useRef<string | undefined>(undefined)
  const focusImage = useCallback((node: HTMLDivElement | null) => {
    if (!node || !targetSlot.current) return
    const image = [...node.querySelectorAll<HTMLElement>('[data-exam-image-slot]')]
      .find(element => element.dataset.examImageSlot === targetSlot.current)
    image?.scrollIntoView({ block: 'start' })
  }, [])
  const blocks = [
    ...group.instructions.filter(block => activity.instructionIds.includes(block.id)),
    ...materials.filter(material => activity.materialIds.includes(material.id)).flatMap(material => material.blocks),
    ...group.questions.filter(question => activity.questionIds.includes(question.id)).flatMap(question => question.prompt),
  ]
  const counts = new Map<string, number>()
  for (const block of blocks) if (block.kind === 'audio') counts.set(block.mediaSlotId, (counts.get(block.mediaSlotId) ?? 0) + 1)
  // Only identical authorized slots are interchangeable; track labels/file names are not identities.
  const shared = [...counts].filter(([, count]) => count > 1).map(([id]) => id)
  const instructions = group.instructions.filter(block => activity.instructionIds.includes(block.id))
  const titleAudio = titleAudioSlotIds(instructions, group.questions.filter(question => activity.questionIds.includes(question.id)).map(questionPromptBlocks), shared)
  return <ExamSharedAudioContext.Provider value={shared}>
    <ExamTitleAudioContext.Provider value={titleAudio}>
    <ExamImageFocusContext.Provider value={{ expanded: false, open: authoring ? undefined : (event, slotId) => {
      trigger.current = event.currentTarget
      targetSlot.current = slotId
      setOpen(true)
    } }}>{children}</ExamImageFocusContext.Provider>
    <AppDialog title={activity.title || '题图与作答'} presentation="fullscreen" open={open}
      returnFocusRef={trigger} onOpenChange={setOpen} footer={<ExamAudioTransport />}>
      <ExamImageFocusContext.Provider value={{ expanded: true }}><div ref={focusImage}>{children}</div></ExamImageFocusContext.Provider>
    </AppDialog>
    </ExamTitleAudioContext.Provider>
  </ExamSharedAudioContext.Provider>
}
