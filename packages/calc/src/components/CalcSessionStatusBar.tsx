'use client'

/**
 * Shared session status header — timer · question count · streak, the live star
 * bar (coins / streak bonus / last-result float), and the progress bar.
 *
 * Single source of truth so the real session (`/calc/session`) and the type
 * preview (`/calc/demo`) render identical chrome and can never drift.
 */

type LastResult = { stars: number; bonus: number } | null

type Props = {
  /** Whether the timer should be visible in the status row. */
  showTimer?: boolean
  /** Remaining seconds, or null for an untimed (∞) session. */
  remainingSec: number | null
  /**
   * Soft-clock overtime (relaxed past T_target while still answering).
   * `remainingSec` goes negative (−0:05 = 5s overtime) and pulses red.
   */
  timerOvertime?: boolean
  /** Zero-based index of the current question. */
  idx: number
  /** Planned (configured) question count, before the make-up tail. */
  planned: number
  /** Total questions including the make-up tail. */
  total: number
  streak: number
  coinsTotal: number
  lastResult: LastResult
}

function formatTimer(s: number) {
  const neg = s < 0
  const abs = Math.abs(s)
  const m = Math.floor(abs / 60)
  const r = abs % 60
  return `${neg ? '-' : ''}${m}:${String(r).padStart(2, '0')}`
}

export default function CalcSessionStatusBar({
  showTimer = true,
  remainingSec,
  timerOvertime = false,
  idx,
  planned,
  total,
  streak,
  coinsTotal,
  lastResult,
}: Props) {
  const inMakeupTail = idx >= planned
  const progress = planned > 0 ? Math.min(100, Math.round((Math.min(idx, planned) / planned) * 100)) : 0

  return (
    <>
      {/* Top status */}
      <div
        className="mb-2 flex items-center justify-between text-[12px] font-bold tabular-nums"
        style={{ color: 'rgba(196,181,253,0.6)' }}
      >
        <div
          aria-hidden={!showTimer}
          className={timerOvertime && showTimer ? 'animate-pulse' : undefined}
          style={
            !showTimer
              ? { visibility: 'hidden' }
              : timerOvertime
              ? {
                  color: '#f87171',
                  textShadow:
                    '0 0 8px rgba(248,113,113,0.95), 0 0 18px rgba(239,68,68,0.7), 0 0 28px rgba(220,38,38,0.45)',
                }
              : undefined
          }
        >
          {showTimer && (remainingSec !== null ? `⏱ ${formatTimer(remainingSec)}` : '⏱ ∞')}
        </div>
        {inMakeupTail ? (
          <div style={{ color: 'rgba(251,191,36,0.7)' }}>
            💪 错题补做 {idx - planned + 1} / {total - planned}
          </div>
        ) : (
          <div style={{ color: 'rgba(245,243,255,0.5)' }}>
            {idx + 1} / {planned}
          </div>
        )}
        <div style={{ color: '#fb923c' }}>{streak >= 2 ? `🔥 ${streak}` : ' '}</div>
      </div>

      {/* Real-time star bar */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.22)',
          }}
        >
          <span className="text-[13px]">⭐</span>
          <span
            className="font-fredoka text-[14px] font-black tabular-nums"
            style={{ color: '#fbbf24' }}
          >
            {coinsTotal}
          </span>
        </div>
        {streak >= 5 && (
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{
              background: 'rgba(251,146,60,0.15)',
              border: '1px solid rgba(251,146,60,0.3)',
            }}
          >
            <span className="text-[11px]">🔥</span>
            <span className="text-[10px] font-extrabold" style={{ color: '#fb923c' }}>
              {streak >= 10 ? '+2加成' : '+1加成'}
            </span>
          </div>
        )}
        {lastResult && lastResult.stars > 0 && (
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.28)',
              animation: 'float-up 0.7s ease-out forwards',
            }}
          >
            <span className="text-[10px] font-extrabold" style={{ color: '#4ade80' }}>
              +{lastResult.stars} ⭐
              {lastResult.bonus > 0 && (
                <span style={{ color: '#fb923c' }}> 含+{lastResult.bonus}加成</span>
              )}
            </span>
          </div>
        )}
      </div>

      <div
        className="mb-5 h-1.5 overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.07)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #7c3aed, #d946ef)',
            boxShadow: '0 0 8px rgba(139,92,246,0.5)',
          }}
        />
      </div>
    </>
  )
}
