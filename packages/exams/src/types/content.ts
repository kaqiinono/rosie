import type { ExamAnswerType, Question } from './questions'

export type ContentRole = 'exam' | 'training' | 'guidance' | 'teacher_notes' | 'solution'
export type QuestionRole = Extract<ContentRole, 'exam' | 'training'>
export type AbilityDomain = 'reading' | 'listening' | 'writing' | 'speaking' | 'grammar' | 'vocabulary'

export type ContentReview =
  | { readonly status: 'pending' }
  | { readonly status: 'approved'; readonly reviewedBy: string; readonly reviewedAt: string }
  | { readonly status: 'blocked'; readonly reason: string }

export interface ExamSource {
  readonly id: string
  readonly title: string
  /** Identifies this particular PDF/edition, without exposing a local path. */
  readonly edition?: string
  readonly fileHash?: string
}

export interface SourceReference {
  readonly sourceId: string
  /** Both page systems are explicit; PDF pages are one-based. */
  readonly pdfPage: number
  readonly printedPage: string | null
  readonly role: ContentRole
  /** Optional crop in normalized page coordinates (0–1), never a full-page answer URL. */
  readonly region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}

export interface ContentProvenance {
  readonly origin: 'source' | 'translation' | 'supplement'
  readonly sources: readonly SourceReference[]
  readonly authorship?: 'human' | 'ai_assisted'
  readonly review: ContentReview
}

export interface QuestionLocation {
  readonly sourceId: string
  readonly testNumber: number
  readonly role: QuestionRole
  /** Template-owned section ID, e.g. reading_writing; not an ability tag. */
  readonly sectionId: string
  readonly partNumber: number
  readonly questionNumber: string
}

/** Final segment preserves printed numbering, including explicitly named examples. */
export type QuestionId = `${string}:test-${number}:${QuestionRole}:${string}:part-${number}:${string}`

export interface QuestionClassification {
  readonly domain: AbilityDomain
  readonly questionTypeId: string
  /** Exactly one primary skill for mutually exclusive aggregates. */
  readonly primarySkillId: string
  readonly knowledgePointIds: readonly string[]
  readonly topicIds: readonly string[]
  readonly review: ContentReview
}

export interface AnswerSlot {
  readonly sourceText?: string
  readonly start: number
  readonly end: number
  readonly questionId: QuestionId
  readonly gapId?: string
  /** Email body/table row and optional table column. */
  readonly row?: number
  readonly column?: number
}
export type MaterialBlock = {
  readonly id: string
  readonly answerSlots?: readonly AnswerSlot[]
  readonly sentences?: readonly { readonly id: string; readonly start: number; readonly end: number; readonly sourceText?: string }[]
} & (
  | { readonly kind: 'text'; readonly text: string; readonly presentation?:
    | { readonly role: 'heading'; readonly prefix?: string; readonly originalText?: string }
    | { readonly role: 'instruction'; readonly number: string; readonly originalText?: string } }
  | { readonly kind: 'email'; readonly from: string; readonly to: string; readonly subject: string; readonly body: readonly string[] }
  | { readonly kind: 'table'; readonly headers: readonly string[]; readonly rows: readonly (readonly string[])[] }
  | { readonly kind: 'image'; readonly mediaSlotId: string; readonly alt: string; readonly caption?: string; readonly aspectRatio?: number; readonly displayWidth?: number }
  | { readonly kind: 'audio'; readonly mediaSlotId: string }
)

export interface Material {
  readonly id: string
  /** Stable across renumbering and revisions; deduplication is reviewed, not inferred here. */
  readonly familyId: string
  readonly role: QuestionRole
  readonly title: string
  readonly blocks: readonly MaterialBlock[]
  /** Ordered explicit partitions; every block appears exactly once. */
  readonly layout?: readonly {
    readonly id: string
    readonly headingBlockId?: string
    readonly bodyBlockIds: readonly string[]
    readonly imageBlockId?: string
    readonly imageSide?: 'left' | 'right'
  }[]
  readonly provenance: ContentProvenance
}

export interface ExamOption {
  readonly id: string
  readonly label: string
  readonly imageSlotId?: string
  readonly displayWidth?: number
  /** Normalized viewport within the bound image, not the source PDF. */
  readonly imageRegion?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}

export interface ExamActivity {
  readonly id: string
  readonly title: string
  readonly instructionIds: readonly string[]
  readonly materialIds: readonly string[]
  readonly questionIds: readonly QuestionId[]
  readonly layout: 'questions' | 'matching' | 'image_labels' | 'cloze' | 'handwriting'
  readonly handwritingSize?: 'letter' | 'word'
  /** Authored categories, never inferred from the number of options. Values use the gap answer contract. */
  readonly choicePresentation?: { readonly kind: 'judgment' | 'letters'; readonly options: readonly { readonly value: string; readonly label: string }[] }
  readonly wordBank?: readonly string[]
  /** Width of a standalone activity illustration; material images own their widths. */
  readonly imageDisplayWidth?: number
  readonly imageSlotId?: string
  readonly positions?: readonly { readonly questionId: QuestionId; readonly x: number; readonly y: number }[]
}

export interface QuestionGroup {
  readonly id: string
  readonly role: QuestionRole
  readonly sectionId: string
  readonly partNumber: number
  readonly instructions: readonly MaterialBlock[]
  readonly materialIds: readonly string[]
  readonly optionPools: readonly {
    readonly id: string
    readonly options: readonly ExamOption[]
    readonly allowReuse: boolean
  }[]
  /** The entire group is selected together, including all shared material and options. */
  readonly activities?: readonly ExamActivity[]
  readonly questions: readonly Question[]
  readonly provenance: ContentProvenance
}

export interface Guidance {
  readonly id: string
  readonly role: 'guidance'
  readonly groupIds: readonly string[]
  readonly blocks: readonly MaterialBlock[]
  readonly provenance: ContentProvenance
}

export type MediaAudience = 'student' | 'review' | 'parent' | 'admin'

interface MediaPurposeByAudience {
  readonly student: 'exam_listening' | 'training_audio' | 'question_image'
  readonly review: 'speaking_example' | 'solution_image'
  readonly parent: 'examiner_audio' | 'examiner_image'
  readonly admin: 'source_page'
}

interface MediaSlotBase {
  readonly id: string
  readonly target: { readonly kind: 'content_set' | 'group' | 'guidance' | 'teacher_notes'; readonly id: string }
  readonly sourceTrackLabel: string | null
  readonly required: boolean
  /** Null until actual audio has been reviewed; never guessed from text. */
  readonly segment: { readonly startMs: number; readonly endMs: number } | null
  readonly playback: {
    readonly repeatCount: number
    readonly waitAfterMs: number
    readonly includesSourceRepetitions: boolean
  } | null
  readonly provenance: ContentProvenance
}

/** Source-page scans and review examples cannot be declared as student slots. */
export type MediaSlot<Audience extends MediaAudience = MediaAudience> = {
  [Scope in Audience]: MediaSlotBase & {
    readonly audience: Scope
    readonly purpose: MediaPurposeByAudience[Scope]
  }
}[Audience]

export interface VocabularyLink {
  readonly id: string
  /** Required canonical word_entries.id; never a spelling or legacy mastery key. */
  readonly wordEntryId: string
  readonly sourceSnapshot: { readonly stage: string; readonly unit: string; readonly lesson: string; readonly word: string }
  readonly questionIds: readonly QuestionId[]
  readonly materialId: string
  readonly blockId: string
  readonly matchedForm: string
  readonly contextMeaning: string
  readonly sentence: string
  /** UTF-16 offsets into the referenced text block; end is exclusive. */
  readonly textRange: { readonly start: number; readonly end: number }
  readonly role: 'key' | 'background'
  readonly review: ContentReview
}

export interface ExamTemplateRef {
  readonly id: string
  readonly version: number
}

export interface ExamPartTemplate {
  readonly number: number
  readonly label: string
  readonly domains: readonly AbilityDomain[]
  readonly questionTypeId: string
  readonly answerTypes: readonly ExamAnswerType[]
}

export interface ExamSectionTemplate {
  readonly id: string
  readonly label: string
  readonly parts: readonly ExamPartTemplate[]
  readonly objectiveQuestionCount: number
  readonly writingTaskCount: number
  readonly speakingPartCount: number
  /** Content metadata only; does not authorize a timer or automatic submission. */
  readonly timing:
    | { readonly kind: 'fixed_duration'; readonly seconds: number }
    | { readonly kind: 'reviewed_audio_program' }
    | { readonly kind: 'record_elapsed' }
}

export interface ExamTemplate extends ExamTemplateRef {
  readonly examType: string
  readonly title: string
  readonly sections: readonly ExamSectionTemplate[]
  readonly rubrics: readonly {
    readonly id: string
    readonly domain: 'writing' | 'speaking'
    readonly dimensions: readonly {
      readonly id: string
      readonly label: string
      /** Null means the source scale still needs review; it is not a zero score. */
      readonly range: { readonly min: number; readonly max: number } | null
    }[]
  }[]
}

export interface ExamContentSet {
  readonly id: string
  readonly source: ExamSource
  readonly testNumber: number
  readonly title: string
  readonly kind: 'official_paper' | 'mock_paper' | 'training_unit'
  readonly template: ExamTemplateRef
  readonly purpose: 'training' | 'reserved'
}

/** Stored authoring content, NOT an API response. Mode/access filtering belongs on the server. */
export interface ExamContentRevision {
  readonly schemaVersion: 1
  readonly id: string
  readonly contentSetId: string
  readonly revision: number
  readonly status: 'draft' | 'published' | 'withdrawn'
  readonly materials: readonly Material[]
  readonly groups: readonly QuestionGroup[]
  readonly guidance: readonly Guidance[]
  readonly vocabularyLinks: readonly VocabularyLink[]
  /** Metadata only. Bound account/file IDs and credentials never belong in this object. */
  readonly mediaSlots: readonly MediaSlot<'student'>[]
  readonly mediaBindingRevisionId: string | null
  readonly readiness: {
    readonly exam: ContentReview
    readonly explanations: ContentReview
  }
}
