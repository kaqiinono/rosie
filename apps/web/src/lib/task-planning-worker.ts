import {
  solveCapacityPolicies,
  buildPlanningRisks,
  type PlanningInput,
} from '@rosie/tasks/planning'
import { createAdminSupabase } from './api-auth'
import { buildTaskPlanningInput, type ApplicationPlanningSnapshot } from './task-planning-input'
export type WorkerReport = {
  claimed: number
  published: number
  stale: number
  retried: number
  failed: number
}
type Claim = { user_id: string; lease_id: string }
type Snapshot = ApplicationPlanningSnapshot & {
  shared_revision: number
  now: string
  tight_ratio: number
}
export type PlanningRpc = (name: string, args: Record<string, unknown>) => Promise<unknown>
/** Minute expiry bounds wall-clock validity even when every page is closed. */
export function planningExpiry(input: PlanningInput): string {
  const now = Date.parse(input.now)
  const boundaries = [
    now + 60000,
    ...input.capacity.flatMap((c) => [Date.parse(c.start), Date.parse(c.end)]),
    ...input.demands.flatMap((d) => [Date.parse(d.release_at), Date.parse(d.due_at)]),
  ]
  return new Date(Math.min(...boundaries.filter((t) => t > now))).toISOString()
}
export async function runPlanningJobs(
  limit: number,
  rpc: PlanningRpc,
  owner?: string,
): Promise<WorkerReport> {
  const claims = (await rpc('task_claim_planning_jobs', {
    p_limit: limit,
    p_user: owner ?? null,
  })) as Claim[]
  const report: WorkerReport = {
    claimed: claims.length,
    published: 0,
    stale: 0,
    retried: 0,
    failed: 0,
  }
  for (const claim of claims) {
    const identity = { p_user: claim.user_id, p_lease: claim.lease_id }
    try {
      const snapshot = (await rpc('task_planning_input', { p_user: claim.user_id })) as Snapshot
      const input = buildTaskPlanningInput(snapshot, snapshot.now)
      const result = solveCapacityPolicies(input)
      // CPU solver is synchronous. Renewal after compute must succeed before publishing;
      // an overlong/interrupted computation loses its lease rather than reviving it.
      if (!(await rpc('task_renew_planning_job', identity))) {
        report.stale++
        continue
      }
      const risks = buildPlanningRisks(
        result.allow_weekend,
        { tight_ratio: snapshot.tight_ratio },
        input,
      )
      const published = await rpc('task_publish_planning', {
        ...identity,
        p_shared_revision: snapshot.shared_revision,
        p_input: input,
        p_result: result,
        p_risks: risks,
        p_next: planningExpiry(input),
      })
      if (published) report.published++
      else report.stale++
    } catch {
      report.failed++
      if (await rpc('task_fail_planning_job', identity).catch(() => false)) report.retried++
    }
  }
  return report
}
function serviceRpc(): PlanningRpc {
  const client = createAdminSupabase()
  return async (name, args) => {
    const { data, error } = await client.rpc(name, args)
    if (error) throw new Error('planning_rpc_failed')
    return data
  }
}
export async function recomputeClaimedPlanningJobs(limit: number): Promise<WorkerReport> {
  return runPlanningJobs(limit, serviceRpc())
}
/** Only call with getUserFromRequest's verified identity, never a request body user ID. */
export async function recomputeOwnerPlanning(userId: string): Promise<WorkerReport> {
  return runPlanningJobs(1, serviceRpc(), userId)
}
