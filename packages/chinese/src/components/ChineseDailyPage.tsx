'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { todayStr } from '@rosie/core'
import {
  useChineseContext,
  CharFlashCard,
  buildTodayQuizItems,
  buildLessonPhraseItems,
  pickDailyPhraseItems,
  getLessonGroup,
  getLessonDisplayInfo,
} from '@rosie/chinese'

export default function ChineseDailyPage() {
  const {
    weeklyPlan,
    generatePlan,
    isPlanLoading,
    lessonGroups,
    charByKey,
    lessons,
    getCharProfile,
    masteryMap,
    isCharDataReady,
    isCharDataLoading,
    unresolvedWrong,
  } = useChineseContext()
  const today = todayStr()
  const [flipped, setFlipped] = useState(false)
  const [previewIdx, setPreviewIdx] = useState(0)

  const todayPlan = useMemo(
    () => weeklyPlan?.days.find((d) => d.date === today),
    [weeklyPlan, today],
  )

  const quizItems = useMemo(
    () =>
      todayPlan && isCharDataReady
        ? buildTodayQuizItems(lessonGroups, charByKey, masteryMap, todayPlan, today)
        : [],
    [todayPlan, lessonGroups, charByKey, masteryMap, isCharDataReady, today],
  )

  const newItems = useMemo(() => quizItems.filter((i) => !i.isReview), [quizItems])
  const reviewItems = useMemo(() => quizItems.filter((i) => i.isReview), [quizItems])
  const writeItems = useMemo(() => quizItems.filter((i) => i.track === 'write'), [quizItems])

  const phraseItemCount = useMemo(() => {
    if (!todayPlan || !isCharDataReady) return 0
    const group = getLessonGroup(lessonGroups, todayPlan.lessonKey)
    const lesson = lessons.find((l) => l.lessonKey === todayPlan.lessonKey)
    if (!group || !lesson) return 0
    return pickDailyPhraseItems(buildLessonPhraseItems(lesson, group, charByKey), 6).length
  }, [todayPlan, lessonGroups, lessons, charByKey, isCharDataReady])
  const preview = quizItems[previewIdx] ?? quizItems[0]
  const previewProfile = preview ? getCharProfile(preview.charKey) : undefined
  const previewGroup = todayPlan ? getLessonGroup(lessonGroups, todayPlan.lessonKey) : undefined
  const previewLessonRow = todayPlan
    ? lessons.find((l) => l.lessonKey === todayPlan.lessonKey)
    : undefined
  const previewUnitLessons = previewLessonRow
    ? lessons.filter((l) => l.unit === previewLessonRow.unit)
    : []
  const previewDisplay = previewLessonRow
    ? getLessonDisplayInfo(previewLessonRow, previewUnitLessons)
    : null

  if (isPlanLoading || (isCharDataLoading && !isCharDataReady)) {
    return <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
  }

  if (!isCharDataReady) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        字库未就绪。请在 Supabase 执行 chinese-char-entries.sql，再按 docs/sql/chinese-g1-down/README.md 灌库。
      </p>
    )
  }

  if (!weeklyPlan) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-slate-600">本周还没有学习计划</p>
        <button
          type="button"
          onClick={() => void generatePlan()}
          className="mt-4 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700"
        >
          生成本周计划
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900">今日语文</h1>
        <p className="mt-1 text-sm text-slate-500">{today}</p>
        {preview && <p className="mt-1 text-xs text-amber-700">{preview.lessonTitle}</p>}
      </header>

      {!todayPlan || quizItems.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          今天没有安排新字，可以去复习已学内容。
        </p>
      ) : (
        <>
          {newItems.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-slate-500">今日新字</h2>
              <ul className="mb-4 flex flex-wrap gap-2">
                {newItems.map((item) => (
                  <li
                    key={`${item.charKey}-${item.track}`}
                    className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-lg font-bold text-slate-800"
                    title={item.pinyin}
                  >
                    {item.char}
                    {item.track === 'write' && (
                      <span className="ml-1 text-[10px] font-semibold text-rose-500">写</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {reviewItems.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-violet-600">到期复习</h2>
              <ul className="mb-4 flex flex-wrap gap-2">
                {reviewItems.map((item) => (
                  <li
                    key={`rev-${item.charKey}-${item.track}`}
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-lg font-bold text-violet-900"
                    title={item.pinyin}
                  >
                    {item.char}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {preview && (
            <section>
              <CharFlashCard
                data={{
                  char: preview.char,
                  pinyin: preview.pinyin,
                  unit: previewGroup?.unit ?? 0,
                  unitLessonNo: previewDisplay?.unitLessonNo,
                  bookLessonNo: previewDisplay?.bookLessonNo,
                  lessonTitle: preview.lessonTitle,
                  radical: previewProfile?.radical,
                  radicalName: previewProfile?.radicalName,
                  structure: previewProfile?.structure,
                  phrases: previewProfile?.phrases,
                  strokeCount: previewProfile?.strokeCount,
                  isReview: preview.isReview,
                }}
                flipped={flipped}
                onFlip={() => setFlipped((f) => !f)}
              />
              {quizItems.length > 1 && (
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    type="button"
                    disabled={previewIdx === 0}
                    onClick={() => {
                      setPreviewIdx((i) => i - 1)
                      setFlipped(false)
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                  >
                    上一字
                  </button>
                  <span className="self-center text-xs text-slate-400">
                    {previewIdx + 1} / {quizItems.length}
                  </span>
                  <button
                    type="button"
                    disabled={previewIdx >= quizItems.length - 1}
                    onClick={() => {
                      setPreviewIdx((i) => i + 1)
                      setFlipped(false)
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                  >
                    下一字
                  </button>
                </div>
              )}
            </section>
          )}

          <Link
            href="/chinese/chars/quiz"
            className="block rounded-xl bg-emerald-600 py-3 text-center text-sm font-bold text-white no-underline hover:bg-emerald-700"
          >
            开始拼音测验（{quizItems.length} 字）
          </Link>

          {writeItems.length > 0 && (
            <Link
              href="/chinese/chars/writing"
              className="block rounded-xl border-2 border-rose-300 bg-rose-50 py-3 text-center text-sm font-bold text-rose-800 no-underline"
            >
              笔顺书写（{writeItems.length} 会写字）
            </Link>
          )}

          {phraseItemCount > 0 && (
            <Link
              href="/chinese/phrases"
              className="block rounded-xl border-2 border-violet-300 bg-violet-50 py-3 text-center text-sm font-bold text-violet-800 no-underline"
            >
              词语测验（{phraseItemCount} 题）
            </Link>
          )}
        </>
      )}

      <Link
        href="/chinese/weekly"
        className="text-center text-xs font-semibold text-amber-700 no-underline"
      >
        周计划设置 →
      </Link>

      {unresolvedWrong.length > 0 && (
        <Link
          href="/chinese/wrong"
          className="text-center text-xs font-semibold text-rose-600 no-underline"
        >
          错题本（{unresolvedWrong.length}）→
        </Link>
      )}
    </div>
  )
}
