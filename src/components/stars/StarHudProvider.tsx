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

  const scheduleRefresh = useCallback(() => {
    if (pendingRefreshRef.current !== null) {
      window.clearTimeout(pendingRefreshRef.current)
    }
    pendingRefreshRef.current = window.setTimeout(() => {
      void wallet.refresh()
      pendingRefreshRef.current = null
    }, 600)
  }, [wallet])

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
        optimistic[color] +
        total
      const ev: BurstEvent = {
        id: ++burstIdSeq,
        color,
        amount: safeAmount,
        bonus: bonus > 0 ? bonus : undefined,
        bonusLabel: opts?.bonusLabel,
        sessionTotal: session[color] + total,
        total: nextTotalBalance,
        origin: opts?.origin,
      }
      setBursts(prev => [...prev, ev])
      playStarEarn(color, total, bonus)

      // Persist
      await earnStars(COLOR_TO_SOURCE[color], total)
      scheduleRefresh()
    },
    [earnStars, optimistic, scheduleRefresh, session, wallet.yellowBalance, wallet.redBalance, wallet.blueBalance],
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
    yellowBalance: wallet.yellowBalance + optimistic.yellow,
    redBalance: wallet.redBalance + optimistic.red,
    blueBalance: wallet.blueBalance + optimistic.blue,
    session,
    bursts,
    awardStars,
    consumeBurst,
    refresh: wallet.refresh,
  }), [wallet.yellowBalance, wallet.redBalance, wallet.blueBalance, wallet.refresh, optimistic, session, bursts, awardStars, consumeBurst])

  return <StarHudCtx.Provider value={value}>{children}</StarHudCtx.Provider>
}
