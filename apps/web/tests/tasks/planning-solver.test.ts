import { expect, it } from 'vitest'
import { solveCapacity } from '../../../../packages/tasks/src/planning'
import { at, capacity, demand, input, sample } from './fixtures/planning'
it('solves the reviewed 90 / 30 / 90 example globally', () => {
  const i = sample()
  const r = solveCapacity(i, 'allow_weekend')
  expect(
    r.allocations.reduce((n, a) => n + (a.kind === 'weekend_reserve' ? a.minutes : 0), 0),
  ).toBe(90)
  expect(Object.values(r.batch_metrics).reduce((n, m) => n + m.unallocated_minutes, 0)).toBe(0)
  i.capacity[0] = capacity('2026-10-29', '18:00', '20:00')
  expect(
    solveCapacity(i, 'allow_weekend')
      .allocations.filter((a) => a.kind === 'weekend_reserve')
      .reduce((n, a) => n + a.minutes, 0),
  ).toBe(30)
  expect(
    Object.values(solveCapacity(sample(), 'regular_only').batch_metrics).reduce(
      (n, m) => n + m.unallocated_minutes,
      0,
    ),
  ).toBe(90)
})
it('enforces windows and exclusive minutes; reroutes flexible work for restricted future work', () => {
  const i = input(
    [demand('a', 60), demand('b', 60, at('2026-11-02', '19:00'))],
    [capacity('2026-10-29', '18:00', '19:00'), capacity('2026-11-02', '19:00', '20:00')],
  )
  const r = solveCapacity(i, 'allow_weekend')
  expect(r.allocations.reduce((n, a) => n + a.minutes, 0)).toBe(120)
  const sorted = [...r.allocations].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  sorted.forEach((a, j) => {
    const d = i.demands.find((d) => d.key === a.demand_key)!
    expect(Date.parse(a.start)).toBeGreaterThanOrEqual(Date.parse(d.release_at))
    expect(Date.parse(a.end)).toBeLessThanOrEqual(Date.parse(d.due_at))
    if (j) expect(Date.parse(a.start)).toBeGreaterThanOrEqual(Date.parse(sorted[j - 1].end))
  })
})
it('uses later Monday before nearer reserve Saturday and rejects unusable capacity', () => {
  const i = input(
    [demand('a', 60, at('2026-10-30'), at('2026-11-03'))],
    [
      capacity('2026-10-29', '18:00', '19:00'),
      capacity('2026-10-31', '10:00', '11:00', 'weekend_reserve'),
      capacity('2026-11-02', '19:00', '20:00'),
      capacity('2026-11-04', '19:00', '20:00'),
    ],
  )
  expect(solveCapacity(i, 'allow_weekend').allocations[0].start).toBe(at('2026-11-02', '19:00'))
})
it('protects earlier deadlines then explicit priority before reserve optimization', () => {
  const i = input(
    [
      demand('late', 60),
      { ...demand('early', 60, undefined, at('2026-10-30')), priority: 1 },
      { ...demand('priority', 60, undefined, at('2026-10-30')), priority: 2 },
    ],
    [capacity('2026-10-29', '18:00', '19:00')],
  )
  const r = solveCapacity(i, 'allow_weekend')
  expect(r.batch_metrics.priority.unallocated_minutes).toBe(0)
  expect(r.conflict_groups[0].course_ids.sort()).toEqual(['early', 'late', 'priority'])
})
it('deducts fixed and undated commitments once; excess advisory is safe, uncovered is unknown', () => {
  const i = input([demand('a', 30)], [capacity('2026-10-29', '18:00', '19:00')])
  i.fixed_blocks = [
    {
      id: 'f',
      user_id: 'u',
      task_id: 'a',
      starts_at: at('2026-10-29'),
      ends_at: at('2026-10-29', '18:40'),
    },
  ]
  const r = solveCapacity(i, 'allow_weekend')
  expect(r.allocations.reduce((n, a) => n + a.minutes, 0)).toBe(30)
  expect(r.complete).toBe(true)
  i.demands = []
  i.undated_work = [
    {
      key: 'a',
      task_id: 'a',
      course_id: 'a',
      origin: 'actual',
      release_at: i.now,
      remaining_minutes: 40,
      commitment_blocks: i.fixed_blocks,
    },
  ]
  expect(solveCapacity(i, 'allow_weekend').complete).toBe(true)
  i.undated_work[0].remaining_minutes = 50
  expect(solveCapacity(i, 'allow_weekend').complete).toBe(false)
})
it('retains fixed weekend commitments in regular-only with a known policy conflict', () => {
  const i = input(
    [demand('a', 30)],
    [
      capacity('2026-10-29', '18:00', '19:00'),
      capacity('2026-10-31', '10:00', '11:00', 'weekend_reserve'),
    ],
  )
  i.fixed_blocks = [
    {
      id: 'f',
      task_id: 'a',
      user_id: 'u',
      starts_at: at('2026-10-31', '10:00'),
      ends_at: at('2026-10-31', '10:30'),
    },
  ]
  const r = solveCapacity(i, 'regular_only')
  expect(r.feasible).toBe(false)
  expect(r.batch_metrics.a.status).toBe('adjustment_required')
  expect(r.total_weekend_minutes).toBe(30)
  expect(r.batch_metrics.a.extra_capacity_minutes).toBeNull()
  expect(solveCapacity(i, 'allow_weekend').feasible).toBe(true)
})
it('recognizes builder missing-deadline issues resolved by full undated fixed commitment only', () => {
  const i = input([], [capacity('2026-10-29', '18:00', '19:00')])
  const block = {
    id: 'f',
    task_id: 'a',
    user_id: 'u',
    starts_at: i.now,
    ends_at: at('2026-10-29', '18:30'),
  }
  i.undated_work = [
    {
      key: 'source-a',
      task_id: 'a',
      course_id: null,
      origin: 'actual',
      release_at: i.now,
      remaining_minutes: 30,
      commitment_blocks: [block],
    },
  ]
  i.fixed_blocks = [block]
  i.configuration_issues = [{ code: 'missing_deadline', affected_keys: ['a'], detail: 'missing' }]
  const r = solveCapacity(i, 'allow_weekend')
  expect(r.complete).toBe(true)
  expect(r.allocations).toHaveLength(1)
  expect(r.today_required_minutes).toBe(30)
  expect(r.batch_metrics['source-a'].extra_capacity_minutes).toBeNull()
  i.configuration_issues.push({ code: 'material_pending', affected_keys: ['a'], detail: '' })
  expect(solveCapacity(i, 'allow_weekend').complete).toBe(false)
})
it('preserves prior legal prediction after reserve minimization, before nearer allocation', () => {
  const i = input([demand('a', 30)], [capacity('2026-10-29', '18:00', '19:00')])
  i.previous_allocations = [
    {
      demand_key: 'a',
      start: at('2026-10-29', '18:30'),
      end: at('2026-10-29', '19:00'),
      minutes: 30,
      kind: 'regular',
      fixed: false,
    },
  ]
  expect(solveCapacity(i, 'allow_weekend').allocations[0].start).toBe(at('2026-10-29', '18:30'))
})
it('does not invent minutes at second boundaries', () => {
  const i = input(
    [demand('a', 60, '2026-10-29T10:00:01Z', '2026-10-29T10:59:59Z')],
    [capacity('2026-10-29', '18:00', '19:00')],
  )
  const r = solveCapacity(i, 'allow_weekend')
  expect(r.total_unallocated_minutes).toBe(2)
  expect(r.allocations[0].minutes).toBe(58)
})
it('undated fixed work before release remains uncovered and conflicted, never movable', () => {
  const i = input([], [capacity('2026-10-29', '18:00', '19:00')])
  const block = {
    id: 'f',
    user_id: 'u',
    task_id: 'a',
    starts_at: i.now,
    ends_at: at('2026-10-29', '18:30'),
  }
  i.fixed_blocks = [block]
  i.undated_work = [
    {
      key: 'a',
      task_id: 'a',
      course_id: null,
      origin: 'actual',
      release_at: at('2026-10-29', '18:20'),
      remaining_minutes: 30,
      commitment_blocks: [block],
    },
  ]
  const original = JSON.stringify(i),
    r = solveCapacity(i, 'allow_weekend')
  expect(r.allocations).toEqual([])
  expect(r.batch_metrics.a.unallocated_minutes).toBe(30)
  expect(r.batch_metrics.a.fixed_only).toBe(true)
  expect(r.complete).toBe(false)
  expect(JSON.stringify(i)).toBe(original)
})
