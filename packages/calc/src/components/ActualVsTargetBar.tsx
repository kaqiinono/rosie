'use client'

type Props = {
  actualSec: number
  targetSec: number
}

/** Dual-layer bar: met = green actual under black-translucent target; unmet = target under warm actual. */
export default function ActualVsTargetBar({ actualSec, targetSec }: Props) {
  if (!(targetSec > 0) || !(actualSec > 0)) return null

  const met = actualSec <= targetSec

  if (met) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          title={`实际 ${actualSec}s · 目标 ${targetSec}s · 达标`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: '100%', background: 'rgba(74,222,128,0.9)' }}
          />
        </div>
        <span className="shrink-0 text-[10px] font-extrabold" style={{ color: '#4ade80' }}>
          达标
        </span>
      </div>
    )
  }

  const targetPct = Math.max(4, Math.min(96, (targetSec / actualSec) * 100))
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.08)' }}
        title={`实际 ${actualSec}s · 目标 ${targetSec}s · 未达标`}
      >
        {/* Target share (left) */}
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${targetPct}%`, background: 'rgba(251,191,36,0.85)' }}
        />
        {/* Overrun beyond target (right) */}
        <div
          className="absolute inset-y-0 right-0"
          style={{
            width: `${100 - targetPct}%`,
            background: 'rgba(248,113,113,0.95)',
            boxShadow: 'inset 2px 0 0 rgba(0,0,0,0.25)',
          }}
        />
      </div>
      <span className="shrink-0 text-[10px] font-extrabold" style={{ color: '#f87171' }}>
        未达标
      </span>
    </div>
  )
}
