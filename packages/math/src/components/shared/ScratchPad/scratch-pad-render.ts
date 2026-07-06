import type { ScratchObject } from './scratch-pad-types'
import { scratchObjectBounds } from './scratch-pad-geometry'

export function renderScratchObject(
  ctx: CanvasRenderingContext2D,
  obj: ScratchObject,
  imageCache: ReadonlyMap<string, HTMLImageElement>,
) {
  if (obj.kind === 'image') {
    const img = imageCache.get(obj.src)
    if (!img || !img.complete || img.naturalWidth === 0) return
    ctx.drawImage(img, obj.x, obj.y, obj.w, obj.h)
    return
  }

  ctx.strokeStyle = obj.color
  ctx.fillStyle = obj.color
  ctx.lineWidth = obj.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (obj.kind) {
    case 'stroke': {
      const pts = obj.points
      if (pts.length === 0) return
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y)
      }
      ctx.stroke()
      break
    }
    case 'line':
      ctx.beginPath()
      ctx.moveTo(obj.x1, obj.y1)
      ctx.lineTo(obj.x2, obj.y2)
      ctx.stroke()
      break
    case 'rect':
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h)
      break
    case 'ellipse':
      ctx.beginPath()
      ctx.ellipse(obj.cx, obj.cy, Math.abs(obj.rx), Math.abs(obj.ry), 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'triangle':
      ctx.beginPath()
      ctx.moveTo(obj.x1, obj.y1)
      ctx.lineTo(obj.x2, obj.y2)
      ctx.lineTo(obj.x3, obj.y3)
      ctx.closePath()
      ctx.stroke()
      break
    default:
      break
  }
}

export function renderSelectionBox(
  ctx: CanvasRenderingContext2D,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
) {
  const w = maxX - minX
  const h = maxY - minY
  ctx.save()
  ctx.strokeStyle = '#6366f1'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.strokeRect(minX, minY, w, h)
  ctx.fillStyle = 'rgba(99, 102, 241, 0.08)'
  ctx.fillRect(minX, minY, w, h)
  ctx.setLineDash([])
  const r = 6
  ctx.fillStyle = '#6366f1'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  for (const [cx, cy] of [
    [minX, minY],
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
  ] as const) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

export function renderLassoPreview(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
  if (points.length < 2) return
  ctx.save()
  ctx.strokeStyle = '#6366f1'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
  ctx.restore()
}

export function renderShapePreview(
  ctx: CanvasRenderingContext2D,
  kind: 'line' | 'rect' | 'circle' | 'triangle',
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.setLineDash([6, 4])
  ctx.globalAlpha = 0.75

  switch (kind) {
    case 'line':
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      break
    case 'rect':
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
      break
    case 'circle': {
      const rx = Math.abs(x2 - x1) / 2
      const ry = Math.abs(y2 - y1) / 2
      const cx = (x1 + x2) / 2
      const cy = (y1 + y2) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'triangle': {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineTo(x2, y1)
      ctx.closePath()
      ctx.stroke()
      break
    }
    default:
      break
  }
  ctx.restore()
}

export function renderEraserPreview(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.7)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.stroke()
  ctx.restore()
}

export function renderCombinedSelectionBounds(
  ctx: CanvasRenderingContext2D,
  objects: ScratchObject[],
  selectedIds: Set<string>,
) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const obj of objects) {
    if (!selectedIds.has(obj.id)) continue
    const b = scratchObjectBounds(obj)
    if (!b) continue
    minX = Math.min(minX, b.minX)
    minY = Math.min(minY, b.minY)
    maxX = Math.max(maxX, b.maxX)
    maxY = Math.max(maxY, b.maxY)
  }
  if (!Number.isFinite(minX)) return
  renderSelectionBox(ctx, minX - 4, minY - 4, maxX + 4, maxY + 4)
}
