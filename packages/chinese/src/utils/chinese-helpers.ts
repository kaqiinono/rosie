import type { LessonCharGroup } from './grade1-down/types'
import type { ChineseCharProfile } from '../types/chineseCharData'
import type { CharMasteryMap } from '../hooks/useCharMastery'
import type { ChineseWeeklyPlanDay } from './chineseWeeklyPlan'
import { ensureStageInit, isGraduated } from '@rosie/core'

export type CharTrack = 'recognize' | 'write'

export const CHINESE_REVIEW_LIMITS = {
  recognize: 3,
  write: 2,
} as const

export function charKey(char: string, semesterKey = 'g1-下'): string {
  return `${semesterKey}::${char}`
}

export function masteryKey(charKeyValue: string, track: CharTrack): string {
  return `${charKeyValue}::${track}`
}

function parseMasteryKey(mapKey: string): { charKey: string; track: CharTrack } | null {
  const idx = mapKey.lastIndexOf('::')
  if (idx < 0) return null
  const track = mapKey.slice(idx + 2)
  if (track !== 'recognize' && track !== 'write') return null
  return { charKey: mapKey.slice(0, idx), track }
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = [...arr]
  let s = (seed ?? Date.now()) >>> 0
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function getLessonGroup(
  lessonGroups: LessonCharGroup[],
  lessonKey: string,
): LessonCharGroup | undefined {
  return lessonGroups.find((g) => g.lessonKey === lessonKey)
}

export function getLessonPinyin(
  lessonGroups: LessonCharGroup[],
  lessonKey: string,
  ch: string,
  track: CharTrack,
): string | undefined {
  const group = getLessonGroup(lessonGroups, lessonKey)
  if (!group) return undefined
  const chars = track === 'recognize' ? group.recognize : group.write
  const pinyins = track === 'recognize' ? group.recognizePinyin : group.writePinyin
  const idx = chars.indexOf(ch)
  return idx >= 0 ? pinyins[idx] : undefined
}

export function findCharProfile(
  charByKey: Map<string, ChineseCharProfile>,
  ch: string,
  charKeyValue?: string,
): ChineseCharProfile | undefined {
  if (charKeyValue) return charByKey.get(charKeyValue)
  return [...charByKey.values()].find((e) => e.char === ch)
}

export function charFromKey(key: string): string {
  const parts = key.split('::')
  return parts[parts.length - 1] ?? key
}

export interface DayQuizItem {
  char: string
  pinyin: string
  charKey: string
  track: CharTrack
  lessonTitle: string
  isReview?: boolean
}

/** Chars due for spaced repetition today (excluding graduated and today's new keys). */
export function getDueReviewCharKeys(
  masteryMap: CharMasteryMap,
  track: CharTrack,
  today: string,
  options?: { excludeKeys?: Set<string>; limit?: number },
): string[] {
  const exclude = options?.excludeKeys ?? new Set<string>()
  const limit = options?.limit ?? CHINESE_REVIEW_LIMITS[track]
  const due: { charKey: string; overdueDays: number; stage: number }[] = []

  for (const [mapKey, m] of Object.entries(masteryMap)) {
    const parsed = parseMasteryKey(mapKey)
    if (!parsed || parsed.track !== track) continue
    if (exclude.has(parsed.charKey)) continue
    if (!m || isGraduated(m)) continue
    const init = ensureStageInit(m, today)
    const reviewDate = init.nextReviewDate ?? today
    if (reviewDate > today) continue
    const overdueDays = Math.max(
      0,
      Math.floor((Date.parse(today) - Date.parse(reviewDate)) / 86400000),
    )
    due.push({ charKey: parsed.charKey, overdueDays, stage: init.stage ?? 0 })
  }

  return due
    .sort((a, b) => b.overdueDays - a.overdueDays || a.stage - b.stage)
    .slice(0, limit)
    .map((d) => d.charKey)
}

function resolvePinyin(
  lessonGroups: LessonCharGroup[],
  charByKey: Map<string, ChineseCharProfile>,
  lessonKey: string,
  key: string,
  ch: string,
  track: CharTrack,
  isReview: boolean,
): string {
  if (!isReview) {
    return (
      getLessonPinyin(lessonGroups, lessonKey, ch, track) ??
      charByKey.get(key)?.pinyin ??
      findCharProfile(charByKey, ch)?.pinyin ??
      ''
    )
  }
  return charByKey.get(key)?.pinyin ?? findCharProfile(charByKey, ch)?.pinyin ?? ''
}

/** Build quiz items using lesson-context pinyin (教材语境读音). */
export function buildDayQuizItems(
  lessonGroups: LessonCharGroup[],
  charByKey: Map<string, ChineseCharProfile>,
  lessonKey: string,
  newRecognizeKeys: string[],
  newWriteKeys: string[],
  reviewRecognizeKeys: string[] = [],
  reviewWriteKeys: string[] = [],
): DayQuizItem[] {
  const group = getLessonGroup(lessonGroups, lessonKey)
  const lessonTitle = group?.lessonTitle ?? lessonKey
  const items: DayQuizItem[] = []
  const seen = new Set<string>()

  const push = (key: string, track: CharTrack, isReview: boolean) => {
    const dedupe = `${key}::${track}`
    if (seen.has(dedupe)) return
    seen.add(dedupe)
    const ch = charFromKey(key)
    const py = resolvePinyin(lessonGroups, charByKey, lessonKey, key, ch, track, isReview)
    items.push({ char: ch, pinyin: py, charKey: key, track, lessonTitle, isReview })
  }

  for (const key of newRecognizeKeys) push(key, 'recognize', false)
  for (const key of newWriteKeys) push(key, 'write', false)
  for (const key of reviewRecognizeKeys) push(key, 'recognize', true)
  for (const key of reviewWriteKeys) push(key, 'write', true)

  return items
}

/** New + due-review items for one plan day (review computed from mastery at runtime). */
export function buildTodayQuizItems(
  lessonGroups: LessonCharGroup[],
  charByKey: Map<string, ChineseCharProfile>,
  masteryMap: CharMasteryMap,
  dayPlan: ChineseWeeklyPlanDay,
  today: string,
): DayQuizItem[] {
  const exclude = new Set([...dayPlan.newRecognizeKeys, ...dayPlan.newWriteKeys])
  const reviewRecognizeKeys = getDueReviewCharKeys(masteryMap, 'recognize', today, {
    excludeKeys: exclude,
    limit: CHINESE_REVIEW_LIMITS.recognize,
  })
  const reviewWriteKeys = getDueReviewCharKeys(masteryMap, 'write', today, {
    excludeKeys: exclude,
    limit: CHINESE_REVIEW_LIMITS.write,
  })
  return buildDayQuizItems(
    lessonGroups,
    charByKey,
    dayPlan.lessonKey,
    dayPlan.newRecognizeKeys,
    dayPlan.newWriteKeys,
    reviewRecognizeKeys,
    reviewWriteKeys,
  )
}

export { getWeekStart } from '@rosie/core'
