'use client'

import { useCallback, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type {
  CalcLevel,
  CalcProblemState,
  CalcProblemStatus,
  CalcQuestion,
  QuestionAttempt,
} from '@/utils/type'
import { bankFor } from '@/utils/calc-bank'

// ─────────────────────────────────────────────────────────────────────
// Row mapping
// ─────────────────────────────────────────────────────────────────────

interface ProblemStateRow {
  signature: string
  level: number
  proficiency: number
  attempt_count: number
  appearance_count: number
  recent_results: QuestionAttempt[]
  status: CalcProblemStatus
  short_mastered_at: string | null
  review_r1_due: string | null
  review_r2_due: string | null
  review_r3_due: string | null
  long_mastered: boolean
  last_seen_session: number | null
  times_seen_this_round: number
  consecutive_wrong: number
  forced_next: boolean
  updated_at: string
}

function rowToState(r: ProblemStateRow): CalcProblemState {
  return {
    signature: r.signature,
    level: r.level === 99 ? 'C' : r.level,
    proficiency: r.proficiency,
    attemptCount: r.attempt_count,
    appearanceCount: r.appearance_count,
    recentResults: Array.isArray(r.recent_results) ? r.recent_results : [],
    status: r.status,
    shortMasteredAt: r.short_mastered_at,
    reviewR1Due: r.review_r1_due,
    reviewR2Due: r.review_r2_due,
    reviewR3Due: r.review_r3_due,
    longMastered: r.long_mastered,
    lastSeenSession: r.last_seen_session,
    timesSeenThisRound: r.times_seen_this_round,
    consecutiveWrong: r.consecutive_wrong,
    forcedNext: r.forced_next,
    updatedAt: r.updated_at,
  }
}

function levelToInt(level: CalcLevel): number {
  return level === 'C' ? 99 : level
}

function stateToRow(s: CalcProblemState, userId: string) {
  return {
    user_id: userId,
    signature: s.signature,
    level: levelToInt(s.level),
    proficiency: s.proficiency,
    attempt_count: s.attemptCount,
    appearance_count: s.appearanceCount,
    recent_results: s.recentResults,
    status: s.status,
    short_mastered_at: s.shortMasteredAt,
    review_r1_due: s.reviewR1Due,
    review_r2_due: s.reviewR2Due,
    review_r3_due: s.reviewR3Due,
    long_mastered: s.longMastered,
    last_seen_session: s.lastSeenSession,
    times_seen_this_round: s.timesSeenThisRound,
    consecutive_wrong: s.consecutiveWrong,
    forced_next: s.forcedNext,
    updated_at: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function defaultState(signature: string, level: CalcLevel): CalcProblemState {
  return {
    signature,
    level,
    proficiency: 0,
    attemptCount: 0,
    appearanceCount: 0,
    recentResults: [],
    status: 'active',
    shortMasteredAt: null,
    reviewR1Due: null,
    reviewR2Due: null,
    reviewR3Due: null,
    longMastered: false,
    lastSeenSession: null,
    timesSeenThisRound: 0,
    consecutiveWrong: 0,
    forcedNext: false,
    updatedAt: new Date().toISOString(),
  }
}

const RECENT_CAP = 10

const REVIEW_R1_DAYS = 2
const REVIEW_R2_DAYS = 7
const REVIEW_R3_DAYS = 30
const SHORT_MASTER_RECENT_REQ = 3
const SHORT_MASTER_ATTEMPT_FLOOR = 3

function addDays(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isDue(due: string | null, today: string): boolean {
  return due !== null && due <= today
}

/** True if the most-recent attempts qualify the problem as short-mastered. */
function meetsShortMasterRecent(recent: QuestionAttempt[]): boolean {
  if (recent.length < SHORT_MASTER_RECENT_REQ) return false
  const last = recent.slice(-SHORT_MASTER_RECENT_REQ)
  return last.every((r) => r.correct && (r.withinLimit ?? true))
}

/** Pure: applies one attempt outcome to a state, returning the next state.
 *
 *  Handles per master.md:
 *    §3.1 proficiency changes
 *    §3.2 short-mastered transition (active → review)
 *    §3.3 spaced-verification advancement (review → review / mastered / active)
 *    §6.1 forced_next lifecycle
 *
 *  forced_next lifecycle:
 *    - Always cleared on attempt (problem was "shown" this session → consumed)
 *    - Re-armed if consecutive_wrong ≥ 2
 *
 *  Status transitions:
 *    active → review     when proficiency=5 + attempt_count≥3 + last 3 correct/within-limit
 *    review → review     correct at r1_due → clear r1; correct at r2_due → clear r2
 *    review → mastered   correct at r3_due → long_mastered=true
 *    review → active     wrong during review → proficiency=3, all dues cleared
 *    mastered → active   wrong during audit → proficiency=3, status=active (long_mastered stays)
 */
export function applyAttempt(
  prev: CalcProblemState,
  attempt: QuestionAttempt,
  withinLimit: boolean,
  sessionNo: number,
  today: string,
): CalcProblemState {
  // ── base proficiency / counter / recent_results updates ──
  let nextProf = prev.proficiency
  if (attempt.correct && withinLimit) nextProf = Math.min(5, nextProf + 1)
  else if (!attempt.correct) nextProf = Math.max(0, nextProf - 2)

  const attemptWithLimit: QuestionAttempt = { ...attempt, withinLimit }
  const nextRecent = [...prev.recentResults, attemptWithLimit].slice(-RECENT_CAP)
  const nextConsecutiveWrong = attempt.correct ? 0 : prev.consecutiveWrong + 1
  const nextForcedNext = nextConsecutiveWrong >= 2
  const nextAttemptCount = prev.attemptCount + 1

  let nextStatus = prev.status
  let nextShortMasteredAt = prev.shortMasteredAt
  let nextR1 = prev.reviewR1Due
  let nextR2 = prev.reviewR2Due
  let nextR3 = prev.reviewR3Due
  let nextLongMastered = prev.longMastered

  // ── status transitions ──
  if (prev.status === 'review') {
    if (attempt.correct && withinLimit) {
      // Pass: clear the earliest currently-due round
      if (isDue(prev.reviewR1Due, today)) {
        nextR1 = null
      } else if (isDue(prev.reviewR2Due, today)) {
        nextR2 = null
      } else if (isDue(prev.reviewR3Due, today)) {
        nextR3 = null
        nextStatus = 'mastered'
        nextLongMastered = true
      }
      // If correct but no due is active (just incidental encounter), keep status='review' as-is.
    } else {
      // Fail (wrong OR overtime): reset per master.md §3.3
      nextStatus = 'active'
      nextProf = 3
      nextShortMasteredAt = null
      nextR1 = null
      nextR2 = null
      nextR3 = null
    }
  } else if (prev.status === 'mastered') {
    // Audit (P5) — wrong demotes back to active per master.md §7.1
    if (!attempt.correct) {
      nextStatus = 'active'
      nextProf = 3
      // long_mastered stays true (historical mark)
    }
  } else {
    // active or forced — check short-mastered transition
    if (
      nextProf === 5 &&
      nextAttemptCount >= SHORT_MASTER_ATTEMPT_FLOOR &&
      meetsShortMasterRecent(nextRecent)
    ) {
      nextStatus = 'review'
      nextShortMasteredAt = today
      nextR1 = addDays(today, REVIEW_R1_DAYS)
      nextR2 = addDays(today, REVIEW_R2_DAYS)
      nextR3 = addDays(today, REVIEW_R3_DAYS)
    }
  }

  return {
    ...prev,
    proficiency: nextProf,
    attemptCount: nextAttemptCount,
    appearanceCount: prev.appearanceCount + 1,
    recentResults: nextRecent,
    status: nextStatus,
    shortMasteredAt: nextShortMasteredAt,
    reviewR1Due: nextR1,
    reviewR2Due: nextR2,
    reviewR3Due: nextR3,
    longMastered: nextLongMastered,
    lastSeenSession: sessionNo,
    timesSeenThisRound: prev.timesSeenThisRound + 1,
    consecutiveWrong: nextConsecutiveWrong,
    forcedNext: nextForcedNext,
    updatedAt: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────
// Event detectors (pure) — used by session/page.tsx to write event_log entries
// ─────────────────────────────────────────────────────────────────────

export type ReviewRound = 'r1' | 'r2' | 'r3'

/** Returns the round that was just passed, or null. */
export function justReviewPassed(prev: CalcProblemState, next: CalcProblemState): ReviewRound | null {
  if (prev.status !== 'review') return null
  if (prev.reviewR1Due !== null && next.reviewR1Due === null) return 'r1'
  if (prev.reviewR2Due !== null && next.reviewR2Due === null) return 'r2'
  if (prev.reviewR3Due !== null && next.reviewR3Due === null) return 'r3'
  return null
}

export function justReviewFailed(prev: CalcProblemState, next: CalcProblemState): boolean {
  return prev.status === 'review' && next.status === 'active'
}

export function justShortMastered(prev: CalcProblemState, next: CalcProblemState): boolean {
  return prev.status !== 'review' && next.status === 'review'
}

export function justMasteredDemoted(prev: CalcProblemState, next: CalcProblemState): boolean {
  return prev.status === 'mastered' && next.status === 'active'
}

/**
 * Returns true if applying this attempt CROSSES the consecutive_wrong=4 threshold
 * (was below 4, now ≥4). Caller writes a `forced_problem` event when this is true.
 */
export function justCrossedFour(prev: CalcProblemState, attempt: QuestionAttempt): boolean {
  const before = prev.consecutiveWrong
  const after = attempt.correct ? 0 : before + 1
  return before < 4 && after >= 4
}

// ─────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────

export interface UseCalcProblemStateReturn {
  states: Map<string, CalcProblemState>
  isLoading: boolean
  /** Load (or refresh) state for the given level + adjacent levels (current-1, current-2). */
  loadForLevels: (levels: CalcLevel[]) => Promise<void>
  /** Seed (insert if missing) all signatures from `bank` for `level`. Returns the seeded bank. */
  seedBank: (level: CalcLevel) => Promise<CalcQuestion[]>
  /** Returns a per-signature lookup that includes synthesized defaults for missing entries. */
  getState: (signature: string, level: CalcLevel) => CalcProblemState
  /** Persist a batch of state mutations. Local map updates immediately. */
  upsertStates: (next: CalcProblemState[]) => Promise<void>
  /** Reset all problem states for `level` to proficiency=3, status='active', clear dates.
   *  Used by demotion (master.md §9.3). */
  resetLevelForDemotion: (level: CalcLevel) => Promise<void>
}

export function useCalcProblemState(user: User | null): UseCalcProblemStateReturn {
  const [states, setStates] = useState<Map<string, CalcProblemState>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const userId = user?.id ?? null

  const loadForLevels = useCallback(
    async (levels: CalcLevel[]) => {
      if (!userId || levels.length === 0) return
      setIsLoading(true)
      const intLevels = levels.map(levelToInt)
      const { data } = await supabase
        .from('calc_problem_state')
        .select(
          'signature,level,proficiency,attempt_count,appearance_count,recent_results,status,short_mastered_at,review_r1_due,review_r2_due,review_r3_due,long_mastered,last_seen_session,times_seen_this_round,consecutive_wrong,forced_next,updated_at',
        )
        .eq('user_id', userId)
        .in('level', intLevels)
      const rows = (data ?? []) as ProblemStateRow[]
      setStates((prev) => {
        const next = new Map(prev)
        for (const r of rows) next.set(r.signature, rowToState(r))
        return next
      })
      setIsLoading(false)
    },
    [userId],
  )

  const seedBank = useCallback(
    async (level: CalcLevel): Promise<CalcQuestion[]> => {
      if (!userId) return []
      const bank = bankFor(level, userId)
      if (!bank || bank.length === 0) return []

      // Find signatures not yet present in `states` AND not yet in DB
      const missingLocally = bank.filter((q) => !states.has(q.signature))
      if (missingLocally.length === 0) return bank

      const signatures = missingLocally.map((q) => q.signature)
      const { data: existing } = await supabase
        .from('calc_problem_state')
        .select('signature')
        .eq('user_id', userId)
        .in('signature', signatures)
      const existingSigs = new Set((existing ?? []).map((r) => r.signature as string))

      const toInsert = missingLocally
        .filter((q) => !existingSigs.has(q.signature))
        .map((q) => stateToRow(defaultState(q.signature, level), userId))

      if (toInsert.length > 0) {
        try {
          await supabase.from('calc_problem_state').insert(toInsert)
        } catch {
          /* ignore — possibly a race with another tab */
        }
      }

      // Refresh local cache with whatever is in DB now (covers both newly inserted + pre-existing)
      const { data: fresh } = await supabase
        .from('calc_problem_state')
        .select(
          'signature,level,proficiency,attempt_count,appearance_count,recent_results,status,short_mastered_at,review_r1_due,review_r2_due,review_r3_due,long_mastered,last_seen_session,times_seen_this_round,consecutive_wrong,forced_next,updated_at',
        )
        .eq('user_id', userId)
        .in('signature', signatures)
      const freshRows = (fresh ?? []) as ProblemStateRow[]
      setStates((prev) => {
        const next = new Map(prev)
        for (const r of freshRows) next.set(r.signature, rowToState(r))
        return next
      })

      return bank
    },
    [userId, states],
  )

  const getState = useCallback(
    (signature: string, level: CalcLevel): CalcProblemState => {
      return states.get(signature) ?? defaultState(signature, level)
    },
    [states],
  )

  const upsertStates = useCallback(
    async (nextStates: CalcProblemState[]) => {
      if (nextStates.length === 0) return
      // optimistic local update
      setStates((prev) => {
        const next = new Map(prev)
        for (const s of nextStates) next.set(s.signature, s)
        return next
      })
      if (!userId) return
      const rows = nextStates.map((s) => stateToRow(s, userId))
      try {
        await supabase
          .from('calc_problem_state')
          .upsert(rows, { onConflict: 'user_id,signature' })
      } catch {
        /* ignore */
      }
    },
    [userId],
  )

  const resetLevelForDemotion = useCallback(
    async (level: CalcLevel) => {
      const lvlInt = levelToInt(level)
      const updatedAt = new Date().toISOString()

      setStates((prev) => {
        const next = new Map(prev)
        for (const [sig, s] of next) {
          if (s.level !== level) continue
          next.set(sig, {
            ...s,
            proficiency: 3,
            status: 'active',
            shortMasteredAt: null,
            reviewR1Due: null,
            reviewR2Due: null,
            reviewR3Due: null,
            forcedNext: false,
            consecutiveWrong: 0,
            timesSeenThisRound: 0,
            updatedAt,
          })
        }
        return next
      })

      if (!userId) return
      try {
        await supabase
          .from('calc_problem_state')
          .update({
            proficiency: 3,
            status: 'active',
            short_mastered_at: null,
            review_r1_due: null,
            review_r2_due: null,
            review_r3_due: null,
            forced_next: false,
            consecutive_wrong: 0,
            times_seen_this_round: 0,
            updated_at: updatedAt,
          })
          .eq('user_id', userId)
          .eq('level', lvlInt)
      } catch {
        /* ignore */
      }
    },
    [userId],
  )

  return useMemo(
    () => ({
      states,
      isLoading,
      loadForLevels,
      seedBank,
      getState,
      upsertStates,
      resetLevelForDemotion,
    }),
    [states, isLoading, loadForLevels, seedBank, getState, upsertStates, resetLevelForDemotion],
  )
}
