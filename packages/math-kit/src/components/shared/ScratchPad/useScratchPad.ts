'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ScratchBounds,
  ScratchColorId,
  ScratchEraserWidth,
  ScratchHighlightColorId,
  ScratchHighlightWidth,
  ScratchImageObject,
  ScratchObject,
  ScratchPoint,
  ScratchSnapshot,
  ScratchStrokeWidth,
  ScratchTool,
  ScratchTriangleVariant,
} from './scratch-pad-types'
import { SCRATCH_COLORS, SCRATCH_HIGHLIGHT_COLORS } from './scratch-pad-types'
import {
  applyEraserAt,
  allObjectsBounds,
  cloneScratchObject,
  computeContentFitTransform,
  computeResizedBounds,
  hitResizeHandle,
  triangleFromDrag,
  scaleSelectedObjects,
  scratchHitTest,
  scratchObjectIntersectsPolygon,
  scratchObjectIntersectsRect,
  scratchRectBounds,
  selectionBounds,
  translateScratchObject,
  type ScratchResizeHandle,
} from './scratch-pad-geometry'
import {
  renderCombinedSelectionBounds,
  renderEraserPreview,
  renderLassoPreview,
  renderScratchObject,
  renderSelectionBox,
  renderShapePreview,
  scratchObjectPaintOrder,
} from './scratch-pad-render'
import { fitFigureLayout, loadHtmlImage } from './scratch-pad-figure'
import { computeScratchSurfaceSize } from './scratch-pad-surface'

let scratchIdCounter = 0
function nextScratchId(): string {
  scratchIdCounter += 1
  return `scratch-${scratchIdCounter}-${Date.now()}`
}

function deepCloneObjects(objects: ScratchObject[]): ScratchObject[] {
  return objects.map((obj) => {
    if (obj.kind === 'stroke' || obj.kind === 'highlight') {
      return { ...obj, points: obj.points.map((p) => ({ ...p })) }
    }
    return { ...obj }
  })
}

function scratchObjectsFingerprint(objects: ScratchObject[]): string {
  return JSON.stringify(objects)
}

type DragMode =
  | { kind: 'none' }
  | { kind: 'pen'; objectId: string }
  | { kind: 'shape'; tool: 'line' | 'rect' | 'circle' | 'triangle'; x1: number; y1: number }
  | { kind: 'select-box'; x1: number; y1: number }
  | { kind: 'select-lasso'; points: ScratchPoint[] }
  | { kind: 'move'; startX: number; startY: number; originObjects: ScratchObject[] }
  | {
      kind: 'resize'
      handle: ScratchResizeHandle
      originBounds: ScratchBounds
      originObjects: ScratchObject[]
    }
  | { kind: 'pan-view'; startScrollLeft: number; startScrollTop: number; startX: number; startY: number }
  | { kind: 'eraser'; lastX: number; lastY: number }

function getColorHex(colorId: ScratchColorId): string {
  return SCRATCH_COLORS.find((c) => c.id === colorId)?.hex ?? '#334155'
}

function getHighlightColorHex(colorId: ScratchHighlightColorId): string {
  return SCRATCH_HIGHLIGHT_COLORS.find((c) => c.id === colorId)?.hex ?? '#fde047'
}

function toolToShapeKind(tool: ScratchTool): 'line' | 'rect' | 'circle' | 'triangle' | null {
  if (tool === 'line') return 'line'
  if (tool === 'rect') return 'rect'
  if (tool === 'circle') return 'circle'
  if (tool === 'triangle') return 'triangle'
  return null
}

function isFillableShapeTool(tool: ScratchTool): boolean {
  return tool === 'rect' || tool === 'circle' || tool === 'triangle'
}

function createShapeObject(
  tool: ScratchTool,
  color: string,
  lineWidth: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  filled: boolean,
  triangleVariant: ScratchTriangleVariant = 'right',
): ScratchObject | null {
  const id = nextScratchId()
  const fill = filled && isFillableShapeTool(tool) ? { filled: true as const } : {}
  switch (tool) {
    case 'line':
      return { id, kind: 'line', color, lineWidth, x1, y1, x2, y2 }
    case 'rect': {
      const x = Math.min(x1, x2)
      const y = Math.min(y1, y2)
      const w = Math.abs(x2 - x1)
      const h = Math.abs(y2 - y1)
      if (w < 2 && h < 2) return null
      return { id, kind: 'rect', color, lineWidth, x, y, w, h, ...fill }
    }
    case 'circle': {
      const rx = Math.abs(x2 - x1) / 2
      const ry = Math.abs(y2 - y1) / 2
      if (rx < 2 && ry < 2) return null
      return {
        id,
        kind: 'ellipse',
        color,
        lineWidth,
        cx: (x1 + x2) / 2,
        cy: (y1 + y2) / 2,
        rx,
        ry,
        ...fill,
      }
    }
    case 'triangle': {
      const t = triangleFromDrag(x1, y1, x2, y2, triangleVariant)
      if (Math.hypot(x2 - x1, y2 - y1) < 4) return null
      return { id, kind: 'triangle', color, lineWidth, ...t, ...fill }
    }
    default:
      return null
  }
}

export function useScratchPad(
  problemId: string,
  options?: {
    initialObjects?: ScratchObject[]
    onObjectsChange?: (objects: ScratchObject[]) => void
    /** Scale all content to fit the container (inline embed) */
    fitContent?: boolean
    /** 画布大于可视区域，可滚动（全屏草稿纸） */
    scrollableSurface?: boolean
  },
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const pendingImageLoadsRef = useRef<Set<string>>(new Set())

  const [tool, setTool] = useState<ScratchTool>('pen')
  const [colorId, setColorId] = useState<ScratchColorId>('slate')
  const [highlightColorId, setHighlightColorId] = useState<ScratchHighlightColorId>('yellow')
  const [strokeWidth, setStrokeWidth] = useState<ScratchStrokeWidth>(4)
  const [highlightWidth, setHighlightWidth] = useState<ScratchHighlightWidth>(24)
  const [shapeFillEnabled, setShapeFillEnabled] = useState(false)
  const [triangleVariant, setTriangleVariant] = useState<ScratchTriangleVariant>('right')
  const [eraserWidth, setEraserWidth] = useState<ScratchEraserWidth>(24)

  const objectsRef = useRef<ScratchObject[]>([])
  const selectedIdsRef = useRef<Set<string>>(new Set())
  const historyRef = useRef<ScratchSnapshot[]>([])
  const dragRef = useRef<DragMode>({ kind: 'none' })
  const activePointerIdRef = useRef<number | null>(null)
  const eraserCursorRef = useRef<ScratchPoint | null>(null)
  const previewRef = useRef<{
    box?: { x1: number; y1: number; x2: number; y2: number }
    lasso?: ScratchPoint[]
    shape?: { tool: 'line' | 'rect' | 'circle' | 'triangle'; x1: number; y1: number; x2: number; y2: number }
  }>({})
  const viewTransformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, active: false })
  const paintRef = useRef<() => void>(() => {})
  const pendingLocalFingerprintRef = useRef<string | null>(null)

  const onObjectsChangeRef = useRef(options?.onObjectsChange)

  useEffect(() => {
    onObjectsChangeRef.current = options?.onObjectsChange
  }, [options?.onObjectsChange])

  const notifyChange = useCallback(() => {
    pendingLocalFingerprintRef.current = scratchObjectsFingerprint(objectsRef.current)
    onObjectsChangeRef.current?.(deepCloneObjects(objectsRef.current))
  }, [])
  const [historyLen, setHistoryLen] = useState(0)
  const [selectionCount, setSelectionCount] = useState(0)
  const [selectionBoundsRect, setSelectionBoundsRect] = useState<ScratchBounds | null>(null)
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 })
  const [, bumpRender] = useState(0)
  const forceRender = useCallback(() => bumpRender((n) => n + 1), [])

  const switchToPenIfCanvasEmpty = useCallback(() => {
    if (objectsRef.current.length === 0) {
      setTool('pen')
    }
  }, [])

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      objects: deepCloneObjects(objectsRef.current),
      selectedIds: [...selectedIdsRef.current],
    })
    if (historyRef.current.length > 50) {
      historyRef.current.shift()
    }
    setHistoryLen(historyRef.current.length)
  }, [])

  const resetCanvasRefs = useCallback(() => {
    objectsRef.current = []
    selectedIdsRef.current = new Set()
    historyRef.current = []
    dragRef.current = { kind: 'none' }
    activePointerIdRef.current = null
    previewRef.current = {}
    pendingLocalFingerprintRef.current = null
  }, [])

  const resetCanvas = useCallback(() => {
    resetCanvasRefs()
    setHistoryLen(0)
    setSelectionCount(0)
    setSelectionBoundsRect(null)
    forceRender()
  }, [forceRender, resetCanvasRefs])

  const scheduleCanvasUiSync = useCallback(
    (afterSync?: () => void) => {
      queueMicrotask(() => {
        setHistoryLen(historyRef.current.length)
        setSelectionCount(selectedIdsRef.current.size)
        setSelectionBoundsRect(
          selectedIdsRef.current.size > 0
            ? selectionBounds(objectsRef.current, selectedIdsRef.current)
            : null,
        )
        if (objectsRef.current.length === 0) {
          setTool('pen')
        }
        forceRender()
        afterSync?.()
      })
    },
    [forceRender],
  )

  useEffect(() => {
    resetCanvasRefs()
    imageCacheRef.current.clear()
    pendingImageLoadsRef.current.clear()
    const incoming = options?.initialObjects ?? []
    if (incoming.length > 0) {
      objectsRef.current = deepCloneObjects(incoming)
    }
    scheduleCanvasUiSync()
  }, [problemId, resetCanvasRefs, scheduleCanvasUiSync]) // eslint-disable-line react-hooks/exhaustive-deps

  const initialObjectsFingerprint = scratchObjectsFingerprint(options?.initialObjects ?? [])

  const ensureImageLoaded = useCallback((src: string, onReady: () => void) => {
    const cached = imageCacheRef.current.get(src)
    if (cached?.complete && cached.naturalWidth > 0) return
    if (pendingImageLoadsRef.current.has(src)) return
    pendingImageLoadsRef.current.add(src)
    void loadHtmlImage(src)
      .then((img) => {
        imageCacheRef.current.set(src, img)
        onReady()
      })
      .catch(() => {})
      .finally(() => {
        pendingImageLoadsRef.current.delete(src)
      })
  }, [])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, w, h)

    let viewActive = false
    let viewScale = 1
    let viewOffsetX = 0
    let viewOffsetY = 0

    if (options?.fitContent && objectsRef.current.length > 0) {
      const bounds = allObjectsBounds(objectsRef.current, 16)
      if (bounds) {
        const fit = computeContentFitTransform(bounds, w, h, 12)
        viewActive = true
        viewScale = fit.scale
        viewOffsetX = fit.offsetX
        viewOffsetY = fit.offsetY
        ctx.save()
        ctx.translate(fit.offsetX, fit.offsetY)
        ctx.scale(fit.scale, fit.scale)
      }
    }

    viewTransformRef.current = {
      scale: viewScale,
      offsetX: viewOffsetX,
      offsetY: viewOffsetY,
      active: viewActive,
    }

    for (const obj of objectsRef.current) {
      if (obj.kind === 'image') {
        ensureImageLoaded(obj.src, () => paintRef.current())
      }
    }
    const sortedObjects = [...objectsRef.current].sort(
      (a, b) => scratchObjectPaintOrder(a.kind) - scratchObjectPaintOrder(b.kind),
    )
    for (const obj of sortedObjects) {
      renderScratchObject(ctx, obj, imageCacheRef.current)
    }

    const preview = previewRef.current
    const color = getColorHex(colorId)

    if (preview.shape) {
      const s = preview.shape
      const shapeFilled = shapeFillEnabled && s.tool !== 'line'
      renderShapePreview(ctx, s.tool, s.x1, s.y1, s.x2, s.y2, color, strokeWidth, shapeFilled, triangleVariant)
    }
    if (preview.box) {
      const b = preview.box
      renderSelectionBox(ctx, Math.min(b.x1, b.x2), Math.min(b.y1, b.y2), Math.max(b.x1, b.x2), Math.max(b.y1, b.y2))
    }
    if (preview.lasso && preview.lasso.length > 0) {
      renderLassoPreview(ctx, preview.lasso)
    }

    if (selectedIdsRef.current.size > 0) {
      renderCombinedSelectionBounds(ctx, objectsRef.current, selectedIdsRef.current)
    }

    if (viewActive) {
      ctx.restore()
    }

    const eraserPos = eraserCursorRef.current
    if (eraserPos) {
      const sx = viewActive ? eraserPos.x * viewScale + viewOffsetX : eraserPos.x
      const sy = viewActive ? eraserPos.y * viewScale + viewOffsetY : eraserPos.y
      renderEraserPreview(ctx, sx, sy, eraserWidth / 2)
    }
  }, [colorId, strokeWidth, eraserWidth, ensureImageLoaded, options?.fitContent, shapeFillEnabled, triangleVariant])

  useEffect(() => {
    paintRef.current = paint
  }, [paint])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const viewport = container.getBoundingClientRect()
    let surfaceW = viewport.width
    let surfaceH = viewport.height
    if (options?.scrollableSurface && viewport.width > 0 && viewport.height > 0) {
      const expanded = computeScratchSurfaceSize(viewport.width, viewport.height)
      surfaceW = expanded.width
      surfaceH = expanded.height
      setSurfaceSize((prev) =>
        prev.width === expanded.width && prev.height === expanded.height ? prev : expanded,
      )
    } else if (options?.scrollableSurface) {
      setSurfaceSize({ width: 0, height: 0 })
    }
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(surfaceW * dpr)
    canvas.height = Math.floor(surfaceH * dpr)
    canvas.style.width = `${surfaceW}px`
    canvas.style.height = `${surfaceH}px`
    paint()
  }, [paint, options?.scrollableSurface])

  useEffect(() => {
    resizeCanvas()
    const el = containerRef.current
    const blockNativeGesture = (e: Event) => e.preventDefault()
    if (el) {
      el.addEventListener('selectstart', blockNativeGesture)
      el.addEventListener('contextmenu', blockNativeGesture)
    }
    const ro = new ResizeObserver(() => resizeCanvas())
    if (el) ro.observe(el)
    return () => {
      if (el) {
        el.removeEventListener('selectstart', blockNativeGesture)
        el.removeEventListener('contextmenu', blockNativeGesture)
      }
      ro.disconnect()
    }
  }, [resizeCanvas])

  useEffect(() => {
    paint()
  }, [paint])

  // Sync when parent passes updated objects (e.g. inline editor / problem load).
  // Skip while local edits are still propagating — avoids reverting undo/clear.
  useEffect(() => {
    if (dragRef.current.kind !== 'none') return
    const incoming = options?.initialObjects ?? []
    const currentFp = scratchObjectsFingerprint(objectsRef.current)
    const incomingFp = scratchObjectsFingerprint(incoming)

    if (incomingFp === currentFp) {
      pendingLocalFingerprintRef.current = null
      return
    }

    if (
      pendingLocalFingerprintRef.current === currentFp &&
      incomingFp === pendingLocalFingerprintRef.current
    ) {
      pendingLocalFingerprintRef.current = null
      return
    }

    if (pendingLocalFingerprintRef.current === currentFp) {
      return
    }

    selectedIdsRef.current = new Set()
    historyRef.current = []
    dragRef.current = { kind: 'none' }
    activePointerIdRef.current = null
    previewRef.current = {}
    objectsRef.current = incoming.length > 0 ? deepCloneObjects(incoming) : []
    pendingLocalFingerprintRef.current = null
    scheduleCanvasUiSync(() => {
      paintRef.current()
    })
  }, [initialObjectsFingerprint, scheduleCanvasUiSync]) // eslint-disable-line react-hooks/exhaustive-deps

  const getCanvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): ScratchPoint => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const v = viewTransformRef.current
    if (!v.active || v.scale === 0) return { x: sx, y: sy }
    return {
      x: (sx - v.offsetX) / v.scale,
      y: (sy - v.offsetY) / v.scale,
    }
  }, [])

  const findTopmostHit = useCallback((x: number, y: number): ScratchObject | null => {
    for (let i = objectsRef.current.length - 1; i >= 0; i--) {
      if (scratchHitTest(objectsRef.current[i], x, y)) return objectsRef.current[i]
    }
    return null
  }, [])

  const setSelection = useCallback((ids: string[]) => {
    selectedIdsRef.current = new Set(ids)
    setSelectionCount(ids.length)
    setSelectionBoundsRect(
      ids.length > 0 ? selectionBounds(objectsRef.current, selectedIdsRef.current) : null,
    )
    forceRender()
  }, [forceRender])

  const insertImage = useCallback((src: string, naturalW: number, naturalH: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    pushHistory()
    const layout = fitFigureLayout(naturalW, naturalH, rect.width, rect.height)
    const sameSrcCount = objectsRef.current.filter((o) => o.kind === 'image' && o.src === src).length
    const offset = sameSrcCount * 20

    const imageObj: ScratchImageObject = {
      id: nextScratchId(),
      kind: 'image',
      src,
      x: layout.x + offset,
      y: layout.y + offset,
      w: layout.w,
      h: layout.h,
    }
    objectsRef.current = [...objectsRef.current, imageObj]
    ensureImageLoaded(src, () => paintRef.current())
    setTool('select-box')
    setSelection([imageObj.id])
    paint()
    notifyChange()
  }, [pushHistory, ensureImageLoaded, setSelection, paint, notifyChange])

  const clearSelection = useCallback(() => {
    if (selectedIdsRef.current.size === 0) return
    selectedIdsRef.current = new Set()
    setSelectionCount(0)
    setSelectionBoundsRect(null)
    forceRender()
    paint()
  }, [forceRender, paint])

  const deleteSelected = useCallback(() => {
    if (selectedIdsRef.current.size === 0) return
    pushHistory()
    objectsRef.current = objectsRef.current.filter((o) => !selectedIdsRef.current.has(o.id))
    selectedIdsRef.current = new Set()
    setSelectionCount(0)
    setSelectionBoundsRect(null)
    forceRender()
    paint()
    notifyChange()
    switchToPenIfCanvasEmpty()
  }, [pushHistory, forceRender, paint, notifyChange, switchToPenIfCanvasEmpty])

  const recolorSelected = useCallback((hex: string) => {
    if (selectedIdsRef.current.size === 0) return
    pushHistory()
    const selected = selectedIdsRef.current
    objectsRef.current = objectsRef.current.map((obj) =>
      selected.has(obj.id) && obj.kind !== 'image' ? { ...obj, color: hex } : obj,
    )
    forceRender()
  }, [pushHistory, forceRender])

  const pickColor = useCallback((id: ScratchColorId) => {
    setColorId(id)
    const hex = getColorHex(id)
    if (selectedIdsRef.current.size > 0) {
      recolorSelected(hex)
    }
  }, [recolorSelected])

  const pickHighlightColor = useCallback((id: ScratchHighlightColorId) => {
    setHighlightColorId(id)
    const hex = getHighlightColorHex(id)
    if (selectedIdsRef.current.size > 0) {
      recolorSelected(hex)
    }
  }, [recolorSelected])

  const duplicateSelected = useCallback(() => {
    if (selectedIdsRef.current.size === 0) return
    pushHistory()
    const selected = selectedIdsRef.current
    const offset = 16
    const copies: ScratchObject[] = []
    const newIds: string[] = []
    for (const obj of objectsRef.current) {
      if (!selected.has(obj.id)) continue
      const copy = translateScratchObject(cloneScratchObject(obj, nextScratchId), offset, offset)
      copies.push(copy)
      newIds.push(copy.id)
    }
    objectsRef.current = [...objectsRef.current, ...copies]
    setSelection(newIds)
    forceRender()
    notifyChange()
  }, [pushHistory, setSelection, forceRender, notifyChange])

  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    objectsRef.current = deepCloneObjects(prev.objects)
    selectedIdsRef.current = new Set(prev.selectedIds)
    setSelectionCount(prev.selectedIds.length)
    setSelectionBoundsRect(
      prev.selectedIds.length > 0
        ? selectionBounds(objectsRef.current, selectedIdsRef.current)
        : null,
    )
    setHistoryLen(historyRef.current.length)
    dragRef.current = { kind: 'none' }
    activePointerIdRef.current = null
    previewRef.current = {}
    forceRender()
    paint()
    notifyChange()
    switchToPenIfCanvasEmpty()
  }, [forceRender, notifyChange, paint, switchToPenIfCanvasEmpty])

  const refreshSelectionBounds = useCallback(() => {
    if (selectedIdsRef.current.size === 0) {
      setSelectionBoundsRect(null)
      return
    }
    setSelectionBoundsRect(selectionBounds(objectsRef.current, selectedIdsRef.current))
  }, [])

  const clearAll = useCallback(() => {
    if (objectsRef.current.length === 0) return
    pushHistory()
    objectsRef.current = []
    selectedIdsRef.current = new Set()
    setSelectionCount(0)
    setSelectionBoundsRect(null)
    forceRender()
    paint()
    notifyChange()
    switchToPenIfCanvasEmpty()
  }, [pushHistory, forceRender, paint, notifyChange, switchToPenIfCanvasEmpty])

  const applyEraser = useCallback((x: number, y: number) => {
    const radius = eraserWidth / 2
    objectsRef.current = applyEraserAt(objectsRef.current, x, y, radius, nextScratchId)
    selectedIdsRef.current = new Set()
    setSelectionCount(0)
    setSelectionBoundsRect(null)
    eraserCursorRef.current = { x, y }
    paint()
  }, [eraserWidth, paint])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
      return
    }

    // Block scroll, zoom, and iOS text-selection gestures (Copy / Look Up / Translate).
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      e.preventDefault()
      window.getSelection()?.removeAllRanges()
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    activePointerIdRef.current = e.pointerId

    if (tool === 'pan') {
      const container = containerRef.current
      if (!container) return
      dragRef.current = {
        kind: 'pan-view',
        startScrollLeft: container.scrollLeft,
        startScrollTop: container.scrollTop,
        startX: e.clientX,
        startY: e.clientY,
      }
      return
    }

    const { x, y } = getCanvasPoint(e)
    const color = getColorHex(colorId)

    if (tool === 'eraser') {
      pushHistory()
      applyEraser(x, y)
      dragRef.current = { kind: 'eraser', lastX: x, lastY: y }
      setSelection([])
      return
    }

    if (tool === 'select-box' || tool === 'select-lasso') {
      const selBounds = selectionBounds(objectsRef.current, selectedIdsRef.current)
      if (selBounds && selectedIdsRef.current.size > 0) {
        const handle = hitResizeHandle(x, y, selBounds)
        if (handle) {
          pushHistory()
          dragRef.current = {
            kind: 'resize',
            handle,
            originBounds: { ...selBounds },
            originObjects: deepCloneObjects(objectsRef.current),
          }
          return
        }
      }

      if (selBounds && x >= selBounds.minX && x <= selBounds.maxX && y >= selBounds.minY && y <= selBounds.maxY) {
        pushHistory()
        dragRef.current = {
          kind: 'move',
          startX: x,
          startY: y,
          originObjects: deepCloneObjects(objectsRef.current),
        }
        return
      }

      const hit = findTopmostHit(x, y)
      if (hit && hit.kind !== 'image') {
        setSelection([hit.id])
        pushHistory()
        dragRef.current = {
          kind: 'move',
          startX: x,
          startY: y,
          originObjects: deepCloneObjects(objectsRef.current),
        }
        return
      }

      setSelection([])
      if (tool === 'select-box') {
        dragRef.current = { kind: 'select-box', x1: x, y1: y }
        previewRef.current = { box: { x1: x, y1: y, x2: x, y2: y } }
      } else {
        dragRef.current = { kind: 'select-lasso', points: [{ x, y }] }
        previewRef.current = { lasso: [{ x, y }] }
      }
      forceRender()
      return
    }

    const shapeKind = toolToShapeKind(tool)
    if (shapeKind) {
      dragRef.current = { kind: 'shape', tool: shapeKind, x1: x, y1: y }
      previewRef.current = { shape: { tool: shapeKind, x1: x, y1: y, x2: x, y2: y } }
      forceRender()
      return
    }

    if (tool === 'pen' || tool === 'highlighter') {
      pushHistory()
      const id = nextScratchId()
      const freehand: ScratchObject =
        tool === 'highlighter'
          ? {
              id,
              kind: 'highlight',
              color: getHighlightColorHex(highlightColorId),
              lineWidth: highlightWidth,
              points: [{ x, y }],
            }
          : {
              id,
              kind: 'stroke',
              color,
              lineWidth: strokeWidth,
              points: [{ x, y }],
            }
      objectsRef.current = [...objectsRef.current, freehand]
      dragRef.current = { kind: 'pen', objectId: id }
      setSelection([])
      forceRender()
      return
    }
  }, [colorId, strokeWidth, highlightColorId, highlightWidth, tool, findTopmostHit, getCanvasPoint, pushHistory, setSelection, forceRender, applyEraser])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
      return
    }

    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      e.preventDefault()
    }

    const drag = dragRef.current
    if (drag.kind === 'pan-view') {
      const container = containerRef.current
      if (container) {
        container.scrollLeft = drag.startScrollLeft - (e.clientX - drag.startX)
        container.scrollTop = drag.startScrollTop - (e.clientY - drag.startY)
      }
      return
    }

    const { x, y } = getCanvasPoint(e)

    if (tool === 'eraser' && drag.kind === 'none') {
      eraserCursorRef.current = { x, y }
      paint()
      return
    }

    if (drag.kind === 'none') return

    if (drag.kind === 'eraser') {
      const step = Math.max(4, eraserWidth / 4)
      const dist = Math.hypot(x - drag.lastX, y - drag.lastY)
      if (dist < step) {
        eraserCursorRef.current = { x, y }
        paint()
        return
      }
      const steps = Math.ceil(dist / step)
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const ix = drag.lastX + (x - drag.lastX) * t
        const iy = drag.lastY + (y - drag.lastY) * t
        objectsRef.current = applyEraserAt(objectsRef.current, ix, iy, eraserWidth / 2, nextScratchId)
      }
      dragRef.current = { kind: 'eraser', lastX: x, lastY: y }
      eraserCursorRef.current = { x, y }
      paint()
      return
    }

    if (drag.kind === 'pen') {
      const idx = objectsRef.current.findIndex((o) => o.id === drag.objectId)
      if (idx === -1) return
      const obj = objectsRef.current[idx]
      if (obj.kind !== 'stroke' && obj.kind !== 'highlight') return
      const last = obj.points[obj.points.length - 1]
      if (last && Math.hypot(x - last.x, y - last.y) < 1.5) return
      const updated: ScratchObject = { ...obj, points: [...obj.points, { x, y }] }
      objectsRef.current = [...objectsRef.current.slice(0, idx), updated, ...objectsRef.current.slice(idx + 1)]
      paint()
      return
    }

    if (drag.kind === 'shape') {
      previewRef.current = { shape: { tool: drag.tool, x1: drag.x1, y1: drag.y1, x2: x, y2: y } }
      paint()
      return
    }

    if (drag.kind === 'select-box') {
      previewRef.current = { box: { x1: drag.x1, y1: drag.y1, x2: x, y2: y } }
      paint()
      return
    }

    if (drag.kind === 'select-lasso') {
      const last = drag.points[drag.points.length - 1]
      const points =
        last && Math.hypot(x - last.x, y - last.y) < 4
          ? drag.points
          : [...drag.points, { x, y }]
      dragRef.current = { kind: 'select-lasso', points }
      previewRef.current = { lasso: points }
      paint()
      return
    }

    if (drag.kind === 'resize') {
      const newBounds = computeResizedBounds(drag.handle, drag.originBounds, x, y)
      const selected = selectedIdsRef.current
      objectsRef.current = scaleSelectedObjects(
        drag.originObjects,
        selected,
        drag.originBounds,
        newBounds,
        drag.handle,
      )
      paint()
      return
    }

    if (drag.kind === 'move') {
      const dx = x - drag.startX
      const dy = y - drag.startY
      const selected = selectedIdsRef.current
      objectsRef.current = drag.originObjects.map((obj) =>
        selected.has(obj.id) ? translateScratchObject(obj, dx, dy) : obj,
      )
      paint()
    }
  }, [getCanvasPoint, paint, tool, eraserWidth])

  const finishPointer = useCallback((e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e && activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
      return
    }
    activePointerIdRef.current = null

    const drag = dragRef.current
    dragRef.current = { kind: 'none' }

    if (drag.kind === 'eraser') {
      notifyChange()
      forceRender()
      switchToPenIfCanvasEmpty()
      return
    }

    if (drag.kind === 'shape') {
      const preview = previewRef.current.shape
      previewRef.current = {}
      if (preview) {
        const shape = createShapeObject(
          drag.tool === 'circle' ? 'circle' : drag.tool === 'triangle' ? 'triangle' : drag.tool === 'rect' ? 'rect' : 'line',
          getColorHex(colorId),
          strokeWidth,
          preview.x1,
          preview.y1,
          preview.x2,
          preview.y2,
          shapeFillEnabled,
          triangleVariant,
        )
        if (shape) {
          pushHistory()
          objectsRef.current = [...objectsRef.current, shape]
          notifyChange()
        }
      }
      forceRender()
      return
    }

    if (drag.kind === 'select-box') {
      const preview = previewRef.current.box
      previewRef.current = {}
      if (preview) {
        const rect = scratchRectBounds(preview.x1, preview.y1, preview.x2, preview.y2)
        const ids = objectsRef.current
          .filter((obj) => scratchObjectIntersectsRect(obj, rect))
          .map((o) => o.id)
        setSelection(ids)
      }
      paint()
      return
    }

    if (drag.kind === 'select-lasso') {
      const points = drag.points
      previewRef.current = {}
      if (points.length >= 3) {
        const ids = objectsRef.current
          .filter((obj) => scratchObjectIntersectsPolygon(obj, points))
          .map((o) => o.id)
        setSelection(ids)
      }
      paint()
      return
    }

    if (drag.kind === 'move' || drag.kind === 'resize') {
      refreshSelectionBounds()
      notifyChange()
      paint()
      return
    }

    if (drag.kind === 'pen') {
      notifyChange()
    }

    previewRef.current = {}
    forceRender()
  }, [colorId, strokeWidth, shapeFillEnabled, triangleVariant, pushHistory, setSelection, forceRender, notifyChange, paint, refreshSelectionBounds, switchToPenIfCanvasEmpty])

  const handlePointerUp = finishPointer

  const handleLostPointerCapture = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragRef.current.kind === 'none') return
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return
      finishPointer(e)
    },
    [finishPointer],
  )

  const handlePointerLeave = useCallback(() => {
    if (dragRef.current.kind !== 'none') return
    if (eraserCursorRef.current) {
      eraserCursorRef.current = null
      paint()
    }
  }, [paint])

  const getObjects = useCallback(() => deepCloneObjects(objectsRef.current), [])

  const canUndo = historyLen > 0
  const hasSelection = selectionCount > 0

  return {
    canvasRef,
    containerRef,
    tool,
    setTool,
    colorId,
    setColorId,
    pickColor,
    highlightColorId,
    pickHighlightColor,
    strokeWidth,
    setStrokeWidth,
    highlightWidth,
    setHighlightWidth,
    shapeFillEnabled,
    setShapeFillEnabled,
    triangleVariant,
    setTriangleVariant,
    eraserWidth,
    setEraserWidth,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleLostPointerCapture,
    handlePointerLeave,
    undo,
    canUndo,
    clearAll,
    deleteSelected,
    clearSelection,
    recolorSelected,
    duplicateSelected,
    hasSelection,
    selectionCount,
    selectionBoundsRect,
    surfaceSize,
    resetCanvas,
    insertImage,
    getObjects,
  }
}
