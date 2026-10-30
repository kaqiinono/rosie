import type { AvailabilityDayState, AvailabilityWindow, TaskTimeBlock } from '../types'
export type PlanningIssue = { code: string; affected_keys: string[]; detail: string }
export type Certainty = 'confirmed' | 'estimated' | 'incomplete'
export type TaskDemand = {
  key: string
  task_id: string | null
  course_id: string | null
  batch_key: string
  origin: 'actual' | 'forecast'
  release_at: string
  due_at: string
  remaining_minutes: number
  priority: number
  certainty: Certainty
  source_revision: number
  original_due_at?: string | null
  deadline_source?: 'original' | 'explicit_recovery' | 'suggested_recovery' | 'missing'
}
export type CapacityInterval = {
  key: string
  start: string
  end: string
  minutes: number
  kind: 'regular' | 'weekend_reserve'
}
export type TaskAllocation = {
  demand_key: string
  start: string
  end: string
  minutes: number
  kind: CapacityInterval['kind']
  fixed: boolean
}
export type BatchStatus =
  | 'weekday_feasible'
  | 'tight'
  | 'weekend_required'
  | 'adjustment_required'
  | 'insufficient'
  | 'incomplete'
  | 'completed'
export type BatchMetrics = {
  /** Undated work has only local fixed commitments, never a movable deadline. */
  fixed_only?: boolean
  remaining_minutes: number
  weekday_minutes: number
  weekend_minutes: number
  unallocated_minutes: number
  finish_at: string | null
  extra_capacity_minutes: number | null
  today_required_minutes: number | null
  status: BatchStatus
  certainty: Certainty
}
export type ConflictGroup = { demand_keys: string[]; course_ids: string[]; missing_minutes: number }
/** Undated work is never ordinary movable demand. Only explicitly saved blocks may be
 * validated/credited as local commitments; uncovered minutes stay unknown. */
export type UndatedWork = {
  key: string
  task_id: string | null
  course_id: string | null
  origin: 'actual' | 'forecast'
  release_at: string
  remaining_minutes: number
  commitment_blocks: TaskTimeBlock[]
}
export type PlanningInput = {
  input_revision: number
  now: string
  horizon_end: string
  demands: TaskDemand[]
  capacity: CapacityInterval[]
  fixed_blocks: TaskTimeBlock[]
  previous_allocations: TaskAllocation[]
  undated_work?: UndatedWork[]
  configuration_issues: PlanningIssue[]
}
export type PlanningResult = {
  /** complete describes model integrity, feasible additionally requires zero shortage. */
  policy?: 'regular_only' | 'allow_weekend'
  issue_groups?: {
    advisory: PlanningIssue[]
    hard_conflicts: PlanningIssue[]
    incomplete: PlanningIssue[]
  }
  feasible?: boolean
  total_remaining_minutes?: number
  total_unallocated_minutes?: number
  total_weekend_minutes?: number
  today_required_minutes?: number | null
  input_revision: number
  computed_at: string
  horizon_end: string
  allocations: TaskAllocation[]
  batch_metrics: Record<string, BatchMetrics>
  conflict_groups: ConflictGroup[]
  issues: PlanningIssue[]
  complete: boolean
}
export type AvailabilityInput = {
  now: string
  horizon_end: string
  day_states: AvailabilityDayState[]
  windows: AvailabilityWindow[]
  courses: {
    id: string
    starts_at: string | null
    ends_at: string | null
    status?: string
    assignment_state?: string
  }[]
  exams: { id: string; starts_at: string; ends_at: string }[]
}
export type CapacityBuildResult = { capacity: CapacityInterval[]; issues: PlanningIssue[] }
export type FixedBlockResult = {
  remaining_demands: TaskDemand[]
  remaining_capacity: CapacityInterval[]
  accepted_allocations: TaskAllocation[]
  conflicts: PlanningIssue[]
}
