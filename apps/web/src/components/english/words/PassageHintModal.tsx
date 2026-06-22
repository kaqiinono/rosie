'use client'

import type { WordEntry } from '@rosie/core'
import { blankWordInSentence } from '@/utils/reading-data'

interface PassageHintModalProps {
  open: boolean
  word: WordEntry
  sentence: string
  onClose: () => void
}

export default function PassageHintModal({ open, word, sentence, onClose }: PassageHintModalProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 px-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="font-nunito relative w-full max-w-md animate-pop-in overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          aria-label="关闭"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="px-5 pt-5 pb-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">📖</span>
            <span className="text-[12px] font-extrabold tracking-[.14em] text-amber-700 uppercase">
              来自 {word.unit} · {word.lesson} 课文
            </span>
          </div>
          <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-4 text-[1.1rem] leading-relaxed font-bold text-amber-950">
            &ldquo;{blankWordInSentence(sentence, word.word)}&rdquo;
          </div>
          <div className="mt-3 text-center text-[11px] text-gray-500">
            根据课文情境，选出最合适的答案 ✨
          </div>
        </div>
      </div>
    </div>
  )
}
