import { describe, expect, it } from 'vitest'
import {
  ALL_CHAR_QUIZ_TYPES,
  buildPracticeSessionPlan,
  buildReadingLessons,
  type ChineseCharProfile,
  type ChineseLessonRow,
  type FilteredLesson,
  type LessonCharGroup,
} from '@rosie/chinese'

const lessonRow: ChineseLessonRow = {
  lessonKey: 'u1-l1',
  grade: 1,
  semester: '下',
  unit: 1,
  lesson: 1,
  lessonTitle: '春夏秋冬',
  lessonKind: 'lesson',
  sortOrder: 1,
  recallPhrases: [],
}

const group: LessonCharGroup = {
  lessonKey: 'u1-l1',
  unit: 1,
  lesson: 1,
  lessonTitle: '春夏秋冬',
  lessonKind: 'lesson',
  recognize: ['春', '风'],
  recognizePinyin: ['chūn', 'fēng'],
  write: [],
  writePinyin: [],
}

const noPassageLesson: ChineseLessonRow = {
  ...lessonRow,
  lessonKey: 'no-passage-lesson',
  lessonTitle: '无课文',
  sortOrder: 99,
}

const noPassageGroup: LessonCharGroup = {
  ...group,
  lessonKey: 'no-passage-lesson',
  lessonTitle: '无课文',
}

const filteredWithPassage: FilteredLesson[] = [
  { lesson: lessonRow, group },
  { lesson: noPassageLesson, group: noPassageGroup },
]

function profile(char: string, pinyin: string, phrases: string[]): ChineseCharProfile {
  return {
    charKey: `g1b::${char}`,
    char,
    grade: 1,
    semester: '下',
    pinyin,
    pinyinAlt: [],
    radical: '',
    radicalName: '',
    structure: '',
    strokeCount: 1,
    phrases,
    tiers: ['recognize'],
  }
}

const charByKey = new Map<string, ChineseCharProfile>([
  ['g1b::春', profile('春', 'chūn', ['春天'])],
  ['g1b::风', profile('风', 'fēng', ['春风'])],
])

const allLessons = [lessonRow, noPassageLesson]

describe('buildReadingLessons', () => {
  it('includes only filtered lessons that have passage paragraphs', () => {
    const lessons = buildReadingLessons(filteredWithPassage, charByKey, 'g1b')
    expect(lessons.map((l) => l.lessonKey)).toEqual(['u1-l1'])
    expect(lessons[0]?.blankItems.length).toBeGreaterThan(0)
  })
})

describe('buildPracticeSessionPlan passage vs blank', () => {
  it('fills readingLessons when passage selected and leaves blankItems empty', () => {
    const plan = buildPracticeSessionPlan(
      filteredWithPassage,
      charByKey,
      new Set(['passage']),
      allLessons,
      'g1b',
    )
    expect(plan.readingLessons.length).toBe(1)
    expect(plan.blankItems).toEqual([])
  })

  it('fills blankItems when only blank selected and leaves readingLessons empty', () => {
    const plan = buildPracticeSessionPlan(
      filteredWithPassage,
      charByKey,
      new Set(['blank']),
      allLessons,
      'g1b',
    )
    expect(plan.blankItems.length).toBeGreaterThan(0)
    expect(plan.readingLessons).toEqual([])
  })
})

describe('ALL_CHAR_QUIZ_TYPES', () => {
  it('includes blank then passage before pinyin-write', () => {
    expect(ALL_CHAR_QUIZ_TYPES).toEqual([
      'recognize',
      'stroke',
      'phrase',
      'blank',
      'passage',
      'pinyin-write',
    ])
  })
})
