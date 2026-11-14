import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson } from '@/lib/exams/http'
import { attemptUuid, expireAttemptIfNeeded, projectAttemptReview, readAttemptEnvelope } from '@/lib/exams/attempts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeExamRequest(request)
    const id = attemptUuid((await context.params).id)
    const db = createAdminSupabase()
    const result = await expireAttemptIfNeeded(db, await readAttemptEnvelope(db, user.id, id))
    return examJson(projectAttemptReview(result))
  } catch (error) { return examFailure(error) }
}
