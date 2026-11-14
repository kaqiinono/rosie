import type { ExamContentRevision, ExamContentSet } from '../types/content'
import type { ExamSolutionRevision } from '../types/solutions'

export interface ExamDraftInput {
  contentSet: ExamContentSet
  content: ExamContentRevision
  solutions: ExamSolutionRevision
}

export interface ValidationIssue {
  path: string
  code: string
  message: string
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] }

/** Bounded, value-free errors: an administrator can locate a problem without echoing answers. */
export function issue(issues: ValidationIssue[], path: string, code: string, message: string): void {
  if (issues.length < 100) issues.push({ path, code, message })
}
