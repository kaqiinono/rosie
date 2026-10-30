import { expect, it } from 'vitest'
import {
  computeBatchHeadroom,
  computeTodayRequired,
  solveCapacity,
} from '../../../../packages/tasks/src/planning'
import { capacity, demand, input } from './fixtures/planning'
it('independent minima differ from the global minimum and do not sum headroom', () => {
  const i = input(
    [demand('a', 60), demand('b', 60)],
    [capacity('2026-10-29', '18:00', '19:00'), capacity('2026-11-02', '19:00', '20:00')],
  )
  expect(computeTodayRequired(i, null)).toBe(60)
  expect(computeTodayRequired(i, 'a')).toBe(0)
  expect(computeTodayRequired(i, 'b')).toBe(0)
  expect(computeBatchHeadroom(i, 'a', 'allow_weekend')).toBe(0)
  i.capacity[1] = capacity('2026-11-02', '19:00', '21:00')
  expect(computeBatchHeadroom(i, 'a', 'allow_weekend')).toBe(60)
  expect(computeBatchHeadroom(i, 'b', 'allow_weekend')).toBe(60)
})
it('returns unknown for infeasible, incomplete and hard fixed conflicts', () => {
  const i = input([demand('a', 90)], [capacity('2026-10-29', '18:00', '19:00')])
  expect(computeTodayRequired(i, null)).toBeNull()
  expect(computeBatchHeadroom(i, 'a', 'allow_weekend')).toBeNull()
  i.demands[0].remaining_minutes = 20
  i.configuration_issues = [{ code: 'missing', affected_keys: [], detail: '' }]
  expect(computeTodayRequired(i, null)).toBeNull()
})

// Independent oracle enumerates each minute's owner (idle/A/B), not flow paths.
// 6 possible contiguous windows per demand × 2 demands × 2 sizes each × 8
// reserve masks = 1152 instances; 27 assignments each, including idle choices.
it('matches exhaustive minute ownership oracle for all objective tiers and today minima', () => {
  const clocks = ['2026-10-29T10:00:00Z', '2026-10-30T10:00:00Z', '2026-10-31T10:00:00Z']
  const ranges: number[][] = []
  for (let a = 0; a < 3; a++) for (let b = a; b < 3; b++) ranges.push([a, b])
  const compare = (a: number[], b: number[]) => {
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] - b[k]
    return 0
  }
  for (const [a, b] of ranges)
    for (const [c, d] of ranges)
      for (const n of [1, 2])
        for (const m of [1, 2])
          for (let mask = 0; mask < 8; mask++) {
            const ends = clocks.map((t) => new Date(Date.parse(t) + 60000).toISOString())
            const ds = [
              demand('a', n, clocks[a], ends[b]),
              { ...demand('b', m, clocks[c], ends[d]), priority: 1 },
            ]
            const caps = clocks.map((t, j) => ({
              key: String(j),
              start: t,
              end: ends[j],
              minutes: 1,
              kind: (mask & (1 << j) ? 'weekend_reserve' : 'regular') as
                | 'regular'
                | 'weekend_reserve',
            }))
            const i = input(ds, caps)
            i.previous_allocations = [
              {
                demand_key: 'a',
                start: clocks[2],
                end: ends[2],
                minutes: 1,
                kind: caps[2].kind,
                fixed: false,
              },
            ]
            const order = [0, 1].sort(
              (x, y) =>
                Date.parse(ds[x].due_at) - Date.parse(ds[y].due_at) ||
                ds[y].priority - ds[x].priority,
            )
            const legalCounts: number[][] = []
            const candidates: { owner: number[]; counts: number[]; score: number[] }[] = []
            for (let code = 0; code < 27; code++) {
              let v = code
              const owner = clocks.map(() => {
                  const x = (v % 3) - 1
                  v = Math.floor(v / 3)
                  return x
                }),
                counts = [0, 0]
              let legal = true,
                weekend = 0,
                stable = 0,
                near = 0
              owner.forEach((x, j) => {
                if (x < 0) return
                counts[x]++
                if (
                  Date.parse(clocks[j]) < Date.parse(ds[x].release_at) ||
                  Date.parse(ends[j]) > Date.parse(ds[x].due_at)
                )
                  legal = false
                if (caps[j].kind === 'weekend_reserve') weekend++
                if (x === 0 && j === 2) stable++
                near += j
              })
              if (legal) legalCounts.push(counts)
              if (!legal || counts[0] > n || counts[1] > m) continue
              candidates.push({
                owner,
                counts,
                score: [
                  -counts[0] - counts[1],
                  ...order.map((x) => -counts[x]),
                  weekend,
                  -stable,
                  near,
                ],
              })
            }
            candidates.sort((x, y) => compare(x.score, y.score))
            const best = candidates[0]
            const r = solveCapacity(i, 'allow_weekend'),
              counts = ds.map((x) =>
                r.allocations
                  .filter((a) => a.demand_key === x.key)
                  .reduce((s, a) => s + a.minutes, 0),
              )
            const score = [
              -counts[0] - counts[1],
              ...order.map((x) => -counts[x]),
              r.total_weekend_minutes!,
              -r.allocations.filter(
                (x) => x.demand_key === 'a' && Date.parse(x.start) === Date.parse(clocks[2]),
              ).length,
              r.allocations.reduce(
                (s, x) =>
                  s + clocks.findIndex((t) => Date.parse(t) === Date.parse(x.start)) * x.minutes,
                0,
              ),
            ]
            expect(score).toEqual(best.score)
            const full = candidates.filter((x) => x.counts[0] === n && x.counts[1] === m)
            expect(computeTodayRequired(i, null)).toBe(
              full.length ? Math.min(...full.map((x) => Number(x.owner[0] >= 0))) : null,
            )
            for (let k = 0; k < 2; k++) {
              expect(computeBatchHeadroom(i, ds[k].key, 'allow_weekend')).toBe(
                full.length
                  ? Math.max(
                      ...legalCounts
                        .filter((x) => x[1 - k] === ds[1 - k].remaining_minutes)
                        .map((x) => x[k]),
                    ) - ds[k].remaining_minutes
                  : null,
              )
              expect(computeTodayRequired(i, ds[k].key)).toBe(
                full.length ? Math.min(...full.map((x) => Number(x.owner[0] === k))) : null,
              )
            }
          }
}, 30000)
it('hard overlapping fixed conflicts suppress all counterfactual safety metrics', () => {
  const i = input([demand('a', 30), demand('b', 30)], [capacity('2026-10-29', '18:00', '19:00')])
  i.fixed_blocks = ['a', 'b'].map((task_id) => ({
    id: task_id,
    user_id: 'u',
    task_id,
    starts_at: i.now,
    ends_at: '2026-10-29T10:30:00Z',
  }))
  expect(computeTodayRequired(i, null)).toBeNull()
  expect(computeBatchHeadroom(i, 'a', 'allow_weekend')).toBeNull()
  expect(
    solveCapacity(i, 'allow_weekend').issue_groups?.hard_conflicts.some(
      (x) => x.code === 'fixed_overlap',
    ),
  ).toBe(true)
})
it('today minima include fixed useful minutes and use Shanghai midnight', () => {
  const i = input([demand('a', 30)], [capacity('2026-10-29', '18:00', '19:00')])
  i.fixed_blocks = [
    { id: 'a', user_id: 'u', task_id: 'a', starts_at: i.now, ends_at: '2026-10-29T10:20:00Z' },
  ]
  i.capacity.push(capacity('2026-10-30', '00:00', '01:00'))
  expect(computeTodayRequired(i, null)).toBe(20)
  expect(computeTodayRequired(i, 'a')).toBe(20)
})
