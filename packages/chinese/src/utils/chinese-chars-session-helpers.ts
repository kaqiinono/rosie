import type { ChineseCharProfile, ChineseLessonRow } from '../types/chineseCharData'
import type { LessonCharGroup, PoemEntry } from './g1b/types'
import type { ChineseBookSlug } from './chinese-books'
import { getBookAccumulation, getBookPoems } from './chinese-book-content'
import type { ChineseUnitEntry } from './g1b/types'
import {
  buildAccumulationQuizItems,
  type AccumulationQuizItem,
} from './chinese-accumulation-helpers'
import {
  buildLessonPhraseItems,
  type PhraseQuizItem,
} from './chinese-phrase-helpers'
import { getLessonPassage } from './chinese-lesson-passage-helpers'
import { charKey, shuffle } from './chinese-helpers'
import { buildLessonDisplayMap, sortLessonsPedagogically } from './chinese-lesson-display'
import {
  buildPassageQuizItems,
  type PassageQuizItem,
} from './chinese-passage-quiz-helpers'
import {
  buildPinyinWriteItems,
  type PinyinWriteQuizItem,
} from './chinese-pinyin-write-helpers'

export type { PassageQuizItem } from './chinese-passage-quiz-helpers'

export type CharQuizType = 'recognize' | 'stroke' | 'phrase' | 'passage' | 'pinyin-write'

export const ALL_CHAR_QUIZ_TYPES: CharQuizType[] = [
  'recognize',
  'stroke',
  'phrase',
  'passage',
  'pinyin-write',
]

export const MOON_REWARDS = {
  char: 1,
  phrase: 2,
  poem: 3,
  accumulation: 3,
  passage: 5,
  pinyinWrite: 2,
} as const

export type PracticePhase =
  | 'cards'
  | 'chars'
  | 'phrases'
  | 'poems'
  | 'accumulation'
  | 'passage'
  | 'pinyin-write'
  | 'done'

export interface UnitOption {
  unit: number
  title: string
}

export interface FilteredLesson {
  lesson: ChineseLessonRow
  group: LessonCharGroup
}

export interface CharCardItem {
  char: string
  charKey: string
  pinyin: string
  lessonKey: string
  lessonTitle: string
  unit: number
  /** 单元内课序（含园地） */
  unitLessonNo: number | null
  /** 全册正课编号 */
  bookLessonNo: number | null
  isRecognize: boolean
  isWrite: boolean
}

export interface LessonContentBlock {
  lessonKey: string
  lessonTitle: string
  lessonLabel: string
  unitLessonNo: number | null
  bookLessonNo: number | null
  unit: number
  recognize: string[]
  write: string[]
  phrases: string[]
  pinyinWriteWords: string[]
  poems: PoemEntry[]
  accumulationLabels: string[]
  hasPassage: boolean
}

export type CharPracticeQuestion =
  | {
      kind: 'recognize'
      id: string
      char: string
      charKey: string
      pinyin: string
      lessonTitle: string
    }
  | {
      kind: 'stroke'
      id: string
      char: string
      charKey: string
      lessonTitle: string
    }
  | {
      kind: 'phrase-char'
      id: string
      item: PhraseQuizItem
    }

export interface PracticeSessionPlan {
  cards: CharCardItem[]
  charQuestions: CharPracticeQuestion[]
  phraseItems: PhraseQuizItem[]
  poems: PoemEntry[]
  accumulationItems: AccumulationQuizItem[]
  passageItems: PassageQuizItem[]
  pinyinWriteItems: PinyinWriteQuizItem[]
  possibleMoons: number
}

export function getUnitOptions(units: ChineseUnitEntry[]): UnitOption[] {
  return units.map((u) => ({ unit: u.unit, title: u.title }))
}

export function getLessonsForUnits(
  lessons: ChineseLessonRow[],
  selUnits: Set<number>,
): ChineseLessonRow[] {
  const filtered =
    selUnits.size > 0 ? lessons.filter((l) => selUnits.has(l.unit)) : lessons
  return sortLessonsPedagogically(filtered)
}

export function filterLessons(
  lessons: ChineseLessonRow[],
  lessonGroups: LessonCharGroup[],
  selUnits: Set<number>,
  selLessons: Set<string>,
): FilteredLesson[] {
  const groupMap = new Map(lessonGroups.map((g) => [g.lessonKey, g]))
  return sortLessonsPedagogically(lessons)
    .filter((l) => {
      if (selUnits.size > 0 && !selUnits.has(l.unit)) return false
      if (selLessons.size > 0 && !selLessons.has(l.lessonKey)) return false
      return true
    })
    .map((lesson) => {
      const group = groupMap.get(lesson.lessonKey)
      return group ? { lesson, group } : null
    })
    .filter((x): x is FilteredLesson => x !== null)
}

function poemMatchesLesson(poem: PoemEntry, lesson: ChineseLessonRow): boolean {
  if (poem.unit !== lesson.unit) return false
  if (poem.source === 'garden') {
    return lesson.lessonKind === 'garden'
  }
  return lesson.lesson === poem.lesson
}

function poemsForLessons(filtered: FilteredLesson[], bookSlug: ChineseBookSlug = 'g1b'): PoemEntry[] {
  const poems = getBookPoems(bookSlug)
  const seen = new Set<string>()
  const out: PoemEntry[] = []
  for (const poem of poems) {
    if (seen.has(poem.id)) continue
    if (filtered.some(({ lesson }) => poemMatchesLesson(poem, lesson))) {
      seen.add(poem.id)
      out.push(poem)
    }
  }
  return out
}

function accumulationLabelsForUnits(units: Set<number>, bookSlug: ChineseBookSlug = 'g1b'): string[] {
  const labels: string[] = []
  for (const block of getBookAccumulation(bookSlug)) {
    if (units.size > 0 && !units.has(block.unit)) continue
    for (const item of block.items) {
      labels.push(item.text)
    }
  }
  return labels
}

export function buildLessonContentBlocks(
  filtered: FilteredLesson[],
  charByKey: Map<string, ChineseCharProfile>,
  allLessons: ChineseLessonRow[],
  bookSlug: ChineseBookSlug = 'g1b',
): LessonContentBlock[] {
  const displayMap = buildLessonDisplayMap(allLessons)
  return filtered.map(({ lesson, group }) => {
    const phraseItems = buildLessonPhraseItems(lesson, group, charByKey, bookSlug)
    const pinyinWriteWords = buildPinyinWriteItems([{ lesson, group }], allLessons, bookSlug).map(
      (w) => w.word,
    )
    const poems = poemsForLessons([{ lesson, group }], bookSlug)
    const passage = getLessonPassage(lesson.lessonKey, bookSlug)
    const display = displayMap.get(lesson.lessonKey)
    return {
      lessonKey: lesson.lessonKey,
      lessonTitle: lesson.lessonTitle,
      lessonLabel: display?.label ?? lesson.lessonTitle,
      unitLessonNo: display?.unitLessonNo ?? null,
      bookLessonNo: display?.bookLessonNo ?? null,
      unit: lesson.unit,
      recognize: group.recognize,
      write: group.write,
      phrases: phraseItems.map((p) => p.phrase),
      pinyinWriteWords,
      poems,
      accumulationLabels:
        lesson.lessonKind === 'garden'
          ? accumulationLabelsForUnits(new Set([lesson.unit]), bookSlug)
          : [],
      hasPassage: Boolean(passage?.paragraphs.length),
    }
  })
}

export function buildCharCardItems(
  filtered: FilteredLesson[],
  allLessons: ChineseLessonRow[],
  bookSlug = 'g1b',
): CharCardItem[] {
  const items: CharCardItem[] = []
  const seen = new Set<string>()
  const displayMap = buildLessonDisplayMap(allLessons)

  for (const { lesson, group } of filtered) {
    const display = displayMap.get(lesson.lessonKey)
    const push = (ch: string, pinyin: string, track: 'recognize' | 'write') => {
      const key = charKey(ch, bookSlug)
      const dedupe = `${key}::${lesson.lessonKey}`
      if (seen.has(dedupe)) return
      seen.add(dedupe)
      const existing = items.find((i) => i.charKey === key && i.lessonKey === lesson.lessonKey)
      if (existing) {
        if (track === 'recognize') existing.isRecognize = true
        if (track === 'write') existing.isWrite = true
        return
      }
      items.push({
        char: ch,
        charKey: key,
        pinyin,
        lessonKey: lesson.lessonKey,
        lessonTitle: lesson.lessonTitle,
        unit: lesson.unit,
        unitLessonNo: display?.unitLessonNo ?? null,
        bookLessonNo: display?.bookLessonNo ?? null,
        isRecognize: track === 'recognize',
        isWrite: track === 'write',
      })
    }

    group.recognize.forEach((ch, i) => push(ch, group.recognizePinyin[i] ?? '', 'recognize'))
    group.write.forEach((ch, i) => push(ch, group.writePinyin[i] ?? '', 'write'))
  }

  return items
}

function buildPhraseCharQuestion(
  char: string,
  lessonKey: string,
  items: PhraseQuizItem[],
): PhraseQuizItem | undefined {
  return items.find((item) => item.lessonKey === lessonKey && item.answer === char)
}

export function buildCharPracticeQuestions(
  filtered: FilteredLesson[],
  charByKey: Map<string, ChineseCharProfile>,
  quizTypes: Set<CharQuizType>,
  allLessons: ChineseLessonRow[],
  bookSlug = 'g1b',
): CharPracticeQuestion[] {
  const questions: CharPracticeQuestion[] = []
  const cards = buildCharCardItems(filtered, allLessons, bookSlug)
  const phraseItems = filtered.flatMap(({ lesson, group }) =>
    buildLessonPhraseItems(lesson, group, charByKey, bookSlug),
  )

  for (const card of cards) {
    if (quizTypes.has('recognize') && (card.isRecognize || card.isWrite)) {
      questions.push({
        kind: 'recognize',
        id: `${card.charKey}::recognize`,
        char: card.char,
        charKey: card.charKey,
        pinyin: card.pinyin,
        lessonTitle: card.lessonTitle,
      })
    }
    if (quizTypes.has('stroke') && card.isWrite) {
      questions.push({
        kind: 'stroke',
        id: `${card.charKey}::stroke`,
        char: card.char,
        charKey: card.charKey,
        lessonTitle: card.lessonTitle,
      })
    }
    if (quizTypes.has('phrase')) {
      const phraseItem = buildPhraseCharQuestion(card.char, card.lessonKey, phraseItems)
      if (phraseItem) {
        questions.push({
          kind: 'phrase-char',
          id: `${card.charKey}::phrase-char`,
          item: phraseItem,
        })
      }
    }
  }

  return questions
}

export function buildPracticeSessionPlan(
  filtered: FilteredLesson[],
  charByKey: Map<string, ChineseCharProfile>,
  quizTypes: Set<CharQuizType>,
  allLessons: ChineseLessonRow[],
  bookSlug: ChineseBookSlug = 'g1b',
): PracticeSessionPlan {
  const cards = buildCharCardItems(filtered, allLessons, bookSlug)
  const charQuestions = buildCharPracticeQuestions(filtered, charByKey, quizTypes, allLessons, bookSlug)
  const phraseItems = filtered.flatMap(({ lesson, group }) =>
    buildLessonPhraseItems(lesson, group, charByKey, bookSlug),
  )
  const poems = poemsForLessons(filtered, bookSlug)
  const units = new Set(filtered.map((f) => f.lesson.unit))
  const accumulationItems = buildAccumulationQuizItems(getBookAccumulation(bookSlug)).filter((item) =>
    units.has(item.unit),
  )
  const passageItems = quizTypes.has('passage')
    ? buildPassageQuizItems(filtered, charByKey, bookSlug)
    : []
  const pinyinWriteItems = quizTypes.has('pinyin-write')
    ? buildPinyinWriteItems(filtered, allLessons, bookSlug)
    : []

  const possibleMoons =
    charQuestions.length * MOON_REWARDS.char +
    phraseItems.length * MOON_REWARDS.phrase +
    poems.length * MOON_REWARDS.poem +
    accumulationItems.length * MOON_REWARDS.accumulation +
    passageItems.length * MOON_REWARDS.passage +
    pinyinWriteItems.length * MOON_REWARDS.pinyinWrite

  return {
    cards,
    charQuestions,
    phraseItems,
    poems,
    accumulationItems,
    passageItems,
    pinyinWriteItems,
    possibleMoons,
  }
}

export function parseQuizTypesParam(raw: string | null): Set<CharQuizType> {
  if (!raw) return new Set(ALL_CHAR_QUIZ_TYPES)
  const parts = raw.split(',').filter(Boolean) as CharQuizType[]
  const valid = parts.filter((p) => ALL_CHAR_QUIZ_TYPES.includes(p))
  return valid.length > 0 ? new Set(valid) : new Set(ALL_CHAR_QUIZ_TYPES)
}

export function serializeQuizTypes(types: Set<CharQuizType>): string {
  return ALL_CHAR_QUIZ_TYPES.filter((t) => types.has(t)).join(',')
}
