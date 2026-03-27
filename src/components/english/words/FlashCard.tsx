'use client'

import type { WordEntry, WordMasteryInfo } from '@/utils/type'
import { getWordSizeClass } from '@/utils/phonics'
import { hilite } from '@/utils/english-helpers'
import { getWordMasteryLevel, MASTERY_ICON, MASTERY_BORDER, MASTERY_BADGE_BG } from '@/utils/masteryUtils'
import PhonicsWord from './PhonicsWord'

interface FlashCardProps {
  entry: WordEntry
  flipped: boolean
  onFlip: () => void
  index: number
  masteryInfo?: WordMasteryInfo
}

export default function FlashCard({ entry, flipped, onFlip, index, masteryInfo }: FlashCardProps) {
  const sz = getWordSizeClass(entry.word)
  const level = getWordMasteryLevel(masteryInfo?.correct ?? 0)
  const wordFontSize = {
    xl: 'text-[2.1rem]',
    lg: 'text-[1.85rem]',
    md: 'text-[1.5rem]',
    sm: 'text-[1.25rem]',
    xs: 'text-[1.05rem]',
  }[sz]

  const delay = Math.min(index * 0.03, 0.25)
  const explHtml = hilite(entry.explanation, entry.word)

  return (
    <div
      className="min-h-[256px]"
      style={{ perspective: '1200px', animation: `card-flip-fade-up .3s ease ${delay}s backwards` }}
    >
      <div
        onClick={onFlip}
        className="w-full min-h-[256px] relative cursor-pointer transition-transform duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
        }}
      >
        {/* ── Front ── */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden p-4 flex flex-col border-2 ${MASTERY_BORDER[level]}`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            background: 'linear-gradient(145deg, #1c1c3a 0%, #111126 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05), 0 4px 24px rgba(0,0,0,.35)',
          }}
        >
          {/* Decorative top-right glow */}
          <div
            className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
            style={{ background: 'radial-gradient(circle at top right, rgba(233,69,96,.12), transparent 70%)' }}
          />
          {/* Decorative background initial */}
          <div
            className="absolute -bottom-3 -right-1 font-fredoka font-black leading-none pointer-events-none select-none"
            style={{ fontSize: 'clamp(72px,14vw,108px)', color: 'rgba(109,40,217,.07)', zIndex: 0 }}
          >
            {entry.word.charAt(0).toUpperCase()}
          </div>

          {/* Header: unit / lesson badges + mastery badge */}
          <div className="flex gap-1.5 flex-wrap shrink-0 relative z-[1] justify-between">
            <div className="flex gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[.58rem] font-extrabold uppercase tracking-wider bg-[rgba(233,69,96,.14)] text-[#f87171] border border-[rgba(233,69,96,.22)]">
                {entry.unit}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[.58rem] font-extrabold uppercase tracking-wider bg-[rgba(96,165,250,.14)] text-[#93c5fd] border border-[rgba(96,165,250,.22)]">
                {entry.lesson}
              </span>
            </div>
            {level > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[.65rem] font-extrabold`}>
                {MASTERY_ICON[level]}
              </span>
            )}
          </div>

          {/* Center: word + ipa */}
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 relative z-[1] py-1">
            <div className={`font-nunito ${wordFontSize} font-black leading-tight text-center break-words`}>
              <PhonicsWord text={entry.word} />
            </div>
            {entry.ipa && (
              <div className="text-[.8rem] text-[#e879f9] italic font-medium opacity-80 tracking-wide text-center">
                {entry.ipa}
              </div>
            )}
          </div>

          {/* Bottom: definition preview */}
          <div className="relative z-[1] border-t border-white/[.06] pt-2 mt-0.5">
            <p className="text-[.69rem] text-white/[.28] leading-relaxed line-clamp-2">
              {entry.explanation}
            </p>
          </div>

          {/* Flip hint */}
          <span className="absolute bottom-2 right-2.5 text-white/[.14] text-[.62rem] font-bold select-none">↻</span>
        </div>

        {/* ── Back ── */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden p-5 flex items-center justify-center min-h-[256px]"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(145deg, #0b1a36 0%, #0e2244 100%)',
            border: '1px solid rgba(96,165,250,.1)',
            boxShadow: 'inset 0 1px 0 rgba(96,165,250,.07), 0 4px 24px rgba(0,0,0,.35)',
          }}
        >
          {/* Definition — centered */}
          <div
            className="text-[1.15rem] font-bold leading-relaxed text-[#dde8ff] text-center [&_strong]:text-[#60a5fa] [&_strong]:font-extrabold"
            dangerouslySetInnerHTML={{ __html: explHtml }}
          />

          {/* Flip back hint */}
          <span className="absolute bottom-2 right-2.5 text-white/[.14] text-[.62rem] font-bold select-none">↩</span>
        </div>
      </div>
    </div>
  )
}
