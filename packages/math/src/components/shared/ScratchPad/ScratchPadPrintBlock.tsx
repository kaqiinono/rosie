'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScratchObject } from './scratch-pad-types'
import {
  layoutScratchContentTight,
  paintScratchContentTight,
  preloadScratchImages,
} from './scratch-pad-content-view'

const PRINT_MAX_WIDTH = 720

type ScratchPadPrintBlockProps = {
  objects: ScratchObject[]
}

/** Rasterize scratch pad for reliable printing */
export default function ScratchPadPrintBlock({ objects }: ScratchPadPrintBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  const rasterize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const layout = layoutScratchContentTight(objects, PRINT_MAX_WIDTH, 4000)
    if (!layout) {
      setDataUrl(null)
      return
    }

    const dpr = 2
    canvas.width = Math.floor(layout.displayW * dpr)
    canvas.height = Math.floor(layout.displayH * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paintScratchContentTight(ctx, objects, layout, new Map())

    setDataUrl(canvas.toDataURL('image/png'))
  }, [objects])

  useEffect(() => {
    let cancelPreload = () => {}
    const imageCache = new Map<string, HTMLImageElement>()

    const paintWithCache = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const layout = layoutScratchContentTight(objects, PRINT_MAX_WIDTH, 4000)
      if (!layout) {
        setDataUrl(null)
        return
      }
      const dpr = 2
      canvas.width = Math.floor(layout.displayW * dpr)
      canvas.height = Math.floor(layout.displayH * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintScratchContentTight(ctx, objects, layout, imageCache)
      setDataUrl(canvas.toDataURL('image/png'))
    }

    void preloadScratchImages(objects, imageCache, paintWithCache).then((cancel) => {
      cancelPreload = cancel
    })
    paintWithCache()
    return () => cancelPreload()
  }, [objects, rasterize])

  if (objects.length === 0) return null

  return (
    <>
      <canvas ref={canvasRef} className="hidden" aria-hidden />
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="作答草稿"
          className="print-scratch-img block max-w-full h-auto"
        />
      ) : (
        <p className="text-xs text-slate-400 print:hidden">草稿生成中…</p>
      )}
    </>
  )
}
