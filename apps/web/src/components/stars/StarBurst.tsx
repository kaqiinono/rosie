'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useStarHud } from './StarHudProvider'
import { STAR_COLOR_HEX, type BurstEvent, type StarColor } from './star-types'

interface Sparkle {
  dx: number
  dy: number
  size: number
  delay: number
  rotate: number
}

function makeSparkles(count: number, seed: number): Sparkle[] {
  // Tiny deterministic-ish RNG so identical bursts look the same on re-render
  let s = seed
  const rng = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: count }, () => {
    const angle = rng() * Math.PI * 2
    const dist = 50 + rng() * 80
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 20, // bias upward
      size: 8 + rng() * 14,
      delay: rng() * 120,
      rotate: rng() * 360,
    }
  })
}

function BigStar({ color, size = 96 }: { color: StarColor; size?: number }) {
  const hex = STAR_COLOR_HEX[color]
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id={`bg-${color}`} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor={hex.soft} />
          <stop offset="80%" stopColor={hex.primary} />
          <stop offset="100%" stopColor={hex.outline} />
        </radialGradient>
      </defs>
      <path
        d="M12 1.8l2.9 6.3 6.9.8-5.2 4.6 1.5 6.8L12 16.9l-6.1 3.4 1.5-6.8L2.2 8.9l6.9-.8L12 1.8z"
        fill={`url(#bg-${color})`}
        stroke={hex.outline}
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter={`drop-shadow(0 0 14px ${hex.glow})`}
      />
      <text
        x="12"
        y="14.5"
        textAnchor="middle"
        fontFamily="Fredoka, system-ui, sans-serif"
        fontWeight="900"
        fontSize="6.5"
        fill="#ffffff"
        stroke={hex.outline}
        strokeWidth="0.35"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
      >
        {hex.badge}
      </text>
    </svg>
  )
}

function SparkleStar({ color, size }: { color: StarColor; size: number }) {
  const hex = STAR_COLOR_HEX[color]
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d="M12 2l1.7 7.3L21 11l-7.3 1.7L12 20l-1.7-7.3L3 11l7.3-1.7L12 2z"
        fill={hex.primary}
        stroke={hex.outline}
        strokeWidth="0.9"
        style={{ filter: `drop-shadow(0 0 6px ${hex.glow})` }}
      />
    </svg>
  )
}

interface BurstViewProps {
  event: BurstEvent
  onDone: (id: number) => void
}

function BurstView({ event, onDone }: BurstViewProps) {
  const hex = STAR_COLOR_HEX[event.color]
  const sparkles = useMemo(
    () => makeSparkles(event.bonus ? 16 : 10, event.id * 31),
    [event.id, event.bonus],
  )
  const totalEarned = event.amount + (event.bonus ?? 0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => onDone(event.id), event.bonus ? 2400 : 1700)
    return () => window.clearTimeout(t)
  }, [event.id, event.bonus, onDone])

  const left = event.origin?.x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 200)
  const top = event.origin?.y ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 200)

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[60]"
      style={{ left, top, transform: 'translate(-50%, -50%)' }}
    >
      {/* Soft radial halo */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 animate-[burst-halo_1.6s_ease-out_forwards]"
        style={{
          left: '50%',
          top: '50%',
          width: 220,
          height: 220,
          background: `radial-gradient(circle, ${hex.glow} 0%, transparent 60%)`,
        }}
      />

      {/* Sparkle ring */}
      {sparkles.map((s, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            animation: `burst-sparkle 1.4s cubic-bezier(.22,1,.36,1) forwards`,
            animationDelay: `${s.delay}ms`,
            transform: 'translate(-50%, -50%)',
            // Custom property used by the keyframes to vary trajectory per sparkle
            // (read in @keyframes via var(--dx) / var(--dy))
            ['--dx' as string]: `${s.dx}px`,
            ['--dy' as string]: `${s.dy}px`,
            ['--rot' as string]: `${s.rotate}deg`,
          }}
        >
          <SparkleStar color={event.color} size={s.size} />
        </div>
      ))}

      {/* Centerpiece: hero star with bounce-in */}
      <div className="relative flex flex-col items-center gap-2">
        <div className="animate-[burst-pop_700ms_cubic-bezier(.34,1.56,.64,1)_forwards]">
          <BigStar color={event.color} size={event.bonus ? 120 : 96} />
        </div>

        {/* +N pill */}
        <div
          className="font-fredoka animate-[burst-rise_1.2s_ease-out_forwards] rounded-full px-4 py-1.5 font-black"
          style={{
            background: `linear-gradient(135deg, ${hex.soft}, ${hex.primary})`,
            color: '#fff',
            fontSize: event.bonus ? 28 : 22,
            border: `2px solid #ffffff`,
            boxShadow: `0 8px 24px ${hex.glow}, inset 0 1px 0 rgba(255,255,255,0.6)`,
            textShadow: `0 1px 2px rgba(0,0,0,0.25)`,
            letterSpacing: '0.02em',
          }}
        >
          +{totalEarned}
        </div>

        {/* Stat ribbon */}
        <div
          className="flex animate-[burst-rise_1.2s_ease-out_120ms_forwards] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-center"
          style={{
            background: 'rgba(255,255,255,0.95)',
            border: `2px solid ${hex.primary}80`,
            boxShadow: `0 8px 20px rgba(0,0,0,0.18)`,
            opacity: 0,
          }}
        >
          {event.bonus ? (
            <>
              <span className="text-[11px] font-extrabold" style={{ color: hex.primary }}>
                答对 +{event.amount}
              </span>
              <span className="text-[11px] font-extrabold" style={{ color: '#f97316' }}>
                {event.bonusLabel ?? `加成 +${event.bonus}`}
              </span>
            </>
          ) : (
            <span className="text-[11px] font-extrabold" style={{ color: hex.primary }}>
              本次会话 {event.sessionTotal} ⭐
            </span>
          )}
          <span className="text-[10px] font-bold" style={{ color: 'rgba(0,0,0,0.4)' }}>
            总计 {event.total} {hex.cnLabel}⭐
          </span>
        </div>
      </div>

    </div>
  )
}

export default function StarBurstOverlay() {
  const { bursts, consumeBurst } = useStarHud()
  // Respect prefers-reduced-motion: still consume bursts so they don't pile up.
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return <ReducedMotionDrainer bursts={bursts} consumeBurst={consumeBurst} />
  }
  return (
    <>
      {bursts.map((b) => (
        <BurstView key={b.id} event={b} onDone={consumeBurst} />
      ))}
    </>
  )
}

function ReducedMotionDrainer({
  bursts,
  consumeBurst,
}: {
  bursts: BurstEvent[]
  consumeBurst: (id: number) => void
}) {
  useEffect(() => {
    if (bursts.length === 0) return
    const ids = bursts.map((b) => b.id)
    const t = window.setTimeout(() => {
      for (const id of ids) consumeBurst(id)
    }, 50)
    return () => window.clearTimeout(t)
  }, [bursts, consumeBurst])
  return null
}
