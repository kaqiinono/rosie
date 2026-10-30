import type { PlanningInput, PlanningResult } from '../../../../packages/tasks/src/planning/types'
export const input: PlanningInput = {
  input_revision: 4,
  now: '2026-10-30T09:00:00Z',
  horizon_end: '2026-11-02T13:00:00Z',
  demands: [
    {
      key: 'actual',
      task_id: 'task-1',
      course_id: 'math',
      batch_key: 'batch-math',
      origin: 'actual',
      release_at: '2026-10-30T09:00:00Z',
      due_at: '2026-11-02T13:00:00Z',
      remaining_minutes: 50,
      priority: 0,
      certainty: 'confirmed',
      source_revision: 2,
    },
    {
      key: 'forecast',
      task_id: null,
      course_id: 'english',
      batch_key: 'batch-english',
      origin: 'forecast',
      release_at: '2026-10-31T04:00:00Z',
      due_at: '2026-11-02T13:00:00Z',
      remaining_minutes: 40,
      priority: 0,
      certainty: 'estimated',
      source_revision: 1,
    },
  ],
  capacity: [
    {
      key: 'sat',
      start: '2026-10-31T04:00:00Z',
      end: '2026-10-31T05:00:00Z',
      minutes: 60,
      kind: 'weekend_reserve',
    },
  ],
  fixed_blocks: [],
  previous_allocations: [],
  configuration_issues: [],
}
export const result: PlanningResult = {
  input_revision: 4,
  computed_at: input.now,
  horizon_end: input.horizon_end,
  complete: false,
  policy: 'allow_weekend',
  total_remaining_minutes: 90,
  total_unallocated_minutes: 30,
  total_weekend_minutes: 60,
  today_required_minutes: null,
  allocations: [
    {
      demand_key: 'actual',
      start: '2026-10-31T04:00:00Z',
      end: '2026-10-31T04:50:00Z',
      minutes: 50,
      kind: 'weekend_reserve',
      fixed: false,
    },
    {
      demand_key: 'forecast',
      start: '2026-10-31T04:50:00Z',
      end: '2026-10-31T05:00:00Z',
      minutes: 10,
      kind: 'weekend_reserve',
      fixed: false,
    },
  ],
  batch_metrics: {
    'batch-math': {
      remaining_minutes: 50,
      weekday_minutes: 0,
      weekend_minutes: 50,
      unallocated_minutes: 0,
      finish_at: '2026-10-31T04:50:00Z',
      extra_capacity_minutes: null,
      today_required_minutes: null,
      status: 'incomplete',
      certainty: 'confirmed',
    },
    'batch-english': {
      remaining_minutes: 40,
      weekday_minutes: 0,
      weekend_minutes: 10,
      unallocated_minutes: 30,
      finish_at: null,
      extra_capacity_minutes: null,
      today_required_minutes: null,
      status: 'insufficient',
      certainty: 'estimated',
    },
  },
  issues: [{ code: 'unconfigured', affected_keys: [], detail: '周日可用时间待配置' }],
  conflict_groups: [
    { course_ids: ['math', 'english'], demand_keys: ['actual', 'forecast'], missing_minutes: 30 },
  ],
}

// Owner snapshot -> canonical builder -> real solver. Undated work remains outside movable demands.
import {
  buildPlanningInput,
  type UserPlanningSnapshot,
} from '../../../../packages/tasks/src/planning/planningInput'
import { solveCapacityPolicies } from '../../../../packages/tasks/src/planning/solveCapacity'
import type { TaskInstance } from '../../../../packages/tasks/src/types'
export function undatedScenario(includeFar = false) {
  const task = (id: string, minutes: number): TaskInstance => ({
    id,
    user_id: 'owner',
    title: id === 'partial' ? '未设截止的数学练习' : '未设截止的英语听读',
    subject: 'art',
    course_id: id === 'partial' ? 'math' : 'english',
    occurrence_id: null,
    template_id: null,
    source_key: `undated-${id}`,
    status: 'active',
    mode: 'checklist',
    progress_mode: 'percentage',
    completion_percent: 25,
    items: [],
    lesson: null,
    due_at: null,
    due_kind: 'fixed',
    due_occurrence_id: null,
    estimated_minutes: minutes,
    material_kind: 'general',
    created_at: '2026-10-29T00:00:00Z',
    release_at: '2026-10-29T00:00:00Z',
    revision: 2,
  })
  const tasks = [task('partial', 80), task('full', 40)]
  if (includeFar)
    tasks.push({
      ...task('far', 40),
      course_id: 'far',
      title: '远期数学练习',
      release_at: '2027-02-01T04:00:00Z',
      due_at: '2027-02-02T06:00:00Z',
    })
  const snapshot: UserPlanningSnapshot = {
    user_id: 'owner',
    input_revision: 8,
    courses: tasks.map((t) => ({
      id: t.course_id!,
      user_id: 'owner',
      name: t.title,
      subject: 'art',
      created_at: t.created_at,
      auto_assign: false,
      auto_advance: false,
    })),
    rules: [],
    exceptions: [],
    occurrences: [],
    events: [],
    catalog_snapshots: [],
    bindings: [],
    pool_items: [],
    tasks,
    day_states: [],
    windows: Array.from({ length: 7 }, (_, weekday) => ({
      id: `w${weekday}`,
      user_id: 'owner',
      weekday,
      on_date: null,
      start_time: '12:00',
      end_time: '14:00',
    })),
    blocks: tasks.slice(0, 2).map((t, i) => ({
      id: `b${i}`,
      user_id: 'owner',
      task_id: t.id,
      starts_at: `2026-10-31T0${4 + i}:00:00+00:00`,
      ends_at: `2026-10-31T0${4 + i}:30:00+00:00`,
    })),
    exams: [],
    previous_allocations: [],
  }
  const built = buildPlanningInput(snapshot, '2026-10-30T00:00:00Z')
  return { input: built, result: solveCapacityPolicies(built), tasks }
}
