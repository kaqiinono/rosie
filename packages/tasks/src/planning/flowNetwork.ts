import { iso, minute } from './intervals'
import type { CapacityInterval, TaskAllocation, TaskDemand } from './types'

export type FlowObjective =
  | { kind: 'plan' }
  | { kind: 'today'; start: number; end: number; batch: string | null }
type Edge = { to: number; reverse: number; capacity: number; initial: number; cost: number[] }
const less = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}
/** Exact lexicographic successive shortest augmenting paths. Costs are vectors, never
 * scalar big-M weights. Bellman-Ford permits negative reverse edges and global rerouting.
 * Integral edge capacities imply integral allocations; augmentations use bottlenecks,
 * not minute nodes. Complexity O(F V E K), F <= total requested integer minutes,
 * K = number of deadline/priority tiers + 3. Typical augmentations saturate whole slices.
 */
export function allocateFlow(
  demands: TaskDemand[],
  capacity: CapacityInterval[],
  previous: TaskAllocation[] = [],
  objective: FlowObjective = { kind: 'plan' },
) {
  const ordered = [...demands].sort(
    (a, b) =>
      Date.parse(a.due_at) - Date.parse(b.due_at) ||
      b.priority - a.priority ||
      a.key.localeCompare(b.key),
  )
  const tiers = [...new Set(ordered.map((d) => `${Date.parse(d.due_at)}:${d.priority}`))]
  const dimensions = objective.kind === 'plan' ? tiers.length + 3 : 1
  const zero = () => Array<number>(dimensions).fill(0)
  const boundaries = new Set<number>()
  ordered.forEach((d) => {
    boundaries.add(Math.ceil(Date.parse(d.release_at) / minute) * minute)
    boundaries.add(Math.floor(Date.parse(d.due_at) / minute) * minute)
  })
  previous.forEach((a) => {
    boundaries.add(Math.ceil(Date.parse(a.start) / minute) * minute)
    boundaries.add(Math.floor(Date.parse(a.end) / minute) * minute)
  })
  if (objective.kind === 'today') {
    boundaries.add(objective.start)
    boundaries.add(objective.end)
  }
  const cuts = [...boundaries].sort((a, b) => a - b)
  const slices = capacity
    .flatMap((c) => {
      const start = Math.ceil(Date.parse(c.start) / minute) * minute,
        end = Math.floor(Date.parse(c.end) / minute) * minute
      const points = [start, ...cuts.filter((t) => t > start && t < end), end]
      return points
        .slice(1)
        .map((e, i) => ({ ...c, start: points[i], end: e, minutes: (e - points[i]) / minute }))
        .filter((s) => s.minutes > 0)
    })
    .sort((a, b) => a.start - b.start || a.key.localeCompare(b.key))
  const sink = 1 + ordered.length + slices.length,
    graph: Edge[][] = Array.from({ length: sink + 1 }, () => [])
  function edge(from: number, to: number, cap: number, cost: number[]) {
    const forward: Edge = { to, reverse: graph[to].length, capacity: cap, initial: cap, cost }
    graph[from].push(forward)
    graph[to].push({
      to: from,
      reverse: graph[from].length - 1,
      capacity: 0,
      initial: 0,
      cost: cost.map((n) => -n),
    })
    return forward
  }
  const assignments: { d: TaskDemand; s: number; e: Edge; stable: boolean }[] = []
  ordered.forEach((d, i) => {
    const c = zero()
    if (objective.kind === 'plan') c[tiers.indexOf(`${Date.parse(d.due_at)}:${d.priority}`)] = -1
    edge(0, 1 + i, d.remaining_minutes, c)
    slices.forEach((s, j) => {
      if (s.start < Date.parse(d.release_at) || s.end > Date.parse(d.due_at)) return
      const c = zero(),
        stable = previous.some(
          (a) =>
            !a.fixed &&
            a.demand_key === d.key &&
            Date.parse(a.start) <= s.start &&
            Date.parse(a.end) >= s.end,
        )
      if (objective.kind === 'plan') {
        c[tiers.length] = s.kind === 'weekend_reserve' ? 1 : 0
        c[tiers.length + 1] = stable ? -1 : 0
        c[tiers.length + 2] = j
      } else
        c[0] =
          s.start >= objective.start &&
          s.end <= objective.end &&
          (objective.batch === null || objective.batch === d.batch_key)
            ? 1
            : 0
      assignments.push({ d, s: j, e: edge(1 + i, 1 + ordered.length + j, s.minutes, c), stable })
    })
  })
  slices.forEach((s, j) => edge(1 + ordered.length + j, sink, s.minutes, zero()))
  let total = 0
  while (true) {
    const dist: (number[] | null)[] = Array(graph.length).fill(null),
      parent: { node: number; index: number }[] = Array(graph.length)
    dist[0] = zero()
    for (let pass = 0; pass < graph.length - 1; pass++) {
      let changed = false
      graph.forEach((edges, node) => {
        const base = dist[node]
        if (!base) return
        edges.forEach((e, index) => {
          if (e.capacity <= 0) return
          const candidate = base.map((n, k) => n + e.cost[k])
          if (dist[e.to] === null || less(candidate, dist[e.to]!)) {
            dist[e.to] = candidate
            parent[e.to] = { node, index }
            changed = true
          }
        })
      })
      if (!changed) break
    }
    if (dist[sink] === null) break
    let amount = Infinity
    for (let v = sink; v !== 0; v = parent[v].node) {
      const p = parent[v]
      amount = Math.min(amount, graph[p.node][p.index].capacity)
    }
    for (let v = sink; v !== 0; v = parent[v].node) {
      const p = parent[v],
        e = graph[p.node][p.index]
      e.capacity -= amount
      graph[v][e.reverse].capacity += amount
    }
    total += amount
  }
  const allocations: TaskAllocation[] = []
  slices.forEach((s, j) => {
    let cursor = s.start
    for (const a of assignments
      .filter((a) => a.s === j)
      .sort((a, b) => Number(b.stable) - Number(a.stable) || a.d.key.localeCompare(b.d.key))) {
      const n = a.e.initial - a.e.capacity
      if (!n) continue
      allocations.push({
        demand_key: a.d.key,
        start: iso(cursor),
        end: iso(cursor + n * minute),
        minutes: n,
        kind: s.kind,
        fixed: false,
      })
      cursor += n * minute
    }
  })
  return { total, allocations }
}
