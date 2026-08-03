'use client'

import { useCallback, useMemo, type ReactNode } from 'react'
import clsx from 'clsx'
import type { ChineseBookSlug } from '../../utils/chinese-books'
import {
  annotatePassageParagraph,
  type CharMarkKind,
} from '../../utils/chinese-lesson-passage-helpers'
import { speakChinese } from '../../utils/speak-chinese'

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
  write: string[]
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
  write,
  recallPhrases,
  headerStart,
  footer,
}: LessonPassageReaderProps) {
  const recognizeSet = useMemo(() => new Set(recognize), [recognize])
  const writeSet = useMemo(() => new Set(write), [write])

  const speakAll = useCallback(() => {
    speakChinese(paragraphs.join('，'))
  }, [paragraphs])

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

      {/* Passage body — tap a highlighted char run to hear it */}
      <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="space-y-3.5">
          {paragraphs.map((para, i) => {
            const segments = annotatePassageParagraph(para, recognizeSet, writeSet)
            return (
              <p
                key={`${lessonKey}-p-${i}`}
                className="text-lg leading-loose tracking-wide text-slate-800"
              >
                {segments.map((seg, j) =>
                  seg.kind === 'plain' ? (
                    <span key={`${i}-${j}`}>{seg.text}</span>
                  ) : (
                    <button
                      key={`${i}-${j}`}
                      type="button"
                      onClick={() => speakChinese(seg.text)}
                      className={clsx(
                        MARK_CLASS[seg.kind],
                        'cursor-pointer rounded px-0.5 transition hover:brightness-95',
                      )}
                      title={`朗读「${seg.text}」`}
                    >
                      {seg.text}
                    </button>
                  ),
                )}
              </p>
            )
          })}
        </div>

        {recallPhrases.length > 0 && (
          <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-bold text-amber-800">读一读，记一记</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              {recallPhrases.join(' · ')}
            </p>
          </div>
        )}
      </article>

      {footer}
    </>
  )
}
