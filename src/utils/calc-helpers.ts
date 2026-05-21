import { LEVELS, MAX_NUMERIC_LEVEL, levelSpec } from './calc-levels'
import { bankFor } from './calc-bank'
import { assembleLevelPicks } from './calc-session-builder'
import { applyForm, pickForm } from './calc-forms'
import type {
  CalcCategory,
  CalcLevel,
  CalcMistake,
  CalcProblemState,
  CalcQuestion,
  CalcSettings,
} from './type'

/** Coin reward including streak bonus. coinBase already accounts for ×2 on challenge questions. */
export function coinReward(question: CalcQuestion, streak: number): number {
  let bonus = 0
  if (streak >= 10) bonus = 2
  else if (streak >= 5) bonus = 1
  return question.coinBase + bonus
}

/** Returns levels enabled by the settings (filter out categories user disabled). */
export function enabledLevels(settings: CalcSettings, includeChallenge: boolean): CalcLevel[] {
  const out: CalcLevel[] = []
  for (const spec of LEVELS) {
    if (spec.level === 'C') {
      if (includeChallenge && settings.enableMixed) out.push('C')
      continue
    }
    if (typeof spec.level === 'number' && spec.level > settings.currentLevel) continue
    if (spec.category === 'addsub' && !settings.enableAddSub) continue
    if (spec.category === 'muldiv' && !settings.enableMulDiv) continue
    if (spec.category === 'mixed' && !settings.enableMixed) continue
    out.push(spec.level)
  }
  return out
}

/** Generate a fresh challenge question (for the trailing challenge slots). */
export function generateChallenge(): CalcQuestion {
  return levelSpec('C').generate()
}

export interface BuildSessionContext {
  /** Pre-loaded problem states for the current level (and possibly adjacent). */
  problemStates: Map<string, CalcProblemState>
  /** Resolved user id; needed for seeded banks (addsub / mixed). */
  userId: string
  /** Session number this build is FOR (last completed session + 1). Used for cold rescue. */
  sessionNo: number
  /** YYYY-MM-DD; used to determine which review_rN_due dates are due. */
  today: string
  /** True ⇒ last_session_accuracy < 0.75 ⇒ assault-mode slot layout. */
  assaultMode?: boolean
  /** False during warmup (first 10 problems at a fresh level) — P0/P3/P4/P5 suppressed. */
  warmupComplete?: boolean
}

/**
 * Build a session of `count` questions per master.md §四–§六.
 *
 * Phase 2 behaviour:
 *   - Delegates to `assembleLevelPicks` for P0 (forced) + P1 (cold) + P2 (active)
 *   - P3 (review-due) / P4 (old-level mix) / P5 (mastered audit) are Phase 3+
 *   - Reserves trailing 1–2 slots for challenge if currentLevel ≥ 15 + enableMixed + count ≥ 10
 *   - Mistakes mode: pull from `calc_mistakes` (legacy behaviour, untouched)
 */
export function buildSession(
  settings: CalcSettings,
  count: number,
  mistakes: CalcMistake[],
  ctx: BuildSessionContext,
  mode: 'daily' | 'free' | 'mistakes' = 'daily',
): CalcQuestion[] {
  if (mode === 'mistakes') {
    const pool = mistakes.filter((m) => !m.resolved)
    const out: CalcQuestion[] = []
    for (let i = 0; i < count; i++) {
      if (i < pool.length) {
        const m = pool[i]
        // Mistakes always render in their original (standard) form — the display
        // string is what the kid got wrong. No form variation here.
        out.push({
          display: `${m.display.replace(/\s*=\s*\?\s*$/, '')} = ?`,
          signature: m.signature,
          arity: 1,
          level: m.level,
          answer: m.answer,
          isChallenge: false,
          category: m.category,
          coinBase: 1,
        })
      } else {
        const fallback = pickFromBank(settings.currentLevel, ctx, 1)
        if (fallback.length > 0) out.push(withForm(fallback[0], ctx))
      }
    }
    return out
  }

  // Free-practice mode: round-robin across user-picked levels, ignore enabledLevels/currentLevel.
  if (settings.freeMode) {
    return buildFreeModeSession(settings, count, ctx)
  }

  const challengeUnlocked = settings.currentLevel >= 15 && settings.enableMixed
  const challengeSlots = challengeUnlocked && count >= 10 ? (count >= 20 ? 2 : 1) : 0
  const mainCount = count - challengeSlots

  const picks = pickFromBank(settings.currentLevel, ctx, mainCount)
  const out = picks.map((q) => withForm(q, ctx))

  for (let i = 0; i < challengeSlots; i++) {
    // Challenge questions always use standard form (per calc-forms.ts).
    out.push(generateChallenge())
  }
  return out
}

/**
 * Free-practice picker. Distributes `count` questions round-robin across
 * `settings.freeModeLevels`. Challenge level ('C') in the list contributes
 * 1–2 trailing challenge slots when count ≥ 10. Empty selection falls back
 * to a single Lv.1 batch so the session is never empty.
 */
function buildFreeModeSession(
  settings: CalcSettings,
  count: number,
  ctx: BuildSessionContext,
): CalcQuestion[] {
  const picked = settings.freeModeLevels
  const hasChallenge = picked.includes('C')
  const numericPicked = picked.filter((l): l is number => typeof l === 'number')

  if (numericPicked.length === 0 && !hasChallenge) {
    // Defensive fallback — UI should prevent empty selection, but if it slips through
    // we degrade gracefully to a Lv.1 batch instead of an empty session.
    const fallback = pickFromBank(1, ctx, count)
    return fallback.map((q) => withForm(q, ctx))
  }

  if (numericPicked.length === 0) {
    const out: CalcQuestion[] = []
    for (let i = 0; i < count; i++) out.push(generateChallenge())
    return out
  }

  const challengeSlots = hasChallenge && count >= 10 ? (count >= 20 ? 2 : 1) : 0
  const mainCount = count - challengeSlots

  const perLevel = Math.floor(mainCount / numericPicked.length)
  const remainder = mainCount % numericPicked.length

  const picks: CalcQuestion[] = []
  numericPicked.forEach((level, i) => {
    const slots = perLevel + (i < remainder ? 1 : 0)
    if (slots <= 0) return
    const batch = pickFromBank(level as CalcLevel, ctx, slots)
    for (const q of batch) picks.push(withForm(q, ctx))
  })

  // Fisher-Yates shuffle so different levels are interleaved.
  for (let i = picks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[picks[i], picks[j]] = [picks[j], picks[i]]
  }

  for (let i = 0; i < challengeSlots; i++) picks.push(generateChallenge())
  return picks
}

/** Apply the form variation appropriate for the current appearance_count. */
function withForm(q: CalcQuestion, ctx: BuildSessionContext): CalcQuestion {
  const state = ctx.problemStates.get(q.signature)
  const form = pickForm(state?.appearanceCount ?? 0)
  return applyForm(q, form)
}

function pickFromBank(level: CalcLevel, ctx: BuildSessionContext, count: number): CalcQuestion[] {
  const bank = bankFor(level, ctx.userId)
  if (!bank || bank.length === 0) {
    const out: CalcQuestion[] = []
    for (let i = 0; i < count; i++) out.push(levelSpec(level).generate())
    return out
  }
  // P4 — load currentLevel-1's bank for old-level mix (master.md §9.2)
  let oldLevelBank: CalcQuestion[] | null = null
  if (typeof level === 'number' && level > 1) {
    oldLevelBank = bankFor((level - 1) as CalcLevel, ctx.userId)
  }
  const picks = assembleLevelPicks({
    level,
    bank,
    problemStates: ctx.problemStates,
    sessionNo: ctx.sessionNo,
    today: ctx.today,
    count,
    userId: ctx.userId,
    oldLevelBank,
    assaultMode: ctx.assaultMode,
    warmupComplete: ctx.warmupComplete,
  })
  // When the bank is smaller than count (e.g. level 7/8/9/12 have only 18 items),
  // pad to the requested count by generating additional questions so the session
  // length matches what the user configured.
  const gen = levelSpec(level).generate
  while (picks.length < count) picks.push(gen())
  return picks
}

/**
 * Decide whether to advance currentLevel based on recent session stats.
 * Returns the new currentLevel (>= settings.currentLevel).
 * Kept for Phase 1; Phase 5 replaces this with the A/B/C + spaced verification logic.
 */
export function maybeAdvanceLevel(
  settings: CalcSettings,
  recentAtLevel: { firstTryCorrect: number; total: number },
): number {
  if (!settings.adaptive) return settings.currentLevel
  if (settings.currentLevel >= MAX_NUMERIC_LEVEL) return settings.currentLevel
  if (recentAtLevel.total < 30) return settings.currentLevel
  const accuracy = recentAtLevel.firstTryCorrect / recentAtLevel.total
  if (accuracy >= 0.85) return Math.min(settings.currentLevel + 1, MAX_NUMERIC_LEVEL)
  return settings.currentLevel
}

/**
 * Time-limit bonus stars earned at session end (unchanged).
 *   ≤1 min  → ×1.0 per question
 *   ≤3 min  → ×0.6
 *   ≤5 min  → ×0.5
 *   ≤10 min → ×0.3
 *   > 10 min → 0
 */
export function calcTimeBonus(count: number, timeLimitSec: number, timeSpentSec: number): number {
  if (timeLimitSec <= 0) return 0
  if (timeSpentSec <= 60) return count
  if (timeSpentSec <= 180) return Math.round(count * 0.6)
  if (timeSpentSec <= 300) return Math.round(count * 0.5)
  if (timeSpentSec <= 600) return Math.round(count * 0.3)
  return 0
}

export function timeLimitBonusPreview(count: number, timeLimitSec: number): number {
  return calcTimeBonus(count, timeLimitSec, timeLimitSec)
}

// Voucher prices, labels and gradients live in the `voucher_templates` DB table
// and are accessed via `useVoucherCatalog`. The previously hardcoded constants
// were migrated by docs/voucher-templates.sql.

export function levelKey(level: CalcLevel): string {
  return typeof level === 'number' ? String(level) : level
}

export function parseLevelKey(key: string): CalcLevel {
  if (key === 'C') return 'C'
  const n = Number(key)
  return Number.isFinite(n) ? n : 1
}

export function categoryLabel(cat: CalcCategory): string {
  switch (cat) {
    case 'addsub':
      return '加减法'
    case 'muldiv':
      return '乘除法'
    case 'mixed':
      return '混合运算'
  }
}
