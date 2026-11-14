import type { WordEntry, WordMasteryInfo } from '@rosie/core'
import type { QuestionId, VocabularyLink } from './content'

export interface ExamWordSource {
  attemptId: string
  contentRevisionId: string
  questionId: QuestionId
  linkId: string
  title: string
  sentence: string
  matchedForm: string
  contextMeaning: string
  sourceSnapshot: VocabularyLink['sourceSnapshot']
}
export interface ExamResolvedWord {
  link: VocabularyLink
  word: WordEntry | null
  valid: boolean
  mastery: WordMasteryInfo | null
  /** Legacy mastery is shared by unit/lesson/word, including matching keys in other stages. */
  masteryScope: 'legacy_shared'
  sources: ExamWordSource[]
}
export type ExamWordPhase = 'meaning' | 'spelling'
export interface ExamWordProgress {
  attempts: number
  helpClicks: number
  firstCorrect: boolean | null
  firstIndependent: boolean | null
  lastAnswer: string | null
  lastCorrect: boolean | null
}
export interface ExamWordReviewItem {
  wordEntryId: string
  word: WordEntry
  sources: ExamWordSource[]
  valid: boolean
  meaning: ExamWordProgress
  spelling: ExamWordProgress
}
export interface ExamWordReviewBatch {
  id: string
  version: string
  status: 'collecting' | 'active' | 'completed'
  items: ExamWordReviewItem[]
  cursor: number
  current: { wordEntryId: string; phase: ExamWordPhase; options: { id: string; label: string }[] } | null
  completedAt: string | null
  updatedAt: string
  next: { activePlanHref: string | null; planStatus: 'available' | 'none' | 'unavailable' | 'not_requested'; materialHref: string | null }
}
export interface ExamWordReviewSummary { id: string; version: string; status: ExamWordReviewBatch['status']; count: number; updatedAt: string }
export interface ExamVocabularyBridge {
  openWord(item: ExamResolvedWord): void
  addWord(item: ExamResolvedWord): Promise<void>
  startReview(): Promise<void>
}
export type ExamWordReviewCommand =
  | { operation: 'start' | 'help' | 'retry' | 'next'; requestId: string; expectedVersion: string }
  | { operation: 'answer'; requestId: string; expectedVersion: string; answer: string }

export interface ExamWordRemoveCommand { operation: 'remove'; requestId: string; expectedVersion: string; wordEntryId: string }
