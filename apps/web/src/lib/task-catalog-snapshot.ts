import type { CatalogConfigurationIssue, CatalogReadiness, CatalogSnapshotRequest, CourseCatalogSnapshot, LessonRef, TeachingSegment } from '@rosie/tasks'

/** Normalized sources keep explicit authoritative order, independently of display labels. */
export type OrderedCatalogLesson = LessonRef & { order: number }
export type CatalogSourceInput = Omit<CatalogSnapshotRequest, 'teaching_segments'> & {
  chinese: OrderedCatalogLesson[]; english: OrderedCatalogLesson[]; math: OrderedCatalogLesson[]; manual: OrderedCatalogLesson[]
  teaching_segments: TeachingSegment[]; readiness: CatalogReadiness
}

// Non-security content version, stable in browsers and Node without clocks or crypto APIs.
function contentVersion(value: unknown): string {
  const text = JSON.stringify(value)
  let first = 2166136261, second = 5381
  for (let i = 0; i < text.length; i++) {
    first = Math.imul(first ^ text.charCodeAt(i), 16777619)
    second = Math.imul(second, 33) ^ text.charCodeAt(i)
  }
  return `catalog-v1-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

export function buildCourseCatalogSnapshot(input: CatalogSourceInput): CourseCatalogSnapshot {
  if (!['builtin', 'manual'].includes(input.source)) throw new Error('catalog_source_required')
  if (!['lesson', 'segment'].includes(input.progression_mode)) throw new Error('catalog_progression_required')
  if (input.readiness.status !== 'ready' || !input.readiness.complete || input.readiness.error) throw new Error('catalog_not_ready')
  if (!input.id || !input.user_id || !Number.isFinite(Date.parse(input.created_at))) throw new Error('invalid_snapshot_identity')
  const rows = input.source === 'manual' ? input.manual : input.subject === 'chinese' ? input.chinese : input.subject === 'english' ? input.english : input.subject === 'math' ? input.math : input.manual
  const allKeys = new Set<string>()
  for (const row of rows) {
    if (!row.key || !Number.isFinite(row.order)) throw new Error('invalid_catalog_lesson')
    if (allKeys.has(row.key)) throw new Error('duplicate_lesson_key')
    allKeys.add(row.key)
  }
  const segmentKeys = new Set<string>()
  for (const segment of input.teaching_segments) {
    if (!allKeys.has(segment.lesson_key)) throw new Error('orphan_segment')
    if (!segment.key || segmentKeys.has(segment.key)) throw new Error('duplicate_segment_key')
    segmentKeys.add(segment.key)
    if (segment.completes_lesson !== undefined && typeof segment.completes_lesson !== 'boolean') throw new Error('invalid_segment_completion')
    if (segment.completes_lesson && input.teaching_segments.slice(input.teaching_segments.indexOf(segment) + 1).some(next => next.lesson_key === segment.lesson_key)) throw new Error('premature_lesson_completion')
    if (segment.problem_keys.some(key => !key.startsWith(`${encodeURIComponent(segment.lesson_key)}:`)) || new Set(segment.problem_keys).size !== segment.problem_keys.length) throw new Error('invalid_segment_problem')
  }
  const selection = input.selection
  if (selection?.lesson_keys?.some(key => !allKeys.has(key))) throw new Error('unknown_selected_lesson')
  if (selection?.segment_keys?.some(key => !segmentKeys.has(key))) throw new Error('unknown_selected_segment')
  const selected = rows.filter(row => (!selection?.book || row.book === selection.book) && (!selection?.units || selection.units.includes(row.unit)) && (!selection?.lesson_keys || selection.lesson_keys.includes(row.key)))
    .sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  if (!selected.length) throw new Error('catalog_empty')
  const lessonKeys = new Set(selected.map(row => row.key))
  if (selection?.segment_keys?.some(key => !input.teaching_segments.some(segment => segment.key === key && lessonKeys.has(segment.lesson_key)))) throw new Error('selected_segment_outside_scope')
  const ordered_lessons = selected.map(({ order: _order, ...lesson }) => ({ ...lesson, ...(lesson.resources ? { resources: lesson.resources.map(resource => ({ ...resource })) } : {}) }))
  const teaching_segments = input.teaching_segments.filter(segment => lessonKeys.has(segment.lesson_key) && (!selection?.segment_keys || selection.segment_keys.includes(segment.key)))
    .map(segment => ({ ...segment, problem_keys: [...segment.problem_keys] }))
  const source = input.source
  const progression_mode = input.progression_mode
  const content = { source, progression_mode, subject: input.subject, ordered_lessons, teaching_segments }
  return { id: input.id, user_id: input.user_id, created_at: input.created_at, version: contentVersion(content), ...content }
}

/** Incomplete reads must never replace the last persisted complete catalog. Invalid complete input still throws. */
export function retainCompleteSnapshot(previous: CourseCatalogSnapshot | null, input: CatalogSourceInput): CourseCatalogSnapshot | null {
  if (input.readiness.status !== 'ready' || !input.readiness.complete || input.readiness.error) return previous
  return buildCourseCatalogSnapshot(input)
}

/** Missing future segments are configuration gaps, not failed catalog reads or course completion. */
export function catalogConfigurationIssues(snapshot: CourseCatalogSnapshot): CatalogConfigurationIssue[] {
  if (snapshot.progression_mode !== 'segment') return []
  const missing: string[] = [], unclosed: string[] = []
  for (const lesson of snapshot.ordered_lessons) {
    const segments = snapshot.teaching_segments.filter(segment => segment.lesson_key === lesson.key)
    if (!segments.length || segments.some(segment => !segment.problem_keys.length)) missing.push(lesson.key)
    else if (segments[segments.length - 1].completes_lesson !== true) unclosed.push(lesson.key)
  }
  return [...(missing.length ? [{ code: 'missing_teaching_segments' as const, lesson_keys: missing }] : []), ...(unclosed.length ? [{ code: 'unclosed_teaching_segments' as const, lesson_keys: unclosed }] : [])]
}
