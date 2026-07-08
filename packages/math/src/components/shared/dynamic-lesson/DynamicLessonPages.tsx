'use client'

import { Suspense, useState } from 'react'
import { notFound } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import type { ProblemDifficulty } from '@rosie/core'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'
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
  const list = (module.PROBLEMS[section] ?? []) as typeof module.PROBLEMS.lesson
  const attempted = list.filter((p) => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter((p) => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length
  const label = lessonDisplayLabelFromRegistry(entry.lessonKey, true)

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-slate-200 bg-white/80 p-4">
        <div className="mb-1 text-sm font-extrabold text-text-primary">
          {SECTION_LABELS[section]} · {label}
        </div>
        <div className="mb-2 text-xs text-text-secondary">
          {total > 0 ? `共 ${total} 道题` : '本模块暂无题目'}
        </div>
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
        </div>
      </div>
      <module.ProblemList problems={list} solveCount={solveCount} basePath={`${basePath}/${section}`} />
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
  const { module, basePath } = useLessonRoute()
  const { wrongIds, removeWrong, solveCount } = module.useLesson()
  return (
    <LessonMistakesPage
      basePath={basePath}
      problems={module.PROBLEMS}
      tagStyle={module.TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
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
