import type { VocabularyLink } from './content'

/** Canonical dictionary identity selected by an administrator, never invented. */
export interface ExamAdminWordChoice {
  id: string
  sourceSnapshot: VocabularyLink['sourceSnapshot']
}

export interface ExamAdminWordSearch {
  query: string
  items: ExamAdminWordChoice[]
  hasMore: boolean
}
