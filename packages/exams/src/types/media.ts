import type { MediaAudience, MediaSlot } from './content'

/** Authorized server result; clients cannot choose a binding revision or file. */
export interface ExamMediaGrant {
  contentRevisionId: string
  mediaBindingRevisionId: string
  slotId: string
  audience: MediaAudience
  /** Range serves a full file; every sibling slot sharing it must be authorized. */
  wholeFileAllowed: true
}

export interface ExamMediaVerification {
  bindingRevisionId: string
  verifiedSlotIds: readonly string[]
  checkedAt: string
}

export interface ExamMediaEditor {
  revisionId: string
  testNumber: number
  version: string
  bindingRevisionId: string | null
  listeningDirectory: ExamListeningDirectory | null
  listeningDirectoryVersion: string | null
  parts: readonly { sectionId: string; partNumber: number; label: string; slotIds: readonly string[] }[]
  slots: readonly (MediaSlot & { binding: { fileId: string; name: string; size: number; reviewed: boolean; durationMs: number | null } | null })[]
}

export interface ExamListeningDirectory { directory_id: string; path: string; generation: string }

export type ExamListeningDirectoryRequest = Pick<ExamMediaSaveRequest,
  'revisionId' | 'expectedVersion' | 'requestId' | 'accountGeneration' | 'directoryId' | 'mainPath'> & {
  expectedDirectoryVersion: string | null
}

export interface ExamMediaSaveRequest {
  revisionId: string
  /** Listening spans authored audio across Parts. Null selects whole-set shared slots. */
  scope?: 'listening' | { sectionId: string; partNumber: number } | null
  expectedVersion: string
  expectedBindingRevisionId: string | null
  requestId: string
  accountGeneration: string
  directoryId: string
  mainPath: string
  picks: readonly { slotId: string; fileId: string; path: string; reviewed: boolean; durationMs?: number | null }[]
  removeSlotIds?: readonly string[]
  updates?: readonly { slotId: string; reviewed: boolean; durationMs: number | null }[]
}

export interface ExamMediaSaveReceipt { revisionId: string; version: string; bindingRevisionId: string }
