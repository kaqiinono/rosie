'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { GONG_COLORS } from './utils/constants'
import { buildBudengIneqMaps, resolveBudengGridSize } from './utils/budeng'
import type { BudengSudokuProps, InequalityOp } from './utils/types'
import {
  coordsToGrid,
  isRectBoxBorderBottom,
  isRectBoxBorderRight,
  resolveSudokuBoxDimensions,
} from './utils'
import { ActionButton } from './shared'

function displayIneq(op: InequalityOp, vertical: boolean): string {
  if (!op) return ''
  if (vertical) return op === '<' ? '∧' : '∨'
  return op
}

function getBoxBackground(
  r: number,
  c: number,
  rowCount: number,
  colCount: number,
  boxDims: { boxRows: number; boxCols: number } | null,
): string {
  if (!boxDims || rowCount !== colCount) return 'var(--gong-bg)'
  const { boxRows, boxCols } = boxDims
  const boxesPerCol = colCount / boxCols
  const boxIndex = Math.floor(r / boxRows) * boxesPerCol + Math.floor(c / boxCols)
  return GONG_COLORS[boxIndex % GONG_COLORS.length].bg
}

function getBoxBorderClasses(
  r: number,
  c: number,
  rowCount: number,
  colCount: number,
  boxDims: { boxRows: number; boxCols: number } | null,
): string {
  if (!boxDims) return ''
  return [
    isRectBoxBorderRight(c, colCount, boxDims.boxCols) ? 'gong-box-r' : '',
    isRectBoxBorderBottom(r, rowCount, boxDims.boxRows) ? 'gong-box-b' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function emptyValues(rowCount: number, colCount: number, givenGrid: number[][]): string[][] {
  return Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: colCount }, (_, c) =>
      givenGrid[r][c] > 0 ? String(givenGrid[r][c]) : '',
    ),
  )
}

export function BudengSudokuGrid({
  rows,
  hIneq = [],
  vIneq = [],
  cells = [],
  onSubmit,
  onStateChange,
}: BudengSudokuProps) {
  const { rowCount, colCount } = useMemo(() => resolveBudengGridSize(rows), [rows])
  const boxDims = useMemo(
    () => resolveSudokuBoxDimensions(rowCount, colCount),
    [rowCount, colCount],
  )
  const digitPattern = useMemo(() => new RegExp(`[^1-${rowCount}]`, 'g'), [rowCount])

  const { hMap, vMap } = useMemo(
    () => buildBudengIneqMaps(hIneq, vIneq, rowCount, colCount),
    [hIneq, vIneq, rowCount, colCount],
  )
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

  const cellPx = rowCount <= 3 ? 52 : rowCount >= 5 ? 40 : 46

  return (
    <div>
      <div className="flex justify-center">
        <table className="border-collapse">
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => (
              <Fragment key={`group-${r}`}>
                <tr>
                  {Array.from({ length: colCount }, (_, c) => (
                    <Fragment key={`cell-group-${r}-${c}`}>
                      <td
                        className={`relative border border-[var(--gong-border2)] text-center align-middle ${getBoxBorderClasses(r, c, rowCount, colCount, boxDims)}`}
                        style={{
                          width: cellPx,
                          height: cellPx,
                          background: getBoxBackground(r, c, rowCount, colCount, boxDims),
                        }}
                      >
                        {givenGrid[r][c] > 0 ? (
                          <span className="text-lg font-semibold">{givenGrid[r][c]}</span>
                        ) : (
                          <input
                            type="text"
                            maxLength={1}
                            value={values[r]?.[c] ?? ''}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            className="h-full w-full border-none bg-transparent text-center text-xl font-semibold outline-none"
                            style={{ color: 'var(--gong-blue)' }}
                          />
                        )}
                      </td>
                      {c < colCount - 1 && (
                        <td className="w-5 border-none text-center text-sm font-bold text-[var(--gong-coral)]">
                          {displayIneq(hMap[r]?.[c] ?? null, false)}
                        </td>
                      )}
                    </Fragment>
                  ))}
                </tr>
                {r < rowCount - 1 && (
                  <tr>
                    {Array.from({ length: colCount }, (_, c) => (
                      <Fragment key={`v-group-${r}-${c}`}>
                        <td className="h-[18px] border-none text-center text-xs font-bold text-[var(--gong-coral)]">
                          {displayIneq(vMap[r]?.[c] ?? null, true)}
                        </td>
                        {c < colCount - 1 && <td className="w-5 border-none" />}
                      </Fragment>
                    ))}
                  </tr>
                )}
              </Fragment>
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
