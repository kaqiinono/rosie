import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson, readExamSaveCommand } from '@/lib/exams/http'
import { parseExamAdminWordSearch, searchExamAdminWords } from '@/lib/exams/adminWords'
import { matchExamVocabulary } from '@/lib/exams/vocabularyMatch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const search = parseExamAdminWordSearch(request)
    return examJson(await searchExamAdminWords(createAdminSupabase(), search))
  } catch (error) { return examFailure(error) }
}

export async function POST(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const { draft } = await readExamSaveCommand(request, true)
    return examJson(await matchExamVocabulary(createAdminSupabase(), draft))
  } catch (error) { return examFailure(error) }
}
