'use client'

import { useCallback, useMemo, useState } from 'react'
import { BRIDGE_CELL, BRIDGE_PAD, GONG_COLORS, ISLAND_RADIUS } from './utils/constants'
import type { BridgeIsland, ShuqiaoProps } from './utils/types'
import { bridgeKey, islandCoordKey, resolveGridSize } from './utils'
import { ActionButton } from './shared'

function canConnect(islands: BridgeIsland[], ia: BridgeIsland, ib: BridgeIsland): boolean {
  if (ia.row === ib.row) {
    const minC = Math.min(ia.col, ib.col)
    const maxC = Math.max(ia.col, ib.col)
    for (const isl of islands) {
      if (
        !(isl.row === ia.row && isl.col === ia.col) &&
        !(isl.row === ib.row && isl.col === ib.col) &&
        isl.row === ia.row &&
        isl.col > minC &&
        isl.col < maxC
      ) {
        return false
      }
    }
    return true
  }
  if (ia.col === ib.col) {
    const minR = Math.min(ia.row, ib.row)
    const maxR = Math.max(ia.row, ib.row)
    for (const isl of islands) {
      if (
        !(isl.row === ia.row && isl.col === ia.col) &&
        !(isl.row === ib.row && isl.col === ib.col) &&
        isl.col === ia.col &&
        isl.row > minR &&
        isl.row < maxR
      ) {
        return false
      }
    }
    return true
  }
  return false
}

function bridgesCross(islandMap: Record<string, BridgeIsland>, k1: string, k2: string): boolean {
  if (k1 === k2) return false
  const [a1, b1] = k1.split('-')
  const [a2, b2] = k2.split('-')
  const i1a = islandMap[a1]
  const i1b = islandMap[b1]
  const i2a = islandMap[a2]
  const i2b = islandMap[b2]
  if (!i1a || !i1b || !i2a || !i2b) return false
  const h1 = i1a.row === i1b.row
  const h2 = i2a.row === i2b.row
  if (h1 === h2) return false
  const hB = h1
    ? { r: i1a.row, c1: Math.min(i1a.col, i1b.col), c2: Math.max(i1a.col, i1b.col) }
    : { r: i2a.row, c1: Math.min(i2a.col, i2b.col), c2: Math.max(i2a.col, i2b.col) }
  const vB = h1
    ? { c: i2a.col, r1: Math.min(i2a.row, i2b.row), r2: Math.max(i2a.row, i2b.row) }
    : { c: i1a.col, r1: Math.min(i1a.row, i1b.row), r2: Math.max(i1a.row, i1b.row) }
  return vB.c > hB.c1 && vB.c < hB.c2 && hB.r > vB.r1 && hB.r < vB.r2
}

function getUsedBridges(island: BridgeIsland, current: Record<string, number>): number {
  const self = islandCoordKey(island.row, island.col)
  return Object.entries(current)
    .filter(([k, v]) => v > 0 && k.split('-').includes(self))
    .reduce((s, [, v]) => s + v, 0)
}

export function ShuqiaoGrid({ rows, cells, onSubmit, onStateChange }: ShuqiaoProps) {
  const { rowCount, colCount } = useMemo(() => resolveGridSize(rows), [rows])
  const islands = useMemo(
    () =>
      cells.map(([row, col, bridges]) => ({
        row,
        col,
        bridges,
      })),
    [cells],
  )

  const islandMap = useMemo(() => {
    const map: Record<string, BridgeIsland> = {}
    islands.forEach((i) => {
      map[islandCoordKey(i.row, i.col)] = i
    })
    return map
  }, [islands])

  const [bridges, setBridges] = useState<Record<string, number>>({})

  const W = colCount * BRIDGE_CELL + BRIDGE_PAD * 2
  const H = rowCount * BRIDGE_CELL + BRIDGE_PAD * 2

  const toX = (c: number) => BRIDGE_PAD + (c - 1) * BRIDGE_CELL
  const toY = (r: number) => BRIDGE_PAD + (r - 1) * BRIDGE_CELL

  const clickBridge = (ia: BridgeIsland, ib: BridgeIsland) => {
    const key = bridgeKey(ia, ib)
    const cur = bridges[key] || 0
    const nextCount = cur >= 2 ? 0 : cur + 1

    if (nextCount > 0) {
      for (const [k, cnt] of Object.entries(bridges)) {
        if (cnt > 0 && bridgesCross(islandMap, key, k)) {
          return
        }
      }
      const trial = { ...bridges, [key]: nextCount }
      const aUsed = getUsedBridges(ia, trial)
      const bUsed = getUsedBridges(ib, trial)
      if (aUsed > ia.bridges || bUsed > ib.bridges) {
        setBridges({})
        return
      }
    }

    setBridges((prev) => {
      const next = { ...prev }
      if (nextCount === 0) delete next[key]
      else next[key] = nextCount
      onStateChange?.({ bridges: next })
      return next
    })
  }

  const check = useCallback(() => {
    onSubmit?.({ bridges })
  }, [bridges, onSubmit])

  const reset = () => {
    const next = {}
    setBridges(next)
    onStateChange?.({ bridges: next })
  }

  const bridgeLines: React.ReactNode[] = []
  for (const [key, cnt] of Object.entries(bridges)) {
    if (cnt === 0) continue
    const [aKey, bKey] = key.split('-')
    const ia = islandMap[aKey]
    const ib = islandMap[bKey]
    if (!ia || !ib) continue
    const x1 = toX(ia.col)
    const y1 = toY(ia.row)
    const x2 = toX(ib.col)
    const y2 = toY(ib.row)
    const off = cnt === 2 ? 4 : 0
    if (ia.row === ib.row) {
      if (cnt === 1) {
        bridgeLines.push(
          <line
            key={key}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--gong-blue)"
            strokeWidth={3}
            strokeLinecap="round"
          />,
        )
      } else {
        bridgeLines.push(
          <g key={key}>
            <line
              x1={x1}
              y1={y1 - off}
              x2={x2}
              y2={y2 - off}
              stroke="var(--gong-blue)"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <line
              x1={x1}
              y1={y1 + off}
              x2={x2}
              y2={y2 + off}
              stroke="var(--gong-blue)"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </g>,
        )
      }
    } else if (cnt === 1) {
      bridgeLines.push(
        <line
          key={key}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="var(--gong-blue)"
          strokeWidth={3}
          strokeLinecap="round"
        />,
      )
    } else {
      bridgeLines.push(
        <g key={key}>
          <line
            x1={x1 - off}
            y1={y1}
            x2={x2 - off}
            y2={y2}
            stroke="var(--gong-blue)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <line
            x1={x1 + off}
            y1={y1}
            x2={x2 + off}
            y2={y2}
            stroke="var(--gong-blue)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </g>,
      )
    }
  }

  const clickZones: React.ReactNode[] = []
  for (let i = 0; i < islands.length; i++) {
    for (let j = i + 1; j < islands.length; j++) {
      const ia = islands[i]
      const ib = islands[j]
      if (!canConnect(islands, ia, ib)) continue
      const x1 = toX(ia.col)
      const y1 = toY(ia.row)
      const x2 = toX(ib.col)
      const y2 = toY(ib.row)
      const dx = x2 - x1
      const dy = y2 - y1
      const dist = Math.sqrt(dx * dx + dy * dy)
      const ux = dx / dist
      const uy = dy / dist
      const cx1 = x1 + ux * ISLAND_RADIUS
      const cy1 = y1 + uy * ISLAND_RADIUS
      const cx2 = x2 - ux * ISLAND_RADIUS
      const cy2 = y2 - uy * ISLAND_RADIUS
      const zoneKey = bridgeKey(ia, ib)
      clickZones.push(
        <line
          key={zoneKey}
          x1={cx1}
          y1={cy1}
          x2={cx2}
          y2={cy2}
          stroke="transparent"
          strokeWidth={20}
          className="cursor-pointer"
          onClick={() => clickBridge(ia, ib)}
        />,
      )
    }
  }

  return (
    <div>
      <div className="flex justify-center">
        <svg width={W} height={H} className="rounded-[10px] bg-[var(--gong-bg)]">
          {clickZones}
          {bridgeLines}
          {islands.map((isl, idx) => {
            const x = toX(isl.col)
            const y = toY(isl.row)
            const used = getUsedBridges(isl, bridges)
            const full = used === isl.bridges
            const color = GONG_COLORS[idx % GONG_COLORS.length]
            return (
              <g key={islandCoordKey(isl.row, isl.col)}>
                <circle
                  cx={x}
                  cy={y}
                  r={ISLAND_RADIUS}
                  fill={full ? 'var(--gong-accent-l)' : color.bg}
                  stroke={full ? 'var(--gong-accent)' : color.border}
                  strokeWidth={2}
                />
                <text
                  x={x}
                  y={y + 6}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight={600}
                  fill={full ? 'var(--gong-accent)' : color.text}
                >
                  {isl.bridges}
                </text>
              </g>
            )
          })}
        </svg>
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
