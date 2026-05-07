'use client'

import type { WordEntry, WordMasteryInfo } from '@/utils/type'
import { getWordSizeClass } from '@/utils/phonics'
import { hilite } from '@/utils/english-helpers'
import { getWordMasteryLevel, MASTERY_ICON, MASTERY_BORDER } from '@/utils/masteryUtils'
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
  const explHtml = hilite(entry.explanation, entry.word, entry.keywords)

  return (
    <div
      className="min-h-[256px] overflow-hidden rounded-2xl"
      style={{ perspective: '1200px', animation: `card-flip-fade-up .3s ease ${delay}s backwards` }}
    >
      <div
        onClick={onFlip}
        className="relative min-h-[256px] w-full cursor-pointer transition-transform duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
        }}
      >
        {/* ── Front ── */}
        <div
          className={`absolute inset-0 flex flex-col rounded-2xl border-2 p-4 ${MASTERY_BORDER[level]}`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            background: 'linear-gradient(145deg, #1c1c3a 0%, #111126 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05), 0 4px 24px rgba(0,0,0,.35)',
          }}
        >
          {/* Decorative top-right glow */}
          <div
            className="pointer-events-none absolute top-0 right-0 h-24 w-24"
            style={{
              background:
                'radial-gradient(circle at top right, rgba(233,69,96,.12), transparent 70%)',
            }}
          />
          {/* Decorative background initial */}
          <div
            className="font-fredoka pointer-events-none absolute -right-1 -bottom-3 leading-none font-black select-none"
            style={{ fontSize: 'clamp(72px,14vw,108px)', color: 'rgba(109,40,217,.07)', zIndex: 0 }}
          >
            {entry.word.charAt(0).toUpperCase()}
          </div>

          {/* Header: unit / lesson badges + mastery badge */}
          <div className="relative z-[1] flex shrink-0 flex-wrap justify-between gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-[rgba(233,69,96,.22)] bg-[rgba(233,69,96,.14)] px-2 py-0.5 text-[.58rem] font-extrabold tracking-wider text-[#f87171] uppercase">
                {entry.unit}
              </span>
              <span className="rounded-full border border-[rgba(96,165,250,.22)] bg-[rgba(96,165,250,.14)] px-2 py-0.5 text-[.58rem] font-extrabold tracking-wider text-[#93c5fd] uppercase">
                {entry.lesson}
              </span>
            </div>
            {level > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[.65rem] font-extrabold`}>
                {MASTERY_ICON[level]}
              </span>
            )}
          </div>

          {/* Center: word + ipa */}
          <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-1.5 py-1">
            <div
              className={`font-nunito ${wordFontSize} text-center leading-tight font-black break-words`}
            >
              <PhonicsWord text={entry.word} syllables={entry.syllables} />
            </div>
            {entry.ipa && (
              <div className="text-center text-[1.125rem] font-medium tracking-wide text-[#e879f9] italic opacity-80">
                {entry.ipa}
              </div>
            )}
          </div>

          {/* Bottom: definition preview */}
          <div className="relative z-[1] mt-0.5 border-t border-white/[.06] pt-2">
            <p className="line-clamp-2 text-[.8rem] leading-relaxed text-white/[.28]">
              {entry.example}
            </p>
          </div>

          {/* Flip hint */}
          <span className="absolute right-2.5 bottom-2 text-[.62rem] font-bold text-white/[.14] select-none">
            ↻
          </span>
        </div>

        {/* ── Back ── */}
        <div
          className="absolute inset-0 flex min-h-[256px] items-center justify-center rounded-2xl p-5"
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
            className="text-center text-[1.15rem] leading-relaxed font-bold text-[#dde8ff] [&_strong]:font-extrabold [&_strong]:text-[#60a5fa]"
            dangerouslySetInnerHTML={{ __html: explHtml }}
          />

          {/* Flip back hint */}
          <span className="absolute right-2.5 bottom-2 text-[.62rem] font-bold text-white/[.14] select-none">
            ↩
          </span>
        </div>
      </div>
    </div>
  )
}
