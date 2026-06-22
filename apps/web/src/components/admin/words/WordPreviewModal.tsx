'use client'

import type { WordEntry } from '@rosie/core'
import FlashCard from '@/components/english/words/FlashCard'
import PhonicsLegend from '@/components/english/words/PhonicsLegend'

interface Props {
  word: WordEntry
  onClose: () => void
}

export default function WordPreviewModal({ word, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-2xl p-5 shadow-2xl"
        style={{ background: 'var(--wm-bg)', color: 'var(--wm-text)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-extrabold text-[var(--wm-text)]">卡片预览</h3>
            <p className="mt-0.5 text-[12px] text-[var(--wm-text-dim)]">
              与闪卡页双面模式一致 · {word.word}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-[var(--wm-text-dim)] transition hover:bg-white/10 hover:text-[var(--wm-text)]"
          >
            关闭
          </button>
        </div>
        <PhonicsLegend />
        <FlashCard entry={word} flipped={false} onFlip={() => {}} index={0} dualMode />
      </div>
    </div>
  )
}
