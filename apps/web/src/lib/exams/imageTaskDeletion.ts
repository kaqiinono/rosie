import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteProjectMedia } from '@/lib/project-media'
import { IMAGE_SOURCE_BUCKET } from './imageSources'
import { ExamApiError } from './http'

export async function finishSourceCleanup(db: SupabaseClient, id: string, path: string) {
  try {
    await deleteProjectMedia(IMAGE_SOURCE_BUCKET, path)
  } catch {
    return false
  }
  const saved = await db.from('exam_image_source_pages').update({ state: 'deleted' }).eq('id', id).eq('object_path', path).eq('state', 'deleting')
  return !saved.error
}

export async function retireImageTask(db: SupabaseClient, actorId: string, revisionId: string, slotId: string, version: string, retired: boolean) {
  const { data, error } = await db.rpc('retire_exam_image_task', { p_revision: revisionId, p_slot: slotId, p_actor: actorId, p_retired: retired, p_version: version })
  if (error) throw new ExamApiError(['exam_conflict', 'exam_not_editable', 'exam_not_found', 'exam_image_source_missing'].includes(error.message) ? error.message : 'exam_image_storage_unavailable', 409)
  if (data.state !== 'deleting') return { state: data.state as string }
  const done = await finishSourceCleanup(db, data.sourceId as string, data.path as string)
  return { state: done ? 'deleted' : 'cleanup_pending' }
}

export async function retrySourceCleanup(db: SupabaseClient) {
  const { data, error } = await db.from('exam_image_source_pages').select('id,object_path').eq('state', 'deleting').limit(20)
  if (error) throw new ExamApiError('exam_image_storage_unavailable', 503)
  let deleted = 0, pending = 0
  for (const row of data ?? []) {
    if (await finishSourceCleanup(db, row.id, row.object_path)) deleted++
    else pending++
  }
  return { deleted, pending }
}
