import type { CourseConfirmation, CourseInput, LessonRef, OwnedRow, Subject, TaskData, TaskTemplate, TimetableRule } from './types'

export type CourseType = 'timetabled' | 'flexible'
export type CourseCursor = { lesson_key: string; segment_key: string | null }
export type AdvanceResult = { kind: 'next'; cursor: CourseCursor } | { kind: 'finished' } | { kind: 'missing_segment'; lesson_key: string }
export type CourseDeadlinePolicy = { kind: 'next_class' | 'same_day' | 'days_after' | 'fixed'; time: string; days: number; at: string | null }
export type CourseConfiguration = {
  cursor_revision?: number
  generation_state?: 'active' | 'paused' | 'finished'
  generation_issue?: { kind?: string; code?: string; lesson_key?: string } | null
  generation_date?: string | null
  default_deadline?: CourseDeadlinePolicy | null
  course_type?: CourseType
  auto_assign?: boolean
  auto_advance?: boolean
  catalog_snapshot_id?: string | null
  cursor?: CourseCursor | null
  rules_revision?: number
  effective_from?: string | null
  automation_enabled_at?: string | null
}

type RuleRecurrence = Omit<TimetableRule, 'id' | 'user_id' | 'course_id' | 'start_time' | 'end_time'>
/** Transitional input accepts omitted times so validation can report a useful error. */
export type CourseRuleInput = RuleRecurrence & { id?: string; kind?: CourseType; start_time?: string | null; end_time?: string | null }
export type NormalizedCourseRuleInput = RuleRecurrence & { id?: string } & (
  { kind: 'timetabled'; start_time: string; end_time: string } |
  { kind: 'flexible'; start_time: null; end_time: null }
)
/** TimetableRule remains timed for legacy grid consumers during the additive rollout. */
export type CourseRule = OwnedRow & { course_id: string } & NormalizedCourseRuleInput
export type NormalizedCourseInput = { course: CourseInput; rules: NormalizedCourseRuleInput[] }
export type EventIdentity = { kind: 'timetabled'; rule_id: string; on_date: string } | { kind: 'flexible'; course_id: string; on_date: string; extra_event_id?: string }

export type TeachingSegment = { key: string; lesson_key: string; title: string; problem_keys: string[]; completes_lesson?: boolean }
export type CourseCatalogSnapshot = OwnedRow & {
  source: 'builtin' | 'manual'; progression_mode: 'lesson' | 'segment'
  version: string; subject: Subject; ordered_lessons: LessonRef[]; teaching_segments: TeachingSegment[]; created_at: string
}
export type CourseLessonSnapshot = { lesson: LessonRef | null; cursor: CourseCursor | null; catalog_version: string | null; problem_keys?: string[]; segment_title?: string | null }
export type CourseEvent = OwnedRow & {
  course_id: string; rule_id: string | null; occurrence_id: string | null; event_key: string; on_date: string
  starts_at: string | null; ends_at: string | null; release_at: string
  lesson_snapshot: CourseLessonSnapshot | null; revision: number
  assignment_state: 'pending' | 'assigned' | 'skipped' | 'cancelled'
  content_origin?: 'cursor' | 'explicit'
  after_processed?: boolean; cursor_advanced?: boolean; next_snapshot?: CourseLessonSnapshot | null
  runtime_issues?: { code: string }[]
  completion_state: 'pending' | 'completed'; completed_at: string | null; legacy_confirmation: CourseConfirmation | null
}
/** Scope identity uses catalog keys, never display titles or a lesson number alone. */
export type CourseScope = { kind: 'all' } | { kind: 'lessons'; lesson_keys: string[] } | { kind: 'segments'; segment_keys: string[] } | { kind: 'unit'; book: string; unit: string }
export type TaskProgressMode = 'percentage' | 'items'
export type MaterialSelector = { kind: 'auto' } | { kind: 'none' } | { kind: 'assets'; asset_ids: string[] }
export type TaskPoolItem = TaskTemplate & { activity_key: string; scope: CourseScope; progress_mode: TaskProgressMode; material_selector: MaterialSelector }
export type CourseTaskBinding = OwnedRow & {
  course_id: string; pool_item_id: string; enabled: boolean; scope_override: CourseScope | null
  estimated_minutes_override: number | null; material_override: MaterialSelector | null
}
/** New collections are separate so old TaskData fixtures and timed consumers stay compatible. */
export type CourseDomainData = TaskData & {
  course_rules: CourseRule[]; events: CourseEvent[]; catalog_snapshots: CourseCatalogSnapshot[]
  bindings: CourseTaskBinding[]; pool_items: TaskPoolItem[]
}
