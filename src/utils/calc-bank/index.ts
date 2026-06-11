import type { CalcLevel, CalcQuestion } from '../type'
import { enumerateMuldivBank } from './enumerate-muldiv'
import { seedAddsubBank } from './seed-addsub'
import { seedMixedBank } from './seed-mixed'

/**
 * Returns the canonical problem bank for a level.
 * Muldiv levels (6–14, 16, 18) are enumerated; signatures are user-independent.
 * Addsub (1–5) and mixed (15, 17) levels are seeded per-user.
 * Lv.19/20 (2-19 capstone) use live generation — no enumerated bank.
 *
 * Returns null for level 'C' (challenge — sampled at random, not banked).
 */
export function bankFor(level: CalcLevel, userId: string): CalcQuestion[] | null {
  const enumerated = enumerateMuldivBank(level)
  if (enumerated) return enumerated
  const addsub = seedAddsubBank(level, userId)
  if (addsub) return addsub
  const mixed = seedMixedBank(level, userId)
  if (mixed) return mixed
  return null
}

/** Expected bank size — used for advancement criteria (≥80% mastered). */
export function expectedBankSize(level: CalcLevel): number {
  switch (level) {
    case 1: return 45
    case 2: return 60
    case 3: return 60
    case 4: return 80
    case 5: return 80
    case 6: return 16  // [2,5] × [2-9]
    case 7: return 16  // [3,4] × [2-9]
    case 8: return 16  // [6,7] × [2-9]
    case 9: return 16  // [8,9] × [2-9]
    case 10: return 64 // [2-9] × [2-9]
    case 11: return 18 // [2,5] × [1-9]
    case 12: return 18
    case 13: return 36
    case 14: return 136 // mul [2-9]² 64 + div d[2-9]×q[1-9] 72
    case 15: return 60
    case 16: return 69 // mul 33 + div 36
    case 17: return 80
    case 18: return 161 // mul 77 + div 84
    // Lv.19/20 use live generation (no enumerated bank) → 0
    default: return 0
  }
}

export { enumerateMuldivBank, seedAddsubBank, seedMixedBank }
