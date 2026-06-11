'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useCalcMistakes } from '@/hooks/useCalcMistakes'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import BlockPicker from '@/components/calc/BlockPicker'
import MixedOpList from '@/components/calc/MixedOpList'
import CalcConfigBar from '@/components/calc/CalcConfigBar'
import QuickPracticeModal from '@/components/calc/QuickPracticeModal'
import TimeLimitsSection from '@/components/calc/TimeLimitsSection'
import { blocksByGroup } from '@/utils/calc-blocks'

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
  const { settings, update, isLoading } = useCalcSettings(user)
  const wallet = useCalcWallet(user)
  const { mistakes } = useCalcMistakes(user)
  const [practiceOpen, setPracticeOpen] = useState(false)

  const toggleBlock = (id: string) => {
    const next = new Set(settings.selectedBlocks)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    update({ selectedBlocks: [...next] })
  }

  const toggleGroup = (group: 'add' | 'sub' | 'mul' | 'div', on: boolean) => {
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
  const mixedCount = settings.mixedOps.filter((m) => m.enabled).length
  const practiceSubtitle = `已选 ${blockCount} 种单运算 · ${mixedCount} 种混合`

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

        {/* Try-out button */}
        <button
          type="button"
          onClick={() => setPracticeOpen(true)}
          className="w-full rounded-2xl px-5 py-3.5 text-[15px] font-black text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #db2777)',
            boxShadow: '0 6px 24px rgba(139,92,246,0.3)',
          }}
        >
          ✨ 用当前设置练一练！
        </button>
      </main>

      {practiceOpen && (
        <QuickPracticeModal
          title="试试当前设置"
          subtitle={practiceSubtitle}
          settings={settings}
          mistakes={mistakes}
          buildCount={settings.lastCount}
          soundEnabled={settings.soundEnabled}
          onClose={() => setPracticeOpen(false)}
          doneLabel="完成，回到设置 →"
        />
      )}
    </>
  )
}
