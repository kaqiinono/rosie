'use client'

import { useMemo, type CSSProperties, type ReactNode } from 'react'
import CharSpeakButton from './CharSpeakButton'

export interface CharFlashCardData {
  char: string
  pinyin: string
  unit: number
  /** 单元内课序（含语文园地） */
  unitLessonNo?: number | null
  /** 全册正课编号 */
  bookLessonNo?: number | null
  lessonTitle: string
  radical?: string
  radicalName?: string
  structure?: string
  phrases?: string[]
  strokeCount?: number
  isReview?: boolean
}

interface CharFlashCardProps {
  data: CharFlashCardData
  flipped: boolean
  onFlip: () => void
  index?: number
}

const CARD_MIN_H = 200

const FRONT_BG: CSSProperties = { background: 'linear-gradient(160deg, #fff7ed 0%, #ffedd5 100%)' }
const BACK_BG: CSSProperties = { background: 'linear-gradient(160deg, #eef2ff 0%, #e0e7ff 100%)' }

export default function CharFlashCard({
  data,
  flipped,
  onFlip,
  index = 0,
}: CharFlashCardProps) {
  const {
    char,
    pinyin,
    unit,
    unitLessonNo,
    bookLessonNo,
    lessonTitle,
    radical,
    radicalName,
    structure,
    phrases = [],
    strokeCount,
    isReview,
  } = data

  const displayPhrases = useMemo(() => phrases.filter(Boolean).slice(0, 3), [phrases])
  const delay = Math.min(index * 0.03, 0.25)

  const infoLabel = useMemo(() => {
    const parts = [`第${unit}单元`]
    if (unitLessonNo != null && unitLessonNo > 0) parts.push(`课${unitLessonNo}`)
    if (bookLessonNo != null && bookLessonNo > 0) parts.push(`全册${bookLessonNo}`)
    return parts.join(' · ')
  }, [unit, unitLessonNo, bookLessonNo])

  const infoBadges: ReactNode = (
    <>
      <span className="min-w-0 rounded-full border border-amber-300/50 bg-amber-100/80 px-2 py-0.5 text-[9.5px] leading-tight font-extrabold tracking-wide text-amber-800">
        {infoLabel}
      </span>
      {isReview && (
        <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[9.5px] font-bold whitespace-nowrap text-violet-700">
          复习
        </span>
      )}
    </>
  )

  const charGlyph = (speakOnBack = false, large = false) => (
    <div className={`relative flex items-center justify-center ${large ? 'h-full w-full' : ''}`}>
      <span className={large ? 'cn-grid-cell-flash' : 'cn-grid-cell-sm'}>{char}</span>
      <CharSpeakButton
        text={char}
        size="sm"
        className={`${large ? 'absolute right-0 bottom-0' : ''} ${speakOnBack ? 'text-indigo-700' : ''}`}
      />
    </div>
  )

  const charStage = (speakOnBack = false) => (
    <div className="cn-flash-char-stage">
      {charGlyph(speakOnBack, true)}
    </div>
  )

  const hasMeta = Boolean(structure || (strokeCount && strokeCount > 0) || radicalName)
  const metaLine = hasMeta ? (
    <p className="flex flex-wrap items-center justify-center gap-x-1 text-[10.5px] font-bold text-indigo-800/70">
      {structure && <span>{structure}结构</span>}
      {structure && (strokeCount || radicalName) && <span className="text-indigo-300">·</span>}
      {Boolean(strokeCount && strokeCount > 0) && <span>{strokeCount}画</span>}
      {Boolean(strokeCount && strokeCount > 0) && radicalName && (
        <span className="text-indigo-300">·</span>
      )}
      {radicalName && <span>部首{radical ?? radicalName}</span>}
    </p>
  ) : null

  const phraseBlock =
    displayPhrases.length > 0 ? (
      <div className="flex flex-wrap justify-center gap-1">
        {displayPhrases.map((p) => (
          <span
            key={p}
            className="rounded border border-indigo-100 bg-white/60 px-1.5 py-0.5 text-[11px] font-bold text-indigo-900"
          >
            {p}
          </span>
        ))}
      </div>
    ) : null

  const caption = lessonTitle ? (
    <p className="max-w-full truncate text-center text-[10px] font-medium text-amber-900/45">
      {lessonTitle}
    </p>
  ) : null

  const frontFace = (
    <div
      className="cn-flash-face absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-amber-200/70 p-2.5"
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(0deg) translateZ(0.01px)',
        WebkitTransform: 'rotateY(0deg) translateZ(0.01px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 12px rgba(28,25,23,0.06)',
        ...FRONT_BG,
      }}
    >
      <div className="relative z-[1] flex shrink-0 flex-wrap gap-1">{infoBadges}</div>

      {charStage(false)}

      <div className="relative z-[1] shrink-0">{caption}</div>

      <span className="absolute right-2 bottom-1 text-[9px] font-bold text-amber-900/20 select-none">
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
        border: '1px solid rgba(67,56,202,0.12)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 12px rgba(28,25,23,0.06)',
        ...BACK_BG,
      }}
    >
      <div className="flex shrink-0 flex-col items-center gap-0.5 px-1 pt-0.5 text-center">
        <p className="text-base leading-none font-black text-indigo-900">{pinyin}</p>
        {metaLine}
        {phraseBlock}
      </div>

      {charStage(true)}

      <div className="shrink-0">
        {lessonTitle && (
          <p className="max-w-full truncate text-center text-[9px] font-medium text-indigo-900/40">
            {lessonTitle}
          </p>
        )}
      </div>
      <span className="absolute right-2 bottom-1 text-[9px] font-bold text-indigo-900/20 select-none">
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
        aria-label={flipped ? `背面：${char} ${pinyin}` : `生字：${char}`}
      >
        {frontFace}
        {backFace}
      </button>
    </div>
  )
}
