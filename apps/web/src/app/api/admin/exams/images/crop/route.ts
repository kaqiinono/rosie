import { baiduAuthErrorCode } from '@rosie/core'
import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson } from '@/lib/exams/http'
import { readImageCropRequest } from '@/lib/exams/imageCropRequest'
import { saveExamImageCrop } from '@/lib/exams/imageCrop'
import { cleanupExamImages } from '@/lib/exams/imageCleanup'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
export async function POST(request: Request) {
  try {
    const actor = await authorizeExamRequest(request, true)
    const { command, bytes, width, height } = await readImageCropRequest(request)
    const db = createAdminSupabase()
    const receipt = await saveExamImageCrop(db, actor.id, command, bytes, width, height)
    // Cleanup failure never disguises a committed crop as a failed save.
    const cleanup = await cleanupExamImages(db, command.revisionId, command.slotId, 1).catch(() => ({ failed: 1 }))
    return examJson({ ...receipt, cleanup })
  } catch (error) {
    const code = baiduAuthErrorCode(error)
    if (code) return examFailure(new ExamApiError(code, 409))
    if (error instanceof ExamApiError) return examFailure(error)
    if (error instanceof Error && error.message.startsWith('exam_image_')) return examFailure(new ExamApiError(error.message, 503))
    return examFailure(error)
  }
}
