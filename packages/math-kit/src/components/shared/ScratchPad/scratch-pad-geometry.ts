import type {
  ScratchBounds,
  ScratchHighlightObject,
  ScratchObject,
  ScratchPoint,
  ScratchStrokeObject,
} from './scratch-pad-types'

const HIT_TOLERANCE = 10

type ScratchFreehandObject = ScratchStrokeObject | ScratchHighlightObject

function isFreehandObject(obj: ScratchObject): obj is ScratchFreehandObject {
  return obj.kind === 'stroke' || obj.kind === 'highlight'
}

export function scratchBoundsEmpty(): ScratchBounds {
  return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
}

export function scratchBoundsFromPoints(points: ScratchPoint[]): ScratchBounds | null {
  if (points.length === 0) return null
  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

export function scratchBoundsPad(bounds: ScratchBounds, pad: number): ScratchBounds {
  return {
    minX: bounds.minX - pad,
    minY: bounds.minY - pad,
    maxX: bounds.maxX + pad,
    maxY: bounds.maxY + pad,
  }
}

export function scratchBoundsIntersect(a: ScratchBounds, b: ScratchBounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

export function scratchRectBounds(x1: number, y1: number, x2: number, y2: number): ScratchBounds {
  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2),
  }
}

export function scratchObjectBounds(obj: ScratchObject): ScratchBounds | null {
  switch (obj.kind) {
    case 'stroke':
    case 'highlight':
      return scratchBoundsFromPoints(obj.points)
    case 'line':
      return scratchRectBounds(obj.x1, obj.y1, obj.x2, obj.y2)
    case 'rect':
      return scratchRectBounds(obj.x, obj.y, obj.x + obj.w, obj.y + obj.h)
    case 'ellipse':
      return {
        minX: obj.cx - obj.rx,
        minY: obj.cy - obj.ry,
        maxX: obj.cx + obj.rx,
        maxY: obj.cy + obj.ry,
      }
    case 'triangle':
      return scratchBoundsFromPoints([
        { x: obj.x1, y: obj.y1 },
        { x: obj.x2, y: obj.y2 },
        { x: obj.x3, y: obj.y3 },
      ])
    case 'image':
      return { minX: obj.x, minY: obj.y, maxX: obj.x + obj.w, maxY: obj.y + obj.h }
    default:
      return null
  }
}

function distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function pointInTriangle(px: number, py: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): boolean {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2)
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3)
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function pointInEllipse(px: number, py: number, cx: number, cy: number, rx: number, ry: number): boolean {
  if (rx <= 0 || ry <= 0) return false
  const nx = (px - cx) / rx
  const ny = (py - cy) / ry
  return nx * nx + ny * ny <= 1
}

export function pointInPolygon(px: number, py: number, polygon: ScratchPoint[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function strokeHitTest(obj: ScratchFreehandObject, px: number, py: number, tolerance: number): boolean {
  const pts = obj.points
  if (pts.length === 0) return false
  if (pts.length === 1) return Math.hypot(px - pts[0].x, py - pts[0].y) <= tolerance
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    if (distPointToSegment(px, py, prev.x, prev.y, cur.x, cur.y) <= tolerance) return true
  }
  return false
}

export function scratchHitTest(obj: ScratchObject, px: number, py: number, tolerance = HIT_TOLERANCE): boolean {
  switch (obj.kind) {
    case 'stroke':
    case 'highlight':
      return strokeHitTest(obj, px, py, tolerance + obj.lineWidth / 2)
    case 'line':
      return distPointToSegment(px, py, obj.x1, obj.y1, obj.x2, obj.y2) <= tolerance + obj.lineWidth / 2
    case 'rect': {
      const b = scratchObjectBounds(obj)
      if (!b) return false
      if (obj.filled && px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) return true
      const pad = tolerance + obj.lineWidth / 2
      const nearBorder =
        distPointToSegment(px, py, b.minX, b.minY, b.maxX, b.minY) <= pad ||
        distPointToSegment(px, py, b.maxX, b.minY, b.maxX, b.maxY) <= pad ||
        distPointToSegment(px, py, b.maxX, b.maxY, b.minX, b.maxY) <= pad ||
        distPointToSegment(px, py, b.minX, b.maxY, b.minX, b.minY) <= pad
      return nearBorder
    }
    case 'ellipse':
      return pointInEllipse(px, py, obj.cx, obj.cy, obj.rx + tolerance, obj.ry + tolerance)
    case 'triangle': {
      if (pointInTriangle(px, py, obj.x1, obj.y1, obj.x2, obj.y2, obj.x3, obj.y3)) return true
      const pad = tolerance + obj.lineWidth / 2
      return (
        distPointToSegment(px, py, obj.x1, obj.y1, obj.x2, obj.y2) <= pad ||
        distPointToSegment(px, py, obj.x2, obj.y2, obj.x3, obj.y3) <= pad ||
        distPointToSegment(px, py, obj.x3, obj.y3, obj.x1, obj.y1) <= pad
      )
    }
    case 'image':
      return px >= obj.x && px <= obj.x + obj.w && py >= obj.y && py <= obj.y + obj.h
    default:
      return false
  }
}

export function scratchObjectIntersectsRect(obj: ScratchObject, rect: ScratchBounds): boolean {
  const bounds = scratchObjectBounds(obj)
  if (!bounds) return false
  if (!scratchBoundsIntersect(bounds, rect)) return false

  if (isFreehandObject(obj)) {
    for (const p of obj.points) {
      if (p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY) return true
    }
  }

  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  if (cx >= rect.minX && cx <= rect.maxX && cy >= rect.minY && cy <= rect.maxY) return true

  return scratchBoundsIntersect(bounds, rect)
}

export function scratchObjectIntersectsPolygon(obj: ScratchObject, polygon: ScratchPoint[]): boolean {
  if (polygon.length < 3) return false
  const bounds = scratchObjectBounds(obj)
  if (!bounds) return false

  const corners: ScratchPoint[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ]
  for (const c of corners) {
    if (pointInPolygon(c.x, c.y, polygon)) return true
  }

  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  if (pointInPolygon(cx, cy, polygon)) return true

  if (isFreehandObject(obj)) {
    for (const p of obj.points) {
      if (pointInPolygon(p.x, p.y, polygon)) return true
    }
  }

  for (const p of polygon) {
    if (scratchHitTest(obj, p.x, p.y, 2)) return true
  }

  return scratchObjectIntersectsRect(obj, bounds)
}

export function cloneScratchObject(obj: ScratchObject, createId: () => string): ScratchObject {
  if (isFreehandObject(obj)) {
    return { ...obj, id: createId(), points: obj.points.map((p) => ({ ...p })) }
  }
  if (obj.kind === 'image') {
    return { ...obj, id: createId() }
  }
  return { ...obj, id: createId() }
}

export function translateScratchObject(obj: ScratchObject, dx: number, dy: number): ScratchObject {
  switch (obj.kind) {
    case 'stroke':
    case 'highlight':
      return {
        ...obj,
        points: obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      }
    case 'line':
      return { ...obj, x1: obj.x1 + dx, y1: obj.y1 + dy, x2: obj.x2 + dx, y2: obj.y2 + dy }
    case 'rect':
      return { ...obj, x: obj.x + dx, y: obj.y + dy }
    case 'ellipse':
      return { ...obj, cx: obj.cx + dx, cy: obj.cy + dy }
    case 'triangle':
      return {
        ...obj,
        x1: obj.x1 + dx,
        y1: obj.y1 + dy,
        x2: obj.x2 + dx,
        y2: obj.y2 + dy,
        x3: obj.x3 + dx,
        y3: obj.y3 + dy,
      }
    case 'image':
      return { ...obj, x: obj.x + dx, y: obj.y + dy }
    default:
      return obj
  }
}

export function selectionBounds(objects: ScratchObject[], selectedIds: Set<string>): ScratchBounds | null {
  let result: ScratchBounds | null = null
  for (const obj of objects) {
    if (!selectedIds.has(obj.id)) continue
    const b = scratchObjectBounds(obj)
    if (!b) continue
    if (!result) {
      result = { ...b }
    } else {
      result = {
        minX: Math.min(result.minX, b.minX),
        minY: Math.min(result.minY, b.minY),
        maxX: Math.max(result.maxX, b.maxX),
        maxY: Math.max(result.maxY, b.maxY),
      }
    }
  }
  return result
}

/** Union bounds of all objects — for inline preview / auto-height */
export function allObjectsBounds(objects: ScratchObject[], pad = 0): ScratchBounds | null {
  let result: ScratchBounds | null = null
  for (const obj of objects) {
    const b = scratchObjectBounds(obj)
    if (!b) continue
    if (!result) {
      result = { ...b }
    } else {
      result = {
        minX: Math.min(result.minX, b.minX),
        minY: Math.min(result.minY, b.minY),
        maxX: Math.max(result.maxX, b.maxX),
        maxY: Math.max(result.maxY, b.maxY),
      }
    }
  }
  if (!result) return null
  return pad > 0 ? scratchBoundsPad(result, pad) : result
}

export type ContentFitTransform = {
  scale: number
  offsetX: number
  offsetY: number
}

/** Scale + translate so content bounds fit inside container (contain). */
export function computeContentFitTransform(
  bounds: ScratchBounds,
  containerW: number,
  containerH: number,
  padding = 16,
): ContentFitTransform {
  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  if (contentW <= 0 || contentH <= 0 || containerW <= 0 || containerH <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }
  const availW = Math.max(1, containerW - padding * 2)
  const availH = Math.max(1, containerH - padding * 2)
  const scale = Math.min(availW / contentW, availH / contentH)
  const drawnW = contentW * scale
  const drawnH = contentH * scale
  return {
    scale,
    offsetX: padding + (availW - drawnW) / 2 - bounds.minX * scale,
    offsetY: padding + (availH - drawnH) / 2 - bounds.minY * scale,
  }
}

const SELECTION_PAD = 4

export function selectionBoundsWithPad(bounds: ScratchBounds, pad = SELECTION_PAD): ScratchBounds {
  return {
    minX: bounds.minX - pad,
    minY: bounds.minY - pad,
    maxX: bounds.maxX + pad,
    maxY: bounds.maxY + pad,
  }
}

export type ScratchResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

const HANDLE_HIT_RADIUS = 14

export function hitResizeHandle(
  px: number,
  py: number,
  bounds: ScratchBounds,
  pad = SELECTION_PAD,
): ScratchResizeHandle | null {
  const b = selectionBoundsWithPad(bounds, pad)
  const handles: { id: ScratchResizeHandle; x: number; y: number }[] = [
    { id: 'nw', x: b.minX, y: b.minY },
    { id: 'ne', x: b.maxX, y: b.minY },
    { id: 'sw', x: b.minX, y: b.maxY },
    { id: 'se', x: b.maxX, y: b.maxY },
  ]
  for (const h of handles) {
    if (Math.hypot(px - h.x, py - h.y) <= HANDLE_HIT_RADIUS) return h.id
  }
  return null
}

function resizeAnchor(handle: ScratchResizeHandle, bounds: ScratchBounds): ScratchPoint {
  switch (handle) {
    case 'nw':
      return { x: bounds.maxX, y: bounds.maxY }
    case 'ne':
      return { x: bounds.minX, y: bounds.maxY }
    case 'sw':
      return { x: bounds.maxX, y: bounds.minY }
    case 'se':
      return { x: bounds.minX, y: bounds.minY }
  }
}

export function computeResizedBounds(
  handle: ScratchResizeHandle,
  origin: ScratchBounds,
  px: number,
  py: number,
  minSize = 12,
): ScratchBounds {
  switch (handle) {
    case 'se':
      return {
        minX: origin.minX,
        minY: origin.minY,
        maxX: Math.max(origin.minX + minSize, px),
        maxY: Math.max(origin.minY + minSize, py),
      }
    case 'sw':
      return {
        minX: Math.min(origin.maxX - minSize, px),
        minY: origin.minY,
        maxX: origin.maxX,
        maxY: Math.max(origin.minY + minSize, py),
      }
    case 'ne':
      return {
        minX: origin.minX,
        minY: Math.min(origin.maxY - minSize, py),
        maxX: Math.max(origin.minX + minSize, px),
        maxY: origin.maxY,
      }
    case 'nw':
      return {
        minX: Math.min(origin.maxX - minSize, px),
        minY: Math.min(origin.maxY - minSize, py),
        maxX: origin.maxX,
        maxY: origin.maxY,
      }
  }
}

export function scaleScratchObject(
  obj: ScratchObject,
  anchorX: number,
  anchorY: number,
  scaleX: number,
  scaleY: number,
): ScratchObject {
  const map = (x: number, y: number) => ({
    x: anchorX + (x - anchorX) * scaleX,
    y: anchorY + (y - anchorY) * scaleY,
  })
  const strokeScale = Math.max(Math.abs(scaleX), Math.abs(scaleY))

  switch (obj.kind) {
    case 'stroke':
    case 'highlight':
      return {
        ...obj,
        points: obj.points.map((p) => map(p.x, p.y)),
        lineWidth: Math.max(1, obj.lineWidth * strokeScale),
      }
    case 'line': {
      const a = map(obj.x1, obj.y1)
      const b = map(obj.x2, obj.y2)
      return {
        ...obj,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        lineWidth: Math.max(1, obj.lineWidth * strokeScale),
      }
    }
    case 'rect': {
      const p = map(obj.x, obj.y)
      return {
        ...obj,
        x: p.x,
        y: p.y,
        w: obj.w * scaleX,
        h: obj.h * scaleY,
        lineWidth: Math.max(1, obj.lineWidth * strokeScale),
      }
    }
    case 'ellipse': {
      const c = map(obj.cx, obj.cy)
      return {
        ...obj,
        cx: c.x,
        cy: c.y,
        rx: obj.rx * Math.abs(scaleX),
        ry: obj.ry * Math.abs(scaleY),
        lineWidth: Math.max(1, obj.lineWidth * strokeScale),
      }
    }
    case 'triangle': {
      const p1 = map(obj.x1, obj.y1)
      const p2 = map(obj.x2, obj.y2)
      const p3 = map(obj.x3, obj.y3)
      return {
        ...obj,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        x3: p3.x,
        y3: p3.y,
        lineWidth: Math.max(1, obj.lineWidth * strokeScale),
      }
    }
    case 'image': {
      const p = map(obj.x, obj.y)
      return { ...obj, x: p.x, y: p.y, w: obj.w * scaleX, h: obj.h * scaleY }
    }
    default:
      return obj
  }
}

export function scaleSelectedObjects(
  originObjects: ScratchObject[],
  selectedIds: Set<string>,
  originBounds: ScratchBounds,
  newBounds: ScratchBounds,
  handle: ScratchResizeHandle,
): ScratchObject[] {
  const ow = originBounds.maxX - originBounds.minX
  const oh = originBounds.maxY - originBounds.minY
  if (ow < 1 || oh < 1) return originObjects

  const scaleX = (newBounds.maxX - newBounds.minX) / ow
  const scaleY = (newBounds.maxY - newBounds.minY) / oh
  const anchor = resizeAnchor(handle, originBounds)

  return originObjects.map((obj) =>
    selectedIds.has(obj.id) ? scaleScratchObject(obj, anchor.x, anchor.y, scaleX, scaleY) : obj,
  )
}

export function rightTriangleFromDrag(x1: number, y1: number, x2: number, y2: number) {
  return triangleFromDrag(x1, y1, x2, y2, 'right')
}

/** 根据拖拽框生成三角形顶点（直角沿用原逻辑：直角在 (x2,y1)） */
export function triangleFromDrag(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  variant: 'right' | 'isosceles' | 'equilateral',
) {
  if (variant === 'right') {
    return { x1, y1, x2, y2, x3: x2, y3: y1 }
  }

  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  const w = right - left
  const h = bottom - top

  if (variant === 'isosceles') {
    return {
      x1: (left + right) / 2,
      y1: top,
      x2: left,
      y2: bottom,
      x3: right,
      y3: bottom,
    }
  }

  const side = Math.min(w, (h * 2) / Math.sqrt(3))
  const triH = (side * Math.sqrt(3)) / 2
  const offsetY = (h - triH) / 2
  const cx = (left + right) / 2
  const half = side / 2
  return {
    x1: cx,
    y1: top + offsetY,
    x2: cx - half,
    y2: top + offsetY + triH,
    x3: cx + half,
    y3: top + offsetY + triH,
  }
}

function pointInEraser(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  return Math.hypot(px - cx, py - cy) <= radius
}

function segmentHitsEraser(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  return distPointToSegment(cx, cy, x1, y1, x2, y2) <= radius
}

function eraseFreehandAt(
  stroke: ScratchFreehandObject,
  cx: number,
  cy: number,
  radius: number,
  createId: () => string,
): ScratchFreehandObject[] {
  const pts = stroke.points
  if (pts.length === 0) return []

  const erased = pts.map((p) => pointInEraser(p.x, p.y, cx, cy, radius))
  for (let i = 0; i < pts.length - 1; i++) {
    if (segmentHitsEraser(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, cx, cy, radius)) {
      erased[i] = true
      erased[i + 1] = true
    }
  }

  const parts: ScratchFreehandObject[] = []
  let run: ScratchPoint[] = []
  for (let i = 0; i < pts.length; i++) {
    if (!erased[i]) {
      run.push(pts[i])
    } else if (run.length > 0) {
      if (run.length >= 1) {
        parts.push({
          ...stroke,
          id: createId(),
          points: [...run],
        })
      }
      run = []
    }
  }
  if (run.length > 0) {
    parts.push({
      ...stroke,
      id: createId(),
      points: [...run],
    })
  }
  return parts
}

/** 在 (cx,cy) 处以 radius 为半径擦除笔迹/图形 */
export function applyEraserAt(
  objects: ScratchObject[],
  cx: number,
  cy: number,
  radius: number,
  createId: () => string,
): ScratchObject[] {
  const result: ScratchObject[] = []
  for (const obj of objects) {
    if (isFreehandObject(obj)) {
      result.push(...eraseFreehandAt(obj, cx, cy, radius, createId))
    } else if (shapeHitByEraser(obj, cx, cy, radius)) {
      // 图形整块擦除
    } else {
      result.push(obj)
    }
  }
  return result
}

function shapeHitByEraser(obj: ScratchObject, cx: number, cy: number, radius: number): boolean {
  if (scratchHitTest(obj, cx, cy, radius)) return true

  // 在橡皮圆环上采样，只有真正碰到图形描边/区域才删除
  const ringSamples = 10
  for (let i = 0; i < ringSamples; i++) {
    const ang = (i / ringSamples) * Math.PI * 2
    const px = cx + Math.cos(ang) * radius
    const py = cy + Math.sin(ang) * radius
    if (scratchHitTest(obj, px, py, 2)) return true
  }

  return false
}
