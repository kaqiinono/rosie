'use client'

import { useState } from 'react'

interface Props {
  dividend: number
  divisor: number
  onSubmit: (combined: string) => void
  disabled?: boolean
}

type ActiveCell = 'q' | 'r'

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'] as const

const MAX_LEN = 3

export default function RemainderPad({ dividend, divisor, onSubmit, disabled }: Props) {
  const [quotient, setQuotient] = useState('')
  const [remainder, setRemainder] = useState('')
  const [active, setActive] = useState<ActiveCell>('q')
  const [submitted, setSubmitted] = useState(false)

  const canSubmit = !submitted && !disabled && quotient.length > 0 && remainder.length > 0

  const setActiveValue = (next: string) => {
    if (active === 'q') {
      setQuotient(next)
    } else {
      setRemainder(next)
    }
  }

  const activeValue = active === 'q' ? quotient : remainder

  const handleKey = (key: typeof DIGIT_KEYS[number]) => {
    if (disabled || submitted) return
    if (key === '✓') {
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
    const next = activeValue === '0' ? key : activeValue + key
    setActiveValue(next)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Problem + answer cells */}
      <div
        className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl p-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span className="text-xl font-black" style={{ color: '#f5f3ff' }}>
          {dividend} ÷ {divisor} =
        </span>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => !disabled && !submitted && setActive('q')}
            className="flex h-12 w-14 items-center justify-center rounded-xl border-2 text-xl font-black transition-all select-none active:scale-[0.93]"
            style={{
              borderColor: active === 'q' ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)',
              background: active === 'q' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
              color: active === 'q' ? '#c4b5fd' : '#f5f3ff',
            }}
          >
            {quotient}
          </button>
          <span className="text-[10px] font-bold" style={{ color: 'rgba(196,181,253,0.6)' }}>
            商
          </span>
        </div>

        <span className="text-xl font-black" style={{ color: 'rgba(196,181,253,0.6)' }}>
          ……
        </span>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => !disabled && !submitted && setActive('r')}
            className="flex h-12 w-14 items-center justify-center rounded-xl border-2 text-xl font-black transition-all select-none active:scale-[0.93]"
            style={{
              borderColor: active === 'r' ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)',
              background: active === 'r' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
              color: active === 'r' ? '#c4b5fd' : '#f5f3ff',
            }}
          >
            {remainder}
          </button>
          <span className="text-[10px] font-bold" style={{ color: 'rgba(196,181,253,0.6)' }}>
            余
          </span>
        </div>
      </div>

      {/* Number pad */}
      <div className="grid w-full max-w-xs grid-cols-3 gap-2.5">
        {DIGIT_KEYS.map((key) => {
          const isSubmit = key === '✓'
          const isDel = key === '⌫'
          const inactive = disabled || submitted || (isSubmit && !canSubmit)
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleKey(key)}
              disabled={inactive}
              className="h-14 rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]"
              style={
                isSubmit
                  ? {
                      background: inactive
                        ? 'rgba(16,185,129,0.15)'
                        : 'linear-gradient(135deg, #059669, #10b981)',
                      color: inactive ? 'rgba(16,185,129,0.35)' : '#ffffff',
                      boxShadow: inactive ? 'none' : '0 4px 16px rgba(16,185,129,0.35)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      cursor: inactive ? 'not-allowed' : 'pointer',
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
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
