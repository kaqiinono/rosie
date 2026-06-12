'use client'

import clsx from 'clsx'
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
      <div className="rounded-2xl bg-white/[0.06] p-4 w-full">
        {/* Quotient row */}
        <div className="mb-1 flex justify-center gap-1">
          {quotientInputs.map((val, i) => {
            const correctVal = correctQuotient[i]
            const showCorrect = checked && val === correctVal
            const showWrong = checked && val !== correctVal
            const isActive = !checked && activeIdx === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => !checked && !disabled && setActiveIdx(i)}
                className={clsx(
                  'flex h-10 w-10 items-center justify-center rounded-md border-2 text-lg font-bold transition',
                  isActive && 'border-blue-400 bg-blue-500/20 text-blue-300',
                  !isActive && !checked && 'border-white/20 bg-white/[0.05] text-white',
                  showCorrect && 'border-green-400 bg-green-500/20 text-green-400',
                  showWrong && 'border-red-400 bg-red-500/20 text-red-400',
                )}
              >
                {val !== null ? val : ''}
              </button>
            )
          })}
        </div>

        {/* Divider line */}
        <div className="mx-auto mb-2 h-0.5 w-[calc(100%-2rem)] bg-white/30" />

        {/* Divisor | Dividend */}
        <div className="flex items-center justify-center gap-2">
          <div className="rounded-md bg-white/[0.05] px-3 py-2 text-xl font-bold text-white/80">
            {divisor}
          </div>
          <div className="text-2xl text-white/50">⟍</div>
          <div className="flex gap-1">
            {dividendStr.split('').map((d, i) => (
              <div
                key={i}
                className="flex h-10 w-10 items-center justify-center text-xl font-bold text-white"
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Per-round breakdown after check */}
        {checked && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="text-xs text-white/40 mb-1">分步详情</div>
            {rounds.map((r, i) => (
              <div key={i} className="text-xs text-white/60">
                第{i + 1}轮: {r.trial} × {divisor} = {r.product}，余 {r.remainder}
              </div>
            ))}
            {finalRemainder > 0 && (
              <div className="mt-1 text-xs text-amber-400">最终余数: {finalRemainder}</div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {!checked && (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleAdjust(-1)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/15"
            >
              −1
            </button>
            <span className="text-xs text-white/40 self-center">微调当前位</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleAdjust(1)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/15"
            >
              +1
            </button>
          </div>

          <div className="grid w-full max-w-xs grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                disabled={disabled}
                onClick={() => handleDigit(d)}
                className="min-h-[44px] rounded-xl bg-white text-lg font-bold shadow hover:bg-gray-50"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={handleDelete}
              className="min-h-[44px] rounded-xl bg-white text-lg font-bold shadow hover:bg-gray-50"
            >
              ⌫
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleDigit(0)}
              className="min-h-[44px] rounded-xl bg-white text-lg font-bold shadow hover:bg-gray-50"
            >
              0
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleCheck}
              className="min-h-[44px] rounded-xl bg-blue-500 text-lg font-bold text-white shadow hover:bg-blue-600"
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
