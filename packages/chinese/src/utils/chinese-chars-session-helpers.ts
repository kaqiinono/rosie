import type { ChineseCharProfile, ChineseLessonRow } from '../types/chineseCharData'
import type { LessonCharGroup, PoemEntry } from './grade1-down/types'
import { POEMS } from './grade1-down/poems'
import { ACCUMULATION } from './grade1-down/accumulation'
import { UNITS } from './grade1-down/units'
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

export type CharQuizType = 'recognize' | 'stroke' | 'phrase'

export const ALL_CHAR_QUIZ_TYPES: CharQuizType[] = ['recognize', 'stroke', 'phrase']

export const MOON_REWARDS = {
  char: 1,
  phrase: 2,
  poem: 3,
  accumulation: 3,
  passage: 5,
} as const

export type PracticePhase =
  | 'cards'
  | 'chars'
  | 'phrases'
  | 'poems'
  | 'accumulation'
  | 'passage'
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

export interface PassageQuizItem {
  id: string
  lessonKey: string
  lessonTitle: string
  prompt: string
  answer: string
  options: string[]
}

export interface PracticeSessionPlan {
  cards: CharCardItem[]
  charQuestions: CharPracticeQuestion[]
  phraseItems: PhraseQuizItem[]
  poems: PoemEntry[]
  accumulationItems: AccumulationQuizItem[]
  passageItems: PassageQuizItem[]
  possibleMoons: number
}

export function getUnitOptions(): UnitOption[] {
  return UNITS.map((u) => ({ unit: u.unit, title: u.title }))
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

function poemsForLessons(filtered: FilteredLesson[]): PoemEntry[] {
  const seen = new Set<string>()
  const out: PoemEntry[] = []
  for (const poem of POEMS) {
    if (seen.has(poem.id)) continue
    if (filtered.some(({ lesson }) => poemMatchesLesson(poem, lesson))) {
      seen.add(poem.id)
      out.push(poem)
    }
  }
  return out
}

function accumulationLabelsForUnits(units: Set<number>): string[] {
  const labels: string[] = []
  for (const block of ACCUMULATION) {
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
): LessonContentBlock[] {
  const displayMap = buildLessonDisplayMap(allLessons)
  return filtered.map(({ lesson, group }) => {
    const phraseItems = buildLessonPhraseItems(lesson, group, charByKey)
    const poems = poemsForLessons([{ lesson, group }])
    const passage = getLessonPassage(lesson.lessonKey)
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
      poems,
      accumulationLabels:
        lesson.lessonKind === 'garden'
          ? accumulationLabelsForUnits(new Set([lesson.unit]))
          : [],
      hasPassage: Boolean(passage?.paragraphs.length),
    }
  })
}

export function buildCharCardItems(
  filtered: FilteredLesson[],
  allLessons: ChineseLessonRow[],
): CharCardItem[] {
  const items: CharCardItem[] = []
  const seen = new Set<string>()
  const displayMap = buildLessonDisplayMap(allLessons)

  for (const { lesson, group } of filtered) {
    const display = displayMap.get(lesson.lessonKey)
    const push = (ch: string, pinyin: string, track: 'recognize' | 'write') => {
      const key = charKey(ch)
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

function buildPassageOptions(answer: string, pool: string[], seed: number): string[] {
  const distractors = shuffle(
    pool.filter((c) => c !== answer),
    seed,
  ).slice(0, 3)
  while (distractors.length < 3) distractors.push(answer)
  return shuffle([answer, ...distractors.slice(0, 3)], seed + 1)
}

export function buildPassageQuizItems(filtered: FilteredLesson[]): PassageQuizItem[] {
  const items: PassageQuizItem[] = []

  for (const { lesson, group } of filtered) {
    const passage = getLessonPassage(lesson.lessonKey)
    if (!passage?.paragraphs.length) continue

    const charPool = [...new Set([...group.recognize, ...group.write])]
    if (charPool.length === 0) continue

    for (const para of passage.paragraphs) {
      const sentences = para.split(/(?<=[。！？])/).filter((s) => s.trim())
      for (const sentence of sentences) {
        const chars = [...sentence].filter((c) => charPool.includes(c))
        if (chars.length === 0) continue
        const answer = chars[0]
        const idx = sentence.indexOf(answer)
        if (idx < 0) continue
        const display = sentence.slice(0, idx) + '□' + sentence.slice(idx + answer.length)
        const id = `${lesson.lessonKey}::passage::${items.length}`
        const seed = id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 13) >>> 0
        items.push({
          id,
          lessonKey: lesson.lessonKey,
          lessonTitle: lesson.lessonTitle,
          prompt: display.trim(),
          answer,
          options: buildPassageOptions(answer, charPool, seed),
        })
        break
      }
    }
  }

  return items
}

export function buildCharPracticeQuestions(
  filtered: FilteredLesson[],
  charByKey: Map<string, ChineseCharProfile>,
  quizTypes: Set<CharQuizType>,
  allLessons: ChineseLessonRow[],
): CharPracticeQuestion[] {
  const questions: CharPracticeQuestion[] = []
  const cards = buildCharCardItems(filtered, allLessons)
  const phraseItems = filtered.flatMap(({ lesson, group }) =>
    buildLessonPhraseItems(lesson, group, charByKey),
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
      const profile = charByKey.get(card.charKey)
      if (profile?.strokeOrder?.strokes?.length) {
        questions.push({
          kind: 'stroke',
          id: `${card.charKey}::stroke`,
          char: card.char,
          charKey: card.charKey,
          lessonTitle: card.lessonTitle,
        })
      }
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
): PracticeSessionPlan {
  const cards = buildCharCardItems(filtered, allLessons)
  const charQuestions = buildCharPracticeQuestions(filtered, charByKey, quizTypes, allLessons)
  const phraseItems = filtered.flatMap(({ lesson, group }) =>
    buildLessonPhraseItems(lesson, group, charByKey),
  )
  const poems = poemsForLessons(filtered)
  const units = new Set(filtered.map((f) => f.lesson.unit))
  const accumulationItems = buildAccumulationQuizItems(ACCUMULATION).filter((item) =>
    units.has(item.unit),
  )
  const passageItems = buildPassageQuizItems(filtered)

  const possibleMoons =
    charQuestions.length * MOON_REWARDS.char +
    phraseItems.length * MOON_REWARDS.phrase +
    poems.length * MOON_REWARDS.poem +
    accumulationItems.length * MOON_REWARDS.accumulation +
    passageItems.length * MOON_REWARDS.passage

  return {
    cards,
    charQuestions,
    phraseItems,
    poems,
    accumulationItems,
    passageItems,
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
