'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useCalcMistakes } from '@/hooks/useCalcMistakes'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import QuickPracticeModal from '@/components/calc/QuickPracticeModal'
import { LEVELS, levelSpec } from '@/utils/calc-levels'

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

export default function CalcSettingsPage() {
  const { user } = useAuth()
  const { settings, update, isLoading } = useCalcSettings(user)
  const wallet = useCalcWallet(user)
  const { mistakes } = useCalcMistakes(user)
  const [practiceOpen, setPracticeOpen] = useState(false)

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

  const currentSpec = levelSpec(settings.currentLevel)
  const numericLevels = LEVELS.filter(l => l.level !== 'C')

  const selectStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(139,92,246,0.3)',
    color: '#c4b5fd',
    borderRadius: '0.5rem',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 800,
    outline: 'none',
    width: '100%',
    appearance: 'auto' as const,
  }

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

        {/* Operation types */}
        <section>
          <h2
            className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
            style={{ color: 'rgba(196,181,253,0.45)' }}
          >
            运算类型
          </h2>
          <div className="space-y-2">
            <ToggleRow
              label="加减法"
              description="10 到 100 以内加减（档 1-5）"
              value={settings.enableAddSub}
              onChange={(v) => update({ enableAddSub: v })}
            />
            <ToggleRow
              label="乘除法"
              description="乘法口诀 · 除法 · ×10-19 拓展（档 6-14, 16, 18）"
              value={settings.enableMulDiv}
              onChange={(v) => update({ enableMulDiv: v })}
            />
            <ToggleRow
              label="混合运算"
              description="两运算符 + 三运算符挑战题（档 15, 17, 挑战）"
              value={settings.enableMixed}
              onChange={(v) => update({ enableMixed: v })}
            />
          </div>
        </section>

        {/* Difficulty */}
        <section>
          <h2
            className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
            style={{ color: 'rgba(196,181,253,0.45)' }}
          >
            难度
          </h2>
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="min-w-0 flex-1">
                <div
                  className="text-[11px] font-bold mb-1"
                  style={{ color: 'rgba(196,181,253,0.5)' }}
                >
                  当前难度
                </div>
                <select
                  value={settings.currentLevel}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    const patch: { currentLevel: number; levelCap?: number } = { currentLevel: next }
                    if (next > settings.levelCap) patch.levelCap = next
                    update(patch)
                  }}
                  style={selectStyle}
                >
                  {numericLevels.map(l => (
                    <option key={l.level as number} value={l.level as number}>
                      Lv.{l.level} · {l.label}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] mt-1" style={{ color: 'rgba(245,243,255,0.3)' }}>
                  {currentSpec.label}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[11px] font-bold mb-1"
                  style={{ color: 'rgba(196,181,253,0.5)' }}
                >
                  上限
                </div>
                <select
                  value={settings.levelCap}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    const patch: { levelCap: number; currentLevel?: number } = { levelCap: next }
                    if (next < settings.currentLevel) patch.currentLevel = next
                    update(patch)
                  }}
                  style={selectStyle}
                >
                  {numericLevels.map(l => (
                    <option key={l.level as number} value={l.level as number}>
                      Lv.{l.level} · {l.label}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] mt-1" style={{ color: 'rgba(245,243,255,0.3)' }}>
                  最多升到这一档
                </div>
              </div>
            </div>

            <ToggleRow
              label="自适应升档"
              description="最近 30 题正确率 >85% 时自动解锁下一档（直到上限）"
              value={settings.adaptive}
              onChange={(v) => update({ adaptive: v })}
            />
          </div>
        </section>

        {/* Audio */}
        <section>
          <h2
            className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
            style={{ color: 'rgba(196,181,253,0.45)' }}
          >
            音效
          </h2>
          <ToggleRow
            label="开启答题音效"
            description="答对、答错、金币、挑战、升档等提示音"
            value={settings.soundEnabled}
            onChange={(v) => update({ soundEnabled: v })}
          />
        </section>

        {/* Info */}
        <section
          className="rounded-xl px-4 py-3 text-[11px]"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: 'rgba(245,243,255,0.3)',
          }}
        >
          上次配置：题量 {settings.lastCount} 题 · 限时{' '}
          {settings.lastTimeLimit === 0 ? '不限' : `${settings.lastTimeLimit / 60} 分钟`}
        </section>

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
          title="试试当前难度"
          subtitle={`Lv.${settings.currentLevel} · ${currentSpec.label}`}
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
