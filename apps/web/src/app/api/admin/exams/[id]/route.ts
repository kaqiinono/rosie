import { describeExamDraftReadiness } from '@rosie/exams/validation'
import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examIdentifier, examJson, readExamSaveCommand } from '@/lib/exams/http'
import { readExamDraft, saveExamDraft } from '@/lib/exams/repository'

type RouteContext = { params: Promise<{ id: string }> }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: RouteContext) {
  try {
    await authorizeExamRequest(request, true)
    const id = examIdentifier((await context.params).id)
    const live = new URL(request.url).searchParams.get('live') === '1'
    const record = await readExamDraft(createAdminSupabase(), id, live)
    return examJson({ ...record, readiness: describeExamDraftReadiness(record.draft) })
  } catch (error) {
    return examFailure(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await authorizeExamRequest(request, true)
    const id = examIdentifier((await context.params).id)
    const command = await readExamSaveCommand(request, true)
    if (command.draft.content.id !== id) throw new ExamApiError('exam_revision_mismatch', 400)
    const live = new URL(request.url).searchParams.get('live') === '1'
    const receipt = await saveExamDraft(createAdminSupabase(), command.draft, {
      actorId: actor.id, requestId: command.requestId, expectedVersion: command.expectedVersion, live,
    })
    return examJson({ ...receipt, readiness: describeExamDraftReadiness(command.draft) })
  } catch (error) {
    return examFailure(error)
  }
}
