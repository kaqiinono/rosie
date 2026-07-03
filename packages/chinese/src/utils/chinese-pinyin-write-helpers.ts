import type { ChineseBookSlug } from './chinese-books'
import { getBookPinyinWriteWords } from './chinese-book-content'
import type { FilteredLesson } from './chinese-chars-session-helpers'
import { localLessonKey, shuffle } from './chinese-helpers'
import { buildLessonDisplayMap } from './chinese-lesson-display'
import type { ChineseLessonRow } from '../types/chineseCharData'

export interface PinyinWriteQuizItem {
  id: string
  word: string
  pinyin: string
  lessonKey: string
  lessonTitle: string
  unit: number
  unitLessonNo: number | null
  bookLessonNo: number | null
}

export interface WordCardItem {
  word: string
  pinyin: string
  lessonKey: string
  lessonTitle: string
  unit: number
  unitLessonNo: number | null
  bookLessonNo: number | null
}

export function buildPinyinWriteItems(
  filtered: FilteredLesson[],
  allLessons: ChineseLessonRow[],
  bookSlug: ChineseBookSlug = 'g1b',
): PinyinWriteQuizItem[] {
  const filteredLocalKeys = new Set(
    filtered.map((f) => localLessonKey(f.lesson.lessonKey)),
  )
  const lessonByLocalKey = new Map(
    allLessons.map((l) => [localLessonKey(l.lessonKey), l]),
  )
  const displayMap = buildLessonDisplayMap(allLessons)
  const words = getBookPinyinWriteWords(bookSlug)

  return words
    .filter((w) => filteredLocalKeys.has(w.lessonKey))
    .map((w, index) => {
      const lesson = lessonByLocalKey.get(w.lessonKey)
      const display = lesson ? displayMap.get(lesson.lessonKey) : undefined
      return {
        id: `${w.lessonKey}::pinyin-write::${w.word}::${index}`,
        word: w.word,
        pinyin: w.pinyin,
        lessonKey: lesson?.lessonKey ?? w.lessonKey,
        lessonTitle: lesson?.lessonTitle ?? w.lessonTitle,
        unit: lesson?.unit ?? w.unit,
        unitLessonNo: display?.unitLessonNo ?? null,
        bookLessonNo: display?.bookLessonNo ?? null,
      }
    })
}

export function buildWordCardItems(
  filtered: FilteredLesson[],
  allLessons: ChineseLessonRow[],
  bookSlug: ChineseBookSlug = 'g1b',
): WordCardItem[] {
  return buildPinyinWriteItems(filtered, allLessons, bookSlug).map(
    ({ word, pinyin, lessonKey, lessonTitle, unit, unitLessonNo, bookLessonNo }) => ({
      word,
      pinyin,
      lessonKey,
      lessonTitle,
      unit,
      unitLessonNo,
      bookLessonNo,
    }),
  )
}

export function buildPinyinWriteOptions(
  item: PinyinWriteQuizItem,
  pool: PinyinWriteQuizItem[],
  seed?: number,
): string[] {
  const distractors = shuffle(
    pool.filter((p) => p.word !== item.word).map((p) => p.word),
    seed,
  ).slice(0, 3)
  while (distractors.length < 3) {
    distractors.push(item.word)
  }
  return shuffle([item.word, ...distractors.slice(0, 3)], (seed ?? 0) + 1)
}
