'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import BlockPicker from '@/components/calc/BlockPicker'
import MixedOpList from '@/components/calc/MixedOpList'
import CalcConfigBar from '@/components/calc/CalcConfigBar'
import TimeLimitsSection from '@/components/calc/TimeLimitsSection'
import { playSfx } from '@/components/calc/audio'
import { blocksByGroup, type CalcBlock } from '@/utils/calc-blocks'

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
        <div className="text-[14px] font-extrabold" style={{ color: value ? '#c4b5fd' : 'rgba(245,243,255,0.7)' }}>
          {label}
        </div>
        {description && (
          <div className="text-[11px] mt-0.5" style={{ color: 'rgba(245,243,255,0.35)' }}>
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

export default function CalcSettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { settings, update, setSettings, isLoading } = useCalcSettings(user)
  const wallet = useCalcWallet(user)
  const [saved, setSaved] = useState(false)

  // Settings already persist on every `update()`; this button is an explicit
  // "save now" affordance that re-upserts the current snapshot and confirms.
  const handleSave = async () => {
    await setSettings(settings)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  // Mirror /calc 「开始口算」: jump straight into a real, persisted session.
  const handleStart = () => {
    playSfx('coin', settings.soundEnabled)
    const params = new URLSearchParams({
      count: String(settings.lastCount),
      time: String(settings.lastTimeLimit),
      mode: 'daily',
    })
    router.push(`/calc/session?${params.toString()}`)
  }

  const toggleBlock = (id: string) => {
    const next = new Set(settings.selectedBlocks)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    update({ selectedBlocks: [...next] })
  }

  const toggleGroup = (group: CalcBlock['group'], on: boolean) => {
    const ids = blocksByGroup(group).map((b) => b.id)
    const next = new Set(settings.selectedBlocks)
    if (on) ids.forEach((i) => next.add(i))
    else ids.forEach((i) => next.delete(i))
    update({ selectedBlocks: [...next] })
  }

  if (isLoading) {
    return (
      <>
        <CalcAppHeader
          balance={wallet.balance}
          soundEnabled={settings.soundEnabled}
          onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
          title="设置"
          backHref="/calc"
          backLabel="口算"
        />
        <div
          className="mx-auto max-w-[640px] px-4 py-10 text-center text-[13px]"
          style={{ color: 'rgba(196,181,253,0.4)' }}
        >
          加载中…
        </div>
      </>
    )
  }

  const blockCount = settings.selectedBlocks.length

  return (
    <>
      <CalcAppHeader
        balance={wallet.balance}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
        title="口算设置"
        backHref="/calc"
        backLabel="口算"
      />

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-12 space-y-5 relative">

        {/* 单运算 — multi-select building blocks */}
        <section>
          <SectionHeading
            suffix={
              <span className="ml-2 normal-case tracking-normal" style={{ color: 'rgba(196,181,253,0.3)' }}>
                · 已选 {blockCount} 种
              </span>
            }
          >
            单运算
          </SectionHeading>
          <BlockPicker
            selected={settings.selectedBlocks}
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
              description="百以内 / 千以内 / 万以内加减、两位数×一·两位数、多位数÷一位数 用竖式格子作答"
              value={settings.verticalForBigNumbers}
              onChange={(v) => update({ verticalForBigNumbers: v })}
            />
          </div>
        </section>

        {/* 题量 / 限时 */}
        <section>
          <SectionHeading>题量 · 限时</SectionHeading>
          <CalcConfigBar
            count={settings.lastCount}
            timeLimit={settings.lastTimeLimit}
            onChange={(patch) =>
              update(
                patch.count !== undefined
                  ? { lastCount: patch.count }
                  : { lastTimeLimit: patch.timeLimit },
              )
            }
          />
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

        {/* 限时细则 */}
        <TimeLimitsSection
          overrides={settings.timeLimitOverrides}
          onChange={(next) => update({ timeLimitOverrides: next })}
        />

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-2xl px-5 py-4 text-[17px] font-black text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #d946ef 100%)',
              boxShadow: '0 6px 28px rgba(139,92,246,0.45), 0 1px 0 rgba(255,255,255,0.12) inset',
            }}
          >
            🚀 开始练习 →
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-2xl px-4 py-3 text-[14px] font-black transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: saved ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${saved ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.12)'}`,
              color: saved ? '#4ade80' : 'rgba(245,243,255,0.7)',
            }}
          >
            {saved ? '已保存 ✓' : '💾 保存设置'}
          </button>
        </div>
      </main>
    </>
  )
}
