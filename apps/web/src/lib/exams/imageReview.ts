import 'server-only'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ExamApiError } from './http'
import { readExamMediaBinding, readExamMediaDraft, type StoredExamMediaFile } from './media'

export function imageReviewKey(file: StoredExamMediaFile): string {
  return createHash('sha256').update(JSON.stringify(file)).digest('hex')
}

export async function reviewExamImageTask(db: SupabaseClient, actorId: string, command: {
  revisionId: string; slotId: string; imageKey: string; expectedReviewVersion: string | null; status: 'pending' | 'approved' | 'flagged'
}) {
  const { draft, status } = await readExamMediaDraft(db, command.revisionId)
  if (status !== 'draft') throw new ExamApiError('exam_not_editable', 409)
  const slot = draft.content.mediaSlots.find(item => item.id === command.slotId && item.purpose === 'question_image')
  const binding = draft.content.mediaBindingRevisionId ? await readExamMediaBinding(db, command.revisionId, draft.content.mediaBindingRevisionId) : null
  const file = binding?.files.find(item => item.slot_id === command.slotId && isDeepStrictEqual(item.slot, slot))
  if (!file || imageReviewKey(file) !== command.imageKey) throw new ExamApiError('exam_image_review_changed', 409)
  const { data, error } = await db.rpc('review_exam_image_task', { p_revision: command.revisionId, p_slot: command.slotId,
    p_actor: actorId, p_status: command.status, p_file: file, p_expected_review: command.expectedReviewVersion })
  if (error) throw new ExamApiError(['exam_image_review_changed', 'exam_image_task_removed', 'exam_not_editable'].includes(error.message)
    ? error.message : 'exam_image_storage_unavailable', ['exam_image_review_changed', 'exam_image_task_removed', 'exam_not_editable'].includes(error.message) ? 409 : 503)
  return data as { status: 'pending' | 'approved' | 'flagged'; version: string }
}
