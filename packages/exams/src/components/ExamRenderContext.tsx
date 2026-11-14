'use client'

import { createContext, type RefObject } from 'react'
import type { AnswerSlot, QuestionGroup } from '../types/content'
import type { ExamAnswer } from '../types/attempts'

export type ExamRenderState = {
  group: QuestionGroup
  answers: Readonly<Record<string, ExamAnswer>>
  disabled: boolean
  handwritingEnabled: boolean
  onHandwritingEditing?: (id: string, editing: boolean) => void
  handwritingOutlet?: RefObject<HTMLDivElement | null>
  onAnswer: (id: string, answer: ExamAnswer) => void
  inlineSlots: readonly AnswerSlot[]
  annotations: Readonly<Record<string, readonly string[]>>
  onAnnotation: (blockId: string, ids: string[]) => void
}
export const ExamRenderContext = createContext<ExamRenderState | null>(null)
