'use client'

import { useEffect, useMemo, useState } from 'react'
import { todayStr } from '@rosie/core'
import { clampNewWordsPerDay, defaultReviewCap } from '../../utils/adaptivePlanDefaults'
import type { AdaptivePlanWordProgress, AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'
import { simulateAdaptivePlan } from '../../utils/adaptivePlanSimulate'
import AdaptivePlanPreviewCalendar from './AdaptivePlanPreviewCalendar'
import BossThresholdPicker from './BossThresholdPicker'
import NewWordsPerDayPicker from './NewWordsPerDayPicker'
import ReviewSchedulePicker from './ReviewSchedulePicker'

type Props = {
  plan: AdaptiveWordPlan
  loadProgress: (planId: string) => Promise<AdaptivePlanWordProgress[]>
  onChangeNewWords: (n: number) => void
  onChangeReviewCap: (n: number) => void
  onChangeBacklogFuse: (n: number) => void
  onChangeBossEveryNNew: (n: number) => void
  onChangeBossStubbornThreshold: (n: number) => void
  onChangeBossPackLimit: (n: number) => void
  savingQuota: boolean
  savingTuning: boolean
}

export default function AdaptivePlanSettingsPanel({
  plan,
  loadProgress,
  onChangeNewWords,
  onChangeReviewCap,
  onChangeBacklogFuse,
  onChangeBossEveryNNew,
  onChangeBossStubbornThreshold,
  onChangeBossPackLimit,
  savingQuota,
  savingTuning,
}: Props) {
  const today = todayStr()
  const [draft, setDraft] = useState(plan)
  const [rows, setRows] = useState<AdaptivePlanWordProgress[]>([])
  const [isLoadingRows, setIsLoadingRows] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    setDraft(plan)
  }, [plan])

  useEffect(() => {
    let cancelled = false
    setIsLoadingRows(true)
    void loadProgress(plan.id)
      .then((loaded) => {
        if (cancelled) return
        setRows(loaded)
        setIsLoadingRows(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[adaptive_word_plan] settings preview load failed', err)
        setIsLoadingRows(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadProgress, plan.id])

  const simulation = useMemo(() => {
    const activeRows = rows.filter((row) => row.archivedAt == null)
    if (activeRows.length === 0) return null

    return simulateAdaptivePlan({
      plan: draft,
      wordKeys: activeRows.map((row) => row.wordKey),
      initialRows: rows,
      startDate: today,
      maxDays: 500,
      allCorrect: true,
    })
  }, [draft, rows, today])

  const handleNewWordsChange = (n: number) => {
    const next = clampNewWordsPerDay(n)
    setDraft((prev) => ({
      ...prev,
      newWordsPerDay: next,
      reviewCap: Math.max(prev.reviewCap, defaultReviewCap(next)),
    }))
    onChangeNewWords(next)
  }

  const handleReviewCapChange = (n: number) => {
    setDraft((prev) => ({ ...prev, reviewCap: n }))
    onChangeReviewCap(n)
  }

  const handleBacklogFuseChange = (n: number) => {
    setDraft((prev) => ({ ...prev, backlogFuse: n }))
    onChangeBacklogFuse(n)
  }

  const handleBossEveryNNewChange = (n: number) => {
    setDraft((prev) => ({ ...prev, bossEveryNNew: n }))
    onChangeBossEveryNNew(n)
  }

  const handleBossStubbornThresholdChange = (n: number) => {
    setDraft((prev) => ({ ...prev, bossStubbornThreshold: n }))
    onChangeBossStubbornThreshold(n)
  }

  const handleBossPackLimitChange = (n: number) => {
    setDraft((prev) => ({ ...prev, bossPackLimit: n }))
    onChangeBossPackLimit(n)
  }

  const simDays = simulation?.days ?? []
  const lastDay = simDays.at(-1)

  return (
    <div className="border-t border-[var(--wm-border)] bg-[rgba(0,0,0,.12)] px-5 py-4">
      <p className="mb-3 text-[13px] font-extrabold text-[#c4b5fd]">计划参数</p>
      <NewWordsPerDayPicker
        value={draft.newWordsPerDay}
        onChange={handleNewWordsChange}
        disabled={savingQuota}
        savingLabel={savingQuota ? '保存中…' : undefined}
        size="md"
      />
      <ReviewSchedulePicker
        reviewCap={draft.reviewCap}
        backlogFuse={draft.backlogFuse}
        newWordsPerDay={draft.newWordsPerDay}
        onReviewCapChange={handleReviewCapChange}
        onBacklogFuseChange={handleBacklogFuseChange}
        disabled={savingTuning}
        savingLabel={savingTuning ? '保存中…' : undefined}
      />
      <BossThresholdPicker
        bossEveryNNew={draft.bossEveryNNew}
        bossStubbornThreshold={draft.bossStubbornThreshold}
        bossPackLimit={draft.bossPackLimit}
        onBossEveryNNewChange={handleBossEveryNNewChange}
        onBossStubbornThresholdChange={handleBossStubbornThresholdChange}
        onBossPackLimitChange={handleBossPackLimitChange}
        disabled={savingTuning}
        savingLabel={savingTuning ? '保存中…' : undefined}
      />

      <div className="mt-5 border-t border-[var(--wm-border)] pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-extrabold text-[#c4b5fd]">排程预览（日历）</p>
          <span className="text-[11px] font-bold text-[var(--wm-text-dim)]">
            基于当前进度 · 假设每天全对
          </span>
        </div>

        {isLoadingRows ? (
          <div className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-4 py-8 text-center text-[12px] font-bold text-[var(--wm-text-dim)]">
            加载进度并计算排程…
          </div>
        ) : simDays.length === 0 ? (
          <div className="rounded-xl border border-[rgba(74,222,128,.3)] bg-[rgba(74,222,128,.08)] px-4 py-6 text-center text-[12px] font-bold text-[#86efac]">
            计划已全部完成，或暂无有效单词进度。
          </div>
        ) : (
          <>
            <div className="mb-3 text-[12px] font-bold text-[var(--wm-text-dim)]">
              当前配置下预计{' '}
              <span className="text-[#c4b5fd]">{simDays.length}</span> 个学习日
              {lastDay && (
                <>
                  （至 {lastDay.date}）
                </>
              )}
              {simDays.some((day) => day.mode === 'boss') && (
                <>
                  {' '}
                  · Boss 日{' '}
                  <span className="text-[#fbbf24]">
                    {simDays.filter((day) => day.mode === 'boss').length}
                  </span>{' '}
                  次
                </>
              )}
            </div>
            <AdaptivePlanPreviewCalendar
              days={simDays}
              today={today}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </>
        )}
      </div>
    </div>
  )
}
