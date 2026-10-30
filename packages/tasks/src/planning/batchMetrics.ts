import { allocateFlow } from './flowNetwork'
import type { PreparedCapacity } from './solveCapacity'
import type { BatchMetrics, TaskAllocation } from './types'
import { minute } from './intervals'
const sum = (allocations: TaskAllocation[]) => allocations.reduce((n, a) => n + a.minutes, 0)
export function headroomPrepared(p: PreparedCapacity, batch: string): number | null {
  const demands = p.demands.filter((d) => d.batch_key === batch)
  if (!demands.length) return null // undated commitments have no movable execution window
  const d = demands[0]
  if (
    demands.some(
      (x) =>
        Date.parse(x.release_at) !== Date.parse(d.release_at) ||
        Date.parse(x.due_at) !== Date.parse(d.due_at),
    )
  )
    return null
  const total = p.demands.reduce((n, d) => n + d.remaining_minutes, 0)
  let low = 0,
    high = p.capacity.reduce((n, c) => n + c.minutes, 0) - total
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    const candidate = p.demands.map((x) =>
      x === d ? { ...x, remaining_minutes: x.remaining_minutes + mid } : x,
    )
    if (allocateFlow(candidate, p.capacity).total === total + mid) low = mid
    else high = mid - 1
  }
  return low
}
export function todayPrepared(p: PreparedCapacity, batch: string | null): number | null {
  if (batch !== null && !p.all.some((d) => d.batch_key === batch)) return null
  const offset = 8 * 60 * minute,
    day = 24 * 60 * minute,
    start = Math.floor((Date.parse(p.now) + offset) / day) * day - offset,
    end = start + day
  const allocations = allocateFlow(p.demands, p.capacity, [], {
    kind: 'today',
    start,
    end,
    batch,
  }).allocations
  const keys = new Set(
    p.all.filter((d) => batch === null || d.batch_key === batch).map((d) => d.key),
  )
  return [...p.fixed, ...allocations]
    .filter((a) => keys.has(a.demand_key))
    .reduce(
      (n, a) =>
        n +
        Math.max(0, Math.min(end, Date.parse(a.end)) - Math.max(start, Date.parse(a.start))) /
          minute,
      0,
    )
}
export function batchMetrics(
  p: PreparedCapacity,
  allocations: TaskAllocation[],
  feasible: boolean,
): Record<string, BatchMetrics> {
  return Object.fromEntries(
    [...new Set(p.all.map((d) => d.batch_key))].sort().map((key) => {
      const demands = p.all.filter((d) => d.batch_key === key),
        keys = new Set(demands.map((d) => d.key)),
        assigned = allocations.filter((a) => keys.has(a.demand_key))
      const remaining = demands.reduce((n, d) => n + d.remaining_minutes, 0),
        missing = remaining - sum(assigned),
        weekend = sum(assigned.filter((a) => a.kind === 'weekend_reserve')),
        headroom = feasible ? headroomPrepared(p, key) : null
      const hard = p.issues.some(
        (i) => i.code.startsWith('fixed_') && i.code !== 'fixed_release_suggested',
      )
      const certainty =
        demands.some((d) => d.certainty === 'incomplete') ||
        p.issues.some((i) => !i.code.startsWith('fixed_'))
          ? 'incomplete'
          : demands.some((d) => d.certainty === 'estimated')
            ? 'estimated'
            : 'confirmed'
      const status = hard
        ? 'adjustment_required'
        : !p.known
          ? 'incomplete'
          : missing > 0
            ? 'insufficient'
            : remaining === 0
              ? 'completed'
              : weekend > 0
                ? 'weekend_required'
                : headroom !== null && headroom <= remaining * 0.2
                  ? 'tight'
                  : 'weekday_feasible'
      return [
        key,
        {
          fixed_only: demands.every((d) => d.deadline_source === 'missing'),
          remaining_minutes: remaining,
          weekday_minutes: sum(assigned.filter((a) => a.kind === 'regular')),
          weekend_minutes: weekend,
          unallocated_minutes: missing,
          finish_at:
            missing === 0 && assigned.length
              ? assigned.reduce(
                  (last, a) => (Date.parse(a.end) > Date.parse(last) ? a.end : last),
                  assigned[0].end,
                )
              : null,
          extra_capacity_minutes: headroom,
          today_required_minutes: feasible ? todayPrepared(p, key) : null,
          status,
          certainty,
        } satisfies BatchMetrics,
      ]
    }),
  )
}
