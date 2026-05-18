import { LEVELS, levelSpec } from './calc-levels'
import type { CalcCategory, CalcLevel, CalcMistake, CalcQuestion, CalcSettings } from './type'

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

/**
 * Pick the level for the next question.
 * Distribution: 70% current, 20% lower, 10% higher (try N+1 if available).
 */
function pickLevel(settings: CalcSettings): CalcLevel {
  const enabled = enabledLevels(settings, false) // challenge questions handled separately
  if (enabled.length === 0) return 1
  const cur = settings.currentLevel
  const r = Math.random()
  if (r < 0.7) {
    // try current level if enabled, else fallback to highest enabled ≤ current
    if (enabled.includes(cur)) return cur
  } else if (r < 0.9) {
    // try a lower enabled level
    const lower = enabled.filter((l) => typeof l === 'number' && (l as number) < cur)
    if (lower.length > 0) return lower[Math.floor(Math.random() * lower.length)]
  } else {
    // try N+1 if within cap & enabled
    const upper = enabled.find((l) => typeof l === 'number' && (l as number) === cur + 1)
    if (upper !== undefined) return upper
  }
  // Fallback: pick the closest enabled level to current
  const closest = enabled.reduce((best, l) => {
    if (typeof l !== 'number') return best
    const bestVal = typeof best === 'number' ? best : 0
    return Math.abs(l - cur) < Math.abs(bestVal - cur) ? l : best
  }, enabled[0])
  return closest
}

/** Generate one fresh question (no mistake injection). */
export function generateOneQuestion(settings: CalcSettings, asChallenge = false): CalcQuestion {
  if (asChallenge) return levelSpec('C').generate()
  const lvl = pickLevel(settings)
  return levelSpec(lvl).generate()
}

/**
 * Build a session of `count` questions.
 * - mistakeRatio fraction of slots come from unresolved mistakes (when available).
 * - If settings.currentLevel >= 15 AND enableMixed AND count >= 10, the last 1-2 slots become challenge questions.
 */
export function buildSession(
  settings: CalcSettings,
  count: number,
  mistakes: CalcMistake[],
  mistakeRatio = 0.2,
  mode: 'daily' | 'free' | 'mistakes' = 'daily',
): CalcQuestion[] {
  if (mode === 'mistakes') {
    // 100% from unresolved mistakes (top up with fresh if not enough)
    const pool = mistakes.filter((m) => !m.resolved)
    const out: CalcQuestion[] = []
    for (let i = 0; i < count; i++) {
      if (i < pool.length) {
        const m = pool[i]
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
        out.push(generateOneQuestion(settings))
      }
    }
    return out
  }

  const unresolved = mistakes.filter((m) => !m.resolved)
  const challengeUnlocked = settings.currentLevel >= 15 && settings.enableMixed
  const challengeSlots = challengeUnlocked && count >= 10 ? (count >= 20 ? 2 : 1) : 0
  const out: CalcQuestion[] = []
  const seenSigs = new Set<string>()

  for (let i = 0; i < count - challengeSlots; i++) {
    let q: CalcQuestion | null = null

    if (unresolved.length > 0 && Math.random() < mistakeRatio) {
      // pick a random unresolved mistake not already used this session
      const available = unresolved.filter((m) => !seenSigs.has(m.signature))
      if (available.length > 0) {
        const m = available[Math.floor(Math.random() * available.length)]
        q = {
          display: `${m.display.replace(/\s*=\s*\?\s*$/, '')} = ?`,
          signature: m.signature,
          arity: 1,
          level: m.level,
          answer: m.answer,
          isChallenge: false,
          category: m.category,
          coinBase: 1,
        }
      }
    }

    if (!q) {
      // generate fresh, retry to avoid intra-session sig dupes
      for (let t = 0; t < 4; t++) {
        const candidate = generateOneQuestion(settings)
        if (!seenSigs.has(candidate.signature)) {
          q = candidate
          break
        }
      }
      if (!q) q = generateOneQuestion(settings)
    }

    seenSigs.add(q.signature)
    out.push(q)
  }

  // Append challenge questions at end
  for (let i = 0; i < challengeSlots; i++) {
    out.push(generateOneQuestion(settings, true))
  }
  return out
}

/**
 * Decide whether to advance currentLevel based on recent session stats.
 * Returns the new currentLevel (>= settings.currentLevel).
 */
export function maybeAdvanceLevel(
  settings: CalcSettings,
  recentAtLevel: { firstTryCorrect: number; total: number },
): number {
  if (!settings.adaptive) return settings.currentLevel
  if (settings.currentLevel >= settings.levelCap) return settings.currentLevel
  if (recentAtLevel.total < 30) return settings.currentLevel
  const accuracy = recentAtLevel.firstTryCorrect / recentAtLevel.total
  if (accuracy >= 0.85) return Math.min(settings.currentLevel + 1, settings.levelCap)
  return settings.currentLevel
}

/**
 * Time-limit bonus stars earned at session end.
 * Only applies when a time limit was selected (timeLimitSec > 0).
 * Bonus tiers based on actual time spent (not affected by how much time was left):
 *   ≤1 min  → ×1.0 per question
 *   ≤3 min  → ×0.6
 *   ≤5 min  → ×0.5  (matches user example: 10 q in 5 min → +5)
 *   ≤10 min → ×0.3  (matches: 10 q in 10 min → +3)
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

/**
 * Preview: guaranteed minimum bonus earned when finishing exactly at the time limit.
 * Used by CalcConfigBar to display star hints per chip.
 */
export function timeLimitBonusPreview(count: number, timeLimitSec: number): number {
  return calcTimeBonus(count, timeLimitSec, timeLimitSec)
}

export const VOUCHER_PRICE = 50

export const VOUCHER_META: Record<string, { emoji: string; label: string; gradient: string }> = {
  movie: { emoji: '🎬', label: '电影券', gradient: 'from-indigo-500 to-purple-500' },
  snack: { emoji: '🍿', label: '零食券', gradient: 'from-orange-500 to-rose-500' },
  toy: { emoji: '🧸', label: '玩具券', gradient: 'from-pink-500 to-fuchsia-500' },
  wish: { emoji: '🌠', label: '心愿券', gradient: 'from-amber-500 to-violet-500' },
  cartoon: { emoji: '📺', label: '动画券', gradient: 'from-teal-500 to-emerald-500' },
  generic: { emoji: '🎁', label: '通用券', gradient: 'from-slate-500 to-zinc-500' },
}

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
