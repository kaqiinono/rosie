'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CalcSession, CalcMode, CalcLevel } from '@/utils/type'
import { levelKey } from '@/utils/calc-helpers'
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

interface VoucherSumRow { coins_spent: number }

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
      .select('coins_spent')
      .eq('user_id', userId),
  ])
  const sessions = (sessionRows ?? []).map(r => rowToSession(r as SessionRow))
  const spend = ((voucherRows ?? []) as VoucherSumRow[]).reduce(
    (sum, v) => sum + (v.coins_spent ?? 0),
    0,
  )
  return { sessions, spend }
}

export function useCalcWallet(user: User | null) {
  const [sessions, setSessions] = useState<CalcSession[]>([])
  const [voucherSpend, setVoucherSpend] = useState(0)
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const init = async () => {
      const { sessions: ss, spend } = await fetchWalletData(user.id)
      if (cancelled) return
      setSessions(ss)
      setVoucherSpend(spend)
      setIsLoading(false)
    }
    void init()
    return () => { cancelled = true }
  }, [user])

  const refresh = useCallback(async () => {
    if (!user) return
    const { sessions: ss, spend } = await fetchWalletData(user.id)
    setSessions(ss)
    setVoucherSpend(spend)
  }, [user])

  const coinsEarnedTotal = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.coinsEarned ?? 0), 0),
    [sessions],
  )

  const balance = Math.max(0, coinsEarnedTotal - voucherSpend)

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

  const spendCoins = useCallback(async () => {
    // Optimistically bump voucher spend; useCalcVouchers handles actual insert
    setVoucherSpend(v => v + 50)
  }, [])

  return {
    sessions,
    balance,
    coinsEarnedTotal,
    voucherSpend,
    todayQuestionsDone,
    todayCorrect,
    todayCoinsEarned,
    recordSession,
    spendCoins,
    refresh,
    isLoading,
  }
}
