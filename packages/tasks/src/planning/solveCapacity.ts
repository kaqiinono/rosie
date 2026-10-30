import { applyFixedBlocks } from './fixedBlocks'
import { allocateFlow } from './flowNetwork'
import { minute, iso } from './intervals'
import { batchMetrics, headroomPrepared, todayPrepared } from './batchMetrics'
import type {
  PlanningInput,
  PlanningIssue,
  PlanningResult,
  TaskDemand,
  ConflictGroup,
} from './types'
export type CapacityPolicy = 'regular_only' | 'allow_weekend'
/** Prepare once. Undated projections exist only to validate explicitly fixed local
 * commitments; their residual demand is NEVER passed to the movable flow. */
export function prepareCapacity(input: PlanningInput, policy: CapacityPolicy) {
  let issues: PlanningIssue[] = [...input.configuration_issues]
  const blocks = [
    ...new Map(
      [
        ...input.fixed_blocks,
        ...(input.undated_work ?? []).flatMap((w) => w.commitment_blocks),
      ].map((b) => [b.id, b]),
    ).values(),
  ]
  const undated: TaskDemand[] = (input.undated_work ?? []).map((w) => ({
    key: w.key,
    task_id: w.task_id,
    course_id: w.course_id,
    batch_key: w.key,
    origin: w.origin,
    release_at: w.release_at,
    due_at: iso(
      Math.max(
        Date.parse(input.now),
        ...w.commitment_blocks.map((b) => Date.parse(b.ends_at)).filter(Number.isFinite),
      ),
    ),
    remaining_minutes: w.remaining_minutes,
    priority: 0,
    certainty: 'confirmed',
    source_revision: input.input_revision,
    deadline_source: 'missing',
  }))
  const all = [...input.demands, ...undated]
  for (const d of all)
    if (d.certainty === 'incomplete')
      issues.push({
        code: 'incomplete_demand',
        affected_keys: [d.key],
        detail: '任务需求信息不完整',
      })
  const valid = all.filter((d) => {
    const ok =
      Number.isSafeInteger(d.remaining_minutes) &&
      d.remaining_minutes >= 0 &&
      Number.isFinite(Date.parse(d.release_at)) &&
      Number.isFinite(Date.parse(d.due_at)) &&
      Number.isFinite(d.priority)
    if (!ok)
      issues.push({ code: 'invalid_demand', affected_keys: [d.key], detail: '任务时间或分钟无效' })
    return ok
  })
  // Canonical availability is disjoint. Reject malformed overlapping raw inputs rather
  // than manufacturing shared capacity. Rebuild minutes from conservative clock bounds.
  let end = -Infinity
  const capacity = input.capacity
    .slice()
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .flatMap((c) => {
      const start =
        Math.ceil(Math.max(Date.parse(c.start), Date.parse(input.now)) / minute) * minute
      const stop =
        Math.floor(Math.min(Date.parse(c.end), Date.parse(input.horizon_end)) / minute) * minute
      if (!Number.isFinite(start) || !Number.isFinite(stop) || start < end) {
        issues.push({
          code: 'invalid_capacity',
          affected_keys: [c.key],
          detail: '可用时间无效或重叠',
        })
        return []
      }
      if (stop <= start) return []
      end = stop
      return [{ ...c, start: iso(start), end: iso(stop), minutes: (stop - start) / minute }]
    })
  const fixed = applyFixedBlocks(valid, capacity, blocks, input.now)
  issues.push(...fixed.conflicts)
  const undatedKeys = new Set(undated.map((d) => d.key))
  const covered = fixed.remaining_demands.filter(
    (d) => undatedKeys.has(d.key) && d.remaining_minutes === 0,
  )
  issues = issues.filter(
    (i) =>
      !(
        i.code === 'missing_deadline' &&
        covered.some(
          (d) =>
            i.affected_keys.includes(d.key) ||
            (d.task_id !== null && i.affected_keys.includes(d.task_id)),
        )
      ),
  )
  for (const d of fixed.remaining_demands)
    if (undatedKeys.has(d.key) && d.remaining_minutes > 0)
      issues.push({
        code: 'undated_uncovered',
        affected_keys: [d.key],
        detail: `${d.remaining_minutes} 分钟待设截止或固定安排`,
      })
  if (
    policy === 'regular_only' &&
    fixed.accepted_allocations.some((a) => a.kind === 'weekend_reserve')
  )
    issues.push({
      code: 'fixed_weekend_commitment',
      affected_keys: fixed.accepted_allocations
        .filter((a) => a.kind === 'weekend_reserve')
        .map((a) => a.demand_key),
      detail: '已有周末固定安排，需调整后才能比较纯常规方案',
    })
  return {
    all: valid,
    demands: fixed.remaining_demands.filter((d) => !undatedKeys.has(d.key)),
    capacity: fixed.remaining_capacity.filter(
      (c) => policy === 'allow_weekend' || c.kind === 'regular',
    ),
    fixed: fixed.accepted_allocations,
    issues,
    policy,
    now: input.now,
    previous: input.previous_allocations,
    known:
      issues.every((i) => i.code === 'fixed_release_suggested') &&
      valid.every((d) => d.certainty !== 'incomplete'),
  }
}
export type PreparedCapacity = ReturnType<typeof prepareCapacity>
export const runPrepared = (p: PreparedCapacity) => allocateFlow(p.demands, p.capacity, p.previous)
export const feasiblePrepared = (p: PreparedCapacity) =>
  p.known && runPrepared(p).total === p.demands.reduce((n, d) => n + d.remaining_minutes, 0)
/** Conflict groups are connected components of the demand/legal-capacity graph containing
 * a shortfall. They describe competition, not an assertion that each member must fail. */
function conflictGroups(
  p: PreparedCapacity,
  allocations: PlanningResult['allocations'],
): ConflictGroup[] {
  const pending = new Set(p.demands.filter((d) => d.remaining_minutes > 0).map((d) => d.key)),
    groups: ConflictGroup[] = []
  const legal = (d: TaskDemand, c: PreparedCapacity['capacity'][number]) =>
    Math.max(Date.parse(d.release_at), Date.parse(c.start)) + minute <=
    Math.min(Date.parse(d.due_at), Date.parse(c.end))
  while (pending.size) {
    const keys = new Set([pending.values().next().value as string])
    let change = true
    while (change) {
      change = false
      for (const c of p.capacity)
        if (p.demands.some((d) => keys.has(d.key) && legal(d, c)))
          for (const d of p.demands)
            if (pending.has(d.key) && !keys.has(d.key) && legal(d, c)) {
              keys.add(d.key)
              change = true
            }
    }
    const members = p.demands.filter((d) => keys.has(d.key))
    members.forEach((d) => pending.delete(d.key))
    const missing = members.reduce(
      (n, d) =>
        n +
        d.remaining_minutes -
        allocations
          .filter((a) => !a.fixed && a.demand_key === d.key)
          .reduce((s, a) => s + a.minutes, 0),
      0,
    )
    if (missing > 0)
      groups.push({
        demand_keys: [...keys].sort(),
        course_ids: [...new Set(members.flatMap((d) => (d.course_id ? [d.course_id] : [])))].sort(),
        missing_minutes: missing,
      })
  }
  return groups
}
export function solveCapacity(input: PlanningInput, policy: CapacityPolicy): PlanningResult {
  const p = prepareCapacity(input, policy),
    flow = runPrepared(p),
    allocations = [...p.fixed, ...flow.allocations].sort(
      (a, b) =>
        Date.parse(a.start) - Date.parse(b.start) || a.demand_key.localeCompare(b.demand_key),
    )
  const feasible = p.known && flow.total === p.demands.reduce((n, d) => n + d.remaining_minutes, 0)
  const metrics = batchMetrics(p, allocations, feasible)
  return {
    input_revision: input.input_revision,
    computed_at: input.now,
    horizon_end: input.horizon_end,
    allocations,
    batch_metrics: metrics,
    conflict_groups: conflictGroups(p, allocations),
    issues: p.issues,
    complete: p.known,
    policy,
    feasible,
    total_remaining_minutes: p.all.reduce((n, d) => n + d.remaining_minutes, 0),
    total_unallocated_minutes: Object.values(metrics).reduce(
      (n, m) => n + m.unallocated_minutes,
      0,
    ),
    total_weekend_minutes: allocations
      .filter((a) => a.kind === 'weekend_reserve')
      .reduce((n, a) => n + a.minutes, 0),
    today_required_minutes: feasible ? todayPrepared(p, null) : null,
    issue_groups: {
      advisory: p.issues.filter((i) => i.code === 'fixed_release_suggested'),
      hard_conflicts: p.issues.filter(
        (i) => i.code.startsWith('fixed_') && i.code !== 'fixed_release_suggested',
      ),
      incomplete: p.issues.filter((i) => !i.code.startsWith('fixed_')),
    },
  }
}
export function solveCapacityPolicies(input: PlanningInput) {
  return {
    regular_only: solveCapacity(input, 'regular_only'),
    allow_weekend: solveCapacity(input, 'allow_weekend'),
  }
}
export function computeBatchHeadroom(
  input: PlanningInput,
  batchKey: string,
  policy: CapacityPolicy,
): number | null {
  const p = prepareCapacity(input, policy)
  return feasiblePrepared(p) ? headroomPrepared(p, batchKey) : null
}
/** Default recommendation includes explicitly configured reserve. Fixed commitments count. */
export function computeTodayRequired(input: PlanningInput, batchKey: string | null): number | null {
  const p = prepareCapacity(input, 'allow_weekend')
  return feasiblePrepared(p) ? todayPrepared(p, batchKey) : null
}
