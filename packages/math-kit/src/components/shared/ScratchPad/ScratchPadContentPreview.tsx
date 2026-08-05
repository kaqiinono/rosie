'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { ScratchObject } from './scratch-pad-types'
import {
  layoutScratchContentTight,
  paintScratchContentTight,
  preloadScratchImages,
} from './scratch-pad-content-view'

const MAX_DISPLAY_HEIGHT = 560

type ScratchPadContentPreviewProps = {
  objects: ScratchObject[]
}

/** Read-only preview — entire draft scaled to fit, no chrome */
export default function ScratchPadContentPreview({ objects }: ScratchPadContentPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const maxWidth = container.clientWidth
    if (maxWidth <= 0) return

    const layout = layoutScratchContentTight(objects, maxWidth, MAX_DISPLAY_HEIGHT)
    if (!layout) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(layout.displayW * dpr)
    canvas.height = Math.floor(layout.displayH * dpr)
    canvas.style.width = `${layout.displayW}px`
    canvas.style.height = `${layout.displayH}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paintScratchContentTight(ctx, objects, layout, imageCacheRef.current)
  }, [objects])

  useEffect(() => {
    let cancelPreload = () => {}
    void preloadScratchImages(objects, imageCacheRef.current, paint).then((cancel) => {
      cancelPreload = cancel
    })
    paint()
    return () => cancelPreload()
  }, [objects, paint])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => paint())
    ro.observe(el)
    return () => ro.disconnect()
  }, [paint])

  if (objects.length === 0) return null
  if (!layoutScratchContentTight(objects, 320, MAX_DISPLAY_HEIGHT)) return null

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <canvas ref={canvasRef} className="block max-w-full rounded-lg" />
    </div>
  )
}
