'use client'

import { useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import { Button } from '@rosie/ui/themes'
import { useProblemImageUrl } from '@rosie/math-kit/hooks/useProblemImageUrl'
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

      const hosts = [answerExportRef?.current, figureHostRef?.current, hiddenHostRef.current]

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

  const buttonProps = header
    ? ({ size: '1', variant: 'soft' } as const)
    : compact
      ? ({ size: '1', variant: 'outline' } as const)
      : ({ size: '2', variant: 'soft' } as const)
  const layoutClass = header || compact ? 'shrink-0' : 'mt-2.5 w-full'

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
      <Button
        type="button"
        {...buttonProps}
        radius="full"
        color={failed ? 'ruby' : 'indigo'}
        className={className || layoutClass}
        disabled={inserting}
        onClick={() => void handleInsert()}
      >
        {label}
      </Button>
    </>
  )
}
