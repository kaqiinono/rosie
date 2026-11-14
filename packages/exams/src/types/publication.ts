import type { ValidationIssue } from '../validation/contracts'

export type ExamReviewScope = 'exam' | 'explanations' | 'rubric'
export type ExamReviewDecision = 'approved' | 'blocked'

export interface ExamReviewRecord {
  id: string
  contentRevisionId: string
  contentVersion: string
  scope: ExamReviewScope
  decision: ExamReviewDecision
  reason: string | null
  actorId: string
  reviewedAt: string
}

export type ExamCurrentReviews = Record<ExamReviewScope, ExamReviewRecord | null>

export interface ExamPublicationReadiness {
  exam: ValidationIssue[]
  explanations: ValidationIssue[]
  canPublish: boolean
}

export interface ExamPublicationState {
  id: string
  version: string
  status: 'draft' | 'published' | 'withdrawn'
  reviews: ExamCurrentReviews
  readiness: ExamPublicationReadiness
}

export interface ExamPublicationReceipt {
  id: string
  version: string
  status: 'draft' | 'published' | 'withdrawn'
  updatedAt: string
}
