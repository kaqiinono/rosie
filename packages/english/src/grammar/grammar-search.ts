/**
 * 语法首页检索纯函数：分词 / AND 匹配 / 摘要高亮 / 排序。无 React 依赖。
 * 高级模式依赖 search_text 索引（hooks/useGrammarSearchIndex 懒加载）。
 */
import type { GrammarOverviewEntry } from './hooks/useGrammarOverview'

export type GrammarSearchMode = 'normal' | 'advanced'

export interface GrammarSnippet {
  text: string
  /** 关键字在 text 内的 [start, end) 下标区间（供高亮渲染） */
  ranges: [number, number][]
}

export interface GrammarSearchHit {
  entry: GrammarOverviewEntry
  /** meta = 标题/分类命中（advanced 模式下 search_text 头部前缀区命中亦算） */
  hitIn: 'meta' | 'content'
  snippet?: GrammarSnippet
}

export const MAX_RESULTS = 30

export function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase())
}

function metaText(entry: GrammarOverviewEntry): string {
  return `${entry.title} ${entry.titleZh} ${entry.category} ${entry.categoryZh}`.toLowerCase()
}

/** 首个 token 命中位置（haystack 需已小写化）；未命中返回 -1 */
function firstHitIndex(haystack: string, tokens: string[]): number {
  let first = -1
  for (const token of tokens) {
    const i = haystack.indexOf(token)
    if (i !== -1 && (first === -1 || i < first)) first = i
  }
  return first
}

/**
 * 命中摘要：以首个命中位置为中心截取前后 radius 字符窗口，
 * ranges 为全部 token 命中区间映射到片段内的 [start, end) 下标（含前后缀省略号偏移）。
 */
export function buildSnippet(
  searchText: string,
  tokens: string[],
  radius = 30,
): GrammarSnippet | null {
  const lower = searchText.toLowerCase()
  const first = firstHitIndex(lower, tokens)
  if (first === -1) return null
  const start = Math.max(0, first - radius)
  const end = Math.min(searchText.length, first + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < searchText.length ? '…' : ''
  const text = `${prefix}${searchText.slice(start, end)}${suffix}`
  const ranges: [number, number][] = []
  for (const token of tokens) {
    let idx = lower.indexOf(token)
    while (idx !== -1) {
      const s = idx - start + prefix.length
      const e = s + token.length
      if (s < prefix.length + (end - start) && e > prefix.length) {
        ranges.push([Math.max(prefix.length, s), Math.min(text.length - suffix.length, e)])
      }
      idx = lower.indexOf(token, idx + 1)
    }
  }
  return { text, ranges }
}

/**
 * 首页检索入口。
 * - normal：对 entries 元数据过滤（含锁定占位），不带摘要
 * - advanced：仅未锁定且索引有值的条目；search_text 头部即元数据前缀，
 *   首个命中落在前缀区间内视为 meta 命中（排序靠前）
 * 结果：meta 命中在前，同级按 unitNumber 升序，最多 MAX_RESULTS 条。
 */
export function searchGrammarEntries(
  entries: GrammarOverviewEntry[],
  query: string,
  index: Map<string, string>,
  mode: GrammarSearchMode,
): GrammarSearchHit[] {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return []
  const hits: GrammarSearchHit[] = []

  if (mode === 'normal') {
    for (const entry of entries) {
      const mt = metaText(entry)
      if (tokens.every((t) => mt.includes(t))) hits.push({ entry, hitIn: 'meta' })
    }
  } else {
    for (const entry of entries) {
      if (entry.locked) continue
      const searchText = index.get(`${entry.book}:${entry.unitNumber}`)
      if (!searchText) continue
      const lower = searchText.toLowerCase()
      if (!tokens.every((t) => lower.includes(t))) continue
      const metaLen = metaText(entry).length
      const first = firstHitIndex(lower, tokens)
      const hitIn: GrammarSearchHit['hitIn'] = first !== -1 && first < metaLen ? 'meta' : 'content'
      const snippet = buildSnippet(searchText, tokens) ?? undefined
      hits.push({ entry, hitIn, ...(snippet && hitIn === 'content' ? { snippet } : {}) })
    }
  }

  return hits
    .sort(
      (a, b) =>
        (a.hitIn === b.hitIn ? 0 : a.hitIn === 'meta' ? -1 : 1) ||
        a.entry.unitNumber - b.entry.unitNumber,
    )
    .slice(0, MAX_RESULTS)
}
