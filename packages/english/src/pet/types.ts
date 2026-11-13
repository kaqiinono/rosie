export type PetSource = {
  file: string
  page: number
  question?: number
  rawHeadword?: string
  sourceRowId?: string
  version?: string
  sourceTitle?: string
  topic?: string
}

export type PetSense = {
  id: string
  partOfSpeech: string[]
  definitionEn: string
  definitionZh: string
  example: string
  exampleZh: string
  collocations: string[]
  confusions?: string[]
}

export type PetWordContent = {
  wordEntryId: string
  revision: string
  topics: string[]
  primaryTopic?: string
  priorities: string[]
  aliases: string[]
  senses: PetSense[]
  sources: PetSource[]
}

export type PetItemKind = 'context' | 'spelling' | 'listening' | 'word_form'
export type PetSetKind = 'sentence' | 'exam' | 'forms'
export type PetMode = PetItemKind | PetSetKind | 'review'
export type PetFeedbackMode = 'training' | 'assessment'
export type PetTrack = 'daily' | 'specialist'

export type PetItem = {
  id: string
  wordEntryId?: string
  wordKey?: string
  kind: PetItemKind
  prompt: string
  acceptedAnswerSets: string[][]
  options?: string[]
  explanation?: string
  translation?: string
  senseId?: string
  exerciseSetId?: string
  contentRevision?: string
  wordContentRevision?: string
  source?: PetSource
  targetForm?: string
  spokenText?: string
}

export type PetExerciseSet = {
  id: string
  revision: string
  kind: PetSetKind
  title: string
  topic: string | null
  passage: string | null
  wordPool: string[]
  items: PetItem[]
}

export type PetAnswer = {
  draftAnswers?: string[]
  firstAnswers: string[] | null
  firstCorrect: boolean | null
  usedHelp: boolean
  revealed?: boolean
  retries: { answers: string[]; correct: boolean }[]
  skippedAudio: boolean
}

export type PetReviewProgress = {
  wordEntryId: string
  intervalIndex: number
  dueOn: string
  lastReviewedOn: string | null
  updatedAt: string
}

export type PetSession = {
  id: string
  version: number
  status: 'active' | 'completed' | 'abandoned'
  mode: PetMode
  track: PetTrack
  feedbackMode: PetFeedbackMode
  source: string
  setId: string | null
  setRevision: string | null
  items: PetItem[]
  passage: string | null
  wordPool: string[]
  reviewWordIds: string[]
  timerEnabled: boolean
  answers: Record<string, PetAnswer>
  itemIndex: number
  startedAt: string
  completedAt: string | null
  updatedAt: string
}

export type PetStartSessionInput = {
  mode: PetMode
  track?: PetTrack
  feedbackMode: PetFeedbackMode
  source?: string
  items?: PetItem[]
  setId?: string
  setRevision?: string
  retrySessionId?: string
  passage?: string
  reviewWordIds?: string[]
  timerEnabled?: boolean
  timeZone?: string
  requestId?: string
}

export type PetSessionAction = { requestId?: string } & (
  | { type: 'draft' | 'answer'; itemId: string; answers: string[] }
  | { type: 'help' | 'skip_audio'; itemId: string }
  | { type: 'navigate'; itemIndex: number }
)
