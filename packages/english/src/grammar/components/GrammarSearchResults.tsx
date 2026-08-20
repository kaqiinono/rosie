'use client'

import Link from 'next/link'
import { BACKMATTER_ICONS } from '../grammar-toc'
import type { GrammarMasteryMap } from '../types'
import type { GrammarSearchHit } from '../grammar-search'
import { masteryBadge } from './GrammarHomePage'

/** 摘要高亮：按 ranges 切分片段文本，命中区间套 emerald 高亮 */
function SnippetHighlight({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const parts: { text: string; hit: boolean }[] = []
  let cursor = 0
  for (const [s, e] of sorted) {
    if (s > cursor) parts.push({ text: text.slice(cursor, s), hit: false })
    if (e > s) parts.push({ text: text.slice(s, e), hit: true })
    cursor = Math.max(cursor, e)
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false })
  return (
    <p className="text-text-muted mt-1.5 line-clamp-2 text-xs leading-relaxed">
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded bg-emerald-100 px-0.5 font-bold text-emerald-700">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  )
}

function ResultCard({ hit, mastery }: { hit: GrammarSearchHit; mastery: GrammarMasteryMap }) {
  const { entry } = hit
  const badge = masteryBadge(entry, mastery)
  // 书尾条目不显示延展位编号，以类别图标代替（与首页 UnitCard 一致）
  const badgeContent = entry.locked ? '🔒' : (BACKMATTER_ICONS[entry.category] ?? entry.unitNumber)
  const inner = (
    <>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
          entry.locked
            ? 'bg-surface-dim text-text-muted ring-border-light ring-1'
            : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200'
        }`}
      >
        {badgeContent}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-bold ${entry.locked ? 'text-text-muted' : 'text-text-primary'}`}
        >
          {entry.title}
        </span>
        {entry.titleZh && (
          <span className="text-text-secondary block truncate text-xs">{entry.titleZh}</span>
        )}
        {hit.snippet && <SnippetHighlight text={hit.snippet.text} ranges={hit.snippet.ranges} />}
      </span>
      {badge && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
        >
          {badge.label}
        </span>
      )}
    </>
  )

  if (entry.locked) {
    return (
      <div
        className="bg-surface/60 ring-border-light pointer-events-none flex items-center gap-3 rounded-xl p-3 opacity-60 ring-1"
        aria-disabled
      >
        {inner}
      </div>
    )
  }
  return (
    <Link
      href={`/english/grammar/${entry.unitNumber}`}
      className="bg-surface ring-border-light hover:ring-app-blue/40 flex items-center gap-3 rounded-xl p-3 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {inner}
    </Link>
  )
}

/** 检索结果扁平列表（查询非空时替代首页章节分组视图） */
export default function GrammarSearchResults({
  hits,
  truncated,
  mastery,
}: {
  hits: GrammarSearchHit[]
  /** 命中数达到展示上限（提示缩小关键字） */
  truncated: boolean
  mastery: GrammarMasteryMap
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {hits.map((hit) => (
        <ResultCard key={hit.entry.unitNumber} hit={hit} mastery={mastery} />
      ))}
      {truncated && (
        <p className="text-text-muted py-1 text-center text-xs font-bold">
          结果较多，只显示前 30 条，试试更精确的关键字 🔍
        </p>
      )}
    </div>
  )
}
