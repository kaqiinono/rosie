import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson } from '@/lib/exams/http'
import { attemptUuid } from '@/lib/exams/attempts'
import { abandonExamRecording } from '@/lib/exams/recordings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ id: string; recordingId: string }> }) {
  try {
    const user = await authorizeExamRequest(request)
    const params = await context.params
    return examJson({ recording: await abandonExamRecording(createAdminSupabase(), user.id,
      attemptUuid(params.id), attemptUuid(params.recordingId), request) })
  } catch (error) { return examFailure(error) }
}
