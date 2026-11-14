import { createAdminSupabase, isAdminRequestUser } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson } from '@/lib/exams/http'
import { attemptUuid } from '@/lib/exams/attempts'
import { assessmentBody } from '@/lib/exams/recordings'
import { requireExamParentPin } from '@/lib/exams/parentAccess'
import { gradeHandwriting, readHandwritingAssessment } from '@/lib/exams/handwriting'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const user = await authorizeExamRequest(request)
    const query = new URL(request.url).searchParams
    if ([...query.keys()].some(key => key !== 'ownerId') || query.getAll('ownerId').length > 1) throw new ExamApiError('exam_invalid_request', 400)
    let ownerId = user.id
    if (query.has('ownerId')) {
      if (!isAdminRequestUser(user)) throw new ExamApiError('forbidden', 403)
      ownerId = attemptUuid(query.get('ownerId'))
    }
    return examJson(await readHandwritingAssessment(createAdminSupabase(), ownerId, attemptUuid((await context.params).id)))
  } catch (error) { return examFailure(error) }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await authorizeExamRequest(request)
    const body = await assessmentBody(request, ['requestId', 'expectedVersion', 'questionId', 'decision', 'comment', 'pin', 'ownerId'])
    const db = createAdminSupabase()
    let ownerId = user.id
    if (body.ownerId !== undefined) {
      if (!isAdminRequestUser(user) || body.pin !== undefined) throw new ExamApiError('forbidden', 403)
      ownerId = attemptUuid(body.ownerId)
    } else await requireExamParentPin(db, ownerId, body.pin)
    return examJson(await gradeHandwriting(db, ownerId, user.id, attemptUuid((await context.params).id), body))
  } catch (error) { return examFailure(error) }
}
