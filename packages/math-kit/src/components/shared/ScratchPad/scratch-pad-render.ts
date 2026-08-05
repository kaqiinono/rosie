import type { ScratchObject, ScratchTriangleVariant } from './scratch-pad-types'
import { SCRATCH_HIGHLIGHT_ALPHA, SCRATCH_SHAPE_FILL_ALPHA } from './scratch-pad-types'
import { scratchObjectBounds, triangleFromDrag } from './scratch-pad-geometry'

export function scratchObjectPaintOrder(kind: ScratchObject['kind']): number {
  if (kind === 'image') return 0
  if (kind === 'highlight') return 1
  return 2
}

function renderFreehandPath(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  lineWidth: number,
  alpha: number,
) {
  if (points.length === 0) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
  ctx.restore()
}

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
    case 'highlight':
      renderFreehandPath(ctx, obj.points, obj.color, obj.lineWidth, SCRATCH_HIGHLIGHT_ALPHA)
      break
    case 'line':
      ctx.beginPath()
      ctx.moveTo(obj.x1, obj.y1)
      ctx.lineTo(obj.x2, obj.y2)
      ctx.stroke()
      break
    case 'rect':
      if (obj.w > 0 && obj.h > 0) {
        if (obj.filled) {
          ctx.save()
          ctx.globalAlpha = SCRATCH_SHAPE_FILL_ALPHA
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h)
          ctx.restore()
        }
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h)
      }
      break
    case 'ellipse': {
      const rx = Math.abs(obj.rx)
      const ry = Math.abs(obj.ry)
      if (rx <= 0 || ry <= 0) break
      ctx.beginPath()
      ctx.ellipse(obj.cx, obj.cy, rx, ry, 0, 0, Math.PI * 2)
      if (obj.filled) {
        ctx.save()
        ctx.globalAlpha = SCRATCH_SHAPE_FILL_ALPHA
        ctx.fill()
        ctx.restore()
        ctx.beginPath()
        ctx.ellipse(obj.cx, obj.cy, rx, ry, 0, 0, Math.PI * 2)
      }
      ctx.stroke()
      break
    }
    case 'triangle':
      ctx.beginPath()
      ctx.moveTo(obj.x1, obj.y1)
      ctx.lineTo(obj.x2, obj.y2)
      ctx.lineTo(obj.x3, obj.y3)
      ctx.closePath()
      if (obj.filled) {
        ctx.save()
        ctx.globalAlpha = SCRATCH_SHAPE_FILL_ALPHA
        ctx.fill()
        ctx.restore()
        ctx.beginPath()
        ctx.moveTo(obj.x1, obj.y1)
        ctx.lineTo(obj.x2, obj.y2)
        ctx.lineTo(obj.x3, obj.y3)
        ctx.closePath()
      }
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
  ctx.fillStyle = 'rgba(99, 102, 241, 0.14)'
  ctx.fillRect(minX, minY, w, h)
  ctx.strokeStyle = '#4f46e5'
  ctx.lineWidth = 2
  ctx.setLineDash([7, 4])
  ctx.strokeRect(minX, minY, w, h)
  ctx.setLineDash([])
  const r = 7
  ctx.fillStyle = '#4f46e5'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
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
  filled = false,
  triangleVariant: ScratchTriangleVariant = 'right',
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
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
    case 'rect': {
      const x = Math.min(x1, x2)
      const y = Math.min(y1, y2)
      const w = Math.abs(x2 - x1)
      const h = Math.abs(y2 - y1)
      if (filled && w > 0 && h > 0) {
        ctx.save()
        ctx.globalAlpha = 0.75 * SCRATCH_SHAPE_FILL_ALPHA
        ctx.fillRect(x, y, w, h)
        ctx.restore()
        ctx.globalAlpha = 0.75
      }
      ctx.strokeRect(x, y, w, h)
      break
    }
    case 'circle': {
      const rx = Math.abs(x2 - x1) / 2
      const ry = Math.abs(y2 - y1) / 2
      const cx = (x1 + x2) / 2
      const cy = (y1 + y2) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      if (filled) {
        ctx.save()
        ctx.globalAlpha = 0.75 * SCRATCH_SHAPE_FILL_ALPHA
        ctx.fill()
        ctx.restore()
        ctx.globalAlpha = 0.75
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      }
      ctx.stroke()
      break
    }
    case 'triangle': {
      const t = triangleFromDrag(x1, y1, x2, y2, triangleVariant)
      ctx.beginPath()
      ctx.moveTo(t.x1, t.y1)
      ctx.lineTo(t.x2, t.y2)
      ctx.lineTo(t.x3, t.y3)
      ctx.closePath()
      if (filled) {
        ctx.save()
        ctx.globalAlpha = 0.75 * SCRATCH_SHAPE_FILL_ALPHA
        ctx.fill()
        ctx.restore()
        ctx.globalAlpha = 0.75
        ctx.beginPath()
        ctx.moveTo(t.x1, t.y1)
        ctx.lineTo(t.x2, t.y2)
        ctx.lineTo(t.x3, t.y3)
        ctx.closePath()
      }
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
  renderSelectionBox(ctx, minX - 6, minY - 6, maxX + 6, maxY + 6)
}
