import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson } from '@/lib/exams/http'
import { attemptUuid } from '@/lib/exams/attempts'
import { listExamRecordings, prepareExamRecording } from '@/lib/exams/recordings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeExamRequest(request)
    return examJson({ recordings: await listExamRecordings(createAdminSupabase(), user.id, attemptUuid((await context.params).id)) })
  } catch (error) { return examFailure(error) }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeExamRequest(request)
    const id = attemptUuid((await context.params).id)
    return examJson({ recording: await prepareExamRecording(createAdminSupabase(), user.id, id, request) })
  } catch (error) { return examFailure(error) }
}
