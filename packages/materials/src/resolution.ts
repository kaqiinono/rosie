import type {
  AssetSelector,
  CourseMaterialLink,
  MaterialAsset,
  MaterialContent,
  MaterialResolution,
  MaterialScope,
} from './types'
export function safeMaterialHref(value: string | null): string | null {
  if (
    !value ||
    /[\\\s\u0000-\u001f]/.test(value) ||
    /(?:access_token|refresh_token|token|signature|authorization)=/i.test(value)
  )
    return null
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}
export function scopeMatchesContent(
  scope: MaterialScope,
  content: MaterialContent | null,
): boolean {
  switch (scope.kind) {
    case 'all':
      return true
    case 'unit':
      return content?.lesson?.book === scope.book && content?.lesson?.unit === scope.unit
    case 'lessons':
      return !!content?.lesson && scope.lesson_keys.includes(content.lesson.key)
    case 'segments':
      return (
        !!content?.cursor?.segment_key && scope.segment_keys.includes(content.cursor.segment_key)
      )
    case 'problems':
      return scope.problem_keys.some((key) => content?.problem_keys?.includes(key))
  }
}
/** Same policy as private.task_resolve_materials. Existing snapshots keep archived IDs; new selections require ready. */
export function resolveMaterials(
  user: string,
  course: string | null,
  selector: AssetSelector,
  content: MaterialContent | null,
  assets: MaterialAsset[],
  links: CourseMaterialLink[],
): MaterialResolution {
  if (selector.kind === 'none') return { status: 'not_required', asset_ids: [] }
  const ids =
    selector.kind === 'assets'
      ? selector.asset_ids
      : links
          .filter(
            (l) =>
              l.user_id === user && l.course_id === course && scopeMatchesContent(l.scope, content),
          )
          .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
          .map((l) => l.asset_id)
  const ready = new Set(assets.filter((a) => a.status === 'ready').map((a) => a.id))
  const asset_ids = [...new Set(ids.filter((id) => ready.has(id)))].sort()
  return { status: asset_ids.length ? 'selected' : 'pending', asset_ids }
}
