'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { OrbBackground } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useMathWrong } from '@rosie/math/hooks/useMathWrong'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@rosie/core'
import type { Problem } from '@rosie/core'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
import { GRADE_LABEL, gradeOf, gradesInOrder } from '@rosie/math/utils/lesson-grade'
import { compareLessonIds } from '@rosie/math/utils/lesson-registry'
import { SEA_LESSONS, SEA_LESSON_MAP, SEA_POOL } from '@rosie/math/utils/sea-data'
import { lookupMathProblem } from '@rosie/math/utils/math-problem-lookup'
import { fetchWrongDraftProblemIds } from '@rosie/math/utils/math-scratch-db'
import { MistakeDraftButton } from '@rosie/math/components/shared/ScratchPad/ScratchPadTrigger'
import { useStartPracticeQueue } from '@rosie/math/components/shared/practice-queue/useStartPracticeQueue'
import type { PracticeQueueItem } from '@rosie/math/utils/practice-queue-types'
import { SOURCE_LABELS } from '@rosie/core'

type SectionKey = 'pretest' | 'lesson' | 'homework' | 'workbook' | 'supplement'

type MistakeStatusFilter = 'unresolved' | 'resolved' | 'all'

type WrongEntry = ProblemEntry & {
  id: string
  resolved: boolean
  resolvedAt: string | null
  addedAt: string
}

const STATUS_TABS: { key: MistakeStatusFilter; label: string }[] = [
  { key: 'unresolved', label: '未订正' },
  { key: 'resolved', label: '已订正' },
  { key: 'all', label: '全部' },
]

type ProblemEntry = {
  problem: Problem
  lessonId: string
  section: SectionKey
  href: string
}

const ALL_LESSON_IDS = SEA_LESSONS.map((l) => l.id)

const PROBLEM_MAP = (() => {
  const map = new Map<string, ProblemEntry>()
  for (const { problem, lessonId, section, href } of SEA_POOL) {
    map.set(problem.id, {
      problem,
      lessonId,
      section: section as SectionKey,
      href,
    })
  }
  return map
})()

function getLessonTagStyle(lessonId: string) {
  return SEA_LESSON_MAP[lessonId]?.tagStyle ?? {}
}

function resolveEntry(problemId: string): ProblemEntry | null {
  const fromPool = PROBLEM_MAP.get(problemId)
  if (fromPool) return fromPool

  const lookup = lookupMathProblem(problemId)
  if (!lookup) return null

  return PROBLEM_MAP.get(lookup.problemId) ?? null
}

function lessonsForGrade(grade: number) {
  return SEA_LESSONS.filter((l) => gradeOf(l.id) === grade).sort((a, b) =>
    compareLessonIds(a.id, b.id),
  )
}

function MistakeFilterPanel({
  expanded,
  onToggleExpanded,
  statusFilter,
  unresolvedCount,
  resolvedCount,
  onStatusChange,
  selectedLessons,
  wrongCountByLesson,
  onChange,
}: {
  expanded: boolean
  onToggleExpanded: () => void
  statusFilter: MistakeStatusFilter
  unresolvedCount: number
  resolvedCount: number
  onStatusChange: (next: MistakeStatusFilter) => void
  selectedLessons: Set<string>
  wrongCountByLesson: Map<string, number>
  onChange: (next: Set<string>) => void
}) {
  const lessonsByGrade = useMemo(
    () =>
      gradesInOrder()
        .map((grade) => ({
          grade,
          label: GRADE_LABEL[grade] ?? `${grade} 年级`,
          lessons: lessonsForGrade(grade),
        }))
        .filter((grp) => grp.lessons.length > 0),
    [],
  )

  const toggleLesson = useCallback(
    (lessonId: string) => {
      const next = new Set(selectedLessons)
      if (next.has(lessonId)) next.delete(lessonId)
      else next.add(lessonId)
      onChange(next)
    },
    [onChange, selectedLessons],
  )

  const toggleGrade = useCallback(
    (lessonIds: string[], on: boolean) => {
      const next = new Set(selectedLessons)
      for (const id of lessonIds) {
        if (on) next.add(id)
        else next.delete(id)
      }
      onChange(next)
    },
    [onChange, selectedLessons],
  )

  const selectedCount = selectedLessons.size
  const totalCount = ALL_LESSON_IDS.length
  const allSelected = selectedCount === totalCount
  const totalWrong = [...wrongCountByLesson.values()].reduce((a, b) => a + b, 0)
  const statusCounts: Record<MistakeStatusFilter, number> = {
    unresolved: unresolvedCount,
    resolved: resolvedCount,
    all: unresolvedCount + resolvedCount,
  }
  const activeStatusLabel = STATUS_TABS.find((t) => t.key === statusFilter)?.label ?? '未订正'

  const chipBase =
    'relative cursor-pointer rounded-full border-[1.5px] px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95 sm:px-3 sm:py-1.5 sm:text-xs'
  const chipOn = 'border-rose-400 bg-rose-500 text-white shadow-[0_1px_4px_rgba(244,63,94,0.25)]'
  const chipOff = 'border-slate-200 bg-slate-50 text-slate-600 hover:border-rose-200 hover:bg-rose-50'

  return (
    <div className="mb-2.5 w-full overflow-hidden rounded-2xl border border-rose-200/80 bg-white/95 shadow-[0_2px_14px_rgba(190,18,60,0.06)] backdrop-blur-sm">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-rose-50/40 sm:px-4 sm:py-3"
        aria-expanded={expanded}
      >
        <span className="text-[11px] font-extrabold tracking-wide text-rose-900 sm:text-xs">筛选</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              statusFilter === 'unresolved'
                ? 'bg-rose-100 text-rose-800'
                : statusFilter === 'resolved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-700'
            }`}
          >
            {activeStatusLabel}
            {statusCounts[statusFilter] > 0 && (
              <span className="ml-0.5 opacity-80">{statusCounts[statusFilter]}</span>
            )}
          </span>
          <span className="rounded-full border border-rose-100 bg-rose-50/80 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
            {allSelected ? '全部讲次' : `${selectedCount}/${totalCount} 讲`}
          </span>
          {totalWrong > 0 && (
            <span className="rounded-full border border-rose-200/80 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              {totalWrong} 题
            </span>
          )}
        </div>
        <span
          className="shrink-0 text-[11px] text-rose-400 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-rose-100/80 px-3 pb-3.5 pt-3 sm:px-4 sm:pb-4">
          <div>
            <div className="mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              订正状态
            </div>
            <div
              className="grid grid-cols-3 gap-1 rounded-xl bg-rose-50/70 p-1"
              role="tablist"
              aria-label="订正状态"
            >
              {STATUS_TABS.map((tab) => {
                const active = statusFilter === tab.key
                const count = statusCounts[tab.key]
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onStatusChange(tab.key)}
                    className={`rounded-lg px-2 py-2 text-[11px] font-bold transition-all active:scale-[0.98] sm:text-[12px] ${
                      active
                        ? tab.key === 'resolved'
                          ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200/80'
                          : 'bg-white text-rose-700 shadow-sm ring-1 ring-rose-200/80'
                        : 'text-rose-600/70 hover:bg-white/60 hover:text-rose-800'
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span
                        className={`ml-1 text-[10px] ${active ? 'opacity-70' : 'text-rose-400'}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t border-rose-50 pt-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                讲次
              </span>
              <button
                type="button"
                onClick={() => onChange(allSelected ? new Set() : new Set(ALL_LESSON_IDS))}
                className="text-[11px] font-semibold text-rose-500 hover:text-rose-700"
              >
                {allSelected ? '全不选' : '全选'}
              </button>
            </div>

            <div className="space-y-3">
              {lessonsByGrade.map((grp) => {
                const gradeIds = grp.lessons.map((l) => l.id)
                const allOn = gradeIds.every((id) => selectedLessons.has(id))
                const wrongInGrade = gradeIds.reduce(
                  (n, id) => n + (wrongCountByLesson.get(id) ?? 0),
                  0,
                )

                return (
                  <div key={grp.grade}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-600">{grp.label}</span>
                        {wrongInGrade > 0 && (
                          <span className="rounded-full bg-rose-100 px-1.5 py-px text-[10px] font-bold text-rose-600">
                            {wrongInGrade}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGrade(gradeIds, !allOn)}
                        className="text-[11px] font-semibold text-rose-500 hover:text-rose-700"
                      >
                        {allOn ? '全不选' : '全选'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {grp.lessons.map((lesson) => {
                        const isSelected = selectedLessons.has(lesson.id)
                        const wrongN = wrongCountByLesson.get(lesson.id) ?? 0
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => toggleLesson(lesson.id)}
                            className={`${chipBase} ${isSelected ? chipOn : chipOff}`}
                            title={lesson.title}
                          >
                            <span className="inline-flex items-center gap-1">
                              <span>{lesson.icon}</span>
                              <span>{lesson.shortTitle}</span>
                            </span>
                            {wrongN > 0 && (
                              <span
                                className={`absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold ${
                                  isSelected ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
                                }`}
                              >
                                {wrongN}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MistakeCard({
  storedId,
  problem,
  lessonId,
  section,
  count,
  resolved,
  hasDraft,
  draftLookupIds,
  wrongProblems,
  problemIndex,
  onPractice,
  onSolve,
  onDraftResolved,
}: {
  storedId: string
  problem: Problem
  lessonId: string
  section: SectionKey
  count: number
  resolved: boolean
  hasDraft: boolean
  draftLookupIds: string[]
  wrongProblems: Problem[]
  problemIndex: number
  onPractice: () => void
  onSolve: (problemId: string) => void | Promise<void>
  onDraftResolved: (problemId: string) => void
}) {
  const level = getMasteryLevel(count)
  const isMastered = count >= 3
  const srcLabel = SOURCE_LABELS[section] || section
  const tagStyle = getLessonTagStyle(lessonId)
  const lessonMeta = SEA_LESSON_MAP[lessonId]

  const cardAccent = resolved
    ? 'border-l-[3px] border-l-emerald-400 border-app-green/50'
    : 'border-l-[3px] border-l-rose-400'

  const cardBorder = resolved
    ? 'border-app-green/50 opacity-90'
    : isMastered
      ? 'border-app-green/60 opacity-75'
      : `border-[#fca5a5]/70 ${MASTERY_BORDER[level]}`

  return (
    <button
      type="button"
      onClick={onPractice}
      className={`flex h-full w-full cursor-pointer flex-col rounded-xl border bg-white p-2 text-left shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(190,18,60,0.08)] active:scale-[0.99] ${cardAccent} ${cardBorder}`}
    >
      <div className="mb-1.5 flex items-start gap-1.5">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${MASTERY_BADGE_BG[level]}`}
        >
          {MASTERY_ICON[level]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-text-primary line-clamp-2 text-[11px] leading-snug font-semibold sm:text-[12px]">
            {problem.title}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <FavoriteHeart problemId={storedId} size="sm" />
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-0.5">
        <span className="rounded-full bg-indigo-50 px-1.5 py-px text-[8px] font-semibold text-indigo-600 sm:text-[9px]">
          {lessonMeta?.shortTitle ?? lessonId}
        </span>
        <span
          className={`rounded-full px-1.5 py-px text-[8px] font-semibold sm:text-[9px] ${tagStyle[problem.tag] || 'bg-gray-100 text-gray-600'}`}
        >
          {problem.tagLabel}
        </span>
        <span className="rounded-full bg-[#f3e8ff] px-1.5 py-px text-[8px] font-semibold text-[#7e22ce] sm:text-[9px]">
          {srcLabel}
        </span>
        {resolved && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[8px] font-bold text-emerald-700 sm:text-[9px]">
            已订正
          </span>
        )}
        {hasDraft && (
          <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[8px] font-bold text-indigo-700 sm:text-[9px]">
            有草稿
          </span>
        )}
        <PracticeCountBadge count={count} compact />
      </div>

      <div
        className="mt-auto flex items-center justify-end gap-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <MistakeDraftButton
          problem={problem}
          draftLookupIds={draftLookupIds}
          problems={wrongProblems}
          problemIndex={problemIndex}
          onSolve={onSolve}
          onResolved={onDraftResolved}
        />
      </div>
    </button>
  )
}

export default function GlobalMistakesPage() {
  const { user } = useAuth()
  const { solveCount, handleSolve } = useMathSolved(user)
  const { rows, markResolved } = useMathWrong(user)
  const startPractice = useStartPracticeQueue()

  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(
    () => new Set(ALL_LESSON_IDS),
  )
  const [filterExpanded, setFilterExpanded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<MistakeStatusFilter>('unresolved')
  const [draftProblemIds, setDraftProblemIds] = useState<Set<string>>(() => new Set())

  const allWrongEntries = useMemo((): WrongEntry[] => {
    const seen = new Set<string>()
    const entries: WrongEntry[] = []
    for (const row of rows) {
      const entry = resolveEntry(row.problemId)
      if (!entry) continue
      const key = row.problemId
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({
        id: row.problemId,
        resolved: row.resolved,
        resolvedAt: row.resolvedAt,
        addedAt: row.addedAt,
        ...entry,
      })
    }
    return entries
  }, [rows])

  const unresolvedCount = useMemo(
    () => allWrongEntries.filter((e) => !e.resolved).length,
    [allWrongEntries],
  )
  const resolvedCount = useMemo(
    () => allWrongEntries.filter((e) => e.resolved).length,
    [allWrongEntries],
  )

  const wrongCountByLesson = useMemo(() => {
    const pool =
      statusFilter === 'unresolved'
        ? allWrongEntries.filter((e) => !e.resolved)
        : statusFilter === 'resolved'
          ? allWrongEntries.filter((e) => e.resolved)
          : allWrongEntries
    const counts = new Map<string, number>()
    for (const { lessonId } of pool) {
      counts.set(lessonId, (counts.get(lessonId) ?? 0) + 1)
    }
    return counts
  }, [allWrongEntries, statusFilter])

  const statusFilteredEntries = useMemo(() => {
    if (statusFilter === 'unresolved') return allWrongEntries.filter((e) => !e.resolved)
    if (statusFilter === 'resolved') return allWrongEntries.filter((e) => e.resolved)
    return allWrongEntries
  }, [allWrongEntries, statusFilter])

  const wrongList = useMemo(
    () => statusFilteredEntries.filter((e) => selectedLessons.has(e.lessonId)),
    [statusFilteredEntries, selectedLessons],
  )

  const unresolvedPracticeList = useMemo(
    () => allWrongEntries.filter((e) => !e.resolved && selectedLessons.has(e.lessonId)),
    [allWrongEntries, selectedLessons],
  )

  const wrongProblemIdsKey = useMemo(
    () => allWrongEntries.map((e) => e.id).sort().join('\0'),
    [allWrongEntries],
  )

  useEffect(() => {
    if (!user || allWrongEntries.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset draft ids when pool empty
      setDraftProblemIds(new Set())
      return
    }
    const lookupIds = [
      ...new Set(allWrongEntries.flatMap((e) => [e.id, e.problem.id])),
    ]
    let cancelled = false
    void fetchWrongDraftProblemIds(user.id, lookupIds).then((ids) => {
      if (!cancelled) setDraftProblemIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [user, wrongProblemIdsKey, allWrongEntries])

  const hasDraftForEntry = useCallback(
    (storedId: string, problemId: string) =>
      draftProblemIds.has(storedId) || draftProblemIds.has(problemId),
    [draftProblemIds],
  )

  const wrongProblems = useMemo(() => wrongList.map((e) => e.problem), [wrongList])

  const mistakeQueuePool = useMemo(
    (): PracticeQueueItem[] =>
      unresolvedPracticeList.map((e) => ({
        problem: e.problem,
        section: e.section,
        lessonId: e.lessonId,
        detailHref: e.href,
      })),
    [unresolvedPracticeList],
  )

  const beginPractice = useCallback(
    (initialProblemId?: string, poolOverride?: PracticeQueueItem[]) => {
      const pool = poolOverride ?? mistakeQueuePool
      if (pool.length === 0) return
      startPractice({
        pool,
        title: '错题练习',
        initialProblemId,
        returnHref: '/math/mistakes',
      })
    },
    [mistakeQueuePool, startPractice],
  )

  const handleDraftResolved = useCallback(
    (problemId: string) => {
      const entry = allWrongEntries.find(
        ({ id, problem }) => id === problemId || problem.id === problemId,
      )
      if (entry && !entry.resolved) void markResolved(entry.id)
    },
    [allWrongEntries, markResolved],
  )

  const totalCount = allWrongEntries.length
  const progressPct = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0
  const allLessonsSelected = selectedLessons.size === ALL_LESSON_IDS.length
  const filterActive = !allLessonsSelected

  return (
    <>
      <OrbBackground variant="math" />

      <header className="fixed top-0 right-0 left-0 z-20 border-b border-rose-200/60 bg-[#fff8f8]/92 shadow-[0_4px_20px_rgba(190,18,60,0.05)] backdrop-blur-lg">
        <div className="flex items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
          <Link
            href="/math"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-rose-100 bg-white px-3 text-[12px] font-bold text-rose-900/55 no-underline shadow-sm transition-all hover:border-rose-200 hover:text-rose-900 active:scale-95 sm:text-[13px]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="hidden sm:inline">返回数学</span>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[14px] font-extrabold tracking-tight text-rose-950 sm:text-[15px]">
                错题本
              </span>
              {unresolvedCount > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-bold text-white">
                  {unresolvedCount} 待订正
                </span>
              )}
            </div>
          </div>

          {unresolvedPracticeList.length > 0 && (
            <button
              type="button"
              onClick={() => beginPractice()}
              className="shrink-0 cursor-pointer rounded-full bg-gradient-to-r from-rose-600 to-rose-500 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-[0_2px_10px_rgba(225,29,72,0.28)] active:scale-95 sm:px-4 sm:text-[12px]"
            >
              一键练习
              <span className="ml-0.5 opacity-90">({unresolvedPracticeList.length})</span>
            </button>
          )}
        </div>

        {totalCount > 0 && (
          <div className="flex items-center gap-2.5 border-t border-rose-100/80 bg-rose-50/35 px-2.5 py-1.5 sm:px-4 sm:py-2">
            <span className="shrink-0 text-[10px] font-semibold text-rose-800/75 sm:text-[11px]">
              订正进度
            </span>
            <span className="shrink-0 text-[10px] font-bold text-rose-900 sm:text-[11px]">
              {resolvedCount}/{totalCount}
            </span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rose-200/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-400 to-emerald-400 transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] font-bold text-emerald-700 sm:text-[11px]">
              {progressPct}%
            </span>
          </div>
        )}
      </header>

      <div
        className={`relative z-1 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-2 pb-4 sm:px-3 sm:pb-6 ${
          totalCount > 0 ? 'pt-[6.5rem] sm:pt-[7rem]' : 'pt-[4.75rem] sm:pt-[5.25rem]'
        }`}
      >
        <MistakeFilterPanel
          expanded={filterExpanded}
          onToggleExpanded={() => setFilterExpanded((v) => !v)}
          statusFilter={statusFilter}
          unresolvedCount={unresolvedCount}
          resolvedCount={resolvedCount}
          onStatusChange={setStatusFilter}
          selectedLessons={selectedLessons}
          wrongCountByLesson={wrongCountByLesson}
          onChange={setSelectedLessons}
        />

        {wrongList.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-rose-200/80 bg-white/50 px-4 py-12 text-center">
            <div className="text-4xl" aria-hidden>
              {totalCount === 0
                ? '🎉'
                : statusFilter === 'unresolved' && unresolvedCount === 0
                  ? '✅'
                  : filterActive
                    ? '🔍'
                    : '📭'}
            </div>
            <div className="text-text-primary max-w-xs text-[14px] font-bold leading-snug">
              {totalCount === 0
                ? allLessonsSelected
                  ? '错题本是空的，继续保持！'
                  : '所选讲次没有错题'
                : statusFilter === 'unresolved' && unresolvedCount === 0
                  ? '全部订正完成，可以去看看已订正记录'
                  : statusFilter === 'resolved' && resolvedCount === 0
                    ? '还没有已订正的题目'
                    : filterActive
                      ? '当前筛选条件下没有错题'
                      : '没有符合条件的错题'}
            </div>
            {statusFilter === 'unresolved' && unresolvedCount === 0 && resolvedCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700"
              >
                查看已订正 ({resolvedCount})
              </button>
            )}
            {filterActive && totalCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedLessons(new Set(ALL_LESSON_IDS))}
                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700"
              >
                恢复全选
              </button>
            )}
            <Link
              href="/math"
              className="bg-app-blue rounded-full px-4 py-1.5 text-[12px] font-semibold text-white no-underline"
            >
              去做题 →
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="text-[11px] font-semibold text-rose-900/60">
                共 {wrongList.length} 题
              </span>
              {!filterExpanded && (
                <button
                  type="button"
                  onClick={() => setFilterExpanded(true)}
                  className="text-[11px] font-semibold text-rose-500 hover:text-rose-700"
                >
                  调整筛选
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {wrongList.map(
              ({ id: storedId, problem, lessonId, section, href, resolved }, index) => (
              <MistakeCard
                key={storedId}
                storedId={storedId}
                problem={problem}
                lessonId={lessonId}
                section={section}
                resolved={resolved}
                count={solveCount[storedId] ?? solveCount[problem.id] ?? 0}
                hasDraft={hasDraftForEntry(storedId, problem.id)}
                draftLookupIds={[storedId, problem.id]}
                wrongProblems={wrongProblems}
                problemIndex={index}
                onPractice={() => {
                  if (resolved) {
                    beginPractice(problem.id, [
                      {
                        problem,
                        section,
                        lessonId,
                        detailHref: href,
                      },
                    ])
                  } else {
                    beginPractice(problem.id)
                  }
                }}
                onSolve={(id) => void handleSolve(id)}
                onDraftResolved={handleDraftResolved}
              />
            ),
            )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
