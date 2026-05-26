'use client'

import { useState, type ReactNode } from 'react'
import type { WordEntry } from '@/utils/type'
import { hilite, highlightExample } from '@/utils/english-helpers'
import PhonicsWord from './PhonicsWord'
import SpeakButton from './SpeakButton'

interface StudyPhaseProps {
  entry: WordEntry
  currentIdx: number
  totalCount: number
  title: string

  studyDefOnly: boolean
  onStudyDefOnlyChange: (v: boolean) => void

  isImmersive: boolean
  onExitImmersive: () => void

  // Full Tailwind class strings — must appear as literals in callers
  // so the JIT scanner generates them.
  progressGradientClasses: string
  nextButtonGradientClasses: string
  nextButtonShadowClass: string

  wordBadge: ReactNode

  onBack: () => void
  onPrev: () => void
  onNext: () => void
  onComplete: () => void
  completeButtonText: string
}

export default function StudyPhase({
  entry,
  currentIdx,
  totalCount,
  title,
  studyDefOnly,
  onStudyDefOnlyChange,
  isImmersive,
  onExitImmersive,
  progressGradientClasses,
  nextButtonGradientClasses,
  nextButtonShadowClass,
  wordBadge,
  onBack,
  onPrev,
  onNext,
  onComplete,
  completeButtonText,
}: StudyPhaseProps) {
  // Reset word visibility when the word or "definition only" toggle changes.
  // Uses the in-render "adjusting state from props" pattern to avoid an extra
  // commit and the resulting flash that a useEffect-based reset would cause.
  const [prevEntry, setPrevEntry] = useState(entry)
  const [prevStudyDefOnly, setPrevStudyDefOnly] = useState(studyDefOnly)
  const [studyWordVisible, setStudyWordVisible] = useState(false)
  if (prevEntry !== entry || prevStudyDefOnly !== studyDefOnly) {
    setPrevEntry(entry)
    setPrevStudyDefOnly(studyDefOnly)
    setStudyWordVisible(false)
  }

  const isLast = currentIdx === totalCount - 1

  return (
    <div
      className="mx-auto flex max-w-[1280px] flex-col overflow-hidden px-4 max-sm:px-3"
      style={{ height: isImmersive ? '100dvh' : 'calc(100dvh - 56px)' }}
    >
      <div className="mb-0 flex shrink-0 flex-wrap items-center gap-2 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            onClick={onBack}
            className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3 py-1.5 text-[.75rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]"
          >
            ← 返回
          </button>
          <div className="font-fredoka truncate text-[1rem] text-[var(--wm-text)]">
            {title}
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-[var(--wm-border)] bg-[var(--wm-surface)] px-2.5 py-1 text-[.72rem] font-bold whitespace-nowrap text-[var(--wm-text-dim)]">
          {currentIdx + 1} / {totalCount}
        </div>
        <button
          onClick={() => onStudyDefOnlyChange(!studyDefOnly)}
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[.72rem] font-extrabold whitespace-nowrap transition-all select-none ${
            studyDefOnly
              ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
              : 'border-white/10 bg-white/5 text-white/50'
          }`}
        >
          <span>✨</span> 仅看释义
          <div
            className={`relative h-3.5 w-7 rounded-[7px] transition-colors ${studyDefOnly ? 'bg-[rgba(245,158,11,.5)]' : 'bg-white/10'}`}
          >
            <div
              className={`absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full transition-all ${studyDefOnly ? 'translate-x-3.5 bg-[#f59e0b]' : 'bg-white/40'}`}
            />
          </div>
        </button>
        {isImmersive && (
          <button
            onClick={onExitImmersive}
            className="shrink-0 cursor-pointer rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[.72rem] font-bold text-white/55 transition-all hover:bg-white/20 hover:text-white/80"
          >
            ✕ 退出沉浸
          </button>
        )}
      </div>

      <div className="mb-2 h-[3px] shrink-0 rounded-sm bg-white/[.04]">
        <div
          className={`h-full rounded-sm bg-gradient-to-r transition-[width] duration-400 ${progressGradientClasses}`}
          style={{ width: `${((currentIdx + 1) / totalCount) * 100}%` }}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[16px] border border-[var(--wm-border)] max-sm:flex-col">
        <div
          className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden px-7 py-6 transition-all duration-400 max-sm:px-5 ${
            studyDefOnly && !studyWordVisible
              ? 'w-0 overflow-hidden p-0 opacity-0 max-sm:h-0 max-sm:w-full'
              : 'w-1/2 opacity-100 max-sm:h-[45%] max-sm:w-full'
          }`}
          style={{ background: 'linear-gradient(135deg, #1a1a30 0%, #12122a 100%)' }}
        >
          <div className="font-fredoka pointer-events-none absolute top-1/2 right-[-10px] -translate-y-1/2 text-[min(35vw,240px)] leading-none text-white/[.022] select-none">
            {entry.word.charAt(0).toUpperCase()}
          </div>
          <div className="relative z-[1] flex flex-wrap justify-center gap-1.5">
            {wordBadge}
            <span className="rounded-full border border-[rgba(233,69,96,.3)] bg-[rgba(233,69,96,.2)] px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider text-[var(--wm-accent)] uppercase">
              {entry.unit}
            </span>
          </div>
          <div className="relative z-[1] flex items-center gap-3">
            <div className="font-nunito text-center text-[clamp(2rem,5vw,3.5rem)] leading-tight font-black break-words">
              <PhonicsWord text={entry.word} syllables={entry.syllables} />
            </div>
            <SpeakButton word={entry.word} size="text-[1.5rem]" className="opacity-40 hover:opacity-90" />
          </div>
          {entry.ipa && (
            <div className="relative z-[1] text-[clamp(.85rem,1.8vw,1rem)] font-semibold text-[var(--wm-accent2)] italic opacity-85">
              {entry.ipa}
            </div>
          )}
          {entry.example && (
            <div className="relative z-[1] w-full border-t border-white/[.07] pt-3 text-center">
              <div className="mb-1.5 text-[.55rem] font-extrabold tracking-widest text-white/30 uppercase">
                例句
              </div>
              <div
                className="text-[1rem] leading-loose text-[rgba(200,200,255,.5)] italic [&_strong]:font-extrabold [&_strong]:text-[#4ade80] [&_strong]:not-italic"
                dangerouslySetInnerHTML={{
                  __html: highlightExample(entry.example, entry.word),
                }}
              />
            </div>
          )}
        </div>

        <div
          onClick={() => {
            if (studyDefOnly) setStudyWordVisible(!studyWordVisible)
          }}
          className={`relative flex flex-col items-center justify-center px-7 py-6 transition-all duration-400 max-sm:w-full max-sm:px-5 ${
            studyDefOnly && !studyWordVisible
              ? 'w-full cursor-pointer max-sm:flex-1'
              : studyDefOnly
                ? 'w-1/2 cursor-pointer max-sm:flex-1'
                : 'w-1/2 cursor-default max-sm:flex-1'
          }`}
          style={{ background: 'linear-gradient(135deg, #0e2a50 0%, #1a1a2e 100%)' }}
        >
          <div className="flex w-full max-w-[420px] flex-col items-start gap-2">
            <div className="text-[.6rem] font-extrabold tracking-widest text-[rgba(96,165,250,.6)] uppercase">
              释义
            </div>
            <div
              className="text-[clamp(1rem,2.5vw,1.45rem)] leading-loose font-bold text-[#f0f0ff]"
              dangerouslySetInnerHTML={{
                __html: hilite(entry.explanation, entry.word, entry.keywords),
              }}
            />
            {entry.chineseDef && (
              <div className="text-[clamp(.82rem,1.8vw,1rem)] leading-relaxed text-white/35">
                {entry.chineseDef}
              </div>
            )}
          </div>
          {studyDefOnly && (
            <div className="absolute right-5 bottom-4 flex items-center gap-1 text-[.65rem] font-bold text-white/25">
              {studyWordVisible ? '点击隐藏单词' : '点击查看单词'}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-3.5 py-2">
        <button
          onClick={() => {
            if (currentIdx > 0) onPrev()
          }}
          disabled={currentIdx === 0}
          className="font-nunito cursor-pointer rounded-full border-[1.5px] border-white/10 bg-transparent px-6 py-2.5 text-[1rem] font-bold text-white/40 transition-all hover:border-[#60a5fa] hover:text-[#93c5fd] disabled:cursor-default disabled:opacity-20"
        >
          ← 上一个
        </button>
        <div className="min-w-[60px] text-center text-[0.875rem] font-bold text-white/30">
          {currentIdx + 1} / {totalCount}
        </div>
        <button
          onClick={() => {
            if (isLast) onComplete()
            else onNext()
          }}
          className={`font-nunito cursor-pointer rounded-full border-0 bg-gradient-to-br px-7 py-2.5 text-[1rem] font-extrabold text-white hover:-translate-y-px ${nextButtonGradientClasses} ${nextButtonShadowClass}`}
        >
          {isLast ? completeButtonText : '下一个 →'}
        </button>
      </div>
    </div>
  )
}
