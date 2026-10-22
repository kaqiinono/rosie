export type Subject = 'chinese' | 'math' | 'english' | 'dance' | 'piano' | 'swimming' | 'other'
export const SUBJECTS: Record<Subject, string> = { chinese: '语文', math: '纳约数学', english: '厚海英语', dance: '舞蹈', piano: '钢琴', swimming: '游泳', other: '其他' }
export type TaskStatus = 'pending' | 'active' | 'completed' | 'cancelled'
export type TaskMode = 'checklist' | 'reading' | 'audio'
export type OwnedRow = { id: string; user_id: string }
export type TaskCourse = OwnedRow & { name: string; subject: Subject; created_at: string }
export type TimetableRule = OwnedRow & { course_id: string; weekday: number; start_time: string; end_time: string; valid_from: string; valid_until: string | null }
export type CourseException = OwnedRow & { rule_id: string; original_date: string; cancelled: boolean; starts_at: string | null; ends_at: string | null }
export type LessonRef = { key: string; title: string; book: string; unit: string; kind: string; href?: string; lesson?: number }
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
export type TaskReminder = OwnedRow & { task_id: string | null; occurrence_id: string | null; title: string; remind_at: string; status: string; read_at: string | null }
export type TaskData = { courses: TaskCourse[]; rules: TimetableRule[]; exceptions: CourseException[]; occurrences: CourseOccurrence[]; templates: TaskTemplate[]; tasks: TaskInstance[]; windows: AvailabilityWindow[]; blocks: TaskTimeBlock[]; materials: TaskMaterial[]; progress: TaskProgress[]; scopes: UnitScope[]; reminders: TaskReminder[] }
export type ProblemOption = { key: string; title: string; href?: string }
export type TaskCatalogAdapter = { chinese: LessonRef[]; math: LessonRef[]; english: LessonRef[]; loadMathProblems: (key: string) => Promise<ProblemOption[]> }
export type TasksSection = 'tasks' | 'schedule' | 'timetable' | 'templates' | 'materials'
