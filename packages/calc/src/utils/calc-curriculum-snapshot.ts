import { createUserSessionStore, supabase } from '@rosie/core'
import type { CalcProblemState } from '@rosie/core'
import { coverageUniverse } from './calc-coverage'
import { hasIndependentAttempt, hasWithinTargetAttempt } from './calc-evidence'
import { learningStatusFromEvidence } from './calc-mastery'

export interface CurriculumSnapshot {
  blockId: string
  version: string
  universeSize: number
  covered: Set<number>
  withinTarget: Set<number>
  fluent: Set<number>
  mastered: Set<number>
  updatedAt: string
}

export type CurriculumSnapshotMap = Map<string, CurriculumSnapshot>

interface CurriculumSnapshotRow {
  block_id: string
  curriculum_version: string
  universe_size: number
  covered_bits: string
  within_target_bits: string
  fluent_bits: string
  mastered_bits: string
  updated_at: string
}

export interface SnapshotMutationItem {
  block_id: string
  curriculum_version: string
  universe_size: number
  curriculum_index: number
  covered: boolean
  within_target: boolean
  fluent: boolean
  mastered: boolean
}

const SNAPSHOT_SELECT =
  'block_id,curriculum_version,universe_size,covered_bits,within_target_bits,fluent_bits,mastered_bits,updated_at'

/** PostgREST returns bytea in PostgreSQL hex form (`\\x...`). */
export function decodeSnapshotBits(value: string, size: number): Set<number> {
  const hex = value.startsWith('\\x') ? value.slice(2) : value
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) return new Set()
  const out = new Set<number>()
  for (let byteIndex = 0; byteIndex < hex.length / 2; byteIndex++) {
    const byte = Number.parseInt(hex.slice(byteIndex * 2, byteIndex * 2 + 2), 16)
    for (let bit = 0; bit < 8; bit++) {
      const index = byteIndex * 8 + bit
      if (index < size && (byte & (1 << bit)) !== 0) out.add(index)
    }
  }
  return out
}

function rowToSnapshot(row: CurriculumSnapshotRow): CurriculumSnapshot {
  return {
    blockId: row.block_id,
    version: row.curriculum_version,
    universeSize: row.universe_size,
    covered: decodeSnapshotBits(row.covered_bits, row.universe_size),
    withinTarget: decodeSnapshotBits(row.within_target_bits, row.universe_size),
    fluent: decodeSnapshotBits(row.fluent_bits, row.universe_size),
    mastered: decodeSnapshotBits(row.mastered_bits, row.universe_size),
    updatedAt: row.updated_at,
  }
}

async function fetchCurriculumSnapshots(userId: string): Promise<CurriculumSnapshotMap> {
  const { data, error } = await supabase
    .from('calc_curriculum_snapshots')
    .select(SNAPSHOT_SELECT)
    .eq('user_id', userId)
  if (error) {
    // Safe rollout: older deployments may not have applied the migration yet.
    console.warn('[calc curriculum snapshots] unavailable; using problem-state evidence', error)
    return new Map()
  }
  return new Map(
    ((data ?? []) as CurriculumSnapshotRow[]).map((row) => {
      const snapshot = rowToSnapshot(row)
      return [snapshot.blockId, snapshot]
    }),
  )
}

export const calcCurriculumSnapshotStore = createUserSessionStore<CurriculumSnapshotMap>(
  'calc_curriculum_snapshots',
  {
    fetch: fetchCurriculumSnapshots,
    empty: new Map(),
  },
)

export function snapshotMutationItems(states: CalcProblemState[]): SnapshotMutationItem[] {
  return states.flatMap((state) => {
    if (!state.blockId) return []
    const universe = coverageUniverse(state.blockId)
    const index = universe?.indexOf(state.signature) ?? null
    if (!universe || index === null) return []
    const learningStatus = learningStatusFromEvidence(state)
    return [
      {
        block_id: universe.blockId,
        curriculum_version: universe.version,
        universe_size: universe.size,
        curriculum_index: index,
        covered: hasIndependentAttempt(state),
        within_target: hasWithinTargetAttempt(state),
        fluent: learningStatus === 'fluent' || learningStatus === 'mastered',
        mastered: learningStatus === 'mastered',
      },
    ]
  })
}

/** Persist only formulas touched by this session; the RPC merges bits atomically. */
export async function syncCurriculumSnapshots(
  userId: string,
  states: CalcProblemState[],
): Promise<void> {
  const items = snapshotMutationItems(states)
  if (items.length === 0) return
  for (let start = 0; start < items.length; start += 400) {
    const { error } = await supabase.rpc('merge_calc_curriculum_snapshot', {
      p_items: items.slice(start, start + 400),
    })
    if (error) {
      // Snapshots are rebuildable acceleration data. Never fail session settlement for them.
      console.warn('[calc curriculum snapshots] merge failed', error)
      return
    }
  }
  await calcCurriculumSnapshotStore.refreshInBackground(userId).catch(() => undefined)
}

/** Idempotent bootstrap from existing problem-state evidence; no per-formula rows are created. */
export async function rebuildCurriculumSnapshots(
  userId: string,
  states: Iterable<CalcProblemState>,
): Promise<void> {
  await syncCurriculumSnapshots(userId, [...states])
}
