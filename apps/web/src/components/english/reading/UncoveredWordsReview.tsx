'use client'

import { useMemo, useState } from 'react'
import type { WordEntry } from '@rosie/core'
import type { ReadingPassage } from '@/utils/reading-data'
import { wordKey } from '@/utils/english-helpers'
import RecallQuizStack from './RecallQuizStack'

interface Props {
  passage: ReadingPassage
  lessonWords: WordEntry[]
  /** Cross-session recall counts per word key. Pending = words tied for the
   *  lowest count — rotating round logic (round N = lifting everyone from N-1). */
  recallCounts: Record<string, number>
  onAnswer: (entry: WordEntry, correct: boolean) => void
}

export default function UncoveredWordsReview({
  passage,
  lessonWords,
  recallCounts,
  onAnswer,
}: Props) {
  // Pending = words tied for the lowest recall count. Round N targets the
  // tier sitting at count = N-1, lifting them to N. After everyone is at N,
  // the tier shifts and a fresh round opens for the same words. Never empties.
  const { pending, round } = useMemo(() => {
    if (lessonWords.length === 0) return { pending: [] as WordEntry[], round: 1 }
    let minCount = Infinity
    for (const w of lessonWords) {
      const c = recallCounts[wordKey(w)] ?? 0
      if (c < minCount) minCount = c
    }
    const list = lessonWords.filter((w) => (recallCounts[wordKey(w)] ?? 0) === minCount)
    return { pending: list, round: minCount + 1 }
  }, [lessonWords, recallCounts])

  const [expanded, setExpanded] = useState(false)
  // Snapshot on expand so answered cards persist when recallCounts updates.
  const [quizItems, setQuizItems] = useState<WordEntry[]>([])

  if (pending.length === 0 && quizItems.length === 0) return null

  const handleExpand = () => {
    setQuizItems(pending)
    setExpanded(true)
  }

  const handleCollapse = () => {
    setExpanded(false)
    setQuizItems([])
  }

  return (
    <div className="mt-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-4 ring-1 ring-amber-200">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📝</span>
          <h3 className="text-sm font-extrabold text-amber-900">
            {round === 1 ? '补考 · 还没回想过的词' : `第 ${round} 轮回想 · 继续巩固`}
          </h3>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
          {pending.length}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {pending.map((w) => (
          <span
            key={wordKey(w)}
            className="inline-flex items-center rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-bold text-amber-900 ring-1 ring-amber-300"
          >
            {w.word}
          </span>
        ))}
      </div>

      {!expanded && (
        <button
          onClick={handleExpand}
          className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 px-4 py-3 text-white shadow-[0_4px_14px_rgba(245,158,11,.3)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(245,158,11,.45)] active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-[14px] font-extrabold">
            <span className="text-base">▼</span>
            一起测一遍 · {pending.length} 题
          </span>
          <span className="text-[11px] font-bold opacity-90">挖空填词 · 凭印象选</span>
        </button>
      )}

      {expanded && (
        <>
          <RecallQuizStack
            items={quizItems}
            lessonWords={lessonWords}
            passage={passage}
            onAnswer={onAnswer}
            tone="amber"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleCollapse}
              className="cursor-pointer rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200 hover:bg-white"
            >
              收起
            </button>
          </div>
        </>
      )}
    </div>
  )
}
