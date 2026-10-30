import { classifyPlanningIssue } from './planningIssues'
import type {
  BatchMetrics,
  BatchStatus,
  PlanningIssue,
  PlanningResult,
  PlanningInput,
} from './types'
export type RiskSettings = { tight_ratio: number }
export type BatchRisk = {
  status: BatchStatus
  reasons: string[]
  actionable_minutes: number | null
  unallocated_minutes: number
  weekend_minutes: number
  time_near: boolean
}
export function classifyBatchRisk(
  metrics: BatchMetrics,
  issues: PlanningIssue[],
  settings: RiskSettings,
): BatchRisk {
  const kinds = issues.map(classifyPlanningIssue)
  const status: BatchStatus =
    kinds.includes('incomplete') || metrics.certainty === 'incomplete'
      ? 'incomplete'
      : kinds.includes('hard_conflicts')
        ? 'adjustment_required'
        : metrics.remaining_minutes === 0
          ? 'completed'
          : metrics.unallocated_minutes > 0
            ? 'insufficient'
            : metrics.weekend_minutes > 0
              ? 'weekend_required'
              : metrics.extra_capacity_minutes !== null &&
                  (metrics.extra_capacity_minutes === 0 ||
                    metrics.extra_capacity_minutes <
                      metrics.remaining_minutes * settings.tight_ratio)
                ? 'tight'
                : metrics.status === 'incomplete' || metrics.status === 'adjustment_required'
                  ? metrics.status
                  : 'weekday_feasible'
  return {
    status,
    reasons: issues.filter((i) => classifyPlanningIssue(i) !== 'advisory').map((i) => i.code),
    actionable_minutes: metrics.today_required_minutes,
    unallocated_minutes: metrics.unallocated_minutes,
    weekend_minutes: metrics.weekend_minutes,
    time_near: false,
  }
}
const severity: Record<BatchStatus, number> = {
  completed: 0,
  weekday_feasible: 0,
  tight: 1,
  weekend_required: 2,
  adjustment_required: 3,
  insufficient: 4,
  incomplete: 5,
}
export function shouldUpdateRiskAlert(previous: BatchRisk | null, next: BatchRisk): boolean {
  return (
    !previous ||
    severity[next.status] > severity[previous.status] ||
    next.unallocated_minutes > previous.unallocated_minutes ||
    next.weekend_minutes > previous.weekend_minutes ||
    (next.time_near && !previous.time_near)
  )
}
export function buildPlanningRisks(
  result: PlanningResult,
  settings: RiskSettings,
  input?: PlanningInput,
): Record<string, BatchRisk> {
  const now = Date.parse(result.computed_at)
  const today = new Date(now + 8 * 3600000).toISOString().slice(0, 10)
  const isNear = (required: number | null, cutoff = Infinity) => {
    if (!required || !input) return false
    const todayEnds = input.capacity
      .filter(
        (c) => new Date(Date.parse(c.start) + 8 * 3600000).toISOString().slice(0, 10) === today,
      )
      .filter((c) => Date.parse(c.start) < cutoff)
      .map((c) => Math.min(Date.parse(c.end), cutoff))
    return todayEnds.length > 0 && Math.max(...todayEnds) - required * 60000 - now <= 3600000
  }
  const risks = Object.fromEntries(
    Object.entries(result.batch_metrics).map(([key, metrics]) => {
      const keys = new Set([
        key,
        ...(input?.demands
          .filter((d) => d.batch_key === key)
          .flatMap((d) => [d.key, d.task_id ?? '', d.course_id ?? '']) ?? []),
      ])
      for (const work of input?.undated_work ?? []) {
        if (work.key === key) {
          keys.add(work.task_id ?? '')
          work.commitment_blocks.forEach((block) => keys.add(block.id))
        }
      }
      for (const block of input?.fixed_blocks ?? []) if (keys.has(block.task_id)) keys.add(block.id)
      const issues = result.issues.filter(
        (i) => !i.affected_keys.length || i.affected_keys.some((k) => keys.has(k)),
      )
      const risk = classifyBatchRisk(metrics, issues, settings)
      // Unattributed incomplete model information cannot yield a definite safe batch.
      if (
        !result.complete &&
        ['weekday_feasible', 'tight', 'weekend_required'].includes(risk.status)
      )
        risk.status = 'incomplete'
      const deadlines =
        input?.demands.filter((d) => d.batch_key === key).map((d) => Date.parse(d.due_at)) ?? []
      const commitments =
        input?.undated_work
          ?.filter((w) => w.key === key)
          .flatMap((w) => w.commitment_blocks.map((b) => Date.parse(b.ends_at))) ?? []
      risk.time_near = isNear(
        risk.actionable_minutes,
        Math.min(Infinity, ...deadlines, ...commitments),
      )
      return [key, risk]
    }),
  )
  if ((result.today_required_minutes ?? 0) > 0)
    risks.__global_today__ = {
      status: 'weekday_feasible',
      reasons: ['global_today_required'],
      actionable_minutes: result.today_required_minutes ?? null,
      unallocated_minutes: 0,
      weekend_minutes: 0,
      time_near: isNear(result.today_required_minutes ?? null),
    }
  return risks
}
