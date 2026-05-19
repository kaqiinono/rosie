import type { CalcLevel, CalcOp, CalcQuestion } from '../type'
import { buildFlatQuestion } from './build-question'
import { bankSeed, mulberry32 } from './rng'

/**
 * Per master.md §10 estimates:
 *   Lv.1 → ~45 题
 *   Lv.2 → ~60 题
 *   Lv.3 → ~60 题
 *   Lv.4 → ~80 题
 *   Lv.5 → ~80 题
 *
 * Strategy: enumerate the full universe for each level, then deterministically
 * sample `target` problems using a per-user seeded RNG.
 */

const TARGET_SIZE: Record<number, number> = {
  1: 45,
  2: 60,
  3: 60,
  4: 80,
  5: 80,
}

const COIN_BASE: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 2, 5: 2,
}

interface Pair {
  op: CalcOp
  left: number
  right: number
}

/** Lv.1: 10 以内加减 — full universe. */
function universeL1(): Pair[] {
  const out: Pair[] = []
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= 10 - a; b++) out.push({ op: 'add', left: a, right: b })
  }
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= a; b++) out.push({ op: 'sub', left: a, right: b })
  }
  return out
}

/** Lv.2: 20 以内加减（不进退位）. */
function universeL2(): Pair[] {
  const out: Pair[] = []
  // 两位数 + 一位数, no carry
  for (let a = 10; a <= 19; a++) {
    const aOnes = a % 10
    for (let b = 0; b <= 9 - aOnes; b++) out.push({ op: 'add', left: a, right: b })
  }
  // 一位数 + 两位数 (mirror)
  for (let b = 10; b <= 19; b++) {
    const bOnes = b % 10
    for (let a = 0; a <= 9 - bOnes; a++) out.push({ op: 'add', left: a, right: b })
  }
  // 两位数 - 一位数, no borrow (aOnes ≥ b)
  for (let a = 10; a <= 20; a++) {
    const aOnes = a % 10
    for (let b = 0; b <= aOnes; b++) out.push({ op: 'sub', left: a, right: b })
  }
  return out
}

/** Lv.3: 20 以内加减（进退位）. */
function universeL3(): Pair[] {
  const out: Pair[] = []
  // 一位 + 一位 with carry (sum 11..19)
  for (let a = 2; a <= 9; a++) {
    const minB = Math.max(2, 11 - a)
    for (let b = minB; b <= 9; b++) out.push({ op: 'add', left: a, right: b })
  }
  // 两位 - 一位 with borrow (aOnes < b)
  for (let a = 11; a <= 19; a++) {
    const aOnes = a % 10
    for (let b = aOnes + 1; b <= 9; b++) out.push({ op: 'sub', left: a, right: b })
  }
  return out
}

/** Lv.4: 100 以内加减（不进退位）. */
function universeL4(): Pair[] {
  const out: Pair[] = []
  // a + b, no carry on ones, sum ≤ 100
  for (let a = 10; a <= 89; a++) {
    const aOnes = a % 10
    const aTens = Math.floor(a / 10)
    for (let bTens = 0; bTens <= 9 - aTens; bTens++) {
      for (let bOnes = 0; bOnes <= 9 - aOnes; bOnes++) {
        const b = bTens * 10 + bOnes
        if (b === 0) continue
        if (a + b > 100) continue
        out.push({ op: 'add', left: a, right: b })
      }
    }
  }
  // a - b, no borrow, both two-digit-ish
  for (let a = 20; a <= 99; a++) {
    const aOnes = a % 10
    const aTens = Math.floor(a / 10)
    for (let bTens = 1; bTens <= aTens; bTens++) {
      for (let bOnes = 0; bOnes <= aOnes; bOnes++) {
        const b = bTens * 10 + bOnes
        if (b >= a) continue
        out.push({ op: 'sub', left: a, right: b })
      }
    }
  }
  return out
}

/** Lv.5: 100 以内加减（进退位）. */
function universeL5(): Pair[] {
  const out: Pair[] = []
  // a + b with carry on ones (a%10 + b%10 ≥ 10), sum ≤ 100
  for (let a = 10; a <= 89; a++) {
    const aOnes = a % 10
    for (let b = 10; b <= 99 - a; b++) {
      const bOnes = b % 10
      if (aOnes + bOnes < 10) continue
      out.push({ op: 'add', left: a, right: b })
    }
  }
  // a - b with borrow on ones (a%10 < b%10)
  for (let a = 21; a <= 100; a++) {
    const aOnes = a % 10
    for (let b = 11; b < a; b++) {
      const bOnes = b % 10
      if (aOnes >= bOnes) continue
      out.push({ op: 'sub', left: a, right: b })
    }
  }
  return out
}

function universeFor(level: number): Pair[] {
  switch (level) {
    case 1: return universeL1()
    case 2: return universeL2()
    case 3: return universeL3()
    case 4: return universeL4()
    case 5: return universeL5()
    default: return []
  }
}

/** Fisher–Yates with a seeded RNG, returning the first `count` items. */
function sample<T>(arr: T[], count: number, rng: () => number): T[] {
  const copy = arr.slice()
  const n = Math.min(count, copy.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (copy.length - i))
    const t = copy[i]
    copy[i] = copy[j]
    copy[j] = t
  }
  return copy.slice(0, n)
}

/** Returns the seeded addsub bank for a level (Lv.1–5), or null otherwise. */
export function seedAddsubBank(level: CalcLevel, userId: string): CalcQuestion[] | null {
  if (typeof level !== 'number' || level < 1 || level > 5) return null
  const universe = universeFor(level)
  const target = TARGET_SIZE[level]
  const coin = COIN_BASE[level]
  const rng = mulberry32(bankSeed(userId, level))
  const picks = sample(universe, target, rng)
  return picks.map((p) => buildFlatQuestion(p.op, p.left, p.right, level, 'addsub', coin))
}
