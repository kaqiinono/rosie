import type { Material, MediaSlot, QuestionGroup, SourceReference } from './content'

export interface ExamImageTask {
  retired: boolean
  slot: MediaSlot
  label: string
  questionNumbers: string[]
  source: SourceReference | null
  sourceAvailable: boolean
  sourceSha256: string | null
  group: QuestionGroup | null
  materials: readonly Material[]
  binding: { name: string; reviewed: boolean } | null
  savedRegion: SourceReference['region'] | null
  review: { status: 'pending' | 'approved' | 'flagged'; version: string | null; imageKey: string | null }
}

export interface ExamImageWorkspace {
  revisionId: string
  title: string
  version: string
  bindingRevisionId: string | null
  tasks: ExamImageTask[]
}

export interface ExamImageCropCommand {
  requestId: string
  revisionId: string
  slotId: string
  expectedVersion: string
  expectedBindingRevisionId: string | null
  sourceSha256: string
  region: NonNullable<SourceReference['region']>
}
