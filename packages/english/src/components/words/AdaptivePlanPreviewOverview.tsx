'use client'

import type { AdaptivePlanWordProgress, AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'
import type { SimulateAdaptivePlanResult } from '../../utils/adaptivePlanSimulate'
import AdaptivePlanStageRoadmap from './AdaptivePlanStageRoadmap'

type AdaptivePlanPreviewOverviewProps = {
  rows: AdaptivePlanWordProgress[]
  plan: AdaptiveWordPlan
  simulation: SimulateAdaptivePlanResult
}

type OverviewStat = {
  label: string
  value: string
  color: string
  hint?: string
  compactValue?: boolean
}

function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-')
  return `${m}-${d}`
}

function firstDayTaskLabel(
  day: SimulateAdaptivePlanResult['days'][number] | undefined,
): { text: string; color: string } {
  if (!day) return { text: '—', color: '#94a3b8' }

  if (day.mode === 'boss') {
    return {
      text: `👹 Boss · ${day.bossWordKeys.length} 词`,
      color: '#fbbf24',
    }
  }

  if (day.mode === 'review_only') {
    return {
      text: `复习熔断 · ${day.reviewWordKeys.length} 词`,
      color: '#f87171',
    }
  }

  const parts: string[] = []
  if (day.newWordKeys.length > 0) parts.push(`${day.newWordKeys.length} 新词`)
  if (day.reviewWordKeys.length > 0) parts.push(`${day.reviewWordKeys.length} 复习`)
  const base = parts.length > 0 ? parts.join(' · ') : '轻量日'
  const withQuestions =
    day.totalQuestions > 0 ? `${base} · 约 ${day.totalQuestions} 题` : base

  return { text: withQuestions, color: '#93c5fd' }
}

function motivationalTagline(mastered: number, total: number, projectedFinish: string | null): string {
  if (total <= 0) return '暂无单词'
  if (mastered >= total) return '🎉 全部毕业，计划通关！'
  if (mastered === 0) {
    return projectedFinish
      ? `今日起步，按全对节奏预计 ${formatShortDate(projectedFinish)} 通关`
      : '今日练起，踏上通关之旅'
  }
  const remaining = total - mastered
  return projectedFinish
    ? `还差 ${remaining} 词，预计 ${formatShortDate(projectedFinish)} 通关`
    : `还差 ${remaining} 词，继续加油`
}

function buildOverviewStats(
  rows: AdaptivePlanWordProgress[],
  plan: AdaptiveWordPlan,
  simulation: SimulateAdaptivePlanResult,
): OverviewStat[] {
  const total = rows.length
  const firstDay = simulation.days[0]
  const lastDay = simulation.days.at(-1)
  const firstBossDay = simulation.days.find((day) => day.mode === 'boss')
  const todayTask = firstDayTaskLabel(firstDay)

  const projectedDays = simulation.days.length
  const projectedFinish = lastDay?.date ?? null

  const bossEnabled = plan.bossEveryNNew > 0
  const milestoneStat: OverviewStat = bossEnabled && firstBossDay
    ? {
        label: '首个 Boss 日',
        value: `D${firstBossDay.dayIndex}`,
        color: '#fbbf24',
        hint: formatShortDate(firstBossDay.date),
      }
    : {
        label: '预计通关',
        value: projectedFinish ? formatShortDate(projectedFinish) : '—',
        color: '#f0abfc',
        hint: projectedDays > 0 ? `${projectedDays} 个学习日` : undefined,
      }

  return [
    {
      label: '计划总词',
      value: String(total),
      color: '#e2e8f0',
      hint: total > 0 ? '本计划范围' : undefined,
    },
    {
      label: '首日任务',
      value: todayTask.text,
      color: todayTask.color,
      hint: firstDay ? formatShortDate(firstDay.date) : '暂无排程',
      compactValue: true,
    },
    {
      label: '预计学习日',
      value: projectedDays > 0 ? String(projectedDays) : '—',
      color: '#c4b5fd',
      hint: '每天练且全对',
    },
    milestoneStat,
  ]
}

export default function AdaptivePlanPreviewOverview({
  rows,
  plan,
  simulation,
}: AdaptivePlanPreviewOverviewProps) {
  const total = rows.length
  const mastered = rows.filter((row) => row.status === 'MASTERED').length
  const learning = rows.filter((row) => row.status === 'LEARNING').length
  const pending = rows.filter((row) => row.status === 'LEARNING_PENDING').length
  const notStarted = rows.filter((row) => row.status === 'NOT_STARTED').length
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0

  const lastDay = simulation.days.at(-1)
  const projectedFinish = lastDay?.date ?? null
  const tagline = motivationalTagline(mastered, total, projectedFinish)
  const stats = buildOverviewStats(rows, plan, simulation)

  const segments = [
    { count: mastered, className: 'bg-gradient-to-r from-[#22c55e] to-[#86efac]' },
    { count: learning, className: 'bg-gradient-to-r from-[#60a5fa] to-[#a78bfa]' },
    { count: pending, className: 'bg-gradient-to-r from-[#f59e0b] to-[#fbbf24]' },
    { count: notStarted, className: 'bg-white/12' },
  ]

  const headline =
    total > 0 ? (
      <>
        <span className="text-[#86efac]">{mastered}</span>
        <span className="text-white/35"> / </span>
        <span>{total}</span>
        <span className="ml-2 text-[.95rem] font-bold text-[var(--wm-text-dim)]">
          已毕业{pct > 0 ? ` · ${pct}%` : ''}
        </span>
      </>
    ) : (
      '暂无单词'
    )

  return (
    <div className="rounded-[18px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[.68rem] font-extrabold tracking-[.16em] text-[var(--wm-text-dim)] uppercase">
            计划概览
          </div>
          <div className="font-fredoka text-xl text-[var(--wm-text)]">{headline}</div>
          <div className="mt-1 text-[.75rem] font-bold leading-relaxed text-[var(--wm-text-dim)]">
            {tagline}
          </div>
        </div>
        {learning > 0 && (
          <div className="rounded-full border border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.08)] px-3 py-1 text-[.72rem] font-extrabold text-[#93c5fd]">
            {learning} 词在学
          </div>
        )}
      </div>

      <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-white/[.06]">
        {segments.map((segment, index) => {
          if (segment.count <= 0 || total <= 0) return null
          return (
            <div
              key={index}
              className={segment.className}
              style={{ width: `${(segment.count / total) * 100}%` }}
            />
          )
        })}
      </div>

      <AdaptivePlanStageRoadmap rows={rows} className="mb-4" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2.5"
          >
            <div className="text-[.65rem] font-extrabold text-[var(--wm-text-dim)]">
              {stat.label}
            </div>
            <div
              className={
                stat.compactValue
                  ? 'mt-0.5 text-[.78rem] font-extrabold leading-snug'
                  : 'mt-0.5 font-fredoka text-lg leading-tight'
              }
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
            {stat.hint && (
              <div className="mt-1 text-[.62rem] font-bold text-white/35">{stat.hint}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
