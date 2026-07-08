'use client'

import { useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import { useProblemImageUrl } from '@rosie/math/hooks/useProblemImageUrl'
import {
  findSvgInHosts,
  loadHtmlImage,
  pickExportDomElement,
  rasterizeDomElement,
  rasterizeSvgElement,
} from './scratch-pad-figure'

type ScratchPadInsertFigureButtonProps = {
  problem: Problem
  onInsertFigure: (src: string, naturalW: number, naturalH: number) => void
  /** 题面图已渲染在页面上时传入，用于 SVG 栅格化 */
  figureHostRef?: React.RefObject<HTMLElement | null>
  /** 答题区自定义组件容器（竖式 grid / figure 包裹层） */
  answerExportRef?: React.RefObject<HTMLElement | null>
  className?: string
  compact?: boolean
  /** 顶栏紧凑样式（草稿浮层标题行） */
  header?: boolean
}

export default function ScratchPadInsertFigureButton({
  problem,
  onInsertFigure,
  figureHostRef,
  answerExportRef,
  className = '',
  compact = false,
  header = false,
}: ScratchPadInsertFigureButtonProps) {
  const [inserting, setInserting] = useState(false)
  const [failed, setFailed] = useState(false)
  const hiddenHostRef = useRef<HTMLDivElement>(null)
  const figureUrl = useProblemImageUrl(problem, 'figure')
  const hasFigure = Boolean(figureUrl || problem.figureNode)
  const hasAnswerExport = Boolean(problem.verticalPuzzle || answerExportRef)
  const canInsert = hasFigure || hasAnswerExport

  const handleInsert = async () => {
    if (inserting) return
    setInserting(true)
    setFailed(false)
    try {
      if (figureUrl) {
        const img = await loadHtmlImage(figureUrl)
        onInsertFigure(figureUrl, img.naturalWidth, img.naturalHeight)
        return
      }

      const hosts = [
        answerExportRef?.current,
        figureHostRef?.current,
        hiddenHostRef.current,
      ]

      const svg = findSvgInHosts(hosts)
      if (svg) {
        const raster = await rasterizeSvgElement(svg)
        if (raster) {
          onInsertFigure(raster.src, raster.width, raster.height)
          return
        }
      }

      const domTarget = pickExportDomElement(hosts)
      if (domTarget) {
        const raster = await rasterizeDomElement(domTarget)
        if (raster) {
          onInsertFigure(raster.src, raster.width, raster.height)
          return
        }
      }

      setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setInserting(false)
    }
  }

  if (!canInsert) return null

  const label = inserting ? '加入中' : failed ? '重试' : '加入画布'

  const defaultClass = header
    ? `shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
        failed
          ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100'
          : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-100'
      }`
    : compact
      ? `cursor-pointer rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold ring-1 transition-colors disabled:cursor-wait disabled:opacity-60 ${
          failed
            ? 'text-rose-600 ring-rose-200 hover:bg-rose-50'
            : 'text-indigo-600 ring-indigo-200 hover:bg-indigo-50'
        }`
      : `mt-2.5 w-full cursor-pointer rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
          failed
            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
        }`

  return (
    <>
      {!figureUrl && problem.figureNode && !figureHostRef && !answerExportRef && (
        <div
          ref={hiddenHostRef}
          className="pointer-events-none fixed top-0 -left-[9999px] w-[420px] opacity-0"
          aria-hidden
        >
          {problem.figureNode}
        </div>
      )}
      <button
        type="button"
        disabled={inserting}
        onClick={() => void handleInsert()}
        className={className || defaultClass}
      >
        {label}
      </button>
    </>
  )
}
