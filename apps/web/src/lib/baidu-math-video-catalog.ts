import 'server-only'
import { createAdminSupabase } from './api-auth'
import { searchBaiduFilesByPrefix } from './baidu-media'
import { lessonByKey } from '@rosie/math-kit/utils/lesson-registry'
import { MATH_VIDEO_DIRECTORY, problemVideoPath } from '@rosie/math-kit/utils/problem-video'
import { parseProblemVideoCatalog, type ProblemVideoCatalog } from '@rosie/math-kit/utils/problem-video-catalog'

export interface MathVideoSnapshot extends ProblemVideoCatalog {
  filePaths: string[]
}

export function validVideoLessonKey(value: unknown): value is string {
  return typeof value === 'string' && Boolean(lessonByKey(value))
}

function emptyCatalog(lessonKey: string): ProblemVideoCatalog {
  if (!validVideoLessonKey(lessonKey)) throw new Error('invalid_lesson')
  return { lessonKey, keys: [], syncedAt: null }
}

/** Exact path equality preserves the same naming rules as playback. */
export function videoKeyFromPath(path: string): string | null {
  if (!path.startsWith(`${MATH_VIDEO_DIRECTORY}/`) || !path.endsWith('.mp4')) return null
  const key = path.slice(MATH_VIDEO_DIRECTORY.length + 1, -4)
  return problemVideoPath(key) === path ? key : null
}

export async function readMathVideoCatalog(lessonKey: string): Promise<ProblemVideoCatalog> {
  const empty = emptyCatalog(lessonKey)
  const { data, error } = await createAdminSupabase().from('math_video_lesson_catalog')
    .select('keys, synced_at').eq('lesson_key', lessonKey).maybeSingle()
  if (error) throw new Error('catalog_storage_unavailable')
  return data ? parseProblemVideoCatalog({ lessonKey, keys: data.keys, syncedAt: data.synced_at }, lessonKey) : empty
}

export async function readMathVideoSnapshot(lessonKey: string): Promise<MathVideoSnapshot> {
  const empty = emptyCatalog(lessonKey)
  const { data, error } = await createAdminSupabase().from('math_video_lesson_catalog')
    .select('keys, synced_at, file_paths').eq('lesson_key', lessonKey).maybeSingle()
  if (error) throw new Error('catalog_storage_unavailable')
  if (!data) return { ...empty, filePaths: [] }
  const paths: unknown = data.file_paths
  if (!Array.isArray(paths) || !paths.every((path): path is string => typeof path === 'string' &&
    path.startsWith(`${MATH_VIDEO_DIRECTORY}/${lessonKey}-`) && path.lastIndexOf('/') === MATH_VIDEO_DIRECTORY.length)) {
    throw new Error('invalid_video_snapshot')
  }
  return { ...parseProblemVideoCatalog({ lessonKey, keys: data.keys, syncedAt: data.synced_at }, lessonKey), filePaths: paths }
}

const pendingSyncs = new Map<string, Promise<ProblemVideoCatalog>>()

/** Only called by the explicit, admin-authenticated sync route. */
export async function syncMathVideoCatalog(lessonKey: string, force = false): Promise<ProblemVideoCatalog> {
  const existing = await readMathVideoCatalog(lessonKey)
  if (!force && existing.syncedAt !== null) return existing
  const pending = pendingSyncs.get(lessonKey)
  if (pending) return pending
  const promise = (async () => {
    const files = await searchBaiduFilesByPrefix(MATH_VIDEO_DIRECTORY, `${lessonKey}-`)
    const filePaths = files.map((file) => file.path).sort()
    const keys = [...new Set(filePaths.flatMap((path) => {
      const key = videoKeyFromPath(path)
      return key ? [key] : []
    }))].sort()
    const syncedAt = new Date().toISOString()
    // Replace only this lesson; concurrent syncs for different lessons cannot overwrite each other.
    const { error } = await createAdminSupabase().from('math_video_lesson_catalog').upsert({
      lesson_key: lessonKey, file_paths: filePaths, keys, synced_at: syncedAt,
    }, { onConflict: 'lesson_key' })
    if (error) throw new Error('catalog_storage_unavailable')
    return { lessonKey, keys, syncedAt }
  })().finally(() => { pendingSyncs.delete(lessonKey) })
  pendingSyncs.set(lessonKey, promise)
  return promise
}
