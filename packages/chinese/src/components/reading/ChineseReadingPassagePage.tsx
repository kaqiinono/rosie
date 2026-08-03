'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useChineseContext } from '../../context/ChineseContext'
import { findLessonRow, getLessonGroup } from '../../utils/chinese-helpers'
import { getLessonPassage } from '../../utils/chinese-lesson-passage-helpers'
import { chineseRoute } from '../../utils/chinese-routes'
import { getLessonDisplayInfo } from '../../utils/chinese-lesson-display'
import CharRecognizeRecall, { type RecognizeRecallChar } from './CharRecognizeRecall'
import CharWriteRecall, { type WriteRecallChar } from './CharWriteRecall'
import LessonPassageReader from './LessonPassageReader'
import PassageRecorder from './PassageRecorder'

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
      <LessonPassageReader
        lessonKey={lessonKey}
        bookSlug={bookSlug}
        lessonTitle={lessonRow?.lessonTitle ?? lessonKey}
        unit={lessonRow?.unit ?? null}
        bookLessonNo={display?.bookLessonNo ?? null}
        paragraphs={passage.paragraphs}
        recognize={group?.recognize ?? []}
        write={group?.write ?? []}
        recallPhrases={lessonRow?.recallPhrases ?? []}
        headerStart={
          <Link
            href={chineseRoute(bookSlug, 'reading')}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-amber-700 no-underline ring-1 ring-amber-200 transition hover:-translate-x-0.5"
          >
            <span className="text-[14px] leading-none">←</span>
            <span>返回</span>
          </Link>
        }
        footer={
          <div className="mt-6 flex flex-col gap-4">
            <PassageRecorder
              bookSlug={bookSlug}
              lessonKey={lessonKey}
              lessonTitle={lessonRow?.lessonTitle ?? lessonKey}
            />
            {recallCount > 0 ? (
              !recallOpen ? (
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
              )
            ) : null}
          </div>
        }
      />
    </main>
  )
}
