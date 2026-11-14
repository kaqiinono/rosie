import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson } from '@/lib/exams/http'
import { parseExamAdminWordSearch, searchExamAdminWords } from '@/lib/exams/adminWords'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const search = parseExamAdminWordSearch(request)
    return examJson(await searchExamAdminWords(createAdminSupabase(), search))
  } catch (error) { return examFailure(error) }
}
