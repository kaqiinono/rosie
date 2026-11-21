import { baiduAuthErrorCode } from '@rosie/core'
import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examIdentifier, examJson, examPageRequest } from '@/lib/exams/http'
import { readExamMediaEditor, readExamMediaSaveRequest, saveExamListeningDirectory, saveExamMediaBindings } from '@/lib/exams/mediaAdmin'
import { listExamMediaRevisions } from '@/lib/exams/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function failure(error: unknown) {
  const code = baiduAuthErrorCode(error)
  if (code) return examFailure(new ExamApiError(code, 409))
  return examFailure(error)
}

export async function GET(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const params = new URL(request.url).searchParams
    if (!params.has('revisionId')) return examJson(await listExamMediaRevisions(createAdminSupabase(), examPageRequest(request)))
    if ([...params.keys()].some(key => key !== 'revisionId') || params.getAll('revisionId').length !== 1) throw new ExamApiError('exam_invalid_request', 400)
    return examJson(await readExamMediaEditor(createAdminSupabase(), examIdentifier(params.get('revisionId'))))
  } catch (error) { return failure(error) }
}

export async function PUT(request: Request) {
  try {
    const actor = await authorizeExamRequest(request, true)
    const command = await readExamMediaSaveRequest(request)
    return examJson(await saveExamMediaBindings(createAdminSupabase(), actor.id, command))
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  try {
    const actor = await authorizeExamRequest(request, true)
    return examJson(await saveExamListeningDirectory(createAdminSupabase(), actor.id, request))
  } catch (error) { return failure(error) }
}
