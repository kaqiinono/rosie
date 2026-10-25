import { isProblemVideoKey } from './problem-video'
import { lessonByKey } from './lesson-registry'

export interface ProblemVideoCatalog {
  lessonKey: string
  keys: string[]
  /** Null means no successful sync yet; an empty keys array can be a valid snapshot. */
  syncedAt: string | null
}

export function parseProblemVideoCatalog(value: unknown, expectedLessonKey?: string): ProblemVideoCatalog {
  if (!value || typeof value !== 'object') throw new Error('invalid_video_catalog')
  const { lessonKey, keys, syncedAt } = value as Record<string, unknown>
  if (typeof lessonKey !== 'string' || !lessonByKey(lessonKey) ||
    (expectedLessonKey !== undefined && expectedLessonKey !== lessonKey) ||
    !Array.isArray(keys) || !keys.every((key): key is string => typeof key === 'string' && isProblemVideoKey(key) && key.startsWith(`${lessonKey}-`)) ||
    !(syncedAt === null || (typeof syncedAt === 'string' && Number.isFinite(Date.parse(syncedAt)))) ||
    (syncedAt === null && keys.length > 0)) {
    throw new Error('invalid_video_catalog')
  }
  return { lessonKey, keys, syncedAt }
}
