import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson } from '@/lib/exams/http'
import { listPracticeGroups } from '@/lib/exams/practiceCatalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const user = await authorizeExamRequest(request)
    return examJson(await listPracticeGroups(createAdminSupabase(), user.id, request))
  } catch (error) { return examFailure(error) }
}
