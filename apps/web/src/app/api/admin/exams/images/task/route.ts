import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examIdentifier, examFailure, examJson, readExamJsonBody, ExamApiError } from '@/lib/exams/http'
import { retireImageTask } from '@/lib/exams/imageTaskDeletion'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const actor = await authorizeExamRequest(request, true)
    const value = await readExamJsonBody(request)
    if (!value || typeof value !== 'object') throw new ExamApiError('exam_invalid_request', 400)
    const body = value as Record<string, unknown>
    if (typeof body.retired !== 'boolean' || typeof body.expectedVersion !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.expectedVersion)) throw new ExamApiError('exam_invalid_request', 400)
    return examJson(await retireImageTask(createAdminSupabase(), actor.id, examIdentifier(body.revisionId), examIdentifier(body.slotId), body.expectedVersion, body.retired))
  } catch (error) { return examFailure(error) }
}
