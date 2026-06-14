'use client'

import { useCallback, useMemo, useState } from 'react'

type Op = '+' | '-' | '×'

type VerticalCalcProps = {
  a: number
  b: number
  op: Op
  onSubmit: (result: {
    correct: boolean
    carryCorrect: boolean
    resultCorrect: boolean
    userCarries: number[]
    userResult: number[]
  }) => void
  disabled?: boolean
  /** Fill parent height: grid centered above, keypad pinned to the bottom (full width). */
  fill?: boolean
}

// Shared cell geometry — every row uses the same widths so columns stay aligned.
const LEAD = 'w-12' // leading spacer / operator column
const DIGIT = 'h-16 w-14' // operand & result digit cells

function getDigits(n: number): number[] {
  if (n === 0) return [0]
  const d: number[] = []
  let v = Math.abs(n)
  while (v > 0) {
    d.unshift(v % 10)
    v = Math.floor(v / 10)
  }
  return d
}

/** Right-align `arr` into a `len`-wide row, padding the left with nulls (blanks). */
function padLeft<T>(arr: readonly T[], len: number): (T | null)[] {
  const pad = Math.max(0, len - arr.length)
  return Array<T | null>(pad).fill(null).concat(arr as T[])
}

function computeAddition(a: number, b: number) {
  const result = a + b
  const aDigits = getDigits(a)
  const bDigits = getDigits(b)
  const maxLen = Math.max(aDigits.length, bDigits.length)
  const aPad = Array(maxLen - aDigits.length).fill(0).concat(aDigits)
  const bPad = Array(maxLen - bDigits.length).fill(0).concat(bDigits)

  const carries: number[] = Array(maxLen).fill(0)
  let carry = 0
  for (let i = maxLen - 1; i >= 0; i--) {
    const sum = aPad[i] + bPad[i] + carry
    carry = Math.floor(sum / 10)
    carries[i] = carry
  }

  return { result, carries, resultDigits: getDigits(result) }
}

function computeSubtraction(a: number, b: number) {
  const result = a - b
  const aDigits = getDigits(a)
  const bDigits = getDigits(b)
  const maxLen = aDigits.length
  const bPad = Array(maxLen - bDigits.length).fill(0).concat(bDigits)

  const borrows: number[] = Array(maxLen).fill(0)
  let borrow = 0
  for (let i = maxLen - 1; i >= 0; i--) {
    const sub = aDigits[i] - bPad[i] - borrow
    if (sub < 0) {
      borrows[i] = 1
      borrow = 1
    } else {
      borrow = 0
    }
  }

  return { result, carries: borrows, resultDigits: getDigits(Math.abs(result)) }
}

function computeMultiplication(a: number, b: number) {
  const result = a * b
  const aDigits = getDigits(a)

  const carries: number[] = Array(aDigits.length).fill(0)
  let carry = 0
  for (let i = aDigits.length - 1; i >= 0; i--) {
    const prod = aDigits[i] * b + carry
    carry = Math.floor(prod / 10)
    carries[i] = carry
  }

  return { result, carries, resultDigits: getDigits(result) }
}

function VerticalCalc({ a, b, op, onSubmit, disabled = false }: VerticalCalcProps) {
  const { carries: correctCarries, resultDigits: correctResult } = useMemo(() => {
    if (op === '+') return computeAddition(a, b)
    if (op === '-') return computeSubtraction(a, b)
    return computeMultiplication(a, b)
  }, [a, b, op])

  const resultLen = correctResult.length
  const aDigits = getDigits(a)
  const bDigits = getDigits(b)
  // The minuend can have more digits than the difference (1000 − 348 = 652),
  // so the column count must span the widest of both operands AND the result.
  const totalCols = Math.max(aDigits.length, bDigits.length, resultLen)

  const leftmostResult = totalCols - resultLen

  const [userCarries, setUserCarries] = useState<(number | null)[]>(() =>
    Array(totalCols).fill(null),
  )
  const [userResult, setUserResult] = useState<(number | null)[]>(() =>
    Array(totalCols).fill(null),
  )
  // Start on the rightmost result cell so typing works immediately (right→left).
  const [activeCell, setActiveCell] = useState<{ type: 'carry' | 'result'; idx: number }>(
    () => ({ type: 'result', idx: totalCols - 1 }),
  )
  const [checked, setChecked] = useState(false)
  // 进位/退位 row is optional scaffolding (never graded); hidden by default.
  const [showCarry, setShowCarry] = useState(false)

  const handleDigitInput = useCallback(
    (digit: number) => {
      if (disabled || checked) return
      if (activeCell.type === 'carry') {
        setUserCarries((prev) => {
          const next = [...prev]
          next[activeCell.idx] = digit
          return next
        })
      } else {
        setUserResult((prev) => {
          const next = [...prev]
          next[activeCell.idx] = digit
          return next
        })
        // Auto-advance to the next result cell on the left.
        if (activeCell.idx > leftmostResult) {
          setActiveCell({ type: 'result', idx: activeCell.idx - 1 })
        }
      }
    },
    [activeCell, disabled, checked, leftmostResult],
  )

  const handleDelete = useCallback(() => {
    if (disabled || checked) return
    if (activeCell.type === 'carry') {
      setUserCarries((prev) => {
        const next = [...prev]
        next[activeCell.idx] = null
        return next
      })
    } else {
      setUserResult((prev) => {
        const next = [...prev]
        next[activeCell.idx] = null
        return next
      })
    }
  }, [activeCell, disabled, checked])

  const handleCheck = useCallback(() => {
    if (checked) return
    setChecked(true)

    const correctCarryFull = padLeft(correctCarries, totalCols)
    const correctResultFull = padLeft(correctResult, totalCols)
    const uc = userCarries.map((v) => v ?? 0)
    const ur = userResult.map((v) => v ?? 0)
    const carryCorrect = uc.every((v, i) => v === (correctCarryFull[i] ?? 0))
    const resultCorrect = ur.every((v, i) => v === (correctResultFull[i] ?? 0))

    onSubmit({
      // 进位行只做辅助，不参与判分：只看结果是否正确。
      correct: resultCorrect,
      carryCorrect,
      resultCorrect,
      userCarries: uc,
      userResult: ur,
    })
  }, [checked, userCarries, userResult, correctCarries, correctResult, totalCols, onSubmit])

  // Enter advances result cells right→left; ✓ submits on the last (leftmost) cell.
  const canAdvance = activeCell.type === 'result' && activeCell.idx > leftmostResult
  const handleAction = useCallback(() => {
    if (canAdvance) {
      setActiveCell({ type: 'result', idx: activeCell.idx - 1 })
    } else {
      handleCheck()
    }
  }, [canAdvance, activeCell, handleCheck])

  const aPad = padLeft(aDigits, totalCols)
  const bPad = padLeft(bDigits, totalCols)
  const correctResultPad = padLeft(correctResult, totalCols)

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 进位格 toggle — auxiliary scaffolding, off by default, never graded */}
      <button
        type="button"
        onClick={() => setShowCarry((v) => !v)}
        disabled={checked}
        className="rounded-full px-3 py-1 text-[11px] font-extrabold transition-all select-none"
        style={{
          background: showCarry ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${showCarry ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
          color: showCarry ? '#c4b5fd' : 'rgba(196,181,253,0.55)',
        }}
      >
        {showCarry ? '✓ 进位格' : '＋ 进位格'}
      </button>

      {/* Vertical layout */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* 进位/退位 row — optional scaffolding; every column, never graded/colored */}
        {showCarry && (
          <div className="mb-1 flex justify-end gap-1">
            <div className="w-10" />
            {userCarries.map((val, i) => {
              const isActive = activeCell.type === 'carry' && activeCell.idx === i
              return (
                <button
                  key={`c${i}`}
                  type="button"
                  onClick={() => !disabled && !checked && setActiveCell({ type: 'carry', idx: i })}
                  className="flex h-9 w-12 items-center justify-center rounded text-sm font-black transition-all select-none active:scale-[0.93]"
                  style={{
                    border: isActive ? '1px solid rgba(139,92,246,0.6)' : '1px dashed rgba(196,181,253,0.4)',
                    background: isActive ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.08)',
                    color: isActive ? '#c4b5fd' : val !== null ? '#c4b5fd' : 'rgba(196,181,253,0.4)',
                  }}
                >
                  {val !== null ? val : '·'}
                </button>
              )
            })}
          </div>
        )}

        {/* First operand row */}
        <div className="flex justify-end gap-1">
          <div className="w-10" />
          {aPad.map((d, i) => (
            <div key={`a${i}`} className="flex h-14 w-12 items-center justify-center text-2xl font-black" style={{ color: '#f5f3ff' }}>
              {d !== null ? d : ''}
            </div>
          ))}
        </div>

        {/* Operator + second operand */}
        <div className="flex justify-end gap-1">
          <div className="flex h-14 w-10 items-center justify-center text-2xl font-black" style={{ color: 'rgba(196,181,253,0.6)' }}>
            {op}
          </div>
          {bPad.map((d, i) => (
            <div key={`b${i}`} className="flex h-14 w-12 items-center justify-center text-2xl font-black" style={{ color: '#f5f3ff' }}>
              {d !== null ? d : ''}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-1 border-t-2" style={{ borderColor: 'rgba(196,181,253,0.25)' }} />

        {/* Result row */}
        <div className="flex justify-end gap-1">
          <div className="w-10" />
          {userResult.map((val, i) => {
            // The result occupies only the rightmost `resultLen` columns; leading
            // columns (e.g. above the minuend's extra digit) are blank spacers.
            const editable = i >= totalCols - resultLen
            if (!editable) {
              return <div key={`r${i}`} className="h-14 w-12" />
            }
            const correctVal = correctResultPad[i] ?? 0
            const isActive = activeCell?.type === 'result' && activeCell.idx === i
            const showError = checked && val !== null && val !== correctVal
            const showCorrect = checked && val !== null && val === correctVal

            return (
              <button
                key={`r${i}`}
                type="button"
                onClick={() => !disabled && !checked && setActiveCell({ type: 'result', idx: i })}
                className="flex h-14 w-12 items-center justify-center rounded-xl border-2 text-2xl font-black transition-all select-none active:scale-[0.93]"
                style={{
                  borderColor: isActive
                    ? 'rgba(139,92,246,0.5)'
                    : showCorrect
                      ? 'rgba(74,222,128,0.5)'
                      : showError
                        ? 'rgba(248,113,113,0.5)'
                        : 'rgba(255,255,255,0.08)',
                  background: isActive
                    ? 'rgba(139,92,246,0.2)'
                    : showCorrect
                      ? 'rgba(74,222,128,0.15)'
                      : showError
                        ? 'rgba(248,113,113,0.15)'
                        : 'rgba(255,255,255,0.05)',
                  color: isActive
                    ? '#c4b5fd'
                    : showCorrect
                      ? '#4ade80'
                      : showError
                        ? '#f87171'
                        : '#f5f3ff',
                }}
              >
                {val !== null ? val : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Number pad */}
      {!checked && (
        <div className="grid w-full max-w-xs grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => handleDigitInput(d)}
              className="h-14 rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]"
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
            className="h-14 rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]"
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: disabled ? 'rgba(252,165,165,0.3)' : '#fca5a5',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
            aria-label="删除"
          >
            ⌫
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleDigitInput(0)}
            className="h-14 rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]"
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
            onClick={handleAction}
            className={`h-14 rounded-2xl font-black transition-all select-none active:scale-[0.93] ${canAdvance ? 'text-[15px]' : 'text-[24px]'}`}
            style={
              canAdvance
                ? {
                    background: 'rgba(139,92,246,0.18)',
                    color: '#c4b5fd',
                    border: '1px solid rgba(139,92,246,0.4)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }
                : {
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#ffffff',
                    boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                    border: '1px solid rgba(16,185,129,0.25)',
                  }
            }
          >
            {canAdvance ? 'Enter' : '✓'}
          </button>
        </div>
      )}
    </div>
  )
}

export default VerticalCalc
