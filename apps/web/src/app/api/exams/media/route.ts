import { baiduAuthErrorCode } from '@rosie/core'
import type { ExamMediaGrant } from '@rosie/exams'
import { NextRequest } from 'next/server'
import { createAdminSupabase, getBearerToken, getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { ExamApiError, examFailure, examIdentifier } from '@/lib/exams/http'
import { EXAM_MEDIA_COOKIE, fetchExamBoundMedia, readExamMediaDraft } from '@/lib/exams/media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request) ?? request.cookies.get(EXAM_MEDIA_COOKIE)?.value
    if (!token) throw new ExamApiError('unauthorized', 401)
    const user = await getUserFromRequest(new Request(request.url, { headers: { Authorization: `Bearer ${token}` } }))
    if (!user) throw new ExamApiError('unauthorized', 401)
    const params = request.nextUrl.searchParams
    if ([...params.keys()].some(key => !['revisionId', 'attemptId', 'slotId', 'audience'].includes(key) || params.getAll(key).length !== 1)) throw new ExamApiError('exam_invalid_request', 400)
    const slotId = examIdentifier(params.get('slotId'))
    const db = createAdminSupabase()
    let grant: ExamMediaGrant
    if (params.has('revisionId')) {
      if (!isAdminRequestUser(user) || params.has('attemptId') || params.has('audience')) throw new ExamApiError('forbidden', 403)
      const revisionId = examIdentifier(params.get('revisionId'))
      const { draft } = await readExamMediaDraft(db, revisionId)
      if (!draft.content.mediaBindingRevisionId) throw new ExamApiError('exam_media_binding_missing', 409)
      grant = { contentRevisionId: revisionId, mediaBindingRevisionId: draft.content.mediaBindingRevisionId, slotId, audience: 'admin', wholeFileAllowed: true }
    } else {
      const attemptId = params.get('attemptId')
      const audience = params.get('audience') ?? 'student'
      if (!attemptId || !UUID.test(attemptId) || !['student', 'review', 'parent'].includes(audience)) throw new ExamApiError('exam_invalid_request', 400)
      // This service-only RPC is owned by the attempt/PIN authorization layer.
      // Missing authorization support fails closed; no revision-ID fallback exists.
      let sessionId: string | null = null
      try {
        const claims: unknown = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
        if (claims && typeof claims === 'object' && 'session_id' in claims && typeof claims.session_id === 'string' && UUID.test(claims.session_id)) sessionId = claims.session_id
      } catch { /* An absent validated session ID cannot authorize parent material. */ }
      const { data, error } = await db.rpc('authorize_exam_media', { p_user: user.id, p_attempt_id: attemptId, p_slot_id: slotId, p_audience: audience, p_session_id: sessionId })
      if (error) {
        const denied = ['exam_not_found', 'exam_forbidden', 'exam_attempt_closed', 'exam_pin_required'].includes(error.message)
        throw new ExamApiError(denied ? error.message : 'exam_media_unavailable', denied ? 403 : 503)
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ExamApiError('forbidden', 403)
      const value = data as Record<string, unknown>
      if (value.slotId !== slotId || value.audience !== audience || value.wholeFileAllowed !== true || typeof value.mediaBindingRevisionId !== 'string' || !UUID.test(value.mediaBindingRevisionId)) throw new ExamApiError('forbidden', 403)
      grant = { contentRevisionId: examIdentifier(value.contentRevisionId), mediaBindingRevisionId: value.mediaBindingRevisionId, slotId, audience: audience as 'student' | 'review' | 'parent', wholeFileAllowed: true }
    }
    return await fetchExamBoundMedia(grant, request.headers.get('range'), request.signal, db)
  } catch (error) {
    const code = baiduAuthErrorCode(error)
    if (code) return examFailure(new ExamApiError(code, 409))
    if (error instanceof Error && error.message === 'baidu_file_changed') return examFailure(new ExamApiError('exam_media_binding_changed', 409))
    return examFailure(error)
  }
}
