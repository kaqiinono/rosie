'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth, type CalcTimingMode } from '@rosie/core'
import { SelectControl } from '@rosie/ui'
import { useCalcSettings, useCalcStrategies } from '../hooks/useCalcSettings'
import { useCalcPracticeStats } from '../hooks/useCalcPracticeStats'
import { useCalcWallet } from '@rosie/rewards'
import { useCalcMistakes } from '../hooks/useCalcMistakes'
import CalcAppHeader from '../components/CalcAppHeader'
import SessionSummary from '../components/SessionSummary'
import TierTargetsSheet, { type TierTargetItem } from '../components/TierTargetsSheet'
import { playSfx } from '../components/audio'
import { BLOCK_GROUPS, blockById } from '../utils/calc-blocks'
import { skeletonMeta } from '../utils/calc-mixed'
import { buildSessionSummaryProps } from '../utils/calc-session-summary'
import {
  calcPlannedQuestionCount,
  calcExpandedQuestionCount,
  clampSessionQuestionCount,
  MAX_SESSION_QUESTION_COUNT,
} from '../utils/calc-planned-question-count'
import CustomCountInput, { COUNT_OPTIONS } from '../components/CustomCountInput'
import SessionTimingControls from '../components/SessionTimingControls'
import { useCalcProblemState } from '../hooks/useCalcProblemState'
import { calculateAllCoverage } from '../utils/calc-coverage'
import { calculateAllStructureCoverage } from '../utils/calc-structure-coverage'
import { calculateRuleCoverage } from '../utils/calc-rule-coverage'
import {
  evaluateBlockProgression,
  blockTierFromProgression,
  type BlockTier,
} from '../utils/calc-progression'

const GROUP_LABEL = Object.fromEntries(BLOCK_GROUPS.map((g) => [g.group, g.label])) as Record<
  string,
  string
>

const TIER_CHIP: Record<BlockTier, { label: string; className: string }> = {
  auto: { label: '自动化', className: 'bg-violet-400/15 text-violet-200' },
  fluent: { label: '熟练', className: 'bg-cyan-400/15 text-cyan-200' },
  stable: { label: '稳固', className: 'bg-emerald-400/15 text-emerald-200' },
  entry: { label: '起步', className: 'bg-slate-400/15 text-slate-300' },
}

export default function CalcHomePage() {
  const { user } = useAuth()
  const router = useRouter()
  const { settings: defaultSettings, isLoading: settingsLoading } = useCalcSettings(user)
  const { strategies, isLoading: strategiesLoading } = useCalcStrategies(user)
  const {
    totalProblems,
    practiceDays,
    weekProblems,
    monthProblems,
    yearProblems,
    todayProblems,
    todayCorrect,
    isLoading: practiceStatsLoading,
  } = useCalcPracticeStats(user)
  const { unresolved: unresolvedMistakes } = useCalcMistakes(user)
  const { states: problemStates } = useCalcProblemState(user)

  const [recentOpen, setRecentOpen] = useState(false)
  const [sessionsRequested, setSessionsRequested] = useState(false)
  const [selectedRecentIdx, setSelectedRecentIdx] = useState<number | null>(null)
  const [tierSheetOpen, setTierSheetOpen] = useState(false)
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [sessionTimingMode, setSessionTimingMode] = useState<CalcTimingMode | null>(null)
  const [sessionBonusSec, setSessionBonusSec] = useState<number | null>(null)
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null)
  const wallet = useCalcWallet(user, { loadSessions: sessionsRequested })

  const defaultStrategy = strategies.find((strategy) => strategy.isActive) ?? null
  const selectedStrategy =
    strategies.find((strategy) => strategy.id === selectedStrategyId) ?? defaultStrategy
  const settings = selectedStrategy?.settings ?? defaultSettings

  const recentSessions = wallet.sessionsReady ? wallet.sessions.slice(0, 5) : []
  let selectedSummary: ReturnType<typeof buildSessionSummaryProps> | null = null
  if (selectedRecentIdx != null && recentSessions[selectedRecentIdx]) {
    const mixedLabels = new Map<string, string>()
    for (const op of settings.mixedOps) {
      mixedLabels.set(op.id, op.label ?? skeletonMeta(op.skeleton).label)
    }
    selectedSummary = buildSessionSummaryProps(
      recentSessions[selectedRecentIdx],
      recentSessions[selectedRecentIdx + 1] ?? null,
      { mixedLabels },
    )
  }

  const handleToggleRecent = () => {
    setRecentOpen((o) => !o)
    setSessionsRequested(true) // sticky for page lifetime
  }

  const blockCount = settings.selectedBlocks.length
  const enabledMixed = settings.mixedOps.filter((m) => m.enabled)
  const mixedCount = enabledMixed.length
  const selectedBlockLabels = settings.selectedBlocks.map((b) => {
    const block = blockById(b.id)
    if (!block) return b.id
    const group = GROUP_LABEL[block.group]
    // Labels like「10 以内」repeat across ops — prefix with 加/减/…
    return group && !block.label.includes(group) ? `${group}·${block.label}` : block.label
  })
  const selectedMixedLabels = enabledMixed.map((m) => m.label ?? skeletonMeta(m.skeleton).label)
  const tierItems: TierTargetItem[] = [
    ...settings.selectedBlocks.map((b, i) => ({
      label: selectedBlockLabels[i],
      targetId: b.id,
      kind: 'block' as const,
    })),
    ...enabledMixed.map((m, i) => ({
      label: selectedMixedLabels[i],
      targetId: m.skeleton,
      kind: 'mixed' as const,
    })),
  ]
  const totalQuestions = calcPlannedQuestionCount(settings)
  const currentSessionCount = sessionCount ?? totalQuestions
  const expandedSessionCount = calcExpandedQuestionCount(settings, currentSessionCount)
  const currentTimingMode = sessionTimingMode ?? settings.timingMode
  const currentBonusSec = sessionBonusSec ?? settings.bonusSec

  const todayTarget = totalQuestions

  const todayProgressPct =
    todayTarget > 0 ? Math.min(100, Math.round((todayProblems / todayTarget) * 100)) : 0
  const coverageSummary = calculateAllCoverage(problemStates)
  const coverageTotal = coverageSummary.reduce((sum, item) => sum + item.total, 0)
  const coverageDone = coverageSummary.reduce((sum, item) => sum + item.covered, 0)
  const coveragePct = coverageTotal > 0 ? Math.round((coverageDone / coverageTotal) * 100) : 0
  const structureSummary = calculateAllStructureCoverage(problemStates, settings.mixedOps)
  const structureTotal = structureSummary.reduce((sum, item) => sum + item.total, 0)
  const structureDone = structureSummary.reduce((sum, item) => sum + item.covered, 0)
  const ruleSummary = calculateRuleCoverage(problemStates)
  const ruleTotal = ruleSummary.reduce((sum, item) => sum + item.target, 0)
  const ruleDone = ruleSummary.reduce((sum, item) => sum + item.covered, 0)
  const tierCounts: Record<BlockTier, number> = { entry: 0, stable: 0, fluent: 0, auto: 0 }
  for (const sel of settings.selectedBlocks) {
    tierCounts[blockTierFromProgression(evaluateBlockProgression(sel.id, problemStates))]++
  }

  const handleStart = () => {
    playSfx('coin', settings.soundEnabled)
    const query = new URLSearchParams({
      mode: 'daily',
      start: '1',
      count: String(currentSessionCount),
      timing: currentTimingMode,
      bonus: String(currentBonusSec),
    })
    if (selectedStrategy) query.set('strategy', selectedStrategy.id)
    router.push(`/calc/session?${query.toString()}`)
  }

  if (settingsLoading || strategiesLoading || practiceStatsLoading) {
    return (
      <>
        <CalcAppHeader />
        <div
          className="mx-auto max-w-[640px] px-4 py-10 text-center text-[13px]"
          style={{ color: 'rgba(196,181,253,0.5)' }}
        >
          加载中…
        </div>
      </>
    )
  }

  const todayAccuracy = todayProblems > 0 ? Math.round((todayCorrect / todayProblems) * 100) : 0

  return (
    <>
      <CalcAppHeader />

      <main className="relative mx-auto max-w-[640px] space-y-5 px-4 pt-5 pb-12">
        <Link
          href="/calc/report"
          className="block rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-cyan-100">我的口算进度</div>
              <div className="mt-1 text-xs text-slate-400">
                核心算式已覆盖 {coverageDone}/{coverageTotal}
              </div>
            </div>
            <div className="text-xl font-black text-cyan-300">{coveragePct}%</div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${coveragePct}%` }} />
          </div>
          {(structureTotal > 0 || ruleTotal > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              {structureTotal > 0 && (
                <span>
                  结构覆盖{' '}
                  <span className="font-bold text-slate-300 tabular-nums">
                    {structureDone}/{structureTotal}
                  </span>
                </span>
              )}
              {ruleTotal > 0 && (
                <span>
                  规则覆盖{' '}
                  <span className="font-bold text-slate-300 tabular-nums">
                    {ruleDone}/{ruleTotal}
                  </span>
                </span>
              )}
            </div>
          )}
          {settings.selectedBlocks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(['auto', 'fluent', 'stable', 'entry'] as const).map((tier) =>
                tierCounts[tier] > 0 ? (
                  <span
                    key={tier}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TIER_CHIP[tier].className}`}
                  >
                    {TIER_CHIP[tier].label} ×{tierCounts[tier]}
                  </span>
                ) : null,
              )}
            </div>
          )}
        </Link>
        {/* Level + Stats card */}
        <section
          className="rounded-2xl p-5"
          style={{
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.22)',
            boxShadow: '0 4px 24px rgba(139,92,246,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {strategies.length > 0 ? (
                <SelectControl
                  value={selectedStrategy?.id ?? ''}
                  options={strategies.map((strategy) => ({
                    value: strategy.id,
                    label: `${strategy.name}${strategy.isActive ? '（默认）' : ''}`,
                  }))}
                  onValueChange={(value) => {
                    setSelectedStrategyId(value)
                    setSessionCount(null)
                    setSessionTimingMode(null)
                    setSessionBonusSec(null)
                  }}
                  ariaLabel="选择本次口算策略"
                  appearance="violet-dark"
                  className="w-full"
                  selectClassName="w-full"
                />
              ) : (
                <div className="text-[16px] font-black text-violet-100">内置默认策略</div>
              )}
              <div className="mt-1.5 text-[11px] font-semibold text-violet-200/50">
                {blockCount} 种单运算
                {mixedCount > 0 ? ` · ${mixedCount} 种混合运算` : ''}
                {strategies.length > 1 ? ' · 切换仅本次有效' : ''}
              </div>
            </div>
            {tierItems.length > 0 && (
              <button
                type="button"
                onClick={() => setTierSheetOpen(true)}
                className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-[11px] font-extrabold transition-all active:scale-95"
                style={{
                  background: 'rgba(139,92,246,0.14)',
                  border: '1px solid rgba(139,92,246,0.35)',
                  color: '#c4b5fd',
                }}
              >
                🎯 档位标准
              </button>
            )}
          </div>

          {(selectedBlockLabels.length > 0 || selectedMixedLabels.length > 0) && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {selectedBlockLabels.map((label, i) => (
                <span
                  key={`b-${settings.selectedBlocks[i].id}`}
                  className="rounded-md px-2 py-1 text-[10px] leading-none font-extrabold"
                  style={{
                    background: 'rgba(139,92,246,0.16)',
                    border: '1px solid rgba(139,92,246,0.35)',
                    color: '#c4b5fd',
                  }}
                >
                  {label}
                </span>
              ))}
              {selectedMixedLabels.map((label, i) => (
                <span
                  key={`m-${enabledMixed[i].id}`}
                  className="rounded-md px-2 py-1 text-[10px] leading-none font-extrabold"
                  style={{
                    background: 'rgba(236,72,153,0.12)',
                    border: '1px solid rgba(236,72,153,0.3)',
                    color: '#f0abfc',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl px-3 py-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="mb-1 text-[10px] font-bold tracking-wider uppercase"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                今日
              </div>
              <div
                className="font-fredoka text-[22px] leading-none font-black"
                style={{ color: '#f5f3ff' }}
              >
                {todayProblems}
                <span
                  className="ml-0.5 text-[12px] font-semibold"
                  style={{ color: 'rgba(245,243,255,0.35)' }}
                >
                  /{todayTarget}
                </span>
              </div>
              <div
                className="mt-1 mb-1.5 text-[10px] font-medium"
                style={{ color: 'rgba(196,181,253,0.5)' }}
              >
                正确率 {todayAccuracy}%
              </div>
              <div
                className="h-1 overflow-hidden rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${todayProgressPct}%`,
                    background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                    boxShadow: '0 0 8px rgba(139,92,246,0.6)',
                  }}
                />
              </div>
            </div>

            <div
              className="rounded-xl px-3 py-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="mb-1 text-[10px] font-bold tracking-wider uppercase"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                本周
              </div>
              <div
                className="font-fredoka text-[22px] leading-none font-black"
                style={{ color: '#f5f3ff' }}
              >
                {weekProblems}
                <span
                  className="ml-0.5 text-[13px] font-semibold"
                  style={{ color: 'rgba(245,243,255,0.35)' }}
                >
                  题
                </span>
              </div>
            </div>

            <div
              className="rounded-xl px-3 py-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="mb-1 text-[10px] font-bold tracking-wider uppercase"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                本月
              </div>
              <div
                className="font-fredoka text-[22px] leading-none font-black"
                style={{ color: '#f5f3ff' }}
              >
                {monthProblems}
                <span
                  className="ml-0.5 text-[12px] font-semibold"
                  style={{ color: 'rgba(245,243,255,0.35)' }}
                >
                  /{yearProblems}
                </span>
              </div>
              <div
                className="mt-1 text-[10px] font-medium"
                style={{ color: 'rgba(196,181,253,0.5)' }}
              >
                月 / 年
              </div>
            </div>

            <div
              className="rounded-xl px-3 py-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="mb-1 text-[10px] font-bold tracking-wider uppercase"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                累计
              </div>
              <div
                className="font-fredoka text-[22px] leading-none font-black"
                style={{ color: '#f5f3ff' }}
              >
                {totalProblems}
                <span
                  className="ml-0.5 text-[13px] font-semibold"
                  style={{ color: 'rgba(245,243,255,0.35)' }}
                >
                  题
                </span>
              </div>
              <div
                className="mt-1 text-[10px] font-medium"
                style={{ color: 'rgba(196,181,253,0.5)' }}
              >
                练习 {practiceDays} 天
              </div>
            </div>
          </div>
        </section>

        {/* Per-session count + CTA. This does not persist over the parent-owned setting. */}
        <section className="rounded-2xl border border-violet-300/20 bg-violet-400/[0.07] p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-extrabold text-violet-100">本次目标题量</h2>
              <p className="mt-0.5 text-[11px] text-violet-200/50">
                默认使用口算配置中的 {totalQuestions} 题，仅本次有效
              </p>
            </div>
            <span className="shrink-0 text-lg font-black text-violet-300 tabular-nums">
              {currentSessionCount} 题
            </span>
          </div>
          <div className="mb-3 flex flex-wrap gap-2" aria-label="选择本次练习题量">
            {COUNT_OPTIONS.map((count) => {
              const selected = currentSessionCount === count
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setSessionCount(count)}
                  aria-pressed={selected}
                  className="min-h-11 min-w-11 rounded-xl px-3 text-[13px] font-extrabold tabular-nums transition-all active:scale-95"
                  style={{
                    background: selected ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${selected ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    color: selected ? '#c4b5fd' : 'rgba(196,181,253,0.6)',
                  }}
                >
                  {count}
                </button>
              )
            })}
            <CustomCountInput
              count={currentSessionCount}
              onChange={(count) => setSessionCount(clampSessionQuestionCount(count))}
              max={MAX_SESSION_QUESTION_COUNT}
              size="md"
            />
          </div>
          <div className="mb-4 border-t border-white/10 pt-3">
            <SessionTimingControls
              timingMode={currentTimingMode}
              bonusSec={currentBonusSec}
              onChangeMode={setSessionTimingMode}
              onChangeBonus={setSessionBonusSec}
            />
          </div>
          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-2xl px-5 py-4 text-[17px] font-black text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #d946ef 100%)',
              boxShadow: '0 6px 28px rgba(139,92,246,0.45), 0 1px 0 rgba(255,255,255,0.12) inset',
            }}
          >
            🚀 开始口算 · 预计 {expandedSessionCount} 题 →
          </button>
        </section>

        {/* Secondary entries */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/calc/mistakes"
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 no-underline transition-all"
            style={{
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <span className="text-xl">📝</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-extrabold" style={{ color: '#fbbf24' }}>
                错题本
              </div>
              <div className="truncate text-[11px]" style={{ color: 'rgba(251,191,36,0.55)' }}>
                {unresolvedMistakes.length > 0
                  ? `${unresolvedMistakes.length} 题待掌握`
                  : '暂无错题'}
              </div>
            </div>
            <span style={{ color: 'rgba(251,191,36,0.5)' }}>→</span>
          </Link>
          <Link
            href="/vouchers"
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 no-underline transition-all"
            style={{
              background: 'rgba(236,72,153,0.07)',
              border: '1px solid rgba(236,72,153,0.2)',
            }}
          >
            <span className="text-xl">🎁</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-extrabold" style={{ color: '#f9a8d4' }}>
                我的奖券
              </div>
              <div className="truncate text-[11px]" style={{ color: 'rgba(249,168,212,0.55)' }}>
                去兑换
              </div>
            </div>
            <span style={{ color: 'rgba(249,168,212,0.5)' }}>→</span>
          </Link>
        </div>

        <Link
          href="/calc/report"
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3 no-underline transition-all"
          style={{
            background: 'rgba(125,211,252,0.06)',
            border: '1px solid rgba(125,211,252,0.18)',
          }}
        >
          <span className="text-xl">📊</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-extrabold" style={{ color: '#7dd3fc' }}>
              练习报告
            </div>
            <div className="truncate text-[11px]" style={{ color: 'rgba(125,211,252,0.55)' }}>
              查看关卡进度 · 最弱题 · 关键事件
            </div>
          </div>
          <span style={{ color: 'rgba(125,211,252,0.5)' }}>→</span>
        </Link>

        <Link
          href="/calc/faq"
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3 no-underline transition-all"
          style={{
            background: 'rgba(167,139,250,0.06)',
            border: '1px solid rgba(167,139,250,0.18)',
          }}
        >
          <span className="text-xl">📖</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-extrabold" style={{ color: '#c4b5fd' }}>
              口算说明
            </div>
            <div className="truncate text-[11px]" style={{ color: 'rgba(196,181,253,0.55)' }}>
              题目怎么来 · 快慢怎么算 · 错题与掌握
            </div>
          </div>
          <span style={{ color: 'rgba(196,181,253,0.5)' }}>→</span>
        </Link>

        {/* Recent sessions — card toggle; sessions load on first expand only */}
        <section
          className="overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(167,139,250,0.06)',
            border: '1px solid rgba(167,139,250,0.18)',
          }}
        >
          <button
            type="button"
            onClick={handleToggleRecent}
            aria-expanded={recentOpen}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-all"
          >
            <span className="text-xl" aria-hidden>
              🕐
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-extrabold" style={{ color: '#c4b5fd' }}>
                最近练习
              </div>
              <div className="truncate text-[11px]" style={{ color: 'rgba(196,181,253,0.55)' }}>
                {recentOpen ? '点击收起' : '点击查看近期记录'}
              </div>
            </div>
            <span style={{ color: 'rgba(196,181,253,0.5)' }} aria-hidden>
              {recentOpen ? '▾' : '→'}
            </span>
          </button>
          {recentOpen && (
            <div
              className="space-y-1.5 px-3 pt-2.5 pb-3"
              style={{ borderTop: '1px solid rgba(167,139,250,0.12)' }}
            >
              {sessionsRequested && !wallet.sessionsReady && !wallet.sessionsFailed && (
                <div className="px-1 py-2 text-[12px]" style={{ color: 'rgba(196,181,253,0.45)' }}>
                  加载中…
                </div>
              )}
              {wallet.sessionsFailed && (
                <div className="px-1 py-2 text-[12px]" style={{ color: 'rgba(251,191,36,0.7)' }}>
                  加载失败，刷新页面后重试
                </div>
              )}
              {wallet.sessionsReady && wallet.sessions.length === 0 && (
                <div className="px-1 py-2 text-[12px]" style={{ color: 'rgba(196,181,253,0.45)' }}>
                  暂无练习记录
                </div>
              )}
              {wallet.sessionsReady &&
                recentSessions.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedRecentIdx(i)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <span className="font-semibold tabular-nums" style={{ color: '#a78bfa' }}>
                      {s.date.slice(5).replace('-', '/')}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                    <span style={{ color: 'rgba(245,243,255,0.45)' }}>
                      {s.count} 题 {s.correctCount + s.retryCount} 对
                    </span>
                    <span
                      className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums"
                      style={{
                        background: 'rgba(245,158,11,0.15)',
                        color: '#fbbf24',
                      }}
                    >
                      ⭐ +{s.coinsEarned}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </section>
      </main>

      {tierSheetOpen && (
        <TierTargetsSheet items={tierItems} onClose={() => setTierSheetOpen(false)} />
      )}

      {selectedSummary && (
        <SessionSummary
          {...selectedSummary}
          levelUpTo={null}
          levelDownTo={null}
          reviewMilestone={null}
          nextSessionAssault={false}
          onClose={() => setSelectedRecentIdx(null)}
          onAgain={() => {
            setSelectedRecentIdx(null)
            playSfx('coin', settings.soundEnabled)
            router.push('/calc/session?mode=daily')
          }}
        />
      )}
    </>
  )
}
