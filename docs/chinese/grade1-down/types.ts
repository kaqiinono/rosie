// Draft types for 一年级下册 Chinese module data

export type ChineseSemester = '上' | '下'
export type UnitType = 'literacy' | 'reading'
export type LessonKind = 'lesson' | 'garden' | 'happy_reading'
export type CharTier = 'recognize' | 'write'
export type AccumulationKind = 'poem' | 'idiom_4' | 'xiehouyu' | 'proverb' | 'quote'

export interface ChineseUnitEntry {
  unit: number
  title: string
  unitType: UnitType
  lessons: ChineseLessonMeta[]
}

export interface ChineseLessonMeta {
  lesson: number
  title: string
  kind?: LessonKind
  requiresRecite?: boolean
  isPoem?: boolean
  subPoems?: string[]
}

export interface CharEntry {
  char: string
  pinyin: string
  pinyinInitial: string
  grade: number
  semester: ChineseSemester
  unit: number
  lesson: number
  lessonTitle: string
  lessonKind: LessonKind
  tier: CharTier
  charKey: string
  radical: string
  radicalName: string
  structure: string
  phrases: string[]
  strokeCount: number
}

export interface PhraseEntry {
  grade: number
  semester: ChineseSemester
  unit: number
  lesson: number
  lessonKey: string
  phrase: string
}

export interface PoemEntry {
  id: string
  title: string
  author: string
  dynasty: string
  source: 'lesson' | 'garden'
  unit: number
  lesson?: number
  lines: string[]
  requiresRecite: boolean
}

export interface AccumulationItem {
  text: string
  answer?: string
  source?: string
}

export interface AccumulationUnit {
  unit: number
  kind: AccumulationKind
  items: AccumulationItem[]
}

export interface RadicalEntry {
  radical: string
  name: string
  examples: string[]
}

export interface StrokeRuleEntry {
  unit: number
  rule: string
  examples: string[]
}

export interface LessonCharGroup {
  lessonKey: string
  unit: number
  lesson: number
  lessonTitle: string
  lessonKind: LessonKind
  recognize: string[]
  recognizePinyin: string[]
  write: string[]
  writePinyin: string[]
}
