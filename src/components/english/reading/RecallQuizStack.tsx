'use client'

import { useState, type ReactNode } from 'react'
import type { WordEntry } from '@/utils/type'
import type { ReadingPassage } from '@/utils/reading-data'
import { findSentenceForWord } from '@/utils/reading-data'
import { buildQuizOptions, wordKey } from '@/utils/english-helpers'
import SpeakButton from '@/components/english/words/SpeakButton'

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function blankSentence(sentence: string, word: string): string {
  const re = new RegExp(`\\b${escapeRe(word)}s?\\b`, 'i')
  return sentence.replace(re, '_______')
}

function highlightedSentence(sentence: string, word: string): ReactNode {
  const re = new RegExp(`\\b${escapeRe(word)}s?\\b`, 'i')
  const m = sentence.match(re)
  if (!m || m.index === undefined) return sentence
  return (
    <>
      {sentence.slice(0, m.index)}
      <span className="rounded-md bg-emerald-200 px-1 py-0.5 font-extrabold text-emerald-900 ring-1 ring-emerald-300">
        {sentence.slice(m.index, m.index + m[0].length)}
      </span>
      {sentence.slice(m.index + m[0].length)}
    </>
  )
}

/** Pick a sentence for a word: in-passage if available, else its general example. */
function sentenceFor(passage: ReadingPassage, entry: WordEntry): string | null {
  const hit = findSentenceForWord(passage, entry.word)
  if (hit) return hit.sentence
  if (entry.example) return entry.example
  return null
}

interface Result {
  selected: WordEntry
  correct: boolean
}

interface Props {
  /** Snapshot of words to quiz. Internally stable — does not re-snapshot on change. */
  items: WordEntry[]
  /** Full lesson words used for distractor pool. */
  lessonWords: WordEntry[]
  passage: ReadingPassage
  onAnswer: (entry: WordEntry, correct: boolean) => void
  /** Tailwind tone for the card chrome. Defaults to amber. */
  tone?: 'amber' | 'sky'
}

const TONE_CARD: Record<NonNullable<Props['tone']>, string> = {
  amber: 'ring-amber-200',
  sky: 'ring-sky-200',
}
const TONE_HEADER: Record<NonNullable<Props['tone']>, string> = {
  amber: 'text-amber-700',
  sky: 'text-sky-700',
}
const TONE_PROMPT: Record<NonNullable<Props['tone']>, string> = {
  amber: 'bg-amber-50/70 ring-amber-200',
  sky: 'bg-sky-50/70 ring-sky-200',
}
const TONE_HINT: Record<NonNullable<Props['tone']>, string> = {
  amber: 'text-amber-700',
  sky: 'text-sky-700',
}
const TONE_OPTION_HOVER: Record<NonNullable<Props['tone']>, string> = {
  amber: 'hover:border-amber-400 hover:bg-amber-50',
  sky: 'hover:border-sky-400 hover:bg-sky-50',
}

export default function RecallQuizStack({
  items,
  lessonWords,
  passage,
  onAnswer,
  tone = 'amber',
}: Props) {
  const [results, setResults] = useState<Record<string, Result>>({})

  const handlePick = (target: WordEntry, option: WordEntry) => {
    const k = wordKey(target)
    if (results[k]) return
    const isCorrect = option.word === target.word
    setResults((prev) => ({ ...prev, [k]: { selected: option, correct: isCorrect } }))
    onAnswer(target, isCorrect)
  }

  const answeredCount = Object.keys(results).length
  const allAnswered = items.length > 0 && answeredCount === items.length

  return (
    <div className="space-y-3">
      {items.map((entry, i) => {
        const k = wordKey(entry)
        const sentence = sentenceFor(passage, entry)
        const seed = (k.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0) ^ i
        const options = buildQuizOptions(entry, lessonWords, seed)
        const result = results[k]
        const ipaStr = entry.ipa ? entry.ipa.replace(/^\/|\/$/g, '') : null
        return (
          <div
            key={k}
            className={`rounded-xl bg-white p-3.5 ring-1 ${TONE_CARD[tone]}`}
          >
            <div className={`mb-2 flex items-center justify-between text-[11px] font-extrabold tracking-wide uppercase ${TONE_HEADER[tone]}`}>
              <span>第 {i + 1} / {items.length} 题</span>
              {result && (
                <span className={result.correct ? 'text-emerald-600' : 'text-rose-600'}>
                  {result.correct ? '✓ 答对了' : '✗ 再看看'}
                </span>
              )}
            </div>

            {sentence ? (
              <div className={`mb-3 rounded-lg px-3 py-2.5 text-[14px] leading-relaxed text-gray-800 ring-1 ${TONE_PROMPT[tone]}`}>
                {result ? (
                  <>&ldquo;{highlightedSentence(sentence, entry.word)}&rdquo;</>
                ) : (
                  <>&ldquo;{blankSentence(sentence, entry.word)}&rdquo;</>
                )}
              </div>
            ) : (
              <div className={`mb-3 rounded-lg px-3 py-2.5 text-[13px] text-gray-700 ring-1 ${TONE_PROMPT[tone]}`}>
                <span className={`mr-1 text-[11px] font-bold ${TONE_HINT[tone]}`}>提示:</span>
                {entry.chineseDef ? entry.chineseDef : entry.explanation}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {options.map((o) => {
                const isTarget = o.word === entry.word
                const wasSelected = result?.selected.word === o.word
                let cls = `border-gray-200 bg-white text-gray-800 hover:-translate-y-px ${TONE_OPTION_HOVER[tone]}`
                if (result) {
                  if (isTarget) cls = 'border-emerald-400 bg-emerald-50 text-emerald-800'
                  else if (wasSelected) cls = 'border-rose-300 bg-rose-50 text-rose-700'
                  else cls = 'border-gray-200 bg-gray-50 text-gray-400'
                }
                return (
                  <button
                    key={o.word}
                    onClick={() => handlePick(entry, o)}
                    disabled={!!result}
                    className={`rounded-xl border-2 px-3 py-2.5 text-left text-[14px] font-bold transition-all ${cls} ${result ? 'cursor-default' : 'cursor-pointer hover:shadow-sm'}`}
                  >
                    {o.word}
                  </button>
                )
              })}
            </div>

            {result && (
              <div className="mt-3 flex items-start justify-between gap-2 rounded-lg bg-emerald-50/70 px-3 py-2 ring-1 ring-emerald-200">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-fredoka text-[16px] font-extrabold text-emerald-800">{entry.word}</span>
                    {ipaStr && <span className="font-mono text-[11px] text-emerald-700/80">/{ipaStr}/</span>}
                    <span className="text-[12px] text-emerald-700/80">· {entry.explanation}</span>
                  </div>
                  {entry.chineseDef && (
                    <div className="mt-0.5 text-[11px] leading-snug text-emerald-700/60">
                      {entry.chineseDef}
                    </div>
                  )}
                </div>
                <SpeakButton word={entry.word} size="text-[14px]" className="h-7 w-7 shrink-0 bg-white text-emerald-700 hover:bg-emerald-50" />
              </div>
            )}
          </div>
        )
      })}

      <div className={`flex items-center text-[11px] font-bold ${TONE_HINT[tone]}`}>
        已答 {answeredCount} / {items.length}
        {allAnswered && ' · 全部完成 🎉'}
      </div>
    </div>
  )
}
