import { describe, expect, it } from 'vitest'
import {
  buildPlanningRisks,
  classifyBatchRisk,
  shouldUpdateRiskAlert,
} from '../../../../packages/tasks/src/planning/risk'
import { solveCapacity } from '../../../../packages/tasks/src/planning/solveCapacity'
import { at, capacity, demand, input } from './fixtures/planning'
import type { BatchMetrics, PlanningInput } from '../../../../packages/tasks/src/planning/types'
const metrics: BatchMetrics = {
  remaining_minutes: 100,
  weekday_minutes: 100,
  weekend_minutes: 0,
  unallocated_minutes: 0,
  finish_at: null,
  extra_capacity_minutes: 20,
  today_required_minutes: 10,
  status: 'weekday_feasible',
  certainty: 'confirmed',
}
describe('planning risk', () => {
  it('uses configurable per-batch headroom and true today minimum', () => {
    expect(classifyBatchRisk(metrics, [], { tight_ratio: 0.3 })).toMatchObject({
      status: 'tight',
      actionable_minutes: 10,
    })
    expect(classifyBatchRisk(metrics, [], { tight_ratio: 0.1 }).status).toBe('weekday_feasible')
  })
  it('does not turn known shortage into missing configuration', () => {
    expect(
      classifyBatchRisk({ ...metrics, unallocated_minutes: 5 }, [], { tight_ratio: 0.2 }).status,
    ).toBe('insufficient')
    expect(
      classifyBatchRisk(metrics, [{ code: 'material_pending', affected_keys: [], detail: '' }], {
        tight_ratio: 0.2,
      }).status,
    ).toBe('incomplete')
  })
  it('ignores historical advisory and exposes fixed conflict', () => {
    expect(
      classifyBatchRisk(metrics, [{ code: 'fixed_expired', affected_keys: [], detail: '' }], {
        tight_ratio: 0.2,
      }).status,
    ).toBe('weekday_feasible')
    expect(
      classifyBatchRisk(metrics, [{ code: 'fixed_overlap', affected_keys: [], detail: '' }], {
        tight_ratio: 0.2,
      }).status,
    ).toBe('adjustment_required')
  })
  it('deduplicates recomputation and updates first, worse, shortage, reserve and near boundaries', () => {
    const risk = classifyBatchRisk({ ...metrics, weekend_minutes: 10 }, [], { tight_ratio: 0.2 })
    expect(shouldUpdateRiskAlert(null, risk)).toBe(true)
    expect(shouldUpdateRiskAlert(risk, { ...risk })).toBe(false)
    expect(shouldUpdateRiskAlert(risk, { ...risk, weekend_minutes: 11 })).toBe(true)
    expect(shouldUpdateRiskAlert(risk, { ...risk, unallocated_minutes: 1 })).toBe(true)
    expect(shouldUpdateRiskAlert(risk, { ...risk, time_near: true })).toBe(true)
  })
})

const day = '2030-10-30'
function splitInput(minutes = 90) {
  const i = input(
    [demand('a', minutes, at(day, '09:00'), at(day, '19:00'))],
    [capacity(day, '09:00', '10:00'), capacity(day, '18:00', '19:00')],
  )
  i.now = at(day, '08:30')
  i.horizon_end = at('2030-10-31', '20:00')
  return i
}
function risksFor(i: PlanningInput) {
  return buildPlanningRisks(solveCapacity(i, 'allow_weekend'), { tight_ratio: 0.2 }, i)
}
it('warns exactly one hour before the latest feasible start across split windows', () => {
  const i = splitInput()
  const risks = risksFor(i)
  expect(risks.a.actionable_minutes).toBe(90)
  expect(risks.a.time_near).toBe(true)
  expect(risks.__global_today__.time_near).toBe(true)
  i.now = at(day, '08:29')
  expect(risksFor(i).a.time_near).toBe(false)
})
it('preserves a competing task release and deadline in the batch counterfactual', () => {
  const i = splitInput()
  i.capacity[0] = capacity(day, '09:00', '11:00')
  i.demands.push(demand('b', 60, at(day, '10:00'), at(day, '11:00')))
  const risks = risksFor(i)
  expect(risks.a.time_near).toBe(true) // latest09:30: b occupies10–11
  expect(risks.b.time_near).toBe(false) // b may wait until10:00
  expect(risks.__global_today__.time_near).toBe(true)
})
it('keeps interchangeable batch minima zero while the global obligation is near', () => {
  const i = splitInput(60)
  i.now = at(day, '08:00')
  i.capacity = [capacity(day, '09:00', '10:00'), capacity('2030-10-31', '09:00', '10:00')]
  i.demands[0].due_at = at('2030-10-31', '10:00')
  i.demands.push({ ...i.demands[0], key: 'b', task_id: 'b', batch_key: 'b' })
  const risks = risksFor(i)
  expect(risks.a.actionable_minutes).toBe(0)
  expect(risks.b.actionable_minutes).toBe(0)
  expect(risks.a.time_near).toBe(false)
  expect(risks.b.time_near).toBe(false)
  expect(risks.__global_today__).toMatchObject({ actionable_minutes: 60, time_near: true })
})
