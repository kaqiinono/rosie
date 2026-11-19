import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamImageCropCommand, ExamMediaSaveReceipt } from '@rosie/exams'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import { ensureBaiduImageDirectory, uploadBaiduExamImage } from '@/lib/baidu-image-upload'
import type { BaiduFileMetadata } from '@/lib/baidu-media'
import { ExamApiError } from './http'
import { readExamImageContext } from './imageTasks'
import { imageSourceAsset } from './imageSources'
import { readExamMediaBinding, validExamMediaPath } from './media'
import { saveExamMediaBindings } from './mediaAdmin'

interface Destination { accountId: string; generation: string; mainPath: string; directoryId: string | null }
interface CropJob { request_id: string; actor_id: string; request_hash: string; destination: Destination; uploaded_file: BaiduFileMetadata | null; receipt: ExamMediaSaveReceipt | null }

function storageError(message?: string): never {
  throw new ExamApiError(message === 'exam_image_busy' ? message : message === 'exam_conflict' ? message : 'exam_image_storage_unavailable',
    message === 'exam_image_busy' || message === 'exam_conflict' ? 409 : 503)
}

export async function saveExamImageCrop(db: SupabaseClient, actorId: string, command: ExamImageCropCommand, bytes: Buffer, width: number, height: number) {
  const hash = createHash('sha256').update(JSON.stringify({ command, image: createHash('sha256').update(bytes).digest('hex') })).digest('hex')
  const { data: existing, error: readError } = await db.from('exam_image_crop_jobs').select('*').eq('request_id', command.requestId).maybeSingle()
  if (readError) storageError()
  if (existing && (existing.actor_id !== actorId || existing.request_hash !== hash)) throw new ExamApiError('exam_conflict', 409)
  if (existing?.receipt) return existing.receipt as ExamMediaSaveReceipt

  const context = await readExamImageContext(db, command.revisionId, command.slotId)
  if (context.version !== command.expectedVersion || context.draft.content.mediaBindingRevisionId !== command.expectedBindingRevisionId) throw new ExamApiError('exam_conflict', 409)
  if (!context.source) throw new ExamApiError('exam_image_source_missing', 404)
  const fileHash = context.draft.contentSet.source.fileHash
  if (!fileHash) throw new ExamApiError('exam_image_source_missing', 404)
  // The private source endpoint verifies image bytes; saving needs the immutable index only.
  const asset = await imageSourceAsset(db, context.source, fileHash)
  if (!asset) throw new ExamApiError('exam_image_source_missing', 404)
  if (asset.sha256 !== command.sourceSha256) throw new ExamApiError('exam_image_source_changed', 409)
  if (Math.abs(width - Math.round(command.region.width * asset.width)) > 1 || Math.abs(height - Math.round(command.region.height * asset.height)) > 1) throw new ExamApiError('exam_invalid_image_crop', 400)
  const account = await getBaiduAccountContext()
  const previous = command.expectedBindingRevisionId ? await readExamMediaBinding(db, command.revisionId, command.expectedBindingRevisionId) : null
  if (previous && (previous.account_id !== account.accountId || previous.account_generation !== account.generation)) throw new ExamApiError('baidu_account_changed', 409)
  const root = process.env.BAIDU_EXAMS_UPLOAD_ROOT?.replace(/\/$/, '') || '/airosie/exams'
  if (!validExamMediaPath(root) || root === '/') throw new ExamApiError('exam_image_directory_invalid', 503)
  const folder = createHash('sha256').update(command.revisionId).digest('hex').slice(0, 20)
  const destination: Destination = previous?.files.some(file => !file.directory_id)
    ? { accountId: account.accountId, generation: account.generation, mainPath: previous.main_path, directoryId: previous.directory_id }
    : { accountId: account.accountId, generation: account.generation, mainPath: `${root}/${folder}`, directoryId: null }
  const lease = randomUUID()
  const { data, error } = await db.rpc('begin_exam_image_crop', { p_request: command.requestId, p_actor: actorId, p_hash: hash,
    p_command: { ...command, imageSha256: createHash('sha256').update(bytes).digest('hex'), imageSize: bytes.byteLength }, p_destination: destination, p_lease: lease })
  if (error) storageError(error.message)
  const job = data as CropJob
  if (job.receipt) return job.receipt
  try {
    const target = job.destination
    if (target.accountId !== account.accountId || target.generation !== account.generation) throw new ExamApiError('baidu_account_changed', 409)
    if (!validExamMediaPath(target.mainPath)) throw new ExamApiError('exam_image_directory_invalid', 503)
    await ensureBaiduImageDirectory(account.accessToken, target.mainPath)
    let directoryId = target.directoryId
    if (!directoryId) {
      const inserted = await db.from('baidu_sync_directories').insert({ account_id: account.accountId, path: target.mainPath })
      if (inserted.error && inserted.error.code !== '23505') storageError()
      const bookmark = await db.from('baidu_sync_directories').select('id').eq('account_id', account.accountId).eq('path', target.mainPath).single()
      if (bookmark.error || !bookmark.data) storageError()
      directoryId = bookmark.data.id as string
    }
    const slotKey = createHash('sha256').update(command.slotId).digest('hex').slice(0, 12)
    const path = `${target.mainPath}/crop-${slotKey}-${command.requestId}.png`
    const file = job.uploaded_file ?? await uploadBaiduExamImage(account.accessToken, path, bytes)
    if (file.path !== path || file.size !== bytes.byteLength) throw new ExamApiError('exam_image_file_conflict', 409)
    const stored = await db.from('exam_image_crop_jobs').update({ uploaded_file: file, updated_at: new Date().toISOString() })
      .eq('request_id', command.requestId).eq('lease_id', lease).select('request_id').single()
    if (stored.error || !stored.data) storageError()
    return await saveExamMediaBindings(db, actorId, { revisionId: command.revisionId, expectedVersion: command.expectedVersion,
      expectedBindingRevisionId: command.expectedBindingRevisionId, requestId: command.requestId,
      accountGeneration: account.generation, directoryId, mainPath: target.mainPath,
      picks: [{ slotId: command.slotId, fileId: file.id, path: file.path, reviewed: true, durationMs: null }] }, lease)
  } finally {
    // A failed response retains the uploaded file and original command for an exact retry.
    await db.from('exam_image_crop_jobs').update({ lease_id: null, lease_until: null }).eq('request_id', command.requestId).eq('lease_id', lease)
  }
}
