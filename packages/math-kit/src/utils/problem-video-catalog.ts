import { lessonByKey, orderedSummaryKeys } from './lesson-registry'

export interface ProblemVideoCatalog {
  lessonKey: string
  summaryNames: Record<string, string>
  keys: string[]
  /** Null means no successful sync yet; an empty keys array can be a valid snapshot. */
  syncedAt: string | null
}

export function parseProblemVideoCatalog(value: unknown, expectedLessonKey?: string): ProblemVideoCatalog {
  if (!value || typeof value !== 'object') throw new Error('invalid_video_catalog')
  const { lessonKey, keys, syncedAt, summaryNames: names } = value as Record<string, unknown>
  if (typeof lessonKey !== 'string' || !lessonByKey(lessonKey) ||
    (expectedLessonKey !== undefined && expectedLessonKey !== lessonKey) ||
    !Array.isArray(keys) || !keys.every((key): key is string => typeof key === 'string' && key.startsWith(`${lessonKey}-`)) ||
    !(syncedAt === null || (typeof syncedAt === 'string' && Number.isFinite(Date.parse(syncedAt)))) ||
    (syncedAt === null && keys.length > 0)) {
    throw new Error('invalid_video_catalog')
  }
  const summaryNames: Record<string, string> = {}
  for (const key of orderedSummaryKeys(lessonKey, keys)) {
    const name = names && typeof names === 'object' ? (names as Record<string, unknown>)[key] : undefined
    if (typeof name === 'string' && name) summaryNames[key] = name
  }
  return { lessonKey, keys, syncedAt, summaryNames }
}
