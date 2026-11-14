import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examIdentifier, examJson } from '@/lib/exams/http'
import { readExamPublication, readExamReviewCommand, recordExamReview } from '@/lib/exams/publication'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  try {
    await authorizeExamRequest(request, true)
    const id = examIdentifier((await context.params).id)
    return examJson(await readExamPublication(createAdminSupabase(), id))
  } catch (error) { return examFailure(error) }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await authorizeExamRequest(request, true)
    const id = examIdentifier((await context.params).id)
    const command = await readExamReviewCommand(request)
    return examJson(await recordExamReview(createAdminSupabase(), id, actor.id, command))
  } catch (error) { return examFailure(error) }
}
