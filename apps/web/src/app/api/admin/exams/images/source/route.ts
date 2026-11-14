import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examIdentifier, examFailure } from '@/lib/exams/http'
import { readExamImageContext } from '@/lib/exams/imageTasks'
import { readImageSource } from '@/lib/exams/imageSources'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    await authorizeExamRequest(request, true)
    const params = new URL(request.url).searchParams
    const { source, draft } = await readExamImageContext(createAdminSupabase(), examIdentifier(params.get('revisionId')), examIdentifier(params.get('slotId')))
    const fileHash = draft.contentSet.source.fileHash
    if (!source || !fileHash) throw new ExamApiError('exam_image_source_missing', 404)
    const { bytes } = await readImageSource(createAdminSupabase(), source, fileHash)
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff', Vary: 'Authorization', 'Content-Disposition': 'inline; filename="source.png"' } })
  } catch (error) { return examFailure(error) }
}
