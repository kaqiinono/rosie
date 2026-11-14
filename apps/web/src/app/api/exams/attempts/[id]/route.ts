import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson } from '@/lib/exams/http'
import { attemptUuid, expireAttemptIfNeeded, projectExamAttempt, readAttemptEnvelope } from '@/lib/exams/attempts'
import { examAttemptMutation } from '@/lib/exams/attemptRoutes'

type Context = { params: Promise<{ id: string }> }
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: Context) {
  try {
    const user = await authorizeExamRequest(request)
    const id = attemptUuid((await context.params).id)
    const db = createAdminSupabase()
    const result = await expireAttemptIfNeeded(db, await readAttemptEnvelope(db, user.id, id))
    return examJson(projectExamAttempt(result))
  } catch (error) { return examFailure(error) }
}

export const PATCH = examAttemptMutation('save')
