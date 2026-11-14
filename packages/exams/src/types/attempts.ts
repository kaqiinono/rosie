import type { QuestionId, Material, QuestionGroup, MediaSlot, VocabularyLink, Guidance } from './content'
import type { Solution, TeacherNote } from './solutions'

export type ExamMode = 'practice' | 'mock'
export type ExamInk = { strokes: readonly (readonly { x: number; y: number }[])[] }
export type ExamAnswer =
  | { type: 'single_choice'; optionId: string }
  | { type: 'multiple_choice'; optionIds: string[] }
  | { type: 'gap_fill'; values: Record<string, string>; ink?: Record<string, ExamInk> }
  | { type: 'matching'; matches: Record<string, string> }
  | { type: 'writing'; text: string }
  | { type: 'speaking'; recordingIds: string[]; abandoned: boolean }
  | { type: 'self_check'; checkedIds: string[] }

export interface ExamQuestionResult {
  questionId: QuestionId
  outcome: 'correct' | 'incorrect' | 'unanswered' | 'pending' | 'unscored' | 'graded'
  points: number | null
  maxPoints: number | null
}

export interface ExamSectionState {
  status: 'not_started' | 'active' | 'interrupted' | 'submitted'
  startedAt: string | null
  deadlineAt: string | null
  submittedAt: string | null
  interruptedAt: string | null
  technicalInterruption: boolean
  timedOut: boolean
}

export interface ExamAttemptState {
  schemaVersion: 1
  mode: ExamMode
  groupIds: string[]
  currentSectionId: string | null
  currentGroupId: string | null
  sections: Record<string, ExamSectionState>
  /** User sentence marks, separate from answer/scoring data. */
  annotations?: Record<string, string[]>
  answers: Record<string, ExamAnswer>
  results: Record<string, ExamQuestionResult>
  helpQuestionIds: string[]
  priorExposureFamilies: string[]
  groupActiveMs: Record<string, number>
  lastActivityAt: string | null
  playbackPositionMs: number
  scriptGrant: { partNumber: number; expiresAt: string; sessionId: string } | null
}

export interface ExamAttemptRecord {
  id: string
  userId: string
  contentRevisionId: string
  mediaBindingRevisionId: string | null
  version: string
  createdAt: string
  updatedAt: string
  state: ExamAttemptState
}

/** Explicit student projection: private solutions and source-page media never live here. */
export interface ExamAttemptView {
  /** True only after the atomic annotation migration is available. */
  annotationPersistence?: boolean
  /** Enabled only when handwriting persistence AND authorized grading are available. */
  handwritingAvailable?: boolean
  id: string
  version: string
  title: string
  serverNow: string
  state: ExamAttemptState
  materials: readonly Material[]
  groups: readonly QuestionGroup[]
  mediaSlots: readonly MediaSlot<'student'>[]
  vocabularyLinks: readonly VocabularyLink[]
}

export interface ExamAttemptReview {
  id: string
  solutions: readonly Solution[]
  results: Record<string, ExamQuestionResult>
  vocabularyLinks: readonly VocabularyLink[]
  guidance: readonly Guidance[]
  listeningTranscripts: readonly TeacherNote[]
  mediaSlots: readonly MediaSlot<'review'>[]
}

export interface ExamAttemptListItem {
  id: string
  title: string
  mode: ExamMode
  status: 'ready' | 'active' | 'pending_review' | 'completed'
  updatedAt: string
}
