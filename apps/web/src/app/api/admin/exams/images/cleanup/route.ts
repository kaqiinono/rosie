import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examIdentifier, examFailure, examJson, readExamJsonBody, ExamApiError } from '@/lib/exams/http'
import { cleanupExamImages } from '@/lib/exams/imageCleanup'
import { retrySourceCleanup } from '@/lib/exams/imageTaskDeletion'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
export async function POST(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const body = await readExamJsonBody(request)
    if (!body || typeof body !== 'object' || !('revisionId' in body)) throw new ExamApiError('exam_invalid_request', 400)
    const db = createAdminSupabase()
    const sources = await retrySourceCleanup(db)
    const crops = await cleanupExamImages(db, examIdentifier(body.revisionId))
    return examJson({ sources, crops })
  } catch (error) { return examFailure(error) }
}
