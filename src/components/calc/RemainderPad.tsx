'use client'

import { useState } from 'react'

interface Props {
  /** Submits the combined answer as "quotient…remainder". */
  onSubmit: (combined: string) => void
  disabled?: boolean
}

type ActiveCell = 'q' | 'r'

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'Enter'] as const

const MAX_LEN = 3

export default function RemainderPad({ onSubmit, disabled }: Props) {
  const [quotient, setQuotient] = useState('')
  const [remainder, setRemainder] = useState('')
  const [active, setActive] = useState<ActiveCell>('q')
  const [submitted, setSubmitted] = useState(false)

  const canSubmit = !submitted && !disabled && quotient.length > 0 && remainder.length > 0
  const activeValue = active === 'q' ? quotient : remainder

  const setActiveValue = (next: string) => {
    if (active === 'q') setQuotient(next)
    else setRemainder(next)
  }

  const handleKey = (key: typeof DIGIT_KEYS[number]) => {
    if (disabled || submitted) return
    if (key === 'Enter') {
      // Current cell done → jump to the next cell; on the last cell, submit.
      if (active === 'q') {
        setActive('r')
        return
      }
      if (!canSubmit) return
      setSubmitted(true)
      onSubmit(`${quotient}…${remainder}`)
      return
    }
    if (key === '⌫') {
      setActiveValue(activeValue.slice(0, -1))
      return
    }
    if (activeValue.length >= MAX_LEN) return
    setActiveValue(activeValue === '0' ? key : activeValue + key)
  }

  const renderCell = (which: ActiveCell, value: string, label: string) => {
    const on = active === which
    return (
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => !disabled && !submitted && setActive(which)}
          className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 font-fredoka text-[28px] font-black tabular-nums transition-all select-none active:scale-[0.93] sm:h-18 sm:w-18"
          style={{
            borderColor: on ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)',
            background: on ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
            color: on ? '#c4b5fd' : '#f5f3ff',
            boxShadow: on ? '0 0 16px rgba(139,92,246,0.25)' : 'none',
          }}
        >
          {value || (on ? '·' : '')}
        </button>
        <span
          className="text-[11px] font-extrabold"
          style={{ color: on ? '#c4b5fd' : 'rgba(196,181,253,0.55)' }}
        >
          {label}
        </span>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Answer slots: 商 …… 余. The equation itself is shown above by QuestionDisplay. */}
      <div
        className="flex w-full max-w-[320px] items-center justify-center gap-4 rounded-2xl px-4 py-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {renderCell('q', quotient, '商')}
        <span
          className="pb-5 text-[20px] font-black tracking-[0.2em]"
          style={{ color: 'rgba(196,181,253,0.45)' }}
        >
          ……
        </span>
        {renderCell('r', remainder, '余')}
      </div>

      {/* Keypad — matches NumberPad sizing/look. */}
      <div className="grid w-full max-w-[320px] grid-cols-3 gap-2.5">
        {DIGIT_KEYS.map((key) => {
          const isAction = key === 'Enter'
          const isDel = key === '⌫'
          // The action key switches cells (商 → 余 = Enter) and only submits (✓) on the last cell.
          const onLastCell = active === 'r'
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
