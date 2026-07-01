import type { ChineseLessonRow } from '../types/chineseCharData'
import type { LessonKind } from './grade1-down/types'

const KIND_ORDER: Record<LessonKind, number> = {
  lesson: 0,
  garden: 1,
  happy_reading: 2,
}

/** 单元内教学顺序：正课 → 语文园地 → 快乐读书吧 */
export function sortLessonsInUnit(lessons: ChineseLessonRow[]): ChineseLessonRow[] {
  return [...lessons].sort((a, b) => {
    const kindDiff = KIND_ORDER[a.lessonKind] - KIND_ORDER[b.lessonKind]
    if (kindDiff !== 0) return kindDiff
    if (a.lessonKind === 'lesson' && b.lessonKind === 'lesson') {
      const bookA = parseBookLessonNumber(a.lessonKey) ?? a.lesson
      const bookB = parseBookLessonNumber(b.lessonKey) ?? b.lesson
      return bookA - bookB || a.sortOrder - b.sortOrder
    }
    return a.sortOrder - b.sortOrder
  })
}

/** 全册正课编号，来自 lesson_key（如 u4-l7 → 7） */
export function parseBookLessonNumber(lessonKey: string): number | null {
  const match = lessonKey.match(/^u\d+-l(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

export interface LessonDisplayInfo {
  /** 单元内课序（含语文园地，从 1 起） */
  unitLessonNo: number | null
  /** 全册正课编号（园地 / 快乐读书吧为 null） */
  bookLessonNo: number | null
  /** 带课序的展示文案，如「课3 树和喜鹊」「课4 语文园地三」 */
  label: string
}

export function getLessonDisplayInfo(
  lesson: ChineseLessonRow,
  unitLessons: ChineseLessonRow[],
): LessonDisplayInfo {
  if (lesson.lessonKind === 'happy_reading') {
    return { unitLessonNo: null, bookLessonNo: null, label: lesson.lessonTitle }
  }

  const ordered = sortLessonsInUnit(unitLessons).filter((l) => l.lessonKind !== 'happy_reading')
  const idx = ordered.findIndex((l) => l.lessonKey === lesson.lessonKey)
  const unitLessonNo = idx >= 0 ? idx + 1 : null

  const bookLessonNo =
    lesson.lessonKind === 'lesson'
      ? (parseBookLessonNumber(lesson.lessonKey) ?? (lesson.lesson > 0 ? lesson.lesson : null))
      : null

  const prefix = unitLessonNo ? `课${unitLessonNo} ` : ''
  return {
    unitLessonNo,
    bookLessonNo,
    label: `${prefix}${lesson.lessonTitle}`,
  }
}

/** 按单元 + 单元内教学顺序排列全部课文 */
export function sortLessonsPedagogically(lessons: ChineseLessonRow[]): ChineseLessonRow[] {
  const byUnit = new Map<number, ChineseLessonRow[]>()
  for (const lesson of lessons) {
    if (!byUnit.has(lesson.unit)) byUnit.set(lesson.unit, [])
    byUnit.get(lesson.unit)!.push(lesson)
  }
  const out: ChineseLessonRow[] = []
  for (const unit of [...byUnit.keys()].sort((a, b) => a - b)) {
    out.push(...sortLessonsInUnit(byUnit.get(unit)!))
  }
  return out
}

/** 构建 lessonKey → 展示信息，供列表/卡片复用 */
export function buildLessonDisplayMap(
  lessons: ChineseLessonRow[],
): Map<string, LessonDisplayInfo> {
  const byUnit = new Map<number, ChineseLessonRow[]>()
  for (const lesson of lessons) {
    if (!byUnit.has(lesson.unit)) byUnit.set(lesson.unit, [])
    byUnit.get(lesson.unit)!.push(lesson)
  }
  const map = new Map<string, LessonDisplayInfo>()
  for (const unitLessons of byUnit.values()) {
    for (const lesson of unitLessons) {
      map.set(lesson.lessonKey, getLessonDisplayInfo(lesson, unitLessons))
    }
  }
  return map
}
