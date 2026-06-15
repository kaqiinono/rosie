'use client'

import { useState } from 'react'
import { suggestedTiers, TIER_LABEL } from '@/utils/calc-time-targets'

interface Props {
  /** 题型 id（block id 或 skeleton id），用于查四档建议。 */
  targetId: string
  /** null=未确认 · 0=不限 · >0=秒数 */
  value: number | null
  onChange: (v: number | null) => void
}

const PRESETS = [0, 1, 3, 5, 10] // 0 = 不限
const PRESET_LABEL = (v: number) => (v === 0 ? '不限' : `${v}秒`)

export default function PerTypeTimeChips({ targetId, value, onChange }: Props) {
  const tiers = suggestedTiers(targetId)
  const isCustom = value !== null && !PRESETS.includes(value)
  const [customOpen, setCustomOpen] = useState(isCustom)

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {value === null && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
            style={{ background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }}
          >
            待确认
          </span>
        )}
        {PRESETS.map((p) => {
          const on = value === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => { onChange(p); setCustomOpen(false) }}
              className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all active:scale-95"
              style={{
                background: on ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${on ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                color: on ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
              }}
            >
              {PRESET_LABEL(p)}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => { setCustomOpen(true); if (!isCustom) onChange(8) }}
          className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all active:scale-95"
          style={{
            background: isCustom ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isCustom ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
            color: isCustom ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
          }}
        >
          自定义
        </button>
        {customOpen && (
          <span className="inline-flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={120}
              value={isCustom ? value! : ''}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v) && v >= 1) onChange(Math.min(v, 120))
              }}
              className="w-14 rounded-md px-2 py-1 text-right text-[12px] font-extrabold tabular-nums"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd', outline: 'none' }}
            />
            <span className="text-[10px]" style={{ color: 'rgba(245,243,255,0.4)' }}>秒</span>
          </span>
        )}
      </div>
      {tiers ? (
        <div className="text-[10px]" style={{ color: 'rgba(196,181,253,0.42)' }}>
          建议 {TIER_LABEL.entry} {tiers.entry[0]}–{tiers.entry[1]} · {TIER_LABEL.stable} {tiers.stable[0]}–{tiers.stable[1]} · {TIER_LABEL.fluent}⭐ {tiers.fluent[0]}–{tiers.fluent[1]} · {TIER_LABEL.auto} {tiers.auto[0]}–{tiers.auto[1]} 秒
        </div>
      ) : (
        <div className="text-[10px]" style={{ color: '#fbbf24' }}>⚠️ 暂无建议耗时，请手动设置</div>
      )}
    </div>
  )
}
