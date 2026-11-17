'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth, type CalcTimingMode, type MixedOp } from '@rosie/core'
import { SelectControl, Target } from '@rosie/ui'
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
} from '../utils/calc-planned-question-count'
import CalcStartPanel from '../components/CalcStartPanel'
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

function compactMixedLabel(operation: MixedOp, name: string, label: string): string {
  const labels = operation.blockIds.flatMap(id => {
    const block = blockById(id)
    return block ? [block.label] : []
  })
  if (label !== `${name} · ${labels.join('+')}`) return label

  const uniqueLabels = [...new Set(labels)]
  if (operation.skeleton === 'as') {
    const ranges = uniqueLabels.flatMap(item => {
      const carry = /^(\d+) 以内进位$/.exec(item)
      return carry ? [carry[1]] : []
    })
    if (ranges.length && ranges.length * 2 === uniqueLabels.length &&
        ranges.every(range => uniqueLabels.includes(`${range} 以内退位`))) {
      return `${name} · ${ranges.join('/')} 以内进退位`
    }
  }

  const shortLabel = `${name} · ${uniqueLabels.join('+')}`
  return shortLabel.length <= 28 ? shortLabel : `${name} · ${labels.length} 种题型`
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
  const tierItems: (TierTargetItem & { key: string; shortLabel?: string })[] = [
    ...settings.selectedBlocks.map(({ id }) => {
      const block = blockById(id)
      const label = block?.label ?? id
      const group = block && GROUP_LABEL[block.group]
      return {
        key: `block:${id}`,
        label: group && !label.includes(group) ? `${group}·${label}` : label,
        targetId: id,
        kind: 'block' as const,
      }
    }),
    ...enabledMixed.map(operation => {
      const name = skeletonMeta(operation.skeleton).label
      const label = operation.label ?? name
      return {
        key: `mixed:${operation.id}`,
        label,
        shortLabel: compactMixedLabel(operation, name, label),
        targetId: operation.skeleton,
        kind: 'mixed' as const,
      }
    }),
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
  const stats = [
    { label: '今日', value: todayProblems, unit: `/${todayTarget}`, hint: `正确率 ${todayAccuracy}%`, progress: todayProgressPct },
    { label: '本周', value: weekProblems, unit: '题' },
    { label: '本月', value: monthProblems, unit: '题', hint: `今年 ${yearProblems} 题` },
    { label: '累计', value: totalProblems, unit: '题', hint: `练习 ${practiceDays} 天` },
  ]

  return (
    <>
      <CalcAppHeader />

      <main className="relative mx-auto max-w-[640px] space-y-5 px-4 pt-5 pb-12">
        <Link
          href="/calc/report"
          className="block rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-cyan-100">我的口算进度</div>
              <div className="mt-1 text-xs text-slate-400">
                核心算式已覆盖 {coverageDone}/{coverageTotal}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <div className="text-xl font-black text-cyan-300">{coveragePct}%</div>
              <span className="text-xs font-semibold text-cyan-200">查看报告 <span aria-hidden="true">→</span></span>
            </div>
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
        <section aria-label="本次口算策略" className="rounded-2xl border border-violet-500/[0.22] bg-violet-500/[0.08] px-5 py-3">
          <div className="flex items-start justify-between gap-3">
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
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#2e2a4f] bg-[#1e1b38] px-[18px] text-xs font-bold whitespace-nowrap text-violet-200 transition-colors hover:border-violet-300/45 hover:bg-[#272344] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 motion-reduce:transition-none"
              >
                <Target aria-hidden="true" className="size-4 shrink-0 text-violet-300" />
                档位标准
              </button>
            )}
          </div>
        </section>

        {/* Per-session count + CTA. This does not persist over the parent-owned setting. */}
        <CalcStartPanel totalQuestions={totalQuestions} currentSessionCount={currentSessionCount} expandedSessionCount={expandedSessionCount}
          currentTimingMode={currentTimingMode} currentBonusSec={currentBonusSec} setSessionCount={setSessionCount}
          setSessionTimingMode={setSessionTimingMode} setSessionBonusSec={setSessionBonusSec} handleStart={handleStart} />

        <section
          aria-label="题型明细和练习统计"
          className="rounded-2xl p-5"
          style={{
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.22)',
            boxShadow: '0 3px 0 rgba(139,92,246,.3)',
          }}
        >
          {tierItems.length > 0 && (
            <ul aria-label="当前策略题型" className="mb-5 flex flex-wrap gap-1.5">
              {tierItems.map(({ key, label, shortLabel }) => (
                <li key={key} title={label} className="max-w-[min(100%,20rem)] truncate rounded-md bg-[#1e1b38] px-2 py-1 text-xs text-violet-200/75">
                  {shortLabel ?? label}
                </li>
              ))}
            </ul>
          )}

          <dl className="grid auto-rows-fr grid-cols-2 gap-3">
            {stats.map(({ label, value, unit, hint, progress }) => (
              <div key={label} className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                <dt className="text-xs font-bold text-violet-200/75">{label}</dt>
                <dd className="mt-1">
                  <div className="flex flex-wrap items-baseline gap-x-1 font-fredoka text-[22px] leading-none font-black tabular-nums text-violet-50">
                    <span>{value}</span>
                    <span className="text-xs font-semibold text-violet-200/65">{unit}</span>
                  </div>
                  {hint && <div className="mt-1.5 text-xs text-violet-200/70">{hint}</div>}
                  {progress !== undefined && (
                    <div role="progressbar" aria-label="今日口算目标完成率" aria-valuenow={progress}
                      className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.14]">
                      <div className="h-full rounded-full bg-violet-600 transition-[width] duration-700 motion-reduce:transition-none"
                        style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </dd>
              </div>
            ))}
          </dl>
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
              <div className="truncate text-xs text-amber-200/80">
                {unresolvedMistakes.length > 0
                  ? `${unresolvedMistakes.length} 题待掌握`
                  : '暂无错题'}
              </div>
            </div>
            <span aria-hidden="true" className="text-amber-200/75">→</span>
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
              <div className="truncate text-xs text-pink-200/80">
                去兑换
              </div>
            </div>
            <span aria-hidden="true" className="text-pink-200/75">→</span>
          </Link>
        </div>

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
            <div className="truncate text-xs text-violet-200/80">
              题目怎么来 · 快慢怎么算 · 错题与掌握
            </div>
          </div>
          <span aria-hidden="true" className="text-violet-200/75">→</span>
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
              <div className="truncate text-xs text-violet-200/80">
                {recentOpen ? '点击收起' : '点击查看近期记录'}
              </div>
            </div>
            <span className="text-violet-200/75" aria-hidden>
              {recentOpen ? '▾' : '→'}
            </span>
          </button>
          {recentOpen && (
            <div
              className="space-y-1.5 px-3 pt-2.5 pb-3"
              style={{ borderTop: '1px solid rgba(167,139,250,0.12)' }}
            >
              {sessionsRequested && !wallet.sessionsReady && !wallet.sessionsFailed && (
                <div className="px-1 py-2 text-xs text-violet-200/80">
                  加载中…
                </div>
              )}
              {wallet.sessionsFailed && (
                <div className="px-1 py-2 text-[12px]" style={{ color: 'rgba(251,191,36,0.7)' }}>
                  加载失败，刷新页面后重试
                </div>
              )}
              {wallet.sessionsReady && wallet.sessions.length === 0 && (
                <div className="px-1 py-2 text-xs text-violet-200/80">
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
                    <span className="text-violet-100/80">
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
