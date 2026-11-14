'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { StickerCard } from './StickerCard'
import { Popover } from './themes'

type Side = 'bottom' | 'top' | 'right' | 'left'
type Align = 'start' | 'center' | 'end'
type Placement = { side: Side; align: Align } | 'measuring' | 'inline'
type Rect = { left: number; top: number; right: number; bottom: number }
const GAP = 12
const intersects = (a: Rect, b: Rect) => a.left < b.right + 6 && a.right > b.left - 6 && a.top < b.bottom + 6 && a.bottom > b.top - 6

/** Text line boxes, rather than paragraph boxes, let genuinely empty margins remain usable. */
function occupiedRects(panel: HTMLElement): DOMRect[] {
  const rects: DOMRect[] = []
  const visible = (element: Element) => !panel.contains(element) && !element.closest('[hidden], [aria-hidden="true"], [data-handwriting-panel]')
    && getComputedStyle(element).visibility === 'visible'
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!node.textContent?.trim() || !node.parentElement || !visible(node.parentElement)) continue
    range.selectNodeContents(node)
    rects.push(...Array.from(range.getClientRects()))
  }
  document.querySelectorAll('button, input, textarea, select, img, svg, video, canvas, iframe, [role="img"], [role="dialog"], header').forEach(element => {
    if (visible(element)) rects.push(element.getBoundingClientRect())
  })
  return rects.filter(rect => rect.width > 0 && rect.height > 0)
}

function findPlacement(anchor: DOMRect, panel: { width: number; height: number }, occupied: Rect[]): Placement {
  const viewport = window.visualViewport
  const left = (viewport?.offsetLeft ?? 0) + GAP
  const top = (viewport?.offsetTop ?? 0) + GAP
  const right = left + (viewport?.width ?? document.documentElement.clientWidth) - GAP * 2
  const bottom = top + (viewport?.height ?? window.innerHeight) - GAP * 2
  for (const side of ['bottom', 'top', 'right', 'left'] as const) {
    for (const align of ['start', 'end', 'center'] as const) {
      const vertical = side === 'bottom' || side === 'top'
      const crossStart = vertical ? anchor.left : anchor.top
      const crossEnd = vertical ? anchor.right : anchor.bottom
      const crossSize = vertical ? panel.width : panel.height
      const cross = align === 'start' ? crossStart : align === 'end' ? crossEnd - crossSize : (crossStart + crossEnd - crossSize) / 2
      const x = vertical ? cross : side === 'right' ? anchor.right + GAP : anchor.left - GAP - panel.width
      const y = !vertical ? cross : side === 'bottom' ? anchor.bottom + GAP : anchor.top - GAP - panel.height
      const candidate = { left: x, top: y, right: x + panel.width, bottom: y + panel.height }
      if (x >= left && y >= top && candidate.right <= right && candidate.bottom <= bottom
        && !occupied.some(rect => intersects(candidate, rect))) return { side, align }
    }
  }
  return 'inline'
}

/** Internal presentation shell. The caller supplies an outlet AFTER the complete question. */
export function HandwritingAnchor({ open, onOpenChange, trigger, children, label, inlineTarget }: {
  open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactNode; children: ReactNode
  label: string; inlineTarget?: RefObject<HTMLDivElement | null>
}) {
  const id = useId()
  const anchor = useRef<HTMLButtonElement>(null)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const [placement, setPlacement] = useState<Placement>('measuring')
  const inline = placement === 'inline'
  const focusPending = useRef(false)
  const wasOpen = useRef(false)
  const changeOpen = (next: boolean) => {
    if (next) {
      setPlacement('measuring'); focusPending.current = true
      window.dispatchEvent(new CustomEvent('rosie-handwriting-open', { detail: id }))
    } else anchor.current?.focus({ preventScroll: true })
    onOpenChange(next)
  }
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])
  useLayoutEffect(() => {
    if (wasOpen.current && !open && document.activeElement === document.body) anchor.current?.focus({ preventScroll: true })
    wasOpen.current = open
  }, [open])
  useLayoutEffect(() => {
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) onOpenChangeRef.current(false)
    }
    window.addEventListener('rosie-handwriting-open', closeOther)
    return () => window.removeEventListener('rosie-handwriting-open', closeOther)
  }, [id])

  useLayoutEffect(() => {
    if (!open || !panel || !anchor.current || inline) return
    // Without a below-question outlet, use the local in-flow fallback immediately.
    const measure = () => {
      if (!anchor.current) return
      const next = inlineTarget?.current
        ? findPlacement(anchor.current.getBoundingClientRect(), { width: panel.offsetWidth, height: panel.offsetHeight }, occupiedRects(panel))
        : 'inline'
      if (next === 'inline') focusPending.current = true
      setPlacement(previous => {
        // Once expanded, stay in flow until the user closes it; never jump while writing.
        if (previous === 'inline') return previous
        if (typeof previous === 'object' && typeof next === 'object' && previous.side === next.side && previous.align === next.align) return previous
        return next
      })
    }
    measure()
    let frame = 0
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    observer.observe(panel)
    observer.observe(document.body)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    return () => {
      cancelAnimationFrame(frame); observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
    }
  }, [open, panel, inlineTarget, inline])

  useLayoutEffect(() => {
    if (open && panel?.isConnected && placement !== 'measuring' && focusPending.current) {
      panel.querySelector<HTMLElement>('button, input')?.focus({ preventScroll: true })
      focusPending.current = false
    }
  }, [open, panel, placement])

  const expanded = open && placement === 'inline' ? <div ref={setPanel} id={id} data-handwriting-panel
    role="group" aria-label={label} className="mt-3 w-full max-w-[312px]"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); changeOpen(false) } }}>
    <StickerCard size="sm" elevation="flat">{children}</StickerCard>
  </div> : null

  return <>
    <Popover.Root modal={false} open={open && placement !== 'inline'} onOpenChange={next => changeOpen(open ? false : next)}>
      <Popover.Trigger ref={anchor} aria-expanded={open} aria-controls={open ? id : undefined}>{trigger}</Popover.Trigger>
      <Popover.Content ref={setPanel} id={id} data-handwriting-panel aria-label={label} size="1"
        width="312px" maxWidth="calc(100vw - 24px)"
        side={typeof placement === 'object' ? placement.side : 'bottom'} align={typeof placement === 'object' ? placement.align : 'start'}
        sideOffset={GAP} avoidCollisions={false} style={{ visibility: placement === 'measuring' ? 'hidden' : undefined }}
        onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => {
          event.preventDefault()
          if (!open && (document.activeElement === document.body || panel?.contains(document.activeElement))) anchor.current?.focus({ preventScroll: true })
        }}>
        {children}
      </Popover.Content>
    </Popover.Root>
    {expanded && (inlineTarget?.current ? createPortal(expanded, inlineTarget.current) : expanded)}
  </>
}
