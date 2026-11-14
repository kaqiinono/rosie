'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Position = { x: number; y: number }
type DragStart = Position & { pointerX: number; pointerY: number; pointerId: number; moved: boolean }

const EDGE_GAP = 8
const DRAG_THRESHOLD = 6
const KEY_MOVEMENT: Record<string, Position> = {
  ArrowLeft: { x: -24, y: 0 },
  ArrowRight: { x: 24, y: 0 },
  ArrowUp: { x: 0, y: -24 },
  ArrowDown: { x: 0, y: 24 },
}

export function useFloatingLauncherPosition({
  storageKey,
  visible = true,
  draggable = true,
  getDefaultPosition,
}: {
  storageKey: string
  visible?: boolean
  draggable?: boolean
  getDefaultPosition?: (launcher: HTMLButtonElement) => Position | undefined
}) {
  const launcherRef = useRef<HTMLButtonElement>(null)
  const dragStart = useRef<DragStart | null>(null)
  const suppressClick = useRef(false)
  const movedPosition = useRef<Position | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [dragging, setDragging] = useState(false)

  const place = useCallback((target: Position, persist = false) => {
    const launcher = launcherRef.current
    if (!launcher?.offsetWidth) return
    const next = {
      x: Math.max(EDGE_GAP, Math.min(target.x, window.innerWidth - launcher.offsetWidth - EDGE_GAP)),
      y: Math.max(EDGE_GAP, Math.min(target.y, window.innerHeight - launcher.offsetHeight - EDGE_GAP)),
    }
    setPosition(next)
    if (persist) {
      movedPosition.current = next
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Keep the in-memory position when storage is unavailable.
      }
    }
  }, [storageKey])

  useEffect(() => {
    if (!visible) return
    try {
      const raw = localStorage.getItem(storageKey)
      const saved = raw ? JSON.parse(raw) as Partial<Position> | null : null
      if (typeof saved?.x === 'number' && typeof saved.y === 'number' &&
          Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        movedPosition.current ??= { x: saved.x, y: saved.y }
      }
    } catch {
      // A missing or malformed preference uses the default position.
    }
    const sync = () => {
      const launcher = launcherRef.current
      if (!launcher) return
      const target = movedPosition.current ?? getDefaultPosition?.(launcher)
      if (target) place(target)
      else setPosition(null)
    }
    const frame = requestAnimationFrame(sync)
    window.addEventListener('resize', sync)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', sync)
    }
  }, [getDefaultPosition, place, storageKey, visible])

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!draggable || event.button !== 0 || !event.isPrimary) return
    const rect = event.currentTarget.getBoundingClientRect()
    suppressClick.current = false
    dragStart.current = {
      x: rect.left, y: rect.top, pointerX: event.clientX, pointerY: event.clientY,
      pointerId: event.pointerId, moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function dragPosition(event: PointerEvent<HTMLButtonElement>, start: DragStart) {
    const dx = event.clientX - start.pointerX
    const dy = event.clientY - start.pointerY
    if (!start.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    return { x: start.x + dx, y: start.y + dy }
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return
    const target = dragPosition(event, start)
    if (!target) return
    start.moved = true
    setDragging(true)
    place(target)
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return
    dragStart.current = null
    setDragging(false)
    const target = dragPosition(event, start)
    if (!target) return
    suppressClick.current = true
    place(target, true)
  }

  function onPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return
    dragStart.current = null
    setDragging(false)
    if (start.moved && position) place(position, true)
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const delta = KEY_MOVEMENT[event.key]
    if (!draggable || !delta) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    place({ x: rect.left + delta.x, y: rect.top + delta.y }, true)
  }

  function consumeDragClick() {
    const suppressed = suppressClick.current
    suppressClick.current = false
    return suppressed
  }

  return {
    launcherRef,
    launcherStyle: position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined,
    dragging,
    consumeDragClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture: onPointerCancel, onKeyDown },
  }
}
