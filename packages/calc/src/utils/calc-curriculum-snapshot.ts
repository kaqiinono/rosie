import { createUserSessionStore, supabase } from '@rosie/core'
import type { CalcProblemState } from '@rosie/core'
import { coverageUniverse } from './calc-coverage'
import { hasIndependentAttempt, hasWithinTargetAttempt } from './calc-evidence'
import { learningStatusFromEvidence } from './calc-mastery'
import { CALC_FEATURES } from './calc-features'

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
  formula_covered_bits: string | null
  formula_within_target_bits: string | null
  formula_fluent_bits: string | null
  formula_mastered_bits: string | null
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
  'block_id,curriculum_version,universe_size,formula_covered_bits,formula_within_target_bits,formula_fluent_bits,formula_mastered_bits,updated_at'

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
    covered: decodeSnapshotBits(row.formula_covered_bits ?? '', row.universe_size),
    withinTarget: decodeSnapshotBits(row.formula_within_target_bits ?? '', row.universe_size),
    fluent: decodeSnapshotBits(row.formula_fluent_bits ?? '', row.universe_size),
    mastered: decodeSnapshotBits(row.formula_mastered_bits ?? '', row.universe_size),
    updatedAt: row.updated_at,
  }
}

async function fetchCurriculumSnapshots(userId: string): Promise<CurriculumSnapshotMap> {
  if (!CALC_FEATURES.blockProgress) return new Map()
  const { data, error } = await supabase
    .from('calc_block_progress')
    .select(SNAPSHOT_SELECT)
    .eq('user_id', userId)
  if (error) {
    console.warn('[calc block progress] unavailable; using problem-state evidence', error)
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
  'calc_block_progress_snapshots',
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
  // The unverified calc_curriculum_snapshots prototype was never deployed.
  // Final progress is written only by settle_calc_session; legacy settlement
  // safely falls back to problem-state evidence rather than creating a second writer.
  void userId
  void states
}

/** Idempotent bootstrap from existing problem-state evidence; no per-formula rows are created. */
export async function rebuildCurriculumSnapshots(
  userId: string,
  states: Iterable<CalcProblemState>,
): Promise<void> {
  await syncCurriculumSnapshots(userId, [...states])
}
