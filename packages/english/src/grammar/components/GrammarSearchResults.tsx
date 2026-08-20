'use client'

import Link from 'next/link'
import { BACKMATTER_ICONS } from '../grammar-toc'
import { GRAMMAR_BOOKS, type GrammarBookId, type GrammarMasteryMap } from '../types'
import { splitSnippetParts, type GrammarSearchHit } from '../grammar-search'
import type { GrammarOverviewEntry } from '../hooks/useGrammarOverview'

type MasteryBadgeKind = 'new' | 'in-progress' | 'mastered'

export function masteryBadge(
  entry: GrammarOverviewEntry,
  mastery: GrammarMasteryMap,
): { label: string; className: string } | null {
  if (entry.locked) return null
  const record = mastery[`${entry.book}:${entry.unitNumber}`]
  const kind: MasteryBadgeKind = record ? (record.mastered ? 'mastered' : 'in-progress') : 'new'
  if (kind === 'mastered')
    return { label: '⭐ 已掌握', className: 'bg-app-green-light text-app-green-dark' }
  if (kind === 'in-progress') return { label: '练习中', className: 'bg-amber-100 text-amber-700' }
  return { label: '新', className: 'bg-surface-dim text-text-muted ring-1 ring-border-light' }
}

/** 摘要高亮：按 ranges 切分片段文本（重叠区间由 splitSnippetParts 截断），命中区间套 emerald 高亮 */
function SnippetHighlight({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const parts = splitSnippetParts(text, ranges)
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
  // 书尾条目不显示延展位编号，以类别图标代替（与单元列表页 UnitCard 一致）
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
      href={`/english/grammar/${entry.book}/${entry.unitNumber}`}
      className="bg-surface ring-border-light hover:ring-app-blue/40 flex items-center gap-3 rounded-xl p-3 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {inner}
    </Link>
  )
}

/** 检索结果列表：按书划分区域（只展示有命中的书，顺序按 GRAMMAR_BOOKS 定义序） */
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
  const byBook = new Map<GrammarBookId, GrammarSearchHit[]>()
  for (const hit of hits) {
    const list = byBook.get(hit.entry.book) ?? []
    list.push(hit)
    byBook.set(hit.entry.book, list)
  }
  return (
    <div className="flex flex-col gap-5">
      {Object.values(GRAMMAR_BOOKS)
        .filter((b) => byBook.has(b.id))
        .map((b) => (
          <section key={b.id}>
            <h2 className="text-text-primary mb-2 flex items-center gap-2 text-sm font-black">
              <span className="inline-block h-4 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" />
              📗 {b.labelZh}
            </h2>
            <div className="flex flex-col gap-2.5">
              {(byBook.get(b.id) ?? []).map((hit) => (
                <ResultCard
                  key={`${hit.entry.book}:${hit.entry.unitNumber}`}
                  hit={hit}
                  mastery={mastery}
                />
              ))}
            </div>
          </section>
        ))}
      {truncated && (
        <p className="text-text-muted py-1 text-center text-xs font-bold">
          结果较多，只显示前 30 条，试试更精确的关键字 🔍
        </p>
      )}
    </div>
  )
}
