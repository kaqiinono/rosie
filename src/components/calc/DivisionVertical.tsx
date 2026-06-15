'use client'

import { useMemo, useState } from 'react'
import QuestionFeedbackHint from './QuestionFeedbackHint'
import { editableCellStyle, VERTICAL_KEYPAD_LOCKED_CLASS } from './vertical-cell-style'
import { type FeedbackKind } from './FeedbackOverlay'

type DivisionVerticalProps = {
  dividend: number
  divisor: number
  onSubmit: (result: { correct: boolean; quotient: number[]; remainder: number }) => void
  disabled?: boolean
  attempt?: number
  feedback?: FeedbackKind
  revealAnswer?: string | null
  immersive?: boolean
  /** Fill parent height: grid centered above, keypad pinned to the bottom (full width). */
  fill?: boolean
}

interface Step {
  col: number // dividend digit column this quotient digit sits over
  q: number // quotient digit
  product: number // q × divisor
  minuend: number // partial dividend before subtracting
  diff: number // remainder after subtracting
}

/** Full long-division breakdown, tracking the column each quotient digit sits over. */
function longDivision(dividend: number, divisor: number) {
  const digits = String(dividend).split('').map(Number)
  const n = digits.length
  const quotient: (number | null)[] = new Array(n).fill(null)
  const steps: Step[] = []
  let current = 0
  let started = false
  for (let i = 0; i < n; i++) {
    current = current * 10 + digits[i]
    if (current >= divisor || started) {
      started = true
      const q = Math.floor(current / divisor)
      const product = q * divisor
      const diff = current - product
      quotient[i] = q
      steps.push({ col: i, q, product, minuend: current, diff })
      current = diff
    }
  }
  return { digits, n, quotient, steps, remainder: current }
}

/** Place a number's digits right-aligned so its last digit lands in column `endCol`. */
function placeDigits(value: number, endCol: number, n: number): (string | null)[] {
  const s = String(value)
  const cells: (string | null)[] = new Array(n).fill(null)
  for (let k = 0; k < s.length; k++) {
    const col = endCol - (s.length - 1 - k)
    if (col >= 0 && col < n) cells[col] = s[k]
  }
  return cells
}

type WorkRow =
  | { kind: 'digits'; cells: (string | null)[] }
  | { kind: 'line'; from: number; to: number }

const BORDER = 'rgba(196,181,253,0.55)'
// Cell geometry uses inline sizes (not Tailwind classes) so every column — cells,
// blank spacers and the subtraction underlines — stays exactly in sync. In `fill`
// mode the answer area is a size container and sizes are expressed in `cqh`, so the
// whole 竖式 scales to its available height (no scroll, no keypad overlap). Compact
// mode keeps fixed pixels for the settings preview.
const CELL_BASE = 'flex items-center justify-center font-black'

function DivisionVertical({ dividend, divisor, onSubmit, disabled = false, attempt = 0, feedback = null, revealAnswer = null, immersive = false, fill = false }: DivisionVerticalProps) {
  const { digits, n, quotient, steps, remainder } = useMemo(
    () => longDivision(dividend, divisor),
    [dividend, divisor],
  )
  const quotientCols = useMemo(
    () => quotient.map((q, i) => (q !== null ? i : -1)).filter((i) => i >= 0),
    [quotient],
  )

  const [userQuotient, setUserQuotient] = useState<(number | null)[]>(() => new Array(n).fill(null))
  const [activeIdx, setActiveIdx] = useState(0)
  const [graded, setGraded] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lastCorrect, setLastCorrect] = useState(false)

  const activeCol = quotientCols[activeIdx]

  const cellPx = fill ? 'clamp(34px, 16cqh, 64px)' : 68
  const cellSize = { width: cellPx, height: cellPx }
  const cellFont = fill ? 'clamp(20px, 9cqh, 36px)' : 36
  // 商 row height + bracket pt-1 (4) + border-t-2 (2) → keeps 除数 aligned with 被除数.
  const divisorPad = fill ? `calc(${cellPx} + 6px)` : 74

  // Plain handlers — React Compiler memoizes these; hand-tuned useCallback deps
  // here disagreed with its inference and forced it to skip the whole component.
  const handleDigit = (d: number) => {
    if (disabled || locked) return
    setUserQuotient((prev) => {
      const next = [...prev]
      next[activeCol] = d
      return next
    })
    if (activeIdx < quotientCols.length - 1) setActiveIdx(activeIdx + 1)
  }

  const handleDelete = () => {
    if (disabled || locked) return
    setUserQuotient((prev) => {
      const next = [...prev]
      next[activeCol] = null
      return next
    })
    if (activeIdx > 0) setActiveIdx(activeIdx - 1)
  }

  const handleCheck = () => {
    if (locked) return
    const allCorrect = quotientCols.every((c) => userQuotient[c] === quotient[c])
    onSubmit({
      correct: allCorrect,
      quotient: quotientCols.map((c) => userQuotient[c] ?? 0),
      remainder,
    })
    if (immersive) {
      setLocked(true)
      return
    }
    setGraded(true)
    setLastCorrect(allCorrect)
    if (allCorrect || attempt >= 1) setLocked(true)
    if (!allCorrect) {
      const wrongCol = quotientCols.find((c) => userQuotient[c] !== quotient[c])
      if (wrongCol !== undefined) {
        const wrongIdx = quotientCols.indexOf(wrongCol)
        if (wrongIdx >= 0) setActiveIdx(wrongIdx)
      }
    }
  }

  // Action key is value-based: 'Enter' jumps to the next empty 商 cell and only
  // becomes '✓' once every 商 cell is filled — so tapping cells out of order never
  // surfaces ✓ with blanks still open.
  const quotientComplete = quotientCols.every((c) => userQuotient[c] !== null)
  const handleAction = () => {
    if (quotientComplete) {
      handleCheck()
      return
    }
    const nextEmpty = quotientCols.findIndex((c) => userQuotient[c] === null)
    if (nextEmpty >= 0) setActiveIdx(nextEmpty)
  }

  // Subtraction work, column-aligned (product → underline → bring-down minuend → … → remainder).
  const workRows = useMemo<WorkRow[]>(() => {
    const rows: WorkRow[] = []
    steps.forEach((s, k) => {
      rows.push({ kind: 'digits', cells: placeDigits(s.product, s.col, n) })
      rows.push({ kind: 'line', from: s.col - String(s.product).length + 1, to: s.col })
      if (k < steps.length - 1) {
        rows.push({ kind: 'digits', cells: placeDigits(steps[k + 1].minuend, steps[k + 1].col, n) })
      } else {
        rows.push({ kind: 'digits', cells: placeDigits(s.diff, s.col, n) })
      }
    })
    return rows
  }, [steps, n])

  return (
    <div className={fill ? 'flex h-full w-full flex-col' : 'flex w-full flex-col'}>
      {/* Answer area — grows to fill, vertically centered above the keypad. In fill
          mode it's a size container so the 竖式 below can scale to its height. */}
      <div
        className={
          fill
            ? 'flex min-h-0 flex-1 flex-col items-center justify-center'
            : 'flex flex-col items-center'
        }
        style={fill ? { containerType: 'size' } : undefined}
      >
      {/* 厂字形 long division */}
      <div
        className={`rounded-2xl ${fill ? 'p-3' : 'p-4'}`}
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-start">
          {/* 除数 — pushed down to line up with the 被除数 row */}
          <div className="flex flex-col">
            <div style={{ height: divisorPad }} />
            <div className="flex items-center pr-2.5 font-black" style={{ height: cellPx, fontSize: cellFont, color: '#e9d5ff' }}>
              {divisor}
            </div>
          </div>

          {/* 商 (top) + 厂 bracket over 被除数 + work */}
          <div className="flex flex-col">
            {/* 商 */}
            <div className="flex pl-2 mb-1">
              {Array.from({ length: n }, (_, c) => {
                if (quotient[c] === null) return <div key={`q${c}`} style={cellSize} />
                const idx = quotientCols.indexOf(c)
                const isActive = !locked && idx === activeIdx
                const val = userQuotient[c]
                const correctVal = quotient[c] ?? 0
                const cellStyle = editableCellStyle({
                  isActive,
                  graded: graded && !immersive,
                  val,
                  correctVal,
                })
                return (
                  <button
                    key={`q${c}`}
                    type="button"
                    onClick={() => !disabled && !locked && setActiveIdx(idx)}
                    className={`${CELL_BASE} rounded-lg border-2 transition-all select-none active:scale-[0.93] ml-1`}
                    style={{
                      ...cellSize,
                      fontSize: cellFont,
                      ...cellStyle,
                    }}
                  >
                    {val !== null ? val : ''}
                  </button>
                )
              })}
            </div>

            {/* 厂 bracket: top line over 被除数 + left line; 被除数 and work sit inside */}
            <div className="rounded-tl-lg border-t-2 border-l-2 pl-2 pt-1" style={{ borderColor: BORDER }}>
              {/* 被除数 */}
              <div className="flex">
                {digits.map((d, c) => (
                  <div key={`d${c}`} className={CELL_BASE} style={{ ...cellSize, fontSize: cellFont, color: '#f5f3ff' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* subtraction work — only after a correct answer */}
              {locked && lastCorrect && (
                <div className="flex flex-col">
                  {workRows.map((row, ri) =>
                    row.kind === 'digits' ? (
                      <div key={`w${ri}`} className="flex">
                        {row.cells.map((ch, c) => (
                          <div key={c} className={CELL_BASE} style={{ ...cellSize, fontSize: cellFont, color: 'rgba(196,181,253,0.85)' }}>
                            {ch ?? ''}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div key={`w${ri}`} className="flex">
                        {Array.from({ length: n }, (_, c) => (
                          <div
                            key={c}
                            className="h-1"
                            style={
                              c >= row.from && c <= row.to
                                ? { width: cellPx, borderTop: `2px solid ${BORDER}` }
                                : { width: cellPx }
                            }
                          />
                        ))}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      <QuestionFeedbackHint feedback={immersive ? null : feedback} revealAnswer={revealAnswer} />

      {/* keypad — keep slot when locked so the layout does not jump */}
      <div className={`mx-auto grid w-full max-w-[320px] grid-cols-3 gap-2.5 ${fill ? 'shrink-0 pt-4' : 'mt-4'} ${locked ? VERTICAL_KEYPAD_LOCKED_CLASS : ''}`}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                disabled={disabled}
                onClick={() => handleDigit(d)}
                className="h-14 rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]"
                style={{ background: 'rgba(255,255,255,0.05)', color: disabled ? 'rgba(245,243,255,0.25)' : '#f5f3ff', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)' }}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={handleDelete}
              className="h-14 rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]"
              style={{ background: 'rgba(239,68,68,0.1)', color: disabled ? 'rgba(252,165,165,0.3)' : '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              ⌫
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleDigit(0)}
              className="h-14 rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]"
              style={{ background: 'rgba(255,255,255,0.05)', color: disabled ? 'rgba(245,243,255,0.25)' : '#f5f3ff', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)' }}
            >
              0
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleAction}
              className={`h-14 rounded-2xl font-black transition-all select-none active:scale-[0.93] ${!quotientComplete ? 'text-[15px]' : 'text-[24px]'}`}
              style={
                !quotientComplete
                  ? { background: 'rgba(139,92,246,0.18)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)', boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)' }
                  : { background: 'linear-gradient(135deg, #059669, #10b981)', color: '#ffffff', boxShadow: '0 4px 16px rgba(16,185,129,0.35)', border: '1px solid rgba(16,185,129,0.25)' }
              }
            >
              {!quotientComplete ? 'Enter' : '✓'}
            </button>
        </div>
    </div>
  )
}

export default DivisionVertical
