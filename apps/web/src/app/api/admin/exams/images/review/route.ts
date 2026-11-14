import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examIdentifier, examJson, readExamJsonBody } from '@/lib/exams/http'
import { reviewExamImageTask } from '@/lib/exams/imageReview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const actor = await authorizeExamRequest(request, true)
    const value = await readExamJsonBody(request)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ExamApiError('exam_invalid_request', 400)
    const body = value as Record<string, unknown>
    if (Object.keys(body).some(key => !['revisionId', 'slotId', 'imageKey', 'expectedReviewVersion', 'status'].includes(key))
      || typeof body.imageKey !== 'string' || !/^[0-9a-f]{64}$/.test(body.imageKey)
      || (body.expectedReviewVersion !== null && (typeof body.expectedReviewVersion !== 'string' || !UUID.test(body.expectedReviewVersion)))
      || !['pending', 'approved', 'flagged'].includes(String(body.status))) throw new ExamApiError('exam_invalid_request', 400)
    return examJson(await reviewExamImageTask(createAdminSupabase(), actor.id, {
      revisionId: examIdentifier(body.revisionId), slotId: examIdentifier(body.slotId), imageKey: body.imageKey,
      expectedReviewVersion: body.expectedReviewVersion as string | null, status: body.status as 'pending' | 'approved' | 'flagged',
    }))
  } catch (error) { return examFailure(error) }
}
