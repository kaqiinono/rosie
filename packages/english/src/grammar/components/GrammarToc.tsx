'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { STORAGE_KEYS, useAuth, useLocalStorage } from '@rosie/core'
import { useGrammarMastery } from '../hooks/useGrammarMastery'
import { useGrammarToc, type GrammarTocEntry, type GrammarTocGroup } from '../grammar-toc'
import { BACKMATTER_ICONS } from '../grammar-toc'
import type { GrammarBookId } from '../types'

/** 单元行：编号徽章 + 标题；当前单元高亮，锁定单元不可点击 */
function UnitRow({
  entry,
  active,
  mastered,
  onNavigate,
}: {
  entry: GrammarTocEntry
  active: boolean
  mastered: boolean
  onNavigate?: () => void
}) {
  const inner = (
    <>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
          entry.locked
            ? 'bg-surface-dim text-text-muted'
            : active
              ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white'
              : 'bg-surface-dim text-text-secondary'
        }`}
      >
        {entry.locked ? '🔒' : (BACKMATTER_ICONS[entry.category] ?? entry.unitNumber)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-xs ${active ? 'font-black text-emerald-700' : entry.locked ? 'text-text-muted' : 'text-text-primary font-bold'}`}
        >
          {entry.title}
        </span>
        {entry.titleZh && entry.titleZh !== entry.title && (
          <span className="text-text-muted block truncate text-[10px]">{entry.titleZh}</span>
        )}
      </span>
      {mastered && !entry.locked && (
        <span className="shrink-0 text-[11px] font-black text-emerald-500">✓</span>
      )}
    </>
  )

  if (entry.locked) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 opacity-60" aria-disabled>
        {inner}
      </div>
    )
  }
  return (
    <Link
      href={`/english/grammar/${entry.book}/${entry.unitNumber}`}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
        active ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-surface-dim'
      }`}
    >
      {inner}
    </Link>
  )
}

/** 章节分组列表（桌面侧栏与移动抽屉共用） */
function TocList({
  groups,
  currentUnit,
  openSections,
  onToggleSection,
  currentRef,
  onNavigate,
}: {
  groups: GrammarTocGroup[]
  currentUnit: number
  openSections: Set<string>
  onToggleSection: (id: string) => void
  currentRef: (el: HTMLDivElement | null) => void
  onNavigate?: () => void
}) {
  const { user } = useAuth()
  const { masteryMap } = useGrammarMastery(user)

  if (groups.length === 0) {
    return <div className="text-text-muted px-4 py-6 text-center text-xs">目录加载中…</div>
  }

  return groups.map(({ section, items }) => {
    const open = openSections.has(section.id)
    return (
      <div key={section.id}>
        <button
          type="button"
          onClick={() => onToggleSection(section.id)}
          className="hover:bg-surface-dim flex min-h-9 w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors"
          aria-expanded={open}
        >
          <span
            className={`text-text-muted shrink-0 text-[9px] transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          >
            ▶
          </span>
          <span className="text-text-primary min-w-0 flex-1 truncate text-xs font-black">
            {section.titleZh}
          </span>
          <span className="text-text-muted shrink-0 text-[10px]">
            {section.from === section.to ? section.from : `${section.from}–${section.to}`}
          </span>
        </button>
        {open && (
          <div className="mt-0.5 flex flex-col gap-0.5 pb-1.5">
            {items.map((entry) => {
              const active = entry.unitNumber === currentUnit
              return (
                <div key={entry.unitNumber} ref={active ? currentRef : undefined}>
                  <UnitRow
                    entry={entry}
                    active={active}
                    mastered={masteryMap[`${entry.book}:${entry.unitNumber}`]?.mastered ?? false}
                    onNavigate={onNavigate}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  })
}

/**
 * 语法单元页目录：参考原书目录页（v-viii）按章节分组。
 * - 桌面（lg+）：sticky 侧栏，可收起为窄条（localStorage 持久化）；
 *   侧栏断点取 lg 而非 md：768-1024px 区间内 248px 侧栏会过度挤压内容列，
 *   该区间同样走抽屉模式。
 * - 移动/平板：左下角悬浮胶囊 + 抽屉覆盖层，收起时不占用页面空间；点击单元后自动收起
 */
export default function GrammarToc({
  currentUnit,
  book = 'essential' as GrammarBookId,
}: {
  currentUnit: number
  book?: GrammarBookId
}) {
  const { user } = useAuth()
  const { groups } = useGrammarToc(user, book)
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(
    STORAGE_KEYS.GRAMMAR_SIDEBAR_COLLAPSED,
    false,
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  const currentSectionId = useMemo(
    () =>
      groups.find((g) => currentUnit >= g.section.from && currentUnit <= g.section.to)?.section.id,
    [groups, currentUnit],
  )

  // 默认只展开当前单元所在章节；overrides 记录用户手动切换过的章节（XOR 语义）
  const [overrides, setOverrides] = useState<Set<string>>(() => new Set())
  const toggleSection = (id: string) =>
    setOverrides((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const openSections = useMemo(
    () =>
      new Set(
        groups
          .filter((g) => (g.section.id === currentSectionId) !== overrides.has(g.section.id))
          .map((g) => g.section.id),
      ),
    [groups, currentSectionId, overrides],
  )

  // 展开/打开抽屉时把当前单元滚动到可视区
  const currentRef = useRef<HTMLDivElement | null>(null)
  const visible = !collapsed || mobileOpen
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(
      () => currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      120,
    )
    return () => clearTimeout(t)
  }, [visible, currentUnit])

  const closeMobile = () => setMobileOpen(false)

  // 抽屉打开时锁定背景滚动（移动端抽屉内滚动不应带动页面滚动）
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  const list = (
    <TocList
      groups={groups}
      currentUnit={currentUnit}
      openSections={openSections}
      onToggleSection={toggleSection}
      currentRef={(el) => {
        currentRef.current = el
      }}
      onNavigate={closeMobile}
    />
  )

  return (
    <>
      {/* 桌面 sticky 侧栏（lg+；md 区间归入抽屉模式，避免挤压内容列） */}
      <aside
        className={`bg-surface/90 ring-border-light sticky top-5 z-20 hidden shrink-0 self-start overflow-hidden rounded-2xl shadow-sm ring-1 backdrop-blur-sm transition-[width] duration-200 lg:block ${
          collapsed ? 'w-11' : 'w-[248px]'
        }`}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="展开目录"
            className="hover:bg-surface-dim flex h-12 w-full items-center justify-center text-base transition-colors"
          >
            ☰
          </button>
        ) : (
          <div className="flex h-[calc(100vh-2.5rem)] flex-col">
            <div className="border-border-light flex shrink-0 items-center justify-between border-b px-3 py-2.5">
              <span className="text-text-primary text-sm font-black">📗 目录</span>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="收起目录"
                className="text-text-muted hover:bg-surface-dim rounded-md px-1.5 py-0.5 text-xs transition-colors"
              >
                ◀◀
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-2">{list}</nav>
          </div>
        )}
      </aside>

      {/* 移动/平板：左下角悬浮胶囊（避开右下 AI 助手）+ 抽屉 */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="打开目录"
        className={`bg-surface ring-border-light fixed bottom-4 left-3 z-30 flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-md ring-1 transition-all active:scale-95 lg:hidden ${
          mobileOpen ? 'pointer-events-none opacity-0' : ''
        }`}
      >
        📗 目录
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="单元目录"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="bg-surface absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="border-border-light flex h-12 shrink-0 items-center justify-between border-b px-3">
              <span className="text-text-primary text-sm font-black">📗 目录</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="关闭目录"
                className="text-text-muted hover:bg-surface-dim flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-2">{list}</nav>
          </div>
        </div>
      )}
    </>
  )
}
