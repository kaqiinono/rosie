'use client'

import { useMemo, type CSSProperties } from 'react'
import CharSpeakButton from './CharSpeakButton'
import type { WordCardItem } from '../../utils/chinese-pinyin-write-helpers'

interface WordFlashCardProps {
  data: WordCardItem
  flipped: boolean
  onFlip: () => void
  index?: number
}

const CARD_MIN_H = 200

const FRONT_BG: CSSProperties = { background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 100%)' }
const BACK_BG: CSSProperties = { background: 'linear-gradient(160deg, #fdf4ff 0%, #fae8ff 100%)' }

export default function WordFlashCard({
  data,
  flipped,
  onFlip,
  index = 0,
}: WordFlashCardProps) {
  const { word, pinyin, unit, unitLessonNo, bookLessonNo, lessonTitle } = data
  const delay = Math.min(index * 0.03, 0.25)

  const infoLabel = useMemo(() => {
    const parts = [`第${unit}单元`]
    if (unitLessonNo != null && unitLessonNo > 0) parts.push(`课${unitLessonNo}`)
    if (bookLessonNo != null && bookLessonNo > 0) parts.push(`全册${bookLessonNo}`)
    return parts.join(' · ')
  }, [unit, unitLessonNo, bookLessonNo])

  const wordSize =
    word.length >= 4 ? 'text-2xl' : word.length === 3 ? 'text-3xl' : 'text-4xl'

  const frontFace = (
    <div
      className="cn-flash-face absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-emerald-200/70 p-2.5"
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(0deg) translateZ(0.01px)',
        WebkitTransform: 'rotateY(0deg) translateZ(0.01px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 12px rgba(28,25,23,0.06)',
        ...FRONT_BG,
      }}
    >
      <div className="flex shrink-0 flex-wrap gap-1">
        <span className="min-w-0 rounded-full border border-emerald-300/50 bg-emerald-100/80 px-2 py-0.5 text-[9.5px] leading-tight font-extrabold tracking-wide text-emerald-800">
          {infoLabel}
        </span>
        <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[9.5px] font-bold whitespace-nowrap text-teal-700">
          词语
        </span>
      </div>

      <div className="cn-flash-char-stage relative flex items-center justify-center">
        <span className={`${wordSize} font-black tracking-widest text-emerald-900`}>{word}</span>
        <CharSpeakButton text={word} size="sm" className="absolute right-0 bottom-0" />
      </div>

      {lessonTitle && (
        <p className="shrink-0 truncate text-center text-[10px] font-medium text-emerald-900/45">
          {lessonTitle}
        </p>
      )}

      <span className="absolute right-2 bottom-1 text-[9px] font-bold text-emerald-900/20 select-none">
        翻转
      </span>
    </div>
  )

  const backFace = (
    <div
      className="cn-flash-face absolute inset-0 flex flex-col overflow-hidden rounded-xl p-2.5"
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg) translateZ(0.01px)',
        WebkitTransform: 'rotateY(180deg) translateZ(0.01px)',
        border: '1px solid rgba(192,38,211,0.12)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 12px rgba(28,25,23,0.06)',
        ...BACK_BG,
      }}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-1 text-center">
        <p className="text-lg leading-relaxed font-black text-fuchsia-900">{pinyin}</p>
        <p className="text-[10px] font-semibold text-fuchsia-800/60">看拼音写词语</p>
      </div>

      {lessonTitle && (
        <p className="shrink-0 truncate text-center text-[9px] font-medium text-fuchsia-900/40">
          {lessonTitle}
        </p>
      )}
      <span className="absolute right-2 bottom-1 text-[9px] font-bold text-fuchsia-900/20 select-none">
        ↩
      </span>
    </div>
  )

  return (
    <div
      className="rounded-xl"
      style={{
        minHeight: CARD_MIN_H,
        perspective: '1000px',
        animation: `cn-card-rise 0.35s ease ${delay}s backwards`,
      }}
    >
      <button
        type="button"
        onClick={onFlip}
        className="relative w-full cursor-pointer border-0 bg-transparent p-0 transition-transform duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
        style={{
          minHeight: CARD_MIN_H,
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          WebkitTransform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
        aria-label={flipped ? `背面：${word} ${pinyin}` : `词语：${word}`}
      >
        {frontFace}
        {backFace}
      </button>
    </div>
  )
}
