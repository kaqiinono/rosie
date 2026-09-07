'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@rosie/core'
import type { CalcSettings, CalcTimingMode } from '@rosie/core'
import {
  DEFAULT_CALC_SETTINGS,
  useCalcStrategies,
} from '../hooks/useCalcSettings'
import { clampBonusSec, sessionStarMultiplier } from '../utils/calc-session-policy'
import CalcAppHeader from '../components/CalcAppHeader'
import BlockPicker from '../components/BlockPicker'
import MixedOpList from '../components/MixedOpList'
import CalcConfigBar from '../components/CalcConfigBar'
import PerTypeTimeChips from '../components/PerTypeTimeChips'
import TierTargetsSheet, { type TierTargetItem } from '../components/TierTargetsSheet'
import { playSfx } from '../components/audio'
import { blocksByGroup, blockById, BLOCK_GROUPS, type CalcBlock } from '../utils/calc-blocks'
import { skeletonMeta, SKELETONS } from '../utils/calc-mixed'
import { calcPlannedQuestionCount } from '../utils/calc-planned-question-count'

interface PerTypeCardProps {
  label: string
  targetId: string
  count: number
  seconds: number | null
  /** 显示占比行（仅按占比分配模式；自动分配时只显示目标时间）。 */
  showCount: boolean
  /** 显示目标时间行（仅限时答题总开关打开时）。 */
  showSeconds: boolean
  /** 显示删除按钮（仅精准设置模式）。 */
  showDelete?: boolean
  onCount: (n: number) => void
  onSeconds: (s: number) => void
  onDelete?: () => void
}

const PERCENT_OPTIONS = [10, 20, 25, 30, 50]

// 每个选中题型一张卡：目标时间仅总开关打开时可设；占比仅在手动模式显示。
function PerTypeConfigCard({
  label,
  targetId,
  count,
  seconds,
  showCount,
  showSeconds,
  showDelete,
  onCount,
  onSeconds,
  onDelete,
}: PerTypeCardProps) {
  return (
    <div
      className="space-y-2 rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 text-[13px] font-extrabold" style={{ color: '#e9d5ff' }}>
          {label}
        </div>
        {showDelete && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`移除 ${label}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(248,113,113,0.75)' }}
          >
            🗑️
          </button>
        )}
      </div>
      {showCount && (
        <div className="flex flex-wrap items-center gap-1">
          <span
            className="mr-1 w-7 text-[10px] font-extrabold uppercase"
            style={{ color: 'rgba(196,181,253,0.5)' }}
          >
            占比
          </span>
          {PERCENT_OPTIONS.map((n) => {
            const on = count === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => onCount(n)}
                className="rounded-md px-2 py-0.5 text-[11px] font-extrabold tabular-nums transition-all active:scale-95"
                style={{
                  background: on ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${on ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  color: on ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
                }}
              >
                {n}%
              </button>
            )
          })}
          <label className="relative">
            <span className="sr-only">自定义占比</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={count}
              onChange={(event) => {
                const value = Math.min(100, Math.max(1, Math.floor(Number(event.target.value))))
                if (Number.isFinite(value)) onCount(value)
              }}
              className="w-16 rounded-md border border-violet-400/35 bg-white/[.04] py-0.5 pr-5 pl-2 text-right text-[11px] font-extrabold text-violet-200 outline-none focus:border-violet-400"
            />
            <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px] font-bold text-violet-200/45">%</span>
          </label>
        </div>
      )}
      {showSeconds && (
        <div className="flex items-start gap-1">
          <span
            className="mr-1 w-7 shrink-0 pt-1 text-[10px] font-extrabold uppercase"
            style={{ color: 'rgba(196,181,253,0.5)' }}
          >
            目标时间
          </span>
          <div className="min-w-0 flex-1">
            <PerTypeTimeChips targetId={targetId} value={seconds} onChange={onSeconds} />
          </div>
        </div>
      )}
    </div>
  )
}

interface ToggleRowProps {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-all"
      style={{
        background: value ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${value ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <div className="min-w-0">
        <div
          className="text-[14px] font-extrabold"
          style={{ color: value ? '#c4b5fd' : 'rgba(245,243,255,0.7)' }}
        >
          {label}
        </div>
        {description && (
          <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(245,243,255,0.35)' }}>
            {description}
          </div>
        )}
      </div>
      <span
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
        style={{ background: value ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? 'translateX(22px)' : 'translateX(4px)' }}
        />
      </span>
    </button>
  )
}

interface SectionHeadingProps {
  children: React.ReactNode
  suffix?: React.ReactNode
}

function SectionHeading({ children, suffix }: SectionHeadingProps) {
  return (
    <h2
      className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
      style={{ color: 'rgba(196,181,253,0.45)' }}
    >
      {children}
      {suffix}
    </h2>
  )
}

const MODE_META: Record<CalcTimingMode, { label: string; emoji: string; desc: string }> = {
  relaxed: { label: '宽松', emoji: '🌤️', desc: '不显示倒计时，按自己的节奏作答' },
  strict: { label: '严格', emoji: '⏱️', desc: '始终显示倒计时，超时算最终错误' },
  bonus: { label: '自定义加成', emoji: '➕', desc: '目标时间基础上多给几秒缓冲，超时算最终错误' },
}

const BONUS_PRESETS = [2, 3, 5]

function fmtMultiplier(m: number): string {
  const s = m.toFixed(2)
  return s.endsWith('0') ? s.slice(0, -1) : s
}

function starBonusLine(mode: CalcTimingMode, bonusSec: number): string {
  if (mode === 'relaxed') return '星星加成：无（×1.0）'
  if (mode === 'strict') return '星星加成：+20%（×1.2）'
  const multiplier = sessionStarMultiplier(mode, bonusSec)
  if (multiplier <= 1) return '星星加成：无额外加成（×1.0）'
  const pct = Math.round((multiplier - 1) * 100)
  return `星星加成：+${pct}%（×${fmtMultiplier(multiplier)}）`
}

interface TimingModeDefaultsProps {
  timingMode: CalcTimingMode
  bonusSec: number
  onChangeMode: (m: CalcTimingMode) => void
  onChangeBonus: (n: number) => void
}

function TimingModeDefaults({
  timingMode,
  bonusSec,
  onChangeMode,
  onChangeBonus,
}: TimingModeDefaultsProps) {
  const [customOpen, setCustomOpen] = useState(!BONUS_PRESETS.includes(bonusSec))

  return (
    <div className="space-y-2">
      {(Object.keys(MODE_META) as CalcTimingMode[]).map((m) => {
        const meta = MODE_META[m]
        const on = timingMode === m
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChangeMode(m)}
            className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-all active:scale-[0.99]"
            style={{
              background: on ? 'rgba(139,92,246,0.16)' : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${on ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            <span className="text-xl leading-none">{meta.emoji}</span>
            <div className="min-w-0 flex-1">
              <div
                className="text-[14px] font-extrabold"
                style={{ color: on ? '#c4b5fd' : 'rgba(245,243,255,0.7)' }}
              >
                {meta.label}
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(245,243,255,0.35)' }}>
                {meta.desc}
              </div>
            </div>
            {on && (
              <span className="mt-0.5 shrink-0 text-[13px]" style={{ color: '#c4b5fd' }}>
                ✓
              </span>
            )}
          </button>
        )
      })}

      {timingMode === 'bonus' && (
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
        >
          <span
            className="mr-1 text-[10px] font-extrabold uppercase"
            style={{ color: 'rgba(196,181,253,0.5)' }}
          >
            加成秒数
          </span>
          {BONUS_PRESETS.map((n) => {
            const on = !customOpen && bonusSec === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setCustomOpen(false)
                  onChangeBonus(clampBonusSec(n))
                }}
                className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all active:scale-95"
                style={{
                  background: on ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${on ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  color: on ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
                }}
              >
                +{n}秒
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all active:scale-95"
            style={{
              background: customOpen ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${customOpen ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
              color: customOpen ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
            }}
          >
            自定义
          </button>
          {customOpen && (
            <span className="inline-flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={15}
                value={bonusSec}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v)) onChangeBonus(clampBonusSec(v))
                }}
                className="w-14 rounded-md px-2 py-1 text-right text-[12px] font-extrabold tabular-nums"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  color: '#c4b5fd',
                  outline: 'none',
                }}
              />
              <span className="text-[10px]" style={{ color: 'rgba(245,243,255,0.4)' }}>
                秒（0–15）
              </span>
            </span>
          )}
        </div>
      )}

      <div
        className="flex items-center gap-2 rounded-xl px-4 py-3"
        style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}
      >
        <span className="text-[15px]">⭐</span>
        <span className="text-[12.5px] font-extrabold" style={{ color: '#fbbf24' }}>
          {starBonusLine(timingMode, bonusSec)}
        </span>
      </div>
    </div>
  )
}

export default function CalcSettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const pathSegment = pathname.split('/').filter(Boolean).at(-1)
  const strategyId = pathSegment === 'new' ? null : (pathSegment ?? null)
  const { strategies, createStrategy, saveStrategy, isLoading } = useCalcStrategies(user)
  const [settings, setSettings] = useState<CalcSettings>(() => ({
    ...DEFAULT_CALC_SETTINGS,
    selectedBlocks: DEFAULT_CALC_SETTINGS.selectedBlocks.map((block) => ({ ...block })),
    mixedOps: [],
  }))
  const [strategyName, setStrategyName] = useState('')
  const initializedForRef = useRef<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [tierSheetOpen, setTierSheetOpen] = useState(false)
  const configuredPercentageTotal =
    settings.selectedBlocks.reduce((sum, block) => sum + block.count, 0) +
    settings.mixedOps
      .filter((operation) => operation.enabled)
      .reduce((sum, operation) => sum + operation.count, 0)

  const strategy = strategyId ? strategies.find((item) => item.id === strategyId) : undefined

  useEffect(() => {
    if (isLoading) return
    const initializationKey = strategyId ?? 'new'
    if (initializedForRef.current === initializationKey) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      initializedForRef.current = initializationKey
      if (strategy) {
        setStrategyName(strategy.name)
        setSettings({
          ...strategy.settings,
          selectedBlocks: strategy.settings.selectedBlocks.map((block) => ({ ...block })),
          mixedOps: strategy.settings.mixedOps.map((mixed) => ({
            ...mixed,
            blockIds: [...mixed.blockIds],
          })),
        })
      } else {
        setStrategyName('')
        setSettings({
          ...DEFAULT_CALC_SETTINGS,
          selectedBlocks: DEFAULT_CALC_SETTINGS.selectedBlocks.map((block) => ({ ...block })),
          mixedOps: [],
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [isLoading, strategy, strategyId])

  const update = (patch: Partial<CalcSettings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }

  const handleSave = async () => {
    if (!strategyName.trim()) {
      setSaveError('请输入策略名称')
      return
    }
    if (settings.countMode === 'manual' && configuredPercentageTotal !== 100) {
      setSaveError(`各题型占比合计需要为 100%，当前为 ${configuredPercentageTotal}%`)
      return
    }
    setSaveError('')
    setSaved(false)
    try {
      if (strategyId) await saveStrategy(strategyId, strategyName, settings)
      else await createStrategy(strategyName, settings)
      setSaved(true)
      playSfx('coin', settings.soundEnabled)
      window.setTimeout(() => router.push('/setting/calc'), 450)
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : '保存失败，请稍后重试')
    }
  }

  const toggleBlock = (id: string) => {
    const exists = settings.selectedBlocks.some((b) => b.id === id)
    update({
      selectedBlocks: exists
        ? settings.selectedBlocks.filter((b) => b.id !== id)
        : [...settings.selectedBlocks, { id, count: 20, seconds: 0 }],
    })
  }

  const toggleGroup = (group: CalcBlock['group'], on: boolean) => {
    const ids = blocksByGroup(group).map((b) => b.id)
    const have = new Map(settings.selectedBlocks.map((b) => [b.id, b]))
    if (on)
      ids.forEach((i) => {
        if (!have.has(i)) have.set(i, { id: i, count: 20, seconds: 0 })
      })
    else ids.forEach((i) => have.delete(i))
    update({ selectedBlocks: [...have.values()] })
  }

  const patchBlock = (id: string, patch: Partial<(typeof settings.selectedBlocks)[number]>) => {
    update({
      selectedBlocks: settings.selectedBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })
  }

  const patchMixed = (id: string, patch: Partial<(typeof settings.mixedOps)[number]>) => {
    update({ mixedOps: settings.mixedOps.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  }

  const removeBlock = (id: string) => {
    update({ selectedBlocks: settings.selectedBlocks.filter((b) => b.id !== id) })
  }

  const disableMixed = (id: string) => {
    patchMixed(id, { enabled: false })
  }

  if (isLoading) {
    return (
      <>
        <CalcAppHeader title="策略设置" backHref="/setting/calc" backLabel="策略列表" />
        <div
          className="mx-auto max-w-[640px] px-4 py-10 text-center text-[13px]"
          style={{ color: 'rgba(196,181,253,0.4)' }}
        >
          加载中…
        </div>
      </>
    )
  }

  if (strategyId && !strategy) {
    return (
      <>
        <CalcAppHeader title="策略不存在" backHref="/setting/calc" backLabel="策略列表" />
        <main className="mx-auto max-w-[640px] px-4 py-12 text-center">
          <p className="text-sm text-violet-200/60">这条口算策略可能已被删除。</p>
          <Link href="/setting/calc" className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2 font-bold text-white">
            返回策略列表
          </Link>
        </main>
      </>
    )
  }

  const blockCount = settings.selectedBlocks.length

  const enabledMixed = settings.mixedOps.filter((m) => m.enabled)
  const totalQuestions = calcPlannedQuestionCount(settings)

  // 全量运算档位一览：按组排列所有单运算 + 混合骨架
  const allTierItems: TierTargetItem[] = [
    ...BLOCK_GROUPS.flatMap((g) =>
      blocksByGroup(g.group).map((b) => ({
        label: b.label,
        targetId: b.id,
        kind: 'block' as const,
        group: g.label,
      })),
    ),
    ...SKELETONS.map((s) => ({
      label: s.label,
      targetId: s.id,
      kind: 'mixed' as const,
      group: '混合运算',
    })),
  ]

  return (
    <>
      <CalcAppHeader
        title={strategyId ? '编辑口算策略' : '新增口算策略'}
        backHref="/setting/calc"
        backLabel="策略列表"
        rightExtra={
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/calc/report"
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-all active:scale-95"
              style={{
                background: 'rgba(34,211,238,0.12)',
                border: '1px solid rgba(34,211,238,0.32)',
                color: '#67e8f9',
              }}
            >
              📊 学习报告
            </Link>
            {/* 档位标准 — 全量运算四档建议耗时一览 */}
            <button
              type="button"
              onClick={() => setTierSheetOpen(true)}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-all active:scale-95"
              style={{
                background: 'rgba(139,92,246,0.14)',
                border: '1px solid rgba(139,92,246,0.35)',
                color: '#c4b5fd',
              }}
            >
              🎯 档位标准
            </button>
          </div>
        }
      />

      <main className="relative mx-auto max-w-[640px] space-y-5 px-4 pt-5 pb-12">
        <section>
          <SectionHeading>策略名称</SectionHeading>
          <label className="block">
            <span className="sr-only">策略名称</span>
            <input
              type="text"
              value={strategyName}
              maxLength={40}
              autoFocus={!strategyId}
              onChange={(event) => {
                setStrategyName(event.target.value)
                if (saveError) setSaveError('')
              }}
              placeholder="例如：工作日 20 题"
              className="h-12 w-full rounded-xl px-4 text-[15px] font-bold text-violet-50 outline-none transition-all placeholder:text-violet-200/25 focus:ring-2 focus:ring-violet-400/50"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(139,92,246,0.32)',
              }}
            />
          </label>
          <p className="mt-1.5 text-[11px] text-violet-200/35">名称会显示在策略列表中，最多 40 个字符。</p>
        </section>
        {/* 单运算 — multi-select building blocks */}
        <section>
          <SectionHeading
            suffix={
              <span
                className="ml-2 tracking-normal normal-case"
                style={{ color: 'rgba(196,181,253,0.3)' }}
              >
                · 已选 {blockCount} 种
              </span>
            }
          >
            单运算
          </SectionHeading>
          <BlockPicker
            selected={settings.selectedBlocks.map((b) => b.id)}
            onToggle={toggleBlock}
            onToggleGroup={toggleGroup}
          />
        </section>

        {/* 混合运算 */}
        <section>
          <SectionHeading>混合运算</SectionHeading>
          <MixedOpList
            mixedOps={settings.mixedOps}
            onChange={(next) => update({ mixedOps: next })}
          />
        </section>

        {/* 题型选项 */}
        <section>
          <SectionHeading>题型选项</SectionHeading>
          <div className="space-y-2">
            <ToggleRow
              label="包含逆运算（挖空）"
              description="部分单运算题以 48 + □ = 105 的形式出现，考察更深"
              value={settings.includeInverse}
              onChange={(v) => update({ includeInverse: v })}
            />
            <ToggleRow
              label="多位数题用竖式作答"
              description="竖式：千以内进位/退位加减、万以内加减、两·三位数×一位数（进位）、两位数×两位数、多位数÷一位数。100以内加减、千以内不进位/不退位、两·三位数×一位数不进位、凑整等仍用数字键盘"
              value={settings.verticalForBigNumbers}
              onChange={(v) => update({ verticalForBigNumbers: v })}
            />
            <ToggleRow
              label="限时答题"
              description="控制是否可编辑各题型目标时间；关闭后仍可用系统目标时间；宽松模式不显示倒计时"
              value={settings.timedAnswerEnabled}
              onChange={(v) => update({ timedAnswerEnabled: v })}
            />
            <ToggleRow
              label="沉浸模式"
              description="无答题反馈，提交后直接下一题；错题仍会在本轮末尾补练"
              value={settings.immersiveMode}
              onChange={(v) => update({ immersiveMode: v })}
            />
            <ToggleRow
              label="答对即过"
              description="数字键盘或竖式填满正确答案时无需点确认，直接进入下一题；答错仍需确认。分数/余数不受影响。"
              value={settings.autoSubmitOnMatch}
              onChange={(v) => update({ autoSubmitOnMatch: v })}
            />
            <ToggleRow
              label="允许自动扩展下一题型"
              description="达到覆盖、正确率和速度门槛后，可在已选范围外加入约20%的下一难度探索；关闭时只在已选题型内自适应。"
              value={settings.adaptiveExpansionEnabled}
              onChange={(v) => update({ adaptiveExpansionEnabled: v })}
            />
          </div>
        </section>

        {/* 默认计时模式 */}
        <section>
          <SectionHeading>默认计时模式</SectionHeading>
          <p
            className="mb-2 text-[11px] leading-relaxed"
            style={{ color: 'rgba(245,243,255,0.35)' }}
          >
            每次开始练习前可临时调整；此处设为预填默认值。
          </p>
          <TimingModeDefaults
            timingMode={settings.timingMode}
            bonusSec={settings.bonusSec}
            onChangeMode={(m) => update({ timingMode: m })}
            onChangeBonus={(n) => update({ bonusSec: clampBonusSec(n) })}
          />
        </section>

        {/* 题量模式 */}
        <section>
          <SectionHeading
            suffix={
              <span
                className="ml-2 tracking-normal normal-case"
                style={{ color: 'rgba(196,181,253,0.3)' }}
              >
                · 共 {totalQuestions} 题
              </span>
            }
          >
            题量
          </SectionHeading>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(['auto', 'manual'] as const).map((m) => {
              const on = settings.countMode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => update({ countMode: m })}
                  className="rounded-xl px-3 py-2.5 text-[12px] font-extrabold transition-all active:scale-[0.98]"
                  style={{
                    background: on ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${on ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    color: on ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
                  }}
                >
                {m === 'auto' ? '自适应分配' : '按占比分配'}
                </button>
              )
            })}
          </div>
          <p
            className="mb-3 text-[11px] leading-relaxed"
            style={{ color: 'rgba(245,243,255,0.38)' }}
          >
            {settings.countMode === 'auto'
              ? '只在已选择题型内，根据覆盖、薄弱和前置掌握自动调整比例；下一难度未准备好时仅少量探索。'
              : '按各题型占比分配本次总题量；不足 1 题的已启用题型按 1 题计算。'}
          </p>
          <CalcConfigBar
            count={settings.lastCount}
            onChange={(count) => update({ lastCount: count })}
          />

          {/* 每个题型的设置：目标时间仅总开关打开时可设；占比仅手动模式显示。 */}
          {(settings.timedAnswerEnabled || settings.countMode === 'manual') && (
            <div className="mt-3">
              <div
                className="mb-1.5 text-[10px] font-extrabold tracking-wider uppercase"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                {settings.countMode === 'manual'
                  ? settings.timedAnswerEnabled
                ? '每个题型的占比 · 目标时间'
                    : '每个题型的占比'
                  : '每个题型的目标时间'}
              </div>
              {settings.countMode === 'manual' && (
                <div
                  aria-live="polite"
                  className="sticky top-[60px] z-20 mb-2 flex items-center justify-between rounded-xl px-3 py-2.5 text-[11px] font-bold shadow-lg backdrop-blur-xl"
                  style={{
                    background:
                      configuredPercentageTotal === 100
                        ? 'rgba(13,35,31,0.96)'
                        : 'rgba(39,27,14,0.96)',
                    color: configuredPercentageTotal === 100 ? '#86efac' : '#fbbf24',
                    border: `1px solid ${
                      configuredPercentageTotal === 100
                        ? 'rgba(34,197,94,0.3)'
                        : 'rgba(251,191,36,0.32)'
                    }`,
                  }}
                >
                  <span>占比合计</span>
                  <span className="flex items-center gap-2">
                    <strong className="text-[15px] font-black tabular-nums">
                      {configuredPercentageTotal}%
                    </strong>
                    <span className="text-[10px] opacity-75">
                      {configuredPercentageTotal === 100
                        ? '已完成 ✓'
                        : configuredPercentageTotal < 100
                          ? `还差 ${100 - configuredPercentageTotal}%`
                          : `超出 ${configuredPercentageTotal - 100}%`}
                    </span>
                  </span>
                </div>
              )}
              {settings.selectedBlocks.length === 0 && enabledMixed.length === 0 ? (
                <div className="text-[11px]" style={{ color: 'rgba(196,181,253,0.45)' }}>
                  先在上方选择题型，这里会出现每个题型的设置。
                </div>
              ) : (
                <div className="space-y-2">
                  {settings.selectedBlocks.map((b) => (
                    <PerTypeConfigCard
                      key={b.id}
                      label={blockById(b.id)?.label ?? b.id}
                      targetId={b.id}
                      count={b.count}
                      seconds={b.seconds}
                      showCount={settings.countMode === 'manual'}
                      showSeconds={settings.timedAnswerEnabled}
                      showDelete={settings.countMode === 'manual'}
                      onCount={(n) => patchBlock(b.id, { count: n })}
                      onSeconds={(s) => patchBlock(b.id, { seconds: s })}
                      onDelete={() => removeBlock(b.id)}
                    />
                  ))}
                  {enabledMixed.map((m) => (
                    <PerTypeConfigCard
                      key={m.id}
                      label={m.label ?? skeletonMeta(m.skeleton).label}
                      targetId={m.skeleton}
                      count={m.count}
                      seconds={m.seconds}
                      showCount={settings.countMode === 'manual'}
                      showSeconds={settings.timedAnswerEnabled}
                      showDelete={settings.countMode === 'manual'}
                      onCount={(n) => patchMixed(m.id, { count: n })}
                      onSeconds={(s) => patchMixed(m.id, { seconds: s })}
                      onDelete={() => disableMixed(m.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 音效 */}
        <section>
          <SectionHeading>音效</SectionHeading>
          <ToggleRow
            label="开启答题音效"
            description="答对、答错、金币、挑战、升档等提示音"
            value={settings.soundEnabled}
            onChange={(v) => update({ soundEnabled: v })}
          />
        </section>

        {/* Actions */}
        <div className="space-y-2.5">
          {saveError && (
            <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-center text-xs font-bold text-red-300">
              {saveError}
            </p>
          )}
          <div className="flex gap-2.5">
            <Link
              href="/setting/calc"
              className="flex min-w-0 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-3.5 text-[13px] font-black text-violet-100/65 transition-all hover:bg-white/10"
            >
              取消
            </Link>
          <button
            type="button"
            onClick={handleSave}
            className="min-w-0 flex-[2] rounded-2xl px-3 py-3.5 text-[15px] font-black transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: saved
                ? 'rgba(34,197,94,0.18)'
                : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 55%, #d946ef 100%)',
              boxShadow: saved ? 'none' : '0 6px 24px rgba(139,92,246,0.38)',
              color: saved ? '#4ade80' : '#fff',
            }}
          >
            {saved ? '已保存 ✓' : strategyId ? '💾 保存修改' : '✨ 创建策略'}
          </button>
          </div>
        </div>
      </main>

      {tierSheetOpen && (
        <TierTargetsSheet items={allTierItems} onClose={() => setTierSheetOpen(false)} />
      )}
    </>
  )
}
