import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson, readExamJsonBody } from '@/lib/exams/http'
import { createExamAttempt, listExamAttempts, projectExamAttempt } from '@/lib/exams/attempts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await authorizeExamRequest(request)
    return examJson({ items: await listExamAttempts(createAdminSupabase(), user.id) })
  } catch (error) { return examFailure(error) }
}

export async function POST(request: Request) {
  try {
    const user = await authorizeExamRequest(request)
    const body = await readExamJsonBody(request)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ExamApiError('exam_invalid_request', 400)
    const result = await createExamAttempt(createAdminSupabase(), user.id, body as Record<string, unknown>)
    return examJson(projectExamAttempt(result), 201)
  } catch (error) { return examFailure(error) }
}
