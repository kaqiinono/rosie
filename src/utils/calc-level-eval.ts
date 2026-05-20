import { expectedBankSize } from './calc-bank'
import type {
  CalcLevel,
  CalcLevelStateInfo,
  CalcProblemState,
  CalcQuestion,
} from './type'

/**
 * Phase 5 — level state machine per master.md §八 + §九.
 *
 *   practicing → abc_passed → review_r1 → review_r2 → mastered
 *
 *   review_r1_date / review_r2_date / review_r3_date are AUDIT timestamps
 *   (write-once when that round passed). Due dates are computed from
 *   abc_passed_date: r1=+2d, r2=+7d, r3=+30d.
 */

const REVIEW_R1_DAYS = 0
const REVIEW_R2_DAYS = 0
const REVIEW_R3_DAYS = 0

const R1_PASS_THRESHOLD = 0.9
const R2_PASS_THRESHOLD = 0.9
const R3_PASS_THRESHOLD = 0.85

const POOR_ACCURACY_THRESHOLD = 0.6
const POOR_STREAK_FOR_DEMOTION = 3

const ABC_ACCURACY_THRESHOLD = 0.9
const ABC_MASTERY_RATIO = 0.8
const ABC_COVERAGE_FLOOR = 2 // attemptCount ≥ 2 per bank item
const TIME_LIMIT_RATIO = 0.9 // ≥90% of questions must be answered within per-level time limit

const MIN_AT_LEVEL_FOR_EVAL = 5 // need ≥5 problems answered at level to evaluate transitions

function addDays(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isDateDue(anchor: string | null, gapDays: number, today: string): boolean {
  if (anchor === null) return false
  return today >= addDays(anchor, gapDays)
}

// ─────────────────────────────────────────────────────────────────────
// A/B/C evaluation
// ─────────────────────────────────────────────────────────────────────

export interface ABCResult {
  passed: boolean
  a: { passed: boolean; coverageOk: boolean; accuracyOk: boolean; accuracy: number }
  b: { passed: boolean; masteredCount: number; required: number }
  c: { passed: boolean; struggling: string[] }
  d: { passed: boolean; withinLimitRate: number }
}

export interface SessionResultAtLevel {
  /** Total problems answered at this level in the session (excluding challenge). */
  count: number
  /** First-try-correct count at this level. */
  firstTryCorrect: number
  /** Count of first attempts answered within the configured per-level time limit. */
  withinLimitCount: number
}

export function evaluateABC(
  level: CalcLevel,
  problemStates: Map<string, CalcProblemState>,
  bank: CalcQuestion[],
  result: SessionResultAtLevel,
): ABCResult {
  // ── A: coverage + session accuracy ─────────────────────────────────
  const coverageOk = bank.every((q) => {
    const s = problemStates.get(q.signature)
    return s !== undefined && s.attemptCount >= ABC_COVERAGE_FLOOR
  })
  const accuracy = result.count > 0 ? result.firstTryCorrect / result.count : 0
  const accuracyOk = accuracy >= ABC_ACCURACY_THRESHOLD
  const aPassed = coverageOk && accuracyOk

  // ── B: mastery ratio ───────────────────────────────────────────────
  const masteredCount = bank.filter((q) => {
    const s = problemStates.get(q.signature)
    return s !== undefined && (s.status === 'review' || s.status === 'mastered')
  }).length
  const required = Math.ceil(expectedBankSize(level) * ABC_MASTERY_RATIO)
  const bPassed = masteredCount >= required

  // ── C: no consecutive-wrong struggling problem ────────────────────
  const struggling = bank
    .filter((q) => {
      const s = problemStates.get(q.signature)
      return s !== undefined && s.consecutiveWrong >= 2
    })
    .map((q) => q.signature)
  const cPassed = struggling.length === 0

  // ── D: within-time-limit rate ─────────────────────────────────────
  const withinLimitRate = result.count > 0 ? result.withinLimitCount / result.count : 0
  const dPassed = withinLimitRate >= TIME_LIMIT_RATIO

  return {
    passed: aPassed && bPassed && cPassed && dPassed,
    a: { passed: aPassed, coverageOk, accuracyOk, accuracy },
    b: { passed: bPassed, masteredCount, required },
    c: { passed: cPassed, struggling },
    d: { passed: dPassed, withinLimitRate },
  }
}

// ─────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────

export type LevelTransition =
  | { type: 'abc_passed' }
  | { type: 'review_pass'; round: 'r1' | 'r2' | 'r3' }
  | { type: 'review_fail'; round: 'r1' | 'r2' | 'r3'; accuracy: number }
  | { type: 'level_up'; from: CalcLevel; to: CalcLevel }
  | { type: 'level_down'; from: CalcLevel; to: CalcLevel; reason: 'consecutive_poor' }
  | { type: 'no_change' }

export interface LevelEvalInput {
  prev: CalcLevelStateInfo
  /** ABC result evaluated against post-update problem states. */
  abc: ABCResult
  /** Session result restricted to this level. */
  atLevel: SessionResultAtLevel
  /** Cap of how far we can demote. Usually 1 (no further). */
  minLevel: number
  today: string
}

export interface LevelEvalOutput {
  next: CalcLevelStateInfo
  /** All transitions triggered by this session, in order. */
  transitions: LevelTransition[]
  /** True iff the user should be moved to currentLevel + 1. */
  bumpCurrentLevel: boolean
  /** True iff the user should be moved to currentLevel - 1 (with old-level reset). */
  demote: boolean
}

/**
 * Apply session result to a level state. Returns the next state + a list of
 * transitions for the caller to write to event_log and update currentLevel.
 *
 * Warmup: while warmup_answered < 10, no transitions fire (only counters update).
 */
export function applyLevelSessionResult(input: LevelEvalInput): LevelEvalOutput {
  const { prev, abc, atLevel, minLevel, today } = input

  // Always bump warmup counter and session count
  const nextWarmupAnswered = prev.warmupAnswered + atLevel.count
  const nextWarmupComplete = prev.warmupComplete || nextWarmupAnswered >= 10
  const accuracy = atLevel.count > 0 ? atLevel.firstTryCorrect / atLevel.count : 0

  // ── Warmup gate: master.md §9.1 ────────────────────────────────────
  if (!nextWarmupComplete || atLevel.count === 0) {
    const next: CalcLevelStateInfo = {
      ...prev,
      sessionCountInLevel: prev.sessionCountInLevel + 1,
      warmupAnswered: nextWarmupAnswered,
      warmupComplete: nextWarmupComplete,
      // master.md §9.1 — don't write last_session_accuracy during warmup
      lastSessionAccuracy: prev.lastSessionAccuracy,
      consecutivePoorSessions: prev.consecutivePoorSessions,
    }
    return { next, transitions: [{ type: 'no_change' }], bumpCurrentLevel: false, demote: false }
  }

  // ── Track poor-session streak ───────────────────────────────────────
  const nextConsecutivePoor =
    accuracy < POOR_ACCURACY_THRESHOLD ? prev.consecutivePoorSessions + 1 : 0

  // ── Demotion check (master.md §9.3) — takes precedence ─────────────
  const numericPrevLevel = typeof prev.level === 'number' ? prev.level : 0
  if (nextConsecutivePoor >= POOR_STREAK_FOR_DEMOTION && numericPrevLevel > minLevel) {
    const next: CalcLevelStateInfo = {
      ...prev,
      sessionCountInLevel: prev.sessionCountInLevel + 1,
      warmupAnswered: nextWarmupAnswered,
      warmupComplete: nextWarmupComplete,
      lastSessionAccuracy: accuracy,
      consecutivePoorSessions: 0, // reset after demotion fires
      // Status is wiped — the level we'll fall to is reset by the caller.
    }
    const toLevel = (numericPrevLevel - 1) as CalcLevel
    return {
      next,
      transitions: [{ type: 'level_down', from: prev.level, to: toLevel, reason: 'consecutive_poor' }],
      bumpCurrentLevel: false,
      demote: true,
    }
  }

  // ── Review / ABC transitions ───────────────────────────────────────
  const transitions: LevelTransition[] = []
  let nextStatus = prev.status
  let nextAbcDate = prev.abcPassedDate
  let nextR1 = prev.reviewR1Date
  let nextR2 = prev.reviewR2Date
  let nextR3 = prev.reviewR3Date
  let bumpCurrent = false

  // Need enough at-level problems for evaluation to be meaningful
  const meaningful = atLevel.count >= MIN_AT_LEVEL_FOR_EVAL
  const withinLimitRate = atLevel.count > 0 ? atLevel.withinLimitCount / atLevel.count : 0
  const withinLimitOk = withinLimitRate >= TIME_LIMIT_RATIO

  if (meaningful) {
    switch (prev.status) {
      case 'practicing': {
        if (abc.passed) {
          nextStatus = 'abc_passed'
          nextAbcDate = today
          transitions.push({ type: 'abc_passed' })
        }
        break
      }
      case 'abc_passed': {
        if (isDateDue(prev.abcPassedDate, REVIEW_R1_DAYS, today)) {
          if (accuracy >= R1_PASS_THRESHOLD && withinLimitOk) {
            nextStatus = 'review_r1'
            nextR1 = today
            transitions.push({ type: 'review_pass', round: 'r1' })
          } else {
            // Fail r1 → reset to practicing
            nextStatus = 'practicing'
            nextAbcDate = null
            nextR1 = null
            nextR2 = null
            nextR3 = null
            transitions.push({ type: 'review_fail', round: 'r1', accuracy })
          }
        }
        break
      }
      case 'review_r1': {
        if (isDateDue(prev.abcPassedDate, REVIEW_R2_DAYS, today)) {
          if (accuracy >= R2_PASS_THRESHOLD && withinLimitOk) {
            nextStatus = 'review_r2'
            nextR2 = today
            transitions.push({ type: 'review_pass', round: 'r2' })
          } else {
            nextStatus = 'practicing'
            nextAbcDate = null
            nextR1 = null
            nextR2 = null
            nextR3 = null
            transitions.push({ type: 'review_fail', round: 'r2', accuracy })
          }
        }
        break
      }
      case 'review_r2': {
        if (isDateDue(prev.abcPassedDate, REVIEW_R3_DAYS, today)) {
          if (accuracy >= R3_PASS_THRESHOLD && withinLimitOk) {
            nextStatus = 'mastered'
            nextR3 = today
            transitions.push({ type: 'review_pass', round: 'r3' })
            // Level up!
            if (typeof prev.level === 'number') {
              transitions.push({
                type: 'level_up',
                from: prev.level,
                to: (prev.level + 1) as CalcLevel,
              })
              bumpCurrent = true
            }
          } else {
            nextStatus = 'practicing'
            nextAbcDate = null
            nextR1 = null
            nextR2 = null
            nextR3 = null
            transitions.push({ type: 'review_fail', round: 'r3', accuracy })
          }
        }
        break
      }
      // 'review_r3' and 'mastered' don't transition further from a session
      default:
        break
    }
  }

  if (transitions.length === 0) transitions.push({ type: 'no_change' })

  const next: CalcLevelStateInfo = {
    ...prev,
    status: nextStatus,
    abcPassedDate: nextAbcDate,
    reviewR1Date: nextR1,
    reviewR2Date: nextR2,
    reviewR3Date: nextR3,
    sessionCountInLevel: prev.sessionCountInLevel + 1,
    warmupAnswered: nextWarmupAnswered,
    warmupComplete: nextWarmupComplete,
    lastSessionAccuracy: accuracy,
    consecutivePoorSessions: nextConsecutivePoor,
  }

  return { next, transitions, bumpCurrentLevel: bumpCurrent, demote: false }
}

/**
 * True iff the user's NEXT session at this level should run in assault mode
 * (last session was struggling). Per master.md §6.3.
 */
export function isAssaultMode(state: CalcLevelStateInfo): boolean {
  if (!state.warmupComplete) return false
  if (state.lastSessionAccuracy === null) return false
  return state.lastSessionAccuracy < 0.75
}
