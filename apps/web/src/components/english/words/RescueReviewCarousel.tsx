'use client'

import { useState } from 'react'
import type { WordEntry } from '@/utils/type'
import SpeakButton from './SpeakButton'

interface Props {
  /** Eaten words to review, in order. */
  words: WordEntry[]
  /** Called when the learner finishes reviewing and wants to start practice. */
  onStartPractice: () => void
}

/**
 * Manual review deck shown before the eaten-word practice round.
 * The learner flips through ALL eaten words at their own pace (上一个 / 下一个),
 * then taps 开始练习 to begin the interleaved re-practice. No autoplay — the
 * point is to look them over first, not to be quizzed on a word just revealed.
 */
export default function RescueReviewCarousel({ words, onStartPractice }: Props) {
  const [idx, setIdx] = useState(0)
  const total = words.length
  const word = words[idx]
  if (!word) return null

  const isFirst = idx === 0
  const isLast = idx === total - 1

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col items-center">
      <div className="mb-1 text-center text-[.9rem] font-extrabold text-white/75">
        🃏 先回看被吃的单词
      </div>
      <div className="mb-4 text-[.72rem] font-bold tracking-wide text-white/40">
        看完 {total} 个再开始练习
      </div>

      {/* Card with a faint stacked-deck shadow behind to signal there are more */}
      <div className="relative w-full">
        {!isLast && (
          <>
            <div className="absolute inset-x-6 -bottom-2 h-full rounded-3xl border border-white/5 bg-white/[.03]" />
            <div className="absolute inset-x-3 -bottom-1 h-full rounded-3xl border border-white/[.07] bg-white/[.04]" />
          </>
        )}

        <div
          key={idx}
          className="relative flex min-h-[260px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[rgba(96,165,250,.1)] to-[rgba(167,139,250,.07)] p-6 animate-[fade-up_.25s_ease]"
        >
          {/* soft glow behind the word */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,.16)_0%,transparent_70%)] blur-2xl" />
          </div>

          <div className="relative flex items-center gap-2">
            <span className="text-[clamp(2.4rem,9vw,3.4rem)] leading-tight font-black text-white">
              {word.word}
            </span>
            <SpeakButton
              word={word.word}
              size="text-[1.3rem]"
              className="h-10 w-10 bg-white/10 text-white hover:bg-white/20"
            />
          </div>

          {word.ipa && (
            <div className="relative mt-1 text-[1.05rem] font-bold text-[#a78bfa]">{word.ipa}</div>
          )}
          {word.chineseDef && (
            <div className="relative mt-3 text-[1rem] font-bold text-white/90">{word.chineseDef}</div>
          )}
          <div className="relative mt-1 max-w-[16rem] text-center text-[.9rem] font-semibold text-white/65">
            {word.explanation}
          </div>
          {word.example && (
            <div className="relative mt-3 max-w-[17rem] rounded-xl bg-white/[.05] px-3 py-2 text-center text-[.82rem] text-white/55 italic">
              “{word.example}”
            </div>
          )}
        </div>
      </div>

      {/* progress dots */}
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {words.map((w, i) => (
          <span
            key={w.word + i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === idx
                ? 'bg-[var(--rescue-half)]'
                : i < idx
                  ? 'bg-[var(--rescue-half)] opacity-50'
                  : 'bg-white/15'
            }`}
          />
        ))}
      </div>

      {/* nav */}
      <div className="mt-5 flex w-full items-center gap-3">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={isFirst}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-[.9rem] font-bold text-white/80 transition enabled:hover:bg-white/10 disabled:opacity-25"
        >
          ← 上一个
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onStartPractice}
            className="flex-1 rounded-xl bg-[#534AB7] px-5 py-2.5 text-[.95rem] font-extrabold text-white shadow-[0_6px_18px_rgba(83,74,183,.4)] transition hover:bg-[#3C3489]"
          >
            ⚔️ 开始练习！
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            className="flex-1 rounded-xl bg-[var(--rescue-half)] px-5 py-2.5 text-[.92rem] font-extrabold text-white transition hover:brightness-110"
          >
            下一个 →
          </button>
        )}
      </div>
    </div>
  )
}
