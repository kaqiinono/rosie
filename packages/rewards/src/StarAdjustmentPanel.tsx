'use client'

import { useState } from 'react'
import ColoredStar from './ColoredStar'
import {
  STAR_COLOR_HEX,
  STAR_UNIT_PRICE_LABEL,
  STAR_UNIT_PRICE_YUAN,
  formatYuan,
  type StarColor,
} from './star-types'

const COLORS: StarColor[] = ['yellow', 'red', 'blue']

export type StarAdjustmentMode = 'add' | 'spend'

interface StarAdjustmentPanelProps {
  balances: Record<StarColor, number>
  onAdjust: (color: StarColor, amount: number, mode: StarAdjustmentMode) => void | Promise<void>
  showAdd?: boolean
  disabled?: boolean
  title?: string
  helperText?: string
}

/** Shared manual star adjustment UI. Authorization and persistence stay with the host page. */
export default function StarAdjustmentPanel({
  balances,
  onAdjust,
  showAdd = true,
  disabled = false,
  title = '添加或消费',
  helperText = '输入数量后操作，当天可多次进行',
}: StarAdjustmentPanelProps) {
  const [amounts, setAmounts] = useState<Record<StarColor, number | ''>>({
    yellow: 10,
    red: 10,
    blue: 10,
  })
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const run = async (color: StarColor, amount: number, mode: StarAdjustmentMode) => {
    if (disabled || busyKey || amount <= 0) return
    const key = `${mode}:${color}`
    setBusyKey(key)
    try {
      await onAdjust(color, amount, mode)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="text-[15px] font-extrabold text-slate-800">{title}</h2>
        <span className="text-[11px] text-slate-500">{helperText}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {COLORS.map((color) => {
          const theme = STAR_COLOR_HEX[color]
          const amount = Number(amounts[color]) || 1
          const draftValue = amount * STAR_UNIT_PRICE_YUAN[color]
          return (
            <div
              key={color}
              className="rounded-2xl bg-white/85 p-4 shadow-sm"
              style={{ border: `1.5px solid ${theme.border}` }}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ColoredStar color={color} size={20} glow={6} />
                  <span className="text-[14px] font-extrabold" style={{ color: theme.outline }}>
                    {theme.shapeLabel}
                  </span>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums"
                  style={{ background: `${theme.primary}14`, color: theme.outline, border: `1px solid ${theme.border}` }}
                >
                  {STAR_UNIT_PRICE_LABEL[color]}
                </span>
              </div>
              <input
                type="number"
                min={1}
                aria-label={`${theme.shapeLabel}数量`}
                value={amounts[color]}
                onChange={(event) => {
                  const raw = event.target.value
                  setAmounts((previous) => ({
                    ...previous,
                    [color]: raw === '' ? '' : Math.max(1, Number(raw) || 1),
                  }))
                }}
                onBlur={() => setAmounts((previous) => ({
                  ...previous,
                  [color]: previous[color] === '' ? 1 : previous[color],
                }))}
                className="font-fredoka mb-1 w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-center text-[18px] font-black tabular-nums focus:border-amber-400 focus:outline-none"
                style={{ color: theme.outline }}
              />
              <div className="mb-2 text-center text-[11px] font-bold text-slate-500 tabular-nums">
                本次 {amount} 颗 ≈ {formatYuan(draftValue)}
              </div>
              <div className="flex gap-2">
                {(showAdd ? ['add', 'spend'] as const : ['spend'] as const).map((mode) => {
                  const isBusy = busyKey === `${mode}:${color}`
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={disabled || !!busyKey || (mode === 'spend' && amount > balances[color])}
                      onClick={() => void run(color, amount, mode)}
                      className="min-h-11 flex-1 cursor-pointer rounded-lg py-2 text-[13px] font-extrabold shadow transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                      style={mode === 'add'
                        ? {
                            background: `linear-gradient(135deg,${theme.primary},${theme.outline})`,
                            boxShadow: `0 3px 12px ${theme.glow}`,
                            color: '#fff',
                          }
                        : {
                            background: 'rgba(255,255,255,0.9)',
                            border: `1.5px solid ${theme.outline}`,
                            color: theme.outline,
                          }}
                    >
                      {isBusy ? (mode === 'add' ? '添加中…' : '消费中…') : mode === 'add' ? '添加' : '消费'}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
