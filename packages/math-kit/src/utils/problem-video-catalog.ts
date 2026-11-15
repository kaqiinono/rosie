import { lessonByKey, orderedLessonReplayKeys, orderedSummaryKeys } from './lesson-registry'

export interface ProblemVideoCatalog {
  lessonKey: string
  summaryNames: Record<string, string>
  replayNames: Record<string, string>
  keys: string[]
  /** Null means no successful sync yet; an empty keys array can be a valid snapshot. */
  syncedAt: string | null
}

function namesFor(keys: string[], source: unknown): Record<string, string> {
  const names: Record<string, string> = {}
  if (!source || typeof source !== 'object') return names
  const record = source as Record<string, unknown>
  for (const key of keys) {
    const name = record[key]
    if (typeof name === 'string' && name.trim()) names[key] = name.trim()
  }
  return names
}

/** Button text is the published filename without a video extension. */
export function replayFileLabel(filename: string | undefined, fallback: string): string {
  const stem = filename?.replace(/\.(mp4|m4v|mov|webm)$/i, '').trim()
  return stem || fallback
}

export function parseProblemVideoCatalog(value: unknown, expectedLessonKey?: string): ProblemVideoCatalog {
  if (!value || typeof value !== 'object') throw new Error('invalid_video_catalog')
  const { lessonKey, keys, syncedAt, summaryNames: names, replayNames } = value as Record<string, unknown>
  if (typeof lessonKey !== 'string' || !lessonByKey(lessonKey) ||
    (expectedLessonKey !== undefined && expectedLessonKey !== lessonKey) ||
    !Array.isArray(keys) || !keys.every((key): key is string => typeof key === 'string' && key.startsWith(`${lessonKey}-`)) ||
    !(syncedAt === null || (typeof syncedAt === 'string' && Number.isFinite(Date.parse(syncedAt)))) ||
    (syncedAt === null && keys.length > 0)) {
    throw new Error('invalid_video_catalog')
  }
  return {
    lessonKey,
    keys,
    syncedAt,
    summaryNames: namesFor(orderedSummaryKeys(lessonKey, keys), names),
    replayNames: namesFor(orderedLessonReplayKeys(lessonKey, keys), replayNames),
  }
}
