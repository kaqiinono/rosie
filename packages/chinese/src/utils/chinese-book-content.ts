import type { AccumulationUnit, LessonPassageEntry, PoemEntry } from './g1b/types'
import type { PinyinWriteWordEntry } from './g1b/pinyin-write-words'
import type { ChineseBookSlug } from './chinese-books'
import {
  LESSON_PASSAGES as G1B_PASSAGES,
  POEMS as G1B_POEMS,
  ACCUMULATION as G1B_ACCUMULATION,
  PINYIN_WRITE_WORDS as G1B_PINYIN_WRITE_WORDS,
} from './g1b'
import {
  LESSON_PASSAGES as G2A_PASSAGES,
  POEMS as G2A_POEMS,
  ACCUMULATION as G2A_ACCUMULATION,
  PINYIN_WRITE_WORDS as G2A_PINYIN_WRITE_WORDS,
  PINYIN_WRITE_WORDS_TEACHER as G2A_PINYIN_WRITE_WORDS_TEACHER,
} from './g2a'
import { LESSON_PASSAGES as G2B_PASSAGES, POEMS as G2B_POEMS, ACCUMULATION as G2B_ACCUMULATION } from './g2b'

const PASSAGES_BY_BOOK: Record<ChineseBookSlug, LessonPassageEntry[]> = {
  g1b: G1B_PASSAGES,
  g2a: G2A_PASSAGES,
  g2b: G2B_PASSAGES,
}

const POEMS_BY_BOOK: Record<ChineseBookSlug, PoemEntry[]> = {
  g1b: G1B_POEMS,
  g2a: G2A_POEMS,
  g2b: G2B_POEMS,
}

const ACCUMULATION_BY_BOOK: Record<ChineseBookSlug, AccumulationUnit[]> = {
  g1b: G1B_ACCUMULATION,
  g2a: G2A_ACCUMULATION,
  g2b: G2B_ACCUMULATION,
}

const PINYIN_WRITE_BY_BOOK: Record<ChineseBookSlug, PinyinWriteWordEntry[]> = {
  g1b: G1B_PINYIN_WRITE_WORDS,
  // 二上补充了老师提供的词语表（source: 'teacher'）：同词以后者为准（带上来源标记），
  // 保证文档内全部词都能按来源筛选，且练习不出现重复题
  g2a: mergePinyinWriteWords(G2A_PINYIN_WRITE_WORDS, G2A_PINYIN_WRITE_WORDS_TEACHER),
  g2b: [],
}

/** 按 (lessonKey, word) 合并多个词库；同词后者优先（用于用带来源标记的条目覆盖基础条目） */
function mergePinyinWriteWords(...lists: PinyinWriteWordEntry[][]): PinyinWriteWordEntry[] {
  const merged = new Map<string, PinyinWriteWordEntry>()
  for (const list of lists) {
    for (const entry of list) {
      merged.set(`${entry.lessonKey}::${entry.word}`, entry)
    }
  }
  return [...merged.values()]
}

export function getBookLessonPassages(bookSlug: ChineseBookSlug): LessonPassageEntry[] {
  return PASSAGES_BY_BOOK[bookSlug] ?? G1B_PASSAGES
}

export function getBookPoems(bookSlug: ChineseBookSlug): PoemEntry[] {
  return POEMS_BY_BOOK[bookSlug] ?? G1B_POEMS
}

export function getBookAccumulation(bookSlug: ChineseBookSlug): AccumulationUnit[] {
  return ACCUMULATION_BY_BOOK[bookSlug] ?? G1B_ACCUMULATION
}

export function getBookPinyinWriteWords(bookSlug: ChineseBookSlug): PinyinWriteWordEntry[] {
  return PINYIN_WRITE_BY_BOOK[bookSlug] ?? G1B_PINYIN_WRITE_WORDS
}

export function getLessonPassageForBook(
  bookSlug: ChineseBookSlug,
  lessonKey: string,
): LessonPassageEntry | undefined {
  const localKey = lessonKey.includes('::') ? lessonKey.split('::').pop()! : lessonKey
  return getBookLessonPassages(bookSlug).find((p) => p.lessonKey === localKey)
}
