import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson } from '@/lib/exams/http'
import { attemptUuid, listExamAttempts } from '@/lib/exams/attempts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some(key => key !== 'userId') || params.getAll('userId').length !== 1) throw new ExamApiError('exam_invalid_request', 400)
    const userId = attemptUuid(params.get('userId'))
    return examJson({ userId, items: await listExamAttempts(createAdminSupabase(), userId) })
  } catch (error) { return examFailure(error) }
}
