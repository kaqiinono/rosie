import { signatureOf, type AstNode } from './calc-ast'
import type { CalcProblemState } from '@rosie/core'
import { enumerateComplementsTo100 } from './calc-block-gens'

/** P0 finite blocks: 2–9 times-table related mul/div; P1 adds add:100-comp. */
export const FINITE_BLOCK_IDS = new Set([
  'mul:25',
  'mul:34',
  'mul:67',
  'mul:89',
  'mul:29',
  'div:25',
  'div:34',
  'div:69',
  'div:29',
  'add:100-comp',
])

export const COLD_START_MIN = 50

export function isFiniteBlock(blockId: string): boolean {
  return FINITE_BLOCK_IDS.has(blockId)
}

function mulSig(a: number, b: number): string {
  return signatureOf({ op: 'mul', left: a, right: b } as AstNode)
}

function divSig(dividend: number, divisor: number): string {
  return signatureOf({ op: 'div', left: dividend, right: divisor } as AstNode)
}

/** Enumerate all signatures in a finite block's universe. */
export function enumerateFinite(blockId: string): string[] {
  const out: string[] = []
  switch (blockId) {
    case 'mul:25':
      for (const k of [2, 5]) for (let o = 2; o <= 9; o++) {
        out.push(mulSig(k, o), mulSig(o, k))
      }
      break
    case 'mul:34':
      for (const k of [3, 4]) for (let o = 2; o <= 9; o++) {
        out.push(mulSig(k, o), mulSig(o, k))
      }
      break
    case 'mul:67':
      for (const k of [6, 7]) for (let o = 2; o <= 9; o++) {
        out.push(mulSig(k, o), mulSig(o, k))
      }
      break
    case 'mul:89':
      for (const k of [8, 9]) for (let o = 2; o <= 9; o++) {
        out.push(mulSig(k, o), mulSig(o, k))
      }
      break
    case 'mul:29':
      for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) {
        out.push(mulSig(a, b))
      }
      break
    case 'div:25':
      for (const d of [2, 5]) for (let q = 2; q <= 9; q++) {
        out.push(divSig(d * q, d))
      }
      break
    case 'div:34':
      for (const d of [3, 4]) for (let q = 2; q <= 9; q++) {
        out.push(divSig(d * q, d))
      }
      break
    case 'div:69':
      for (const d of [6, 7, 8, 9]) for (let q = 2; q <= 9; q++) {
        out.push(divSig(d * q, d))
      }
      break
    case 'div:29':
      for (let d = 2; d <= 9; d++) for (let q = 2; q <= 9; q++) {
        out.push(divSig(d * q, d))
      }
      break
    case 'add:100-comp': {
      for (const [a, b] of enumerateComplementsTo100()) {
        out.push(signatureOf({ op: 'add', left: a, right: b } as AstNode))
      }
      break
    }
    default:
      return []
  }
  // Deduplicate (mul key blocks push both orders)
  return [...new Set(out)]
}

/**
 * Unseen signatures for coverage. Empty/undefined states → full copy of U
 * (never return [] — that would empty the coverage slot).
 */
export function unseenSignatures(
  blockId: string,
  statesForBlock: CalcProblemState[] | undefined,
): string[] {
  const U = enumerateFinite(blockId)
  if (!statesForBlock || statesForBlock.length === 0) {
    return [...U]
  }
  const practiced = new Set(
    statesForBlock.filter((s) => s.appearanceCount > 0).map((s) => s.signature),
  )
  return U.filter((sig) => !practiced.has(sig))
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
