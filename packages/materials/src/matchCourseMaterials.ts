import type { MaterialCatalogProjection } from './components/CourseMaterialList'
import type { MaterialScope } from './types'
export type MaterialFile = {
  account_id: string
  fs_id: string
  path: string
  name: string
  mime: string
  size: number
  asset_id?: string
}
export type MatchCandidate = { label: string; scope: MaterialScope }
export type MatchSuggestion = {
  file: MaterialFile
  scope: MaterialScope | null
  confidence: 'exact' | 'ambiguous' | 'unmatched'
  reasons: string[]
  candidates: MatchCandidate[]
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const token = (text: string, key: string) =>
  new RegExp(`(^|[^a-z0-9])${escape(key)}(?=$|[^a-z0-9])`, 'i').test(text)
export function suggestCourseMaterialLinks(
  files: MaterialFile[],
  snapshot: MaterialCatalogProjection,
): MatchSuggestion[] {
  return files.map((file) => {
    const text = file.path
    let candidates: MatchCandidate[] = (snapshot.problems ?? [])
      .filter(
        (p) =>
          token(text, p.stable_key) ||
          (p.aliases ?? []).some((a) => token(text, a)) ||
          text.includes(p.label),
      )
      .map((p) => ({ label: p.label, scope: { kind: 'problems', problem_keys: [p.stable_key] } }))
    if (!candidates.length)
      candidates = snapshot.lessons
        .filter((l) => {
          const ul = l.key.match(/u(\d+)l(\d+)/i)
          return ul
            ? token(text, `U${ul[1]}L${ul[2]}`)
            : token(text, l.key) || (l.title.length >= 2 && text.includes(l.title))
        })
        .map((l) => ({
          label: `${l.book} · ${l.unit} · ${l.title}`,
          scope: { kind: 'lessons', lesson_keys: [l.key] },
        }))
    return {
      file,
      candidates,
      scope: candidates.length === 1 ? candidates[0].scope : null,
      confidence: candidates.length === 1 ? 'exact' : candidates.length ? 'ambiguous' : 'unmatched',
      reasons: [
        candidates.length === 1
          ? '名称命中，请核对目录与范围'
          : candidates.length
            ? '有多个候选，请手动选择'
            : '未找到候选，可手动选择范围',
      ],
    }
  })
}
