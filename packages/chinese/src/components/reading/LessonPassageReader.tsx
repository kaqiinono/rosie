'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { useChineseContext } from '../../context/ChineseContext'
import type { ChineseBookSlug } from '../../utils/chinese-books'
import {
  annotatePassageParagraph,
  type CharMarkKind,
} from '../../utils/chinese-lesson-passage-helpers'
import { speakChinese } from '../../utils/speak-chinese'
import CharFlashCard from '../chars/CharFlashCard'

const MARK_CLASS: Record<CharMarkKind, string> = {
  plain: '',
  recognize: 'cn-char-recognize',
  write: 'cn-char-write',
  both: 'cn-char-both',
}

export type LessonPassageReaderProps = {
  lessonKey: string
  bookSlug: ChineseBookSlug
  lessonTitle: string
  unit: number | null
  bookLessonNo: number | null
  paragraphs: string[]
  recognize: string[]
  recognizePinyin?: string[]
  write: string[]
  writePinyin?: string[]
  recallPhrases: string[]
  /** Optional left control in header (e.g. back link). If omitted, only speak button shows. */
  headerStart?: ReactNode
  footer?: ReactNode
}

export default function LessonPassageReader({
  lessonKey,
  lessonTitle,
  unit,
  bookLessonNo,
  paragraphs,
  recognize,
  recognizePinyin = [],
  write,
  writePinyin = [],
  recallPhrases,
  headerStart,
  footer,
}: LessonPassageReaderProps) {
  const { getCharProfile, charKeyForBook } = useChineseContext()
  const [selectedChar, setSelectedChar] = useState<string | null>(null)
  const [cardFlipped, setCardFlipped] = useState(true)
  const recognizeSet = useMemo(() => new Set(recognize), [recognize])
  const writeSet = useMemo(() => new Set(write), [write])
  const passageChars = useMemo(() => {
    const seen = new Set<string>()
    return [...paragraphs.join('')].filter((char) => {
      if ((!recognizeSet.has(char) && !writeSet.has(char)) || seen.has(char)) return false
      seen.add(char)
      return true
    })
  }, [paragraphs, recognizeSet, writeSet])
  const selectedCharIndex = selectedChar ? passageChars.indexOf(selectedChar) : -1

  const selectedProfile = selectedChar
    ? getCharProfile(charKeyForBook(selectedChar))
    : undefined
  const selectedPinyin = selectedChar
    ? recognizePinyin[recognize.indexOf(selectedChar)] ||
      writePinyin[write.indexOf(selectedChar)] ||
      selectedProfile?.pinyin ||
      ''
    : ''

  const speakAll = useCallback(() => {
    speakChinese(paragraphs.join('，'))
  }, [paragraphs])

  const selectCardAt = useCallback(
    (index: number) => {
      const char = passageChars[index]
      if (!char) return
      setSelectedChar(char)
      setCardFlipped(true)
      speakChinese(char)
    },
    [passageChars],
  )

  return (
    <>
      {/* Header card */}
      <div className="mb-5 rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">{headerStart}</div>
          <button
            type="button"
            onClick={speakAll}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200 transition hover:bg-white"
          >
            🔊 朗读全文
          </button>
        </div>

        {unit != null && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
            📖 第{unit}单元
            {bookLessonNo ? ` · 全册${bookLessonNo}` : ''}
          </div>
        )}
        <h1 className="text-2xl font-extrabold text-slate-900">{lessonTitle}</h1>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-bold text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border border-sky-300 bg-sky-100" />
            会认（{recognize.length}）
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border border-rose-400 bg-rose-100" />
            会写（{write.length}）
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border border-violet-400 bg-gradient-to-br from-sky-100 to-rose-100" />
            认+写
          </span>
        </div>
      </div>

      {/* Passage body — highlighted chars open their full character card. */}
      <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="space-y-5">
          {paragraphs.map((para, i) => {
            const segments = annotatePassageParagraph(para, recognizeSet, writeSet)
            return (
              <p
                key={`${lessonKey}-p-${i}`}
                className="text-xl leading-[2.15] tracking-wide text-slate-800 sm:text-2xl sm:leading-[2.05]"
              >
                {segments.map((seg, j) =>
                  seg.kind === 'plain' ? (
                    <span key={`${i}-${j}`}>{seg.text}</span>
                  ) : (
                    [...seg.text].map((char, charIndex) => (
                      <button
                        key={`${i}-${j}-${charIndex}`}
                        type="button"
                        onClick={() => {
                          setSelectedChar(char)
                          setCardFlipped(true)
                          speakChinese(char)
                        }}
                        className={clsx(
                          MARK_CLASS[seg.kind],
                          'mx-0.5 inline-flex min-h-[1.65em] min-w-[1.65em] cursor-pointer items-center justify-center rounded-lg px-1 align-middle font-extrabold transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
                        )}
                        title={`查看「${char}」的生字卡片`}
                        aria-label={`查看生字「${char}」详情`}
                      >
                        {char}
                      </button>
                    ))
                  ),
                )}
              </p>
            )
          })}
        </div>

        {recallPhrases.length > 0 && (
          <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-bold text-amber-800">读一读，记一记</p>
            <p className="mt-1 text-lg leading-relaxed font-semibold text-amber-900">
              {recallPhrases.join(' · ')}
            </p>
          </div>
        )}
      </article>

      {footer}

      {selectedChar && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`生字「${selectedChar}」详情`}
          onClick={() => setSelectedChar(null)}
        >
          <div className="w-full max-w-sm" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedChar(null)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white text-xl font-black text-slate-700 shadow-lg"
                aria-label="关闭生字卡片"
              >
                ×
              </button>
            </div>
            <CharFlashCard
              data={{
                char: selectedChar,
                pinyin: selectedPinyin,
                unit: unit ?? 0,
                bookLessonNo,
                lessonTitle,
                radical: selectedProfile?.radical,
                radicalName: selectedProfile?.radicalName,
                structure: selectedProfile?.structure,
                phrases: selectedProfile?.phrases,
                strokeCount: selectedProfile?.strokeCount,
              }}
              flipped={cardFlipped}
              onFlip={() => setCardFlipped((value) => !value)}
            />
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <button
                type="button"
                onClick={() => selectCardAt(selectedCharIndex - 1)}
                disabled={selectedCharIndex <= 0}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-extrabold text-slate-700 shadow-lg transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="上一页生字卡片"
              >
                ← 上一页
              </button>
              <span className="text-sm font-bold text-white" aria-live="polite">
                {selectedCharIndex + 1} / {passageChars.length}
              </span>
              <button
                type="button"
                onClick={() => selectCardAt(selectedCharIndex + 1)}
                disabled={selectedCharIndex < 0 || selectedCharIndex >= passageChars.length - 1}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-extrabold text-slate-700 shadow-lg transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="下一页生字卡片"
              >
                下一页 →
              </button>
            </div>
            <p className="mt-2 text-center text-xs font-bold text-white/85">
              点击卡片可查看正反面
            </p>
          </div>
        </div>
      )}
    </>
  )
}
