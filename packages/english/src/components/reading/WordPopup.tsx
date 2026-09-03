'use client'

import { useEffect } from 'react'
import type { WordEntry, WordMasteryInfo } from '@rosie/core'
import type { ReadingPassage } from '../../utils/reading-data'
import {
  buildEntryRegex,
  findSentenceForWord,
  resolveWordFormMatch,
} from '../../utils/reading-data'
import { WORD_FORM_LABELS, type WordFormMatch } from '../../utils/word-forms'
import { wordKey } from '../../utils/english-helpers'
import {
  getWordMasteryLevel,
  GRADUATED_STAGE_HARD,
  GRADUATED_STAGE_NORMAL,
  MASTERY_ICON,
  type MasteryLevel,
} from '@rosie/core'
import SpeakButton from '../words/SpeakButton'

interface WordPopupProps {
  entry: WordEntry | null
  matchedForm?: WordFormMatch | null
  entries?: WordEntry[]
  passage: ReadingPassage
  mastery: WordMasteryInfo | undefined
  onEntryChange?: (entry: WordEntry) => void
  onClose: () => void
}

const LEVEL_LABEL: Record<MasteryLevel, string> = {
  0: '未掌握',
  1: '学习中',
  2: '熟悉',
  3: '已掌握',
}

const LEVEL_BAR_COLOR: Record<MasteryLevel, string> = {
  0: 'bg-amber-400',
  1: 'bg-sky-400',
  2: 'bg-violet-400',
  3: 'bg-emerald-400',
}

const LEVEL_ACCENT_BG: Record<MasteryLevel, string> = {
  0: 'from-amber-300 to-orange-400',
  1: 'from-sky-300 to-blue-400',
  2: 'from-violet-300 to-purple-400',
  3: 'from-emerald-300 to-green-400',
}

function highlightSentence(sentence: string, entry: WordEntry) {
  const re = buildEntryRegex(entry)
  const m = sentence.match(re)
  if (!m || m.index === undefined) return <>{sentence}</>
  const before = sentence.slice(0, m.index)
  const hit = sentence.slice(m.index, m.index + m[0].length)
  const after = sentence.slice(m.index + m[0].length)
  return (
    <>
      {before}
      <span className="rounded bg-amber-200 px-1 font-bold text-amber-900">{hit}</span>
      {after}
    </>
  )
}

export default function WordPopup({
  entry,
  matchedForm,
  entries = [],
  passage,
  mastery,
  onEntryChange,
  onClose,
}: WordPopupProps) {
  const currentIndex = entry
    ? entries.findIndex((candidate) => wordKey(candidate) === wordKey(entry))
    : -1
  const canGoPrevious = currentIndex > 0
  const canGoNext = currentIndex >= 0 && currentIndex < entries.length - 1

  useEffect(() => {
    if (!entry) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && canGoPrevious) {
        e.preventDefault()
        onEntryChange?.(entries[currentIndex - 1])
      }
      if (e.key === 'ArrowRight' && canGoNext) {
        e.preventDefault()
        onEntryChange?.(entries[currentIndex + 1])
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canGoNext, canGoPrevious, currentIndex, entries, entry, onClose, onEntryChange])

  if (!entry) return null

  const level = getWordMasteryLevel(mastery?.correct ?? 0)
  const stage = mastery?.stage ?? 0
  const isHard = mastery?.isHard ?? false
  const maxStage = isHard ? GRADUATED_STAGE_HARD : GRADUATED_STAGE_NORMAL
  const stagePercent = Math.min(100, Math.round((stage / maxStage) * 100))

  const found = findSentenceForWord(passage, entry)
  const sentenceMatch = found?.sentence.match(buildEntryRegex(entry))?.[0]
  const effectiveMatch = matchedForm ?? (sentenceMatch ? resolveWordFormMatch(sentenceMatch, [entry]) : null)
  const isInflected = effectiveMatch && effectiveMatch.source !== 'base'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="font-nunito relative max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-[slide-up_.2s_cubic-bezier(.4,0,.2,1)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${LEVEL_ACCENT_BG[level]}`} />

        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          aria-label="关闭"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="px-5 pt-5 pb-2 pr-14">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-extrabold text-gray-900">{entry.word}</h3>
            {MASTERY_ICON[level] && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600 ring-1 ring-gray-200"
                title={LEVEL_LABEL[level]}
              >
                <span className="text-[13px] leading-none">{MASTERY_ICON[level]}</span>
                <span>{LEVEL_LABEL[level]}</span>
              </span>
            )}
            <SpeakButton
              word={entry.word}
              size="text-[1.2rem]"
              className="h-9 w-9 bg-amber-100 text-amber-700 hover:bg-amber-200 hover:scale-110"
            />
          </div>
          {entry.ipa && (
            <div className="mt-0.5 text-sm italic text-gray-500">{entry.ipa}</div>
          )}
          {isInflected && (
            <div className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800 ring-1 ring-indigo-200">
              <span className="font-extrabold">{effectiveMatch.matchedText}</span>
              <span className="mx-1.5 text-indigo-400">←</span>
              <span>
                {entry.word} 的
                {effectiveMatch.formTypes.map((type) => WORD_FORM_LABELS[type]).join(' / ')}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3 px-5 pb-5">
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 ring-1 ring-sky-200">
              词库来源 · {entry.stage ?? '未分级'} · {entry.unit} · {entry.lesson}
            </span>
            {passage.stage === 'story' && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 ring-1 ring-amber-200">
                故事来源 · {passage.unit} · {passage.title}
              </span>
            )}
          </div>

          <div>
            <div className="mb-1 text-[11px] font-bold tracking-wider text-gray-400 uppercase">释义</div>
            <p className="text-[15px] leading-relaxed text-gray-800">{entry.explanation}</p>
            {entry.chineseDef && (
              <p className="mt-0.5 text-[12px] leading-snug text-gray-500">
                {entry.chineseDef}
              </p>
            )}
          </div>

          {found && (
            <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 ring-1 ring-amber-200/60">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-amber-700 uppercase">
                <span>📖</span> 课文原句
              </div>
              <p className="text-[14px] leading-relaxed text-gray-800">
                {highlightSentence(found.sentence, entry)}
              </p>
            </div>
          )}

          {entry.example && !found && (
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="mb-1 text-[11px] font-bold tracking-wider text-gray-500 uppercase">例句</div>
              <p className="text-[14px] leading-relaxed text-gray-700 italic">{entry.example}</p>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold tracking-wider text-gray-400 uppercase">
              <span>掌握度</span>
              <span className="text-gray-600 normal-case">
                {LEVEL_LABEL[level]} · Stage {stage}/{maxStage}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full transition-all duration-500 ${LEVEL_BAR_COLOR[level]}`}
                style={{ width: `${stagePercent}%` }}
              />
            </div>
            {mastery && (
              <div className="mt-1.5 flex gap-3 text-[11px] text-gray-500">
                <span>✓ {mastery.correct}</span>
                <span>✗ {mastery.incorrect}</span>
                {isHard && <span className="text-rose-500">困难</span>}
              </div>
            )}
          </div>
        </div>

        {currentIndex >= 0 && entries.length > 1 && (
          <div className="sticky bottom-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-gray-100 bg-white/95 px-5 py-3 backdrop-blur-sm">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => onEntryChange?.(entries[currentIndex - 1])}
              className="min-h-11 justify-self-start rounded-full px-3 text-sm font-bold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
              aria-label="上一张单词卡"
            >
              ← 上一张
            </button>
            <span className="text-xs font-bold tabular-nums text-gray-500" aria-live="polite">
              {currentIndex + 1} / {entries.length}
            </span>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => onEntryChange?.(entries[currentIndex + 1])}
              className="min-h-11 justify-self-end rounded-full px-3 text-sm font-bold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
              aria-label="下一张单词卡"
            >
              下一张 →
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export { wordKey }
