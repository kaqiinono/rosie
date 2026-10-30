import { describe, expect, it } from 'vitest'
import {
  buildPlanningRisks,
  classifyBatchRisk,
  shouldUpdateRiskAlert,
} from '../../../../packages/tasks/src/planning/risk'
import type { BatchMetrics } from '../../../../packages/tasks/src/planning/types'
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

it('uses the batch deadline for near warnings and keeps global today minimum distinct', () => {
  const result = {
    input_revision: 1,
    computed_at: '2030-10-30T00:00:00Z',
    horizon_end: '2030-11-30T00:00:00Z',
    allocations: [],
    batch_metrics: { batch: { ...metrics, today_required_minutes: 10 } },
    conflict_groups: [],
    issues: [],
    complete: true,
    today_required_minutes: 20,
  }
  const risks = buildPlanningRisks(
    result,
    { tight_ratio: 0.2 },
    {
      input_revision: 1,
      now: result.computed_at,
      horizon_end: result.horizon_end,
      demands: [
        {
          key: 'task',
          task_id: 'task',
          course_id: null,
          batch_key: 'batch',
          origin: 'actual',
          release_at: result.computed_at,
          due_at: '2030-10-30T01:00:00Z',
          remaining_minutes: 100,
          priority: 0,
          certainty: 'confirmed',
          source_revision: 1,
        },
      ],
      capacity: [
        {
          key: 'day',
          start: result.computed_at,
          end: '2030-10-30T10:00:00Z',
          minutes: 600,
          kind: 'regular',
        },
      ],
      fixed_blocks: [],
      previous_allocations: [],
      configuration_issues: [],
    },
  )
  expect(risks.batch.time_near).toBe(true)
  expect(risks.batch.actionable_minutes).toBe(10)
  expect(risks.__global_today__.actionable_minutes).toBe(20)
})
