'use client'

import { useState } from 'react'
import { getMasteryIconLevel, getCreatureCounts } from '@/utils/masteryUtils'

interface MasteryIconProps {
  count: number
  className?: string
  /**
   * Set true when the trigger is inside an overflow-hidden ancestor (e.g. FlashCard).
   * Suppresses the bottle popup to avoid clipping.
   */
  noBottle?: boolean
}

function getDominantEmoji(level: number): string {
  if (level <= 0)  return '›'
  if (level <= 10) return '🥚'
  if (level <= 20) return '🐛'
  return '🦋'
}

function ButterflyCreature({ index }: { index: number }) {
  return (
    <span
      className="inline-block select-none text-lg"
      style={{ animation: `butterfly-float 3s ease-in-out ${index * 0.45}s infinite` }}
    >
      🦋
    </span>
  )
}

function CaterpillarCreature({ index }: { index: number }) {
  return (
    <span
      className="inline-block select-none text-base"
      style={{ animation: `caterpillar-crawl 2.4s ease-in-out ${index * 0.3}s infinite alternate` }}
    >
      🐛
    </span>
  )
}

function EggCreature({ index }: { index: number }) {
  return (
    <span
      className="inline-block select-none text-base"
      style={{ animation: `egg-wobble 2s ease-in-out ${index * 0.25}s infinite` }}
    >
      🥚
    </span>
  )
}

function MagicBottle({ level }: { level: number }) {
  const { eggs, caterpillars, butterflies } = getCreatureCounts(level)

  return (
    <div
      className="pointer-events-none absolute bottom-full left-1/2 z-[200] mb-2 -translate-x-1/2"
      style={{ animation: 'bottle-appear 0.22s cubic-bezier(.34,1.56,.64,1) both' }}
    >
      <div
        className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
        style={{ width: 140, height: 180 }}
      >
        {/* Glass glare */}
        <div
          className="pointer-events-none absolute left-3 top-2 h-12 w-4 rounded-full bg-white opacity-30"
          style={{ filter: 'blur(4px)' }}
        />

        {/* Top zone: butterflies flying */}
        <div className="flex min-h-[52px] flex-wrap items-start justify-center gap-0.5 px-2 pt-2">
          {Array.from({ length: butterflies }).map((_, i) => (
            <ButterflyCreature key={i} index={i} />
          ))}
        </div>

        {/* Middle zone: caterpillars crawling */}
        <div className="flex min-h-[44px] flex-wrap items-center justify-center gap-0.5 px-2">
          {Array.from({ length: caterpillars }).map((_, i) => (
            <CaterpillarCreature key={i} index={i} />
          ))}
        </div>

        {/* Bottom zone: eggs resting */}
        <div
          className="flex min-h-[52px] flex-wrap items-end justify-center gap-0.5 px-2 pb-2"
          style={{ background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          {Array.from({ length: eggs }).map((_, i) => (
            <EggCreature key={i} index={i} />
          ))}
        </div>

        {/* Level label */}
        <div className="absolute bottom-1 right-1.5 select-none text-[9px] font-extrabold text-white/50">
          Lv.{level}
        </div>
      </div>

      {/* Tooltip arrow */}
      <div className="mx-auto h-2 w-2 -mt-px rotate-45 border-b border-r border-white/20 bg-white/20" />
    </div>
  )
}

export default function MasteryIcon({ count, className, noBottle }: MasteryIconProps) {
  const [showBottle, setShowBottle] = useState(false)
  const level = getMasteryIconLevel(count)
  const emoji = getDominantEmoji(level)

  if (level === 0) {
    return <span className={className}>{emoji}</span>
  }

  return (
    <span
      className={`relative inline-block cursor-default ${className ?? ''}`}
      onMouseEnter={() => { if (!noBottle) setShowBottle(true) }}
      onMouseLeave={() => setShowBottle(false)}
    >
      <span className="select-none">{emoji}</span>
      {showBottle && <MagicBottle level={level} />}
    </span>
  )
}
