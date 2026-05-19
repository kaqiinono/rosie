import type { CalcLevel, CalcSettings } from './type'

/**
 * Time limits per master.md §11 (in milliseconds).
 * Bucketed by (level, operation kind) so that, for example, `mul(1,5)` and
 * `mul(7,8)` can get different limits even though both belong to Lv.10.
 *
 * Override bucket keys are stored in `calc_settings.time_limit_overrides` JSONB.
 */

export type TimeLimitBucket =
  | 'add_10'
  | 'add_20'
  | 'add_100'
  | 'mul_easy'   // 1/2/5 ×, Lv.6 + Lv.7 (3,4 small)
  | 'mul_hard'  // 6/7/8/9 ×, Lv.8 + Lv.9
  | 'mul_mix'   // Lv.10 mixed 1-9
  | 'div_easy'   // ÷1/2/5, Lv.11 + Lv.12
  | 'div_hard'  // ÷6-9, Lv.13
  | 'muldiv_1_9' // Lv.14
  | 'mixed_2op'  // Lv.15 + Lv.17
  | 'muldiv_ext' // Lv.16 + Lv.18
  | 'challenge'

export const DEFAULT_LIMIT_MS: Record<TimeLimitBucket, number> = {
  add_10: 3000,
  add_20: 3000,
  add_100: 5000,
  mul_easy: 2000,
  mul_hard: 2500,
  mul_mix: 2500,
  div_easy: 2500,
  div_hard: 3000,
  muldiv_1_9: 3500,
  mixed_2op: 6000,
  muldiv_ext: 4000,
  challenge: 8000,
}

/** Map a level to its default time-limit bucket. */
export function bucketFor(level: CalcLevel): TimeLimitBucket {
  if (level === 'C') return 'challenge'
  switch (level) {
    case 1: return 'add_10'
    case 2: return 'add_20'
    case 3: return 'add_20'
    case 4: return 'add_100'
    case 5: return 'add_100'
    case 6: return 'mul_easy'
    case 7: return 'mul_easy'
    case 8: return 'mul_hard'
    case 9: return 'mul_hard'
    case 10: return 'mul_mix'
    case 11: return 'div_easy'
    case 12: return 'div_easy'
    case 13: return 'div_hard'
    case 14: return 'muldiv_1_9'
    case 15: return 'mixed_2op'
    case 16: return 'muldiv_ext'
    case 17: return 'mixed_2op'
    case 18: return 'muldiv_ext'
    default: return 'add_10'
  }
}

/** Resolve effective time limit for a level (with user overrides). */
export function timeLimitMs(level: CalcLevel, overrides: Record<string, number>): number {
  const bucket = bucketFor(level)
  const override = overrides[bucket]
  if (typeof override === 'number' && override > 0) return override
  return DEFAULT_LIMIT_MS[bucket]
}

/** Convenience for callers that have full settings. */
export function timeLimitFromSettings(level: CalcLevel, settings: CalcSettings): number {
  return timeLimitMs(level, settings.timeLimitOverrides ?? {})
}
