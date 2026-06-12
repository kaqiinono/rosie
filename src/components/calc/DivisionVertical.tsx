'use client'

import { useCallback, useMemo, useState } from 'react'

type DivisionVerticalProps = {
  dividend: number
  divisor: number
  onSubmit: (result: {
    correct: boolean
    quotient: number[]
    remainder: number
  }) => void
  disabled?: boolean
}

interface Round {
  trial: number // 试商
  product: number // trial × divisor
  remainder: number // 当前轮余数
  bringDown: number // 下移数字
}

function computeRounds(dividend: number, divisor: number): Round[] {
  const digits = String(dividend).split('').map(Number)
  const rounds: Round[] = []
  let current = 0

  for (let i = 0; i < digits.length; i++) {
    current = current * 10 + digits[i]
    if (current >= divisor || i === digits.length - 1 || rounds.length > 0) {
      const trial = Math.floor(current / divisor)
      const product = trial * divisor
      const remainder = current - product
      rounds.push({
        trial,
        product,
        remainder,
        bringDown: i < digits.length - 1 ? digits[i + 1] : -1,
      })
      current = remainder
    }
  }

  return rounds
}

function DivisionVertical({ dividend, divisor, onSubmit, disabled = false }: DivisionVerticalProps) {
  const rounds = useMemo(() => computeRounds(dividend, divisor), [dividend, divisor])
  const correctQuotient = rounds.map((r) => r.trial)
  const finalRemainder = rounds[rounds.length - 1]?.remainder ?? 0

  const [quotientInputs, setQuotientInputs] = useState<(number | null)[]>(() =>
    Array(rounds.length).fill(null),
  )
  const [activeIdx, setActiveIdx] = useState(0)
  const [checked, setChecked] = useState(false)

  const handleDigit = useCallback(
    (d: number) => {
      if (disabled || checked) return
      setQuotientInputs((prev) => {
        const next = [...prev]
        next[activeIdx] = d
        return next
      })
      if (activeIdx < rounds.length - 1) {
        setActiveIdx(activeIdx + 1)
      }
    },
    [activeIdx, disabled, checked, rounds.length],
  )

  const handleDelete = useCallback(() => {
    if (disabled || checked) return
    setQuotientInputs((prev) => {
      const next = [...prev]
      next[activeIdx] = null
      return next
    })
    if (activeIdx > 0) setActiveIdx(activeIdx - 1)
  }, [activeIdx, disabled, checked])

  const handleAdjust = useCallback(
    (delta: number) => {
      if (disabled || checked) return
      setQuotientInputs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx] ?? 0
        const adjusted = Math.max(0, Math.min(9, cur + delta))
        next[activeIdx] = adjusted
        return next
      })
    },
    [activeIdx, disabled, checked],
  )

  const handleCheck = useCallback(() => {
    if (checked) return
    setChecked(true)
    const userQuotient = quotientInputs.map((v) => v ?? 0)
    const allCorrect = userQuotient.every((v, i) => v === correctQuotient[i])
    onSubmit({
      correct: allCorrect,
      quotient: userQuotient,
      remainder: finalRemainder,
    })
  }, [checked, quotientInputs, correctQuotient, finalRemainder, onSubmit])

  const dividendStr = String(dividend)

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="rounded-2xl p-4 w-full"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Quotient row */}
        <div className="mb-1 flex justify-center gap-1">
          {quotientInputs.map((val, i) => {
            const correctVal = correctQuotient[i]
            const showCorrect = checked && val === correctVal
            const isActive = !checked && activeIdx === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => !checked && !disabled && setActiveIdx(i)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border-2 text-lg font-black transition-all select-none active:scale-[0.93]"
                style={{
                  borderColor: isActive
                    ? 'rgba(139,92,246,0.5)'
                    : checked
                      ? (showCorrect ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)')
                      : 'rgba(255,255,255,0.08)',
                  background: isActive
                    ? 'rgba(139,92,246,0.2)'
                    : checked
                      ? (showCorrect ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)')
                      : 'rgba(255,255,255,0.05)',
                  color: isActive
                    ? '#c4b5fd'
                    : checked
                      ? (showCorrect ? '#4ade80' : '#f87171')
                      : '#f5f3ff',
                }}
              >
                {val !== null ? val : ''}
              </button>
            )
          })}
        </div>

        {/* Divider line */}
        <div className="mx-auto mb-2 h-0.5 w-[calc(100%-2rem)]" style={{ background: 'rgba(196,181,253,0.25)' }} />

        {/* Divisor | Dividend */}
        <div className="flex items-center justify-center gap-2">
          <div
            className="rounded-xl px-3 py-2 text-xl font-black"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#e9d5ff' }}
          >
            {divisor}
          </div>
          <div className="text-2xl" style={{ color: 'rgba(196,181,253,0.4)' }}>⟍</div>
          <div className="flex gap-1">
            {dividendStr.split('').map((d, i) => (
              <div
                key={i}
                className="flex h-10 w-10 items-center justify-center text-xl font-black"
                style={{ color: '#f5f3ff' }}
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Per-round breakdown after check */}
        {checked && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-xs mb-1" style={{ color: 'rgba(196,181,253,0.4)' }}>分步详情</div>
            {rounds.map((r, i) => (
              <div key={i} className="text-xs" style={{ color: 'rgba(196,181,253,0.6)' }}>
                第{i + 1}轮: {r.trial} × {divisor} = {r.product}，余 {r.remainder}
              </div>
            ))}
            {finalRemainder > 0 && (
              <div className="mt-1 text-xs font-bold" style={{ color: '#f59e0b' }}>最终余数: {finalRemainder}</div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {!checked && (
        <>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleAdjust(-1)}
              className="rounded-xl px-3 py-1.5 text-sm font-black transition-all select-none active:scale-[0.93]"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: disabled ? 'rgba(245,243,255,0.25)' : '#f5f3ff',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              −1
            </button>
            <span className="text-xs" style={{ color: 'rgba(196,181,253,0.4)' }}>微调当前位</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleAdjust(1)}
              className="rounded-xl px-3 py-1.5 text-sm font-black transition-all select-none active:scale-[0.93]"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: disabled ? 'rgba(245,243,255,0.25)' : '#f5f3ff',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              +1
            </button>
          </div>

          <div className="grid w-full max-w-xs grid-cols-3 gap-2.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                disabled={disabled}
                onClick={() => handleDigit(d)}
                className="h-14 rounded-2xl text-[22px] font-black transition-all select-none active:scale-[0.93]"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: disabled ? 'rgba(245,243,255,0.25)' : '#f5f3ff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={handleDelete}
              className="h-14 rounded-2xl text-[22px] font-black transition-all select-none active:scale-[0.93]"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: disabled ? 'rgba(252,165,165,0.3)' : '#fca5a5',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              ⌫
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleDigit(0)}
              className="h-14 rounded-2xl text-[22px] font-black transition-all select-none active:scale-[0.93]"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: disabled ? 'rgba(245,243,255,0.25)' : '#f5f3ff',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              0
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleCheck}
              className="h-14 rounded-2xl text-[22px] font-black transition-all select-none active:scale-[0.93]"
              style={{
                background: 'linear-gradient(135deg, #059669, #10b981)',
                color: '#ffffff',
                boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                border: '1px solid rgba(16,185,129,0.25)',
              }}
            >
              检查
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default DivisionVertical
