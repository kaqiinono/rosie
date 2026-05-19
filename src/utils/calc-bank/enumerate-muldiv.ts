import type { CalcLevel, CalcQuestion } from '../type'
import { buildFlatQuestion } from './build-question'

/**
 * Per master.md decision (b): mul and div are counted as independent problems.
 * Each multiplication signature `mul(k, n)` has its canonical division inverse
 * `div(k·n, k)`. Both are enumerated.
 *
 * Bank sizes (canonical):
 *   Lv.6  → 27  (k∈{1,2,5},  n∈1..9, mul only — no div)
 *   Lv.7  → 18  (k∈{3,4})
 *   Lv.8  → 18  (k∈{6,7})
 *   Lv.9  → 18  (k∈{8,9})
 *   Lv.10 → 81  (a,b∈1..9 mul only)
 *   Lv.11 → 27  (d∈{1,2,5}, q∈1..9, div only)
 *   Lv.12 → 18  (d∈{3,4})
 *   Lv.13 → 36  (d∈{6,7,8,9})
 *   Lv.14 → 162 (mul 81 + div 81, both 1..9)
 *   Lv.16 → 72  (k∈{10,11,12}, n∈1..12, mul 36 + div 36)
 *   Lv.18 → 168 (k∈13..19, n∈1..12, mul 84 + div 84)
 */

const COIN_BASE: Partial<Record<number, number>> = {
  6: 2, 7: 2, 8: 2, 9: 2, 10: 2,
  11: 2, 12: 2, 13: 2, 14: 2,
  16: 3, 18: 4,
}

function mulBank(keyFactors: number[], otherRange: number[], level: CalcLevel): CalcQuestion[] {
  const coin = COIN_BASE[level as number] ?? 2
  const out: CalcQuestion[] = []
  for (const k of keyFactors) {
    for (const n of otherRange) {
      out.push(buildFlatQuestion('mul', k, n, level, 'muldiv', coin))
    }
  }
  return out
}

function divBank(divisors: number[], quotientRange: number[], level: CalcLevel): CalcQuestion[] {
  const coin = COIN_BASE[level as number] ?? 2
  const out: CalcQuestion[] = []
  for (const d of divisors) {
    for (const q of quotientRange) {
      out.push(buildFlatQuestion('div', d * q, d, level, 'muldiv', coin))
    }
  }
  return out
}

function range(start: number, end: number): number[] {
  const out: number[] = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

/** Returns the enumerated bank for a muldiv level, or null if level isn't muldiv-enumerable. */
export function enumerateMuldivBank(level: CalcLevel): CalcQuestion[] | null {
  switch (level) {
    case 6:  return mulBank([1, 2, 5], range(1, 9), 6)
    case 7:  return mulBank([3, 4],    range(1, 9), 7)
    case 8:  return mulBank([6, 7],    range(1, 9), 8)
    case 9:  return mulBank([8, 9],    range(1, 9), 9)
    case 10: return mulBank(range(1, 9), range(1, 9), 10)
    case 11: return divBank([1, 2, 5], range(1, 9), 11)
    case 12: return divBank([3, 4],    range(1, 9), 12)
    case 13: return divBank([6, 7, 8, 9], range(1, 9), 13)
    case 14: return [
      ...mulBank(range(1, 9), range(1, 9), 14),
      ...divBank(range(1, 9), range(1, 9), 14),
    ]
    case 16: return [
      ...mulBank([10, 11, 12], range(1, 12), 16),
      ...divBank([10, 11, 12], range(1, 12), 16),
    ]
    case 18: return [
      ...mulBank(range(13, 19), range(1, 12), 18),
      ...divBank(range(13, 19), range(1, 12), 18),
    ]
    default:
      return null
  }
}
