import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson } from '@/lib/exams/http'
import { attemptUuid } from '@/lib/exams/attempts'
import { readExamReflectionCommand, readExamReflections, saveExamReflection } from '@/lib/exams/reflections'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

function rejectQuery(request: Request) {
  if ([...new URL(request.url).searchParams].length) throw new ExamApiError('exam_invalid_request', 400)
}

export async function GET(request: Request, context: Context) {
  try {
    const user = await authorizeExamRequest(request)
    rejectQuery(request)
    return examJson(await readExamReflections(createAdminSupabase(), user.id, attemptUuid((await context.params).id)))
  } catch (error) { return examFailure(error) }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await authorizeExamRequest(request)
    rejectQuery(request)
    const id = attemptUuid((await context.params).id)
    const command = await readExamReflectionCommand(request)
    return examJson(await saveExamReflection(createAdminSupabase(), user.id, id, command))
  } catch (error) { return examFailure(error) }
}
