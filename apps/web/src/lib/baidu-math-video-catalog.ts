import 'server-only'
import { createAdminSupabase } from './api-auth'
import { lessonByKey, lessonReplayOrder } from '@rosie/math-kit/utils/lesson-registry'
import { parseProblemVideoCatalog, type ProblemVideoCatalog } from '@rosie/math-kit/utils/problem-video-catalog'

export function validVideoLessonKey(value: unknown): value is string {
  return typeof value === 'string' && Boolean(lessonByKey(value))
}

export async function readMathVideoCatalog(lessonKey: string): Promise<ProblemVideoCatalog> {
  if (!validVideoLessonKey(lessonKey)) throw Error('invalid_lesson')
  const db = createAdminSupabase()
  const { data, error } = await db.rpc('math_replay_catalog', { p_lesson: lessonKey })
  if (error) throw Error('catalog_storage_unavailable')
  const catalog = parseProblemVideoCatalog(data, lessonKey)
  return { ...catalog, replayNames: await readReplayFileNames(db, lessonKey) }
}

/** The catalog RPC names summary clips only. Lesson replays keep their published filenames. */
async function readReplayFileNames(
  db: ReturnType<typeof createAdminSupabase>,
  lessonKey: string,
): Promise<Record<string, string>> {
  const { data, error } = await db
    .from('math_replay_resolved')
    .select('problem_id,current_name')
    .eq('lesson_key', lessonKey)
    .eq('available', true)
  if (error || !Array.isArray(data)) return {}
  const names: Record<string, string> = {}
  for (const row of data) {
    const problemId = row.problem_id
    const currentName = row.current_name
    if (typeof problemId === 'string' && lessonReplayOrder(lessonKey, problemId) &&
      typeof currentName === 'string' && currentName.trim()) {
      names[problemId] = currentName.trim()
    }
  }
  return names
}
