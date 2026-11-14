import type { ContentProvenance, MaterialBlock, MediaSlot, QuestionId, SourceReference } from './content'

/** Type declarations only. Actual solution values must never enter the client barrel. */
export interface Explanation {
  readonly text: string
  readonly provenance: ContentProvenance
}

export interface SolutionEvidence {
  readonly source: SourceReference
  readonly quote: string
  readonly materialId?: string
  readonly blockId?: string
}

export interface WritingSample {
  readonly id: string
  readonly text: string
  readonly provenance: ContentProvenance
  /** Missing publisher scores remain null, never inferred from the sample's quality. */
  readonly originalScore: { readonly score: number; readonly maximum: number; readonly source: SourceReference } | null
  readonly originalComments: readonly Explanation[]
  readonly supplementaryComments: readonly Explanation[]
}

interface SolutionBase {
  readonly id: string
  readonly role: 'solution'
  readonly questionId: QuestionId
  readonly provenance: ContentProvenance
  /** Each explanation preserves its own source/translation/supplement and review state. */
  readonly explanations: readonly Explanation[]
  readonly evidence: readonly SolutionEvidence[]
  readonly distractors: readonly { readonly optionId: string; readonly explanation: Explanation }[]
}

export type Solution = SolutionBase & (
  | { readonly answerType: 'single_choice'; readonly correctOptionId: string }
  | { readonly answerType: 'multiple_choice'; readonly acceptedOptionSets: readonly (readonly string[])[] }
  | {
    readonly answerType: 'gap_fill'
    /** Complete valid combinations; do not mix alternatives into a Cartesian product. */
    readonly acceptedAnswerSets: readonly (readonly { readonly gapId: string; readonly value: string }[])[]
    /** Other spelling/date/number variants must be individually authored and reviewed above. */
    readonly normalization: { readonly trim: true; readonly ignoreCase: true }
  }
  | {
    readonly answerType: 'matching'
    readonly acceptedMatches: readonly (readonly { readonly itemId: string; readonly optionId: string }[])[]
  }
  | { readonly answerType: 'writing'; readonly samples: readonly WritingSample[]; readonly taskGuidance: readonly Explanation[] }
  | { readonly answerType: 'speaking'; readonly reviewGuidance: readonly Explanation[] }
  | { readonly answerType: 'self_check'; readonly guidance: readonly Explanation[] }
)

export interface TeacherNote {
  readonly id: string
  readonly role: 'teacher_notes'
  readonly sectionId: string
  readonly partNumber: number
  readonly groupIds: readonly string[]
  /** Separate scripts from scoring hints and suggested answers for later scoped access. */
  readonly kind: 'examiner_script' | 'teaching_guidance' | 'scoring_guidance' | 'listening_transcript'
  readonly blocks: readonly MaterialBlock[]
  readonly provenance: ContentProvenance
}

/** Private authoring payload; this is not a student review response or an access grant. */
export interface ExamSolutionRevision {
  readonly schemaVersion: 1
  readonly contentRevisionId: string
  readonly solutions: readonly Solution[]
  readonly teacherNotes: readonly TeacherNote[]
  readonly mediaSlots: readonly MediaSlot<'review' | 'parent' | 'admin'>[]
}
