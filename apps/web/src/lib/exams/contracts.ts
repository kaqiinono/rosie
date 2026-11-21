import type { ExamContentSet } from '@rosie/exams'
import type { ExamDraftInput } from '@rosie/exams/validation'

export interface ExamCatalogItem {
  contentSetId: string
  revisionId: string
  revision: number
  title: string
  source: { id: string; title: string }
  kind: ExamContentSet['kind']
  template: ExamContentSet['template']
  purpose: ExamContentSet['purpose']
}

export interface ExamDraftListItem extends ExamCatalogItem {
  version: string
  status: 'draft'
  createdAt: string
  updatedAt: string
}

export interface ExamPage<T> {
  items: T[]
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ExamAdminListItem extends ExamCatalogItem {
  version: string
  status: 'draft' | 'published' | 'withdrawn'
  createdAt: string
  updatedAt: string
}

export interface ExamDraftRecord {
  draft: ExamDraftInput
  status: ExamAdminListItem['status']
  supersededBy: string | null
  version: string
  createdAt: string
  updatedAt: string
}

export interface ExamDraftReceipt {
  id: string
  contentSetId: string
  revision: number
  version: string
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}
