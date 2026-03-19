'use client'

import { memo, useCallback, useState } from 'react'
import Link from 'next/link'
import type { Problem, ProblemSet } from '@/utils/type'
import { SOURCE_LABELS } from '@/utils/constant'
import ProblemDetail from './ProblemDetail'

const BASE = '/math/ny/35'

interface Filters {
  source: Set<string>
  type: Set<string>
}

interface FilterPanelProps {
  problems: ProblemSet
  solved: Record<string, boolean>
  filters: Filters
  onToggleFilter: (axis: 'source' | 'type', value: string) => void
}

const SOURCE_BTNS = [
  { key: 'lesson', label: '📖 课堂' },
  { key: 'homework', label: '✏️ 课后' },
  { key: 'workbook', label: '📚 练习册' },
  { key: 'pretest', label: '📝 课前测' },
]

const TYPE_BTNS = [
  { key: 'type1', label: '基础归一' },
  { key: 'type2', label: '直接倍比' },
  { key: 'type3', label: '双归一' },
  { key: 'type4', label: '反向归一' },
  { key: 'type5', label: '变化归一' },
]

const TAG_COLORS: Record<string, string> = {
  type1: 'bg-app-blue-light text-app-blue-dark',
  type2: 'bg-app-green-light text-app-green-dark',
  type3: 'bg-app-purple-light text-app-purple-dark',
  type4: 'bg-app-orange-light text-app-orange',
  type5: 'bg-app-red-light text-app-red',
}

function getProblemHref(setName: string, indexInSet: number): string {
  return `${BASE}/${setName}/${indexInSet + 1}`
}

/* ── Memoized expanded card ── */
const ExpandedCard = memo(function ExpandedCard({
  p,
  setName,
  idx,
  solved,
  isOpen,
  cardId,
  onToggle,
}: {
  p: Problem
  setName: string
  idx: number
  solved: Record<string, boolean>
  isOpen: boolean
  cardId: string
  onToggle: (id: string) => void
}) {
  const d = solved[p.id]
  const srcLabel = SOURCE_LABELS[setName] || setName
  return (
    <div
      className={`rounded-[12px] border-[1.5px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow ${
        d ? 'border-app-green' : 'border-border-light'
      }`}
    >
      {/* Header row — tap to toggle */}
      <button
        onClick={() => onToggle(cardId)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] p-3 text-left"
      >
        <div
          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            d ? 'bg-app-green-light text-app-green-dark' : 'bg-app-blue-light text-app-blue-dark'
          }`}
        >
          {idx + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <span
              className={`rounded-full px-2 py-px text-[10px] font-semibold ${TAG_COLORS[p.tag] || 'bg-gray-100 text-gray-600'}`}
            >
              {p.tagLabel}
            </span>
            <span className="rounded-full bg-[#f3e8ff] px-2 py-px text-[10px] font-semibold text-[#7e22ce]">
              {srcLabel}
            </span>
          </div>
        </div>
        {d && <span className="shrink-0 text-lg">✅</span>}
        <span
          className={`shrink-0 text-[13px] font-bold text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>

      {/* Detail body — only mounted when open */}
      {isOpen && (
        <div className="border-t border-border-light px-4 pb-5 pt-3">
          <ProblemDetail problem={p} mode="inline" />
        </div>
      )}
    </div>
  )
})

export default function FilterPanel({ problems, solved, filters, onToggleFilter }: FilterPanelProps) {
  const [showDetail, setShowDetail] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const all: { p: Problem; setName: string; idx: number }[] = []
  ;(Object.entries(problems) as [string, Problem[]][]).forEach(([setName, list]) => {
    list.forEach((p, i) => all.push({ p, setName, idx: i }))
  })

  const filtered = all.filter(
    ({ p, setName }) => filters.source.has(setName) && filters.type.has(p.tag),
  )
  const total = filtered.length
  const done = filtered.filter(({ p }) => solved[p.id]).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const toggleDetailMode = useCallback(() => {
    setShowDetail(v => !v)
    setCollapsedIds(new Set())
  }, [])

  const toggleCard = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div>
      {/* Filter header */}
      <div className="mb-3 rounded-[14px] border border-[#e879f9] bg-gradient-to-br from-[#fdf4ff] to-[#f3e8ff] p-4">
        <div className="mb-1.5 text-[15px] font-extrabold text-[#7e22ce]">🎯 综合测试题库</div>
        <div className="mb-2.5 text-xs text-[#6b21a8]">全部29道题 · 多选筛选 · 按题型/来源练习</div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-[#6b21a8]">📂 来源筛选（可多选）</div>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_BTNS.map(b => (
              <button
                key={b.key}
                onClick={() => onToggleFilter('source', b.key)}
                className={`cursor-pointer rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95 ${
                  filters.source.has(b.key)
                    ? 'border-[#a855f7] bg-[#a855f7] text-white'
                    : 'border-[#d8b4fe] bg-[#fdf4ff] text-[#7e22ce]'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-[#6b21a8]">🏷️ 题型筛选（可多选）</div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_BTNS.map(b => (
              <button
                key={b.key}
                onClick={() => onToggleFilter('type', b.key)}
                className={`cursor-pointer rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95 ${
                  filters.type.has(b.key)
                    ? 'border-[#a855f7] bg-[#a855f7] text-white'
                    : 'border-[#d8b4fe] bg-[#fdf4ff] text-[#7e22ce]'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="h-[5px] flex-1 overflow-hidden rounded-sm bg-[#e9d5ff]">
            <div
              className="h-full rounded-sm bg-[#a855f7] transition-[width] duration-400"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="shrink-0 text-[11px] font-bold text-[#6b21a8]">
            {total} 题 · 完成 {done}
          </div>
          <button
            onClick={toggleDetailMode}
            className={`shrink-0 cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[11px] font-semibold transition-all active:scale-95 ${
              showDetail
                ? 'border-[#a855f7] bg-[#a855f7] text-white'
                : 'border-[#d8b4fe] bg-white text-[#7e22ce]'
            }`}
          >
            {showDetail ? '收起 ↑' : '展开 ↓'}
          </button>
        </div>
      </div>

      {/* Problem list */}
      {showDetail ? (
        <div className="flex flex-col gap-2">
          {filtered.map(({ p, setName, idx }) => (
            <ExpandedCard
              key={p.id}
              p={p}
              setName={setName}
              idx={idx}
              solved={solved}
              isOpen={!collapsedIds.has(p.id)}
              cardId={p.id}
              onToggle={toggleCard}
            />
          ))}
          {filtered.length === 0 && (
            <div className="py-6 text-center text-[13px] text-text-muted">
              没有符合筛选条件的题目
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ p, setName, idx }) => {
            const d = solved[p.id]
            const srcLabel = SOURCE_LABELS[setName] || setName
            return (
              <Link
                key={p.id}
                href={getProblemHref(setName, idx)}
                className={`flex items-center gap-2.5 rounded-[10px] border-[1.5px] bg-white p-3 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] ${
                  d ? 'border-app-green' : 'border-transparent hover:border-border-light'
                }`}
              >
                <div
                  className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    d ? 'bg-app-green-light text-app-green-dark' : 'bg-app-blue-light text-app-blue-dark'
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <span
                      className={`rounded-full px-2 py-px text-[10px] font-semibold ${TAG_COLORS[p.tag] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {p.tagLabel}
                    </span>
                    <span className="rounded-full bg-[#f3e8ff] px-2 py-px text-[10px] font-semibold text-[#7e22ce]">
                      {srcLabel}
                    </span>
                  </div>
                </div>
                {d ? (
                  <div className="shrink-0 text-lg text-app-green">✅</div>
                ) : (
                  <div className="shrink-0 text-xl text-text-muted">›</div>
                )}
              </Link>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-6 text-center text-[13px] text-text-muted">
              没有符合筛选条件的题目
            </div>
          )}
        </div>
      )}
    </div>
  )
}
