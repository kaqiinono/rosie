'use client'

import { useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import { useProblemImageUrl } from '@rosie/math/hooks/useProblemImageUrl'
import { loadHtmlImage, rasterizeSvgElement } from './scratch-pad-figure'

type ScratchPadInsertFigureButtonProps = {
  problem: Problem
  onInsertFigure: (src: string, naturalW: number, naturalH: number) => void
  /** 题面图已渲染在页面上时传入，用于 SVG 栅格化 */
  figureHostRef?: React.RefObject<HTMLElement | null>
  className?: string
  compact?: boolean
}

export default function ScratchPadInsertFigureButton({
  problem,
  onInsertFigure,
  figureHostRef,
  className = '',
  compact = false,
}: ScratchPadInsertFigureButtonProps) {
  const [inserting, setInserting] = useState(false)
  const hiddenHostRef = useRef<HTMLDivElement>(null)
  const figureUrl = useProblemImageUrl(problem, 'figure')
  const hasFigure = Boolean(figureUrl || problem.figureNode)

  const handleInsert = async () => {
    if (inserting) return
    setInserting(true)
    try {
      if (figureUrl) {
        const img = await loadHtmlImage(figureUrl)
        onInsertFigure(figureUrl, img.naturalWidth, img.naturalHeight)
        return
      }
      const svg = figureHostRef?.current?.querySelector('svg') ?? hiddenHostRef.current?.querySelector('svg')
      if (!svg) return
      const raster = await rasterizeSvgElement(svg)
      if (raster) onInsertFigure(raster.src, raster.width, raster.height)
    } catch {
      // ignore
    } finally {
      setInserting(false)
    }
  }

  if (!hasFigure) return null

  return (
    <>
      {!figureUrl && problem.figureNode && !figureHostRef && (
        <div ref={hiddenHostRef} className="pointer-events-none fixed -left-[9999px] top-0 w-[360px] opacity-0" aria-hidden>
          {problem.figureNode}
        </div>
      )}
      <button
        type="button"
        disabled={inserting}
        onClick={() => void handleInsert()}
        className={
          className ||
          (compact
            ? 'cursor-pointer rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-600 ring-1 ring-indigo-200 transition-colors hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-60'
            : 'mt-2.5 w-full cursor-pointer rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[13px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60')
        }
      >
        {inserting ? '正在加入…' : '加入画布'}
      </button>
    </>
  )
}
