'use client'

import { useState } from 'react'
import type { CalcTimingMode } from '@rosie/core'
import { clampBonusSec, sessionStarMultiplier } from '../utils/calc-session-policy'

type Props = {
  plannedEstimate: number
  maxRetry: number
  timingMode: CalcTimingMode
  bonusSec: number
  onChangeMode: (m: CalcTimingMode) => void
  onChangeBonus: (n: number) => void
  onSaveDefault: () => void
  onStart: () => void
  onBack: () => void
}

const MODE_META: Record<CalcTimingMode, { label: string; emoji: string; desc: string }> = {
  relaxed: { label: '宽松', emoji: '🌤️', desc: '按需显示倒计时，超时不强制交卷' },
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

export default function SessionPrepScreen({
  plannedEstimate,
  maxRetry,
  timingMode,
  bonusSec,
  onChangeMode,
  onChangeBonus,
  onSaveDefault,
  onStart,
  onBack,
}: Props) {
  const [saved, setSaved] = useState(false)
  const [customOpen, setCustomOpen] = useState(!BONUS_PRESETS.includes(bonusSec))

  const handleSaveDefault = () => {
    onSaveDefault()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <main className="mx-auto max-w-[640px] px-4 pt-5 pb-12 space-y-5 relative">
      {/* Session preview */}
      <section
        className="rounded-2xl p-5"
        style={{
          background: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(139,92,246,0.22)',
          boxShadow: '0 4px 24px rgba(139,92,246,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="text-[10px] font-extrabold tracking-widest uppercase mb-0.5"
          style={{ color: 'rgba(196,181,253,0.5)' }}
        >
          本次练习
        </div>
        <div
          className="font-fredoka text-[22px] font-black leading-none mb-2"
          style={{
            background: 'linear-gradient(90deg, #c4b5fd, #f0abfc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          约 {plannedEstimate} 题
        </div>
        <div className="text-[11px] font-semibold" style={{ color: 'rgba(196,181,253,0.55)' }}>
          最多补练 {maxRetry} 题错题 · 补练一次机会，做完即结束
        </div>
      </section>

      {/* Timing mode */}
      <section>
        <h2
          className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
          style={{ color: 'rgba(196,181,253,0.45)' }}
        >
          计时模式
        </h2>
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
                  <div className="text-[11px] mt-0.5" style={{ color: 'rgba(245,243,255,0.35)' }}>
                    {meta.desc}
                  </div>
                </div>
                {on && <span className="mt-0.5 shrink-0 text-[13px]" style={{ color: '#c4b5fd' }}>✓</span>}
              </button>
            )
          })}
        </div>

        {timingMode === 'bonus' && (
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
          >
            <span className="mr-1 text-[10px] font-extrabold uppercase" style={{ color: 'rgba(196,181,253,0.5)' }}>
              加成秒数
            </span>
            {BONUS_PRESETS.map((n) => {
              const on = !customOpen && bonusSec === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setCustomOpen(false); onChangeBonus(clampBonusSec(n)) }}
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
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd', outline: 'none' }}
                />
                <span className="text-[10px]" style={{ color: 'rgba(245,243,255,0.4)' }}>秒（0–15）</span>
              </span>
            )}
          </div>
        )}
      </section>

      {/* Star bonus preview — always visible per approved design */}
      <div
        className="flex items-center gap-2 rounded-xl px-4 py-3"
        style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}
      >
        <span className="text-[15px]">⭐</span>
        <span className="text-[12.5px] font-extrabold" style={{ color: '#fbbf24' }}>
          {starBonusLine(timingMode, bonusSec)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="min-w-0 flex-1 rounded-2xl px-3 py-3.5 text-[13px] font-black transition-all hover:-translate-y-0.5 active:translate-y-0"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(245,243,255,0.7)',
          }}
        >
          ← 返回
        </button>
        <button
          type="button"
          onClick={handleSaveDefault}
          className="min-w-0 flex-1 rounded-2xl px-3 py-3.5 text-[13px] font-black transition-all hover:-translate-y-0.5 active:translate-y-0"
          style={{
            background: saved ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${saved ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.12)'}`,
            color: saved ? '#4ade80' : 'rgba(245,243,255,0.7)',
          }}
        >
          {saved ? '已设为默认 ✓' : '设为默认'}
        </button>
        <button
          type="button"
          onClick={onStart}
          className="min-w-0 flex-[2] rounded-2xl px-4 py-3.5 text-[16px] font-black text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #d946ef 100%)',
            boxShadow: '0 6px 28px rgba(139,92,246,0.45), 0 1px 0 rgba(255,255,255,0.12) inset',
          }}
        >
          🚀 开始练习 →
        </button>
      </div>
    </main>
  )
}
