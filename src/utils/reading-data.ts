import type { WordEntry } from './type'

export interface ReadingPassage {
  key: string
  unit: string
  lesson: string
  title: string
  paragraphs: string[]
}

export const readingPassages: ReadingPassage[] = [
  {
    key: 'u5l2',
    unit: 'Unit 5',
    lesson: 'Lesson 2',
    title: 'A School on a Nature Reserve',
    paragraphs: [
      "Have you ever taken a school trip to a nature reserve? One school in South Africa is actually on a nature reserve. The Southern Cross boarding school in Hoedspruit sits on a 1,100-hectare (2,700 acre) nature reserve with many different types of wildlife including giraffes, snakes and wild boars.",
      "At Southern Cross, students work inside classrooms just like you. But they also spend time learning in the wild. The school's teachers feel students need a deep understanding of the natural world so that they can care for it. Teachers take students outside during all types of lessons. For example, preschool students don't learn counting with a workbook. Instead, they go to the farm to count animals in a language lesson.",
      "Students discuss problems facing the plants and animals on the reserve. They work together to find the best solutions. Southern Cross students also enjoy activities such as rock climbing, kayaking and horse riding.",
      "Their education isn't just about homework and exams. Students solve real world problems, have fun and build friendships all while learning to care for the earth.",
      "Guess what? To get to their lessons, Southern Cross students must walk on a path that's also used by the animals. Imagine saying good morning to a passing wild beast on the way to your morning lesson!",
    ],
  },
]

export function findPassage(unit: string, lesson: string): ReadingPassage | undefined {
  return readingPassages.find((p) => p.unit === unit && p.lesson === lesson)
}

export function findPassageByKey(key: string): ReadingPassage | undefined {
  return readingPassages.find((p) => p.key === key)
}

export function hasPassageForLesson(unit: string, lesson: string): boolean {
  return readingPassages.some((p) => p.unit === unit && p.lesson === lesson)
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Build a single case-insensitive regex matching any of the given words as
 * whole-word tokens, optionally with a trailing `s` so plurals are caught
 * (e.g. `exam` matches `exams`, `friendship` matches `friendships`).
 * Longer phrases are placed first so multi-word terms like `nature reserve`
 * win over `nature` alone.
 */
export function buildWordMatchRegex(words: string[]): RegExp | null {
  if (words.length === 0) return null
  const sorted = words.slice().sort((a, b) => b.length - a.length)
  const pattern = sorted.map(escapeRegex).join('|')
  return new RegExp(`\\b(${pattern})s?\\b`, 'gi')
}

/**
 * Given a matched text fragment from {@link buildWordMatchRegex} and the
 * candidate word entries, return the entry whose `word` matches (case-insensitive,
 * tolerating a trailing plural `s`).
 */
export function resolveMatchedWord(
  matchedText: string,
  candidates: WordEntry[],
): WordEntry | null {
  const lower = matchedText.toLowerCase()
  const trimmed = lower.endsWith('s') ? lower.slice(0, -1) : lower
  let best: WordEntry | null = null
  for (const c of candidates) {
    const w = c.word.toLowerCase()
    if (w === lower || w === trimmed) {
      if (!best || c.word.length > best.word.length) best = c
    }
  }
  return best
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+/

/**
 * Find the first sentence (across all paragraphs) that contains `word`.
 * Returns the sentence text and the paragraph index. Plural tolerance matches
 * {@link buildWordMatchRegex}.
 */
export function findSentenceForWord(
  passage: ReadingPassage,
  word: string,
): { sentence: string; paragraphIndex: number } | null {
  const regex = new RegExp(`\\b${escapeRegex(word)}s?\\b`, 'i')
  for (let pi = 0; pi < passage.paragraphs.length; pi++) {
    const sentences = passage.paragraphs[pi].split(SENTENCE_SPLIT)
    for (const s of sentences) {
      if (regex.test(s)) {
        return { sentence: s, paragraphIndex: pi }
      }
    }
  }
  return null
}

/**
 * Locate the paragraph that contains a given word, or null.
 */
export function findParagraphIndexForWord(
  passage: ReadingPassage,
  word: string,
): number | null {
  const regex = new RegExp(`\\b${escapeRegex(word)}s?\\b`, 'i')
  for (let i = 0; i < passage.paragraphs.length; i++) {
    if (regex.test(passage.paragraphs[i])) return i
  }
  return null
}
