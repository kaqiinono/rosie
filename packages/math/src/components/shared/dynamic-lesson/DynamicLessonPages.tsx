'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { notFound } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import type { ProblemDifficulty } from '@rosie/core'
import { useAuth } from '@rosie/core'
import LessonProblemRoutePage from '@rosie/math-kit/components/shared/LessonProblemRoutePage'
import LessonProblemList from '@rosie/math-kit/components/shared/LessonProblemList'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'
import LessonNotesPage from '@rosie/math-kit/components/shared/LessonNotesPage'
import LessonDraftsPage from '@rosie/math-kit/components/shared/LessonDraftsPage'
import { useStartPracticeQueue } from '@rosie/math-kit/components/shared/practice-queue/useStartPracticeQueue'
import type { PracticeQueueItem } from '@rosie/math-kit/utils/practice-queue-types'
import { mathWrongStore } from '@rosie/math-kit/hooks/useMathWrong'
import { syncWrongBookFromAttempts } from '@rosie/math-kit/utils/math-scratch-db'
import { lessonDisplayLabelFromRegistry } from '@rosie/math-kit/utils/lesson-registry'
import { findHelpProblems } from '@rosie/math-kit/utils/practice-help-problems'
import { useLessonRoute } from './LessonRouteContext'
import type { MasteryFilter, PracticeFilter } from '@rosie/math-kit/components/shared/FilterPanel'

type SectionKey = 'pretest' | 'lesson' | 'homework' | 'workbook' | 'supplement'

const SECTION_LABELS: Record<SectionKey, string> = {
  pretest: '课前测',
  lesson: '课堂讲解',
  homework: '课后巩固',
  workbook: '练习册',
  supplement: '附加题',
}

function SectionListPage({ section }: { section: SectionKey }) {
  const { module, basePath, entry } = useLessonRoute()
  const problemSet = module.PROBLEMS
  const { practiceCount, correctCount } = module.useLesson()
  const startPractice = useStartPracticeQueue()
  const [showDetail, setShowDetail] = useState(false)
  const [autoExpand, setAutoExpand] = useState(false)
  const list = useMemo(
    () => (problemSet[section] ?? []) as typeof problemSet.lesson,
    [problemSet, section],
  )
  const attempted = list.filter((p) => (practiceCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter((p) => (correctCount[p.id] ?? 0) >= 3).length
  const total = list.length
  const label = lessonDisplayLabelFromRegistry(entry.lessonKey, true)
  const sectionPath = `${basePath}/${section}`

  const practicePool = useMemo((): PracticeQueueItem[] => {
    return list.map((problem, idx) => ({
      problem,
      section,
      lessonId: entry.lessonKey,
      detailHref: `${sectionPath}/${idx + 1}`,
      helpProblems: findHelpProblems(problemSet, problem, practiceCount),
    }))
  }, [list, section, entry.lessonKey, sectionPath, problemSet, practiceCount])

  const beginPractice = useCallback(
    (initialProblemId?: string) => {
      if (practicePool.length === 0) return
      startPractice({
        pool: practicePool,
        source: 'lesson',
        title: `${SECTION_LABELS[section]} · ${label}`,
        initialProblemId,
        returnHref: sectionPath,
      })
    },
    [practicePool, startPractice, section, label, sectionPath],
  )

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-text-primary sm:text-lg">
              {SECTION_LABELS[section]} · {label}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {total > 0 ? `共 ${total} 道题` : '本模块暂无题目'}
            </p>
          </div>
          {total > 0 && (
            <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              🦋 {mastered}/{total}
            </span>
          )}
        </div>

        {total > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-text-secondary">
                <span>学习进度</span>
                <span>练过 {attempted} / {total}</span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-slate-300 transition-[width] duration-400"
                  style={{ width: `${Math.round((attempted / total) * 100)}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-[width] duration-400"
                  style={{ width: `${Math.round((mastered / total) * 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => beginPractice()}
                className="min-h-11 cursor-pointer rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition-all hover:bg-blue-700 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                开始练习
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={autoExpand}
                onClick={() => setAutoExpand((v) => !v)}
                className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-all active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${autoExpand ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-text-secondary hover:bg-slate-50'}`}
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${autoExpand ? 'bg-blue-600' : 'bg-slate-300'}`}
                  aria-hidden="true"
                />
                题解：{autoExpand ? '自动' : '手动'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDetail((v) => !v)
                }}
                aria-expanded={showDetail}
                className={`col-span-2 min-h-11 cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-span-1 ${showDetail ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-text-secondary hover:bg-slate-50'}`}
              >
                {showDetail ? '收起 ↑' : '展开 ↓'}
              </button>
            </div>
          </div>
        )}
      </div>
      <LessonProblemList
        problems={list}
        practiceCount={practiceCount}
        correctCount={correctCount}
        basePath={sectionPath}
        lessonId={entry.lessonKey}
        tagStyles={module.TAG_STYLE}
        lessonBasePath={basePath}
        showExpanded={showDetail}
        ProblemDetail={module.ProblemDetail}
        autoExpandSolution={autoExpand}
      />
    </div>
  )
}

function AlltestContent() {
  const { module } = useLessonRoute()
  const { practiceCount, correctCount } = module.useLesson()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState(() => {
    const allTags = new Set<string>()
    for (const list of Object.values(module.PROBLEMS)) {
      for (const p of list ?? []) allTags.add(p.tag)
    }
    return {
      source: new Set(['pretest', 'lesson', 'homework', 'workbook', 'supplement']),
      type: typeParam ? new Set([typeParam]) : allTags,
      mastery: 'all' as MasteryFilter,
      practice: 'all' as PracticeFilter,
      difficulty: new Set<ProblemDifficulty>([1, 2, 3, 4, 5]),
    }
  })

  const toggleFilter = (axis: 'source' | 'type' | 'difficulty', value: string) => {
    if (axis === 'difficulty') {
      const level = Number(value) as ProblemDifficulty
      setFilters((f) => {
        const next = new Set(f.difficulty)
        if (next.has(level)) next.delete(level)
        else next.add(level)
        return { ...f, difficulty: next }
      })
      return
    }
    setFilters((f) => {
      const next = new Set(f[axis])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...f, [axis]: next }
    })
  }

  return (
    <module.FilterPanel
      problems={module.PROBLEMS}
      practiceCount={practiceCount}
      correctCount={correctCount}
      filters={filters}
      onToggleFilter={toggleFilter}
      onSetMastery={(value: MasteryFilter) => setFilters((f) => ({ ...f, mastery: value }))}
      onSetPractice={(value: PracticeFilter) => setFilters((f) => ({ ...f, practice: value }))}
    />
  )
}

export function DynamicLessonHomePage() {
  const { module } = useLessonRoute()
  const { practiceCount, correctCount } = module.useLesson()
  return (
    <module.HomePage
      problems={module.PROBLEMS}
      practiceCount={practiceCount}
      correctCount={correctCount}
    />
  )
}

export function DynamicLessonMistakesPage() {
  const { user } = useAuth()
  const { module, basePath, entry } = useLessonRoute()
  const { wrongIds, practiceCount, correctCount } = module.useLesson()

  useEffect(() => {
    if (!user) return
    void syncWrongBookFromAttempts(user.id, entry.lessonKey).then((added) => {
      if (added > 0) {
        mathWrongStore.invalidate(user.id)
        mathWrongStore.ensureLoaded(user.id)
      }
    })
  }, [user, entry.lessonKey])

  return (
    <LessonMistakesPage
      basePath={basePath}
      problems={module.PROBLEMS}
      tagStyle={module.TAG_STYLE}
      wrongIds={wrongIds}
      practiceCount={practiceCount}
      correctCount={correctCount}
    />
  )
}

export function DynamicLessonNotesPage() {
  const { module, basePath, entry } = useLessonRoute()
  return (
    <LessonNotesPage basePath={basePath} lessonId={entry.lessonKey} problems={module.PROBLEMS} />
  )
}

export function DynamicLessonDraftsPage() {
  const { module, basePath, entry } = useLessonRoute()
  return (
    <LessonDraftsPage basePath={basePath} lessonId={entry.lessonKey} problems={module.PROBLEMS} />
  )
}

export function DynamicLessonAlltestPage() {
  return (
    <Suspense>
      <AlltestContent />
    </Suspense>
  )
}

export function DynamicLessonPretestPage() {
  return <SectionListPage section="pretest" />
}

export function DynamicLessonLessonPage() {
  return <SectionListPage section="lesson" />
}

export function DynamicLessonHomeworkPage() {
  return <SectionListPage section="homework" />
}

export function DynamicLessonWorkbookPage() {
  return <SectionListPage section="workbook" />
}

export function DynamicLessonSupplementPage() {
  const { module } = useLessonRoute()
  const count = module.PROBLEMS.supplement?.length ?? 0
  if (count === 0) notFound()
  return <SectionListPage section="supplement" />
}

export function DynamicLessonMagicPage() {
  const { module } = useLessonRoute()
  if (!module.MagicPage) notFound()
  const Magic = module.MagicPage
  return <Magic />
}

export function DynamicLessonProblemPage({
  problemId,
  section,
}: {
  problemId: string
  section: SectionKey
}) {
  const { module, basePath } = useLessonRoute()
  const problems = module.PROBLEMS[section] ?? []
  if (problems.length === 0) notFound()

  return (
    <LessonProblemRoutePage
      problemId={problemId}
      basePath={basePath}
      section={section}
      problems={problems}
      Detail={module.ProblemDetail}
    />
  )
}
