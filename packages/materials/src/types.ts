export type MaterialSubject =
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
export type MaterialScope =
  | { kind: 'all' }
  | { kind: 'unit'; book: string; unit: string }
  | { kind: 'lessons'; lesson_keys: string[] }
  | { kind: 'segments'; segment_keys: string[] }
  | { kind: 'problems'; problem_keys: string[] }
export type MaterialAsset = {
  id: string
  subject: MaterialSubject
  kind: 'text' | 'link' | 'file' | 'image' | 'audio' | 'video' | 'pdf'
  source: 'manual' | 'builtin' | 'baidu'
  account_id: string | null
  fs_id: string | null
  path: string | null
  version: number
  title: string
  mime_type: string
  size: number
  created_by: string
  status: 'ready' | 'archived' | 'pending' | 'account_mismatch'
  text_content: string | null
  href: string | null
}
export type CourseMaterialLink = {
  id: string
  user_id: string
  course_id: string
  asset_id: string
  scope: MaterialScope
  role: string
  sort_order: number
}
export type MaterialContent = {
  lesson?: { key: string; book: string; unit: string } | null
  cursor?: { segment_key: string | null } | null
  problem_keys?: string[]
}
export type AssetSelector =
  | { kind: 'auto' }
  | { kind: 'none' }
  | { kind: 'assets'; asset_ids: string[] }
export type MaterialResolution = {
  status: 'pending' | 'not_required' | 'selected'
  asset_ids: string[]
}
export type MaterialFilters = {
  subject?: MaterialSubject
  kind?: MaterialAsset['kind']
  query?: string
  includeArchived?: boolean
}
