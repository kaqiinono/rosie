export type Subject =
  | 'chinese'
  | 'english'
  | 'math'
  | 'art'
  | 'science'
  | 'sports'
  | 'dance'
  | 'piano'
  | 'swimming'
  | 'other'
export const SUBJECTS: Record<Subject, string> = {
  chinese: '语文',
  english: '英语',
  math: '数学',
  art: '美术',
  science: '科学',
  sports: '体育',
  dance: '舞蹈',
  piano: '钢琴',
  swimming: '游泳',
  other: '未分类',
}
export type OwnedRow = { id: string; user_id: string }
export type TimetableCourse = OwnedRow & {
  credits?: number | null
  reminder_minutes?: number | null
  effective_from?: string | null
  rules_revision?: number
  course_type?: 'timetabled' | 'flexible'
  name: string
  subject: Subject
  created_at: string
  calendar_id?: string | null
  teacher?: string
  location?: string
  notes?: string
  color?: string
  archived_at?: string | null
}
export type TimetableRule = OwnedRow & {
  course_id: string
  weekday: number
  start_time: string
  end_time: string
  valid_from: string
  valid_until: string | null
  recurrence?: 'weekly' | 'once' | 'weeks'
  interval_weeks?: number
  anchor_date?: string
  teaching_weeks?: number[]
  disabled_from?: string | null
}
export type CourseException = OwnedRow & {
  rule_id: string
  original_date: string
  cancelled: boolean
  starts_at: string | null
  ends_at: string | null
}
export type CourseOccurrence = OwnedRow & {
  course_id: string
  rule_id: string
  original_date: string
  starts_at: string
  ends_at: string
  status: 'scheduled' | 'cancelled'
}
export type TimetableCalendar = OwnedRow & {
  name: string
  starts_on: string
  ends_on: string | null
  created_at: string
}
export type TimetablePreferences = {
  default_reminder_minutes: number | null
  week_start: 0 | 1
  show_weekends: boolean
  start_hour: number
  end_hour: number
  hour_height: number
  hour12: boolean
  show_teacher: boolean
  show_location: boolean
}
type RuleShape = Omit<TimetableRule, 'id' | 'user_id' | 'course_id' | 'start_time' | 'end_time'>
export type RuleInput = RuleShape & { id?: string } & (
  { kind?: 'timetabled'; start_time: string; end_time: string } |
  { kind: 'flexible'; start_time: null; end_time: null }
)
export type CourseRule = OwnedRow & { course_id: string } & RuleInput
export type TimetableData = {
  courses: TimetableCourse[]
  rules: CourseRule[]
  exceptions: CourseException[]
  preferences: (OwnedRow & { settings: TimetablePreferences })[]
  calendars: TimetableCalendar[]
}
export type TimetableOccurrence = CourseOccurrence

export type CourseInput = Omit<TimetableCourse, keyof OwnedRow | 'created_at' | 'archived_at'> & { id?: string }
