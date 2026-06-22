'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { FlashCard } from '@rosie/english'
import type { FlipbookBook } from '@/utils/flipbook-types'
import type { WordEntry, WordMasteryMap } from '@rosie/core'
import { wordKey } from '@rosie/english'
import { getBookWordEntries } from '@/utils/flipbook-word-match'

type FlipbookWordCarouselModalProps = {
  book: FlipbookBook
  words: WordEntry[]
  masteryMap?: WordMasteryMap
  onClose: () => void
}

export default function FlipbookWordCarouselModal({
  book,
  words,
  masteryMap,
  onClose,
}: FlipbookWordCarouselModalProps) {
  const router = useRouter()
  const [index, setIndex] = useState(0)

  const total = words.length
  const current = words[index]

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? total - 1 : i - 1))
  }, [total])

  const goNext = useCallback(() => {
    setIndex((i) => (i >= total - 1 ? 0 : i + 1))
  }, [total])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext])

  const startReading = () => {
    onClose()
    router.push(`/flipbook/${book.id}`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={`${book.title} 词汇预览`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12121c] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-white">{book.title}</h2>
            <p className="mt-0.5 text-xs text-white/45">词汇预览 · 共 {total} 词</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white"
          >
            关闭
          </button>
        </header>

        {total === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-white/50">暂无匹配词库单词</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 px-4 py-2">
              <button
                type="button"
                onClick={goPrev}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 hover:bg-white/10"
                aria-label="上一个单词"
              >
                ◀
              </button>
              <span className="font-mono text-xs text-white/50">
                {index + 1} / {total}
              </span>
              <button
                type="button"
                onClick={goNext}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 hover:bg-white/10"
                aria-label="下一个单词"
              >
                ▶
              </button>
            </div>

            <div className="overflow-y-auto px-4 pb-4">
              {current && (
                <FlashCard
                  entry={current}
                  flipped={false}
                  onFlip={() => {}}
                  index={0}
                  dualMode
                  masteryInfo={masteryMap?.[wordKey(current)]}
                />
              )}
            </div>
          </>
        )}

        <footer className="flex gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={startReading}
            className={clsx(
              'flex-1 rounded-xl py-3 text-sm font-bold text-white',
              'bg-gradient-to-br from-orange-400 to-amber-500 shadow-md active:scale-[0.98]',
            )}
          >
            开始阅读 →
          </button>
        </footer>
      </div>
    </div>
  )
}

/** Resolve display words for a book (uses cached keys or live match). */
export function flipbookPreviewWords(book: FlipbookBook, vocab: WordEntry[]): WordEntry[] {
  return getBookWordEntries(book.syncManifest, vocab)
}
