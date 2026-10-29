import type { CourseCatalogSnapshot, CourseConfiguration, CourseScope, TeachingSegment, CourseRule, NormalizedCourseRuleInput, CourseTaskBinding } from './courseTypes'

export type Subject = 'chinese' | 'english' | 'math' | 'art' | 'science' | 'sports' | 'dance' | 'piano' | 'swimming' | 'other'
export const SUBJECTS: Record<Subject, string> = { chinese: '语文', english: '英语', math: '数学', art: '美术', science: '科学', sports: '体育', dance: '舞蹈', piano: '钢琴', swimming: '游泳', other: '未分类' }
export type TaskStatus = 'pending' | 'active' | 'completed' | 'cancelled'
export type TaskMode = 'checklist' | 'reading' | 'audio'
export type OwnedRow = { id: string; user_id: string }
export type TaskCourse = OwnedRow & CourseConfiguration & { name: string; subject: Subject; created_at: string; calendar_id?: string | null; teacher?: string; location?: string; credits?: number | null; notes?: string; color?: string; reminder_minutes?: number | null; archived_at?: string | null }
export type TimetableRule = OwnedRow & { course_id: string; weekday: number; start_time: string; end_time: string; valid_from: string; valid_until: string | null; recurrence?: 'weekly' | 'once' | 'weeks'; interval_weeks?: number; anchor_date?: string; teaching_weeks?: number[]; disabled_from?: string | null }
export type CourseException = OwnedRow & { rule_id: string; original_date: string; cancelled: boolean; starts_at: string | null; ends_at: string | null }
export type CatalogResource = { kind: 'passage' | 'vocabulary' | 'recognize' | 'write' | 'poem' | 'accumulation' | 'dictation' | 'grammar' | 'writing' | 'audio' | 'replay' | 'problems'; status: 'available' | 'missing' | 'unverified'; ref?: string; count?: number }
export type LessonRef = { key: string; title: string; book: string; unit: string; kind: string; href?: string; lesson?: number; resources?: CatalogResource[] }
export type CourseConfirmation = { lesson: LessonRef; next_lesson: LessonRef | null; class_items: ChecklistItem[]; homework_items: ChecklistItem[] }
export type CourseOccurrence = OwnedRow & { course_id: string; rule_id: string; original_date: string; starts_at: string; ends_at: string; status: 'scheduled' | 'confirmed' | 'cancelled'; confirmation: CourseConfirmation | null }
export type ReminderRule = { anchor: 'course_start' | 'course_end' | 'deadline'; minutes: number }
export type TaskTemplate = OwnedRow & {
  name: string; subject: Subject | null; course_id: string | null; enabled: boolean; mode: TaskMode
  trigger: 'before_class' | 'after_class' | 'confirmed' | 'unit_completed' | 'weekly' | 'once'
  target: 'current' | 'next' | 'unit'; checklist: string[]; estimated_minutes: number
  deadline: { kind: 'same_day' | 'days_after' | 'next_class' | 'fixed'; time: string; days: number; at: string | null }
  reminders: ReminderRule[]; trigger_minutes: number; weekdays: number[]; scheduled_at: string | null
  lesson_filter: number | null; material_kind: 'general' | 'reading' | 'dictation' | 'recitation'; item_source: 'template' | 'class' | 'homework'
  created_at: string
}
export type ChecklistItem = { id: string; label: string; done: boolean; href?: string }
export type TaskInstance = OwnedRow & {
  title: string; subject: Subject | null; course_id: string | null; occurrence_id: string | null; template_id: string | null
  source_key: string; status: TaskStatus; mode: TaskMode; items: ChecklistItem[]; lesson: LessonRef | null
  due_at: string | null; due_kind: string; due_occurrence_id: string | null; estimated_minutes: number
  material_kind: string; created_at: string
}
export type AvailabilityWindow = OwnedRow & { weekday: number; on_date: string | null; start_time: string; end_time: string; unavailable?: boolean }
export type TaskTimeBlock = OwnedRow & { task_id: string; starts_at: string; ends_at: string }
export type TaskMaterial = OwnedRow & { course_id: string; lesson_key: string; kind: string; title: string; href: string | null; audio: { path: string; label: string }[] }
export type TaskProgress = OwnedRow & { course_id: string; lesson: LessonRef }
export type UnitScope = OwnedRow & { course_id: string; book: string; unit: string; lessons: LessonRef[]; emitted: boolean }
export type TaskReminder = OwnedRow & { task_id: string | null; occurrence_id: string | null; source_key: string; title: string; remind_at: string; status: string; read_at: string | null; exam_id?: string | null; expires_at?: string | null }
export type TaskData = { courses: TaskCourse[]; rules: TimetableRule[]; exceptions: CourseException[]; occurrences: CourseOccurrence[]; templates: TaskTemplate[]; tasks: TaskInstance[]; windows: AvailabilityWindow[]; blocks: TaskTimeBlock[]; materials: TaskMaterial[]; progress: TaskProgress[]; scopes: UnitScope[]; reminders: TaskReminder[]; calendars: TaskCalendar[]; exams: TaskExam[]; preferences: TaskPreference[]; snapshots: TaskSnapshot[] }
export type ProblemGroup = 'pretest' | 'lesson' | 'homework' | 'workbook' | 'supplement'
/** key retains the existing group:id picker API; stable_key is the formal cross-lesson identity. */
export type ProblemOption = { key: string; stable_key: string; id: string; lesson_key: string; group: ProblemGroup; displayId: string; order: number; tags: string[]; title: string; href?: string; replay_ref?: string }
export type CatalogReadiness = { status: 'loading' | 'ready' | 'error'; complete: boolean; error: string | null }
/** Filtering retains authoritative source order; these arrays never reorder the source. */
export type CatalogSelection = { book?: string; units?: string[]; lesson_keys?: string[]; segment_keys?: string[] }
export type CatalogLesson = LessonRef & { order: number }
export type CatalogSnapshotRequest = OwnedRow & { subject: Subject; created_at: string; source: 'builtin' | 'manual'; progression_mode: 'lesson' | 'segment'; selection?: CatalogSelection; teaching_segments?: TeachingSegment[]; manual_lessons?: CatalogLesson[] }
export type CatalogConfigurationIssue = { code: 'missing_teaching_segments' | 'unclosed_teaching_segments'; lesson_keys: string[] }
export type CatalogSnapshotResult = { status: 'ready'; snapshot: CourseCatalogSnapshot; issues: CatalogConfigurationIssue[] } | { status: 'unavailable'; readiness: CatalogReadiness; code: string }
export type MaterialOption = { id: string; title: string; kind: string; preview_ref: string | null }
/** The application supplies shared-material access. No material storage or subject dependency here. */
export type TaskMaterialAdapter = { listForCourse: (courseId: string, scope: CourseScope) => Promise<MaterialOption[]>; pickAssets: (subject: Subject, selectedIds: string[]) => Promise<MaterialOption[]> }
export type TaskCatalogAdapter = {
  chinese: LessonRef[]; math: LessonRef[]; english: LessonRef[]
  loadMathProblems: (key: string) => Promise<ProblemOption[]>
  readiness?: Partial<Record<Subject, CatalogReadiness>>
  readinessFor?: (subject: Subject, selection?: CatalogSelection) => CatalogReadiness
  prepareSnapshot?: (request: CatalogSnapshotRequest) => Promise<CatalogSnapshotResult>
  materials?: TaskMaterialAdapter
}
export type TasksSection = 'tasks' | 'schedule' | 'timetable' | 'pool' | 'templates' | 'materials'

export type TaskCalendar = OwnedRow & { name: string; starts_on: string; ends_on: string | null; created_at: string }
export type TaskExam = OwnedRow & { calendar_id: string | null; course_id: string | null; title: string; starts_at: string; ends_at: string; location: string; notes: string; reminder_minutes: number | null }
export type TimetablePreferences = { week_start: 0 | 1; show_weekends: boolean; start_hour: number; end_hour: number; hour_height: number; hour12: boolean; show_teacher: boolean; show_location: boolean; default_reminder_minutes: number | null }
export type TaskPreference = OwnedRow & { settings: TimetablePreferences }
export type CourseInput = Pick<TaskCourse, 'name' | 'subject'> & Partial<Omit<TaskCourse, 'user_id' | 'created_at' | 'name' | 'subject'>> & { catalog_snapshot?: CourseCatalogSnapshot | null; bindings?: (Pick<CourseTaskBinding, 'pool_item_id' | 'enabled' | 'scope_override' | 'estimated_minutes_override' | 'material_override'> & { id?: string })[] }
export type RuleInput = NormalizedCourseRuleInput | (Omit<TimetableRule, 'id' | 'user_id' | 'course_id'> & { id?: string; kind?: 'timetabled' })
export type TimetableSnapshotPayload = { version: 1 | 2; calendars: Omit<TaskCalendar, 'user_id'>[]; courses: (Omit<TaskCourse, 'user_id' | keyof CourseConfiguration> & Pick<CourseConfiguration, 'course_type'>)[]; rules: (Omit<CourseRule, 'user_id'> | (Omit<TimetableRule, 'user_id'> & { kind?: 'timetabled' }))[]; exams: Omit<TaskExam, 'user_id'>[]; exceptions?: Omit<CourseException, 'user_id'>[]; settings?: TimetablePreferences }
export type TaskSnapshot = OwnedRow & { name: string; payload: TimetableSnapshotPayload; created_at: string }
export type TimetableOccurrence = CourseOccurrence & { preview: boolean }
