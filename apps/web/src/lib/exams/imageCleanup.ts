import 'server-only'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import { deleteBaiduExamImage, findBaiduImageFile } from '@/lib/baidu-image-upload'
import { exactBaiduId } from '@/lib/baidu-identity'
import { fetchBaiduFileById, readBaiduFileMetadata, type BaiduFileMetadata } from '@/lib/baidu-media'
import { ExamApiError } from './http'
import { validExamMediaPath } from './media'

export interface ImageCleanupResult { deleted: number; retained: number; pending: number; failed: number }

/** Only files created by this workspace are eligible. Shared/manual files are never guessed. */
export async function cleanupExamImages(db: SupabaseClient, revisionId: string, slotId?: string, remoteLimit = 5): Promise<ImageCleanupResult> {
  const report: ImageCleanupResult = { deleted: 0, retained: 0, pending: 0, failed: 0 }
  let query = db.from('exam_image_crop_jobs').select('*').eq('content_revision_id', revisionId).neq('cleanup_state', 'deleted').order('cleanup_state').order('created_at')
  if (slotId) query = query.eq('slot_id', slotId)
  const { data: jobs, error } = await query.limit(200)
  if (error) throw new ExamApiError('exam_image_storage_unavailable', 503)
  if (!jobs?.length) return report
  const account = await getBaiduAccountContext()
  // Bound each request. A retained file does not prevent later unreferenced files from being considered.
  let remoteActions = 0
  for (const job of jobs) {
    if (job.lease_until && Date.parse(job.lease_until) > Date.now()) { report.pending++; continue }
    if (job.destination.accountId !== account.accountId || job.destination.generation !== account.generation) { report.failed++; continue }
    try {
      let file = job.uploaded_file as BaiduFileMetadata | null
      if (!file) {
        if (remoteActions >= remoteLimit) { report.pending++; continue }
        remoteActions++
        // Reconcile an upload whose successful provider response was lost before journaling.
        const main = job.destination.mainPath as string
        if (!validExamMediaPath(main)) throw new Error('invalid_path')
        const key = createHash('sha256').update(job.slot_id as string).digest('hex').slice(0, 12)
        const path = `${main}/crop-${key}-${job.request_id}.png`
        let found
        try { found = await findBaiduImageFile(account.accessToken, main, path) }
        catch (failure) { if (!(failure instanceof Error) || failure.message !== 'baidu_directory_missing') throw failure; found = null }
        if (!found) {
          const deleted = await db.from('exam_image_crop_jobs').update({ cleanup_state: 'deleted' }).eq('request_id', job.request_id)
            .is('uploaded_file', null).is('receipt', null).or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`).select('request_id')
          if (deleted.error) throw deleted.error
          if (deleted.data?.length) report.deleted++; else report.pending++
          continue
        }
        const id = exactBaiduId(found.fs_id)
        file = await readBaiduFileMetadata(id, account.accessToken)
        if (!file || file.path !== path || file.size !== job.command.imageSize) throw new Error('file_changed')
        const download = await fetchBaiduFileById(id, main, null, AbortSignal.timeout(20_000), 'material', account.accessToken, path)
        if (!download) throw new Error('file_missing')
        const bytes = new Uint8Array(await download.arrayBuffer())
        if (createHash('sha256').update(bytes).digest('hex') !== job.command.imageSha256) throw new Error('file_changed')
        const saved = await db.from('exam_image_crop_jobs').update({ uploaded_file: file }).eq('request_id', job.request_id)
          .or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`).select('request_id')
        if (saved.error) throw saved.error
        if (!saved.data?.length) { report.pending++; continue }
      }
      const claim = await db.rpc('claim_exam_crop_cleanup', { p_request: job.request_id })
      if (claim.error) throw claim.error
      if (claim.data === 'retained') { report.retained++; continue }
      if (claim.data === 'pending') { report.pending++; continue }
      if (claim.data === 'deleted') continue
      if (claim.data !== 'deleting') throw new Error('invalid_cleanup')
      if (remoteActions >= remoteLimit) { report.pending++; continue }
      remoteActions++
      const current = await readBaiduFileMetadata(file.id, account.accessToken)
      if (current) {
        if (current.path !== file.path || current.size !== file.size || current.md5 !== file.md5 || current.modifiedAt !== file.modifiedAt) throw new Error('file_changed')
        await deleteBaiduExamImage(account.accessToken, file.path)
      }
      const removed = await db.from('exam_image_crop_jobs').update({ cleanup_state: 'deleted', updated_at: new Date().toISOString() })
        .eq('request_id', job.request_id).eq('cleanup_state', 'deleting')
      if (removed.error) throw removed.error
      report.deleted++
    } catch { report.failed++ }
  }
  if (jobs.length === 200) report.pending++
  return report
}
