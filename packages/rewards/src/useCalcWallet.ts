'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type { CalcSession, CalcMode, CalcLevel, VoucherCategory } from '@rosie/core'
import { todayStr } from '@rosie/core'

// Inlined from calc-helpers to keep the shared rewards package independent of the calc engine.
const levelKey = (level: CalcLevel): string =>
  typeof level === 'number' ? String(level) : level

interface TemplatePriceRow {
  category: string
  price_yellow: number
  price_red: number
  price_blue: number
}

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
  mode: CalcMode
  max_streak: number
  top_level: string
  question_times_ms: number[] | null
  question_log: { key: string; ms: number; ok: boolean }[] | null
}

function rowToSession(r: SessionRow, coinsEarned: number): CalcSession {
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
    coinsEarned,
    mode: r.mode,
    maxStreak: r.max_streak,
    topLevel: r.top_level === 'C' ? 'C' : Number(r.top_level),
    questionTimesMs: r.question_times_ms ?? [],
    questionLog: r.question_log ?? [],
  }
}

interface VoucherCategoryRow { category: VoucherCategory; free: boolean | null }
interface StarSessionRow {
  coins_earned: number
  source: 'english' | 'math' | 'calc'
  ref_id: string | null
}

async function fetchWalletData(userId: string) {
  const [
    { data: sessionRows, error: sessErr },
    { data: voucherRows, error: vouchErr },
    { data: starRows, error: starErr },
    { data: templateRows, error: tmplErr },
  ] = await Promise.all([
    supabase
      .from('calc_sessions')
      .select('id,date,started_at,finished_at,count,correct_count,retry_count,wrong_count,challenge_correct,time_spent_sec,mode,max_streak,top_level,question_times_ms,question_log')
      .eq('user_id', userId)
      .order('finished_at', { ascending: false })
      .limit(200),
    supabase
      .from('calc_vouchers')
      .select('category,free')
      .eq('user_id', userId),
    supabase
      .from('star_sessions')
      .select('coins_earned,source,ref_id')
      .eq('user_id', userId),
    supabase
      .from('voucher_templates')
      .select('category,price_yellow,price_red,price_blue'),
  ])
  if (sessErr) console.error('[wallet] calc_sessions fetch failed', sessErr)
  if (vouchErr) console.error('[wallet] calc_vouchers fetch failed', vouchErr)
  if (starErr) console.error('[wallet] star_sessions fetch failed', starErr)
  if (tmplErr) console.error('[wallet] voucher_templates fetch failed', tmplErr)

  const priceByCategory = new Map<string, [number, number, number]>()
  for (const r of (templateRows ?? []) as TemplatePriceRow[]) {
    priceByCategory.set(r.category, [r.price_yellow, r.price_red, r.price_blue])
  }

  // Aggregate stars by color + build per-session coin map for calc UI
  let yellowEarned = 0
  let redEarned = 0
  let blueEarned = 0
  const coinsBySessionId = new Map<string, number>()
  for (const r of (starRows ?? []) as StarSessionRow[]) {
    const amt = r.coins_earned ?? 0
    if (r.source === 'calc') {
      yellowEarned += amt
      if (r.ref_id) {
        coinsBySessionId.set(r.ref_id, (coinsBySessionId.get(r.ref_id) ?? 0) + amt)
      }
    } else if (r.source === 'english') {
      redEarned += amt
    } else if (r.source === 'math') {
      blueEarned += amt
    }
  }

  const sessions = (sessionRows ?? []).map((r) => {
    const row = r as SessionRow
    return rowToSession(row, coinsBySessionId.get(row.id) ?? 0)
  })
  const voucherRecords = ((voucherRows ?? []) as VoucherCategoryRow[]).map(v => ({
    category: v.category,
    free: v.free === true,
  }))
  return { sessions, voucherRecords, yellowEarned, redEarned, blueEarned, priceByCategory }
}

interface VoucherRecord {
  category: VoucherCategory
  free: boolean
}

export function useCalcWallet(user: User | null) {
  const [sessions, setSessions] = useState<CalcSession[]>([])
  const [voucherRecords, setVoucherRecords] = useState<VoucherRecord[]>([])
  const [priceByCategory, setPriceByCategory] = useState<Map<string, [number, number, number]>>(
    () => new Map(),
  )
  const [yellowEarned, setYellowEarned] = useState(0)
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
      setVoucherRecords(data.voucherRecords)
      setPriceByCategory(data.priceByCategory)
      setYellowEarned(data.yellowEarned)
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
    setVoucherRecords(data.voucherRecords)
    setPriceByCategory(data.priceByCategory)
    setYellowEarned(data.yellowEarned)
    setRedEarned(data.redEarned)
    setBlueEarned(data.blueEarned)
  }, [user])

  const yellowEarnedTotal = yellowEarned

  const { yellowSpent, redSpent, blueSpent } = useMemo(() => {
    let y = 0, r = 0, b = 0
    for (const v of voucherRecords) {
      if (v.free) continue // admin-granted vouchers don't count toward spent
      const p = priceByCategory.get(v.category)
      if (!p) continue
      y += p[0]; r += p[1]; b += p[2]
    }
    return { yellowSpent: y, redSpent: r, blueSpent: b }
  }, [voucherRecords, priceByCategory])

  const yellowBalance = Math.max(0, yellowEarned - yellowSpent)
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
      // Generate the id client-side so the star_sessions row can reference it
      // WITHOUT depending on a RETURNING select (which RLS may block — that was
      // silently dropping calc stars from the ledger).
      const sessionId = crypto.randomUUID()
      const sessionRow = {
        id: sessionId,
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
        mode: session.mode,
        max_streak: session.maxStreak,
        top_level: levelKey(session.topLevel as CalcLevel),
        question_times_ms: session.questionTimesMs ?? [],
        question_log: session.questionLog ?? [],
      }
      try {
        const { error: sessionErr } = await supabase.from('calc_sessions').insert(sessionRow)
        if (sessionErr) {
          console.error('[calc_sessions] insert failed', { userId: user.id, error: sessionErr })
        }
        // Write the star row whenever the session insert succeeded — no longer
        // gated on a returned row, only on the session actually persisting.
        if (!sessionErr && session.coinsEarned > 0) {
          const { error: starErr } = await supabase.from('star_sessions').insert({
            user_id: user.id,
            date: session.date,
            source: 'calc',
            coins_earned: session.coinsEarned,
            ref_id: sessionId,
          })
          if (starErr) {
            console.error('[star_sessions] calc insert failed', { userId: user.id, error: starErr })
          }
        }
      } catch (err) {
        console.error('[recordSession] unexpected error', err)
      }
      await refresh()
    },
    [user, refresh],
  )

  const spendVoucher = useCallback(async (category: VoucherCategory) => {
    // Optimistically register the voucher; useCalcVouchers handles the actual insert.
    setVoucherRecords(prev => [...prev, { category, free: false }])
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
