import { useCallback, useRef } from 'react'
import type { IApi } from '@svar-ui/react-gantt'

function measurePinch(first: Touch, second: Touch, viewport: HTMLElement, rotated: boolean) {
  const rect = viewport.getBoundingClientRect()
  const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
  // In the portrait dialog, the timeline runs along the screen's Y axis.
  const offset = rotated
    ? (first.clientY + second.clientY) / 2 - rect.top
    : (first.clientX + second.clientX) / 2 - rect.left
  return { distance, offset }
}

export function useCourseGanttPinchZoom(baseWidth: number, cellCount: number) {
  const ganttRef = useRef<IApi>(null)
  const chartRef = useCallback((root: HTMLDivElement | null) => {
    if (!root || cellCount < 1) return

    const listeners = new AbortController()
    const portrait = window.matchMedia('(orientation: portrait)')
    let pinch: {
      viewport: HTMLElement
      rotated: boolean
      distance: number
      width: number
      anchor: number
    } | null = null
    let frame = 0

    function stop() {
      pinch = null
      window.cancelAnimationFrame(frame)
      frame = 0
    }

    function start(event: TouchEvent) {
      stop()
      if (event.touches.length !== 2) return
      const api = ganttRef.current
      const first = event.touches.item(0)
      const second = event.touches.item(1)
      if (!api || !(first?.target instanceof Element) || !(second?.target instanceof Node)) return
      const viewport = first.target.closest<HTMLElement>('.wx-chart')
      if (!viewport || !root?.contains(viewport) || !viewport.contains(second.target)) return

      const rotated = portrait.matches
      const { distance, offset } = measurePinch(first, second, viewport, rotated)
      const width = api.getState().cellWidth
      if (!width || !distance) return
      pinch = { viewport, rotated, distance, width, anchor: (viewport.scrollLeft + offset) / width }
      if (event.cancelable) event.preventDefault()
    }

    function move(event: TouchEvent) {
      const active = pinch
      if (!active) return
      if (event.touches.length !== 2 || portrait.matches !== active.rotated) {
        stop()
        return
      }
      const api = ganttRef.current
      const first = event.touches.item(0)
      const second = event.touches.item(1)
      if (!api || !first || !second) return
      if (event.cancelable) event.preventDefault()

      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const { viewport } = active
        const { distance, offset } = measurePinch(first, second, viewport, active.rotated)
        const viewportWidth = viewport.clientWidth
        const minWidth = Math.max(Math.ceil(baseWidth * 0.75), Math.ceil(viewportWidth / cellCount))
        const maxWidth = Math.max(baseWidth, minWidth) * 4
        const width = Math.round(active.width * distance / active.distance)
        const cellWidth = Math.min(maxWidth, Math.max(minWidth, width))
        const maxScroll = cellWidth * cellCount - viewportWidth
        const scrollLeft = Math.round(Math.min(maxScroll, Math.max(0, active.anchor * cellWidth - offset)))
        const current = api.getState()
        if (current.cellWidth === cellWidth && current.scrollLeft === scrollLeft) return

        // Commit width and scroll together to keep the same date beneath the pinch midpoint.
        api.getStores().data.setState({ cellWidth, scrollLeft })
      })
    }

    function end() {
      // Let any queued movement finish after the fingers lift.
      pinch = null
    }

    const options = { passive: false, signal: listeners.signal }
    root.addEventListener('touchstart', start, options)
    root.addEventListener('touchmove', move, options)
    root.addEventListener('touchend', end, options)
    root.addEventListener('touchcancel', stop, options)
    return () => {
      stop()
      listeners.abort()
    }
  }, [baseWidth, cellCount])

  return { chartRef, ganttRef }
}
