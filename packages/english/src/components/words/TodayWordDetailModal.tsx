'use client'

import { useEffect, useState } from 'react'
import type { WordEntry, WordMasteryMap } from '@rosie/core'
import { wordKey } from '../../utils/english-helpers'
import FlashCard from './FlashCard'
import { IconButton } from '@rosie/ui/themes'

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
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-3"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`今日单词卡片：${word.word}`}
        onClick={(event) => event.stopPropagation()}
        className="shadow-sticker-lg relative flex max-h-[94dvh] w-full max-w-[920px] flex-col rounded-[24px] border border-[rgba(167,139,250,.3)] bg-[#0d0d1e] p-3 sm:p-5"
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
            <IconButton
              type="button"
              onClick={onClose}
              aria-label="关闭单词卡片"
              variant="outline"
              color="gray"
              size="3"
              className="w-9"
            >
              ×
            </IconButton>
          </div>
        </div>

        <div className="relative min-h-0 overflow-y-auto px-0.5 py-1">
          <IconButton
            type="button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
            aria-label="上一个单词"
            title="上一个单词"
            variant="outline"
            color="gray"
            size="3"
            className="absolute top-1/2 left-2 z-20 w-12 sm:left-3 sm:w-14 sm:text-2xl"
          >
            ←
          </IconButton>
          <FlashCard
            key={wordKey(word)}
            entry={word}
            flipped={false}
            onFlip={() => undefined}
            index={0}
            masteryInfo={masteryMap?.[wordKey(word)]}
            dualMode
          />
          <IconButton
            type="button"
            onClick={() => setIndex((value) => Math.min(words.length - 1, value + 1))}
            disabled={index === words.length - 1}
            aria-label="下一个单词"
            title="下一个单词"
            variant="outline"
            color="gray"
            size="3"
            className="absolute top-1/2 right-2 z-20 w-12 sm:right-3 sm:w-14 sm:text-2xl"
          >
            →
          </IconButton>
        </div>
      </div>
    </div>
  )
}
