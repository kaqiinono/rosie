import type { ExamContentSet } from './content'

export interface ExamCatalogEntry {
  contentSetId: string
  revisionId: string
  revision: number
  title: string
  source: { id: string; title: string }
  kind: ExamContentSet['kind']
  purpose: ExamContentSet['purpose']
}

export interface ExamPracticeGroup {
  revisionId: string
  groupId: string
  title: string
  sectionId: string
  partNumber: number
  role: 'exam' | 'training'
  questionCount: number
  matchedQuestionCount: number
  seen: boolean
  domains: string[]
  questionTypes: string[]
  knowledgePoints: string[]
  sectionLabel: string
  partLabel: string
  questionTypeLabels: string[]
}

export interface ExamPracticeOption { value: string; label: string }

/** Metadata only, derived from eligible published training content. */
export interface ExamPracticeOptions {
  revisions: ExamPracticeOption[]
  sections: ExamPracticeOption[]
  parts: ExamPracticeOption[]
  domains: ExamPracticeOption[]
  questionTypes: ExamPracticeOption[]
  knowledgePoints: ExamPracticeOption[]
  words: ExamPracticeOption[]
}

export interface ExamPracticePage {
  items: ExamPracticeGroup[]
  page: number
  pageSize: number
  hasMore: boolean
  catalogLimited: boolean
  optionsLimited: boolean
  options: ExamPracticeOptions
}
