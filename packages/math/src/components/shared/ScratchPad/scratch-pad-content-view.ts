import type { ScratchObject } from './scratch-pad-types'
import { allObjectsBounds } from './scratch-pad-geometry'
import { renderScratchObject } from './scratch-pad-render'
import { loadHtmlImage } from './scratch-pad-figure'

const CONTENT_PAD = 12

export type ScratchTightLayout = {
  displayW: number
  displayH: number
  scale: number
  offsetX: number
  offsetY: number
}

/** Fit full content into max box; canvas size = content bounds × scale (minimal whitespace). */
export function layoutScratchContentTight(
  objects: ScratchObject[],
  maxWidth: number,
  maxHeight: number,
  padding = CONTENT_PAD,
): ScratchTightLayout | null {
  const bounds = allObjectsBounds(objects, padding)
  if (!bounds || maxWidth <= 0 || maxHeight <= 0) return null

  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  if (contentW <= 0.5 || contentH <= 0.5) return null

  const scale = Math.min(maxWidth / contentW, maxHeight / contentH)
  return {
    scale,
    displayW: Math.max(1, Math.ceil(contentW * scale)),
    displayH: Math.max(1, Math.ceil(contentH * scale)),
    offsetX: -bounds.minX * scale,
    offsetY: -bounds.minY * scale,
  }
}

export function paintScratchContentTight(
  ctx: CanvasRenderingContext2D,
  objects: ScratchObject[],
  layout: ScratchTightLayout,
  imageCache: ReadonlyMap<string, HTMLImageElement>,
  background = '#fafafa',
) {
  ctx.fillStyle = background
  ctx.fillRect(0, 0, layout.displayW, layout.displayH)
  ctx.save()
  ctx.translate(layout.offsetX, layout.offsetY)
  ctx.scale(layout.scale, layout.scale)
  for (const obj of objects) {
    renderScratchObject(ctx, obj, imageCache)
  }
  ctx.restore()
}

export async function preloadScratchImages(
  objects: ScratchObject[],
  imageCache: Map<string, HTMLImageElement>,
  onReady: () => void,
): Promise<() => void> {
  let cancelled = false
  const loading = new Set<string>()

  for (const obj of objects) {
    if (obj.kind !== 'image') continue
    const cached = imageCache.get(obj.src)
    if (cached?.complete && cached.naturalWidth > 0) continue
    if (loading.has(obj.src)) continue
    loading.add(obj.src)
    void loadHtmlImage(obj.src)
      .then((img) => {
        if (cancelled) return
        imageCache.set(obj.src, img)
        onReady()
      })
      .catch(() => {})
  }

  return () => {
    cancelled = true
  }
}
