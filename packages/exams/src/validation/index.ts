import { type ExamDraftInput, type ValidationIssue, type ValidationResult } from './contracts'
import { validateDraftReferences } from './references'
import { validateDraftShape, validateJsonBounds } from './schema'

export type { ExamDraftInput, ValidationIssue, ValidationResult } from './contracts'
export { describeExamDraftReadiness } from './readiness'
export { isExamInk } from './handwriting'
export { examVocabularyText } from './vocabularyText'
export { describeExamPublicationReadiness } from './publication'
export type {
  ExamReviewScope, ExamReviewDecision, ExamReviewRecord, ExamCurrentReviews,
  ExamPublicationReadiness, ExamPublicationState, ExamPublicationReceipt,
} from '../types/publication'

/** Validate storage structure and references, without granting review/publication authority. */
export function validateExamDraft(input: unknown, options?: { regenerateVocabulary: boolean }): ValidationResult<ExamDraftInput> {
  const issues: ValidationIssue[] = []
  validateJsonBounds(input, issues)
  if (issues.length) return { ok: false, issues }
  validateDraftShape(input, '$', issues)
  if (issues.length) return { ok: false, issues }
  // Every property and discriminated variant has now passed the exact structural schema.
  const draft = input as ExamDraftInput
  const value = options?.regenerateVocabulary
    ? { ...draft, content: { ...draft.content, vocabularyLinks: draft.content.vocabularyLinks.filter(link => !link.matchSource) } }
    : draft
  validateDraftReferences(value, issues)
  return issues.length ? { ok: false, issues } : { ok: true, value }
}
