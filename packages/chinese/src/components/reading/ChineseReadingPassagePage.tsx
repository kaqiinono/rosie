'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { useChineseContext } from '../../context/ChineseContext'
import { findLessonRow, getLessonGroup } from '../../utils/chinese-helpers'
import { getLessonPassage } from '../../utils/chinese-lesson-passage-helpers'
import { chineseRoute } from '../../utils/chinese-routes'
import {
  annotatePassageParagraph,
  type CharMarkKind,
} from '../../utils/chinese-lesson-passage-helpers'
import { getLessonDisplayInfo } from '../../utils/chinese-lesson-display'
import { speakChinese } from '../../utils/speak-chinese'
import CharRecognizeRecall, { type RecognizeRecallChar } from './CharRecognizeRecall'
import CharWriteRecall, { type WriteRecallChar } from './CharWriteRecall'

const MARK_CLASS: Record<CharMarkKind, string> = {
  plain: '',
  recognize: 'cn-char-recognize',
  write: 'cn-char-write',
  both: 'cn-char-both',
}

interface Props {
  lessonKey: string
}

export default function ChineseReadingPassagePage({ lessonKey }: Props) {
  const {
    lessons,
    lessonGroups,
    getCharProfile,
    recordBatch,
    isCharDataLoading,
    isCharDataReady,
    bookSlug,
    charKeyForBook,
  } = useChineseContext()

  const [recallOpen, setRecallOpen] = useState(false)
  const [recognizeAnswers, setRecognizeAnswers] = useState<Record<string, boolean>>({})
  const [writeAnswers, setWriteAnswers] = useState<Record<string, boolean>>({})

  const passage = getLessonPassage(lessonKey, bookSlug)
  const group = useMemo(
    () => getLessonGroup(lessonGroups, lessonKey, bookSlug),
    [lessonGroups, lessonKey, bookSlug],
  )
  const lessonRow = useMemo(
    () => findLessonRow(lessons, lessonKey, bookSlug),
    [lessons, lessonKey, bookSlug],
  )
  const display = useMemo(() => {
    if (!lessonRow) return null
    const unitLessons = lessons.filter((l) => l.unit === lessonRow.unit)
    return getLessonDisplayInfo(lessonRow, unitLessons)
  }, [lessonRow, lessons])

  const recognizeSet = useMemo(() => new Set(group?.recognize ?? []), [group])
  const writeSet = useMemo(() => new Set(group?.write ?? []), [group])

  const recognizeChars: RecognizeRecallChar[] = useMemo(() => {
    if (!group) return []
    return group.recognize.map((ch, i) => ({
      char: ch,
      charKey: charKeyForBook(ch),
      pinyin: group.recognizePinyin[i] || getCharProfile(charKeyForBook(ch))?.pinyin || '',
    }))
  }, [group, getCharProfile, charKeyForBook])

  const writeChars: WriteRecallChar[] = useMemo(() => {
    if (!group) return []
    return group.write.map((ch, i) => {
      const profile = getCharProfile(charKeyForBook(ch))
      return {
        char: ch,
        charKey: charKeyForBook(ch),
        pinyin: group.writePinyin[i] || profile?.pinyin || '',
        strokeOrder: profile?.strokeOrder ?? { strokes: [], medians: [] },
      }
    })
  }, [group, getCharProfile, charKeyForBook])

  const pinyinPool = useMemo(
    () => [...new Set([...(group?.recognizePinyin ?? []), ...(group?.writePinyin ?? [])])].filter(Boolean),
    [group],
  )

  const handleRecognizeAnswer = useCallback(
    (charKeyValue: string, correct: boolean) => {
      setRecognizeAnswers((prev) => ({ ...prev, [charKeyValue]: correct }))
      recordBatch([{ charKey: charKeyValue, track: 'recognize', correct }])
    },
    [recordBatch],
  )

  const handleWriteAnswer = useCallback(
    (charKeyValue: string, correct: boolean) => {
      setWriteAnswers((prev) => ({ ...prev, [charKeyValue]: correct }))
      recordBatch([{ charKey: charKeyValue, track: 'write', correct }])
    },
    [recordBatch],
  )

  const speakAll = useCallback(() => {
    if (!passage) return
    speakChinese(passage.paragraphs.join('，'))
  }, [passage])

  if (isCharDataLoading && !isCharDataReady) {
    return <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
  }

  if (!passage?.paragraphs.length) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="mb-3 text-4xl">📭</div>
        <h2 className="mb-2 text-xl font-extrabold text-slate-900">课文暂未录入</h2>
        <p className="mb-6 text-sm text-slate-500">
          课文 <code>{lessonKey}</code> 的正文还在整理中。
        </p>
        <Link
          href={chineseRoute(bookSlug, 'reading')}
          className="rounded-full bg-amber-500 px-5 py-2 text-sm font-bold text-white no-underline"
        >
          ← 返回阅读列表
        </Link>
      </main>
    )
  }

  const recallCount = recognizeChars.length + writeChars.length

  return (
    <main className="mx-auto max-w-2xl px-4 pt-5 pb-24">
      {/* Header card */}
      <div className="mb-5 rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link
            href={chineseRoute(bookSlug, 'reading')}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-amber-700 no-underline ring-1 ring-amber-200 transition hover:-translate-x-0.5"
          >
            <span className="text-[14px] leading-none">←</span>
            <span>返回</span>
          </Link>
          <button
            type="button"
            onClick={speakAll}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200 transition hover:bg-white"
          >
            🔊 朗读全文
          </button>
        </div>

        {display && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
            📖 第{lessonRow?.unit}单元
            {display.bookLessonNo ? ` · 全册${display.bookLessonNo}` : ''}
          </div>
        )}
        <h1 className="text-2xl font-extrabold text-slate-900">
          {lessonRow?.lessonTitle ?? lessonKey}
        </h1>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-bold text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border border-sky-300 bg-sky-100" />
            会认（{group?.recognize.length ?? 0}）
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border border-rose-400 bg-rose-100" />
            会写（{group?.write.length ?? 0}）
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
          {passage.paragraphs.map((para, i) => {
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

        {lessonRow && lessonRow.recallPhrases.length > 0 && (
          <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-bold text-amber-800">读一读，记一记</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              {lessonRow.recallPhrases.join(' · ')}
            </p>
          </div>
        )}
      </article>

      {/* Recall test — split by track (会认 vs 会写) */}
      {recallCount > 0 && (
        <div className="mt-6">
          {!recallOpen ? (
            <button
              type="button"
              onClick={() => setRecallOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-4 text-white shadow-[0_4px_14px_rgba(16,185,129,.3)] transition hover:-translate-y-0.5"
            >
              <span className="text-[20px]">🧠</span>
              <div className="text-center">
                <div className="text-[15px] leading-tight font-extrabold">开始回想测试</div>
                <div className="mt-0.5 text-[11px] font-medium opacity-90">
                  会认字 {recognizeChars.length} · 会写字 {writeChars.length} · 读完来回想一下
                </div>
              </div>
              <span className="text-[18px] font-extrabold">→</span>
            </button>
          ) : (
            <div className="space-y-6 rounded-2xl border border-emerald-200/70 bg-white/70 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold tracking-wide text-emerald-700 uppercase">
                  🧠 回想测试
                </h2>
                <button
                  type="button"
                  onClick={() => setRecallOpen(false)}
                  className="cursor-pointer text-[11px] font-bold text-slate-400 hover:text-slate-600"
                >
                  收起
                </button>
              </div>
              <CharRecognizeRecall
                chars={recognizeChars}
                pinyinPool={pinyinPool}
                answered={recognizeAnswers}
                onAnswer={handleRecognizeAnswer}
              />
              <CharWriteRecall
                chars={writeChars}
                answered={writeAnswers}
                onAnswer={handleWriteAnswer}
              />
            </div>
          )}
        </div>
      )}
    </main>
  )
}
