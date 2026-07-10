'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { todayStr, useAuth, type WordEntry } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { useAdaptiveWordPlan } from '../../hooks/useAdaptiveWordPlan'
import { getAllStages, wordKey } from '../../utils/english-helpers'
import { simulateAdaptivePlan } from '../../utils/adaptivePlanSimulate'
import { ADAPTIVE_PLAN_DEFAULTS, clampNewWordsPerDay, defaultReviewCap } from '../../utils/adaptivePlanDefaults'
import type { AdaptivePlanScope, AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'
import { cmpLesson, lessonKey } from './english-weekly-plan-shared'
import BossThresholdPicker from './BossThresholdPicker'
import NewWordsPerDayPicker from './NewWordsPerDayPicker'
import ReviewSchedulePicker from './ReviewSchedulePicker'
import AdaptivePlanPreviewCalendar from './AdaptivePlanPreviewCalendar'

type Props = {
  vocab: WordEntry[]
}

type LessonOption = {
  unit: string
  lesson: string
  stage: string
}

function buildTitle(stages: string[], lessons: LessonOption[], wordCount: number): string {
  if (lessons.length > 0) {
    const lessonLabel =
      lessons.length <= 2
        ? lessons.map((lesson) => `${lesson.unit} · ${lesson.lesson}`).join('、')
        : `${lessons[0]?.unit ?? ''} 等 ${lessons.length} 课`
    return `自适应挑战：${lessonLabel}`
  }
  if (stages.length > 0) return `自适应挑战：${stages.join('、')}`
  return `自适应挑战：${wordCount} 词`
}

export default function AdaptivePlanEditor({ vocab }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const { masteryMap } = useWordsContext()
  const { createPlan, isLoading } = useAdaptiveWordPlan(user)

  const [title, setTitle] = useState('')
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set())
  const [selectedLessonKeys, setSelectedLessonKeys] = useState<Set<string>>(new Set())
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showMasteredDialog, setShowMasteredDialog] = useState(false)
  const [forceChallenge, setForceChallenge] = useState(false)
  const [newWordsPerDay, setNewWordsPerDay] = useState(5)
  const [reviewCap, setReviewCap] = useState<number>(defaultReviewCap(5))
  const [backlogFuse, setBacklogFuse] = useState<number>(ADAPTIVE_PLAN_DEFAULTS.backlogFuse)
  const [bossEveryNNew, setBossEveryNNew] = useState<number>(ADAPTIVE_PLAN_DEFAULTS.bossEveryNNew)
  const [bossStubbornThreshold, setBossStubbornThreshold] = useState<number>(
    ADAPTIVE_PLAN_DEFAULTS.bossStubbornThreshold,
  )
  const [bossPackLimit, setBossPackLimit] = useState<number>(ADAPTIVE_PLAN_DEFAULTS.bossPackLimit)
  const [previewSelectedDate, setPreviewSelectedDate] = useState<string | null>(null)

  const handleNewWordsPerDayChange = (n: number) => {
    const next = clampNewWordsPerDay(n)
    setNewWordsPerDay(next)
    setReviewCap((prev) => Math.max(prev, defaultReviewCap(next)))
  }

  const allStages = useMemo(() => getAllStages(vocab), [vocab])

  const orderedLessons = useMemo(() => {
    const seen = new Map<string, LessonOption>()
    for (const entry of vocab) {
      const key = lessonKey(entry)
      if (!seen.has(key)) {
        seen.set(key, { unit: entry.unit, lesson: entry.lesson, stage: entry.stage ?? '' })
      }
    }
    return [...seen.values()].sort(cmpLesson)
  }, [vocab])

  const pickerLessons = useMemo(() => {
    if (selectedStages.size === 0) return []
    return orderedLessons.filter((lesson) => selectedStages.has(lesson.stage))
  }, [orderedLessons, selectedStages])

  const lessonsByStage = useMemo(() => {
    const groups = new Map<string, LessonOption[]>()
    for (const lesson of pickerLessons) {
      const stage = lesson.stage || '未分词库'
      const list = groups.get(stage)
      if (list) list.push(lesson)
      else groups.set(stage, [lesson])
    }
    const stageOrder = allStages.length > 0 ? allStages : [...groups.keys()].sort()
    const ordered: { stage: string; lessons: LessonOption[] }[] = []
    for (const stage of stageOrder) {
      const lessons = groups.get(stage)
      if (lessons && lessons.length > 0) ordered.push({ stage, lessons })
    }
    for (const [stage, lessons] of groups) {
      if (!stageOrder.includes(stage)) ordered.push({ stage, lessons })
    }
    return ordered
  }, [pickerLessons, allStages])

  const allPickerSelected = useMemo(
    () =>
      pickerLessons.length > 0 &&
      pickerLessons.every((lesson) => selectedLessonKeys.has(lessonKey(lesson))),
    [pickerLessons, selectedLessonKeys],
  )

  const toggleLessonKeys = (lessons: LessonOption[], selectAll: boolean) => {
    setSelectedLessonKeys((prev) => {
      const next = new Set(prev)
      for (const lesson of lessons) {
        const key = lessonKey(lesson)
        if (selectAll) next.add(key)
        else next.delete(key)
      }
      return next
    })
  }

  const toggleStageExpanded = (stage: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  const selectedLessons = useMemo(
    () => orderedLessons.filter((lesson) => selectedLessonKeys.has(lessonKey(lesson))),
    [orderedLessons, selectedLessonKeys],
  )

  const selectedWords = useMemo(() => {
    if (selectedLessonKeys.size > 0) {
      return vocab.filter((entry) => selectedLessonKeys.has(lessonKey(entry)))
    }
    if (selectedStages.size > 0) {
      return vocab.filter((entry) => entry.stage && selectedStages.has(entry.stage))
    }
    return []
  }, [vocab, selectedLessonKeys, selectedStages])

  const wordKeys = useMemo(
    () => [...new Set(selectedWords.map((entry) => wordKey(entry)))],
    [selectedWords],
  )

  const defaultTitle = useMemo(
    () => buildTitle([...selectedStages], selectedLessons, wordKeys.length),
    [selectedStages, selectedLessons, wordKeys.length],
  )

  const planScope = useMemo<AdaptivePlanScope>(() => ({
    ...((selectedStages.size > 0) ? { stages: [...selectedStages] } : {}),
    ...((selectedLessonKeys.size > 0) ? { lessonKeys: [...selectedLessonKeys] } : {}),
  }), [selectedStages, selectedLessonKeys])

  const draftSimulation = useMemo(() => {
    if (wordKeys.length === 0) return null

    const draftPlan: AdaptiveWordPlan = {
      id: 'draft',
      userId: user?.id ?? 'draft',
      title: title.trim() || defaultTitle,
      scope: planScope,
      newWordsPerDay,
      reviewCap,
      reviewBatchSize: 20,
      backlogFuse,
      bossEveryNNew,
      bossStubbornThreshold,
      bossPackLimit,
      mode: 'normal',
      status: 'active',
      stats: {
        bossFailStreak: 0,
        bossQuestionTier: 1,
        everActivatedCount: 0,
        totalActivatedCount: 0,
        lastBossActivatedCount: 0,
      },
      createdAt: '',
      updatedAt: '',
    }

    return simulateAdaptivePlan({
      plan: draftPlan,
      wordKeys,
      startDate: todayStr(),
      maxDays: 500,
    })
  }, [
    bossEveryNNew,
    bossPackLimit,
    bossStubbornThreshold,
    backlogFuse,
    defaultTitle,
    newWordsPerDay,
    planScope,
    reviewCap,
    title,
    user?.id,
    wordKeys,
  ])

  const canSubmit = wordKeys.length > 0 && !isSubmitting && !isLoading

  const handleCreate = async (withForceChallenge: boolean) => {
    if (!canSubmit && !withForceChallenge) return
    if (wordKeys.length === 0) return

    setIsSubmitting(true)
    setCreateError(null)
    try {
      const result = await createPlan({
        title: title.trim() || defaultTitle,
        scope: planScope,
        wordKeys,
        masteryMap,
        forceChallenge: withForceChallenge,
        newWordsPerDay,
        reviewCap,
        backlogFuse,
        bossEveryNNew,
        bossStubbornThreshold,
        bossPackLimit,
      })

      if (!result.ok && result.reason === 'all_mastered') {
        setShowMasteredDialog(true)
        return
      }

      router.push('/admin/plans/english')
    } catch (err) {
      console.error('[adaptive_word_plan] create failed', err)
      setCreateError(
        err instanceof Error
          ? err.message
          : '创建失败。请确认已在 Supabase 执行 packages/english/sql/adaptive-word-plans.sql',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleCreate(false)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
        加载中…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 py-4 sm:px-5 sm:py-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-[16px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-4 sm:rounded-[20px] sm:p-6 md:p-7"
      >
        <div className="font-fredoka mb-5 bg-gradient-to-br from-[#8b5cf6] to-[#3b82f6] bg-clip-text text-2xl text-transparent">
          创建自适应计划
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
            计划名称
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={defaultTitle}
            className="w-full rounded-[10px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3 py-2 text-[.88rem] font-bold text-[var(--wm-text)] outline-none focus:border-[var(--wm-accent)]"
          />
        </div>

        {allStages.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
              选择词库（可多选）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allStages.map((stage) => {
                const isSelected = selectedStages.has(stage)
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => {
                      const nextStages = new Set(selectedStages)
                      if (nextStages.has(stage)) nextStages.delete(stage)
                      else nextStages.add(stage)
                      setSelectedStages(nextStages)
                      setSelectedLessonKeys((prev) => {
                        if (prev.size === 0) return prev
                        const next = new Set<string>()
                        for (const lesson of orderedLessons) {
                          const key = lessonKey(lesson)
                          if (prev.has(key) && nextStages.has(lesson.stage)) next.add(key)
                        }
                        return next
                      })
                    }}
                    className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[.78rem] font-bold transition-all ${
                      isSelected
                        ? 'border-[#8b5cf6] bg-[rgba(139,92,246,.15)] text-[#c4b5fd]'
                        : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]'
                    }`}
                  >
                    {stage}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-[.65rem] text-[var(--wm-text-dim)]">
              先选词库，再在下方挑选课程；只选词库不选课程时，会把该词库全部单词加入计划。
            </p>
          </div>
        )}

        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
              选择课程{selectedLessonKeys.size > 0 ? `（已选 ${selectedLessonKeys.size}）` : '（可多选）'}
            </span>
            {pickerLessons.length > 0 && (
              <button
                type="button"
                onClick={() => toggleLessonKeys(pickerLessons, !allPickerSelected)}
                className="cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3 py-1 text-[.7rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
              >
                {allPickerSelected ? '取消全选' : '全部全选'}
              </button>
            )}
          </div>
          {selectedStages.size === 0 ? (
            <div className="rounded-xl border border-[var(--wm-border)] px-4 py-3 text-[.8rem] text-[var(--wm-text-dim)]">
              请先选择词库
            </div>
          ) : lessonsByStage.length === 0 ? (
            <div className="rounded-xl border border-[var(--wm-border)] px-4 py-3 text-[.8rem] text-[var(--wm-text-dim)]">
              该词库下暂无课程
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lessonsByStage.map(({ stage, lessons }) => {
                const stageAllSelected =
                  lessons.length > 0 &&
                  lessons.every((lesson) => selectedLessonKeys.has(lessonKey(lesson)))
                const stageSelectedCount = lessons.filter((lesson) =>
                  selectedLessonKeys.has(lessonKey(lesson)),
                ).length
                const isExpanded =
                  expandedStages.has(stage) || lessonsByStage.length === 1
                return (
                  <div
                    key={stage}
                    className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleStageExpanded(stage)}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 bg-transparent py-0.5 text-left"
                        aria-expanded={isExpanded}
                      >
                        <span className="w-3 shrink-0 text-[.7rem] text-[var(--wm-text-dim)]">
                          {isExpanded ? '▾' : '▸'}
                        </span>
                        <span className="text-[.82rem] font-extrabold text-[#c4b5fd]">{stage}</span>
                        <span className="text-[.65rem] text-[var(--wm-text-dim)]">
                          {stageSelectedCount > 0
                            ? `${stageSelectedCount}/${lessons.length}`
                            : `${lessons.length} 课`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleLessonKeys(lessons, !stageAllSelected)}
                        className="shrink-0 cursor-pointer rounded-full border border-[var(--wm-border)] bg-transparent px-2.5 py-0.5 text-[.65rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
                      >
                        {stageAllSelected ? '取消' : '全选'}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {lessons.map((lesson) => {
                          const key = lessonKey(lesson)
                          const isSelected = selectedLessonKeys.has(key)
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() =>
                                setSelectedLessonKeys((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(key)) next.delete(key)
                                  else next.add(key)
                                  return next
                                })
                              }
                              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-[.78rem] font-bold transition-all ${
                                isSelected
                                  ? 'border-[#8b5cf6] bg-[rgba(139,92,246,.15)] text-[#c4b5fd]'
                                  : 'border-[var(--wm-border)] bg-[var(--wm-surface)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]'
                              }`}
                            >
                              {isSelected && <span className="text-[.65rem] font-black">✓</span>}
                              <span>
                                {lesson.unit} · {lesson.lesson}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-5">
          <NewWordsPerDayPicker
            value={newWordsPerDay}
            onChange={handleNewWordsPerDayChange}
            wordCount={wordKeys.length}
          />
        </div>

        <ReviewSchedulePicker
          reviewCap={reviewCap}
          backlogFuse={backlogFuse}
          newWordsPerDay={newWordsPerDay}
          onReviewCapChange={setReviewCap}
          onBacklogFuseChange={setBacklogFuse}
        />

        <BossThresholdPicker
          bossEveryNNew={bossEveryNNew}
          bossStubbornThreshold={bossStubbornThreshold}
          bossPackLimit={bossPackLimit}
          onBossEveryNNewChange={setBossEveryNNew}
          onBossStubbornThresholdChange={setBossStubbornThreshold}
          onBossPackLimitChange={setBossPackLimit}
        />

        <div className="mb-5 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
              排程预览（日历）
            </div>
            <span className="text-[.65rem] font-bold text-[var(--wm-text-dim)]">
              基于当前配置 · 假设每天全对
            </span>
          </div>
          <div className="text-[1.15rem] font-extrabold text-[#c4b5fd]">{wordKeys.length} 个单词</div>
          <div className="mt-1 text-[.72rem] text-[var(--wm-text-dim)]">
            {selectedLessonKeys.size > 0
              ? `已选 ${selectedLessonKeys.size} 个课程 · 新词 ${newWordsPerDay} · 复习上限 ${reviewCap} · Boss 题包 ${bossPackLimit}`
              : selectedStages.size > 0
                ? `已选 ${selectedStages.size} 个词库 · 新词 ${newWordsPerDay} · 复习上限 ${reviewCap} · Boss 题包 ${bossPackLimit}`
                : '请选择词库或课程后查看预览'}
          </div>
          {draftSimulation && draftSimulation.days.length > 0 ? (
            <div className="mt-3 border-t border-[var(--wm-border)] pt-3">
              <div className="mb-3 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
                预计{' '}
                <span className="text-[#c4b5fd]">{draftSimulation.days.length}</span> 个学习日
                {draftSimulation.days.at(-1) && (
                  <>
                    （至 {draftSimulation.days.at(-1)!.date}）
                  </>
                )}
                {draftSimulation.days.some((d) => d.mode === 'boss') && (
                  <>
                    {' '}
                    · Boss 日{' '}
                    <span className="text-[#fbbf24]">
                      {draftSimulation.days.filter((d) => d.mode === 'boss').length}
                    </span>{' '}
                    次
                  </>
                )}
              </div>
              <AdaptivePlanPreviewCalendar
                days={draftSimulation.days}
                today={todayStr()}
                selectedDate={previewSelectedDate}
                onSelectDate={setPreviewSelectedDate}
              />
              <p className="mt-3 text-[.65rem] leading-relaxed text-[var(--wm-text-dim)]">
                调整参数时日历会即时更新；创建后可在「轨迹预览」页结合真实进度查看。
              </p>
            </div>
          ) : wordKeys.length > 0 ? (
            <div className="mt-3 border-t border-[var(--wm-border)] pt-3 text-[.72rem] font-bold text-[#86efac]">
              所选单词均已掌握，可勾选强制挑战后创建。
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex gap-2.5 border-t border-[var(--wm-border)] pt-5">
          <button
            type="button"
            onClick={() => router.push('/admin/plans/english')}
            className="font-nunito flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-[var(--wm-border)] bg-transparent py-2.5 text-[.85rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="font-nunito flex-[2] cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#7c3aed] to-[#2563eb] py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(124,58,237,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(124,58,237,.5)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? '创建中…' : '创建计划'}
          </button>
        </div>
        {createError && (
          <p className="mt-3 text-[.78rem] font-bold leading-relaxed text-[#f87171]">{createError}</p>
        )}
      </form>

      {showMasteredDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,23,.72)] px-4">
          <div className="w-full max-w-[420px] rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-6 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
            <div className="mb-2 text-[1.1rem] font-extrabold text-[var(--wm-text)]">
              这些单词都已掌握
            </div>
            <p className="mb-4 text-[.82rem] leading-relaxed text-[var(--wm-text-dim)]">
              当前范围内没有需要重新学习的单词。如果想把已掌握单词也加入挑战，请勾选强制挑战后继续。
            </p>
            <label className="mb-5 flex cursor-pointer items-center gap-2 text-[.85rem] font-bold text-[#c4b5fd]">
              <input
                type="checkbox"
                checked={forceChallenge}
                onChange={(event) => setForceChallenge(event.target.checked)}
                className="h-4 w-4 accent-[#8b5cf6]"
              />
              强制挑战
            </label>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowMasteredDialog(false)
                  setForceChallenge(false)
                }}
                className="font-nunito flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-[var(--wm-border)] bg-transparent py-2.5 text-[.85rem] font-bold text-[var(--wm-text-dim)]"
              >
                返回调整
              </button>
              <button
                type="button"
                disabled={!forceChallenge || isSubmitting}
                onClick={() => { void handleCreate(true) }}
                className="font-nunito flex-[1.4] cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#7c3aed] to-[#2563eb] py-2.5 text-[.88rem] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                继续创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
