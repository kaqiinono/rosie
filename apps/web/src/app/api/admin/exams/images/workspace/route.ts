import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examIdentifier, examJson, examFailure } from '@/lib/exams/http'
import { readExamImageWorkspace } from '@/lib/exams/imageTasks'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const id = examIdentifier(new URL(request.url).searchParams.get('revisionId'))
    return examJson(await readExamImageWorkspace(createAdminSupabase(), id))
  } catch (error) { return examFailure(error) }
}
