'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChuangkouSudokuProps } from './utils/types'
import {
  coordsToGrid,
  isInWindowRegions,
  isSudokuBoxBorderBottom,
  isSudokuBoxBorderRight,
  parseChuangkouWindows,
  resolveChuangkouWindow,
  resolveGridSize,
  sudokuBoxSize,
} from './utils'
import { ActionButton } from './shared'

function emptyValues(rowCount: number, colCount: number, givenGrid: number[][]): string[][] {
  return Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: colCount }, (_, c) =>
      givenGrid[r][c] > 0 ? String(givenGrid[r][c]) : '',
    ),
  )
}

export function ChuangkouSudokuGrid({ rows, cells = [], window, onSubmit, onStateChange }: ChuangkouSudokuProps) {
  const { rowCount, colCount } = useMemo(() => resolveGridSize(rows), [rows])
  const boxSize = sudokuBoxSize(rowCount === colCount ? rowCount : 0)
  const digitPattern = useMemo(() => new RegExp(`[^1-${rowCount}]`, 'g'), [rowCount])
  const resolvedWindow = useMemo(
    () => resolveChuangkouWindow(rowCount, colCount, window),
    [rowCount, colCount, window],
  )
  const windowRegions = useMemo(() => parseChuangkouWindows(resolvedWindow), [resolvedWindow])
  const givenGrid = useMemo(
    () => coordsToGrid(rowCount, colCount, cells),
    [rowCount, colCount, cells],
  )

  const [values, setValues] = useState<string[][]>(() => emptyValues(rowCount, colCount, givenGrid))

  useEffect(() => {
    setValues(emptyValues(rowCount, colCount, givenGrid))
  }, [rowCount, colCount, givenGrid])

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
        <table className="gong-table">
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: colCount }, (_, c) => {
                  const isGiven = givenGrid[r][c] > 0
                  const inWindow = isInWindowRegions(r, c, windowRegions)
                  const boxClasses = [
                    boxSize > 0 && isSudokuBoxBorderRight(c, colCount, boxSize) ? 'gong-box-r' : '',
                    boxSize > 0 && isSudokuBoxBorderBottom(r, rowCount, boxSize)
                      ? 'gong-box-b'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <td
                      key={c}
                      className={`gong-cell gong-cell-sm ${boxClasses} ${isGiven ? '' : 'cursor-text'}`}
                      style={{
                        background: inWindow ? 'rgba(186,117,23,0.09)' : 'var(--gong-bg)',
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
                          className="h-full w-full border-none bg-transparent text-center text-[15px] font-medium outline-none"
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
