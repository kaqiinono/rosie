import type { BatchRisk, RiskSettings } from './risk'
import type { PlanningInput, PlanningResult } from './types'
export type PlanningSnapshot = {
  user_id: string
  input_revision: number
  shared_revision: number
  computed_at: string
  next_recompute_at: string
  horizon_end: string
  input: PlanningInput
  result: { regular_only: PlanningResult; allow_weekend: PlanningResult }
  risks: Record<string, BatchRisk>
}
export type PlanningStatus = {
  snapshot: PlanningSnapshot | null
  stale: boolean
  settings: RiskSettings
  alerts: {
    user_id: string
    batch_key: string
    reason: string
    risk: BatchRisk
    updated_at: string
    read_at: string | null
    resolved_at: string | null
  }[]
  background: { configured: boolean; capabilities_available: boolean; reason: string }
}
/** Always evaluate at render time too: a mounted page may outlive its server response. */
export function isPlanningStale(status: PlanningStatus | null, now = Date.now()): boolean {
  return !status?.snapshot || status.stale || Date.parse(status.snapshot.next_recompute_at) <= now
}
