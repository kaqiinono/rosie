// packages/calc/src/utils/calc-block-gens.ts
import { randInt, pickOne } from './calc-ast'

const RETRY = 48

/** Ones-first digit list. */
export function digitsOf(n: number): number[] {
  const d: number[] = []
  let x = Math.abs(Math.trunc(n))
  if (x === 0) return [0]
  while (x > 0) {
    d.push(x % 10)
    x = Math.floor(x / 10)
  }
  return d
}

export function mulCarryMask(a: number, k: number): boolean[] {
  return digitsOf(a).map((d) => d * k >= 10)
}

export function hasAnyCarry(a: number, k: number): boolean {
  return mulCarryMask(a, k).some(Boolean)
}

/** Adjacent run of carries of length >= minRun (default 2). Zero digits never carry. */
export function hasConsecutiveCarries(a: number, k: number, minRun = 2): boolean {
  const mask = mulCarryMask(a, k)
  let run = 0
  for (const c of mask) {
    run = c ? run + 1 : 0
    if (run >= minRun) return true
  }
  return false
}

/** 2-digit dividend: tens digit not divisible by divisor → mid-step remainder. */
export function needsDivMidRemainder(dividend: number, divisor: number): boolean {
  if (dividend < 10 || dividend > 99 || divisor < 2) return false
  return Math.floor(dividend / 10) % divisor !== 0
}

export function enumerateComplementsTo100(): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let a = 10; a <= 90; a++) {
    const b = 100 - a
    if (b < 10 || b > 90) continue
    out.push([a, b])
  }
  return out
}

function withFallback<T>(tryGen: () => T | null, fallback: T): T {
  for (let i = 0; i < RETRY; i++) {
    const v = tryGen()
    if (v != null) return v
  }
  return fallback
}

export function genAdd100Comp(): [number, number] {
  return pickOne(enumerateComplementsTo100())
}

export function genSubRound(): [number, number] {
  return withFallback(() => {
    const a = pickOne([100, 1000] as const)
    if (a === 100) {
      const b = randInt(11, 99)
      return [a, b]
    }
    const b = randInt(101, 999)
    return [a, b]
  }, [1000, 356])
}

export function genMul2d1d(carry: boolean): [number, number] {
  return withFallback(() => {
    const a = randInt(11, 99)
    const k = randInt(2, 9)
    if (hasAnyCarry(a, k) === carry) return [a, k]
    return null
  }, carry ? [38, 3] : [42, 2])
}

export function genMul3d1d(carry: boolean): [number, number] {
  return withFallback(() => {
    const a = randInt(100, 999)
    const k = randInt(2, 9)
    if (!carry) {
      if (!hasAnyCarry(a, k)) return [a, k]
      return null
    }
    if (hasConsecutiveCarries(a, k, 2)) return [a, k]
    return null
  }, carry ? [144, 3] : [234, 2])
}

export function genDiv2d1d(borrow: boolean): [number, number] {
  return withFallback(() => {
    const divisor = randInt(2, 9)
    const q = randInt(11, 99)
    const dividend = divisor * q
    if (dividend < 10 || dividend > 99) return null
    if (needsDivMidRemainder(dividend, divisor) === borrow) return [dividend, divisor]
    return null
  }, borrow ? [72, 4] : [84, 4])
}

export function genZerosMul(): [number, number] {
  return withFallback(() => {
    const coreA = randInt(2, 9)
    const coreB = randInt(2, 9)
    const zA = pickOne([1, 1, 2]) // prefer one trailing zero on left
    const zB = pickOne([0, 0, 1])
    const a = coreA * 10 ** zA
    const b = coreB * 10 ** zB
    if (a < 10 && b < 10) return null
    return Math.random() < 0.5 ? [a, b] : [b, a]
  }, [40, 6])
}

export function genZerosDiv(): [number, number] {
  return withFallback(() => {
    // Patterns: (core*10^z) ÷ coreK, or (core*10^z) ÷ (k*10^w) with exact int
    const kind = randInt(0, 2)
    if (kind === 0) {
      // 1200 ÷ 4
      const core = randInt(2, 9)
      const k = randInt(2, 9)
      const z = pickOne([1, 2, 3])
      const dividend = core * k * 10 ** z
      return [dividend, k]
    }
    if (kind === 1) {
      // 240 ÷ 60
      const q = randInt(2, 9)
      const core = randInt(2, 9)
      const z = pickOne([1, 2])
      const divisor = core * 10 ** z
      const dividend = q * divisor
      return [dividend, divisor]
    }
    // 800 ÷ 20
    const q = randInt(2, 9) * pickOne([10, 100])
    const divisor = randInt(2, 9) * 10
    const dividend = q * divisor
    if (dividend % 10 !== 0) return null
    return [dividend, divisor]
  }, [240, 60])
}
