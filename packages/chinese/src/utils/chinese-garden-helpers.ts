import type { LessonCharGroup } from './g1b/types'
import type { ChineseCharProfile } from '../types/chineseCharData'
import { buildDayQuizItems, charKey, lessonKeysMatch } from './chinese-helpers'

export function getGardenLessonGroups(lessonGroups: LessonCharGroup[]): LessonCharGroup[] {
  return lessonGroups.filter((g) => g.lessonKind === 'garden')
}

/** 园地「识字加油站」认读生字 → 拼音测验题 */
export function buildGardenQuizItems(
  lessonGroups: LessonCharGroup[],
  charByKey: Map<string, ChineseCharProfile>,
  gardenLessonKey: string,
  bookSlug = 'g1b',
) {
  const group = lessonGroups.find((g) => lessonKeysMatch(g.lessonKey, gardenLessonKey, bookSlug))
  if (!group) return []
  const recognizeKeys = group.recognize.map((ch) => charKey(ch, bookSlug))
  return buildDayQuizItems(lessonGroups, charByKey, gardenLessonKey, recognizeKeys, [])
}
