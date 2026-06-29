'use client'

import { useCallback, useMemo, useState } from 'react'
import { GONG_COLORS } from './utils/constants'
import type { ShulianProps } from './utils/types'
import { coordsToGrid, resolveGridSize } from './utils'
import { ActionButton, ColorPalette } from './shared'

export function ShulianGrid({ rows, cells, onSubmit, onStateChange }: ShulianProps) {
  const { rowCount, colCount } = useMemo(() => resolveGridSize(rows), [rows])
  const grid = useMemo(() => coordsToGrid(rowCount, colCount, cells), [rowCount, colCount, cells])

  const { numbers, numColor } = useMemo(() => {
    const nums: Record<number, { r: number; c: number }[]> = {}
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const v = grid[r][c]
        if (v > 0) {
          if (!nums[v]) nums[v] = []
          nums[v].push({ r, c })
        }
      }
    }
    const numList = Object.keys(nums)
      .map(Number)
      .sort((a, b) => a - b)
    const colorMap: Record<number, number> = {}
    numList.forEach((n, i) => {
      colorMap[n] = i % GONG_COLORS.length
    })
    return { numbers: nums, numColor: colorMap }
  }, [grid, rowCount, colCount])

  const [painted, setPainted] = useState<number[][]>(() =>
    Array.from({ length: rowCount }, () => Array(colCount).fill(0)),
  )
  const [selected, setSelected] = useState<number | null>(null)

  const paletteItems = useMemo(
    () =>
      Object.keys(numbers)
        .map(Number)
        .sort((a, b) => a - b)
        .map((n) => ({ key: n, label: n, colorIndex: numColor[n] })),
    [numbers, numColor],
  )

  const check = useCallback(() => {
    onSubmit?.({ painted })
  }, [painted, onSubmit])

  const selectColor = (n: number) => {
    setSelected((prev) => (prev === n ? null : n))
  }

  const paintCell = (r: number, c: number) => {
    const v = grid[r][c]
    if (v > 0) {
      selectColor(v)
      return
    }
    if (!selected) return
    setPainted((prev) => {
      const next = prev.map((row) => [...row])
      next[r][c] = next[r][c] === selected ? 0 : selected
      onStateChange?.({ painted: next })
      return next
    })
  }

  const reset = () => {
    const next = Array.from({ length: rowCount }, () => Array(colCount).fill(0))
    setPainted(next)
    onStateChange?.({ painted: next })
    setSelected(null)
  }

  const cellColor = (r: number, c: number) => {
    const v = grid[r][c]
    const owner = v > 0 ? v : painted[r][c]
    if (owner <= 0) return null
    return GONG_COLORS[numColor[owner] % GONG_COLORS.length]
  }

  return (
    <div>
      <ColorPalette
        items={paletteItems}
        selected={selected}
        onSelect={(k) => selectColor(k as number)}
      />
      <div className="flex justify-center">
        <table className="gong-table">
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: colCount }, (_, c) => {
                  const v = grid[r][c]
                  const col = cellColor(r, c)
                  return (
                    <td
                      key={c}
                      className={`gong-cell ${v > 0 ? 'cursor-default' : 'cursor-pointer'}`}
                      style={col ? { background: col.bg, color: col.text } : undefined}
                      onClick={() => paintCell(r, c)}
                    >
                      {v > 0 ? v : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex gap-2">
        <ActionButton variant="primary" onClick={check}>
          检查答案
        </ActionButton>
        <ActionButton variant="danger" onClick={reset}>
          重置
        </ActionButton>
      </div>
    </div>
  )
}
