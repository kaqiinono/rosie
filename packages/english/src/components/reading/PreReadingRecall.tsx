'use client'

import type { WordEntry, WordMasteryMap } from '@rosie/core'
import type { ReadingPassage } from '../../utils/reading-data'
import { wordKey } from '../../utils/english-helpers'
import { getWordMasteryLevel, type MasteryLevel } from '@rosie/core'
import RecallQuizStack from './RecallQuizStack'
import { Button, IconButton } from '@rosie/ui/themes'

interface Props {
  open: boolean
  onClose: () => void
  passage: ReadingPassage
  lessonWords: WordEntry[]
  masteryMap: WordMasteryMap
  recallCounts: Record<string, number>
  onAnswer: (entry: WordEntry, correct: boolean) => void
  /** Open the WordPopup for a chip click — wired to the page-level popup. */
  onWordClick: (entry: WordEntry) => void
}

// Mastery-tinted pills — mirror the old bottom-strip palette so the integrated
// view keeps the established colour language.
const PILL_COLOR: Record<MasteryLevel, 'amber' | 'sky' | 'violet' | 'green'> = {
  0: 'amber',
  1: 'sky',
  2: 'violet',
  3: 'green',
}
const PILL_DOT: Record<MasteryLevel, string> = {
  0: 'bg-amber-400',
  1: 'bg-sky-400',
  2: 'bg-violet-400',
  3: 'bg-emerald-400',
}

const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'
function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUP_DIGITS[Number(d)] ?? d)
    .join('')
}

export default function PreReadingRecall({
  open,
  onClose,
  passage,
  lessonWords,
  masteryMap,
  recallCounts,
  onAnswer,
  onWordClick,
}: Props) {
  if (!open || lessonWords.length === 0) return null

  return (
    <div className="mb-5 rounded-2xl bg-indigo-50 p-4 ring-1 ring-sky-200">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h3 className="text-sm font-extrabold text-sky-900">
            本课词汇 · 共 {lessonWords.length} 个
          </h3>
        </div>
        <IconButton
          onClick={onClose}
          aria-label="关闭"
          variant="outline"
          color="sky"
          size="1"
          className="w-7 shrink-0"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </IconButton>
      </div>

      <p className="mb-3 text-[12px] leading-relaxed text-sky-800/80">
        点单词查中英文释义,或向下挖空填词测一遍
      </p>

      {/* Mastery-coloured word pills — clickable, identical role to old bottom strip */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {lessonWords.map((w) => {
          const level = getWordMasteryLevel(masteryMap[wordKey(w)]?.correct ?? 0)
          const recalls = recallCounts[wordKey(w)] ?? 0
          return (
            <Button
              key={wordKey(w)}
              type="button"
              onClick={() => onWordClick(w)}
              variant="soft"
              color={PILL_COLOR[level]}
              size="1"
              radius="full"
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${PILL_DOT[level]}`} />
              {w.word}
              {recalls > 0 && (
                <span
                  aria-hidden
                  title={`已回想 ${recalls} 次`}
                  className="-ml-0.5 align-super text-[8px] leading-none font-extrabold text-emerald-600/70"
                >
                  ✓{recalls >= 2 ? toSuperscript(recalls) : ''}
                </span>
              )}
            </Button>
          )
        })}
      </div>

      {/* Subtle divider before the quiz section */}
      <div className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-sky-700/60 uppercase">
        <span className="h-px flex-1 bg-sky-200" />
        <span>挖空填词 · 测一下</span>
        <span className="h-px flex-1 bg-sky-200" />
      </div>

      <RecallQuizStack
        items={lessonWords}
        lessonWords={lessonWords}
        passage={passage}
        onAnswer={onAnswer}
        tone="sky"
      />
    </div>
  )
}
