import type { ExamPublicationReadiness } from '../types/publication'
import type { ExamMediaVerification } from '../types/media'
import type { ExamDraftInput } from './contracts'
import { describeExamDraftReadiness } from './readiness'
import { validateExamDraft } from './index'

export function describeExamPublicationReadiness(
  draft: ExamDraftInput,
  context: { media?: ExamMediaVerification },
): ExamPublicationReadiness {
  const validation = validateExamDraft(draft)
  if (!validation.ok) return { exam: [...validation.issues], explanations: [], canPublish: false }
  const { exam, explanations } = describeExamDraftReadiness(draft, true)
  const verified = new Set(context.media && context.media.bindingRevisionId === draft.content.mediaBindingRevisionId
    ? context.media.verifiedSlotIds : [])
  for (const [slots, target, path] of [
    [draft.content.mediaSlots, exam, '$.content.mediaSlots'],
    [draft.solutions.mediaSlots, explanations, '$.solutions.mediaSlots'],
  ] as const) {
    slots.forEach((slot, index) => {
      if (slot.required && !verified.has(slot.id)) target.push({
        path: `${path}[${index}]`, code: 'publication_media_unverified',
        message: '必需资源缺少有效绑定，或文件无法读取。',
      })
    })
  }
  return { exam, explanations, canPublish: exam.length === 0 && explanations.length === 0 }
}
