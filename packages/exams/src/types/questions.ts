import type {
  ContentProvenance,
  ExamOption,
  MaterialBlock,
  QuestionClassification,
  QuestionId,
  QuestionLocation,
} from './content'

export type ExamAnswerType = 'single_choice' | 'multiple_choice' | 'gap_fill' | 'matching' | 'writing' | 'speaking' | 'self_check'

export type UnscoredQuestion =
  | { readonly kind: 'example'; readonly points: 0 }
  | { readonly kind: 'unscored'; readonly points: 0 }

export type ObjectiveScoring = { readonly kind: 'objective'; readonly maxPoints: number } | UnscoredQuestion
export type ManualScoring = { readonly kind: 'manual'; readonly rubricId: string } | UnscoredQuestion

interface QuestionBase {
  readonly id: QuestionId
  /** Authored display label; never replaces original numbering or scoring identity. */
  readonly displayLabel?: string
  readonly location: QuestionLocation
  readonly prompt: readonly MaterialBlock[]
  readonly classification: QuestionClassification
  readonly provenance: ContentProvenance
  readonly exampleText?: string
}

export interface SingleChoiceQuestion extends QuestionBase {
  readonly answerType: 'single_choice'
  readonly options: readonly ExamOption[]
  readonly scoring: ObjectiveScoring
}

export interface MultipleChoiceQuestion extends QuestionBase {
  readonly answerType: 'multiple_choice'
  readonly options: readonly ExamOption[]
  readonly selectionCount: number
  readonly scoring: ObjectiveScoring
}

export interface GapFillQuestion extends QuestionBase {
  readonly answerType: 'gap_fill'
  /** Ordered gap IDs, including when more than one blank belongs to this question. */
  readonly gaps: readonly { readonly id: string; readonly label: string; readonly maxWords: number | null }[]
  readonly answerOrder: 'fixed' | 'any'
  readonly optionPoolId?: string
  readonly scoring: ObjectiveScoring
}

export interface MatchingQuestion extends QuestionBase {
  readonly answerType: 'matching'
  readonly items: readonly { readonly id: string; readonly prompt: readonly MaterialBlock[] }[]
  /** Resolves inside the containing group's optionPools, including its reuse rule. */
  readonly optionPoolId: string
  readonly scoring: ObjectiveScoring
}

export interface WritingQuestion extends QuestionBase {
  readonly answerType: 'writing'
  readonly minimumWords: number | null
  readonly targetWords?: number
  readonly scoring: ManualScoring
}

export interface SpeakingQuestion extends QuestionBase {
  readonly answerType: 'speaking'
  readonly scoring: ManualScoring
}

export interface SelfCheckQuestion extends QuestionBase {
  readonly answerType: 'self_check'
  readonly checklist: readonly { readonly id: string; readonly label: string }[]
  /** Open activities have no automatic correctness or objective score. */
  readonly scoring: UnscoredQuestion
}

export type Question =
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | GapFillQuestion
  | MatchingQuestion
  | WritingQuestion
  | SpeakingQuestion
  | SelfCheckQuestion
