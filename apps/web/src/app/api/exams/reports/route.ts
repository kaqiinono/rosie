import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson } from '@/lib/exams/http'
import { readExamReport } from '@/lib/exams/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await authorizeExamRequest(request)
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some(key => key !== 'days') || params.getAll('days').length > 1
      || (params.has('days') && !['14', '28'].includes(params.get('days') ?? ''))) throw new ExamApiError('exam_invalid_request', 400)
    return examJson(await readExamReport(createAdminSupabase(), user.id, params.get('days') === '28' ? 28 : 14))
  } catch (error) { return examFailure(error) }
}
