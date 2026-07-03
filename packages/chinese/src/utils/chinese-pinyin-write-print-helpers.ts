import type { ChineseLessonRow } from '../types/chineseCharData'
import type { CharCardItem } from './chinese-chars-session-helpers'
import { buildLessonDisplayMap } from './chinese-lesson-display'
import type { WordCardItem } from './chinese-pinyin-write-helpers'

export type PinyinWritePrintKind = 'words' | 'chars' | 'all'

export interface PinyinWritePrintCell {
  pinyin: string
}

/** 一个词语内的若干音节格 */
export interface PinyinWritePrintWordGroup {
  cells: PinyinWritePrintCell[]
}

export interface PinyinWritePrintSection {
  lessonKey: string
  lessonLabel: string
  rows: PinyinWritePrintCell[][]
}

export interface PinyinWriteWordPrintSection {
  lessonKey: string
  lessonLabel: string
  rows: PinyinWritePrintWordGroup[][]
}

export interface PinyinWritePrintLessonBlock {
  lessonKey: string
  lessonLabel: string
  charRows: PinyinWritePrintCell[][]
  wordGroupRows: PinyinWritePrintWordGroup[][]
}

const CHARS_PER_ROW = 10
const WORD_SYLLABLES_PER_ROW = 8

function splitPinyinSyllables(pinyin: string): string[] {
  const trimmed = pinyin.trim()
  if (!trimmed) return []
  return trimmed.split(/\s+/).filter(Boolean)
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size))
  }
  return rows
}

function chunkWordGroupsIntoRows(
  groups: PinyinWritePrintWordGroup[],
  maxSyllablesPerRow: number,
): PinyinWritePrintWordGroup[][] {
  const rows: PinyinWritePrintWordGroup[][] = []
  let currentRow: PinyinWritePrintWordGroup[] = []
  let syllableCount = 0

  for (const group of groups) {
    const size = group.cells.length
    if (currentRow.length > 0 && syllableCount + size > maxSyllablesPerRow) {
      rows.push(currentRow)
      currentRow = []
      syllableCount = 0
    }
    currentRow.push(group)
    syllableCount += size
  }

  if (currentRow.length > 0) rows.push(currentRow)
  return rows
}

function pushLessonWordGroups(
  map: Map<string, PinyinWritePrintWordGroup[]>,
  order: string[],
  lessonKey: string,
  group: PinyinWritePrintWordGroup,
): void {
  if (!map.has(lessonKey)) {
    map.set(lessonKey, [])
    order.push(lessonKey)
  }
  map.get(lessonKey)!.push(group)
}

function pushLessonCells(
  map: Map<string, PinyinWritePrintCell[]>,
  order: string[],
  lessonKey: string,
  cells: PinyinWritePrintCell[],
): void {
  if (cells.length === 0) return
  if (!map.has(lessonKey)) {
    map.set(lessonKey, [])
    order.push(lessonKey)
  }
  map.get(lessonKey)!.push(...cells)
}

export function buildWordPrintSections(
  words: WordCardItem[],
  allLessons: ChineseLessonRow[],
): PinyinWriteWordPrintSection[] {
  const displayMap = buildLessonDisplayMap(allLessons)
  const byLesson = new Map<string, PinyinWritePrintWordGroup[]>()
  const order: string[] = []

  for (const word of words) {
    const cells = splitPinyinSyllables(word.pinyin).map((pinyin) => ({ pinyin }))
    if (cells.length === 0) continue
    pushLessonWordGroups(byLesson, order, word.lessonKey, { cells })
  }

  return order.map((lessonKey) => {
    const groups = byLesson.get(lessonKey) ?? []
    const display = displayMap.get(lessonKey)
    const first = words.find((w) => w.lessonKey === lessonKey)
    return {
      lessonKey,
      lessonLabel: display?.label ?? first?.lessonTitle ?? lessonKey,
      rows: chunkWordGroupsIntoRows(groups, WORD_SYLLABLES_PER_ROW),
    }
  })
}

export function buildCharPrintSections(
  cards: CharCardItem[],
  allLessons: ChineseLessonRow[],
): PinyinWritePrintSection[] {
  const displayMap = buildLessonDisplayMap(allLessons)
  const byLesson = new Map<string, PinyinWritePrintCell[]>()
  const order: string[] = []

  for (const card of cards) {
    const syllables = splitPinyinSyllables(card.pinyin)
    const cells =
      syllables.length > 0
        ? syllables.map((pinyin) => ({ pinyin }))
        : [{ pinyin: card.pinyin || ' ' }]
    pushLessonCells(byLesson, order, card.lessonKey, cells)
  }

  return order.map((lessonKey) => {
    const cells = byLesson.get(lessonKey) ?? []
    const display = displayMap.get(lessonKey)
    const first = cards.find((c) => c.lessonKey === lessonKey)
    return {
      lessonKey,
      lessonLabel: display?.label ?? first?.lessonTitle ?? lessonKey,
      rows: chunkArray(cells, CHARS_PER_ROW),
    }
  })
}

export function buildCombinedPrintLessonBlocks(
  lessonKeys: string[],
  charSections: PinyinWritePrintSection[],
  wordSections: PinyinWriteWordPrintSection[],
): PinyinWritePrintLessonBlock[] {
  const charMap = new Map(charSections.map((s) => [s.lessonKey, s]))
  const wordMap = new Map(wordSections.map((s) => [s.lessonKey, s]))

  return lessonKeys
    .map((lessonKey) => {
      const char = charMap.get(lessonKey)
      const word = wordMap.get(lessonKey)
      if (!char && !word) return null
      return {
        lessonKey,
        lessonLabel: char?.lessonLabel ?? word!.lessonLabel,
        charRows: char?.rows ?? [],
        wordGroupRows: word?.rows ?? [],
      }
    })
    .filter((block): block is PinyinWritePrintLessonBlock => block !== null)
}

export function buildPinyinWritePrintTitle(
  kind: PinyinWritePrintKind,
  bookLabel: string,
  unitTitles: string[],
): string {
  const kindLabel =
    kind === 'words' ? '看拼音写词语' : kind === 'chars' ? '看拼音写生字' : '看拼音写生字词语'
  if (unitTitles.length === 1) {
    return `语文${bookLabel}·${unitTitles[0]}${kindLabel}`
  }
  return `语文${bookLabel}${kindLabel}`
}
