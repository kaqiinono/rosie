'use client'

import { useState } from 'react'
import type { WordEntry, WordMasteryInfo } from '@/utils/type'
import { getWordSizeClass } from '@/utils/phonics'
import { hilite } from '@/utils/english-helpers'
import { getWordMasteryLevel, MASTERY_ICON, MASTERY_BORDER } from '@/utils/masteryUtils'
import { findPassage, findSentenceForWord } from '@/utils/reading-data'
import PhonicsWord from './PhonicsWord'
import SpeakButton from './SpeakButton'

interface FlashCardProps {
  entry: WordEntry
  flipped: boolean
  onFlip: () => void
  index: number
  masteryInfo?: WordMasteryInfo
}

function highlightWordInSentence(sentence: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b(${escaped})s?\\b`, 'i')
  const m = sentence.match(re)
  if (!m || m.index === undefined) return sentence
  return (
    <>
      {sentence.slice(0, m.index)}
      <span className="font-extrabold text-amber-300">{sentence.slice(m.index, m.index + m[0].length)}</span>
      {sentence.slice(m.index + m[0].length)}
    </>
  )
}

export default function FlashCard({ entry, flipped, onFlip, index, masteryInfo }: FlashCardProps) {
  const [sentenceExpanded, setSentenceExpanded] = useState(false)
  const sz = getWordSizeClass(entry.word)
  const level = getWordMasteryLevel(masteryInfo?.correct ?? 0)
  // Bumped ~15% across the scale so the word reads as the clear focal point.
  const wordFontSize = {
    xl: 'text-[2.45rem]',
    lg: 'text-[2.15rem]',
    md: 'text-[1.75rem]',
    sm: 'text-[1.45rem]',
    xs: 'text-[1.2rem]',
  }[sz]

  const delay = Math.min(index * 0.03, 0.25)
  const explHtml = hilite(entry.explanation, entry.word, entry.keywords)

  // Show 课文原句 for any word whose lesson has a passage — independent of
  // the week-plan's ⭐ focus marker. The marker is a plan-level annotation;
  // here we just key off "is there a passage for this lesson?".
  const passage = findPassage(entry.stage, entry.unit, entry.lesson)
  const passageSentence = passage ? findSentenceForWord(passage, entry.word) : null

  return (
    <div
      className="min-h-[256px] rounded-2xl"
      style={{ perspective: '1200px', animation: `card-flip-fade-up .3s ease ${delay}s backwards` }}
    >
      <div
        onClick={onFlip}
        className="relative min-h-[256px] w-full cursor-pointer transition-transform duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          WebkitTransform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── Front ── */}
        <div
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-2xl border-2 p-4 ${MASTERY_BORDER[level]}`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg) translateZ(0.01px)',
            WebkitTransform: 'rotateY(0deg) translateZ(0.01px)',
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

          {/* Center: word + ipa + speak */}
          <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-1.5 py-1">
            <div className="flex items-center gap-2">
              <div
                className={`font-nunito ${wordFontSize} text-center leading-tight font-black break-words`}
              >
                <PhonicsWord text={entry.word} syllables={entry.syllables} />
              </div>
              <SpeakButton word={entry.word} className="opacity-50 hover:opacity-100" />
            </div>
            {entry.ipa && (
              <div className="font-mono text-center text-[.78rem] font-normal tracking-normal text-white/30">
                {entry.ipa}
              </div>
            )}
          </div>

          {/* Bottom: prefer 课文原句 (real context). 通用例句 only shows nested
              inside the expanded passage area, or standalone when no passage
              exists for this word's lesson. */}
          {passageSentence ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSentenceExpanded((v) => !v)
              }}
              className="group relative z-[1] mt-0.5 w-full cursor-pointer rounded-lg border border-amber-500/20 bg-amber-500/[.07] px-2 py-1.5 text-left transition hover:border-amber-500/40 hover:bg-amber-500/[.12]"
              aria-expanded={sentenceExpanded}
              title={sentenceExpanded ? '收起' : '展开全文'}
            >
              <div className="mb-0.5 flex items-center justify-between gap-1 text-[.55rem] font-extrabold tracking-wider text-amber-300/80 uppercase">
                <span className="flex items-center gap-1">
                  <span>📖</span> 课文原句
                </span>
                <span className="font-mono text-amber-300/60 transition group-hover:text-amber-300">
                  {sentenceExpanded ? '收起 ▴' : '展开 ▾'}
                </span>
              </div>
              <p className={`text-[.78rem] leading-relaxed text-white/55 ${sentenceExpanded ? '' : 'line-clamp-3'}`}>
                {highlightWordInSentence(passageSentence.sentence, entry.word)}
              </p>
              {sentenceExpanded && entry.example && (
                <div className="mt-2 border-t border-amber-500/15 pt-2">
                  <div className="mb-0.5 text-[.55rem] font-extrabold tracking-wider text-white/30 uppercase">
                    通用例句
                  </div>
                  <p className="text-[.78rem] leading-relaxed text-white/40 italic">
                    {entry.example}
                  </p>
                </div>
              )}
            </button>
          ) : entry.example ? (
            <div className="relative z-[1] mt-0.5 border-t border-white/[.06] pt-2">
              <div className="mb-0.5 text-[.55rem] font-extrabold tracking-wider text-white/[.22] uppercase">
                通用例句
              </div>
              <p className="text-[.8rem] leading-relaxed text-white/[.32]">
                {entry.example}
              </p>
            </div>
          ) : null}

          {/* Flip hint */}
          <span className="absolute right-2.5 bottom-2 text-[.62rem] font-bold text-white/[.14] select-none">
            ↻
          </span>
        </div>

        {/* ── Back ── */}
        <div
          className="absolute inset-0 flex min-h-[256px] flex-col items-center justify-center gap-0 overflow-hidden rounded-2xl p-5"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg) translateZ(0.01px)',
            WebkitTransform: 'rotateY(180deg) translateZ(0.01px)',
            background: 'linear-gradient(145deg, #0b1a36 0%, #0e2244 100%)',
            border: '1px solid rgba(96,165,250,.1)',
            boxShadow: 'inset 0 1px 0 rgba(96,165,250,.07), 0 4px 24px rgba(0,0,0,.35)',
          }}
        >
          {/* English definition */}
          <div
            className="text-center text-[1.15rem] leading-relaxed font-bold text-[#dde8ff] [&_strong]:font-extrabold [&_strong]:text-[#60a5fa]"
            dangerouslySetInnerHTML={{ __html: explHtml }}
          />

          {/* Chinese definition */}
          {entry.chineseDef && (
            <div className="mt-4 flex w-full flex-col items-center gap-1.5">
              <div className="h-px w-10 rounded-full" style={{ background: 'rgba(96,165,250,.15)' }} />
              <p className="text-center text-[.82rem] font-semibold tracking-wide text-white/40">
                {entry.chineseDef}
              </p>
            </div>
          )}

          {/* Flip back hint */}
          <span className="absolute right-2.5 bottom-2 text-[.62rem] font-bold text-white/[.14] select-none">
            ↩
          </span>
        </div>
      </div>
    </div>
  )
}
