import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson, examPageRequest } from '@/lib/exams/http'
import { listAdminExamRevisions } from '@/lib/exams/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const url = new URL(request.url)
    const values = url.searchParams.getAll('status')
    const status = values[0] ?? 'draft'
    if (values.length > 1 || !['draft', 'published', 'withdrawn'].includes(status)) throw new ExamApiError('exam_invalid_status', 400)
    url.searchParams.delete('status')
    const page = examPageRequest(new Request(url))
    return examJson(await listAdminExamRevisions(createAdminSupabase(), page, status as 'draft' | 'published' | 'withdrawn'))
  } catch (error) { return examFailure(error) }
}
