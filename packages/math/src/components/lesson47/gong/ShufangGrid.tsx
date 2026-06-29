'use client'

import { useCallback, useMemo, useState } from 'react'
import { GONG_COLORS } from './utils/constants'
import type { ShufangProps } from './utils/types'
import { coordsToGrid, resolveGridSize } from './utils'
import { ActionButton, ColorPalette } from './shared'

function regionId(r: number, c: number): string {
  return `${r},${c}`
}

export function ShufangGrid({ rows, cells, onSubmit, onStateChange }: ShufangProps) {
  const { rowCount, colCount } = useMemo(() => resolveGridSize(rows), [rows])
  const grid = useMemo(() => coordsToGrid(rowCount, colCount, cells), [rowCount, colCount, cells])

  const { regionColor, paletteItems } = useMemo(() => {
    const clues: { key: string; label: number; colorIndex: number }[] = []
    const colorMap: Record<string, number> = {}
    let idx = 0
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        if (grid[r][c] > 0) {
          const key = regionId(r, c)
          colorMap[key] = idx % GONG_COLORS.length
          clues.push({ key, label: grid[r][c], colorIndex: colorMap[key] })
          idx++
        }
      }
    }
    return { regionColor: colorMap, paletteItems: clues }
  }, [grid, rowCount, colCount])

  const [painted, setPainted] = useState<(string | null)[][]>(() =>
    Array.from({ length: rowCount }, () => Array<string | null>(colCount).fill(null)),
  )
  const [selected, setSelected] = useState<string | null>(null)

  const selectColor = (key: string) => {
    setSelected((prev) => (prev === key ? null : key))
  }

  const paintCell = (r: number, c: number) => {
    if (grid[r][c] > 0) {
      selectColor(regionId(r, c))
      return
    }
    if (!selected) return
    setPainted((prev) => {
      const next = prev.map((row) => [...row])
      next[r][c] = next[r][c] === selected ? null : selected
      onStateChange?.({ painted: next })
      return next
    })
  }

  const check = useCallback(() => {
    onSubmit?.({ painted })
  }, [painted, onSubmit])

  const reset = () => {
    const next = Array.from({ length: rowCount }, () => Array<string | null>(colCount).fill(null))
    setPainted(next)
    onStateChange?.({ painted: next })
    setSelected(null)
  }

  const cellStyle = (r: number, c: number) => {
    const id = grid[r][c] > 0 ? regionId(r, c) : painted[r][c]
    if (!id) return undefined
    const col = GONG_COLORS[regionColor[id] % GONG_COLORS.length]
    return { background: col.bg, color: col.text }
  }

  return (
    <div>
      {paletteItems.length > 0 && (
        <ColorPalette
          items={paletteItems}
          selected={selected}
          onSelect={(k) => selectColor(String(k))}
        />
      )}
      <div className="flex justify-center">
        <table className="gong-table">
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: colCount }, (_, c) => {
                  const v = grid[r][c]
                  return (
                    <td
                      key={c}
                      className={`gong-cell ${v > 0 ? 'cursor-default' : 'cursor-pointer'}`}
                      style={cellStyle(r, c)}
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
