import type { LessonCharGroup } from './grade1-down/types'
import type { ChineseCharProfile } from '../types/chineseCharData'
import { buildDayQuizItems, charKey } from './chinese-helpers'

export function getGardenLessonGroups(lessonGroups: LessonCharGroup[]): LessonCharGroup[] {
  return lessonGroups.filter((g) => g.lessonKind === 'garden')
}

/** 园地「识字加油站」认读生字 → 拼音测验题 */
export function buildGardenQuizItems(
  lessonGroups: LessonCharGroup[],
  charByKey: Map<string, ChineseCharProfile>,
  gardenLessonKey: string,
) {
  const group = lessonGroups.find((g) => g.lessonKey === gardenLessonKey)
  if (!group) return []
  const recognizeKeys = group.recognize.map((ch) => charKey(ch))
  return buildDayQuizItems(lessonGroups, charByKey, gardenLessonKey, recognizeKeys, [])
}
