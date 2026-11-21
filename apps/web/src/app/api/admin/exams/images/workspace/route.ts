import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examIdentifier, examJson, examPageRequest, examFailure } from '@/lib/exams/http'
import { readExamImageWorkspace } from '@/lib/exams/imageTasks'
import { listExamMediaRevisions } from '@/lib/exams/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const db = createAdminSupabase()
    const params = new URL(request.url).searchParams
    if (!params.has('revisionId')) return examJson(await listExamMediaRevisions(db, examPageRequest(request)))
    return examJson(await readExamImageWorkspace(db, examIdentifier(params.get('revisionId'))))
  } catch (error) { return examFailure(error) }
}
