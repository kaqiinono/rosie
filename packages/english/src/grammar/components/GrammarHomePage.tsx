'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { OrbBackground, PageBreadcrumb } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { useGrammarOverview, type GrammarOverviewEntry } from '../hooks/useGrammarOverview'
import { useGrammarMastery } from '../hooks/useGrammarMastery'
import { useGrammarSearchIndex } from '../hooks/useGrammarSearchIndex'
import { GRAMMAR_TOC_SECTIONS, BACKMATTER_ICONS } from '../grammar-toc'
import { searchGrammarEntries, type GrammarSearchMode } from '../grammar-search'
import type { GrammarMasteryMap } from '../types'
import GrammarSearchResults from './GrammarSearchResults'

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

  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<GrammarSearchMode>('normal')
  const [index, setIndex] = useState<Map<string, string>>(new Map())
  const searchIndex = useGrammarSearchIndex()

  const trimmed = query.trim()
  const searching = trimmed.length > 0

  // 高级模式且查询非空时懒加载索引（模块级缓存兜底重复挂载，只真正拉取一次）
  useEffect(() => {
    if (!searching || mode !== 'advanced') return
    let cancelled = false
    void searchIndex.load().then((map) => {
      if (!cancelled) setIndex(new Map(map))
    })
    return () => {
      cancelled = true
    }
  }, [searching, mode, searchIndex])

  const hits = useMemo(
    () => (searching ? searchGrammarEntries(entries, trimmed, index, mode) : []),
    [searching, entries, trimmed, index, mode],
  )

  const indexReady = !searchIndex.isLoading && !searchIndex.isEmpty

  return (
    <>
      <OrbBackground variant="home" />

      {/* 面包屑 inline 放在容器内顶部，与内容左缘对齐（fixed 变体宽屏时会落在容器外留白里） */}
      <div className="relative z-1 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-6 px-4 pt-5 pb-16 sm:px-6">
        <div className="w-fit">
          <PageBreadcrumb variant="inline" />
        </div>
        <header className="text-center">
          <div className="animate-bounce-slow inline-block text-5xl">📗</div>
          <h1 className="mt-2 bg-gradient-to-br from-emerald-700 via-teal-600 to-sky-500 bg-clip-text text-[clamp(26px,5vw,34px)] leading-tight font-black text-transparent">
            语法闯关
          </h1>
          <p className="text-text-secondary mt-1.5 text-sm">
            《剑桥初级英语语法》· 已解锁 {unlockedCount}/{totalCount} · 已掌握 {masteredCount}
          </p>
        </header>

        {/* 搜索栏：普通/高级两种模式；查询非空时下方切换为扁平结果列表 */}
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
          <div className="relative">
            <span className="text-text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm">
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === 'normal' ? '搜标题 / 分类，如「进行时」' : '搜讲解内容，如「have been」'}
              className="bg-surface ring-border-light focus:ring-app-blue/50 w-full rounded-full py-2.5 pr-10 pl-10 text-sm font-bold outline-none ring-1 transition-shadow focus:ring-2"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="清空搜索"
                className="text-text-muted hover:text-text-primary absolute top-1/2 right-3 -translate-y-1/2 text-base font-black"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex justify-center gap-1.5">
            {(
              [
                { id: 'normal', label: '🔍 普通检索' },
                { id: 'advanced', label: '🧠 高级检索' },
              ] as { id: GrammarSearchMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                  mode === m.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200'
                    : 'bg-surface-dim text-text-secondary'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {searching ? (
          mode === 'advanced' && searchIndex.isLoading ? (
            <div className="bg-surface text-text-muted ring-border-light rounded-2xl p-8 text-center text-sm ring-1">
              正在加载检索索引…
            </div>
          ) : mode === 'advanced' && !indexReady ? (
            <div className="bg-surface text-text-muted ring-border-light rounded-2xl p-8 text-center text-sm ring-1">
              高级检索索引尚未生成，请先运行回填脚本 ✨
            </div>
          ) : hits.length === 0 ? (
            <div className="bg-surface text-text-muted ring-border-light rounded-2xl p-8 text-center text-sm ring-1">
              没有找到相关单元，换个关键字试试，或
              <Link href="/ai" className="mx-1 font-bold text-sky-600 underline">
                问 AI 助手
              </Link>
              🤖
            </div>
          ) : (
            <GrammarSearchResults hits={hits} truncated={hits.length >= 30} mastery={masteryMap} />
          )
        ) : isLoading && entries.length === 0 ? (
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
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
