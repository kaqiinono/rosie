'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DuijiaoxianSudokuProps } from './utils/types'
import {
  coordsToGrid,
  isOnSudokuDiagonal,
  isRectBoxBorderBottom,
  isRectBoxBorderRight,
  readValuesDraft,
  resolveGridSize,
  resolveSudokuBoxDimensions,
} from './utils'
import { ActionButton } from './shared'

function emptyValues(rowCount: number, colCount: number, givenGrid: number[][]): string[][] {
  return Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: colCount }, (_, c) =>
      givenGrid[r][c] > 0 ? String(givenGrid[r][c]) : '',
    ),
  )
}

export function DuijiaoxianSudokuGrid({ rows, cells = [], onSubmit, onStateChange, initialState }: DuijiaoxianSudokuProps) {
  const { rowCount, colCount } = useMemo(() => resolveGridSize(rows), [rows])
  const boxDims = useMemo(
    () => resolveSudokuBoxDimensions(rowCount, colCount),
    [rowCount, colCount],
  )
  const digitPattern = useMemo(() => new RegExp(`[^1-${rowCount}]`, 'g'), [rowCount])
  const givenGrid = useMemo(
    () => coordsToGrid(rowCount, colCount, cells),
    [rowCount, colCount, cells],
  )
  const cellClass = rowCount <= 4 ? 'gong-cell' : 'gong-cell gong-cell-sm'
  const isSquare = rowCount === colCount

  const [values, setValues] = useState<string[][]>(() => {
    const draft = readValuesDraft(initialState)
    return draft ?? emptyValues(rowCount, colCount, givenGrid)
  })

  useEffect(() => {
    if (initialState) return
    setValues(emptyValues(rowCount, colCount, givenGrid))
  }, [rowCount, colCount, givenGrid, initialState])

  const setCell = (r: number, c: number, raw: string) => {
    const v = raw.replace(digitPattern, '').slice(0, 1)
    setValues((prev) => {
      const next = prev.map((row) => [...row])
      next[r][c] = v
      onStateChange?.({ values: next })
      return next
    })
  }

  const check = useCallback(() => {
    onSubmit?.({ values })
  }, [values, onSubmit])

  const reset = () => {
    const next = emptyValues(rowCount, colCount, givenGrid)
    setValues(next)
    onStateChange?.({ values: next })
  }

  return (
    <div>
      <div className="flex justify-center overflow-x-auto">
        <div className="relative inline-block">
          <table className="gong-table relative z-[1]">
            <tbody>
              {Array.from({ length: rowCount }, (_, r) => (
                <tr key={r}>
                  {Array.from({ length: colCount }, (_, c) => {
                    const isGiven = givenGrid[r][c] > 0
                    const onDiagonal = isSquare && isOnSudokuDiagonal(r, c, rowCount)
                    const boxClasses = boxDims
                      ? [
                          isRectBoxBorderRight(c, colCount, boxDims.boxCols) ? 'gong-box-r' : '',
                          isRectBoxBorderBottom(r, rowCount, boxDims.boxRows) ? 'gong-box-b' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')
                      : ''
                    return (
                      <td
                        key={c}
                        className={`${cellClass} ${boxClasses} ${isGiven ? '' : 'cursor-text'}`}
                        style={{
                          background: onDiagonal ? 'rgba(186,117,23,0.07)' : 'var(--gong-bg)',
                        }}
                      >
                        {isGiven ? (
                          <span className="font-semibold">{givenGrid[r][c]}</span>
                        ) : (
                          <input
                            type="text"
                            maxLength={1}
                            value={values[r][c]}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            className="h-full w-full border-none bg-transparent text-center font-medium outline-none"
                            style={{ color: 'var(--gong-blue)' }}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {isSquare && (
            <svg
              className="pointer-events-none absolute inset-0 z-[2]"
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <line
                x1="0"
                y1="0"
                x2="100"
                y2="100"
                stroke="rgba(186,117,23,0.55)"
                strokeWidth="1.2"
              />
              <line
                x1="100"
                y1="0"
                x2="0"
                y2="100"
                stroke="rgba(186,117,23,0.55)"
                strokeWidth="1.2"
              />
            </svg>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton variant="primary" onClick={check}>
          检查
        </ActionButton>
        <ActionButton variant="danger" onClick={reset}>
          重置
        </ActionButton>
      </div>
    </div>
  )
}
