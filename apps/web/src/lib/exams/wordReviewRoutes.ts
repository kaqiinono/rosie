import 'server-only'
import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson, readExamJsonBody } from './http'
import { attemptUuid } from './attempts'
import { addReviewWord, commandWordReview, listWordReviews, readWordReview, resolveExamWords } from './wordReview'

type Context = { params: Promise<{ batchId: string }> }
async function body(request: Request) {
  const value = await readExamJsonBody(request)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ExamApiError('exam_invalid_request', 400)
  return value as Record<string, unknown>
}
export async function wordReviewLinks(request: Request) {
  try {
    const user = await authorizeExamRequest(request)
    const query = new URL(request.url).searchParams
    if ([...query.keys()].some(key => key !== 'attemptId') || query.getAll('attemptId').length !== 1) throw new ExamApiError('exam_invalid_request', 400)
    return examJson({ items: await resolveExamWords(createAdminSupabase(), user.id, attemptUuid(query.get('attemptId'))) })
  } catch (error) { return examFailure(error) }
}
export async function wordReviewList(request: Request) {
  try { const user = await authorizeExamRequest(request); return examJson({ items: await listWordReviews(createAdminSupabase(), user.id) }) }
  catch (error) { return examFailure(error) }
}
export async function wordReviewAdd(request: Request) {
  try { const user = await authorizeExamRequest(request); const command = await body(request); return examJson(await addReviewWord(createAdminSupabase(), user.id, command)) }
  catch (error) { return examFailure(error) }
}
export async function wordReviewRead(request: Request, context: Context) {
  try { const user = await authorizeExamRequest(request); const id = attemptUuid((await context.params).batchId); return examJson(await readWordReview(createAdminSupabase(), user.id, id)) }
  catch (error) { return examFailure(error) }
}
export async function wordReviewCommand(request: Request, context: Context) {
  try { const user = await authorizeExamRequest(request); const id = attemptUuid((await context.params).batchId); const command = await body(request); return examJson(await commandWordReview(createAdminSupabase(), user.id, id, command)) }
  catch (error) { return examFailure(error) }
}
