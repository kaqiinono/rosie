import type { CalcLevel, CalcProblemState, CalcQuestion } from './type'
import { hashString, mulberry32 } from './calc-bank/rng'

/**
 * Phase 2 session assembly per master.md §四 + §五 + §六.
 *
 *   P0 forced  — status='forced' OR forced_next=true. Picked first.
 *   P1 cold    — last_seen_session gap exceeds the proficiency threshold.
 *   P2 active  — current level main pool. Round 1 = seeded shuffled coverage; Round 2+ = weighted.
 *
 *   P3 (review-due) / P4 (old-level mix) / P5 (mastered audit) — Phase 3+.
 *
 * Cap: P0 + P1 ≤ ⌊count · 0.5⌋ to protect the main practice budget.
 *
 * Round 1 ordering: per-user seeded shuffle (stable across sessions for the
 * same user+level, but each user sees a different order — and no longer the
 * tedious 1×1, 1×2, 1×3… readout of the bank's enumeration order).
 */

const WEIGHT_FOR_PROF: Record<number, number> = {
  0: 5, 1: 5,
  2: 3, 3: 3,
  4: 1,
  5: 0,
}

export interface PickContext {
  level: CalcLevel
  bank: CalcQuestion[]
  problemStates: Map<string, CalcProblemState>
  /** The session number this build is FOR (i.e. one greater than the last completed session). */
  sessionNo: number
  /** Today as YYYY-MM-DD; used to determine which review_rN_due dates are due. */
  today: string
  count: number
  /** User id — seeds the Round 1 / warmup shuffle so each kid sees a different order. */
  userId: string
  /** Optional previous-level bank for P4 anti-forgetting mix (master.md §9.2). */
  oldLevelBank?: CalcQuestion[] | null
  /** True ⇒ last_session_accuracy < 0.75 ⇒ assault-mode slot layout (master.md §6.3). */
  assaultMode?: boolean
  /** False during warmup (first 10 problems of a fresh level) — P0/P3/P4/P5 suppressed. */
  warmupComplete?: boolean
}

const P3_SHARE = 0.15
const P5_SHARE = 0.10
const P4_SHARE = 0.20      // §9.2 — old-level anti-forgetting mix
const ASSAULT_WEAK_SHARE = 0.20  // §6.3 — 5/25 weakest slot

function isDueDate(due: string | null, today: string): boolean {
  return due !== null && due <= today
}

function isReviewDue(state: CalcProblemState, today: string): boolean {
  return (
    state.status === 'review' &&
    (isDueDate(state.reviewR1Due, today) ||
      isDueDate(state.reviewR2Due, today) ||
      isDueDate(state.reviewR3Due, today))
  )
}

interface Annotated {
  q: CalcQuestion
  state: CalcProblemState | null
}

function annotate(bank: CalcQuestion[], states: Map<string, CalcProblemState>): Annotated[] {
  return bank.map((q) => ({ q, state: states.get(q.signature) ?? null }))
}

/** Cold thresholds per master.md §5.2 (gap in sessions; > threshold ⇒ cold). */
function coldThreshold(state: CalcProblemState): number {
  if (state.status === 'mastered') return 30
  const p = state.proficiency
  if (p <= 2) return 2
  if (p <= 4) return 4
  return 8
}

function isColdSelectable(state: CalcProblemState | null, sessionNo: number): boolean {
  if (!state || state.lastSeenSession === null) return false
  // 'mastered' problems are revived very rarely — Phase 3+ will sample these in P5
  if (state.status === 'mastered') return false
  return sessionNo - state.lastSeenSession > coldThreshold(state)
}

function weightFor(state: CalcProblemState | null): number {
  if (!state) return WEIGHT_FOR_PROF[0]
  if (state.status === 'review' || state.status === 'mastered') return 0
  return WEIGHT_FOR_PROF[state.proficiency] ?? 0
}

/** Fisher–Yates shuffle with a seeded RNG (stable for a given seed). */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice()
  const rng = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = out[i]
    out[i] = out[j]
    out[j] = t
  }
  return out
}

function roundShuffleSeed(userId: string, level: CalcLevel, namespace: string): number {
  return hashString(`${userId}::${namespace}::${level}`)
}

/**
 * Coverage ordering: unseen problems come before seen ones, and within each
 * partition the order is a per-user seeded shuffle (different kid → different
 * order; same kid → stable order across sessions).
 */
function coverageOrder(
  items: Annotated[],
  userId: string,
  level: CalcLevel,
  namespace: string,
): Annotated[] {
  const unseen: Annotated[] = []
  const seen: Annotated[] = []
  for (const it of items) {
    if ((it.state?.attemptCount ?? 0) === 0) unseen.push(it)
    else seen.push(it)
  }
  const seedA = roundShuffleSeed(userId, level, `${namespace}::unseen`)
  const seedB = roundShuffleSeed(userId, level, `${namespace}::seen`)
  return [...seededShuffle(unseen, seedA), ...seededShuffle(seen, seedB)]
}

/** Weighted sample without replacement; falls back to uniform if all weights are zero. */
function weightedSampleAnnotated(items: Annotated[], count: number): CalcQuestion[] {
  const pool = items.slice()
  const out: CalcQuestion[] = []
  while (out.length < count && pool.length > 0) {
    const weights = pool.map((it) => weightFor(it.state))
    const total = weights.reduce((s, w) => s + w, 0)
    if (total <= 0) break
    let r = Math.random() * total
    let pick = 0
    for (let j = 0; j < pool.length; j++) {
      r -= weights[j]
      if (r <= 0) {
        pick = j
        break
      }
    }
    out.push(pool[pick].q)
    pool.splice(pick, 1)
  }
  return out
}

function uniformFill(items: Annotated[], taken: Set<string>, count: number): CalcQuestion[] {
  const remaining = items.filter((it) => !taken.has(it.q.signature))
  const out: CalcQuestion[] = []
  while (out.length < count && remaining.length > 0) {
    const i = Math.floor(Math.random() * remaining.length)
    out.push(remaining[i].q)
    remaining.splice(i, 1)
  }
  return out
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const pool = arr.slice()
  const out: T[] = []
  while (out.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length)
    out.push(pool[i])
    pool.splice(i, 1)
  }
  return out
}

export function assembleLevelPicks(ctx: PickContext): CalcQuestion[] {
  const {
    bank,
    problemStates,
    sessionNo,
    today,
    count,
    oldLevelBank,
    assaultMode = false,
    warmupComplete = true,
  } = ctx
  if (count <= 0 || bank.length === 0) return []

  const annotated = annotate(bank, problemStates)

  // ── Warmup mode (master.md §9.1) — coverage of current level, no priorities
  if (!warmupComplete) {
    const ordered = coverageOrder(annotated, ctx.userId, ctx.level, 'warmup')
    const picks = ordered.slice(0, count).map((it) => it.q)
    if (picks.length < count) {
      const taken = new Set(picks.map((q) => q.signature))
      picks.push(...uniformFill(annotated, taken, count - picks.length))
    }
    return picks
  }

  // P0 — forced
  const forced = annotated.filter(
    ({ state }) => state !== null && (state.forcedNext || state.status === 'forced'),
  )

  // P3 — review due (exclude forced; status='review' has no overlap with forced anyway)
  const forcedSigs = new Set(forced.map((it) => it.q.signature))
  const reviewDue = annotated.filter(
    ({ q, state }) => !forcedSigs.has(q.signature) && state !== null && isReviewDue(state, today),
  )

  // P1 — cold (exclude forced + review-due)
  const reviewSigs = new Set(reviewDue.map((it) => it.q.signature))
  const cold = annotated.filter(
    ({ q, state }) =>
      !forcedSigs.has(q.signature) &&
      !reviewSigs.has(q.signature) &&
      isColdSelectable(state, sessionNo),
  )

  const p0Pick = forced.slice(0, count)
  const p3Cap = Math.max(0, Math.floor(count * P3_SHARE))
  // P3 due-reviews honour their cap up-front (time-sensitive checks)
  const p3Pick = reviewDue.slice(0, Math.min(p3Cap || 1, count - p0Pick.length))

  // P0 + P1 ≤ 50% of slots (P3 doesn't share the cap)
  const priorityCap = Math.max(1, Math.floor(count * 0.5))
  const p1Cap = Math.max(0, priorityCap - p0Pick.length)
  const p1Pick = cold.slice(0, Math.min(p1Cap, count - p0Pick.length - p3Pick.length))

  const usedEarly = new Set<string>()
  for (const it of p0Pick) usedEarly.add(it.q.signature)
  for (const it of p3Pick) usedEarly.add(it.q.signature)
  for (const it of p1Pick) usedEarly.add(it.q.signature)

  // ── Assault-mode weakest slot (master.md §6.3) ────────────────────
  let pWeakPick: Annotated[] = []
  if (assaultMode) {
    const weakCap = Math.max(0, Math.floor(count * ASSAULT_WEAK_SHARE))
    const weakPool = annotated
      .filter(
        ({ q, state }) =>
          !usedEarly.has(q.signature) &&
          !(state !== null && (state.status === 'review' || state.status === 'mastered')),
      )
      .slice()
      .sort((a, b) => (a.state?.proficiency ?? 0) - (b.state?.proficiency ?? 0))
    pWeakPick = weakPool.slice(0, Math.min(weakCap, Math.max(0, count - usedEarly.size)))
    for (const it of pWeakPick) usedEarly.add(it.q.signature)
  }

  // P5 — mastered audit
  const masteredPool = annotated.filter(
    ({ q, state }) =>
      !usedEarly.has(q.signature) && state !== null && state.status === 'mastered',
  )
  const p5Cap = Math.max(0, Math.floor(count * P5_SHARE))
  const remainingForP5 = count - usedEarly.size
  const p5Pick = pickRandom(masteredPool, Math.min(p5Cap, Math.max(0, remainingForP5)))
  for (const it of p5Pick) usedEarly.add(it.q.signature)

  // P4 — old-level anti-forgetting mix (master.md §9.2)
  let p4Pick: CalcQuestion[] = []
  if (oldLevelBank && oldLevelBank.length > 0) {
    const p4Cap = Math.max(0, Math.floor(count * P4_SHARE))
    const remainingForP4 = count - usedEarly.size
    const oldAnnotated = annotate(oldLevelBank, problemStates)
    // Prefer review/active states (= still meaningful practice); skip mastered for P4
    const oldPool = oldAnnotated.filter(
      ({ q, state }) =>
        !usedEarly.has(q.signature) &&
        !(state !== null && state.status === 'mastered'),
    )
    const oldPicks = weightedSampleAnnotated(oldPool, Math.min(p4Cap, Math.max(0, remainingForP4)))
    for (const q of oldPicks) usedEarly.add(q.signature)
    p4Pick = oldPicks
  }

  const remaining = count - usedEarly.size

  // P2 — main pool: current-level active/new problems
  const mainPool = annotated.filter(
    ({ q, state }) =>
      !usedEarly.has(q.signature) &&
      !(state !== null && (state.status === 'review' || state.status === 'mastered')),
  )

  const inRound1 = mainPool.some((it) => (it.state?.attemptCount ?? 0) === 0)

  let p2Pick: CalcQuestion[]
  if (inRound1) {
    const ordered = coverageOrder(mainPool, ctx.userId, ctx.level, 'round1')
    p2Pick = ordered.slice(0, remaining).map((it) => it.q)
  } else {
    p2Pick = weightedSampleAnnotated(mainPool, remaining)
  }

  if (p2Pick.length < remaining) {
    const taken = new Set(p2Pick.map((q) => q.signature))
    for (const sig of usedEarly) taken.add(sig)
    p2Pick = [
      ...p2Pick,
      ...uniformFill(annotated, taken, remaining - p2Pick.length),
    ]
  }

  // Order: priority slots first, then assault-weak (if any), then audit, then old-level, then main
  return [
    ...p0Pick.map((it) => it.q),
    ...p3Pick.map((it) => it.q),
    ...p1Pick.map((it) => it.q),
    ...pWeakPick.map((it) => it.q),
    ...p5Pick.map((it) => it.q),
    ...p4Pick,
    ...p2Pick,
  ]
}

/**
 * Insert a wrongly-answered question back into the session queue at `currentIdx + 4`.
 * Returns a new array (does not mutate). If the offset exceeds the queue length,
 * appends to the end.
 *
 * Per master.md §6.2 — interleaved practice forces the brain to retrieve again
 * rather than repeat from short-term memory.
 */
export function interleaveWrong(
  questions: CalcQuestion[],
  currentIdx: number,
  q: CalcQuestion,
  offset = 4,
): CalcQuestion[] {
  const insertAt = Math.min(questions.length, currentIdx + 1 + offset)
  const out = questions.slice()
  out.splice(insertAt, 0, q)
  return out
}
