import type { CalcSettings } from '@rosie/core'
import { isMixedOpValid } from './calc-mixed'

export interface CalcSessionSourceScope {
  blockIds: string[]
  mixedOpIds: string[]
}

/**
 * Database selection scope for a practice strategy.
 *
 * Mixed-only strategies have no selectedBlocks of their own, but their
 * generators still reference curriculum blocks and their learned states are
 * attributed by mixedOpId. Include both dimensions so bounded server
 * preparation never falls back to downloading the user's full state history.
 */
export function calcSessionSourceScope(settings: CalcSettings): CalcSessionSourceScope {
  const validMixedOps = settings.mixedOps.filter(
    (operation) => operation.enabled && isMixedOpValid(operation),
  )
  const blockIds = new Set(settings.selectedBlocks.map((block) => block.id))
  for (const operation of validMixedOps) {
    for (const blockId of operation.blockIds) blockIds.add(blockId)
  }

  // buildSession falls back to add:10 when a malformed/empty strategy has no
  // usable sources. Keep server preparation aligned with that safe fallback.
  if (blockIds.size === 0 && validMixedOps.length === 0) blockIds.add('add:10')

  return {
    blockIds: [...blockIds],
    mixedOpIds: validMixedOps.map((operation) => operation.id),
  }
}
