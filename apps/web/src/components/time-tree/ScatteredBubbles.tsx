'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import Bubbles, { type BubblesProps } from '@/components/tree-demo/garden/Bubbles'

type Box = { left: number; top: number; right: number; bottom: number; ellipse?: boolean }
type BubbleSpec = { id: string; minutes: number }
type Placement = { id: string; x: number; y: number; size: number; clearance: number }
type BubbleLayout = { placements: Placement[]; sizes: Record<string, number> }
const DURATION_TIERS = [5, 10, 15, 20, 25, 30, 40, 60, 90, 120]
const CLEARANCE = 26 // Floating motion and the outer hold-to-finish ring.
const SWAY_TOLERANCE = 6 // A small obstacle movement should not relocate an existing bubble.

function bubbleDiameter(minutes: number, viewport: number) {
  const duration = Number.isFinite(minutes) ? Math.max(minutes, DURATION_TIERS[0]) : DURATION_TIERS[0]
  const upper = DURATION_TIERS.findIndex(limit => duration <= limit)
  let tier = DURATION_TIERS.length - 1
  if (upper === 0) tier = 0
  if (upper > 0) {
    const lowerMinutes = DURATION_TIERS[upper - 1]
    tier = upper - 1 + (duration - lowerMinutes) / (DURATION_TIERS[upper] - lowerMinutes)
  }
  const phone = 81 + 5 * tier
  const desktop = 86 + 6 * tier
  const screenRatio = Math.max(0, Math.min(1, (viewport - 640) / (1024 - 640)))
  return phone + (desktop - phone) * screenRatio
}

function clearanceAt(x: number, y: number, width: number, height: number, obstacles: Box[]) {
  let clearance = Math.min(x, width - x, y, height - y)
  let leafDistance = Infinity
  for (const box of obstacles) {
    const dx = x - Math.max(box.left, Math.min(x, box.right))
    const dy = y - Math.max(box.top, Math.min(y, box.bottom))
    let distance = Math.hypot(dx, dy)
    if (box.ellipse) {
      const rx = (box.right - box.left) / 2
      const ry = (box.bottom - box.top) / 2
      const normalized = Math.hypot((x - box.left - rx) / rx, (y - box.top - ry) / ry)
      distance = Math.max(0, normalized - 1) * Math.min(rx, ry)
      leafDistance = Math.min(leafDistance, distance)
    }
    clearance = Math.min(clearance, distance)
  }
  return { clearance, leafDistance }
}

function placeBubbles(width: number, height: number, viewport: number, obstacles: Box[], specs: BubbleSpec[], previous: BubbleLayout | null): BubbleLayout {
  const placements: Placement[] = []
  const sizes: Record<string, number> = {}
  const prior = new Map(previous?.placements.map(placement => [placement.id, placement] as const))
  const unplaced: { id: string; size: number; prior?: Placement }[] = []
  for (const { id, minutes } of specs) {
    const size = bubbleDiameter(minutes, viewport)
    sizes[id] = size
    const anchor = prior.get(id)
    if (anchor) {
      const { x, y } = anchor
      const { clearance } = clearanceAt(x, y, width, height, obstacles)
      const minimum = Math.min(size / 2, anchor.clearance) - SWAY_TOLERANCE
      if (clearance > 0 && clearance >= minimum) {
        placements.push({ ...anchor, size })
        continue
      }
    }
    unplaced.push({ id, size, prior: anchor })
  }
  if (!unplaced.length) return { placements, sizes }

  const leaves = obstacles.filter(box => box.ellipse)
  const centerX = leaves.length
    ? (Math.min(...leaves.map(box => box.left)) + Math.max(...leaves.map(box => box.right))) / 2
    : width / 2
  const candidates: { x: number; y: number; clearance: number; leafDistance: number }[] = []
  for (let y = CLEARANCE; y <= height - CLEARANCE; y += 6) {
    for (let x = CLEARANCE; x <= width - CLEARANCE; x += 6) {
      const { clearance, leafDistance } = clearanceAt(x, y, width, height, obstacles)
      if (clearance > CLEARANCE) candidates.push({ x, y, clearance, leafDistance })
    }
  }
  for (const { id, size, prior: anchor } of unplaced) {
    const radius = size / 2 + CLEARANCE
    const seed = Array.from(id).reduce((value, char) => (value * 31 + char.charCodeAt(0)) | 0, 0)
    // Stable per-task variation: timers/re-renders must not reshuffle the scene.
    const randomHeight = Math.sin(seed * 0.73) * 43758.5453
    const preferredY = radius + (randomHeight - Math.floor(randomHeight)) * size * 0.75
    const safe = candidates.filter(point => point.clearance >= radius)
    // Keep full-size bubbles during constrained/transient measurements. The
    // fallback maximizes clearance rather than silently dropping a task.
    const pool = safe.length ? safe : candidates
    let best: Placement | undefined
    let score = Infinity
    for (const point of pool) {
      const overlap = placements.reduce((sum, other) => {
        const distance = Math.hypot(point.x - other.x, point.y - other.y)
        // Prefer a small gap; allow overlap only when obstacle-free space is tight.
        const intrusion = Math.max(0, (size + other.size) / 2 + 8 - distance)
        return sum + intrusion * intrusion
      }, 0)
      const alignment = placements.reduce((sum, other) => {
        if (Math.abs(point.x - other.x) > (size + other.size) * 0.8) return sum
        return sum + Math.max(0, Math.min(size, other.size) * 0.3 - Math.abs(point.y - other.y))
      }, 0)
      const noise = (Math.sin(seed + point.x * 0.047 + point.y * 0.063) + 1) * 16
      const edgeGap = Number.isFinite(point.leafDistance) ? Math.abs(point.leafDistance - radius) : 0
      const movement = anchor ? Math.hypot(point.x - anchor.x, point.y - anchor.y) : 0
      // Fill the upper contour first, then descend around the day-leaf perimeter.
      // No grid anchors and no change to the tree's geometry or available space.
      const value = point.y * 0.25 + Math.abs(point.y - preferredY) * 0.9 +
        Math.abs(point.x - centerX) * 0.45 +
        edgeGap * 0.15 + overlap * 0.65 + alignment * 1.2 + movement * 0.45 + noise +
        Math.max(0, radius - point.clearance) * 1000
      if (value < score) {
        best = { id, x: point.x, y: point.y, size, clearance: point.clearance }
        score = value
      }
    }
    const x = width / 2
    const y = Math.min(radius, height / 2)
    placements.push(best ?? { id, x, y, size, clearance: clearanceAt(x, y, width, height, obstacles).clearance })
  }
  return { placements, sizes }
}

export default function ScatteredBubbles(props: BubblesProps) {
  const area = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<BubbleLayout | null>(null)
  // Only layout inputs trigger measurement; timer updates do not move bubbles.
  const signature = JSON.stringify([...props.bubbles]
    .sort((a, b) => (props.slots[a.id] ?? 0) - (props.slots[b.id] ?? 0))
    .map(({ id, minutes }) => ({ id, minutes })))
  useLayoutEffect(() => {
    const element = area.current
    const scene = element?.closest<HTMLElement>('.tg-scene')
    if (!element || !scene) return
    const specs: BubbleSpec[] = JSON.parse(signature)
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const header = scene.querySelector('header')?.getBoundingClientRect()
        if (header) scene.style.setProperty('--tg-header-height', `${header.bottom - scene.getBoundingClientRect().top + 8}px`)
        const bounds = element.getBoundingClientRect()
        const obstacles = Array.from(scene.querySelectorAll('[data-tree-obstacle]')).flatMap((node) => {
          const rect = node.getBoundingClientRect()
          if (!rect.width || !rect.height) return []
          // Day leaves and labels sway with the tree; protect their full bounds plus a margin.
          return [{ left: rect.left - bounds.left - 12, right: rect.right - bounds.left + 12,
            top: rect.top - bounds.top - 12, bottom: rect.bottom - bounds.top + 12, ellipse: node.getAttribute('data-tree-obstacle') === 'day-region' }]
        })
        const viewport = window.innerWidth
        setLayout(previous => placeBubbles(bounds.width, bounds.height, viewport, obstacles, specs, previous))
      })
    }
    const observer = new ResizeObserver(measure)
    const observeObstacles = () => {
      observer.disconnect()
      observer.observe(element)
      const header = scene.querySelector('header')
      if (header) observer.observe(header)
      const treeWrap = scene.querySelector('.tg-tree-wrap')
      if (treeWrap) observer.observe(treeWrap)
      scene.querySelectorAll('[data-tree-obstacle]').forEach((node) => observer.observe(node))
      measure()
    }
    observeObstacles()
    const tree = scene.querySelector('.tg-tree-wrap')
    const changes = new MutationObserver(observeObstacles)
    if (tree) changes.observe(tree, { childList: true, subtree: true, characterData: true })
    const sky = scene.querySelector('.tg-sky')
    if (sky) changes.observe(sky, { childList: true, subtree: true })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      changes.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [signature])

  const positions = Object.fromEntries((layout?.placements ?? []).map((item) => [item.id, { x: item.x, y: item.y }]))
  return (
    <div ref={area} className="tg-bubble-area tg-bubble-area--scattered">
      <Bubbles {...props} bubbles={props.bubbles.filter(bubble => positions[bubble.id])} positions={positions} sizes={layout?.sizes} />
    </div>
  )
}
