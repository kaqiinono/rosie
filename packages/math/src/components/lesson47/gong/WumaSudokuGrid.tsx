'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { WumaSudokuProps } from './utils/types'
import {
  cellCoordKey,
  coordsToGrid,
  getKnightCells,
  isRectBoxBorderBottom,
  isRectBoxBorderRight,
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

export function WumaSudokuGrid({ rows, cells = [], onSubmit, onStateChange }: WumaSudokuProps) {
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

  const [values, setValues] = useState<string[][]>(() => emptyValues(rowCount, colCount, givenGrid))
  const [knightMode, setKnightMode] = useState(false)
  const [knightFocus, setKnightFocus] = useState<{ r: number; c: number } | null>(null)

  const knightTargetKeys = useMemo(() => {
    if (!knightFocus) return new Set<string>()
    return new Set(
      getKnightCells(knightFocus.r, knightFocus.c, rowCount, colCount).map(({ r, c }) =>
        cellCoordKey(r, c),
      ),
    )
  }, [knightFocus, rowCount, colCount])

  useEffect(() => {
    setValues(emptyValues(rowCount, colCount, givenGrid))
    setKnightFocus(null)
  }, [rowCount, colCount, givenGrid])

  const setCell = (r: number, c: number, raw: string) => {
    if (knightMode) return
    const v = raw.replace(digitPattern, '').slice(0, 1)
    setValues((prev) => {
      const next = prev.map((row) => [...row])
      next[r][c] = v
      onStateChange?.({ values: next })
      return next
    })
  }

  const handleCellClick = (r: number, c: number) => {
    if (!knightMode) return
    setKnightFocus((prev) => (prev?.r === r && prev?.c === c ? null : { r, c }))
  }

  const toggleKnightMode = () => {
    setKnightMode((on) => {
      if (on) setKnightFocus(null)
      return !on
    })
  }

  const getKnightHighlightStyle = (r: number, c: number): CSSProperties | undefined => {
    if (!knightMode || !knightFocus) return undefined
    const key = cellCoordKey(r, c)
    if (knightFocus.r === r && knightFocus.c === c) {
      return {
        background: 'var(--gong-warn-l)',
        boxShadow: 'inset 0 0 0 2px var(--gong-warn)',
      }
    }
    if (knightTargetKeys.has(key)) {
      return { background: 'var(--gong-purple-l)' }
    }
    return undefined
  }

  const check = useCallback(() => {
    onSubmit?.({ values })
  }, [values, onSubmit])

  const reset = () => {
    const next = emptyValues(rowCount, colCount, givenGrid)
    setValues(next)
    onStateChange?.({ values: next })
    setKnightFocus(null)
  }

  return (
    <div>
      <label className="mb-3 flex cursor-pointer items-center gap-2.5 text-sm text-[var(--gong-text2)]">
        <button
          type="button"
          role="switch"
          aria-checked={knightMode}
          onClick={toggleKnightMode}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
            knightMode
              ? 'border-[var(--gong-purple)] bg-[var(--gong-purple)]'
              : 'border-[var(--gong-border2)] bg-[var(--gong-bg3)]'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
              knightMode ? 'translate-x-5' : ''
            }`}
          />
        </button>
        <span>显示马步</span>
        {knightMode && (
          <span className="text-xs text-[var(--gong-text3)]">
            点击格子查看马步可达位置（不可填数）
          </span>
        )}
      </label>

      <div className="flex justify-center overflow-x-auto">
        <table className="gong-table">
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: colCount }, (_, c) => {
                  const isGiven = givenGrid[r][c] > 0
                  const key = cellCoordKey(r, c)
                  const isKnightCenter = knightMode && knightFocus?.r === r && knightFocus?.c === c
                  const isKnightTarget = knightMode && knightTargetKeys.has(key)
                  const boxClasses = boxDims
                    ? [
                        isRectBoxBorderRight(c, colCount, boxDims.boxCols) ? 'gong-box-r' : '',
                        isRectBoxBorderBottom(r, rowCount, boxDims.boxRows) ? 'gong-box-b' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : ''
                  const knightStyle = getKnightHighlightStyle(r, c)
                  const displayValue = isGiven ? String(givenGrid[r][c]) : values[r][c]

                  return (
                    <td
                      key={c}
                      className={`${cellClass} ${boxClasses} ${
                        knightMode ? 'cursor-pointer select-none' : isGiven ? '' : 'cursor-text'
                      }`}
                      style={knightStyle}
                      onClick={() => handleCellClick(r, c)}
                    >
                      {knightMode || isGiven ? (
                        <span
                          className="font-semibold"
                          style={{
                            color: isKnightCenter
                              ? 'var(--gong-warn)'
                              : isKnightTarget
                                ? 'var(--gong-purple)'
                                : 'var(--gong-text)',
                          }}
                        >
                          {displayValue}
                          {knightMode && isKnightTarget && !displayValue ? '★' : ''}
                        </span>
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

      {knightMode && knightFocus && (
        <p className="mt-2 text-center text-xs text-[var(--gong-text3)]">
          已选第 {knightFocus.r + 1} 行第 {knightFocus.c + 1} 列，紫色为马步可达格（共{' '}
          {knightTargetKeys.size} 格）
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton variant="primary" onClick={check} disabled={knightMode}>
          检查
        </ActionButton>
        <ActionButton variant="danger" onClick={reset}>
          重置
        </ActionButton>
      </div>
    </div>
  )
}
