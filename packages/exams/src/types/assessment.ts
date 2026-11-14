import type { ExamAttemptView } from './attempts'
import type { MediaSlot } from './content'
import type { TeacherNote } from './solutions'

export type ExamHandwritingDecision = 'correct' | 'incorrect' | 'unclear'
export interface ExamHandwritingReview {
  id: string
  attemptId: string
  questionId: string
  decision: ExamHandwritingDecision
  comment: string
  points: number | null
  maxPoints: number | null
  actorId: string
  reviewedAt: string
  attemptVersion: string
}

export interface ExamRecording {
  id: string
  attemptId: string
  questionId: string
  mimeType: string
  sizeBytes: number
  status: 'uploading' | 'complete' | 'abandoned'
  createdAt: string
  completedAt: string | null
}

export interface ExamManualDimension {
  dimensionId: string
  score: number
  comment: string
}

/** Append-only assessment history. Latest reviewedAt/id for a question is effective. */
export interface ExamManualReview {
  id: string
  attemptId: string
  questionId: string
  rubricId: string
  dimensions: readonly ExamManualDimension[]
  comment: string
  points: number
  maxPoints: number
  actorId: string
  reviewedAt: string
  attemptVersion: string
}

export interface ExamSpeakingScript {
  attempt: ExamAttemptView
  partNumber: number
  expiresAt: string
  notes: readonly TeacherNote[]
  mediaSlots: readonly MediaSlot<'parent'>[]
}
