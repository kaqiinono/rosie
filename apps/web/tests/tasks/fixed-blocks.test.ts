import { expect, it } from 'vitest'
import { applyFixedBlocks } from '../../../../packages/tasks/src/planning/fixedBlocks'
import type { CapacityInterval, TaskDemand } from '../../../../packages/tasks/src/planning/types'
const t = (clock: string) => `2026-10-30T${clock}:00Z`
const cap: CapacityInterval[] = [
  { key: 'c', start: t('10:00'), end: t('12:00'), minutes: 120, kind: 'regular' },
]
const demand = (n = 60): TaskDemand => ({
  key: 'd',
  task_id: 't',
  course_id: null,
  batch_key: 'batch',
  origin: 'actual',
  release_at: t('10:00'),
  due_at: t('12:00'),
  remaining_minutes: n,
  priority: 0,
  certainty: 'confirmed',
  source_revision: 1,
})
const block = (id = 'b', start = '10:00', end = '11:00') => ({
  id,
  user_id: 'u',
  task_id: 't',
  starts_at: t(start),
  ends_at: t(end),
})
it('now inside only credits future work, never elapsed completion', () => {
  const r = applyFixedBlocks([demand()], cap, [block()], t('10:30'))
  expect(r.remaining_demands[0].remaining_minutes).toBe(30)
  expect(r.accepted_allocations[0].minutes).toBe(30)
  expect(r.remaining_capacity.reduce((n, c) => n + c.minutes, 0)).toBe(60)
})
it('completed and excess reservations remain occupied, with release warnings', () => {
  const r = applyFixedBlocks([demand(10)], cap, [block()], t('10:00'))
  expect(r.accepted_allocations[0].minutes).toBe(10)
  expect(r.remaining_capacity[0].minutes).toBe(60)
  expect(r.conflicts.some((c) => c.code === 'fixed_release_suggested')).toBe(true)
  expect(applyFixedBlocks([], cap, [block()], t('10:00')).remaining_capacity[0].minutes).toBe(60)
})
it('overlapping blocks reserve union once and neither conflict credits demand', () => {
  const r = applyFixedBlocks([demand()], cap, [block(), block('b2', '10:30', '11:30')], t('10:00'))
  expect(r.accepted_allocations).toEqual([])
  expect(r.remaining_demands[0].remaining_minutes).toBe(60)
  expect(r.remaining_capacity[0].minutes).toBe(30)
  expect(r.conflicts.some((c) => c.code === 'fixed_overlap')).toBe(true)
})
it('expired, outside-capacity and task-window conflicts remain explicit', () => {
  expect(applyFixedBlocks([demand()], cap, [block()], t('11:30')).conflicts[0].code).toBe(
    'fixed_expired',
  )
  expect(
    applyFixedBlocks([demand()], cap, [block('b', '09:30', '10:30')], t('09:00')).conflicts.some(
      (c) => c.code === 'fixed_outside_capacity',
    ),
  ).toBe(true)
  const d = demand()
  d.release_at = t('10:30')
  expect(
    applyFixedBlocks([d], cap, [block()], t('10:00')).conflicts.some(
      (c) => c.code === 'fixed_task_window',
    ),
  ).toBe(true)
})
it('seconds consume touched minutes but never credit phantom useful minutes', () => {
  const b = { ...block(), starts_at: '2026-10-30T10:00:01Z', ends_at: '2026-10-30T10:30:59Z' }
  const r = applyFixedBlocks([demand()], cap, [b], t('10:00'))
  expect(r.accepted_allocations[0].minutes).toBe(29)
  expect(r.remaining_capacity[0].minutes).toBe(89)
})

it('multiple retained blocks deduct remaining work at most once without mutating source input', () => {
  const d = demand(45)
  const r = applyFixedBlocks(
    [d],
    cap,
    [block('a', '10:00', '10:30'), block('b', '10:30', '11:00')],
    t('10:00'),
  )
  expect(r.accepted_allocations.reduce((n, a) => n + a.minutes, 0)).toBe(45)
  expect(r.remaining_demands[0].remaining_minutes).toBe(0)
  expect(r.remaining_capacity[0].minutes).toBe(60)
  expect(d.remaining_minutes).toBe(45)
})
it('seconds in now are rounded up and release/deadline violations never count as useful allocation', () => {
  const r = applyFixedBlocks([demand()], cap, [block()], '2026-10-30T10:30:01Z')
  expect(r.accepted_allocations[0].minutes).toBe(29)
  expect(r.remaining_demands[0].remaining_minutes).toBe(31)
  const d = demand()
  d.due_at = t('10:30')
  expect(applyFixedBlocks([d], cap, [block()], t('10:00')).accepted_allocations).toEqual([])
})
