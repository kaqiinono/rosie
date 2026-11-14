import { describeExamDraftReadiness } from '@rosie/exams/validation'
import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson, examPageRequest, readExamSaveCommand } from '@/lib/exams/http'
import { listExamDrafts, saveExamDraft } from '@/lib/exams/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const page = examPageRequest(request)
    return examJson(await listExamDrafts(createAdminSupabase(), page))
  } catch (error) {
    return examFailure(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await authorizeExamRequest(request, true)
    const command = await readExamSaveCommand(request, false)
    const receipt = await saveExamDraft(createAdminSupabase(), command.draft, {
      actorId: actor.id, requestId: command.requestId, expectedVersion: null,
    })
    return examJson({ ...receipt, readiness: describeExamDraftReadiness(command.draft) }, 201)
  } catch (error) {
    return examFailure(error)
  }
}
