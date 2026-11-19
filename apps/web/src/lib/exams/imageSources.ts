import 'server-only'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SourceReference } from '@rosie/exams'
import { fetchProjectMedia } from '@/lib/project-media'
import { ExamApiError } from './http'

export const IMAGE_SOURCE_BUCKET = 'exam-image-sources'
interface PageAsset { id: string; object_path: string; sha256: string; width: number; height: number; state: string }

export async function imageSourceAsset(db: SupabaseClient, source: SourceReference | null, sourceFileHash: string) {
  if (!source) return null
  const { data, error } = await db.from('exam_image_source_pages').select('id,object_path,sha256,width,height,state')
    .eq('source_id', source.sourceId).eq('pdf_page', source.pdfPage).eq('source_file_hash', sourceFileHash).maybeSingle()
  if (error) throw new ExamApiError('exam_image_storage_unavailable', 503)
  return data?.state === 'ready' ? data as PageAsset : null
}

export async function readImageSource(db: SupabaseClient, source: SourceReference, fileHash: string) {
  const asset = await imageSourceAsset(db, source, fileHash)
  if (!asset) throw new ExamApiError('exam_image_source_missing', 404)
  const response = await fetchProjectMedia(IMAGE_SOURCE_BUCKET, asset.object_path, null, AbortSignal.timeout(60_000))
    .catch(() => { throw new ExamApiError('exam_image_storage_unavailable', 503) })
  if (!response?.ok) throw new ExamApiError('exam_image_source_missing', 404)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new ExamApiError('exam_image_source_changed', 409)
  return { asset, bytes }
}
