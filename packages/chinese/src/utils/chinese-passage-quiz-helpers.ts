import type { ChineseCharProfile, ChineseLessonRow } from '../types/chineseCharData'
import type { ChineseBookSlug } from './chinese-books'
import { getBookPinyinWriteWords } from './chinese-book-content'
import type { FilteredLesson } from './chinese-chars-session-helpers'
import { shuffle } from './chinese-helpers'
import { getLessonPassage } from './chinese-lesson-passage-helpers'
import { buildLessonPhraseItems } from './chinese-phrase-helpers'
import type { LessonCharGroup } from './g1b/types'

export type PassageBlankKind = 'char' | 'word'

export interface PassageQuizItem {
  id: string
  lessonKey: string
  lessonTitle: string
  prompt: string
  answer: string
  options: string[]
  blankKind: PassageBlankKind
}

function seedFromId(id: string, salt = 13): number {
  return id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), salt) >>> 0
}

function buildCharOptions(answer: string, pool: string[], seed: number): string[] {
  const distractors = shuffle(
    pool.filter((c) => c !== answer),
    seed,
  ).slice(0, 3)
  while (distractors.length < 3) distractors.push(answer)
  return shuffle([answer, ...distractors.slice(0, 3)], seed + 1)
}

function buildWordOptions(answer: string, pool: string[], seed: number): string[] {
  const sameLen = pool.filter((w) => w !== answer && w.length === answer.length)
  const source = sameLen.length >= 3 ? sameLen : pool.filter((w) => w !== answer)
  const distractors = shuffle(source, seed).slice(0, 3)
  while (distractors.length < 3) distractors.push(answer)
  return shuffle([answer, ...distractors.slice(0, 3)], seed + 1)
}

function makeBlankDisplay(sentence: string, start: number, length: number): string {
  return sentence.slice(0, start) + '□'.repeat(length) + sentence.slice(start + length)
}

function lessonCharPool(group: LessonCharGroup): string[] {
  return [...new Set([...group.recognize, ...group.write])]
}

function lessonWordPool(
  lesson: ChineseLessonRow,
  group: LessonCharGroup,
  charByKey: Map<string, ChineseCharProfile>,
  bookSlug: ChineseBookSlug,
): string[] {
  const words = new Set<string>()

  for (const item of buildLessonPhraseItems(lesson, group, charByKey, bookSlug)) {
    if (item.phrase.length >= 2) words.add(item.phrase)
  }

  for (const entry of getBookPinyinWriteWords(bookSlug)) {
    if (entry.lessonKey === lesson.lessonKey && entry.word.length >= 2) {
      words.add(entry.word)
    }
  }

  return [...words]
}

function findWordBlank(
  sentence: string,
  words: string[],
): { answer: string; start: number } | null {
  const sorted = [...words].sort((a, b) => b.length - a.length)
  for (const word of sorted) {
    const start = sentence.indexOf(word)
    if (start >= 0) return { answer: word, start }
  }
  return null
}

function findCharBlank(
  sentence: string,
  charPool: Set<string>,
): { answer: string; start: number } | null {
  for (let i = 0; i < sentence.length; i++) {
    const ch = sentence[i]
    if (ch && charPool.has(ch)) return { answer: ch, start: i }
  }
  return null
}

function splitPassageSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[。！？；\n])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function buildPassageQuizItems(
  filtered: FilteredLesson[],
  charByKey: Map<string, ChineseCharProfile>,
  bookSlug: ChineseBookSlug = 'g1b',
): PassageQuizItem[] {
  const items: PassageQuizItem[] = []

  for (const { lesson, group } of filtered) {
    const passage = getLessonPassage(lesson.lessonKey, bookSlug)
    if (!passage?.paragraphs.length) continue

    const charPool = lessonCharPool(group)
    const charSet = new Set(charPool)
    const wordPool = lessonWordPool(lesson, group, charByKey, bookSlug)
    if (charPool.length === 0 && wordPool.length === 0) continue

    for (const para of passage.paragraphs) {
      for (const sentence of splitPassageSentences(para)) {
        const wordHit = wordPool.length > 0 ? findWordBlank(sentence, wordPool) : null
        const charHit = !wordHit && charPool.length > 0 ? findCharBlank(sentence, charSet) : null
        const hit = wordHit ?? charHit
        if (!hit) continue

        const blankKind: PassageBlankKind = wordHit ? 'word' : 'char'
        const id = `${lesson.lessonKey}::passage::${blankKind}::${items.length}`
        const seed = seedFromId(id)
        const prompt = makeBlankDisplay(sentence, hit.start, hit.answer.length).trim()
        const options =
          blankKind === 'word'
            ? buildWordOptions(hit.answer, wordPool, seed)
            : buildCharOptions(hit.answer, charPool, seed)

        items.push({
          id,
          lessonKey: lesson.lessonKey,
          lessonTitle: lesson.lessonTitle,
          prompt,
          answer: hit.answer,
          options,
          blankKind,
        })
      }
    }
  }

  return items
}
