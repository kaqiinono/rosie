import { LEVELS } from './calc-levels'
import { BLOCKS, blockById } from './calc-blocks'
import type {
  CalcCategory,
  CalcLevel,
  CalcMistake,
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

/**
 * Build a session of `count` questions from the user's selected single-op
 * "blocks" (`settings.selectedBlocks`).
 *
 * Phase 2 (temporary): single-op only, round-robin across selected blocks,
 * shuffled. Phase 5 will replace this with weakness weighting + mixed
 * sources + mistake carry-over (hence `_mistakes` is currently unused).
 */
export function buildSession(
  settings: CalcSettings,
  count: number,
  _mistakes: CalcMistake[],
): CalcQuestion[] {
  const sources = settings.selectedBlocks
    .map(blockById)
    .filter((b): b is NonNullable<ReturnType<typeof blockById>> => !!b)
  const pool = sources.length > 0 ? sources : [BLOCKS[0]] // 兜底 add:10
  const out: CalcQuestion[] = []
  for (let i = 0; i < count; i++) {
    const blk = pool[i % pool.length]
    out.push(blk.generateSingle())
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
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
