import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson } from '@/lib/exams/http'
import { attemptUuid } from '@/lib/exams/attempts'
import { assessmentBody } from '@/lib/exams/recordings'
import { requireExamParentPin, verifiedExamSessionId } from '@/lib/exams/parentAccess'
import { openExamSpeakingScript } from '@/lib/exams/speakingScript'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeExamRequest(request)
    const sessionId = verifiedExamSessionId(request)
    const id = attemptUuid((await context.params).id)
    const body = await assessmentBody(request, ['requestId', 'expectedVersion', 'pin'])
    const db = createAdminSupabase()
    await requireExamParentPin(db, user.id, body.pin)
    return examJson(await openExamSpeakingScript(db, user.id, id, sessionId, body))
  } catch (error) { return examFailure(error) }
}
