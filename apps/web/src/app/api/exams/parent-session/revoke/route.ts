import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson } from '@/lib/exams/http'
import { verifiedExamSessionId } from '@/lib/exams/parentAccess'
import { assessmentStorageError } from '@/lib/exams/recordings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await authorizeExamRequest(request)
    const sessionId = verifiedExamSessionId(request)
    if (request.body || new URL(request.url).search) throw new ExamApiError('exam_invalid_request', 400)
    const { error } = await createAdminSupabase().rpc('revoke_exam_parent_session', { p_user: user.id, p_session_id: sessionId })
    if (error) assessmentStorageError(error)
    return examJson({ revoked: true })
  } catch (error) { return examFailure(error) }
}
