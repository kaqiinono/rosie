import { enumerateCourseEvents, projectCourseEvents, resolveActivityWindow } from '../courseEvents'
import type {
  CourseCatalogSnapshot,
  CourseEvent,
  CourseRule,
  CourseTaskBinding,
  TaskPoolItem,
} from '../courseTypes'
import type { CourseException, CourseOccurrence, TaskCourse } from '../types'
import type { MatchedActivity } from '../taskPool'
import { localDate } from '../time'
import { getTaskExecutionWindow } from './executionWindow'
import { buildTaskBatchKey } from './batchKey'
import type { PlanningIssue, TaskDemand, UndatedWork } from './types'

const DAY = 86400000
export type ForecastInput = {
  user_id: string
  now: string
  courses: TaskCourse[]
  rules: CourseRule[]
  exceptions: CourseException[]
  occurrences: CourseOccurrence[]
  events: CourseEvent[]
  catalog_snapshots: CourseCatalogSnapshot[]
  bindings: CourseTaskBinding[]
  pool_items: TaskPoolItem[]
  known_deadlines?: string[]
  /** Inject the same pure material resolver used by formal tasks; absent means unknown. */
  resolve_materials?: (
    course: TaskCourse,
    activity: MatchedActivity,
  ) => { status: 'pending' | 'selected' | 'not_required'; asset_ids: string[] }
}
export type ForecastResult = {
  demands: TaskDemand[]
  undated_work: UndatedWork[]
  issues: PlanningIssue[]
  horizon_end: string
  coverage_end: string
  complete: boolean
  /** The runtime's separate preview cap is not the forecast's day coverage limit. */
  runtime_candidate_limit: 256
  events: CourseEvent[]
}
export function mergeActualAndForecast(actual: TaskDemand[], forecast: TaskDemand[]): TaskDemand[] {
  const result = new Map(forecast.map((d) => [d.key, d]))
  for (const demand of actual) {
    const prior = result.get(demand.key)
    if (!prior || prior.origin !== 'actual' || prior.source_revision <= demand.source_revision)
      result.set(demand.key, demand)
  }
  return [...result.values()].sort((a, b) => a.key.localeCompare(b.key))
}
/** No writes and no runtime clock: even cursor advancement is confined to the canonical projection. */
export function projectCourseTasks(input: ForecastInput): ForecastResult {
  const clock = Date.parse(input.now)
  if (!Number.isFinite(clock)) throw new Error('invalid_planning_now')
  const cap = clock + 180 * DAY
  let horizon = clock + 28 * DAY
  const issues: PlanningIssue[] = []
  const add = (code: string, keys: string[], detail = code) =>
    issues.push({ code, affected_keys: keys, detail })
  for (const due of input.known_deadlines ?? []) {
    const value = Date.parse(due)
    if (Number.isFinite(value)) horizon = Math.max(horizon, Math.min(value, cap))
    if (value > cap) add('outside_forecast_range', [due], '已知截止超过180天，远期负荷未建模')
  }
  const owned = input.courses
    .filter((c) => c.user_id === input.user_id && !c.archived_at)
    .sort((a, b) => a.id.localeCompare(b.id))
  const groups = owned.map((course) => {
    const from =
      course.generation_date && course.generation_date < localDate(new Date(clock))
        ? course.generation_date
        : localDate(new Date(clock))
    // Bounded history protects a stale checkpoint from becoming an unbounded browser job.
    const lower = localDate(new Date(clock - 180 * DAY))
    if (from < lower)
      add('historical_projection_limit', [course.id], '历史检查点超过180天，积压覆盖不完整')
    const candidates = enumerateCourseEvents(
      course,
      input.rules,
      input.exceptions,
      from < lower ? lower : from,
      localDate(new Date(cap)),
      input.events,
      input.occurrences,
    )
    const catalog =
      input.catalog_snapshots.find(
        (s) => s.id === course.catalog_snapshot_id && s.user_id === input.user_id,
      ) ?? null
    let projection: ReturnType<typeof projectCourseEvents>
    try {
      projection = projectCourseEvents(
        course,
        candidates,
        catalog,
        input.bindings,
        input.pool_items,
      )
    } catch {
      projection = { events: [], issues: [] }
      add('invalid_course_cursor', [course.id], '课程进度与目录不一致')
    }
    const windows = projection.events.flatMap(({ event, activities }) => {
      const next =
        candidates.find(
          (c) =>
            c.event_key !== event.event_key &&
            Date.parse(c.release_at) > Date.parse(event.release_at) &&
            c.assignment_state !== 'cancelled',
        ) ?? null
      return activities.map((activity) => ({
        event,
        activity,
        window: resolveActivityWindow(
          event,
          activity.template,
          course.default_deadline ?? null,
          next,
          course.automation_enabled_at ?? null,
          new Date(cap).toISOString(),
        ),
      }))
    })
    // Each course's next homework deadline extends the rolling window, including across weeks.
    const first = windows.find((w) => Date.parse(w.event.release_at) >= clock)
    if (first)
      for (const w of windows.filter((w) => w.event.event_key === first.event.event_key)) {
        if (w.window.due_at) horizon = Math.max(horizon, Math.min(cap, Date.parse(w.window.due_at)))
      }
    return { course, candidates, catalog, projection, windows }
  })
  const demands: TaskDemand[] = [],
    undated_work: UndatedWork[] = []
  const events: CourseEvent[] = []
  for (const { course, candidates, catalog, projection, windows } of groups) {
    // Capacity follows class occupancy, independently of when its homework releases.
    events.push(
      ...candidates.filter(
        (e) =>
          Date.parse(e.release_at) <= horizon ||
          (e.starts_at &&
            e.ends_at &&
            Date.parse(e.starts_at) < horizon &&
            Date.parse(e.ends_at) > clock),
      ),
    )
    const activeBindings = input.bindings.filter(
      (b) => b.user_id === input.user_id && b.course_id === course.id && b.enabled,
    )
    if (
      !candidates.length &&
      activeBindings.some((b) => input.pool_items.some((p) => p.id === b.pool_item_id && p.enabled))
    )
      add('no_future_events', [course.id], '存在作业绑定但范围内无课程事件，请检查课程规则')
    const relevant = new Set(
      candidates.filter((e) => Date.parse(e.release_at) <= horizon).map((e) => e.event_key),
    )
    for (const issue of projection.issues)
      if (relevant.has(issue.event_key)) add(issue.code, [course.id, issue.event_key])
    for (const e of candidates.filter((e) => relevant.has(e.event_key))) {
      if (
        catalog?.progression_mode === 'segment' &&
        course.cursor &&
        !catalog.teaching_segments.some(
          (s) => s.lesson_key === course.cursor?.lesson_key && s.key === course.cursor?.segment_key,
        )
      )
        add('missing_segment', [course.id, e.event_key], '当前数学教学段待配置，任务量不完整')
      for (const issue of e.runtime_issues ?? []) add(issue.code, [course.id, e.event_key])
      if (course.generation_state === 'paused')
        add('course_progress_paused', [course.id, e.event_key])
      for (const binding of activeBindings) {
        const item = input.pool_items.find(
          (p) => p.id === binding.pool_item_id && p.user_id === input.user_id,
        )
        if (!item) {
          add('missing_pool_item', [course.id, e.event_key, binding.id])
          continue
        }
        if (!item.enabled) continue
        const scope = binding.scope_override ?? item.scope
        if (scope.kind !== 'all' && !catalog && !e.lesson_snapshot?.lesson)
          add('missing_catalog', [course.id, e.event_key, binding.id])
        if (
          catalog &&
          ((scope.kind === 'lessons' &&
            scope.lesson_keys.some((k) => !catalog.ordered_lessons.some((l) => l.key === k))) ||
            (scope.kind === 'segments' &&
              scope.segment_keys.some(
                (k) => !catalog.teaching_segments.some((s) => s.key === k),
              )) ||
            (scope.kind === 'unit' &&
              !catalog.ordered_lessons.some((l) => l.book === scope.book && l.unit === scope.unit)))
        )
          add('scope_outside_catalog', [course.id, e.event_key, binding.id])
      }
    }
    if (!course.auto_assign) {
      for (const { event, activities } of projection.events)
        if (relevant.has(event.event_key) && activities.length)
          add(
            'manual_demand_unmodeled',
            [course.id, event.event_key],
            '自动布置已关闭，未来手动完成产生的作业未建模',
          )
      continue
    }
    for (const { event, activity, window } of windows) {
      // Future lead-time previews can enter this window even when their class is later.
      if (Date.parse(window.release_at) > horizon) continue
      if (!window.eligible) continue
      if (course.generation_state === 'paused' || course.generation_state === 'finished') continue
      for (const issue of window.issues)
        add(issue, [course.id, event.event_key, activity.source_key])
      const material = input.resolve_materials?.(course, activity) ?? {
        status:
          activity.material_selector.kind === 'none'
            ? ('not_required' as const)
            : ('pending' as const),
        asset_ids: [],
      }
      const selectionPending = activity.progress_mode === 'items'
      if (material.status === 'pending')
        add('material_pending', [course.id, event.event_key, activity.source_key])
      if (selectionPending)
        add('selection_pending', [course.id, event.event_key, activity.source_key])
      if (!window.due_at) {
        add('missing_deadline', [course.id, event.event_key, activity.source_key])
        undated_work.push({
          key: activity.source_key,
          task_id: null,
          course_id: course.id,
          origin: 'forecast',
          release_at: window.release_at,
          remaining_minutes: activity.estimated_minutes,
          commitment_blocks: [],
        })
        continue
      }
      if (Date.parse(window.due_at) > cap || Date.parse(event.release_at) > cap) {
        add('outside_forecast_range', [course.id, event.event_key, activity.source_key])
        continue
      }
      if (Date.parse(window.due_at) > horizon) {
        add(
          'forecast_boundary',
          [course.id, event.event_key, activity.source_key],
          '作业截止跨出覆盖范围，保留边界不完整提示',
        )
        continue
      }
      const execution = getTaskExecutionWindow(
        {
          id: activity.source_key,
          created_at: window.release_at,
          release_at: window.release_at,
          due_at: window.due_at,
        },
        input.now,
      )
      if (execution.issue)
        add(execution.issue.code, [course.id, event.event_key, activity.source_key])
      demands.push({
        key: activity.source_key,
        task_id: null,
        course_id: course.id,
        batch_key: buildTaskBatchKey(course.id, activity.trigger, window.release_at, window.due_at),
        origin: 'forecast',
        release_at: window.release_at,
        due_at: execution.due_at!,
        original_due_at: window.due_at,
        deadline_source: execution.deadline_source,
        remaining_minutes: activity.estimated_minutes,
        priority: 0,
        certainty:
          material.status === 'pending' || selectionPending || window.issues.length
            ? 'incomplete'
            : 'estimated',
        source_revision: event.revision,
      })
    }
  }
  return {
    demands: demands.sort((a, b) => a.key.localeCompare(b.key)),
    undated_work,
    issues,
    horizon_end: new Date(horizon).toISOString(),
    coverage_end: new Date(horizon).toISOString(),
    complete: issues.length === 0,
    runtime_candidate_limit: 256,
    events,
  }
}
