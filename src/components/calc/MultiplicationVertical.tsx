'use client'

import { useMemo, useState } from 'react'

type MultiplicationVerticalProps = {
  /** Top factor (multiplicand). */
  a: number
  /** Bottom factor (multiplier) — drives the number of partial-product rows. */
  b: number
  onSubmit: (result: {
    correct: boolean
    resultCorrect: boolean
    partialsCorrect: boolean
    userResult: number[]
  }) => void
  disabled?: boolean
  /** Fill parent height: grid centered above, keypad pinned to the bottom (full width). */
  fill?: boolean
}

// Same cell geometry vocabulary as VerticalCalc/DivisionVertical so all 竖式
// surfaces stay pixel-consistent. `fill` mode uses cqh so the whole grid scales
// to the height the answer area is given (more rows than add/sub → slightly
// smaller min sizes to fit the partial-product rows without a scrollbar).
type Geo = {
  cell: { width: string | number; height: string | number }
  lead: string | number
  digitFont: string | number
}
const FILL_GEO: Geo = {
  cell: { width: 'clamp(22px, 11cqh, 46px)', height: 'clamp(26px, 13cqh, 52px)' },
  lead: 'clamp(18px, 9cqh, 40px)',
  digitFont: 'clamp(15px, 6.5cqh, 26px)',
}
const COMPACT_GEO: Geo = {
  cell: { width: 48, height: 56 },
  lead: 40,
  digitFont: 26,
}

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

/** Place a value's digits right-aligned so its last digit lands in column `endCol`. */
function placeDigits(value: number, endCol: number, totalCols: number): (number | null)[] {
  const ds = getDigits(value)
  const cells: (number | null)[] = new Array(totalCols).fill(null)
  for (let k = 0; k < ds.length; k++) {
    const col = endCol - (ds.length - 1 - k)
    if (col >= 0 && col < totalCols) cells[col] = ds[k]
  }
  return cells
}

type ActiveCell = { row: number; idx: number }

function MultiplicationVertical({ a, b, onSubmit, disabled = false, fill = false }: MultiplicationVerticalProps) {
  // ── Correct layout (memoised) ────────────────────────────────────────────
  const layout = useMemo(() => {
    const result = a * b
    const totalCols = getDigits(result).length
    const bRTL = getDigits(b).slice().reverse() // [units, tens, …]
    const numPartials = bRTL.length
    // Each partial = a × (one digit of b), right-aligned shifted left by its place.
    const partials = bRTL.map((digit, i) => {
      const value = a * digit
      return placeDigits(value, totalCols - 1 - i, totalCols)
    })
    const resultRow = placeDigits(result, totalCols - 1, totalCols)
    return { result, totalCols, numPartials, partials, resultRow }
  }, [a, b])

  const { result, totalCols, numPartials, partials, resultRow } = layout
  const resultRowIdx = numPartials // result row sits after the partial rows
  // A single partial that already equals the result needs no separate sum row.
  const hasSumRow = numPartials > 1

  // Ordered list of editable (row, col) cells, input order = top→bottom, right→left.
  const cellOrder = useMemo(() => {
    const cells: ActiveCell[] = []
    for (let row = 0; row < numPartials; row++) {
      for (let col = totalCols - 1; col >= 0; col--) {
        if (partials[row][col] !== null) cells.push({ row, idx: col })
      }
    }
    if (hasSumRow) {
      for (let col = totalCols - 1; col >= 0; col--) {
        if (resultRow[col] !== null) cells.push({ row: resultRowIdx, idx: col })
      }
    }
    return cells
  }, [numPartials, totalCols, partials, resultRow, hasSumRow, resultRowIdx])

  // ── User input state ─────────────────────────────────────────────────────
  const [userPartials, setUserPartials] = useState<(number | null)[][]>(() =>
    Array.from({ length: numPartials }, () => Array<number | null>(totalCols).fill(null)),
  )
  const [userResult, setUserResult] = useState<(number | null)[]>(() =>
    Array<number | null>(totalCols).fill(null),
  )
  const [active, setActive] = useState<ActiveCell>(() => cellOrder[0] ?? { row: 0, idx: totalCols - 1 })
  const [checked, setChecked] = useState(false)

  const getVal = (c: ActiveCell): number | null =>
    c.row === resultRowIdx ? userResult[c.idx] : userPartials[c.row]?.[c.idx] ?? null

  const setVal = (c: ActiveCell, digit: number | null) => {
    if (c.row === resultRowIdx) {
      setUserResult((prev) => {
        const next = [...prev]
        next[c.idx] = digit
        return next
      })
    } else {
      setUserPartials((prev) => {
        const next = prev.map((r) => [...r])
        next[c.row][c.idx] = digit
        return next
      })
    }
  }

  const orderIndex = (c: ActiveCell) => cellOrder.findIndex((o) => o.row === c.row && o.idx === c.idx)

  const handleDigitInput = (digit: number) => {
    if (disabled || checked) return
    setVal(active, digit)
    const i = orderIndex(active)
    if (i >= 0 && i + 1 < cellOrder.length) setActive(cellOrder[i + 1])
  }

  const handleDelete = () => {
    if (disabled || checked) return
    setVal(active, null)
  }

  const allFilled = cellOrder.every((c) => getVal(c) !== null)

  const handleCheck = () => {
    if (checked) return
    setChecked(true)
    const partialsCorrect = partials.every((row, r) =>
      row.every((d, col) => (d === null ? true : userPartials[r][col] === d)),
    )
    const resultCorrect = hasSumRow
      ? resultRow.every((d, col) => (d === null ? true : userResult[col] === d))
      : partialsCorrect // single-partial: the lone row IS the answer
    const finalDigits = (hasSumRow ? userResult : userPartials[0]).map((v) => v ?? 0)
    onSubmit({
      correct: resultCorrect && partialsCorrect,
      resultCorrect,
      partialsCorrect,
      userResult: finalDigits,
    })
  }

  const handleAction = () => {
    if (allFilled) {
      handleCheck()
      return
    }
    const nextEmpty = cellOrder.find((c) => getVal(c) === null)
    if (nextEmpty) setActive(nextEmpty)
  }

  const aPad = placeDigits(a, totalCols - 1, totalCols)
  const bPad = placeDigits(b, totalCols - 1, totalCols)
  const geo = fill ? FILL_GEO : COMPACT_GEO

  // ── Cell renderers ───────────────────────────────────────────────────────
  const renderCell = (
    rowIdx: number,
    col: number,
    correctDigit: number | null,
    val: number | null,
  ) => {
    if (correctDigit === null) return <div key={col} style={geo.cell} />
    const isActive = active.row === rowIdx && active.idx === col
    const showError = checked && val !== null && val !== correctDigit
    const showCorrect = checked && val !== null && val === correctDigit
    return (
      <button
        key={col}
        type="button"
        onClick={() => !disabled && !checked && setActive({ row: rowIdx, idx: col })}
        className="flex items-center justify-center rounded-xl border-2 font-black transition-all select-none active:scale-[0.93]"
        style={{
          ...geo.cell,
          fontSize: geo.digitFont,
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
  }

  const fixedRow = (digits: (number | null)[], lead: string) => (
    <div className="flex justify-end gap-1">
      <div
        className="flex items-center justify-center font-black"
        style={{ width: geo.lead, height: geo.cell.height, fontSize: geo.digitFont, color: 'rgba(196,181,253,0.6)' }}
      >
        {lead}
      </div>
      {digits.map((d, i) => (
        <div
          key={i}
          className="flex items-center justify-center font-black"
          style={{ ...geo.cell, fontSize: geo.digitFont, color: '#f5f3ff' }}
        >
          {d !== null ? d : ''}
        </div>
      ))}
    </div>
  )

  return (
    <div className={fill ? 'flex h-full w-full flex-col' : 'flex w-full flex-col'}>
      <div
        className={
          fill
            ? 'flex min-h-0 flex-1 flex-col items-center justify-center'
            : 'flex flex-col items-center'
        }
        style={fill ? { containerType: 'size' } : undefined}
      >
        <div
          className={`rounded-2xl ${fill ? 'p-3' : 'p-4'}`}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Factors */}
          {fixedRow(aPad, '')}
          {fixedRow(bPad, '×')}

          {/* Divider above the partial products */}
          <div className="my-1 border-t-2" style={{ borderColor: 'rgba(196,181,253,0.25)' }} />

          {/* Partial-product rows — '+' on the last one when there's a sum to do */}
          {partials.map((row, r) => (
            <div key={`p${r}`} className="flex justify-end gap-1">
              <div
                className="flex items-center justify-center font-black"
                style={{ width: geo.lead, height: geo.cell.height, fontSize: geo.digitFont, color: 'rgba(196,181,253,0.6)' }}
              >
                {hasSumRow && r === numPartials - 1 ? '+' : ''}
              </div>
              {row.map((correctDigit, col) =>
                renderCell(r, col, correctDigit, userPartials[r][col]),
              )}
            </div>
          ))}

          {/* Sum divider + final result row (only when there are ≥2 partials) */}
          {hasSumRow && (
            <>
              <div className="my-1 border-t-2" style={{ borderColor: 'rgba(196,181,253,0.25)' }} />
              <div className="flex justify-end gap-1">
                <div style={{ width: geo.lead }} />
                {resultRow.map((correctDigit, col) =>
                  renderCell(resultRowIdx, col, correctDigit, userResult[col]),
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Number pad — pinned to the bottom, full width (matches VerticalCalc) */}
      {!checked && (
        <div className={`mx-auto grid w-full max-w-[320px] grid-cols-3 gap-2.5 ${fill ? 'shrink-0 pt-4' : 'mt-4'}`}>
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
            className={`h-14 rounded-2xl font-black transition-all select-none active:scale-[0.93] ${!allFilled ? 'text-[15px]' : 'text-[24px]'}`}
            style={
              !allFilled
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
            {!allFilled ? 'Enter' : '✓'}
          </button>
        </div>
      )}
    </div>
  )
}

export default MultiplicationVertical
