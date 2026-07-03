import type { ChineseCharProfile } from '../types/chineseCharData'
import type { ChineseLessonRow } from '../types/chineseCharData'
import type { LessonCharGroup } from './g1b/types'
import { charKey, shuffle } from './chinese-helpers'

export type PhraseSource = 'compound' | 'recall'

export interface PhraseQuizItem {
  id: string
  phrase: string
  /** Phrase with one character replaced by □ */
  display: string
  blankIndex: number
  answer: string
  lessonKey: string
  lessonTitle: string
  source: PhraseSource
}

function lessonCharPool(group: LessonCharGroup): string[] {
  const set = new Set<string>([...group.recognize, ...group.write])
  return [...set]
}

function collectCompoundPhrases(
  group: LessonCharGroup,
  charByKey: Map<string, ChineseCharProfile>,
  bookSlug = 'g1b',
): string[] {
  const pool = lessonCharPool(group)
  const phrases = new Set<string>()
  for (const ch of pool) {
    const profile = charByKey.get(charKey(ch, bookSlug))
    for (const p of profile?.phrases ?? []) {
      if (p.length === 2) phrases.add(p)
    }
  }
  return [...phrases]
}

function pickBlankIndex(phrase: string): number {
  if (phrase.length === 2) return 1
  const chars = [...phrase]
  const candidates = chars
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => /[\u4e00-\u9fff]/.test(c))
  if (candidates.length === 0) return 0
  const mid = candidates[Math.floor(candidates.length / 2)]
  return mid?.i ?? 0
}

function makeQuizItem(
  phrase: string,
  lessonKey: string,
  lessonTitle: string,
  source: PhraseSource,
  index: number,
): PhraseQuizItem | null {
  const chars = [...phrase]
  if (chars.length < 2) return null
  const blankIndex = pickBlankIndex(phrase)
  const answer = chars[blankIndex]
  if (!answer || !/[\u4e00-\u9fff]/.test(answer)) return null
  const display = chars.map((c, i) => (i === blankIndex ? '□' : c)).join('')
  return {
    id: `${lessonKey}::${source}::${phrase}::${blankIndex}::${index}`,
    phrase,
    display,
    blankIndex,
    answer,
    lessonKey,
    lessonTitle,
    source,
  }
}

/** All phrase fill-in items for one lesson (组词 + 读一读记一记). */
export function buildLessonPhraseItems(
  lesson: ChineseLessonRow | undefined,
  group: LessonCharGroup | undefined,
  charByKey: Map<string, ChineseCharProfile>,
  bookSlug = 'g1b',
): PhraseQuizItem[] {
  if (!lesson || !group) return []

  const items: PhraseQuizItem[] = []
  const seen = new Set<string>()

  for (const phrase of collectCompoundPhrases(group, charByKey, bookSlug)) {
    if (seen.has(phrase)) continue
    seen.add(phrase)
    const item = makeQuizItem(phrase, lesson.lessonKey, lesson.lessonTitle, 'compound', items.length)
    if (item) items.push(item)
  }

  for (const phrase of lesson.recallPhrases) {
    if (seen.has(phrase)) continue
    seen.add(phrase)
    const item = makeQuizItem(phrase, lesson.lessonKey, lesson.lessonTitle, 'recall', items.length)
    if (item) items.push(item)
  }

  return items
}

export function buildPhraseOptions(
  item: PhraseQuizItem,
  charPool: string[],
  seed?: number,
): string[] {
  const distractors = shuffle(
    charPool.filter((c) => c !== item.answer),
    seed,
  ).slice(0, 3)
  while (distractors.length < 3) {
    distractors.push(item.answer)
  }
  return shuffle([item.answer, ...distractors.slice(0, 3)], (seed ?? 0) + 1)
}

export function getLessonPhraseCharPool(group: LessonCharGroup): string[] {
  return lessonCharPool(group)
}

/** Subset for daily practice (compound first, then recall). */
export function pickDailyPhraseItems(items: PhraseQuizItem[], limit = 6): PhraseQuizItem[] {
  const compounds = items.filter((i) => i.source === 'compound')
  const recalls = items.filter((i) => i.source === 'recall')
  const picked = [...compounds.slice(0, Math.ceil(limit / 2)), ...recalls].slice(0, limit)
  if (picked.length < limit) {
    return [...picked, ...items.filter((i) => !picked.includes(i))].slice(0, limit)
  }
  return picked
}
