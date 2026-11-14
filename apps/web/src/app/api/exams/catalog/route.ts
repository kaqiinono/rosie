import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson, examPageRequest } from '@/lib/exams/http'
import { listExamCatalog } from '@/lib/exams/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await authorizeExamRequest(request)
    const page = examPageRequest(request)
    return examJson(await listExamCatalog(createAdminSupabase(), page))
  } catch (error) {
    return examFailure(error)
  }
}
