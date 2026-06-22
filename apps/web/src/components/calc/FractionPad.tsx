'use client'

import { useState } from 'react'

interface Props {
  /** Submits the combined answer as "numerator/denominator". */
  onSubmit: (combined: string) => void
  disabled?: boolean
}

type Cell = 'num' | 'den'

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'Enter'] as const

const MAX_LEN = 2

export default function FractionPad({ onSubmit, disabled }: Props) {
  const [numerator, setNumerator] = useState('')
  const [denominator, setDenominator] = useState('')
  const [active, setActive] = useState<Cell>('num')
  const [submitted, setSubmitted] = useState(false)

  const canSubmit =
    !submitted && !disabled && numerator.length > 0 && denominator.length > 0 && denominator !== '0'
  const activeValue = active === 'num' ? numerator : denominator

  const setActiveValue = (next: string) => {
    if (active === 'num') setNumerator(next)
    else setDenominator(next)
  }

  const handleKey = (key: typeof DIGIT_KEYS[number]) => {
    if (disabled || submitted) return
    if (key === 'Enter') {
      // Current cell done → jump to the next cell; on the last cell, submit.
      if (active === 'num') {
        setActive('den')
        return
      }
      if (!canSubmit) return
      setSubmitted(true)
      onSubmit(`${numerator}/${denominator}`)
      return
    }
    if (key === '⌫') {
      setActiveValue(activeValue.slice(0, -1))
      return
    }
    if (activeValue.length >= MAX_LEN) return
    setActiveValue(activeValue === '0' ? key : activeValue + key)
  }

  const renderCell = (which: Cell, value: string) => {
    const on = active === which
    return (
      <button
        type="button"
        onClick={() => !disabled && !submitted && setActive(which)}
        className="flex h-14 w-24 items-center justify-center rounded-2xl border-2 font-fredoka text-[28px] font-black tabular-nums transition-all select-none active:scale-[0.95] sm:h-16 sm:w-28"
        style={{
          borderColor: on ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)',
          background: on ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
          color: on ? '#c4b5fd' : '#f5f3ff',
          boxShadow: on ? '0 0 16px rgba(139,92,246,0.25)' : 'none',
        }}
      >
        {value || (on ? '·' : '')}
      </button>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Stacked numerator / denominator, separated by a fraction bar. */}
      <div
        className="flex w-full max-w-[320px] flex-col items-center gap-2.5 rounded-2xl px-4 py-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {renderCell('num', numerator)}
        <div
          className="h-[3px] w-24 rounded-full sm:w-28"
          style={{ background: 'rgba(196,181,253,0.45)' }}
        />
        {renderCell('den', denominator)}
      </div>

      {/* Keypad — matches NumberPad/RemainderPad sizing/look. */}
      <div className="grid w-full max-w-[320px] grid-cols-3 gap-2.5">
        {DIGIT_KEYS.map((key) => {
          const isAction = key === 'Enter'
          const isDel = key === '⌫'
          // The action key switches cells (分子 → 分母 = Enter) and only submits (✓) on the last cell.
          const onLastCell = active === 'den'
          const actionLabel = onLastCell ? '✓' : 'Enter'
          const enterReady = !onLastCell || canSubmit
          const inactive = disabled || submitted || (isAction && !enterReady)
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleKey(key)}
              disabled={inactive}
              className={`h-14 rounded-2xl font-black transition-all select-none active:scale-[0.93] ${isAction && !onLastCell ? 'text-[15px]' : 'text-[24px]'}`}
              style={
                isAction
                  ? onLastCell
                    ? {
                        background: inactive
                          ? 'rgba(16,185,129,0.15)'
                          : 'linear-gradient(135deg, #059669, #10b981)',
                        color: inactive ? 'rgba(16,185,129,0.35)' : '#ffffff',
                        boxShadow: inactive ? 'none' : '0 4px 16px rgba(16,185,129,0.35)',
                        border: '1px solid rgba(16,185,129,0.25)',
                        cursor: inactive ? 'not-allowed' : 'pointer',
                      }
                    : {
                        background: 'rgba(139,92,246,0.18)',
                        color: '#c4b5fd',
                        border: '1px solid rgba(139,92,246,0.4)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                      }
                  : isDel
                    ? {
                        background: 'rgba(239,68,68,0.1)',
                        color: disabled || submitted ? 'rgba(252,165,165,0.3)' : '#fca5a5',
                        border: '1px solid rgba(239,68,68,0.2)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.05)',
                        color: disabled || submitted ? 'rgba(245,243,255,0.25)' : '#f5f3ff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
                      }
              }
            >
              {isAction ? actionLabel : key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
