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
/** Older RPC responses may contain a row whose fields are all null. */
export function getPlanningSnapshot(status: PlanningStatus | null): PlanningSnapshot | null {
  const snapshot = status?.snapshot
  if (
    !snapshot?.input ||
    !Array.isArray(snapshot.input.demands) ||
    !snapshot.result?.regular_only ||
    !snapshot.result.allow_weekend
  ) {
    return null
  }
  return snapshot
}

/** Always evaluate at render time too: a mounted page may outlive its server response. */
export function isPlanningStale(status: PlanningStatus | null, now = Date.now()): boolean {
  const snapshot = getPlanningSnapshot(status)
  const expiresAt = Date.parse(snapshot?.next_recompute_at ?? '')
  return !snapshot || status?.stale !== false || !Number.isFinite(expiresAt) || expiresAt <= now
}
