import type {
  AvailabilityDayState,
  AvailabilityWindow,
  TaskExam,
  TaskInstance,
  TaskTimeBlock,
} from '../types'
import { getRemainingMinutes } from '../taskProgress'
import { buildCapacityIntervals } from './availability'
import { getTaskExecutionWindow } from './executionWindow'
import { mergeActualAndForecast, projectCourseTasks, type ForecastInput } from './forecast'
import type { PlanningInput, PlanningIssue, TaskAllocation, TaskDemand, UndatedWork } from './types'
export type UserPlanningSnapshot = Omit<ForecastInput, 'now' | 'known_deadlines'> & {
  input_revision: number
  tasks: TaskInstance[]
  day_states: AvailabilityDayState[]
  windows: AvailabilityWindow[]
  blocks: TaskTimeBlock[]
  exams: TaskExam[]
  previous_allocations: TaskAllocation[]
}
/** Shared browser/server assembly. Caller supplies an owner-consistent data read and persisted
 * planning revision. Capacity/fixed reservations are not deducted here; applyFixedBlocks once. */
export function buildPlanningInput(snapshot: UserPlanningSnapshot, now: string): PlanningInput {
  const owned = snapshot.tasks.filter((t) => t.user_id === snapshot.user_id)
  const blocks = snapshot.blocks.filter((b) => b.user_id === snapshot.user_id)
  const forecast = projectCourseTasks({
    ...snapshot,
    now,
    known_deadlines: owned
      .filter((t) => getRemainingMinutes(t) > 0)
      .flatMap((t) => [t.due_at, t.recovery_due_at].filter((d): d is string => !!d)),
  })
  const issues: PlanningIssue[] = [...forecast.issues]
  const actual: TaskDemand[] = [],
    undated: UndatedWork[] = []
  for (const task of owned) {
    const remaining = getRemainingMinutes(task)
    const window = getTaskExecutionWindow(task, now)
    if (window.issue && remaining > 0) issues.push(window.issue)
    if (!window.due_at) {
      if (remaining > 0)
        undated.push({
          key: task.source_key,
          task_id: task.id,
          course_id: task.course_id,
          origin: 'actual',
          release_at: window.release_at,
          remaining_minutes: remaining,
          commitment_blocks: blocks.filter((b) => b.task_id === task.id),
        })
      continue
    }
    if (Date.parse(window.due_at) > Date.parse(forecast.horizon_end) && remaining > 0) {
      issues.push({
        code: 'outside_forecast_range',
        affected_keys: [task.id, task.source_key],
        detail: '截止超过预测范围，远期负荷未建模',
      })
      continue
    }
    if (remaining > 0 && task.material_status === 'pending')
      issues.push({
        code: 'material_pending',
        affected_keys: [task.id, task.source_key],
        detail: '暂缺物料，保留估计分钟',
      })
    if (
      remaining > 0 &&
      (task.selection_state === 'pending' || (task.progress_mode === 'items' && !task.items.length))
    )
      issues.push({
        code: 'selection_pending',
        affected_keys: [task.id, task.source_key],
        detail: '待选题，保留估计分钟',
      })
    actual.push({
      key: task.source_key,
      task_id: task.id,
      course_id: task.course_id,
      batch_key: JSON.stringify([
        task.course_id,
        task.template_snapshot?.trigger === 'confirmed'
          ? 'after_class'
          : (task.template_snapshot?.trigger ?? task.due_kind),
        window.release_at,
        task.due_at,
      ]),
      origin: 'actual',
      release_at: window.release_at,
      due_at: window.due_at,
      original_due_at: task.due_at,
      deadline_source: window.deadline_source,
      remaining_minutes: remaining,
      priority: 0,
      certainty:
        window.issue || task.selection_state === 'pending' || task.material_status === 'pending'
          ? 'incomplete'
          : 'confirmed',
      source_revision: task.revision,
    })
  }
  const actualKeys = new Set(owned.map((t) => t.source_key))
  // Actual snapshots own material/selection/status diagnostics once formally generated.
  const configuration = issues.filter(
    (i) => !i.affected_keys.some((k) => actualKeys.has(k)) || !forecast.issues.includes(i),
  )
  const capacity = buildCapacityIntervals({
    now,
    horizon_end: forecast.horizon_end,
    day_states: snapshot.day_states.filter((s) => s.user_id === snapshot.user_id),
    windows: snapshot.windows.filter((w) => w.user_id === snapshot.user_id),
    courses: [
      ...forecast.events,
      ...snapshot.occurrences.filter((o) => o.user_id === snapshot.user_id),
    ],
    exams: snapshot.exams.filter((e) => e.user_id === snapshot.user_id),
  })
  return {
    input_revision: snapshot.input_revision,
    now,
    horizon_end: forecast.horizon_end,
    demands: mergeActualAndForecast(
      actual,
      forecast.demands.filter((d) => !actualKeys.has(d.key)),
    ),
    capacity: capacity.capacity,
    fixed_blocks: blocks,
    previous_allocations: snapshot.previous_allocations,
    undated_work: [...undated, ...forecast.undated_work.filter((d) => !actualKeys.has(d.key))],
    configuration_issues: [...configuration, ...capacity.issues],
  }
}
