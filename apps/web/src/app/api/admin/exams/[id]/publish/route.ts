import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examIdentifier, examJson } from '@/lib/exams/http'
import { readExamPublicationCommand, transitionExamPublication } from '@/lib/exams/publication'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const actor = await authorizeExamRequest(request, true)
    const id = examIdentifier((await context.params).id)
    const command = await readExamPublicationCommand(request)
    return examJson(await transitionExamPublication(createAdminSupabase(), id, actor.id, 'publish', command))
  } catch (error) { return examFailure(error) }
}
