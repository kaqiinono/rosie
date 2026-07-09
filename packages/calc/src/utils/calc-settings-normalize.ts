import type { BlockSel } from '@rosie/core'

const LEGACY_MUL_2D1D = 'mul:2d1d'
const MUL_NC = 'mul:2d1d-nc'
const MUL_C = 'mul:2d1d-c'

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
