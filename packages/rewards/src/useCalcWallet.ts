'use client'

import { useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, invalidateSessionStore, supabase } from '@rosie/core'
import type { CalcSession, CalcMode, CalcLevel, VoucherCategory } from '@rosie/core'
import { todayStr } from '@rosie/core'

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

interface VoucherCategoryRow {
  category: VoucherCategory
  free: boolean | null
}

interface StarSessionRow {
  coins_earned: number
  source: 'english' | 'math' | 'calc'
  ref_id: string | null
  date: string | null
}

interface VoucherRecord {
  category: VoucherCategory
  free: boolean
}

type WalletData = {
  /** Detail rows (limit 200) — loaded lazily via loadSessions. */
  sessions: CalcSession[]
  sessionsReady: boolean
  /** The lazy detail fetch failed; don't retry-loop, and don't claim to be loading. */
  sessionsFailed: boolean
  voucherRecords: VoucherRecord[]
  yellowEarned: number
  redEarned: number
  blueEarned: number
  priceEntries: [string, [number, number, number]][]
  /**
   * Calc coins per YYYY-MM-DD from star_sessions (no calc_sessions join needed).
   * Kept per-date rather than pre-summed for today so a PWA left open across
   * midnight doesn't show yesterday's coins next to a reset question count.
   */
  calcCoinsByDate: [string, number][]
  /** ref_id → coins; used when hydrating session detail rows. */
  coinsBySessionId: [string, number][]
}

const EMPTY_WALLET: WalletData = {
  sessions: [],
  sessionsReady: false,
  sessionsFailed: false,
  voucherRecords: [],
  yellowEarned: 0,
  redEarned: 0,
  blueEarned: 0,
  priceEntries: [],
  calcCoinsByDate: [],
  coinsBySessionId: [],
}

/** Balances + templates only — skips heavy calc_sessions (homepage HUD). */
async function fetchWalletData(userId: string): Promise<WalletData> {
  const [
    { data: voucherRows, error: vouchErr },
    { data: starRows, error: starErr },
    { data: templateRows, error: tmplErr },
  ] = await Promise.all([
    supabase.from('calc_vouchers').select('category,free').eq('user_id', userId),
    supabase.from('star_sessions').select('coins_earned,source,ref_id,date').eq('user_id', userId),
    supabase.from('voucher_templates').select('category,price_yellow,price_red,price_blue'),
  ])
  if (vouchErr) console.error('[wallet] calc_vouchers fetch failed', vouchErr)
  if (starErr) console.error('[wallet] star_sessions fetch failed', starErr)
  if (tmplErr) console.error('[wallet] voucher_templates fetch failed', tmplErr)

  const priceEntries: [string, [number, number, number]][] = []
  for (const r of (templateRows ?? []) as TemplatePriceRow[]) {
    priceEntries.push([r.category, [r.price_yellow, r.price_red, r.price_blue]])
  }

  let yellowEarned = 0
  let redEarned = 0
  let blueEarned = 0
  const calcCoinsByDate = new Map<string, number>()
  const coinsBySessionId = new Map<string, number>()
  for (const r of (starRows ?? []) as StarSessionRow[]) {
    const amt = r.coins_earned ?? 0
    if (r.source === 'calc') {
      yellowEarned += amt
      if (r.date) calcCoinsByDate.set(r.date, (calcCoinsByDate.get(r.date) ?? 0) + amt)
      if (r.ref_id) {
        coinsBySessionId.set(r.ref_id, (coinsBySessionId.get(r.ref_id) ?? 0) + amt)
      }
    } else if (r.source === 'english') {
      redEarned += amt
    } else if (r.source === 'math') {
      blueEarned += amt
    }
  }

  const voucherRecords = ((voucherRows ?? []) as VoucherCategoryRow[]).map((v) => ({
    category: v.category,
    free: v.free === true,
  }))
  return {
    sessions: [],
    sessionsReady: false,
    sessionsFailed: false,
    voucherRecords,
    yellowEarned,
    redEarned,
    blueEarned,
    priceEntries,
    calcCoinsByDate: [...calcCoinsByDate.entries()],
    coinsBySessionId: [...coinsBySessionId.entries()],
  }
}

const sessionsInflight = new Map<string, Promise<void>>()

async function loadWalletSessions(userId: string, force = false): Promise<void> {
  const existing = calcWalletStore.getSessionData(userId)
  if (!force && (existing?.sessionsReady || existing?.sessionsFailed)) return

  const inflight = sessionsInflight.get(userId)
  if (inflight) return inflight

  const promise = (async () => {
    let sessions: CalcSession[] = []
    let failed = false
    try {
      const { data: sessionRows, error: sessErr } = await supabase
        .from('calc_sessions')
        .select(
          'id,date,started_at,finished_at,count,correct_count,retry_count,wrong_count,challenge_correct,time_spent_sec,mode,max_streak,top_level,question_times_ms,question_log',
        )
        .eq('user_id', userId)
        .order('finished_at', { ascending: false })
        .limit(200)
      if (sessErr) throw sessErr

      const coinsMap = new Map(calcWalletStore.getSessionData(userId)?.coinsBySessionId ?? [])
      sessions = (sessionRows ?? []).map((r) => {
        const row = r as SessionRow
        return rowToSession(row, coinsMap.get(row.id) ?? 0)
      })
    } catch (err) {
      // Settle either way — leaving `sessionsReady` false would pin consumers in
      // `isLoading` forever, since nothing re-triggers the effect.
      console.error('[wallet] calc_sessions fetch failed', err)
      failed = true
    }
    calcWalletStore.patchSessionData(userId, (prev) => ({
      ...prev,
      sessions: failed ? prev.sessions : sessions,
      sessionsReady: !failed,
      sessionsFailed: failed,
    }))
  })().finally(() => {
    sessionsInflight.delete(userId)
  })

  sessionsInflight.set(userId, promise)
  return promise
}

export const calcWalletStore = createUserSessionStore<WalletData>('calc_wallet', {
  fetch: fetchWalletData,
  empty: EMPTY_WALLET,
})

export type UseCalcWalletOptions = {
  /** Load recent calc_sessions detail (report / session / calc home). Default false. */
  loadSessions?: boolean
}

export function useCalcWallet(user: User | null, options: UseCalcWalletOptions = {}) {
  const loadSessions = options.loadSessions === true
  const { data: wallet, isLoading } = calcWalletStore.useSessionData(user)

  useEffect(() => {
    // Wait until balance slot is ready so ensureLoaded replace can't wipe sessions.
    if (!user || !loadSessions || isLoading || wallet.sessionsReady || wallet.sessionsFailed) return
    void loadWalletSessions(user.id)
  }, [user, loadSessions, isLoading, wallet.sessionsReady, wallet.sessionsFailed])

  const priceByCategory = useMemo(
    () => new Map(wallet.priceEntries),
    [wallet.priceEntries],
  )

  const refresh = useCallback(async () => {
    if (!user) return
    calcWalletStore.invalidate(user.id)
    try {
      await calcWalletStore.ensureLoaded(user.id)
    } catch (err) {
      // recordSession awaits this; a wallet refetch failure must not fail the session.
      console.error('[wallet] refresh failed', err)
      return
    }
    // force: the caller just invalidated, so a previously-ready (or failed) slot
    // must be re-fetched rather than short-circuited.
    if (loadSessions) await loadWalletSessions(user.id, true)
  }, [user, loadSessions])

  const { yellowSpent, redSpent, blueSpent } = useMemo(() => {
    let y = 0
    let r = 0
    let b = 0
    for (const v of wallet.voucherRecords) {
      if (v.free) continue
      const p = priceByCategory.get(v.category)
      if (!p) continue
      y += p[0]
      r += p[1]
      b += p[2]
    }
    return { yellowSpent: y, redSpent: r, blueSpent: b }
  }, [wallet.voucherRecords, priceByCategory])

  const yellowBalance = Math.max(0, wallet.yellowEarned - yellowSpent)
  const redBalance = Math.max(0, wallet.redEarned - redSpent)
  const blueBalance = Math.max(0, wallet.blueEarned - blueSpent)

  const todaySessions = useMemo(() => {
    const t = todayStr()
    return wallet.sessions.filter((s) => s.date === t)
  }, [wallet.sessions])

  const todayQuestionsDone = useMemo(
    () =>
      todaySessions.reduce(
        (sum, s) => sum + s.correctCount + s.retryCount + s.wrongCount,
        0,
      ),
    [todaySessions],
  )

  const todayCorrect = useMemo(
    () => todaySessions.reduce((sum, s) => sum + s.correctCount + s.retryCount, 0),
    [todaySessions],
  )

  const recordSession = useCallback(
    async (session: Omit<CalcSession, 'id'>) => {
      if (!user) return
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
        if (!sessionErr && session.coinsEarned > 0) {
          const { error: starErr } = await supabase.from('star_sessions').insert({
            user_id: user.id,
            date: session.date,
            source: 'calc',
            coins_earned: session.coinsEarned,
            ref_id: sessionId,
          })
          if (starErr) {
            console.error('[star_sessions] calc insert failed', {
              userId: user.id,
              error: starErr,
            })
          }
        }
      } catch (err) {
        console.error('[recordSession] unexpected error', err)
      }
      invalidateSessionStore('calc_session_summaries')
      await refresh()
    },
    [user, refresh],
  )

  const spendVoucher = useCallback(async (category: VoucherCategory) => {
    if (!user) return
    calcWalletStore.patchSessionData(user.id, (prev) => ({
      ...prev,
      voucherRecords: [...prev.voucherRecords, { category, free: false }],
    }))
  }, [user])

  // Derived per render (not cached at fetch time) so a PWA left open across
  // midnight rolls over instead of showing yesterday's coins.
  const todayCoinsEarned = useMemo(() => {
    const t = todayStr()
    return wallet.calcCoinsByDate.find(([date]) => date === t)?.[1] ?? 0
  }, [wallet.calcCoinsByDate])

  return {
    sessions: wallet.sessions,
    sessionsReady: wallet.sessionsReady,
    sessionsFailed: wallet.sessionsFailed,
    balance: yellowBalance,
    yellowBalance,
    redBalance,
    blueBalance,
    yellowEarnedTotal: wallet.yellowEarned,
    redEarned: wallet.redEarned,
    blueEarned: wallet.blueEarned,
    yellowSpent,
    redSpent,
    blueSpent,
    todayQuestionsDone,
    todayCorrect,
    todayCoinsEarned,
    recordSession,
    spendVoucher,
    refresh,
    isLoading: isLoading || (loadSessions && !wallet.sessionsReady && !wallet.sessionsFailed),
  }
}
