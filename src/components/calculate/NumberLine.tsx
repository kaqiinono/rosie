'use client'

import { useCallback, useRef, useState } from 'react'

type NumberLineProps = {
  min: number
  max: number
  step: number
  target: number
  onSubmit: (value: number) => void
  disabled?: boolean
}

function NumberLine({ min, max, step, target, onSubmit, disabled = false }: NumberLineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [snapped, setSnapped] = useState<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const releaseCountRef = useRef(0)

  const tickCount = Math.round((max - min) / step) + 1
  const ticks = Array.from({ length: tickCount }, (_, i) => min + i * step)

  const getValueFromPos = useCallback(
    (xPct: number) => {
      return min + xPct * (max - min)
    },
    [min, max],
  )

  const getPctFromValue = useCallback(
    (val: number) => {
      return (val - min) / (max - min)
    },
    [min, max],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [disabled],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || disabled || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setPos(pct)
    },
    [dragging, disabled],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || disabled) return
      setDragging(false)
      e.currentTarget.releasePointerCapture(e.pointerId)

      const value = getValueFromPos(pos)
      const nearest = ticks.reduce((best, t) =>
        Math.abs(t - value) < Math.abs(best - value) ? t : best,
      )
      const gridWidth = step / (max - min)
      const threshold = 0.4 * gridWidth
      const distance = Math.abs(value - nearest) / (max - min)

      releaseCountRef.current++

      if (distance <= threshold || releaseCountRef.current >= 2) {
        const finalValue = distance <= threshold ? nearest : value
        setPos(getPctFromValue(finalValue))
        setSnapped(finalValue)
        setHint(null)
        onSubmit(finalValue)
      } else {
        setHint('试着拖到刻度线上')
      }
    },
    [dragging, disabled, pos, ticks, getValueFromPos, getPctFromValue, step, max, min, onSubmit],
  )

  const targetPct = getPctFromValue(target)
  const isCorrect = snapped !== null && Math.abs(snapped - target) < step / 4

  const formatVal = (v: number) => {
    if (Number.isInteger(step)) return Math.round(v).toString()
    if (step === 0.25 || step === 0.5) {
      const denom = step === 0.25 ? 4 : 2
      const num = Math.round(v * denom)
      if (num % denom === 0) return (num / denom).toString()
      return `${num}/${denom}`
    }
    return v.toFixed(2)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl bg-white/[0.06] p-4 w-full">
        {/* Target indicator */}
        <div className="mb-6 text-center text-sm text-white/60">
          把 <span className="text-amber-400 font-bold">{formatVal(target)}</span> 拖到数轴上
        </div>

        {/* Track */}
        <div
          ref={containerRef}
          className="relative h-16 select-none touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Base line */}
          <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-white/30" />

          {/* Ticks */}
          {ticks.map((t) => {
            const pct = getPctFromValue(t)
            const isTarget = snapped !== null && Math.abs(t - target) < step / 4
            return (
              <div
                key={t}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pct * 100}%` }}
              >
                <div
                  className={`h-3 w-0.5 ${isTarget ? 'bg-green-400' : 'bg-white/40'}`}
                />
                <div className={`mt-1 text-[10px] ${isTarget ? 'text-green-400' : 'text-white/40'}`}>
                  {formatVal(t)}
                </div>
              </div>
            )
          })}

          {/* Correct target marker (shown after release) */}
          {snapped !== null && (
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${targetPct * 100}%` }}
            >
              <div className="h-6 w-0.5 bg-green-400" />
            </div>
          )}

          {/* Draggable ball */}
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab transition-transform ${
              dragging ? 'scale-110 cursor-grabbing' : ''
            }`}
            style={{ left: `${pos * 100}%` }}
          >
            <div
              className={`h-8 w-8 rounded-full border-2 shadow-lg ${
                snapped === null
                  ? 'border-blue-400 bg-blue-500'
                  : isCorrect
                    ? 'border-green-400 bg-green-500'
                    : 'border-red-400 bg-red-500'
              }`}
            />
          </div>
        </div>

        {hint && (
          <div className="mt-2 text-center text-xs text-amber-400">💡 {hint}</div>
        )}
      </div>
    </div>
  )
}

export default NumberLine
