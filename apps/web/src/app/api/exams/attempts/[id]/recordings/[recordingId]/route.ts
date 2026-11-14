import { createAdminSupabase, isAdminRequestUser } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson } from '@/lib/exams/http'
import { attemptUuid } from '@/lib/exams/attempts'
import { playExamRecording, uploadExamRecording } from '@/lib/exams/recordings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string; recordingId: string }> }

export async function PUT(request: Request, context: Context) {
  try {
    const user = await authorizeExamRequest(request)
    const params = await context.params
    if (new URL(request.url).search) throw new ExamApiError('exam_invalid_request', 400)
    return examJson({ recording: await uploadExamRecording(createAdminSupabase(), user.id,
      attemptUuid(params.id), attemptUuid(params.recordingId), request) })
  } catch (error) { return examFailure(error) }
}

export async function GET(request: Request, context: Context) {
  try {
    const user = await authorizeExamRequest(request)
    const params = await context.params
    const query = new URL(request.url).searchParams
    if ([...query.keys()].some(key => key !== 'ownerId') || query.getAll('ownerId').length > 1) throw new ExamApiError('exam_invalid_request', 400)
    let ownerId = user.id
    if (query.has('ownerId')) {
      if (!isAdminRequestUser(user)) throw new ExamApiError('forbidden', 403)
      ownerId = attemptUuid(query.get('ownerId'))
    }
    return await playExamRecording(createAdminSupabase(), ownerId, attemptUuid(params.id), attemptUuid(params.recordingId))
  } catch (error) { return examFailure(error) }
}
