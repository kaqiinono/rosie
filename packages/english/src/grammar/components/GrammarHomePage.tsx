'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { OrbBackground, BackLink } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { useGrammarOverview, type GrammarOverviewEntry } from '../hooks/useGrammarOverview'
import { useGrammarMastery } from '../hooks/useGrammarMastery'
import { GRAMMAR_TOC_SECTIONS, BACKMATTER_ICONS } from '../grammar-toc'
import type { GrammarMasteryMap } from '../types'

type MasteryBadgeKind = 'new' | 'in-progress' | 'mastered'

function masteryBadge(
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

function UnitCard({ entry, mastery }: { entry: GrammarOverviewEntry; mastery: GrammarMasteryMap }) {
  const badge = masteryBadge(entry, mastery)
  // 书尾条目不显示延展位编号，以类别图标代替
  const badgeContent = entry.locked
    ? '🔒'
    : (BACKMATTER_ICONS[entry.category] ?? entry.unitNumber)
  const hasSupp = (entry.suppEntries?.length ?? 0) > 0
  const hasGuide = (entry.studyGuideUnits?.length ?? 0) > 0
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
      </span>
      {(badge || hasSupp || hasGuide) && (
        <span className="flex shrink-0 flex-col items-end gap-1">
          {badge && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
          {(hasSupp || hasGuide) && (
            <span className="flex gap-1">
              {hasSupp && (
                <span
                  className="bg-app-purple-light text-app-purple-dark rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  title={`有补充练习（${entry.suppEntries?.length} 条）`}
                >
                  ✏️ 补充
                </span>
              )}
              {hasGuide && (
                <span
                  className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700"
                  title={`有学习指导（${entry.studyGuideUnits?.length} 页）`}
                >
                  🧭 指导
                </span>
              )}
            </span>
          )}
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

export default function GrammarHomePage() {
  const { user } = useAuth()
  const { entries, unlockedCount, totalCount, isLoading } = useGrammarOverview(user)
  const { masteryMap } = useGrammarMastery(user)

  const masteredCount = useMemo(
    () =>
      entries.filter((e) => !e.locked && masteryMap[`${e.book}:${e.unitNumber}`]?.mastered).length,
    [entries, masteryMap],
  )

  // 按原书目录章节（GRAMMAR_TOC_SECTIONS）分区，与单元页目录侧栏一致；
  // DB 的 category 粒度过细（一般现在时/现在进行时等），不适合作分区依据
  const groups = useMemo(() => {
    const byUnit = new Map(entries.map((e) => [e.unitNumber, e]))
    return GRAMMAR_TOC_SECTIONS.map((section) => {
      const items: GrammarOverviewEntry[] = []
      for (let n = section.from; n <= section.to; n++) {
        const entry = byUnit.get(n)
        if (entry) items.push(entry)
      }
      return { section, items }
    }).filter((g) => g.items.length > 0)
  }, [entries])

  return (
    <>
      <OrbBackground variant="home" />
      <BackLink />

      <div className="relative z-1 mx-auto flex min-h-screen w-full max-w-[860px] flex-col gap-6 px-4 pt-20 pb-16 sm:px-6">
        <header className="text-center">
          <div className="animate-bounce-slow inline-block text-5xl">📗</div>
          <h1 className="mt-2 bg-gradient-to-br from-emerald-700 via-teal-600 to-sky-500 bg-clip-text text-[clamp(26px,5vw,34px)] leading-tight font-black text-transparent">
            语法闯关
          </h1>
          <p className="text-text-secondary mt-1.5 text-sm">
            《剑桥初级英语语法》· 已解锁 {unlockedCount}/{totalCount} · 已掌握 {masteredCount}
          </p>
        </header>

        {isLoading && entries.length === 0 ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface/70 ring-border-light h-16 animate-pulse rounded-xl ring-1"
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-surface text-text-muted ring-border-light rounded-2xl p-8 text-center text-sm ring-1">
            还没有单元内容，先用提取脚本入库第一个单元吧 🌱
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(({ section, items }) => (
              <section key={section.id}>
                <h2 className="text-text-primary mb-2.5 flex items-center gap-2 text-sm font-black">
                  <span className="inline-block h-4 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" />
                  {section.titleZh}
                  {/* 书尾分区不显示延展位编号区间 */}
                  {!section.backmatter && (
                    <span className="text-text-muted text-xs font-bold">
                      Unit{' '}
                      {section.from === section.to ? section.from : `${section.from}–${section.to}`}
                    </span>
                  )}
                  {section.id === 'study-guide' && (
                    <Link
                      href="/english/grammar/study-guide"
                      className="ml-auto rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-200"
                    >
                      📖 总览
                    </Link>
                  )}
                </h2>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {items.map((entry) => (
                    <UnitCard key={entry.unitNumber} entry={entry} mastery={masteryMap} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
