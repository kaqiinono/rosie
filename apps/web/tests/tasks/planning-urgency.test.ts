import { expect, it } from 'vitest'
import { computeExecutionUrgency } from '../../../../packages/tasks/src/planning/solveCapacity'
import { at, capacity, demand, input } from './fixtures/planning'
const day = '2026-10-29'
const example = () => {
  const i = input(
    [demand('a', 90, at(day, '09:00'), at(day, '19:00'))],
    [capacity(day, '09:00', '10:00'), capacity(day, '18:00', '19:00')],
  )
  i.now = at(day, '08:30')
  return i
}
it('uses the inclusive minute boundary across gaps without changing the input', () => {
  const i = example(),
    before = JSON.stringify(i)
  expect(computeExecutionUrgency(i, at(day, '09:29'))).toEqual({
    global: false,
    batches: { a: false },
  })
  expect(computeExecutionUrgency(i, at(day, '09:30'))).toEqual({
    global: true,
    batches: { a: true },
  })
  expect(JSON.stringify(i)).toBe(before)
})
it('keeps useful fixed commitments immovable and excess reservations non-obligating', () => {
  const i = example()
  i.demands[0].remaining_minutes = 30
  i.fixed_blocks = [
    {
      id: 'fixed',
      user_id: 'u',
      task_id: 'a',
      starts_at: at(day, '09:00'),
      ends_at: at(day, '10:00'),
    },
  ]
  expect(computeExecutionUrgency(i, at(day, '09:00'))).toEqual({
    global: true,
    batches: { a: true },
  })
  // Completed task's retained reservation consumes time but does not require execution.
  i.demands[0].remaining_minutes = 0
  expect(computeExecutionUrgency(i, at(day, '09:00'))).toEqual({
    global: null,
    batches: { a: null },
  })
})
it('retains other batches release/deadline constraints while postponing only one batch', () => {
  const i = example()
  i.capacity[0] = capacity(day, '09:00', '11:00')
  i.demands.push(demand('b', 60, at(day, '10:00'), at(day, '11:00')))
  expect(computeExecutionUrgency(i, at(day, '09:30'))).toEqual({
    global: true,
    batches: { a: true, b: false },
  })
})
it('returns unknown when the baseline is infeasible, incomplete, or has a fixed conflict', () => {
  const i = example()
  i.demands[0].remaining_minutes = 121
  expect(computeExecutionUrgency(i, at(day, '09:30'))).toEqual({
    global: null,
    batches: { a: null },
  })
  i.demands[0].remaining_minutes = 30
  i.configuration_issues = [{ code: 'material_pending', affected_keys: ['a'], detail: '' }]
  expect(computeExecutionUrgency(i, at(day, '09:30')).global).toBeNull()
  i.configuration_issues = []
  i.fixed_blocks = [
    {
      id: 'invalid',
      user_id: 'u',
      task_id: 'a',
      starts_at: at(day, '12:00'),
      ends_at: at(day, '13:00'),
    },
  ]
  expect(computeExecutionUrgency(i, at(day, '09:30')).global).toBeNull()
})
