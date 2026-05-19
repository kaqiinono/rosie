import type { CalcLevel, CalcQuestion } from '../type'
import { enumerateMuldivBank } from './enumerate-muldiv'
import { seedAddsubBank } from './seed-addsub'
import { seedMixedBank } from './seed-mixed'

/**
 * Returns the canonical problem bank for a level.
 * Muldiv levels (6–14, 16, 18) are enumerated; signatures are user-independent.
 * Addsub (1–5) and mixed (15, 17) levels are seeded per-user.
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
    case 6: return 27
    case 7: return 18
    case 8: return 18
    case 9: return 18
    case 10: return 81
    case 11: return 27
    case 12: return 18
    case 13: return 36
    case 14: return 162
    case 15: return 60
    case 16: return 72
    case 17: return 80
    case 18: return 168
    default: return 0
  }
}

export { enumerateMuldivBank, seedAddsubBank, seedMixedBank }
