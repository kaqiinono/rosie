'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { OrbBackground, BackLink } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { useGrammarOverview, type GrammarOverviewEntry } from '../hooks/useGrammarOverview'
import { useGrammarMastery } from '../hooks/useGrammarMastery'
import type { GrammarMasteryMap } from '../types'

type MasteryBadgeKind = 'new' | 'in-progress' | 'mastered'

function masteryBadge(entry: GrammarOverviewEntry, mastery: GrammarMasteryMap): { label: string; className: string } | null {
  if (entry.locked) return null
  const record = mastery[entry.unitNumber]
  const kind: MasteryBadgeKind = record ? (record.mastered ? 'mastered' : 'in-progress') : 'new'
  if (kind === 'mastered') return { label: '⭐ 已掌握', className: 'bg-app-green-light text-app-green-dark' }
  if (kind === 'in-progress') return { label: '练习中', className: 'bg-amber-100 text-amber-700' }
  return { label: '新', className: 'bg-surface-dim text-text-muted ring-1 ring-border-light' }
}

function UnitCard({ entry, mastery }: { entry: GrammarOverviewEntry; mastery: GrammarMasteryMap }) {
  const badge = masteryBadge(entry, mastery)
  const inner = (
    <>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
          entry.locked
            ? 'bg-surface-dim text-text-muted ring-1 ring-border-light'
            : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200'
        }`}
      >
        {entry.locked ? '🔒' : entry.unitNumber}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-bold ${entry.locked ? 'text-text-muted' : 'text-text-primary'}`}>
          {entry.title}
        </span>
        {entry.titleZh && <span className="block truncate text-xs text-text-secondary">{entry.titleZh}</span>}
      </span>
      {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>}
    </>
  )

  if (entry.locked) {
    return (
      <div className="pointer-events-none flex items-center gap-3 rounded-xl bg-surface/60 p-3 opacity-60 ring-1 ring-border-light" aria-disabled>
        {inner}
      </div>
    )
  }
  return (
    <Link
      href={`/english/grammar/${entry.unitNumber}`}
      className="flex items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-border-light transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-app-blue/40"
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
    () => entries.filter((e) => !e.locked && masteryMap[e.unitNumber]?.mastered).length,
    [entries, masteryMap],
  )

  // 按 categoryZh 分组，保持索引/DB 原顺序
  const groups = useMemo(() => {
    const out: { category: string; categoryZh: string; items: GrammarOverviewEntry[] }[] = []
    for (const entry of entries) {
      const last = out[out.length - 1]
      if (last && last.category === entry.category) {
        last.items.push(entry)
      } else {
        out.push({ category: entry.category, categoryZh: entry.categoryZh, items: [entry] })
      }
    }
    return out
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
          <p className="mt-1.5 text-sm text-text-secondary">
            《剑桥初级英语语法》· 已解锁 {unlockedCount}/{totalCount} · 已掌握 {masteredCount}
          </p>
        </header>

        {isLoading && entries.length === 0 ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface/70 ring-1 ring-border-light" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl bg-surface p-8 text-center text-sm text-text-muted ring-1 ring-border-light">
            还没有单元内容，先用提取脚本入库第一个单元吧 🌱
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group, gi) => (
              <section key={`${group.category}-${gi}`}>
                <h2 className="mb-2.5 flex items-center gap-2 text-sm font-black text-text-primary">
                  <span className="inline-block h-4 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" />
                  {group.categoryZh || group.category || '未分类'}
                </h2>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {group.items.map((entry) => (
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
