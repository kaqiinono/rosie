'use client'

import { useState } from 'react'
import type { CalcTimingMode } from '@rosie/core'
import { clampBonusSec, sessionStarMultiplier } from '../utils/calc-session-policy'

type Props = {
  timingMode: CalcTimingMode
  bonusSec: number
  onChangeMode: (mode: CalcTimingMode) => void
  onChangeBonus: (seconds: number) => void
}

const MODE_META: Record<CalcTimingMode, { label: string; description: string }> = {
  relaxed: { label: '宽松', description: '按自己的节奏作答' },
  strict: { label: '严格', description: '倒计时结束算错' },
  bonus: { label: '加时', description: '增加答题缓冲时间' },
}

const BONUS_PRESETS = [2, 3, 5]

function starBonusLine(mode: CalcTimingMode, bonusSec: number): string {
  if (mode === 'relaxed') return '星星 ×1.0'
  if (mode === 'strict') return '星星 ×1.2'
  const multiplier = sessionStarMultiplier(mode, bonusSec)
  return `星星 ×${multiplier.toFixed(2).replace(/0$/, '')}`
}

export default function SessionTimingControls({
  timingMode,
  bonusSec,
  onChangeMode,
  onChangeBonus,
}: Props) {
  const [customOpen, setCustomOpen] = useState(!BONUS_PRESETS.includes(bonusSec))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-extrabold text-violet-100">本次计时模式</h3>
        <span className="text-[11px] font-bold text-amber-300">
          {starBonusLine(timingMode, bonusSec)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(MODE_META) as CalcTimingMode[]).map((mode) => {
          const selected = timingMode === mode
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChangeMode(mode)}
              aria-pressed={selected}
              className="min-h-14 rounded-xl px-2 py-2 text-left transition-all active:scale-[0.98]"
              style={{
                background: selected ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${selected ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              <span
                className={`block text-[13px] font-extrabold ${selected ? 'text-violet-200' : 'text-slate-300'}`}
              >
                {MODE_META[mode].label}
              </span>
              <span className="mt-0.5 block text-[10px] leading-3 text-slate-500">
                {MODE_META[mode].description}
              </span>
            </button>
          )
        })}
      </div>

      {timingMode === 'bonus' && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-400/[0.06] p-2.5">
          <span className="text-[10px] font-extrabold text-violet-200/50">加成秒数</span>
          {BONUS_PRESETS.map((seconds) => {
            const selected = !customOpen && bonusSec === seconds
            return (
              <button
                key={seconds}
                type="button"
                onClick={() => {
                  setCustomOpen(false)
                  onChangeBonus(seconds)
                }}
                aria-pressed={selected}
                className={`min-h-10 rounded-lg border px-3 text-[12px] font-extrabold ${
                  selected
                    ? 'border-violet-400/60 bg-violet-400/20 text-violet-200'
                    : 'border-white/10 bg-white/[0.04] text-violet-200/50'
                }`}
              >
                +{seconds}秒
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            aria-pressed={customOpen}
            className={`min-h-10 rounded-lg border px-3 text-[12px] font-extrabold ${
              customOpen
                ? 'border-violet-400/60 bg-violet-400/20 text-violet-200'
                : 'border-white/10 bg-white/[0.04] text-violet-200/50'
            }`}
          >
            自定义
          </button>
          {customOpen && (
            <label className="inline-flex min-h-10 items-center gap-1">
              <span className="sr-only">自定义加成秒数</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={15}
                value={bonusSec}
                onChange={(event) => onChangeBonus(clampBonusSec(Number(event.target.value)))}
                className="h-10 w-16 rounded-lg border border-violet-400/40 bg-slate-950 px-2 text-right text-[13px] font-extrabold text-violet-200 outline-none focus:ring-2 focus:ring-violet-400/25"
              />
              <span className="text-[10px] text-slate-500">秒</span>
            </label>
          )}
        </div>
      )}
    </div>
  )
}
