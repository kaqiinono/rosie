'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { useMathWeeklyPlan } from '@rosie/math/hooks/useMathWeeklyPlan'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import {
  buildMathFlexiblePlan,
  countFilteredPlanProblems,
  MATH_PLAN_SECTIONS,
  addPlanDays,
  getOccupiedPlanDates,
  planRangeOverlapsOccupied,
  suggestAvailablePlanRange,
  getLessonTagStats,
  getLessonSectionStats,
  planEndDate,
} from '@rosie/math/utils/math-helpers'
import PlanDateRangePicker from './PlanDateRangePicker'
import ProblemMasteryPanel from './ProblemMasteryPanel'
import { useProblemMastery } from '@rosie/math/hooks/useProblemMastery'
import { todayStr } from '@rosie/core'
import { gradeOf, GRADE_LABEL, gradesInOrder } from '@rosie/math/utils/lesson-grade'
import type { MathWeeklyPlan, MathPlanProblem, ProblemSet } from '@rosie/core'
import type { MathPlanSectionKey } from '@rosie/math/utils/math-helpers'
import {
  MATH_PLAN_LESSONS,
  countPlanDays,
  availableSections,
  defaultSectionsForLesson,
  fmtPlanRange,
  SECTION_EMOJI,
} from './math-weekly-plan-shared'

interface Props {
  problemSets: Record<string, ProblemSet>
  editWeekStart?: string
}

export default function MathWeeklyPlanEditor({ problemSets, editWeekStart }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const {
    allPlans,
    priorProblemMap,
    currentWeekStart,
    defaultParams,
    savePlan,
    deletePlan,
    isLoading,
  } = useMathWeeklyPlan(user)
  const { masteryMap } = useProblemMastery(user)
  
  const { solveCount } = useMathSolved(user)
  
  const today = todayStr()
    const [selectedLessons, setSelectedLessons] = useState<Set<string>>(
    () => new Set([MATH_PLAN_LESSONS.slice(-1)[0]?.id ?? '1-37']),
  )
  const [sectionFilters, setSectionFilters] = useState<Record<string, string[]>>({})
  const [tagFilters, setTagFilters] = useState<Record<string, string[]>>({})
  const [planStartDate, setPlanStartDate] = useState(today)
  const [planEndDateStr, setPlanEndDateStr] = useState(() => addPlanDays(today, 6))
  const [editingPlanStart, setEditingPlanStart] = useState<string | null>(editWeekStart ?? null)
  const [collapsedGrades, setCollapsedGrades] = useState<Set<number>>(() => new Set())

  const toggleGradeCollapsed = useCallback((grade: number) => {
    setCollapsedGrades(prev => {
      const next = new Set(prev)
      if (next.has(grade)) next.delete(grade)
      else next.add(grade)
      return next
    })
  }, [])

  const selectedLessonIds = useMemo(() => [...selectedLessons].sort((a, b) => Number(a) - Number(b)), [selectedLessons])

  const previewTotal = useMemo(
    () => countFilteredPlanProblems(selectedLessonIds, sectionFilters, problemSets, tagFilters),
    [selectedLessonIds, sectionFilters, problemSets, tagFilters],
  )
  const previewDays = useMemo(() => countPlanDays(planStartDate, planEndDateStr), [planStartDate, planEndDateStr])
  const previewProblemsPerDay = previewDays > 0 ? Math.max(1, Math.ceil(previewTotal / previewDays)) : 0

  const occupiedDatesInForm = useMemo(
    () => getOccupiedPlanDates(allPlans, editingPlanStart ?? undefined),
    [allPlans, editingPlanStart],
  )

  const rangeHasOverlap = useMemo(
    () => planRangeOverlapsOccupied(planStartDate, planEndDateStr, occupiedDatesInForm),
    [planStartDate, planEndDateStr, occupiedDatesInForm],
  )

  const applySuggestedDateRange = useCallback(
    (fromDate: string) => {
      const occupied = getOccupiedPlanDates(allPlans, editingPlanStart ?? undefined)
      const suggested = suggestAvailablePlanRange(occupied, fromDate, 7)
      if (suggested) {
        setPlanStartDate(suggested.start)
        setPlanEndDateStr(suggested.end)
      }
    },
    [allPlans, editingPlanStart],
  )

  const syncTagsForLesson = useCallback(
    (lessonId: string, sections: string[]) => {
      const ps = problemSets[lessonId]
      if (!ps) return
      const available = getLessonTagStats(ps, sections as MathPlanSectionKey[], solveCount).map(t => t.tag)
      setTagFilters(prev => {
        const current = prev[lessonId] ?? available
        const kept = current.filter(t => available.includes(t))
        return { ...prev, [lessonId]: kept.length > 0 ? kept : available }
      })
    },
    [problemSets, solveCount],
  )

  const toggleLesson = useCallback(
    (lessonId: string) => {
      setSelectedLessons(prev => {
        const next = new Set(prev)
        if (next.has(lessonId)) {
          if (next.size > 1) next.delete(lessonId)
        } else {
          next.add(lessonId)
          const sections = sectionFilters[lessonId] ?? defaultSectionsForLesson(problemSets[lessonId])
          setSectionFilters(sf => ({
            ...sf,
            [lessonId]: sf[lessonId] ?? defaultSectionsForLesson(problemSets[lessonId]),
          }))
          syncTagsForLesson(lessonId, sections)
        }
        return next
      })
    },
    [problemSets, sectionFilters, syncTagsForLesson],
  )

  const toggleSection = useCallback((lessonId: string, section: string) => {
    setSectionFilters(prev => {
      const current = prev[lessonId] ?? defaultSectionsForLesson(problemSets[lessonId])
      const next = current.includes(section)
        ? current.filter(s => s !== section)
        : [...current, section]
      const resolved = next.length > 0 ? next : current
      syncTagsForLesson(lessonId, resolved)
      return { ...prev, [lessonId]: resolved }
    })
  }, [problemSets, syncTagsForLesson])

  const toggleTag = useCallback((lessonId: string, tag: string) => {
    setTagFilters(prev => {
      const ps = problemSets[lessonId]
      if (!ps) return prev
      const sections = sectionFilters[lessonId] ?? defaultSectionsForLesson(ps)
      const allTags = getLessonTagStats(ps, sections as MathPlanSectionKey[], solveCount).map(t => t.tag)
      const current = prev[lessonId] ?? allTags
      const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
      return { ...prev, [lessonId]: next.length > 0 ? next : current }
    })
  }, [problemSets, sectionFilters, solveCount])

  const loadPlanIntoForm = useCallback(
    (plan: MathWeeklyPlan) => {
      const ids = plan.lessonIds ?? [plan.lessonId]
      setSelectedLessons(new Set(ids))
      setSectionFilters(plan.sectionFilters ?? Object.fromEntries(
        ids.map(id => [id, defaultSectionsForLesson(problemSets[id])]),
      ))
      setTagFilters(plan.tagFilters ?? {})
      for (const id of ids) {
        const sections = plan.sectionFilters?.[id] ?? defaultSectionsForLesson(problemSets[id])
        if (!plan.tagFilters?.[id]) syncTagsForLesson(id, sections)
      }
      setPlanStartDate(plan.weekStart)
      setPlanEndDateStr(planEndDate(plan))
      setEditingPlanStart(plan.weekStart)
    },
    [problemSets, syncTagsForLesson],
  )

  const handleCreatePlan = useCallback(async () => {
    if (selectedLessonIds.length === 0 || previewDays <= 0 || previewTotal <= 0) return
    if (planEndDateStr < planStartDate) return
    if (planRangeOverlapsOccupied(planStartDate, planEndDateStr, getOccupiedPlanDates(allPlans, editingPlanStart ?? undefined))) {
      return
    }

    const { days, problemsPerDay } = buildMathFlexiblePlan(
      selectedLessonIds,
      sectionFilters,
      problemSets,
      planStartDate,
      planEndDateStr,
      tagFilters,
      solveCount,
    )

    const targetStart = editingPlanStart ?? planStartDate
    const existingPlan = allPlans.find(p => p.weekStart === targetStart)
    const primaryLesson = selectedLessonIds[selectedLessonIds.length - 1] ?? selectedLessonIds[0]!

    const plan: MathWeeklyPlan = {
      weekStart: planStartDate,
      planEnd: planEndDateStr,
      lessonId: primaryLesson,
      lessonIds: selectedLessonIds,
      sectionFilters,
      tagFilters,
      weekStartDay: existingPlan?.weekStartDay ?? defaultParams.weekStartDay,
      problemsPerDay,
      days,
      progress:
        existingPlan &&
        JSON.stringify(existingPlan.lessonIds ?? [existingPlan.lessonId]) === JSON.stringify(selectedLessonIds)
          ? (existingPlan.progress ?? {})
          : {},
    }

    if (editingPlanStart && editingPlanStart !== planStartDate) {
      await deletePlan(editingPlanStart)
    }

    await savePlan(plan)
    setEditingPlanStart(null)
    router.push('/admin/plans/math')
  }, [
    selectedLessonIds,
    sectionFilters,
    tagFilters,
    problemSets,
    planStartDate,
    planEndDateStr,
    previewDays,
    previewTotal,
    editingPlanStart,
    allPlans,
    defaultParams.weekStartDay,
    savePlan,
    deletePlan,
    solveCount,
    router,
  ])

  const allPlanProblems: MathPlanProblem[] = useMemo(() => {
    const prior = Object.values(priorProblemMap)
    const seen = new Set<string>()
    return prior.filter((p) => {
      if (seen.has(p.key)) return false
      seen.add(p.key)
      return true
    })
  }, [priorProblemMap])

  useEffect(() => {
    if (!editWeekStart || isLoading) return
    const plan = allPlans.find((p) => p.weekStart === editWeekStart)
    if (plan) loadPlanIntoForm(plan)
  }, [editWeekStart, isLoading, allPlans, loadPlanIntoForm])

  useEffect(() => {
    if (editWeekStart || isLoading || allPlans.length > 0) return
    applySuggestedDateRange(today)
  }, [editWeekStart, isLoading, allPlans.length, today, applySuggestedDateRange])

  // ── Loading overlay ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4"
        style={{ background: 'rgba(255,248,240,0.75)', backdropFilter: 'blur(6px)' }}
      >
        <div className="animate-bounce-slow text-5xl">⭐</div>
        <div className="text-[14px] font-bold text-orange-400">正在加载中…</div>
      </div>
    )
  }

  const isEditing = !!editingPlanStart
  const canCreate =
      selectedLessonIds.length > 0 &&
      previewDays > 0 &&
      previewTotal > 0 &&
      planEndDateStr >= planStartDate &&
      !rangeHasOverlap

  return (
      <div className="mx-auto max-w-130 px-4 py-8">
          {/* Top nav */}
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push('/admin/plans/math')}
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-orange-700 transition-all hover:scale-105"
              style={{ background: 'rgba(251,146,60,.12)', border: '1.5px solid rgba(251,146,60,.3)' }}
            >
              <span>←</span>
              <span>返回</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/plans/math')}
              className="cursor-pointer rounded-full px-3 py-2 text-[13px] font-bold text-gray-400 transition-all hover:text-gray-600"
              style={{ background: 'rgba(0,0,0,.05)', border: '1.5px solid rgba(0,0,0,.06)' }}
            >
              取消
            </button>
          </div>

          <div className="mb-6 text-center">
            <div className="mb-2 inline-flex items-center gap-3">
              <span className="animate-wiggle inline-block text-4xl">🚀</span>
              <div className="text-[22px] leading-tight font-extrabold text-orange-800">
                {isEditing ? '修改计划' : '创建计划'}
              </div>
            </div>
          </div>

          {/* Date range */}
          <div
            className="mb-5 rounded-xl px-4 py-4"
            style={{ background: 'rgba(255,255,255,.7)', border: '1.5px solid rgba(0,0,0,.06)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-widest text-gray-400 uppercase">
                计划时间段
              </span>
              <span className="text-[12px] font-bold text-orange-600">
                {fmtPlanRange(planStartDate, planEndDateStr)} · {previewDays} 天
              </span>
            </div>
            <PlanDateRangePicker
              key={editingPlanStart ?? 'new'}
              startDate={planStartDate}
              endDate={planEndDateStr}
              occupiedDates={occupiedDatesInForm}
              onRangeChange={(start, end) => {
                setPlanStartDate(start)
                setPlanEndDateStr(end)
              }}
            />
            {rangeHasOverlap && (
              <div className="mt-3 text-[12px] font-medium text-red-500">
                所选时间段与已有计划重叠，请选择空闲日期
              </div>
            )}
            {occupiedDatesInForm.size > 0 && !rangeHasOverlap && !isEditing && (
              <div className="mt-3 text-[11px] font-medium text-gray-400">
                灰色划线的日期已有计划，不可选择
              </div>
            )}
          </div>

          {/* Lesson multi-select */}
          <div className="mb-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-extrabold tracking-widest text-orange-400 uppercase">
                选择关卡（可多选）
              </span>
              <div className="h-px flex-1 bg-orange-100" />
            </div>
            <div className="flex flex-col gap-5">
              {gradesInOrder().map(g => {
                const gradeLessons = MATH_PLAN_LESSONS.filter(l => gradeOf(l.id) === g)
                if (gradeLessons.length === 0) return null
                const isCollapsed = collapsedGrades.has(g)
                const selectedInGrade = gradeLessons.filter(l => selectedLessons.has(l.id)).length
                return (
                  <div key={g}>
                    <button
                      type="button"
                      onClick={() => toggleGradeCollapsed(g)}
                      className="mb-2 flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left transition-all hover:bg-orange-50/80"
                    >
                      <span
                        className="text-[12px] text-orange-400 transition-transform"
                        style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                      >
                        ▾
                      </span>
                      <span className="text-[11px] font-extrabold tracking-wide text-orange-500/80">
                        {GRADE_LABEL[g] ?? `${g} 年级`}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        {gradeLessons.length} 讲
                      </span>
                      {selectedInGrade > 0 && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-extrabold text-orange-600">
                          已选 {selectedInGrade}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] font-bold text-gray-400">
                        {isCollapsed ? '展开' : '收起'}
                      </span>
                    </button>
                    {!isCollapsed && (
                    <div className="flex flex-col gap-3">
                      {gradeLessons.map(l => {
                        const isSelected = selectedLessons.has(l.id)
                        const ps = problemSets[l.id]
                        const availSections = ps ? availableSections(ps) : []
                        const enabledSections = sectionFilters[l.id] ?? (isSelected ? defaultSectionsForLesson(ps) : [])
                        const tagStats = ps && isSelected
                          ? getLessonTagStats(ps, enabledSections as MathPlanSectionKey[], solveCount)
                          : []
                        const sectionStats = ps
                          ? getLessonSectionStats(ps, availSections as MathPlanSectionKey[], solveCount)
                          : []
                        const sectionStatMap = Object.fromEntries(sectionStats.map(s => [s.section, s]))
                        const enabledTags = tagFilters[l.id] ?? tagStats.map(t => t.tag)
                        const lessonPracticeTotal = sectionStats.reduce((n, s) => n + s.total, 0)
                        const lessonPracticeDone = sectionStats.reduce((n, s) => n + s.practiced, 0)
                        return (
                          <div key={l.id}>
                            <button
                              type="button"
                              onClick={() => toggleLesson(l.id)}
                              className="group relative flex w-full cursor-pointer items-center gap-4 rounded-xl px-4 py-4 text-left transition-all duration-200"
                              style={{
                                background: isSelected ? l.bg : 'rgba(255,255,255,.7)',
                                border: `2px solid ${isSelected ? l.border : 'rgba(0,0,0,.06)'}`,
                                boxShadow: isSelected ? `0 4px 20px ${l.color}20` : '0 2px 8px rgba(0,0,0,.04)',
                              }}
                            >
                              <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl"
                                style={{ background: l.bg, border: `1.5px solid ${l.border}` }}
                              >
                                {l.emoji}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[14px] leading-tight font-extrabold text-gray-800">{l.label}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                                  <span>{l.desc}</span>
                                  {lessonPracticeTotal > 0 && (
                                    <span
                                      className="font-extrabold"
                                      style={{
                                        color:
                                          lessonPracticeDone >= lessonPracticeTotal
                                            ? '#16a34a'
                                            : lessonPracticeDone > 0
                                              ? '#ea580c'
                                              : '#9ca3af',
                                      }}
                                    >
                                      已练 {lessonPracticeDone}/{lessonPracticeTotal}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px] font-extrabold"
                                style={{
                                  background: isSelected ? l.color : 'rgba(0,0,0,.06)',
                                  color: isSelected ? 'white' : 'transparent',
                                }}
                              >
                                {isSelected ? '✓' : ''}
                              </div>
                            </button>
                            {isSelected && availSections.length > 0 && (
                              <div
                                className="mt-2 ml-2 rounded-lg px-3 py-2.5"
                                style={{ background: 'rgba(255,255,255,.85)', border: '1px solid rgba(0,0,0,.06)' }}
                              >
                                <div className="mb-2 text-[10px] font-extrabold tracking-wide text-gray-400 uppercase">
                                  📂 题目来源
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                {MATH_PLAN_SECTIONS.filter(s => availSections.includes(s.key)).map(s => {
                                  const on = enabledSections.includes(s.key)
                                  const stat = sectionStatMap[s.key]
                                  const allDone = stat && stat.total > 0 && stat.practiced >= stat.total
                                  const noneDone = !stat || stat.practiced === 0
                                  return (
                                    <button
                                      key={s.key}
                                      type="button"
                                      onClick={() => toggleSection(l.id, s.key)}
                                      className="cursor-pointer rounded-lg px-2.5 py-1.5 text-left transition-all hover:scale-[1.02]"
                                      style={{
                                        background: on
                                          ? allDone
                                            ? 'linear-gradient(135deg, #22c55e, #4ade80)'
                                            : 'linear-gradient(135deg, #f97316, #fbbf24)'
                                          : 'rgba(0,0,0,.05)',
                                        color: on ? 'white' : '#9ca3af',
                                        border: on ? 'none' : '1px solid rgba(0,0,0,.08)',
                                        opacity: on ? 1 : 0.85,
                                      }}
                                    >
                                      <div className="text-[11px] font-bold leading-tight">
                                        {SECTION_EMOJI[s.key]} {s.label}
                                      </div>
                                      {stat && (
                                        <div
                                          className="mt-0.5 text-[10px] font-extrabold"
                                          style={{ color: on ? 'rgba(255,255,255,.92)' : noneDone ? '#9ca3af' : '#ea580c' }}
                                        >
                                          已练 {stat.practiced}/{stat.total}
                                        </div>
                                      )}
                                    </button>
                                  )
                                })}
                                </div>
                              </div>
                            )}
                            {isSelected && tagStats.length > 0 && (
                              <div
                                className="mt-2 ml-2 rounded-lg px-3 py-2.5"
                                style={{ background: 'rgba(255,255,255,.85)', border: '1px solid rgba(0,0,0,.06)' }}
                              >
                                <div className="mb-2 text-[10px] font-extrabold tracking-wide text-gray-400 uppercase">
                                  🏷️ 题型筛选
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {tagStats.map(stat => {
                                    const on = enabledTags.includes(stat.tag)
                                    const allDone = stat.total > 0 && stat.practiced >= stat.total
                                    const noneDone = stat.practiced === 0
                                    return (
                                      <button
                                        key={stat.tag}
                                        type="button"
                                        onClick={() => toggleTag(l.id, stat.tag)}
                                        className="cursor-pointer rounded-lg px-2.5 py-1.5 text-left transition-all hover:scale-[1.02]"
                                        style={{
                                          background: on
                                            ? allDone
                                              ? 'linear-gradient(135deg, #22c55e, #4ade80)'
                                              : 'linear-gradient(135deg, #f97316, #fbbf24)'
                                            : 'rgba(0,0,0,.05)',
                                          color: on ? 'white' : '#9ca3af',
                                          border: on ? 'none' : '1px solid rgba(0,0,0,.08)',
                                          opacity: on ? 1 : 0.85,
                                        }}
                                      >
                                        <div className="text-[11px] font-bold leading-tight">{stat.tagLabel}</div>
                                        <div
                                          className="mt-0.5 text-[10px] font-extrabold"
                                          style={{ color: on ? 'rgba(255,255,255,.92)' : noneDone ? '#9ca3af' : '#ea580c' }}
                                        >
                                          已练 {stat.practiced}/{stat.total}
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Preview card */}
          <div
            className="mb-5 rounded-[14px] px-4 py-3.5"
            style={{
              background: 'rgba(251,146,60,.08)',
              border: '1.5px dashed rgba(251,146,60,.4)',
            }}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[14px]">🗺️</span>
              <span className="text-[11px] font-extrabold tracking-wider text-orange-600 uppercase">
                计划预览
              </span>
            </div>
            <div className="text-[13px] font-medium text-orange-800">
              共 <span className="text-[15px] font-extrabold">{previewTotal}</span> 道题
              <span className="mx-1.5 text-orange-300">·</span>
              <span className="text-[15px] font-extrabold">{previewDays}</span> 天
              <span className="mx-1.5 text-orange-300">·</span>
              每天约 <span className="text-[15px] font-extrabold">{previewProblemsPerDay}</span> 题
              <span className="mx-1.5 text-orange-300">·</span>
              按题型均衡分配（易→难）
            </div>
            {previewTotal === 0 && (
              <div className="mt-2 text-[12px] font-medium text-red-400">请至少选择一个关卡并勾选题目来源</div>
            )}
            {planEndDateStr < planStartDate && (
              <div className="mt-2 text-[12px] font-medium text-red-400">结束日期不能早于开始日期</div>
            )}
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreatePlan}
              disabled={!canCreate}
              className="group relative flex-1 cursor-pointer overflow-hidden rounded-xl py-4 text-[15px] font-extrabold text-white transition-all hover:scale-[1.02] hover:shadow-[0_8px_28px_rgba(249,115,22,.45)] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)' }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <span className="group-hover:animate-wiggle inline-block text-xl">🚀</span>
                {isEditing ? '保存修改' : '创建计划'}
              </span>
            </button>
          </div>

        {allPlanProblems.length > 0 && (
          <ProblemMasteryPanel problems={allPlanProblems} masteryMap={masteryMap} />
        )}
      </div>
  )
}
