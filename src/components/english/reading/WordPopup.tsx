'use client'

import { useEffect } from 'react'
import type { WordEntry, WordMasteryInfo } from '@/utils/type'
import type { ReadingPassage } from '@/utils/reading-data'
import { findSentenceForWord } from '@/utils/reading-data'
import { wordKey } from '@/utils/english-helpers'
import {
  getWordMasteryLevel,
  GRADUATED_STAGE_HARD,
  GRADUATED_STAGE_NORMAL,
  MASTERY_ICON,
  type MasteryLevel,
} from '@/utils/masteryUtils'
import SpeakButton from '@/components/english/words/SpeakButton'

interface WordPopupProps {
  entry: WordEntry | null
  passage: ReadingPassage
  mastery: WordMasteryInfo | undefined
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

function highlightSentence(sentence: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b(${escaped})s?\\b`, 'i')
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

export default function WordPopup({ entry, passage, mastery, onClose }: WordPopupProps) {
  useEffect(() => {
    if (!entry) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [entry, onClose])

  if (!entry) return null

  const level = getWordMasteryLevel(mastery?.correct ?? 0)
  const stage = mastery?.stage ?? 0
  const isHard = mastery?.isHard ?? false
  const maxStage = isHard ? GRADUATED_STAGE_HARD : GRADUATED_STAGE_NORMAL
  const stagePercent = Math.min(100, Math.round((stage / maxStage) * 100))

  const found = findSentenceForWord(passage, entry.word)

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="font-nunito relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-[slide-up_.2s_cubic-bezier(.4,0,.2,1)] sm:rounded-2xl"
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
        </div>

        <div className="space-y-3 px-5 pb-5">
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
                {highlightSentence(found.sentence, entry.word)}
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
