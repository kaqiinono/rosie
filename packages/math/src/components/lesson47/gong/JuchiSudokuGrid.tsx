'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildJuchiLineSets, getJuchiCellBorderStyle } from './utils/juchi'
import type { JuchiSudokuProps } from './utils/types'
import { coordsToGrid, resolveGridSize } from './utils'
import { ActionButton } from './shared'

function emptyValues(rowCount: number, colCount: number, givenGrid: number[][]): string[][] {
  return Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: colCount }, (_, c) =>
      givenGrid[r][c] > 0 ? String(givenGrid[r][c]) : '',
    ),
  )
}

export function JuchiSudokuGrid({
  rows,
  cells = [],
  hLine = [],
  vLine = [],
  onSubmit,
  onStateChange,
}: JuchiSudokuProps) {
  const { rowCount, colCount } = useMemo(() => resolveGridSize(rows), [rows])
  const digitPattern = useMemo(() => new RegExp(`[^1-${rowCount}]`, 'g'), [rowCount])
  const givenGrid = useMemo(
    () => coordsToGrid(rowCount, colCount, cells),
    [rowCount, colCount, cells],
  )
  const { hSet, vSet } = useMemo(
    () => buildJuchiLineSets(hLine, vLine, rowCount, colCount),
    [hLine, vLine, rowCount, colCount],
  )
  const cellClass = rowCount <= 4 ? 'gong-cell' : 'gong-cell gong-cell-sm'

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
        <table className="gong-table border-none">
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: colCount }, (_, c) => {
                  const isGiven = givenGrid[r][c] > 0
                  const borderStyle = getJuchiCellBorderStyle(r, c, rowCount, colCount, hSet, vSet)
                  return (
                    <td
                      key={c}
                      className={`${cellClass} ${isGiven ? '' : 'cursor-text'}`}
                      style={borderStyle}
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
