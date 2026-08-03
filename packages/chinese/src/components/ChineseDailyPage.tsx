'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { todayStr, useAuth } from '@rosie/core'
import { useChineseContext } from '../context/ChineseContext'
import CharFlashCard from './chars/CharFlashCard'
import { buildChineseRoadmap } from '../utils/chinese-roadmap'
import { getLessonDisplayInfo } from '../utils/chinese-lesson-display'
import { masteryKey } from '../utils/chinese-helpers'
import { useChineseRoadmapPlan } from '../hooks/useChineseRoadmapPlan'
import { setActiveChineseBook } from '../hooks/useActiveChineseBook'
import {
  buildChinesePlanPracticeHref,
  currentBatchLessonKeys,
  orderedPlanLessonKeys,
} from '../utils/chineseRoadmapPlanLogic'
import { chineseRoute } from '../utils/chinese-routes'
import type { CharTrack } from '../utils/chinese-helpers'
import { formatPlanQuizTypes } from './plans/chinese-roadmap-plan-shared'

interface LessonChar {
  char: string
  pinyin: string
  charKey: string
  track: CharTrack
  done: boolean
}

export default function ChineseDailyPage() {
  const router = useRouter()
  const { user } = useAuth()
  const {
    lessons,
    lessonGroups,
    getCharProfile,
    masteryMap,
    isCharDataReady,
    isCharDataLoading,
    unresolvedWrong,
    bookSlug,
    charKeyForBook,
  } = useChineseContext()
  const { activePlan, completedPlan, isLoading: plansLoading } = useChineseRoadmapPlan(user)
  const planCompleted = !activePlan && !!completedPlan
  const today = todayStr()
  const [flipped, setFlipped] = useState(false)
  const [previewIdx, setPreviewIdx] = useState(0)

  useEffect(() => {
    if (activePlan) setActiveChineseBook(activePlan.bookSlug)
    else if (completedPlan) setActiveChineseBook(completedPlan.bookSlug)
  }, [activePlan, completedPlan])

  const orderedKeys = useMemo(
    () => orderedPlanLessonKeys(lessons, activePlan?.bookSlug ?? bookSlug),
    [lessons, activePlan?.bookSlug, bookSlug],
  )

  const batchKeys = useMemo(() => {
    if (!activePlan) return []
    return currentBatchLessonKeys(
      orderedKeys,
      activePlan.currentLessonKey,
      activePlan.lessonsPerBatch,
      new Set(activePlan.completedLessonKeys),
    )
  }, [activePlan, orderedKeys])

  const planLesson = useMemo(() => {
    if (!activePlan) return null
    return lessons.find((l) => l.lessonKey === activePlan.currentLessonKey) ?? null
  }, [activePlan, lessons])

  const planDisplay = useMemo(() => {
    if (!planLesson) return null
    return getLessonDisplayInfo(
      planLesson,
      lessons.filter((l) => l.unit === planLesson.unit),
    )
  }, [planLesson, lessons])

  const roadmap = useMemo(
    () => (isCharDataReady ? buildChineseRoadmap(lessons, lessonGroups, masteryMap, bookSlug) : null),
    [isCharDataReady, lessons, lessonGroups, masteryMap, bookSlug],
  )
  const currentNode = roadmap?.nodes.find((n) => n.state === 'current') ?? null

  const lessonRow = currentNode
    ? lessons.find((l) => l.lessonKey === currentNode.lessonKey)
    : undefined
  const display = lessonRow
    ? getLessonDisplayInfo(lessonRow, lessons.filter((l) => l.unit === lessonRow.unit))
    : null

  const focusGroup = useMemo(() => {
    if (activePlan) {
      return lessonGroups.find((g) => g.lessonKey === activePlan.currentLessonKey) ?? null
    }
    return currentNode?.group ?? null
  }, [activePlan, lessonGroups, currentNode])

  const lessonChars = useMemo<LessonChar[]>(() => {
    const group = focusGroup
    if (!group) return []
    const out: LessonChar[] = []
    const push = (ch: string, pinyin: string, track: CharTrack) => {
      const key = charKeyForBook(ch)
      out.push({
        char: ch,
        pinyin: pinyin || getCharProfile(key)?.pinyin || '',
        charKey: key,
        track,
        done: (masteryMap[masteryKey(key, track)]?.correct ?? 0) > 0,
      })
    }
    group.recognize.forEach((ch, i) => push(ch, group.recognizePinyin[i] ?? '', 'recognize'))
    group.write.forEach((ch, i) => push(ch, group.writePinyin[i] ?? '', 'write'))
    return out
  }, [focusGroup, getCharProfile, masteryMap, charKeyForBook])

  const preview = lessonChars[previewIdx] ?? lessonChars[0]
  const previewProfile = preview ? getCharProfile(preview.charKey) : undefined

  const headerTitle = activePlan
    ? (planLesson?.lessonTitle ?? activePlan.currentLessonKey)
    : (currentNode?.lessonTitle ?? '')
  const headerMeta = activePlan
    ? planLesson
      ? `第${planLesson.unit}单元 · ${planDisplay?.label ?? planLesson.lessonTitle}`
      : activePlan.title
    : currentNode
      ? `第${currentNode.unit}单元 · ${display?.label ?? currentNode.lessonTitle}`
      : ''

  if (plansLoading || (isCharDataLoading && !isCharDataReady)) {
    return <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
  }

  if (!isCharDataReady) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        字库未就绪。请在 Supabase 执行 chinese-char-entries.sql，再按 docs/sql/chinese-g1b/README.md 灌库。
      </p>
    )
  }

  if (planCompleted) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-3 text-lg font-extrabold text-slate-900">计划已通关！</p>
        <p className="mt-1 text-sm text-slate-500">
          {completedPlan?.title ? `「${completedPlan.title}」` : '本计划'}
          已完成，可以回到路线图复习任意一课。
        </p>
        <Link
          href="/chinese/weekly"
          className="mt-6 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white no-underline hover:bg-emerald-700"
        >
          查看学习路线 →
        </Link>
      </div>
    )
  }

  if (!activePlan && !currentNode) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-3 text-lg font-extrabold text-slate-900">全部课程已通关！</p>
        <p className="mt-1 text-sm text-slate-500">可以回到路线图复习任意一课。</p>
        <Link
          href="/chinese/weekly"
          className="mt-6 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white no-underline hover:bg-emerald-700"
        >
          查看学习路线 →
        </Link>
      </div>
    )
  }

  const startPractice = () => {
    if (activePlan && batchKeys.length > 0) {
      setActiveChineseBook(activePlan.bookSlug)
      router.push(buildChinesePlanPracticeHref(activePlan, batchKeys))
      return
    }
    if (currentNode) {
      setActiveChineseBook(bookSlug)
      router.push(
        `${chineseRoute(bookSlug, 'chars/practice')}?lessons=${encodeURIComponent(currentNode.lessonKey)}`,
      )
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900">今日语文</h1>
        <p className="mt-1 text-sm text-slate-500">{today}</p>
      </header>

      <section className="rounded-2xl border border-amber-200 bg-white/85 p-5 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-amber-700">{headerMeta}</p>
        <h2 className="mt-1 text-lg font-extrabold text-slate-900">{headerTitle}</h2>
        {activePlan && (
          <p className="mt-1 text-xs font-medium text-amber-700/80">
            {formatPlanQuizTypes(activePlan.quizTypes)}
            {batchKeys.length > 1 ? ` · 本批 ${batchKeys.length} 关` : ''}
          </p>
        )}

        {!activePlan && currentNode && (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                style={{
                  width: `${
                    currentNode.status.total > 0
                      ? Math.round((currentNode.status.correct / currentNode.status.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <span className="text-xs font-bold text-slate-500">
              {currentNode.status.correct}/{currentNode.status.total}
            </span>
          </div>
        )}

        {lessonChars.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {lessonChars.map((item) => (
              <li
                key={`${item.charKey}-${item.track}`}
                className={`relative rounded-lg border px-3 py-1.5 text-lg font-bold ${
                  item.done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-white text-slate-800'
                }`}
                title={item.pinyin}
              >
                {item.char}
                {item.track === 'write' && (
                  <span className="ml-1 text-[10px] font-semibold text-rose-500">写</span>
                )}
                {item.done && (
                  <span className="absolute -right-1 -top-1 text-xs text-emerald-500">✓</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={startPractice}
          className="mt-5 block w-full rounded-xl bg-amber-600 py-3 text-center text-sm font-bold text-white transition hover:bg-amber-700"
        >
          {activePlan ? '开始练习本批' : '开始练习本课'}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          {activePlan
            ? '完成本批计划题型后，将自动推进下一关'
            : '本课生字全部答对后，将自动解锁下一课'}
        </p>
      </section>

      {preview && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-500">本课生字预览</h2>
          <CharFlashCard
            data={{
              char: preview.char,
              pinyin: preview.pinyin,
              unit: planLesson?.unit ?? currentNode?.unit ?? 0,
              unitLessonNo: (planDisplay ?? display)?.unitLessonNo ?? undefined,
              bookLessonNo: (planDisplay ?? display)?.bookLessonNo ?? undefined,
              lessonTitle: headerTitle,
              radical: previewProfile?.radical,
              radicalName: previewProfile?.radicalName,
              structure: previewProfile?.structure,
              phrases: previewProfile?.phrases,
              strokeCount: previewProfile?.strokeCount,
            }}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
          />
          {lessonChars.length > 1 && (
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
                {previewIdx + 1} / {lessonChars.length}
              </span>
              <button
                type="button"
                disabled={previewIdx >= lessonChars.length - 1}
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
        href="/chinese/weekly"
        className="text-center text-xs font-semibold text-amber-700 no-underline"
      >
        查看学习路线 →
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
