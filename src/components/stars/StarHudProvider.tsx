'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useStarEarning } from '@/hooks/useStarEarning'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { playStarEarn } from './star-audio'
import type { BurstEvent, StarColor } from './star-types'

interface SessionTotals {
  yellow: number
  red: number
  blue: number
}

interface AwardOptions {
  /** Optional anchor on the screen to start the burst from (e.g. button bounding rect). */
  origin?: { x: number; y: number }
  /** Bonus stars awarded on top of `amount`. Will be added to the same insert + burst. */
  bonus?: number
  /** Human-readable bonus tag, e.g. "全对加成 +20%". */
  bonusLabel?: string
}

interface StarHudContextValue {
  yellowBalance: number
  redBalance: number
  blueBalance: number
  /** Stars earned in this browser session, per color. Resets only on full reload. */
  session: SessionTotals
  bursts: BurstEvent[]
  awardStars: (color: StarColor, amount: number, opts?: AwardOptions) => Promise<void>
  consumeBurst: (id: number) => void
  /** Optional callback to re-pull totals after writes (e.g. used by /vouchers). */
  refresh: () => Promise<void>
}

const StarHudCtx = createContext<StarHudContextValue | null>(null)

export function useStarHud(): StarHudContextValue {
  const ctx = useContext(StarHudCtx)
  if (!ctx) throw new Error('useStarHud must be used inside <StarHudProvider>')
  return ctx
}

const COLOR_TO_SOURCE: Record<StarColor, 'english' | 'math' | 'calc'> = {
  red: 'english',
  blue: 'math',
  yellow: 'calc',
}

let burstIdSeq = 0

export function StarHudProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const wallet = useCalcWallet(user)
  const { earnStars } = useStarEarning(user)
  const [session, setSession] = useState<SessionTotals>({ yellow: 0, red: 0, blue: 0 })
  const [bursts, setBursts] = useState<BurstEvent[]>([])
  // Optimistic local-only balance deltas — let UI reflect immediately even before wallet.refresh completes.
  const [optimistic, setOptimistic] = useState<SessionTotals>({ yellow: 0, red: 0, blue: 0 })
  const pendingRefreshRef = useRef<number | null>(null)
  // Refs so awardStars reads latest values without them in its dep array — prevents cascading
  // re-renders on every star award (session/optimistic change on each award, which would
  // otherwise invalidate awardStars and all consumers that close over it).
  const sessionRef = useRef(session)
  sessionRef.current = session
  const optimisticRef = useRef(optimistic)
  optimisticRef.current = optimistic
  const walletRefreshRef = useRef(wallet.refresh)
  walletRefreshRef.current = wallet.refresh

  const scheduleRefresh = useCallback(() => {
    if (pendingRefreshRef.current !== null) {
      window.clearTimeout(pendingRefreshRef.current)
    }
    pendingRefreshRef.current = window.setTimeout(() => {
      void walletRefreshRef.current()
      pendingRefreshRef.current = null
    }, 600)
  }, [])

  const awardStars = useCallback<StarHudContextValue['awardStars']>(
    async (color, amount, opts) => {
      const bonus = Math.max(0, Math.floor(opts?.bonus ?? 0))
      const safeAmount = Math.max(0, Math.floor(amount))
      const total = safeAmount + bonus
      if (total <= 0) return

      // Optimistic UI update
      setSession(prev => ({ ...prev, [color]: prev[color] + total }))
      setOptimistic(prev => ({ ...prev, [color]: prev[color] + total }))

      // Burst event (visible immediately)
      const nextTotalBalance =
        (color === 'yellow' ? wallet.yellowBalance
          : color === 'red' ? wallet.redBalance
            : wallet.blueBalance) +
        optimisticRef.current[color] +
        total
      const ev: BurstEvent = {
        id: ++burstIdSeq,
        color,
        amount: safeAmount,
        bonus: bonus > 0 ? bonus : undefined,
        bonusLabel: opts?.bonusLabel,
        sessionTotal: sessionRef.current[color] + total,
        total: nextTotalBalance,
        origin: opts?.origin,
      }
      setBursts(prev => [...prev, ev])
      playStarEarn(color, total, bonus)

      // Persist
      await earnStars(COLOR_TO_SOURCE[color], total)
      scheduleRefresh()
    },
    [earnStars, scheduleRefresh, wallet.yellowBalance, wallet.redBalance, wallet.blueBalance],
  )

  const consumeBurst = useCallback((id: number) => {
    setBursts(prev => prev.filter(b => b.id !== id))
  }, [])

  // Once wallet refresh catches up, drain optimistic delta back to zero.
  // Only depends on wallet balances — listing optimistic.* would cause the effect to
  // fire on the optimistic bump itself and immediately reset it before refresh lands.
  useEffect(() => {
    if (!user) return
    setOptimistic(prev =>
      prev.yellow === 0 && prev.red === 0 && prev.blue === 0
        ? prev
        : { yellow: 0, red: 0, blue: 0 },
    )
  }, [user, wallet.yellowBalance, wallet.redBalance, wallet.blueBalance])

  const value = useMemo<StarHudContextValue>(() => ({
    // Always expose pure DB values — optimistic is kept internally for burst
    // animation calculations only and must not distort the displayed balance.
    yellowBalance: wallet.yellowBalance,
    redBalance: wallet.redBalance,
    blueBalance: wallet.blueBalance,
    session,
    bursts,
    awardStars,
    consumeBurst,
    refresh: wallet.refresh,
  }), [wallet.yellowBalance, wallet.redBalance, wallet.blueBalance, wallet.refresh, session, bursts, awardStars, consumeBurst])

  return <StarHudCtx.Provider value={value}>{children}</StarHudCtx.Provider>
}
