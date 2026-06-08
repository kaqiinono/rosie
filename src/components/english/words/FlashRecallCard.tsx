'use client'

import { useEffect, useState } from 'react'
import type { WordEntry } from '@/utils/type'

interface Props {
  word: WordEntry
  /** 0-based step index */
  step: 0 | 1 | 2
  totalSteps: number
  onDone: () => void
}

/** Tiny floating sparkle particle — pure CSS animation, no library needed */
function SparkleParticle({
  delay,
  offsetX,
}: {
  delay: string
  offsetX: string
}) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute text-[10px] leading-none select-none"
      style={{
        left: offsetX,
        top: '50%',
        transform: 'translateY(-50%)',
        animationName: 'flash-sparkle-rise',
        animationDuration: '1.1s',
        animationTimingFunction: 'ease-out',
        animationFillMode: 'both',
        animationDelay: delay,
      }}
    >
      ✦
    </span>
  )
}

export default function FlashRecallCard({ word, step, totalSteps, onDone }: Props) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Auto pronunciation via SpeechSynthesis API
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(word.word)
      u.lang = 'en-US'
      u.rate = 0.85
      window.speechSynthesis.speak(u)
    }
    const t1 = setTimeout(() => setLeaving(true), 1200)
    const t2 = setTimeout(() => onDone(), 1500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [word, onDone])

  const handleSkip = () => {
    setLeaving(true)
    setTimeout(onDone, 200)
  }

  return (
    <div
      onClick={handleSkip}
      className={`relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[rgba(96,165,250,.08)] to-[rgba(167,139,250,.06)] p-8 transition-opacity duration-300 ${
        leaving ? 'opacity-0' : 'opacity-100 animate-[fade-up_.3s_ease]'
      }`}
    >
      {/* Ambient background orb — soft glow behind word */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,.13)_0%,transparent_70%)] blur-2xl" />
      </div>

      {/* Header hint */}
      <div className="mb-6 text-center text-[.9rem] font-bold text-white/70">
        🌟 看一眼，记一记 🌟
      </div>

      {/* Word — with glow breath animation + sparkle particles */}
      <div className="relative mb-2 flex items-center justify-center">
        <SparkleParticle offsetX="-20%" delay="0.15s" />
        <SparkleParticle offsetX="110%" delay="0.35s" />
        <SparkleParticle offsetX="5%"   delay="0.55s" />
        <SparkleParticle offsetX="85%"  delay="0.25s" />

        <span
          className="text-[60px] font-black leading-tight text-white"
          style={{
            animationName: 'flash-word-glow',
            animationDuration: '1.5s',
            animationTimingFunction: 'ease-in-out',
            animationFillMode: 'both',
          }}
        >
          {word.word}
        </span>
      </div>

      {word.ipa && (
        <div className="mb-2 text-[1.1rem] font-bold text-[#a78bfa]">{word.ipa}</div>
      )}

      <div className="mb-8 text-center text-[1rem] font-bold text-white/90">
        {word.explanation}
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const isActive = i === step
          const isPast = i < step
          return (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                isPast
                  ? 'bg-[var(--rescue-half)] opacity-60'
                  : isActive
                  ? 'bg-[var(--rescue-half)]'
                  : 'bg-white/15'
              }`}
              style={
                isActive
                  ? {
                      animationName: 'flash-dot-pulse',
                      animationDuration: '1.5s',
                      animationTimingFunction: 'ease-in-out',
                      animationIterationCount: 'infinite',
                    }
                  : undefined
              }
            />
          )
        })}
      </div>

      <div className="mt-3 text-[.7rem] text-white/40">
        拯救进度 {step + 1}/{totalSteps}
      </div>
    </div>
  )
}
