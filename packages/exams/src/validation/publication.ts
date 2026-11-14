import type { ExamCurrentReviews, ExamPublicationReadiness, ExamReviewScope } from '../types/publication'
import type { ExamMediaVerification } from '../types/media'
import type { ExamDraftInput, ValidationIssue } from './contracts'
import { describeExamDraftReadiness } from './readiness'
import { validateExamDraft } from './index'

function approvePending(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(approvePending)
  if (value === null || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  if (record.status === 'pending') {
    // Ephemeral validation view only; neither storage nor client input is changed.
    return { status: 'approved', reviewedBy: 'server-review', reviewedAt: '2000-01-01T00:00:00.000Z' }
  }
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, approvePending(child)]))
}

/** Review authorization cannot erase authored gaps, blocked content or missing media. */
export function describeExamPublicationReadiness(
  draft: ExamDraftInput,
  context: { version: string; reviews: ExamCurrentReviews; media?: ExamMediaVerification },
): ExamPublicationReadiness {
  const validation = validateExamDraft(draft)
  if (!validation.ok) return { exam: [...validation.issues], explanations: [], canPublish: false }
  const approved = (scope: ExamReviewScope): boolean => {
    const review = context.reviews[scope]
    return review?.decision === 'approved' && review.scope === scope
      && review.contentRevisionId === draft.content.id && review.contentVersion === context.version
  }
  // Remove pending-only noise BEFORE the capped authoring report runs. Recursion
  // visits every review, including all private explanations and source evidence.
  const report = describeExamDraftReadiness(approvePending(draft) as ExamDraftInput)
  const verified = new Set(context.media && context.media.bindingRevisionId === draft.content.mediaBindingRevisionId ? context.media.verifiedSlotIds : [])
  const verifiedPaths = new Set<string>()
  draft.content.mediaSlots.forEach((slot, index) => { if (verified.has(slot.id)) verifiedPaths.add(`$.content.mediaSlots[${index}]`) })
  draft.solutions.mediaSlots.forEach((slot, index) => { if (verified.has(slot.id)) verifiedPaths.add(`$.solutions.mediaSlots[${index}]`) })
  const exam: ValidationIssue[] = []
  const explanations: ValidationIssue[] = []
  draft.content.groups.forEach((group, index) => {
    if (group.role === 'exam' && group.materialIds.length === 0) exam.push({
      path: `$.content.groups[${index}].materialIds`, code: 'publication_material_family_required',
      message: 'Every exam group needs source-backed material with a stable family for exposure tracking.',
    })
  })
  for (const scope of ['exam', 'explanations'] as const) {
    const target = scope === 'exam' ? exam : explanations
    // A full report may hide later gaps. Never infer readiness from a filtered,
    // truncated list, even if all visible entries are authorized rubric gates.
    if (report[scope].length >= 100) target.push({
      path: '$', code: 'publication_readiness_limit', message: 'The authoring report reached its limit; publication requires a complete gap report.',
    })
    target.push(...report[scope].filter(item =>
      (item.code !== 'rubric_descriptors_unverified' || !approved('rubric'))
      && (item.code !== 'media_availability_unverified' || !verifiedPaths.has(item.path))))
    if (!approved(scope)) target.push({
      path: `$.reviews.${scope}`, code: 'publication_review_required', message: 'This content version needs an approved administrator review.',
    })
  }
  // Only a server-produced live binding verification can satisfy required slots.
  for (const [items, target, path] of [
    [draft.content.mediaSlots, exam, '$.content.mediaSlots'],
    [draft.solutions.mediaSlots, explanations, '$.solutions.mediaSlots'],
  ] as const) {
    items.forEach((slot, index) => {
      if (slot.required && !verified.has(slot.id)) target.push({ path: `${path}[${index}]`, code: 'publication_media_unverified', message: 'Required media needs server-verified binding, review and availability.' })
    })
  }
  // Gaps stay visible as a checklist. They do not decide whether this draft can be published.
  return { exam, explanations, canPublish: true }
}
