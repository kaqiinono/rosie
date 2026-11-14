import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson } from '@/lib/exams/http'
import { attemptStorageError, attemptUuid, checkAttemptMedia, expireAttemptIfNeeded, readAttemptEnvelope } from '@/lib/exams/attempts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeExamRequest(request)
    const id = attemptUuid((await context.params).id)
    const db = createAdminSupabase()
    const envelope = await expireAttemptIfNeeded(db, await readAttemptEnvelope(db, user.id, id))
    const { state, mediaBindingRevisionId } = envelope.attempt
    if (state.mode !== 'mock' || state.currentSectionId !== 'listening' || !mediaBindingRevisionId) throw new ExamApiError('exam_forbidden', 403)
    await checkAttemptMedia(db, envelope, 'listening')
    const result = await db.from('exam_media_binding_revisions').select('files').eq('id', mediaBindingRevisionId).single()
    if (result.error) attemptStorageError(result.error)
    const files = result.data.files as { slot_id: string; duration_ms: number | null }[]
    const steps = envelope.draft.content.mediaSlots.filter(slot => slot.purpose === 'exam_listening').map(slot => {
      const file = files.find(item => item.slot_id === slot.id)
      const endMs = slot.segment?.endMs ?? file?.duration_ms
      if (!slot.playback || !endMs) throw new ExamApiError('exam_playback_unavailable', 409)
      return { id: slot.id, url: `/api/exams/media?attemptId=${id}&slotId=${encodeURIComponent(slot.id)}&audience=student`,
        label: slot.sourceTrackLabel ?? '听力音轨', startMs: slot.segment?.startMs ?? 0, endMs,
        repeatCount: slot.playback.repeatCount, waitAfterMs: slot.playback.waitAfterMs }
    })
    return examJson({ steps, positionMs: state.playbackPositionMs })
  } catch (error) { return examFailure(error) }
}
