'use client'

import type { WordEntry } from '@/utils/type'
import { getWordSizeClass } from '@/utils/phonics'
import { hilite, escHtml } from '@/utils/english-helpers'
import PhonicsWord from './PhonicsWord'

interface FlashCardProps {
  entry: WordEntry
  flipped: boolean
  onFlip: () => void
  index: number
}

export default function FlashCard({ entry, flipped, onFlip, index }: FlashCardProps) {
  const sz = getWordSizeClass(entry.word)
  const wordFontSize = sz === 'is-long' ? 'text-[1.05rem] max-sm:text-[.9rem]'
    : sz === 'is-phrase' ? 'text-[1.3rem] max-sm:text-[1.1rem]'
      : 'text-[1.85rem] max-sm:text-[1.6rem]'

  const delay = Math.min(index * 0.03, 0.25)
  const explHtml = hilite(entry.explanation, entry.word)

  return (
    <div
      className="min-h-[240px]"
      style={{ perspective: '1000px', animation: `card-flip-fade-up .28s ease ${delay}s backwards` }}
    >
      <div
        onClick={onFlip}
        className="w-full min-h-[240px] relative cursor-pointer transition-transform duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-[var(--wm-radius)] border border-[var(--wm-border)] overflow-hidden bg-gradient-to-br from-[#1e1e35] to-[#161628] p-4 flex flex-col gap-1.5"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          <div className="absolute top-0 right-0 w-[90px] h-[90px] bg-[radial-gradient(circle_at_top_right,rgba(233,69,96,.1),transparent_70%)] rounded-bl-full" />
          <div className="flex gap-1 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[.6rem] font-extrabold uppercase tracking-wider bg-[rgba(233,69,96,.2)] text-[var(--wm-accent)] border border-[rgba(233,69,96,.3)]">
              {entry.unit}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[.6rem] font-extrabold uppercase tracking-wider bg-[rgba(96,165,250,.2)] text-[var(--wm-accent4)] border border-[rgba(96,165,250,.3)]">
              {entry.lesson}
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-1 py-1">
            <div className={`font-nunito ${wordFontSize} font-black leading-tight text-center break-words`}>
              <PhonicsWord text={entry.word} />
            </div>
            {entry.ipa && (
              <div className="text-[.85rem] text-[var(--wm-accent2)] italic font-semibold text-center tracking-wide opacity-90">
                {entry.ipa}
              </div>
            )}
          </div>
          <div className="text-[.72rem] text-[var(--wm-text-dim)] leading-relaxed border-t border-[var(--wm-border)] pt-1.5 line-clamp-2">
            {entry.explanation}
          </div>
          <span className="absolute bottom-1.5 right-2.5 text-[.58rem] text-white/[.18] font-bold">点击翻面</span>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-[var(--wm-radius)] border border-[var(--wm-border)] overflow-hidden bg-gradient-to-br from-[#0f3460] to-[#1a1a2e] p-5 flex flex-col items-center justify-center gap-2.5 min-h-[240px]"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <span className="text-[.6rem] font-extrabold uppercase tracking-widest text-[var(--wm-accent4)] opacity-70 self-start">
            释义
          </span>
          <div
            className="text-[1.05rem] font-bold text-center leading-relaxed text-[var(--wm-text)]"
            dangerouslySetInnerHTML={{ __html: explHtml }}
          />
          <div className="font-nunito text-[.9rem] font-black text-white/30 text-center mt-1">
            {entry.word}
          </div>
          {entry.ipa && (
            <div className="text-[.8rem] text-[var(--wm-accent2)] italic opacity-70">
              {entry.ipa}
            </div>
          )}
          <span className="absolute bottom-1.5 right-2.5 text-[.58rem] text-white/[.18] font-bold">点击翻回</span>
        </div>
      </div>
    </div>
  )
}
