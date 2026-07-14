import type { MasteryLevel, QuizType, WordEntry } from '@rosie/core'
import { buildQuizOptions, normalizeQuizTypes } from './english-helpers'
import { blankWordInSentence, findPassage, findSentenceForWord } from './reading-data'

export type EnglishPrintOption = {
  label: string
  text: string
}

export type EnglishPrintQuestion = {
  num: number
  type: QuizType
  word: WordEntry
  prompt: string
  ipa?: string
  options: EnglishPrintOption[]
}

export type EnglishPrintSection = {
  type: QuizType
  title: string
  questions: EnglishPrintQuestion[]
}

const TYPE_TITLES: Record<QuizType, string> = {
  A: 'A. 释义 → 选单词',
  B: 'B. 单词 → 选释义',
  C: 'C. 释义 → 默写',
  D: 'D. 课文语境填空',
}

export function parsePrintUnits(raw: string | null): Set<string> {
  if (!raw) return new Set()
  return new Set(raw.split(',').filter(Boolean))
}

export function parsePrintLessons(raw: string | null): Set<string> {
  if (!raw) return new Set()
  return new Set(raw.split(',').filter(Boolean))
}

export function parsePrintWords(raw: string | null): Set<string> {
  if (!raw) return new Set()
  return new Set(raw.split(',').filter(Boolean))
}

export function parsePrintTypes(raw: string | null): QuizType[] {
  if (!raw) return ['A', 'B', 'C']
  const valid = raw.split(',').filter(
    (t): t is QuizType => t === 'A' || t === 'B' || t === 'C' || t === 'D',
  )
  return normalizeQuizTypes(valid)
}

export function parsePrintMastery(raw: string | null): MasteryLevel | null {
  if (raw === null || raw === '') return null
  const n = parseInt(raw, 10)
  if (n === 0 || n === 1 || n === 2 || n === 3) return n
  return null
}

export function serializePrintTypes(types: QuizType[]): string {
  return normalizeQuizTypes(types).join(',')
}

export function isEligibleForTypeD(entry: WordEntry): boolean {
  const passage = findPassage(entry.stage, entry.unit, entry.lesson)
  return passage !== undefined && findSentenceForWord(passage, entry.word) !== null
}

export function buildPracticePrintTitle(
  stage: string,
  selUnits: Set<string>,
  selLessons: Set<string>,
  wordCount: number,
  types: QuizType[],
): string {
  const units = selUnits.size ? [...selUnits].join(', ') : '全部 Unit'
  const lessons = selLessons.size
    ? [...new Set([...selLessons].map((k) => k.split('::')[1]))].join(', ')
    : '全部 Lesson'
  const typeLabels = normalizeQuizTypes(types).join('')
  return `英语单词练习 · ${stage} · ${units} / ${lessons} · ${wordCount}词 · 题型 ${typeLabels}`
}

function sortWords(words: WordEntry[]): WordEntry[] {
  return [...words].sort((a, b) => {
    const ka = `${a.unit}\0${a.lesson}\0${a.word}`
    const kb = `${b.unit}\0${b.lesson}\0${b.word}`
    return ka.localeCompare(kb)
  })
}

export function buildPrintSections(
  words: WordEntry[],
  types: QuizType[],
  vocabPool: WordEntry[],
  seed = 42,
): EnglishPrintSection[] {
  const orderedTypes = normalizeQuizTypes(types)
  if (!orderedTypes.length || !words.length) return []

  const sortedWords = sortWords(words)
  let globalNum = 1
  const sections: EnglishPrintSection[] = []

  for (const type of orderedTypes) {
    const typeWords =
      type === 'D' ? sortedWords.filter(isEligibleForTypeD) : sortedWords
    if (!typeWords.length) continue

    const questions: EnglishPrintQuestion[] = typeWords.map((word, i) => {
      const qSeed = seed + globalNum * 997 + i
      const num = globalNum++

      if (type === 'A') {
        const options = buildQuizOptions(word, vocabPool, qSeed)
        return {
          num,
          type,
          word,
          prompt: word.explanation,
          options: options.map((o, idx) => ({
            label: ['A', 'B', 'C', 'D'][idx] ?? String(idx + 1),
            text: o.word,
          })),
        }
      }

      if (type === 'B') {
        const options = buildQuizOptions(word, vocabPool, qSeed)
        return {
          num,
          type,
          word,
          prompt: word.word,
          ipa: word.ipa,
          options: options.map((o, idx) => ({
            label: ['A', 'B', 'C', 'D'][idx] ?? String(idx + 1),
            text: o.explanation,
          })),
        }
      }

      if (type === 'C') {
        return {
          num,
          type,
          word,
          prompt: word.explanation,
          options: [],
        }
      }

      const passage = findPassage(word.stage, word.unit, word.lesson)!
      const sentence = findSentenceForWord(passage, word.word)!.sentence
      const options = buildQuizOptions(word, vocabPool, qSeed)
      return {
        num,
        type,
        word,
        prompt: blankWordInSentence(sentence, word.word),
        options: options.map((o, idx) => ({
          label: ['A', 'B', 'C', 'D'][idx] ?? String(idx + 1),
          text: o.word,
        })),
      }
    })

    sections.push({ type, title: TYPE_TITLES[type], questions })
  }

  return sections
}
