'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { OrbBackground, PageBreadcrumb } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { useGrammarAllUnits, type GrammarOverviewEntry } from '../hooks/useGrammarOverview'
import { useGrammarMastery } from '../hooks/useGrammarMastery'
import { useGrammarSearchIndex } from '../hooks/useGrammarSearchIndex'
import { searchGrammarEntries, type GrammarSearchMode } from '../grammar-search'
import { GRAMMAR_BOOKS, type GrammarBookId } from '../types'
import GrammarSearchResults from './GrammarSearchResults'

/** 书籍卡片 emoji（按 book id） */
const BOOK_EMOJI: Record<GrammarBookId, string> = {
  essential: '📗',
  intermediate: '📘',
  advanced: '📕',
}

/**
 * 语法首页 = 书籍列表 + 全局检索。
 * 检索跨所有书执行（普通检索查元数据，高级检索查 search_text），
 * 结果由 GrammarSearchResults 按书划分区域。
 */
export default function GrammarBooksPage() {
  const { user } = useAuth()
  const { entries: allEntries, isLoading } = useGrammarAllUnits(user)
  const { masteryMap } = useGrammarMastery(user)

  // searchGrammarEntries 需要带 locked 字段的条目；跨书摘要全部视为已解锁
  const searchable = useMemo<GrammarOverviewEntry[]>(
    () => allEntries.map((e) => ({ ...e, locked: false })),
    [allEntries],
  )

  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<GrammarSearchMode>('normal')
  const [index, setIndex] = useState<Map<string, string>>(new Map())
  // load 是 useCallback 产物引用稳定，可安全放入 effect 依赖；
  // 不可依赖 hook 返回的对象字面量（每次渲染新建，会导致 effect 无限重跑）
  const { isLoading: indexLoading, started, error, isEmpty, load } = useGrammarSearchIndex()

  const trimmed = query.trim()
  const searching = trimmed.length > 0

  // 高级模式且查询非空时懒加载索引（模块级缓存兜底重复挂载，只真正拉取一次）
  useEffect(() => {
    if (!searching || mode !== 'advanced') return
    let cancelled = false
    void load().then((map) => {
      if (!cancelled) setIndex(new Map(map))
    })
    return () => {
      cancelled = true
    }
  }, [searching, mode, load])

  const hits = useMemo(
    () => (searching ? searchGrammarEntries(searchable, trimmed, index, mode) : []),
    [searching, searchable, trimmed, index, mode],
  )

  const indexReady = started && !indexLoading && !error && !isEmpty

  return (
    <>
      <OrbBackground variant="home" />

      {/* 面包屑 inline 放在容器内顶部，与内容左缘对齐（fixed 变体宽屏时会落在容器外留白里） */}
      <div className="relative z-1 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-6 px-4 pt-5 pb-16 sm:px-6">
        <div className="w-fit">
          <PageBreadcrumb variant="inline" />
        </div>
        <header className="text-center">
          <div className="animate-bounce-slow inline-block text-5xl">📚</div>
          <h1 className="mt-2 bg-gradient-to-br from-emerald-700 via-teal-600 to-sky-500 bg-clip-text text-[clamp(26px,5vw,34px)] leading-tight font-black text-transparent">
            语法闯关
          </h1>
          <p className="text-text-secondary mt-1.5 text-sm">
            {isLoading && allEntries.length === 0 ? (
              <span className="bg-surface/70 ring-border-light inline-block h-3.5 w-52 animate-pulse rounded-full ring-1 align-middle" />
            ) : (
              <>剑桥语法三件套 · 已解锁 {allEntries.length} 个单元 · 选择一本书开始吧</>
            )}
          </p>
        </header>

        {/* 搜索栏：普通/高级两种模式；查询非空时下方切换为按书分区的结果列表 */}
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
          <div className="relative">
            <span className="text-text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm">
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === 'normal' ? '搜全部语法书，如「进行时」' : '搜讲解内容，如「have been」'}
              aria-label="语法全局检索关键字"
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
                aria-pressed={mode === m.id}
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
          mode === 'advanced' && error ? (
            <div className="bg-surface text-text-muted ring-border-light rounded-2xl p-8 text-center text-sm ring-1">
              检索索引加载失败，清空搜索后重新输入即可重试 🔁
            </div>
          ) : mode === 'advanced' && (indexLoading || !started) ? (
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
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Object.values(GRAMMAR_BOOKS).map((b) => {
              const bookEntries = allEntries.filter((e) => e.book === b.id)
              const mastered = bookEntries.filter(
                (e) => masteryMap[`${b.id}:${e.unitNumber}`]?.mastered,
              ).length
              const empty = bookEntries.length === 0
              return (
                <Link
                  key={b.id}
                  href={`/english/grammar/${b.id}`}
                  className="bg-surface ring-border-light hover:ring-app-blue/40 flex flex-col gap-1.5 rounded-2xl p-5 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="text-4xl">{BOOK_EMOJI[b.id]}</span>
                  <span className="text-text-primary mt-1 text-base font-black">{b.labelZh}</span>
                  <span className="text-text-muted text-xs font-bold">{b.label}</span>
                  {empty ? (
                    <span className="bg-surface-dim text-text-muted mt-1.5 w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                      🌱 内容准备中
                    </span>
                  ) : (
                    <span className="text-text-secondary mt-1.5 text-xs font-bold">
                      已解锁 {bookEntries.length} 单元 · 已掌握 {mastered}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
