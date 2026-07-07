import type { ScratchObject } from '@rosie/math/components/shared/ScratchPad/scratch-pad-types'

export type MathScratchWorkingRow = {
  userId: string
  problemId: string
  /** '' = practice; quiz paper uuid string */
  paperScope: string
  objects: ScratchObject[]
  answerDraft: unknown | null
  updatedAt: string
}

export type MathScratchDraftRow = {
  id: string
  userId: string
  problemId: string
  lessonId: string
  section: string
  objects: ScratchObject[]
  objectCount: number
  submittedAt: string
}

export type MathPracticeAttemptRow = {
  id: string
  userId: string
  problemId: string
  lessonId: string
  section: string
  paperId: string | null
  correct: boolean
  draftId: string | null
  answerSnapshot: unknown | null
  attemptedAt: string
}

export type ScratchSessionMode = 'practice' | 'quiz' | 'readonly'

export type ScratchSessionSource =
  | 'lesson'
  | 'homework'
  | 'workbook'
  | 'pretest'
  | 'supplement'
  | 'alltest'
  | 'mistakes'
  | 'quiz'
  | 'sea'
