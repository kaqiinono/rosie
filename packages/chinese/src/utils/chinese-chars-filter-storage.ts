import { STORAGE_KEYS } from '@rosie/core'
import type { ChineseLessonRow } from '../types/chineseCharData'
import type { ChineseBookSlug } from './chinese-books'
import { sortLessonsInUnit } from './chinese-lesson-display'

export interface ChineseCharsFilterSaved {
  units: number[]
  lessons: string[]
  /** 练习前是否先浏览生字卡片；默认 true */
  cardPreview?: boolean
}

function storageKey(bookSlug: ChineseBookSlug): string {
  return `${STORAGE_KEYS.CHINESE_CHARS_FILTER}:${bookSlug}`
}

export function readCharsFilter(bookSlug: ChineseBookSlug): ChineseCharsFilterSaved | null {
  try {
    const raw = localStorage.getItem(storageKey(bookSlug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ChineseCharsFilterSaved
    if (!Array.isArray(parsed.units) || !Array.isArray(parsed.lessons)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeCharsFilter(
  bookSlug: ChineseBookSlug,
  units: Set<number>,
  lessons: Set<string>,
  cardPreview?: boolean,
): void {
  try {
    const existing = readCharsFilter(bookSlug)
    const payload: ChineseCharsFilterSaved = {
      units: [...units].sort((a, b) => a - b),
      lessons: [...lessons],
      cardPreview: cardPreview ?? existing?.cardPreview,
    }
    localStorage.setItem(storageKey(bookSlug), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function writeCharsCardPreview(bookSlug: ChineseBookSlug, cardPreview: boolean): void {
  try {
    const existing = readCharsFilter(bookSlug)
    const payload: ChineseCharsFilterSaved = {
      units: existing?.units ?? [],
      lessons: existing?.lessons ?? [],
      cardPreview,
    }
    localStorage.setItem(storageKey(bookSlug), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

/** 单元内第一课：正课优先，否则取该单元排序后的首条 */
export function getFirstLessonInUnit(unitLessons: ChineseLessonRow[]): ChineseLessonRow | null {
  const ordered = sortLessonsInUnit(unitLessons)
  return ordered.find((l) => l.lessonKind === 'lesson') ?? ordered[0] ?? null
}

export function getDefaultCharsFilter(lessons: ChineseLessonRow[]): {
  units: Set<number>
  lessons: Set<string>
} {
  const unitNums = [...new Set(lessons.map((l) => l.unit))].sort((a, b) => a - b)
  const firstUnit = unitNums[0] ?? 1
  const firstLesson = getFirstLessonInUnit(lessons.filter((l) => l.unit === firstUnit))
  return {
    units: new Set([firstUnit]),
    lessons: firstLesson ? new Set([firstLesson.lessonKey]) : new Set(),
  }
}

export function resolveCharsFilter(
  saved: ChineseCharsFilterSaved | null,
  lessons: ChineseLessonRow[],
): { units: Set<number>; lessons: Set<string> } {
  if (!saved || (saved.units.length === 0 && saved.lessons.length === 0)) {
    return getDefaultCharsFilter(lessons)
  }

  const lessonByKey = new Map(lessons.map((l) => [l.lessonKey, l]))
  const unitSet = new Set(
    saved.units.filter((u) => lessons.some((l) => l.unit === u)),
  )
  if (unitSet.size === 0) {
    return getDefaultCharsFilter(lessons)
  }

  const lessonSet = new Set(
    saved.lessons.filter((key) => {
      const lesson = lessonByKey.get(key)
      return lesson !== undefined && unitSet.has(lesson.unit)
    }),
  )

  if (lessonSet.size > 0) {
    return { units: unitSet, lessons: lessonSet }
  }

  const firstUnit = Math.min(...unitSet)
  const firstLesson = getFirstLessonInUnit(lessons.filter((l) => l.unit === firstUnit))
  return {
    units: new Set([firstUnit]),
    lessons: firstLesson ? new Set([firstLesson.lessonKey]) : new Set(),
  }
}
