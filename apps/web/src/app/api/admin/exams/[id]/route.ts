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
    const record = await readExamDraft(createAdminSupabase(), id)
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
    const receipt = await saveExamDraft(createAdminSupabase(), command.draft, {
      actorId: actor.id, requestId: command.requestId, expectedVersion: command.expectedVersion,
    })
    return examJson({ ...receipt, readiness: describeExamDraftReadiness(command.draft) })
  } catch (error) {
    return examFailure(error)
  }
}
