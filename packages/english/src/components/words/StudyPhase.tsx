'use client'

import { useState, type ReactNode } from 'react'
import type { WordEntry } from '@rosie/core'
import { hilite, highlightExample } from '../../utils/english-helpers'
import { getWordImagePublicUrl } from '../../utils/word-image'
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
  /** Adaptive immersive mode uses a single-row icon toolbar without an exit button. */
  compactImmersiveControls?: boolean

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
  onStash?: () => void
  isStashing?: boolean
  onRestart?: () => void
  isRestarting?: boolean
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
  compactImmersiveControls = false,
  progressGradientClasses,
  nextButtonGradientClasses,
  nextButtonShadowClass,
  wordBadge,
  onBack,
  onPrev,
  onNext,
  onComplete,
  completeButtonText,
  onStash,
  isStashing = false,
  onRestart,
  isRestarting = false,
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
  const imageSrc = entry.imagePath ? getWordImagePublicUrl(entry.imagePath) : ''
  const useCompactControls = isImmersive && compactImmersiveControls

  return (
    <div
      className="mx-auto flex max-w-[1280px] flex-col overflow-hidden px-4 max-sm:px-3"
      style={{ height: isImmersive ? '100dvh' : 'calc(100dvh - 56px)' }}
    >
      {useCompactControls ? (
        <div className="flex shrink-0 items-center gap-2 py-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回计划"
            title="返回计划"
            className="font-nunito flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent text-lg font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)] md:w-auto md:px-3 md:text-[.8rem]"
          >
            <span aria-hidden>←</span>
            <span className="hidden md:inline">返回</span>
          </button>
          {onStash && (
            <button
              type="button"
              onClick={onStash}
              disabled={isStashing}
              aria-label={isStashing ? '暂存中' : '暂存练习'}
              title={isStashing ? '暂存中…' : '暂存练习'}
              className="font-nunito flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[rgba(245,158,11,.55)] bg-[rgba(245,158,11,.12)] text-base font-bold text-[#fbbf24] transition-all hover:bg-[rgba(245,158,11,.2)] disabled:cursor-wait disabled:opacity-60 md:w-auto md:px-3 md:text-[.8rem]"
            >
              <span aria-hidden>💾</span>
              <span className="hidden md:inline">{isStashing ? '暂存中…' : '暂存'}</span>
            </button>
          )}
          {onRestart && (
            <button
              type="button"
              onClick={onRestart}
              disabled={isRestarting || isStashing}
              aria-label={isRestarting ? '重置中' : '重新开始卡片预览'}
              title={isRestarting ? '重置中…' : '重新开始'}
              className="font-nunito flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[rgba(96,165,250,.55)] bg-[rgba(96,165,250,.12)] text-xl font-bold text-[#93c5fd] transition-all hover:bg-[rgba(96,165,250,.2)] disabled:cursor-wait disabled:opacity-60 md:w-auto md:px-3 md:text-[.8rem]"
            >
              <span aria-hidden>↻</span>
              <span className="hidden md:inline">{isRestarting ? '重置中…' : '重来'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onStudyDefOnlyChange(!studyDefOnly)}
            aria-label={studyDefOnly ? '关闭仅看释义' : '开启仅看释义'}
            aria-pressed={studyDefOnly}
            title={studyDefOnly ? '关闭仅看释义' : '仅看释义'}
            className={`font-nunito flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border-[1.5px] text-base font-bold transition-all md:w-auto md:px-3 md:text-[.8rem] ${
              studyDefOnly
                ? 'border-[#f59e0b] bg-[rgba(245,158,11,.18)] text-[#fbbf24]'
                : 'border-white/10 bg-white/5 text-white/50 hover:border-[#f59e0b]/60 hover:text-[#fbbf24]'
            }`}
          >
            <span aria-hidden>👁</span>
            <span className="hidden md:inline">仅看释义</span>
          </button>
          <div
            className="font-fredoka ml-auto shrink-0 rounded-full border-[1.5px] border-[rgba(167,139,250,.5)] bg-gradient-to-br from-[rgba(96,165,250,.14)] to-[rgba(124,58,237,.18)] px-3.5 py-1.5 text-[.82rem] font-extrabold whitespace-nowrap text-[#e0e7ff] tabular-nums shadow-[0_0_16px_rgba(124,58,237,.18)] md:px-4 md:py-2 md:text-[.875rem]"
            aria-label={`当前第 ${currentIdx + 1} 个，共 ${totalCount} 个单词`}
          >
            {currentIdx + 1} / {totalCount}
          </div>
        </div>
      ) : (
        <div className="mb-0 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 py-2.5 md:flex md:flex-wrap">
          <div className="flex min-w-0 items-center gap-1.5 md:flex-1 md:gap-2">
            <button
              onClick={onBack}
              className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3 py-2 text-[.75rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)] md:py-1.5"
            >
              ← 返回
            </button>
            {onStash && (
              <button
                type="button"
                onClick={onStash}
                disabled={isStashing}
                aria-label={isStashing ? '暂存中' : '暂存练习'}
                title={isStashing ? '暂存中…' : '暂存练习'}
                className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[rgba(245,158,11,.45)] bg-[rgba(245,158,11,.12)] px-2.5 py-2 text-[.75rem] font-bold text-[#fbbf24] transition-all hover:bg-[rgba(245,158,11,.2)] disabled:cursor-wait disabled:opacity-60 sm:px-3 sm:py-1.5"
              >
                <span aria-hidden>💾</span>
                <span className="hidden sm:inline"> {isStashing ? '暂存中…' : '暂存'}</span>
              </button>
            )}
            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                disabled={isRestarting || isStashing}
                aria-label={isRestarting ? '重置中' : '重新开始卡片预览'}
                title={isRestarting ? '重置中…' : '重新开始'}
                className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[rgba(96,165,250,.45)] bg-[rgba(96,165,250,.12)] px-2.5 py-2 text-[.75rem] font-bold text-[#93c5fd] transition-all hover:bg-[rgba(96,165,250,.2)] disabled:cursor-wait disabled:opacity-60 sm:px-3 sm:py-1.5"
              >
                <span aria-hidden>↻</span>
                <span className="hidden sm:inline"> {isRestarting ? '重置中…' : '重来'}</span>
              </button>
            )}
            <div className="font-fredoka hidden truncate text-[1rem] text-[var(--wm-text)] lg:block">
              {title}
            </div>
          </div>
          <div className="shrink-0 rounded-full border border-[var(--wm-border)] bg-[var(--wm-surface)] px-2.5 py-1 text-[.72rem] font-bold whitespace-nowrap text-[var(--wm-text-dim)]">
            {currentIdx + 1} / {totalCount}
          </div>
          <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 md:col-span-1 md:contents">
            <button
              type="button"
              onClick={() => onStudyDefOnlyChange(!studyDefOnly)}
              aria-pressed={studyDefOnly}
              className={`flex min-w-0 shrink cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-2 text-[.72rem] font-extrabold whitespace-nowrap transition-all select-none md:shrink-0 md:py-1.5 ${
                studyDefOnly
                  ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
                  : 'border-white/10 bg-white/5 text-white/50'
              }`}
            >
              <span aria-hidden>✨</span> 仅看释义
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
                type="button"
                onClick={onExitImmersive}
                className="shrink-0 cursor-pointer rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[.72rem] font-bold text-white/55 transition-all hover:bg-white/20 hover:text-white/80 md:py-1.5"
              >
                ✕ 退出沉浸
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mb-2 h-[3px] shrink-0 rounded-sm bg-white/[.04]">
        <div
          className={`h-full rounded-sm bg-gradient-to-r transition-[width] duration-400 ${progressGradientClasses}`}
          style={{ width: `${((currentIdx + 1) / totalCount) * 100}%` }}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[16px] border border-[var(--wm-border)] max-sm:flex-col">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIdx === 0}
          aria-label="上一个单词"
          title="上一个单词"
          className={`absolute top-[45%] left-0 z-10 flex -translate-y-1/2 cursor-pointer items-center justify-center rounded-full font-black backdrop-blur-sm transition-all hover:scale-110 disabled:cursor-default sm:top-1/2 sm:left-2 ${
            useCompactControls
              ? 'h-12 w-12 border-2 border-[#93c5fd] bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-xl text-white shadow-[0_0_0_4px_rgba(37,99,235,.16),0_6px_22px_rgba(37,99,235,.55)] hover:border-white hover:shadow-[0_0_0_5px_rgba(96,165,250,.22),0_8px_28px_rgba(37,99,235,.7)] disabled:border-white/20 disabled:bg-[#111827] disabled:bg-none disabled:text-white/35 disabled:opacity-60 disabled:shadow-none sm:left-3 sm:h-14 sm:w-14 sm:text-2xl'
              : 'h-11 w-11 border border-white/15 bg-[#090914]/75 text-2xl text-white/70 shadow-lg hover:border-[#60a5fa] hover:text-[#93c5fd] disabled:opacity-20 max-sm:h-10 max-sm:w-10 max-sm:text-xl'
          }`}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => {
            if (isLast) onComplete()
            else onNext()
          }}
          aria-label={isLast ? completeButtonText : '下一个单词'}
          title={isLast ? completeButtonText : '下一个单词'}
          className={`absolute top-[45%] right-0 z-10 flex -translate-y-1/2 cursor-pointer items-center justify-center rounded-full font-black backdrop-blur-sm transition-all hover:scale-110 sm:top-1/2 sm:right-2 ${
            useCompactControls
              ? 'h-12 w-12 border-2 border-[#c4b5fd] bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-xl text-white shadow-[0_0_0_4px_rgba(124,58,237,.16),0_6px_22px_rgba(124,58,237,.58)] hover:border-white hover:shadow-[0_0_0_5px_rgba(167,139,250,.22),0_8px_28px_rgba(124,58,237,.75)] sm:right-3 sm:h-14 sm:w-14 sm:text-2xl'
              : 'h-11 w-11 border border-white/15 bg-[#090914]/75 text-2xl text-white/70 shadow-lg hover:border-[#a78bfa] hover:text-[#c4b5fd] max-sm:h-10 max-sm:w-10 max-sm:text-xl'
          }`}
        >
          {isLast ? '✓' : '→'}
        </button>
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
            {entry.vocabType && (
              <span
                className={
                  entry.vocabType === 'Target'
                    ? 'rounded-full border border-[rgba(52,211,153,.28)] bg-[rgba(52,211,153,.14)] px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider text-[#6ee7b7] uppercase'
                    : entry.vocabType === 'Context'
                      ? 'rounded-full border border-[rgba(251,191,36,.28)] bg-[rgba(251,191,36,.14)] px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider text-[#fcd34d] uppercase'
                      : 'rounded-full border border-[rgba(167,139,250,.28)] bg-[rgba(167,139,250,.14)] px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider text-[#c4b5fd] uppercase'
                }
              >
                {entry.vocabType}
              </span>
            )}
          </div>
          <div className="relative z-[1] flex items-center gap-3">
            <div className="font-nunito text-center text-[clamp(2rem,5vw,3.5rem)] leading-tight font-black break-words">
              <PhonicsWord text={entry.word} syllables={entry.syllables} />
            </div>
            <SpeakButton
              word={entry.word}
              size="text-[1.5rem]"
              className="opacity-40 hover:opacity-90"
            />
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
          className={`relative flex min-h-0 flex-col items-center justify-center overflow-y-auto px-7 py-6 transition-all duration-400 max-sm:w-full max-sm:justify-start max-sm:px-5 max-sm:py-4 ${
            studyDefOnly && !studyWordVisible
              ? 'w-full cursor-pointer max-sm:flex-1'
              : studyDefOnly
                ? 'w-1/2 cursor-pointer max-sm:flex-1'
                : 'w-1/2 cursor-default max-sm:flex-1'
          }`}
          style={{ background: 'linear-gradient(135deg, #0e2a50 0%, #1a1a2e 100%)' }}
        >
          <div className="flex w-full max-w-[420px] flex-col items-start gap-2">
            {imageSrc && (
              <div className="mb-1 flex h-[min(20dvh,150px)] min-h-[96px] w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt={`${entry.word} 配图`}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            <div className="text-[.6rem] font-extrabold tracking-widest text-[rgba(96,165,250,.6)] uppercase">
              释义
            </div>
            <div
              className="text-[clamp(1rem,2.5vw,1.45rem)] leading-loose font-bold text-[#f0f0ff]"
              dangerouslySetInnerHTML={{
                __html: hilite(entry.explanation, entry.keywords),
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

      {!useCompactControls && (
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
      )}
    </div>
  )
}
