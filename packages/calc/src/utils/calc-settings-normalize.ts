import type { BlockSel, MixedOp } from '@rosie/core'

const LEGACY_MUL_2D1D = 'mul:2d1d'
const MUL_NC = 'mul:2d1d-nc'
const MUL_C = 'mul:2d1d-c'

function normalizeBlockIds(ids: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const push = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    out.push(id)
  }

  for (const id of ids) {
    if (id !== LEGACY_MUL_2D1D) {
      push(id)
      continue
    }
    push(MUL_NC)
    push(MUL_C)
  }
  return out
}

export function normalizeSelectedBlocks(blocks: BlockSel[]): BlockSel[] {
  const out: BlockSel[] = []
  const seen = new Set<string>()

  const push = (b: BlockSel) => {
    if (seen.has(b.id)) return
    seen.add(b.id)
    out.push(b)
  }

  for (const b of blocks) {
    if (b.id !== LEGACY_MUL_2D1D) {
      push(b)
      continue
    }
    push({ id: MUL_NC, count: b.count, seconds: b.seconds })
    push({ id: MUL_C, count: b.count, seconds: b.seconds })
  }
  return out
}

export function normalizeMixedOps(ops: MixedOp[]): MixedOp[] {
  return ops.map((op) => ({ ...op, blockIds: normalizeBlockIds(op.blockIds) }))
}
