'use client'

import { useEffect, useState } from 'react'
import { useStarHud } from './StarHudProvider'
import { STAR_COLOR_HEX, type StarColor } from './star-types'

interface Props {
  /** Which color of star this page rewards. */
  color: StarColor
  /** Target number of stars for the progress bar to fill. */
  target: number
  /** Optional label override. Default uses 中文 label by color. */
  label?: string
  /** Show milestone tick marks at each 25% of target. */
  milestones?: boolean
  /** Compact layout for mobile. */
  compact?: boolean
}

/** Animated star progress for the current page/session. */
export default function StarProgressBar({ color, target, label, milestones = true, compact = false }: Props) {
  const hud = useStarHud()
  const value = hud.session[color]
  const hex = STAR_COLOR_HEX[color]
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0

  // Pulse effect when value increases
  const [pulse, setPulse] = useState(false)
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    if (value > prev) setPulse(true)
    setPrev(value)
  }
  useEffect(() => {
    if (!pulse) return
    const t = window.setTimeout(() => setPulse(false), 600)
    return () => window.clearTimeout(t)
  }, [pulse])

  const ticks = milestones && target > 0
    ? [0.25, 0.5, 0.75].map(f => Math.round(f * target))
    : []

  return (
    <div className={`flex flex-col gap-1.5 ${compact ? '' : 'p-1'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full font-fredoka text-[11px] font-black leading-none"
            style={{
              background: `linear-gradient(135deg, ${hex.primary}, ${hex.outline})`,
              color: '#fff',
              boxShadow: `0 1px 4px ${hex.glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
              textShadow: '0 1px 1px rgba(0,0,0,0.25)',
              border: `1.5px solid ${hex.outline}`,
            }}
            aria-label={hex.cnLabel}
          >
            {hex.badge}
          </span>
          <span
            className={`font-fredoka text-[12px] font-black ${pulse ? 'animate-pulse' : ''}`}
            style={{ color: hex.outline }}
          >
            {label ?? `${hex.cnLabel}${hex.shapeLabel}`}
          </span>
        </div>
        <span
          className="font-fredoka text-[12px] font-black tabular-nums"
          style={{ color: hex.outline }}
        >
          <span className={pulse ? 'inline-block animate-bounce' : 'inline-block'}>{value}</span>
          <span className="text-[10px] opacity-60">/{target}</span>
        </span>
      </div>

      <div
        className="relative h-3 overflow-hidden rounded-full"
        style={{
          background: 'rgba(0,0,0,0.06)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
        }}
      >
        {/* Filled portion */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${hex.soft}, ${hex.primary})`,
            boxShadow: `0 0 12px ${hex.glow}, inset 0 1px 0 rgba(255,255,255,0.5)`,
          }}
        />
        {/* Animated shimmer */}
        {pct > 0 && pct < 100 && (
          <div
            className="pointer-events-none absolute inset-y-0 w-1/3 opacity-50 mix-blend-overlay"
            style={{
              left: `${Math.max(0, pct - 18)}%`,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
              animation: 'burst-bar-shimmer 1.6s linear infinite',
            }}
          />
        )}
        {/* Milestone ticks */}
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-1/2 h-2 w-0.5 -translate-y-1/2 rounded-full"
            style={{
              left: `${(t / target) * 100}%`,
              background: value >= t ? '#ffffff' : 'rgba(0,0,0,0.18)',
              boxShadow: value >= t ? `0 0 4px ${hex.glow}` : 'none',
            }}
            aria-hidden
          />
        ))}
        {/* Goal flag */}
        <div
          className="absolute top-1/2 right-0.5 -translate-y-1/2 text-[10px] leading-none"
          style={{ filter: value >= target ? `drop-shadow(0 0 4px ${hex.glow})` : 'grayscale(40%)', opacity: value >= target ? 1 : 0.5 }}
          aria-hidden
        >
          🏁
        </div>
      </div>
    </div>
  )
}
