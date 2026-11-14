import type { HomeworkSubject } from './homework'

export interface PracticeResource {
  id: string
  label: string
  type: 'audio' | 'video' | 'link'
  source: 'auto' | 'manual'
  url: string
  startSeconds?: number
  endSeconds?: number
}
export interface PracticeContentBlock {
  title: string
  text: string
  translation?: string
}
export interface PracticeEntryRow {
  id: string
  label: string
  /** Route parameters plus optional renderer metadata: contentType, requiresRecite,
   * grade/courseOrder. Scope lives in selectionPath; array order alone drives progress. */
  values: Record<string, string>
  /** Navigation metadata only; never changes URL variables or progression order. */
  selectionPath?: { id: string; label: string; level: string }[]
  content?: PracticeContentBlock[]
  resources?: PracticeResource[]
  hiddenResourceIds?: string[]
  resourceStatus?: 'ready' | 'error'
  resourceError?: string
}

/** Older snapshots remain usable without fetching or rewriting their contents. */
export function practiceSelectionPath(row: PracticeEntryRow): NonNullable<PracticeEntryRow['selectionPath']> {
  if (row.selectionPath) return row.selectionPath
  const v = row.values
  const path: NonNullable<PracticeEntryRow['selectionPath']> = []
  const add = (level: string, id: string | undefined, label = id) => {
    if (id && label) path.push({ level, id, label })
  }
  if (v.grade && v.seq) {
    add('年级', v.grade, `${v.grade}年级`)
    add('课程', v.seq, `第${v.seq}讲`)
    add('题目类型', v.section)
  } else if (v.bookSlug) {
    add('教材', v.bookSlug, row.label.split(' · ')[0])
    add('单元', v.unit, `第${v.unit}单元`)
  } else if (v.stage) {
    add('教材', v.stage)
    add('单元', v.unit)
    if (v.sentenceId) add('课程', v.key || v.lesson, v.lesson)
  } else if (v.book && v.unitId) add('教材', v.book)
  return path
}
export interface PracticeEntry {
  id: string
  user_id: string
  name: string
  subject: HomeworkSubject
  path: string
  rows: PracticeEntryRow[]
  updated_at: string
}
/** Newest edit first. Equal timestamps keep a stable id order. */
export function comparePracticeEntriesByUpdatedDesc(a: Pick<PracticeEntry, 'updated_at' | 'id'>, b: Pick<PracticeEntry, 'updated_at' | 'id'>): number {
  return b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id)
}
export interface PracticeBinding {
  key: string
  entryId: string
  name: string
  path: string
  rows: PracticeEntryRow[]
  startId: string | null
}
export function entryVariables(path: string): string[] {
  return [...new Set([...path.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((m) => m[1]))]
}
export function entryHref(path: string, values: Record<string, string>): string {
  const href = path.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, key: string) => {
    if (!values[key]?.trim()) throw new Error(`请填写变量 ${key}`)
    return encodeURIComponent(values[key])
  })
  if (!href.startsWith('/') || href.startsWith('//') || /[\\\s{}]/.test(href) || /%0[ad]/i.test(href))
    throw new Error('请输入以 / 开头的本站相对路径')
  const url = new URL(href, 'https://rosie.invalid')
  if (url.origin !== 'https://rosie.invalid') throw new Error('入口只能打开本站页面')
  return url.pathname + url.search + url.hash
}
export function validateEntry(entry: Pick<PracticeEntry, 'name' | 'subject' | 'path' | 'rows'>): void {
  if (!entry.name.trim()) throw new Error('请填写入口名称')
  if (!['math', 'chinese', 'english', 'life'].includes(entry.subject)) throw new Error('请选择科目')
  const variables = entryVariables(entry.path)
  entryHref(entry.path, Object.fromEntries(variables.map((v) => [v, 'preview'])))
  if (variables.length && !entry.rows.length) throw new Error('请添加练习内容')
  const ids = new Set<string>()
  for (const row of entry.rows) {
    if (!row.id || ids.has(row.id) || !row.label.trim()) throw new Error('内容名称不能为空，内容标识不能重复')
    ids.add(row.id)
    entryHref(entry.path, row.values)
    const resourceIds = new Set<string>()
    for (const resource of row.resources ?? []) {
      if (!resource.id || resourceIds.has(resource.id) || !resource.label.trim()) throw new Error('资源名称不能为空，资源标识不能重复')
      resourceIds.add(resource.id)
      if (!['audio', 'video', 'link'].includes(resource.type) || !['auto', 'manual'].includes(resource.source)) throw new Error('资源类型无效')
      resourceHref(resource.url)
      const start = resource.startSeconds ?? 0
      if (!Number.isFinite(start) || start < 0 || (resource.endSeconds !== undefined && (!Number.isFinite(resource.endSeconds) || resource.endSeconds <= start)))
        throw new Error('资源片段起止时间无效')
    }
  }
}
export function bindEntry(entry: PracticeEntry, startId: string | null): PracticeBinding {
  validateEntry(entry)
  if (entryVariables(entry.path).length && !entry.rows.some((r) => r.id === startId))
    throw new Error('请选择开始项')
  return { key: crypto.randomUUID(), entryId: entry.id, name: entry.name, path: entry.path,
    rows: entryVariables(entry.path).length ? structuredClone(entry.rows) : [], startId }
}

/** Stable same-origin binding URLs or explicit HTTPS media links; no executable schemes. */
export function resourceHref(value: string): string {
  if (value.startsWith('/')) return entryHref(value, {})
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('资源请使用本站相对路径或 HTTPS 直链')
  return url.href
}
export function mergeAutoResources(row: PracticeEntryRow, discovered: PracticeResource[]): PracticeResource[] {
  const hidden = new Set(row.hiddenResourceIds ?? [])
  const available = new Map(discovered.filter((resource) => !hidden.has(resource.id)).map((resource) => [resource.id, resource]))
  const result: PracticeResource[] = []
  for (const resource of row.resources ?? []) {
    const replacement = available.get(resource.id)
    if (resource.source === 'manual') result.push(resource)
    else if (replacement) result.push(replacement)
    available.delete(resource.id)
  }
  return [...result, ...available.values()]
}
