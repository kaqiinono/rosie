import type { CourseEvent, CourseLessonSnapshot, CourseScope, CourseTaskBinding, MaterialSelector, TaskPoolItem, TaskProgressMode } from './courseTypes'
import type { TaskTemplate } from './types'

export type TaskPoolMatchIssue = { code: 'missing_next_lesson'; event_key: string; binding_id: string; pool_item_id: string }
export type TaskPoolMatchContext = {
  next_lesson_snapshot?: CourseLessonSnapshot | null
  /** Caller verifies the unit boundary/completion from its immutable catalog/progress. */
  completed_unit?: { book: string; unit: string } | null
  /** Missing next targets append actionable issues; no current-content substitution. */
  issues?: TaskPoolMatchIssue[]
}
export type MatchedActivity = {
  pool_item_id: string; binding_id: string; activity_key: string; name: string
  scope: CourseScope; estimated_minutes: number; progress_mode: TaskProgressMode
  material_selector: MaterialSelector; material_status: 'pending' | 'not_required' | 'selected'
  trigger: TaskTemplate['trigger']; target: TaskTemplate['target']; source_key: string
  specificity: number; template: TaskPoolItem; target_snapshot: CourseLessonSnapshot | null
}

export function scopeMatches(scope: CourseScope, event: CourseEvent): boolean {
  const snapshot = event.lesson_snapshot
  switch (scope.kind) {
    case 'all': return true
    case 'lessons': return !!snapshot?.lesson && scope.lesson_keys.includes(snapshot.lesson.key)
    case 'segments': return !!snapshot?.cursor?.segment_key && scope.segment_keys.includes(snapshot.cursor.segment_key)
    case 'unit': return snapshot?.lesson?.book === scope.book && snapshot.lesson.unit === scope.unit
  }
}
function phase(trigger: TaskTemplate['trigger']): string { return trigger === 'confirmed' ? 'after_class' : trigger }
function identity(match: Pick<MatchedActivity, 'activity_key' | 'trigger' | 'target'>): string {
  return [match.activity_key, phase(match.trigger), match.target].map(encodeURIComponent).join(':')
}
const specificity = (scope: CourseScope): number => ({ all: 0, unit: 1, lessons: 2, segments: 3 })[scope.kind]

/** Most specific scope wins; stable ID ordering resolves equal-specificity duplicates. */
export function resolveActivityOverrides(matches: MatchedActivity[]): MatchedActivity[] {
  const result = new Map<string, MatchedActivity>()
  for (const match of matches) {
    const key = match.source_key
    const current = result.get(key)
    if (!current || match.specificity > current.specificity || (match.specificity === current.specificity && match.binding_id.localeCompare(current.binding_id) < 0)) result.set(key, match)
  }
  return [...result.values()]
}

/** Only explicit bindings participate. Missing materials never suppress a selected activity. */
export function matchTaskPool(event: CourseEvent, bindings: CourseTaskBinding[], items: TaskPoolItem[], context: TaskPoolMatchContext = {}): MatchedActivity[] {
  const byId = new Map(items.map(item => [item.id, item]))
  const matches: MatchedActivity[] = []
  for (const binding of bindings) {
    if (binding.course_id !== event.course_id || binding.user_id !== event.user_id || !binding.enabled) continue
    const item = byId.get(binding.pool_item_id)
    if (!item || item.user_id !== event.user_id || !item.enabled || item.trigger === 'weekly' || item.trigger === 'once') continue
    if (item.trigger === 'unit_completed' && (!context.completed_unit || context.completed_unit.book !== event.lesson_snapshot?.lesson?.book || context.completed_unit.unit !== event.lesson_snapshot.lesson.unit)) continue
    const targetSnapshot = item.target === 'next' ? context.next_lesson_snapshot : event.lesson_snapshot
    if (item.target === 'next' && !targetSnapshot?.lesson) {
      context.issues?.push({ code: 'missing_next_lesson', event_key: event.event_key, binding_id: binding.id, pool_item_id: item.id })
      continue
    }
    const scope = binding.scope_override ?? item.scope
    if (!scopeMatches(scope, { ...event, lesson_snapshot: targetSnapshot ?? null })) continue
    const legacyFilter = binding.scope_override === null ? item.lesson_filter : null
    if (legacyFilter !== null && legacyFilter !== targetSnapshot?.lesson?.lesson) continue
    const material = binding.material_override ?? item.material_selector
    const match: MatchedActivity = {
      pool_item_id: item.id, binding_id: binding.id, activity_key: item.activity_key, name: item.name,
      scope, estimated_minutes: binding.estimated_minutes_override ?? item.estimated_minutes,
      progress_mode: item.progress_mode, material_selector: material,
      material_status: material.kind === 'none' ? 'not_required' : material.kind === 'assets' && material.asset_ids.length ? 'selected' : 'pending',
      trigger: item.trigger, target: item.target, source_key: '',
      specificity: specificity(scope) * 2 + (legacyFilter === null ? 0 : 1), template: item, target_snapshot: targetSnapshot ?? null,
    }
    match.source_key = `pool:${encodeURIComponent(event.event_key)}:${identity(match)}`
    matches.push(match)
  }
  return resolveActivityOverrides(matches)
}
