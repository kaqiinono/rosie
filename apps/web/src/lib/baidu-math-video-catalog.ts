import 'server-only'
import { createAdminSupabase } from './api-auth'
import { lessonByKey } from '@rosie/math-kit/utils/lesson-registry'
import { parseProblemVideoCatalog } from '@rosie/math-kit/utils/problem-video-catalog'

export function validVideoLessonKey(value: unknown): value is string {
  return typeof value === 'string' && Boolean(lessonByKey(value))
}

export async function readMathVideoCatalog(lessonKey: string) {
  if (!validVideoLessonKey(lessonKey)) throw Error('invalid_lesson')
  const { data, error } = await createAdminSupabase().rpc('math_replay_catalog', { p_lesson: lessonKey })
  if (error) throw Error('catalog_storage_unavailable')
  return parseProblemVideoCatalog(data, lessonKey)
}
