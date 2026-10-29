import type { CourseCatalogSnapshot, CourseCursor, CourseDeadlinePolicy, CourseEvent, CourseLessonSnapshot, CourseRule, CourseTaskBinding, TaskPoolItem } from './courseTypes'
import type { CourseException, CourseOccurrence, TaskCourse } from './types'
import { advanceCourseCursor, deriveCourseEventKey } from './courseProgress'
import { atTime, dateAfter, localDate } from './time'
import { ruleOccursOn } from './timetable'
import { matchTaskPool, type TaskPoolMatchIssue } from './taskPool'

export type EventTiming = { on_date: string; starts_at: string | null; release_at?: string; ends_at?: string | null }
export const SYSTEM_COURSE_DEADLINE: CourseDeadlinePolicy = { kind: 'next_class', days: 1, time: '20:30', at: null }
/** Pool concrete policies override the course. Only explicit course_default inherits. */
export function resolveCourseDeadline(pool: TaskPoolItem['deadline'], course: CourseDeadlinePolicy | null | undefined, event: EventTiming, next: EventTiming | null, phase: string): { due_at: string | null; kind: CourseDeadlinePolicy['kind']; policy: CourseDeadlinePolicy } {
  const policy = pool.kind === 'course_default' ? course ?? SYSTEM_COURSE_DEADLINE : pool as CourseDeadlinePolicy
  const target = phase === 'before_class' ? event : next
  const anchorDate = event.starts_at ? localDate(new Date(event.release_at ?? event.ends_at ?? event.starts_at)) : event.on_date
  let due_at: string | null = null
  if (policy.kind === 'fixed') due_at = policy.at ? new Date(policy.at).toISOString() : null
  if (policy.kind === 'same_day') due_at = atTime(anchorDate, policy.time)
  if (policy.kind === 'days_after') due_at = atTime(dateAfter(anchorDate, policy.days), policy.time)
  if (policy.kind === 'next_class' && target) due_at = target.starts_at ? new Date(target.starts_at).toISOString() : atTime(dateAfter(target.on_date, -policy.days), policy.time)
  return { due_at, kind: policy.kind, policy }
}
export function resolveEventContent(snapshot: CourseCatalogSnapshot, cursor: CourseCursor): CourseLessonSnapshot {
  const lesson = snapshot.ordered_lessons.find(l => l.key === cursor.lesson_key)
  if (!lesson) throw new Error('invalid_course_cursor')
  const segment = snapshot.teaching_segments.find(s => s.key === cursor.segment_key && s.lesson_key === cursor.lesson_key)
  return { lesson, cursor: { ...cursor }, catalog_version: snapshot.version, problem_keys: segment?.problem_keys.slice() ?? [], segment_title: segment?.title ?? null }
}
/** Pure candidate enumeration shared by prediction and UI. It never writes formal tasks. */
export function enumerateCourseEvents(course: TaskCourse, rules: CourseRule[], exceptions: CourseException[], from: string, until: string, stored: CourseEvent[] = [], occurrences: CourseOccurrence[] = []): CourseEvent[] {
  if (course.archived_at) return []
  const result = new Map<string, CourseEvent>()
  if (Date.parse(until)-Date.parse(from)>3660*86400000) throw new Error('event_range_exceeds_limit')
  const dates = new Set<string>()
  for (let date = from; date <= until; date = dateAfter(date, 1)) dates.add(date)
  for (const ex of exceptions) if (ex.ends_at && localDate(new Date(ex.ends_at)) >= from && localDate(new Date(ex.ends_at)) <= until) dates.add(ex.original_date)
  for (const date of [...dates].sort()) {
    for (const rule of rules.filter(r => r.course_id === course.id && r.user_id === course.user_id).sort((a,b) => a.id.localeCompare(b.id))) {
      if (!ruleOccursOn(rule, date)) continue
      const exception = exceptions.find(e => e.rule_id === rule.id && e.original_date === date && e.user_id === course.user_id)
      if (exception?.cancelled || ((date < from || date > until) && !exception?.ends_at)) continue
      const occurrence = occurrences.find(o => o.rule_id === rule.id && o.original_date === date && o.user_id === course.user_id)
      const defaultKey = deriveCourseEventKey(rule.kind === 'timetabled' ? { kind:'timetabled',rule_id:rule.id,on_date:date } : { kind:'flexible',course_id:course.id,on_date:date })
      const saved = stored.find(e => e.user_id === course.user_id && e.course_id === course.id && (e.event_key === defaultKey || e.occurrence_id && e.occurrence_id === occurrence?.id))
      const starts_at = rule.kind === 'timetabled' ? exception?.starts_at ?? atTime(date, rule.start_time) : null
      const ends_at = rule.kind === 'timetabled' ? exception?.ends_at ?? atTime(date, rule.end_time) : null
      const activation = course.automation_enabled_at
      if (activation && (ends_at ? Date.parse(ends_at) < Date.parse(activation) : date < localDate(new Date(activation)))) continue
      const release_at = ends_at ?? new Date(Math.max(Date.parse(atTime(date,'00:00')),activation ? Date.parse(activation) : 0)).toISOString()
      const event_key = saved?.event_key ?? defaultKey
      if (!result.has(event_key)) result.set(event_key, { id:saved?.id ?? `forecast:${event_key}`,user_id:course.user_id,course_id:course.id,rule_id:rule.id,occurrence_id:occurrence?.id ?? null,event_key,on_date:date,starts_at,ends_at,release_at,lesson_snapshot:null,revision:1,assignment_state:'pending',completion_state:'pending',completed_at:null,legacy_confirmation:null,...saved })
    }
  }
  for (const event of stored) {
    if (event.user_id === course.user_id && event.course_id === course.id && event.rule_id === null && event.assignment_state !== 'cancelled' && localDate(new Date(event.release_at)) >= from && localDate(new Date(event.release_at)) <= until) result.set(event.event_key, event)
  }
  return [...result.values()].sort((a,b) => Date.parse(a.release_at)-Date.parse(b.release_at) || a.event_key.localeCompare(b.event_key))
}
export type EventProjectionIssue = TaskPoolMatchIssue | { code: 'missing_segment' | 'missing_catalog'; event_key: string; lesson_key?: string }
/** Project in event order, independently of phase lead time. Never changes the live cursor. */
export function projectCourseEvents(course: TaskCourse, candidates: CourseEvent[], snapshot: CourseCatalogSnapshot | null, bindings: CourseTaskBinding[], items: TaskPoolItem[]) {
  let cursor = course.cursor ?? null
  const issues: EventProjectionIssue[] = []
  const projected: { event: CourseEvent; activities: ReturnType<typeof matchTaskPool>; next_snapshot: CourseLessonSnapshot | null }[] = []
  for (const candidate of candidates) {
    if (candidate.assignment_state === 'cancelled' || candidate.after_processed) continue
    if (course.auto_advance && (!snapshot || !cursor)) { issues.push({ code:'missing_catalog',event_key:candidate.event_key }); break }
    const content = candidate.content_origin === 'explicit' ? candidate.lesson_snapshot : snapshot && cursor ? resolveEventContent(snapshot,cursor) : candidate.lesson_snapshot
    const advancement = snapshot && cursor ? advanceCourseCursor(snapshot,cursor) : null
    const next = snapshot && advancement?.kind === 'next' ? resolveEventContent(snapshot,advancement.cursor) : null
    const event = { ...candidate, lesson_snapshot: content }
    const completed = content?.lesson && (advancement?.kind === 'finished' || next?.lesson && (content.lesson.book !== next.lesson.book || content.lesson.unit !== next.lesson.unit)) ? { book:content.lesson.book,unit:content.lesson.unit } : null
    const matchIssues: TaskPoolMatchIssue[] = []
    const activities = matchTaskPool(event,bindings,items,{ next_lesson_snapshot:next,completed_unit:completed,issues:matchIssues })
    issues.push(...matchIssues); projected.push({ event,activities,next_snapshot:next })
    if (course.auto_advance && advancement) {
      if (advancement.kind === 'missing_segment') { issues.push({ code:'missing_segment',event_key:event.event_key,lesson_key:advancement.lesson_key }); break }
      if (advancement.kind === 'finished') break
      cursor = advancement.cursor
    }
  }
  return { events:projected,issues }
}
/** Null commits one bounded old-config catch-up batch, never the requested edit. */
export async function saveCourseWithCatchup(save: () => Promise<string | null>, refresh: () => Promise<void>): Promise<string> {
  for (let attempt=0; attempt<3; attempt++) {
    const id=await save()
    await refresh()
    if (id) return id
  }
  throw new Error('课程历史补偿处理中，修改已保留，请稍后重试保存。')
}

/** Date-only previews use the date boundary as a task anchor, never as class time. */
export function resolveActivityWindow(event: EventTiming & { release_at: string }, activity: Pick<TaskPoolItem, 'trigger' | 'trigger_minutes' | 'deadline'>, policy: CourseDeadlinePolicy | null, next: EventTiming | null, activation: string | null, now: string) {
  const before = activity.trigger === 'before_class'
  const raw = before ? Date.parse(event.starts_at ?? atTime(event.on_date, '00:00')) - activity.trigger_minutes * 60000 : Date.parse(event.release_at)
  const start = Math.max(raw, activation ? Date.parse(activation) : raw)
  const due_at = resolveCourseDeadline(activity.deadline, policy, event, next, activity.trigger).due_at
  const missedActivation = before && activation && due_at && raw < Date.parse(activation) && Date.parse(due_at) <= Date.parse(activation)
  return { release_at: new Date(start).toISOString(), due_at, eligible: start <= Date.parse(now) && !missedActivation, issues: due_at && raw > Date.parse(due_at) ? ['release_after_deadline'] : [] }
}
