'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { notFound } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import type { ProblemDifficulty } from '@rosie/core'
import { useAuth } from '@rosie/core'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import LessonProblemList from '@rosie/math/components/shared/LessonProblemList'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'
import { useStartPracticeQueue } from '@rosie/math/components/shared/practice-queue/useStartPracticeQueue'
import type { PracticeQueueItem } from '@rosie/math/utils/practice-queue-types'
import { mathWrongStore } from '@rosie/math/hooks/useMathWrong'
import { syncWrongBookFromAttempts } from '@rosie/math/utils/math-scratch-db'
import { lessonDisplayLabelFromRegistry } from '@rosie/math/utils/lesson-registry'
import { useLessonRoute } from './LessonRouteContext'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'
type PracticeFilter = 'all' | 'unpracticed' | 'practiced'

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
  const { solveCount } = module.useLesson()
  const startPractice = useStartPracticeQueue()
  const [showDetail, setShowDetail] = useState(false)
  const [autoExpand, setAutoExpand] = useState(false)
  const list = (module.PROBLEMS[section] ?? []) as typeof module.PROBLEMS.lesson
  const attempted = list.filter((p) => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter((p) => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length
  const label = lessonDisplayLabelFromRegistry(entry.lessonKey, true)
  const sectionPath = `${basePath}/${section}`

  const practicePool = useMemo((): PracticeQueueItem[] => {
    return list.map((problem, idx) => ({
      problem,
      section,
      lessonId: entry.lessonKey,
      detailHref: `${sectionPath}/${idx + 1}`,
    }))
  }, [list, section, entry.lessonKey, sectionPath])

  const beginPractice = useCallback(
    (initialProblemId?: string) => {
      if (practicePool.length === 0) return
      startPractice({
        pool: practicePool,
        title: `${SECTION_LABELS[section]} · ${label}`,
        initialProblemId,
        returnHref: sectionPath,
      })
    },
    [practicePool, startPractice, section, label, sectionPath],
  )

  const btnBase =
    'cursor-pointer rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95'
  const btnOn = 'border-blue-600 bg-blue-600 text-white'
  const btnOff = 'border-slate-200 bg-white text-text-secondary'

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-slate-200 bg-white/80 p-4">
        <div className="mb-1 text-sm font-extrabold text-text-primary">
          {SECTION_LABELS[section]} · {label}
        </div>
        <div className="mb-2 text-xs text-text-secondary">
          {total > 0 ? `共 ${total} 道题` : '本模块暂无题目'}
        </div>
        {total > 0 && (
          <div className="mb-2">
            <div className="mb-1.5 text-[11px] font-bold text-text-secondary">📖 题解显示</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAutoExpand((v) => !v)}
                className={`${btnBase} ${autoExpand ? btnOn : btnOff}`}
              >
                {autoExpand ? '✅ 自动展开题解' : '⭕ 自动展开题解'}
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-slate-300 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }}
            />
          </div>
          <div className="shrink-0 text-xs font-bold text-text-secondary">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
          {total > 0 && (
            <>
              <button
                type="button"
                onClick={() => beginPractice()}
                className={`shrink-0 ${btnBase} ${btnOn}`}
              >
                开始练习
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDetail((v) => !v)
                }}
                className={`shrink-0 ${btnBase} ${showDetail ? btnOn : btnOff}`}
              >
                {showDetail ? '收起 ↑' : '展开 ↓'}
              </button>
            </>
          )}
        </div>
      </div>
      <LessonProblemList
        problems={list}
        solveCount={solveCount}
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
  const { solveCount } = module.useLesson()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState(() => {
    const allTags = new Set<string>()
    for (const list of Object.values(module.PROBLEMS)) {
      for (const p of list ?? []) allTags.add(p.tag)
    }
    return {
      source: new Set(['pretest', 'lesson', 'homework', 'supplement']),
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
      solveCount={solveCount}
      filters={filters}
      onToggleFilter={toggleFilter}
      onSetMastery={(value: MasteryFilter) => setFilters((f) => ({ ...f, mastery: value }))}
      onSetPractice={(value: PracticeFilter) => setFilters((f) => ({ ...f, practice: value }))}
    />
  )
}

export function DynamicLessonHomePage() {
  const { module } = useLessonRoute()
  const { solveCount } = module.useLesson()
  return <module.HomePage problems={module.PROBLEMS} solveCount={solveCount} />
}

export function DynamicLessonMistakesPage() {
  const { user } = useAuth()
  const { module, basePath, entry } = useLessonRoute()
  const { wrongIds, solveCount } = module.useLesson()

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
      solveCount={solveCount}
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
