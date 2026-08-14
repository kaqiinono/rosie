'use client'

import { useEffect, useState } from 'react'
import type { WordEntry, WordMasteryMap } from '@rosie/core'
import { wordKey } from '../../utils/english-helpers'
import FlashCard from './FlashCard'

type TodayWordDetailModalProps = {
  words: WordEntry[]
  initialWord: WordEntry
  masteryMap?: WordMasteryMap
  onClose: () => void
}

export default function TodayWordDetailModal({
  words,
  initialWord,
  masteryMap,
  onClose,
}: TodayWordDetailModalProps) {
  const [index, setIndex] = useState(() => {
    const initialKey = wordKey(initialWord)
    const nextIndex = words.findIndex((entry) => wordKey(entry) === initialKey)
    return nextIndex >= 0 ? nextIndex : 0
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1))
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(words.length - 1, value + 1))
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, words.length])

  if (words.length === 0) return null
  const word = words[index] ?? words[0]

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`今日单词卡片：${word.word}`}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[94dvh] w-full max-w-[920px] flex-col rounded-[24px] border border-[rgba(167,139,250,.3)] bg-[#0d0d1e] p-3 shadow-[0_24px_80px_rgba(0,0,0,.6)] sm:p-5"
      >
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3 px-1">
          <div>
            <div className="text-[.65rem] font-extrabold tracking-[.14em] text-[#c4b5fd]/70 uppercase">
              今日单词 · 双面卡片
            </div>
            <div className="mt-0.5 text-[.72rem] font-bold text-white/35">使用 ← → 切换单词</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[rgba(167,139,250,.3)] bg-[rgba(167,139,250,.1)] px-3 py-1 text-[.75rem] font-extrabold text-[#e9d5ff] tabular-nums">
              {index + 1} / {words.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭单词卡片"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-lg text-white/55 transition hover:bg-white/[.12] hover:text-white"
            >
              ×
            </button>
          </div>
        </div>

        <div className="relative min-h-0 overflow-y-auto px-0.5 py-1">
          <button
            type="button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
            className="absolute top-1/2 left-2 z-20 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-[#93c5fd] bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-xl font-black text-white shadow-[0_0_0_4px_rgba(37,99,235,.16),0_6px_22px_rgba(37,99,235,.55)] backdrop-blur-md transition hover:scale-110 hover:border-white disabled:cursor-default disabled:border-white/20 disabled:bg-[#111827] disabled:bg-none disabled:text-white/35 disabled:opacity-60 disabled:shadow-none sm:left-3 sm:h-14 sm:w-14 sm:text-2xl"
            aria-label="上一个单词"
            title="上一个单词"
          >
            ←
          </button>
          <FlashCard
            key={wordKey(word)}
            entry={word}
            flipped={false}
            onFlip={() => undefined}
            index={0}
            masteryInfo={masteryMap?.[wordKey(word)]}
            dualMode
          />
          <button
            type="button"
            onClick={() => setIndex((value) => Math.min(words.length - 1, value + 1))}
            disabled={index === words.length - 1}
            className="absolute top-1/2 right-2 z-20 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-[#c4b5fd] bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-xl font-black text-white shadow-[0_0_0_4px_rgba(124,58,237,.16),0_6px_22px_rgba(124,58,237,.58)] backdrop-blur-md transition hover:scale-110 hover:border-white disabled:cursor-default disabled:border-white/20 disabled:bg-[#111827] disabled:bg-none disabled:text-white/35 disabled:opacity-60 disabled:shadow-none sm:right-3 sm:h-14 sm:w-14 sm:text-2xl"
            aria-label="下一个单词"
            title="下一个单词"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
