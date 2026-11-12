'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { SUBJECTS, flowersOfBud, type Bud } from './model'

/** 泡泡底色按科目区分（语文红 / 数学黄 / 英语蓝 / 生活绿）；状态由文案和边框表达，见 garden.css */
export const bubbleStates = {
  ready: { label: '▷ 待开始' },
  overdue: { label: '↻ 待补做' },
  running: { label: '◷ 进行中' },
  done: { label: '✓ 已完成 · 点我开花' },
}
export type BubbleState = keyof typeof bubbleStates

const SUBJECT_TINT = {
  chinese: '#ff9d9d',
  math: '#ffe25a',
  english: '#8fc2ff',
  life: '#7fe39a',
} as const

/** 短按上限。超过才进入按住开花，轻点不会画出快圈。 */
const ARM_MS = 180
/** 快圈转满的时间，从进入按住开始算，不用分钟进度圈。 */
const FILL_MS = 800
const TAP_SLOP = 12
/** 滑出判定含外圈：慢进度环约 8px，按住环再往外约 15px。 */
const HOLD_PAD = 18
const RETRACT_MS = 180

type Props = {
  bubbles: Bud[]
  states?: Record<string, BubbleState>
  slots: Record<string, number>
  /** 进行中泡泡的开始时刻。没有开始时刻的泡泡不画进度环。 */
  startedAt?: Record<string, string>
  onOpen: (budId: string) => void
  /** 进行中泡泡按住转满后松开。没传则仍是点一下打开。 */
  onHoldFinish?: (budId: string) => void
  /** 正在记账时不要开始新的按住完成。 */
  holdLocked?: boolean
}

type BubbleStyle = CSSProperties & Record<'--tg-size' | '--tg-tint' | '--tg-dur' | '--tg-delay', string>

type HoldGesture = {
  id: string
  pointerId: number
  x: number
  y: number
  lastX: number
  lastY: number
  dist: number
  armed: boolean
  armedAt: number
  progress: number
  el: HTMLDivElement
  armTimer: number
  timer: number
  stopWindow: () => void
}

const OVERTIME = '#d97706'

function pointInside(el: HTMLElement, x: number, y: number): boolean {
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const radius = rect.width / 2 + HOLD_PAD
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function RunningTimer({
  minutes,
  startedAt,
  now,
  color,
}: {
  minutes: number
  startedAt: string
  now: number
  color: string
}) {
  const started = Date.parse(startedAt)
  if (!Number.isFinite(started) || minutes <= 0) return null
  const ratio = Math.min(1, Math.max(0, (now - started) / (minutes * 60000)))
  const arc = now - started >= minutes * 60000 ? OVERTIME : color
  const drawn = ratio * 100
  return (
    <svg className="tg-bubble-timer" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="tg-bubble-track" cx="50" cy="50" r="48" />
      {drawn > 0 && (
        <circle
          className="tg-bubble-arc"
          cx="50"
          cy="50"
          r="48"
          pathLength={100}
          stroke={arc}
          strokeLinecap={ratio >= 1 ? 'butt' : 'round'}
          strokeDasharray={`${drawn} ${100 - drawn}`}
          transform="rotate(-90 50 50)"
        />
      )}
    </svg>
  )
}

function HoldRing({ progress, color }: { progress: number; color: string }) {
  const drawn = Math.max(0, Math.min(100, progress * 100))
  return (
    <svg className="tg-bubble-hold" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="tg-bubble-track" cx="50" cy="50" r="48" />
      {drawn > 0 && (
        <circle
          className="tg-bubble-hold-arc"
          cx="50"
          cy="50"
          r="48"
          pathLength={100}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${drawn} ${100 - drawn}`}
          transform="rotate(-90 50 50)"
        />
      )}
    </svg>
  )
}

/** 放学以后飘在树旁边和上方的泡泡，同时最多 4 个，各占一个固定天空位置 */
export default function Bubbles({ bubbles, slots, states, startedAt, onOpen, onHoldFinish, holdLocked = false }: Props) {
  const timing = bubbles.some((bud) => states?.[bud.id] === 'running' && startedAt?.[bud.id])
  const [now, setNow] = useState(() => Date.now())
  const [holdingId, setHoldingId] = useState<string | null>(null)
  const [holdRing, setHoldRing] = useState<{ id: string; progress: number } | null>(null)
  const holdRef = useRef<HoldGesture | null>(null)
  const retractRef = useRef(0)
  const settledPointer = useRef<number | null>(null)
  const leaveRef = useRef<() => void>(() => {})
  useEffect(() => {
    if (!timing) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [timing])

  function clearGesture(): void {
    const gesture = holdRef.current
    if (!gesture) return
    window.clearTimeout(gesture.armTimer)
    window.clearInterval(gesture.timer)
    gesture.stopWindow()
    holdRef.current = null
  }

  function retractRing(id: string, from: number): void {
    window.clearInterval(retractRef.current)
    if (from <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHoldRing((ring) => (ring?.id === id ? null : ring))
      return
    }
    const started = performance.now()
    retractRef.current = window.setInterval(() => {
      if (holdRef.current) return
      const progress = from * (1 - Math.min(1, (performance.now() - started) / RETRACT_MS))
      if (progress <= 0.02) {
        window.clearInterval(retractRef.current)
        setHoldRing((ring) => (ring?.id === id ? null : ring))
      } else setHoldRing({ id, progress })
    }, 32)
  }

  function leaveHold(): void {
    const gesture = holdRef.current
    if (!gesture) return
    const armed = gesture.armed
    const progress = gesture.progress
    const id = gesture.id
    clearGesture()
    setHoldingId(null)
    if (armed) retractRing(id, progress)
    else setHoldRing((ring) => (ring?.id === id ? null : ring))
  }
  leaveRef.current = leaveHold

  useEffect(() => {
    if (holdLocked) leaveRef.current()
  }, [holdLocked])
  useEffect(
    () => () => {
      const gesture = holdRef.current
      if (gesture) {
        window.clearTimeout(gesture.armTimer)
        window.clearInterval(gesture.timer)
        gesture.stopWindow()
      }
      window.clearInterval(retractRef.current)
      holdRef.current = null
    },
    [],
  )

  function startHold(event: ReactPointerEvent<HTMLDivElement>, id: string): void {
    if (event.button !== 0 || holdLocked || !onHoldFinish || holdRef.current) return
    event.preventDefault()
    const el = event.currentTarget
    try {
      el.setPointerCapture(event.pointerId)
    } catch {
      // 合成事件或指针已结束时没有捕获，元素上的松开仍然有效。
    }
    window.clearInterval(retractRef.current)
    settledPointer.current = null
    const gesture: HoldGesture = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dist: 0,
      armed: false,
      armedAt: 0,
      progress: 0,
      el,
      armTimer: 0,
      timer: 0,
      stopWindow: () => {},
    }
    gesture.stopWindow = listenOutside(gesture)
    gesture.armTimer = window.setTimeout(() => {
      if (holdRef.current !== gesture) return
      if (!pointInside(gesture.el, gesture.lastX, gesture.lastY)) {
        leaveHold()
        return
      }
      gesture.armed = true
      gesture.armedAt = performance.now()
      gesture.progress = 0
      const started = gesture.armedAt
      setHoldingId(gesture.id)
      setHoldRing({ id: gesture.id, progress: 0 })
      gesture.timer = window.setInterval(() => {
        if (holdRef.current !== gesture) return
        const progress = Math.min(1, (performance.now() - started) / FILL_MS)
        gesture.progress = progress
        setHoldRing({ id: gesture.id, progress })
        if (progress >= 1) {
          window.clearInterval(gesture.timer)
          gesture.timer = 0
        }
      }, 32)
    }, ARM_MS)
    holdRef.current = gesture
  }

  function moveHold(event: ReactPointerEvent<HTMLDivElement>): void {
    const gesture = holdRef.current
    if (!gesture || event.pointerId !== gesture.pointerId) return
    gesture.lastX = event.clientX
    gesture.lastY = event.clientY
    gesture.dist = Math.max(gesture.dist, Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y))
    if (!pointInside(gesture.el, event.clientX, event.clientY)) leaveHold()
  }

  function listenOutside(gesture: HoldGesture): () => void {
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== gesture.pointerId || holdRef.current !== gesture) return
      gesture.lastX = event.clientX
      gesture.lastY = event.clientY
      gesture.dist = Math.max(gesture.dist, Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y))
      if (!pointInside(gesture.el, event.clientX, event.clientY)) leaveHold()
    }
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== gesture.pointerId || holdRef.current !== gesture) return
      endHold(event)
    }
    const onCancel = (event: PointerEvent) => {
      if (event.pointerId !== gesture.pointerId || holdRef.current !== gesture) return
      leaveHold()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }

  function endHold(event: { clientX: number; clientY: number; pointerId: number }): void {
    const gesture = holdRef.current
    if (!gesture || event.pointerId !== gesture.pointerId) return
    const inside = pointInside(gesture.el, event.clientX, event.clientY)
    const armed = gesture.armed
    const progress = armed ? Math.min(1, (performance.now() - gesture.armedAt) / FILL_MS) : 0
    const filled = progress >= 1
    const tap = !armed && gesture.dist <= TAP_SLOP && inside
    const id = gesture.id
    settledPointer.current = event.pointerId
    clearGesture()
    setHoldingId(null)
    if (armed && filled && inside) {
      setHoldRing(null)
      onHoldFinish?.(id)
      return
    }
    if (armed) {
      retractRing(id, progress)
      return
    }
    setHoldRing((ring) => (ring?.id === id ? null : ring))
    if (tap) onOpen(id)
  }

  function lostHold(event: ReactPointerEvent<HTMLDivElement>): void {
    const pointerId = event.pointerId
    if (settledPointer.current === pointerId) return
    queueMicrotask(() => {
      if (settledPointer.current === pointerId) return
      const gesture = holdRef.current
      if (!gesture || gesture.pointerId !== pointerId) return
      leaveHold()
    })
  }

  return (
    <>
      {bubbles.map((bud) => {
        const n = flowersOfBud(bud)
        const meta = SUBJECTS[bud.subject]
        const slot = slots[bud.id] ?? 0
        const status = states?.[bud.id]
        const label = status ? bubbleStates[status].label + (status === 'running' && bud.overdue ? ' · 补做' : '') : ''
        const start = status === 'running' ? startedAt?.[bud.id] : undefined
        const startedMs = start ? Date.parse(start) : NaN
        const elapsedMin = Number.isFinite(startedMs) ? Math.max(0, Math.floor((now - startedMs) / 60000)) : null
        const holdable = status === 'running' && !!onHoldFinish
        const hint = holdable ? '，按住开花，点一下查看' : ''
        const style: BubbleStyle = {
          '--tg-size': `clamp(${72 + n * 4}px, ${12 + n}vw, ${104 + n * 10}px)`,
          '--tg-tint': SUBJECT_TINT[bud.subject],
          '--tg-dur': `${3.8 + (slot % 3) * 0.7}s`,
          '--tg-delay': `${-slot * 0.9}s`,
        }
        return (
          <div key={bud.id} className="tg-bslot" data-slot={slot}>
            {/* native-ok: 泡泡是游戏物件，不是标准按钮，用 div + role=button 并支持键盘 */}
            <div
              role="button"
              tabIndex={0}
              data-state={status}
              data-bubble-id={bud.id}
              data-holding={holdingId === bud.id ? 'true' : undefined}
              aria-label={`${meta.label}：${bud.name}，${n} 朵花 ${label}${
                elapsedMin !== null ? `，已进行 ${elapsedMin} 分钟，预计 ${bud.minutes} 分钟` : ''
              }${hint}`}
              className="tg-bubble"
              style={style}
              onClick={holdable ? undefined : () => onOpen(bud.id)}
              onPointerDown={holdable ? (event) => startHold(event, bud.id) : undefined}
              onPointerMove={holdable ? moveHold : undefined}
              onPointerUp={holdable ? endHold : undefined}
              onPointerCancel={holdable ? leaveHold : undefined}
              onLostPointerCapture={holdable ? lostHold : undefined}
              onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpen(bud.id)
                }
              }}
            >
              {start && (
                <RunningTimer minutes={bud.minutes} startedAt={start} now={now} color={meta.color} />
              )}
              {holdRing?.id === bud.id && <HoldRing progress={holdRing.progress} color={meta.color} />}
              <span className="tg-bubble-in">
                <span className="block text-[calc(var(--tg-size)*0.26)] leading-none">{meta.emoji}</span>
                <span className="mt-0.5 line-clamp-2 block text-[calc(var(--tg-size)*0.13)] font-extrabold leading-tight text-[#4a3728]">
                  {bud.name}
                </span>
                <span className="block text-[calc(var(--tg-size)*0.1)] leading-none tracking-wider">{label || '🌸'.repeat(n)}</span>
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
}
