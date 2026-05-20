'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CalcSession, CalcMode, CalcLevel, VoucherCategory } from '@/utils/type'
import { levelKey, VOUCHER_PRICES } from '@/utils/calc-helpers'
import { todayStr } from '@/utils/constant'

interface SessionRow {
  id: string
  date: string
  started_at: string
  finished_at: string
  count: number
  correct_count: number
  retry_count: number
  wrong_count: number
  challenge_correct: number
  time_spent_sec: number
  coins_earned: number
  mode: CalcMode
  max_streak: number
  top_level: string
}

function rowToSession(r: SessionRow): CalcSession {
  return {
    id: r.id,
    date: r.date,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    count: r.count,
    correctCount: r.correct_count,
    retryCount: r.retry_count,
    wrongCount: r.wrong_count,
    challengeCorrect: r.challenge_correct,
    timeSpentSec: r.time_spent_sec,
    coinsEarned: r.coins_earned,
    mode: r.mode,
    maxStreak: r.max_streak,
    topLevel: r.top_level === 'C' ? 'C' : Number(r.top_level),
  }
}

interface VoucherCategoryRow { category: VoucherCategory }
interface StarSessionRow { coins_earned: number; source: 'english' | 'math' }

async function fetchWalletData(userId: string) {
  const [{ data: sessionRows }, { data: voucherRows }] = await Promise.all([
    supabase
      .from('calc_sessions')
      .select('id,date,started_at,finished_at,count,correct_count,retry_count,wrong_count,challenge_correct,time_spent_sec,coins_earned,mode,max_streak,top_level')
      .eq('user_id', userId)
      .order('finished_at', { ascending: false })
      .limit(200),
    supabase
      .from('calc_vouchers')
      .select('category')
      .eq('user_id', userId),
  ])
  const sessions = (sessionRows ?? []).map(r => rowToSession(r as SessionRow))
  const voucherCategories = ((voucherRows ?? []) as VoucherCategoryRow[]).map(v => v.category)
  let redEarned = 0
  let blueEarned = 0
  try {
    const { data: starRows } = await supabase
      .from('star_sessions')
      .select('coins_earned,source')
      .eq('user_id', userId)
    for (const r of (starRows ?? []) as StarSessionRow[]) {
      const amt = r.coins_earned ?? 0
      if (r.source === 'english') redEarned += amt
      else if (r.source === 'math') blueEarned += amt
    }
  } catch { /* star_sessions table may not exist before migration */ }
  return { sessions, voucherCategories, redEarned, blueEarned }
}

export function useCalcWallet(user: User | null) {
  const [sessions, setSessions] = useState<CalcSession[]>([])
  const [voucherCategories, setVoucherCategories] = useState<VoucherCategory[]>([])
  const [redEarned, setRedEarned] = useState(0)
  const [blueEarned, setBlueEarned] = useState(0)
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const init = async () => {
      const data = await fetchWalletData(user.id)
      if (cancelled) return
      setSessions(data.sessions)
      setVoucherCategories(data.voucherCategories)
      setRedEarned(data.redEarned)
      setBlueEarned(data.blueEarned)
      setIsLoading(false)
    }
    void init()
    return () => { cancelled = true }
  }, [user])

  const refresh = useCallback(async () => {
    if (!user) return
    const data = await fetchWalletData(user.id)
    setSessions(data.sessions)
    setVoucherCategories(data.voucherCategories)
    setRedEarned(data.redEarned)
    setBlueEarned(data.blueEarned)
  }, [user])

  const yellowEarnedTotal = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.coinsEarned ?? 0), 0),
    [sessions],
  )

  const { yellowSpent, redSpent, blueSpent } = useMemo(() => {
    let y = 0, r = 0, b = 0
    for (const cat of voucherCategories) {
      const p = VOUCHER_PRICES[cat]
      if (!p) continue
      y += p[0]; r += p[1]; b += p[2]
    }
    return { yellowSpent: y, redSpent: r, blueSpent: b }
  }, [voucherCategories])

  const yellowBalance = Math.max(0, yellowEarnedTotal - yellowSpent)
  const redBalance = Math.max(0, redEarned - redSpent)
  const blueBalance = Math.max(0, blueEarned - blueSpent)

  // Legacy: calc pages display `balance` as the user's calc-earned stars (yellow).
  const balance = yellowBalance

  const todaySessions = useMemo(() => {
    const t = todayStr()
    return sessions.filter(s => s.date === t)
  }, [sessions])

  const todayQuestionsDone = useMemo(
    () => todaySessions.reduce(
      (sum, s) => sum + s.correctCount + s.retryCount + s.wrongCount,
      0,
    ),
    [todaySessions],
  )

  const todayCorrect = useMemo(
    () => todaySessions.reduce((sum, s) => sum + s.correctCount + s.retryCount, 0),
    [todaySessions],
  )

  const todayCoinsEarned = useMemo(
    () => todaySessions.reduce((sum, s) => sum + s.coinsEarned, 0),
    [todaySessions],
  )

  const recordSession = useCallback(
    async (session: Omit<CalcSession, 'id'>) => {
      if (!user) return
      const row = {
        user_id: user.id,
        date: session.date,
        started_at: session.startedAt,
        finished_at: session.finishedAt,
        count: session.count,
        correct_count: session.correctCount,
        retry_count: session.retryCount,
        wrong_count: session.wrongCount,
        challenge_correct: session.challengeCorrect,
        time_spent_sec: session.timeSpentSec,
        coins_earned: session.coinsEarned,
        mode: session.mode,
        max_streak: session.maxStreak,
        top_level: levelKey(session.topLevel as CalcLevel),
      }
      try {
        await supabase.from('calc_sessions').insert(row)
      } catch { /* ignore */ }
      await refresh()
    },
    [user, refresh],
  )

  const spendVoucher = useCallback(async (category: VoucherCategory) => {
    // Optimistically register the voucher; useCalcVouchers handles the actual insert.
    setVoucherCategories(prev => [...prev, category])
  }, [])

  return {
    sessions,
    balance,
    yellowBalance,
    redBalance,
    blueBalance,
    yellowEarnedTotal,
    redEarned,
    blueEarned,
    yellowSpent,
    redSpent,
    blueSpent,
    todayQuestionsDone,
    todayCorrect,
    todayCoinsEarned,
    recordSession,
    spendVoucher,
    refresh,
    isLoading,
  }
}
