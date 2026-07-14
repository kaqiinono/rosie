'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { todayStr, useAuth, type WordEntry } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { useAdaptiveWordPlan } from '../../hooks/useAdaptiveWordPlan'
import { wordKey } from '../../utils/english-helpers'
import { simulateAdaptivePlan } from '../../utils/adaptivePlanSimulate'
import { ADAPTIVE_PLAN_DEFAULTS, clampNewWordsPerDay, defaultReviewCap } from '../../utils/adaptivePlanDefaults'
import type { AdaptivePlanScope, AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'
import { lessonKey } from './english-weekly-plan-shared'
import VocabRangeFilter from './vocab-range-filter/VocabRangeFilter'
import type { LessonOption } from './vocab-range-filter/types'
import {
  pruneLessonsForStages,
  pruneUnitsForStages,
  toggleUnitSelection,
  useVocabRangeFilter,
} from './vocab-range-filter/useVocabRangeFilter'
import BossThresholdPicker from './BossThresholdPicker'
import NewWordsPerDayPicker from './NewWordsPerDayPicker'
import ReviewSchedulePicker from './ReviewSchedulePicker'
import AdaptivePlanPreviewCalendar from './AdaptivePlanPreviewCalendar'

type Props = {
  vocab: WordEntry[]
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
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set())
  const [selectedLessonKeys, setSelectedLessonKeys] = useState<Set<string>>(new Set())
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

  const orderedLessons = useMemo(() => {
    const seen = new Map<string, LessonOption>()
    for (const entry of vocab) {
      const key = lessonKey(entry)
      if (!seen.has(key)) {
        seen.set(key, { unit: entry.unit, lesson: entry.lesson, stage: entry.stage ?? '' })
      }
    }
    return [...seen.values()].sort((a, b) => {
      const unitCmp = a.unit.localeCompare(b.unit, undefined, { numeric: true, sensitivity: 'base' })
      if (unitCmp !== 0) return unitCmp
      return a.lesson.localeCompare(b.lesson, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [vocab])

  const { baseWords } = useVocabRangeFilter({
    vocab,
    stageMode: 'multi',
    selectedStages,
    selectedUnits,
    selectedLessons: selectedLessonKeys,
  })

  const handleStagesChange = (value: string | Set<string>) => {
    const nextStages = value as Set<string>
    setSelectedStages(nextStages)
    setSelectedUnits((prev) => pruneUnitsForStages(prev, vocab, nextStages))
    setSelectedLessonKeys((prev) => pruneLessonsForStages(prev, orderedLessons, nextStages))
  }

  const handleToggleUnit = (unit: string) => {
    const next = toggleUnitSelection(selectedUnits, selectedLessonKeys, unit)
    setSelectedUnits(next.units)
    setSelectedLessonKeys(next.lessons)
  }

  const selectedLessons = useMemo(
    () => orderedLessons.filter((lesson) => selectedLessonKeys.has(lessonKey(lesson))),
    [orderedLessons, selectedLessonKeys],
  )

  const wordKeys = useMemo(() => {
    if (selectedStages.size === 0) return []
    return [...new Set(baseWords.map((entry) => wordKey(entry)))]
  }, [baseWords, selectedStages.size])

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
    <>
      <VocabRangeFilter
        vocab={vocab}
        variant="bar"
        stageMode="multi"
        selectedStages={selectedStages}
        onStagesChange={handleStagesChange}
        requireStage
        showUnits
        selectedUnits={selectedUnits}
        onToggleUnit={handleToggleUnit}
        lessonLayout="cascade"
        selectedLessons={selectedLessonKeys}
        onLessonsChange={setSelectedLessonKeys}
        scopeCount={wordKeys.length}
        hint="只选词库不选 Unit/Lesson 时，会把该词库全部单词加入计划。"
      />

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
    </>
  )
}
