import { type ExamDraftInput, type ValidationIssue, type ValidationResult } from './contracts'
import { validateDraftReferences } from './references'
import { validateDraftShape, validateJsonBounds } from './schema'

export type { ExamDraftInput, ValidationIssue, ValidationResult } from './contracts'
export { describeExamDraftReadiness } from './readiness'
export { isExamInk } from './handwriting'
export { describeExamPublicationReadiness } from './publication'
export type {
  ExamReviewScope, ExamReviewDecision, ExamReviewRecord, ExamCurrentReviews,
  ExamPublicationReadiness, ExamPublicationState, ExamPublicationReceipt,
} from '../types/publication'

/** Validate storage structure and references, without granting review/publication authority. */
export function validateExamDraft(input: unknown): ValidationResult<ExamDraftInput> {
  const issues: ValidationIssue[] = []
  validateJsonBounds(input, issues)
  if (issues.length) return { ok: false, issues }
  validateDraftShape(input, '$', issues)
  if (issues.length) return { ok: false, issues }
  // Every property and discriminated variant has now passed the exact structural schema.
  const value = input as ExamDraftInput
  validateDraftReferences(value, issues)
  return issues.length ? { ok: false, issues } : { ok: true, value }
}
