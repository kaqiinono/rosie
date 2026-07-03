import type { CharTier, LessonCharGroup, LessonKind, UnitType } from '../utils/g1b/types'

export interface ChineseCharProfile {
  charKey: string
  char: string
  grade: number
  semester: '上' | '下'
  pinyin: string
  pinyinAlt: string[]
  radical: string
  radicalName: string
  structure: string
  strokeCount: number
  phrases: string[]
  tiers: CharTier[]
}

export interface ChineseLessonRow {
  lessonKey: string
  grade: number
  semester: '上' | '下'
  unit: number
  lesson: number
  lessonTitle: string
  lessonKind: LessonKind
  unitType?: UnitType
  sortOrder: number
  recallPhrases: string[]
}

export interface ChineseLessonCharRow {
  lessonKey: string
  charKey: string
  char: string
  track: CharTier
  sortOrder: number
  pinyinInLesson: string
}

export type { LessonCharGroup }
