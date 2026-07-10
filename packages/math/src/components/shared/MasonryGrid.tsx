'use client'

import { Children, useEffect, useMemo, useState, type ReactNode } from 'react'

const BREAKPOINTS = [
  { minWidth: 1024, cols: 3 },
  { minWidth: 640, cols: 2 },
  { minWidth: 0, cols: 1 },
] as const

function useMasonryColumns() {
  const [cols, setCols] = useState(1)

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      const match = BREAKPOINTS.find((b) => w >= b.minWidth) ?? BREAKPOINTS[BREAKPOINTS.length - 1]
      setCols(match.cols)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return cols
}

type MasonryGridProps = {
  children: ReactNode
  className?: string
}

/** Round-robin column masonry — cards stack vertically per column, filling gaps when one expands. */
export default function MasonryGrid({ children, className = '' }: MasonryGridProps) {
  const columnCount = useMasonryColumns()

  const columns = useMemo(() => {
    const items = Children.toArray(children)
    const cols: ReactNode[][] = Array.from({ length: columnCount }, () => [])
    items.forEach((child, i) => {
      cols[i % columnCount]!.push(child)
    })
    return cols
  }, [children, columnCount])

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      {columns.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-2">
          {col}
        </div>
      ))}
    </div>
  )
}
