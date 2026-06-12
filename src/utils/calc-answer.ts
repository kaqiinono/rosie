import type { CalcAnswer } from './type'

/** Constructors. */
export function intAnswer(value: number): CalcAnswer {
  return { kind: 'int', value }
}
export function decimalAnswer(value: number, places: number): CalcAnswer {
  return { kind: 'decimal', value, places }
}
export function remainderAnswer(quotient: number, remainder: number): CalcAnswer {
  return { kind: 'remainder', quotient, remainder }
}
export function fractionAnswer(num: number, den: number): CalcAnswer {
  return { kind: 'fraction', num, den }
}

/** Human-readable answer — used for the reveal banner and mistake display. */
export function formatAnswer(a: CalcAnswer): string {
  switch (a.kind) {
    case 'int': return String(a.value)
    case 'decimal': return a.value.toFixed(a.places)
    case 'remainder': return `${a.quotient}…${a.remainder}`
    case 'fraction': return `${a.num}/${a.den}`
  }
}

/** Grade a raw user-entered string against the canonical answer. */
export function checkAnswer(input: string, a: CalcAnswer): boolean {
  const s = input.trim()
  if (s === '') return false
  switch (a.kind) {
    case 'int': {
      const n = Number(s)
      return Number.isFinite(n) && n === a.value
    }
    case 'decimal': {
      const n = Number(s)
      return Number.isFinite(n) && Math.abs(n - a.value) < 0.5 * Math.pow(10, -a.places)
    }
    case 'remainder': {
      // accepts "q…r", "q...r", or "q r"
      const m = s.match(/^(-?\d+)\s*(?:…|\.\.\.|\s)\s*(-?\d+)$/)
      return m !== null && Number(m[1]) === a.quotient && Number(m[2]) === a.remainder
    }
    case 'fraction': {
      const m = s.match(/^(-?\d+)\s*\/\s*(-?\d+)$/)
      if (!m) return false
      const num = Number(m[1])
      const den = Number(m[2])
      return den !== 0 && a.den !== 0 && num * a.den === a.num * den
    }
  }
}

/** Best-effort numeric projection for the legacy `calc_mistakes.answer` column. */
export function answerToNumeric(a: CalcAnswer): number {
  switch (a.kind) {
    case 'int':
    case 'decimal': return a.value
    case 'remainder': return a.quotient
    case 'fraction': return a.den === 0 ? 0 : a.num / a.den
  }
}

/** Reconstruct a CalcAnswer from a calc_mistakes row: prefer answer_json, else legacy int. */
export function answerFromRow(answerJson: CalcAnswer | null, legacyNumeric: number): CalcAnswer {
  return answerJson ?? { kind: 'int', value: legacyNumeric }
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    ;[x, y] = [y, x % y]
  }
  return x || 1
}

/** True when `input` ("a/b") is a valid non-zero fraction that is NOT in lowest terms. */
export function isReducibleFraction(input: string): boolean {
  const m = input.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/)
  if (!m) return false
  const num = Number(m[1])
  const den = Number(m[2])
  if (den === 0 || num === 0) return false
  return gcd(num, den) > 1
}
