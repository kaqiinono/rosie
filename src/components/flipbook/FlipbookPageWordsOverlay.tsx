'use client'

import clsx from 'clsx'
import type { WordEntry } from '@/utils/type'
import { briefChineseDef } from '@/utils/flipbook-word-match'

type FlipbookPageWordsOverlayProps = {
  page: number
  words: WordEntry[]
  visible: boolean
}

export default function FlipbookPageWordsOverlay({
  page,
  words,
  visible,
}: FlipbookPageWordsOverlayProps) {
  if (!visible || words.length === 0) return null

  return (
    <div
      className={clsx(
        'pointer-events-none absolute top-14 right-2 z-20 max-w-[min(42vw,220px)]',
        'max-h-[calc(100%-3.5rem)] overflow-y-auto',
        'rounded-xl border border-[var(--flipbook-chrome-border)]',
        'bg-[var(--flipbook-chrome-bg)]/88 backdrop-blur-md',
        'px-2.5 py-2 shadow-lg',
      )}
      aria-live="polite"
    >
      <p className="mb-1.5 font-mono text-[9px] tracking-[0.14em] text-[var(--flipbook-muted)] uppercase">
        第 {page} 页 · {words.length} 词
      </p>
      <ul className="flex flex-col gap-1">
        {words.map((entry) => (
          <li key={`${entry.unit}::${entry.lesson}::${entry.word}`} className="leading-tight">
            <span className="text-[11px] font-semibold text-[var(--flipbook-fg)]">{entry.word}</span>
            <span className="mx-1 text-[10px] text-[var(--flipbook-muted)]">·</span>
            <span className="text-[10px] text-[var(--flipbook-muted)]">
              {briefChineseDef(entry)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
