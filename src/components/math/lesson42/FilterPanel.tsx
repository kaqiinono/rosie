'use client'

import { memo, useCallback, useState } from 'react'
import Link from 'next/link'
import type { Problem, ProblemSet } from '@/utils/type'
import { SOURCE_LABELS } from '@/utils/constant'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@/utils/masteryUtils'
import ProblemDetail from './ProblemDetail'

const BASE = '/math/ny/42'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'

interface Filters {
  source: Set<string>
  type: Set<string>
  mastery: MasteryFilter
}

interface FilterPanelProps {
  problems: ProblemSet
  solveCount: Record<string, number>
  filters: Filters
  onToggleFilter: (axis: 'source' | 'type', value: string) => void
  onSetMastery: (value: MasteryFilter) => void
}

const SOURCE_BTNS = [
  { key: 'pretest',  label: '📝 课前测' },
  { key: 'lesson',   label: '📖 课堂' },
  { key: 'homework', label: '✏️ 课后' },
  { key: 'workbook', label: '📚 拓展' },
]

const TYPE_BTNS = [
  { key: 'type1', label: '题型1·砝码称重' },
  { key: 'type2', label: '题型2·公平分账' },
  { key: 'type3', label: '题型3·空瓶换水' },
  { key: 'type4', label: '题型4·计时量水' },
  { key: 'type5', label: '题型5·天平找异物' },
]

const MASTERY_BTNS: { key: MasteryFilter; label: string }[] = [
  { key: 'all',       label: '全部' },
  { key: 'unstarted', label: '📚 未做' },
  { key: 'reinforce', label: '🌱 需巩固' },
  { key: 'mastered',  label: '✅ 已掌握' },
]

const TAG_COLORS: Record<string, string> = {
  type1: 'bg-rose-100 text-rose-800',
  type2: 'bg-amber-100 text-amber-800',
  type3: 'bg-green-100 text-green-800',
  type4: 'bg-sky-100 text-sky-800',
  type5: 'bg-purple-100 text-purple-800',
}

function getProblemHref(setName: string, indexInSet: number): string {
  return `${BASE}/${setName}/${indexInSet + 1}`
}

function matchesMastery(count: number, mastery: MasteryFilter): boolean {
  if (mastery === 'all') return true
  if (mastery === 'unstarted') return count === 0
  if (mastery === 'reinforce') return count >= 1 && count < 3
  if (mastery === 'mastered') return count >= 3
  return true
}

const ExpandedCard = memo(function ExpandedCard({
  p, setName, idx, solveCount, isOpen, cardId, onToggle,
}: {
  p: Problem; setName: string; idx: number; solveCount: Record<string, number>
  isOpen: boolean; cardId: string; onToggle: (id: string) => void
}) {
  const count = solveCount[p.id] ?? 0
  const level = getMasteryLevel(count)
  const srcLabel = SOURCE_LABELS[setName] || setName
  return (
    <div className={`rounded-[12px] border-[1.5px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${MASTERY_BORDER[level]}`}>
      <button onClick={() => onToggle(cardId)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] p-3 text-left">
        <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${MASTERY_BADGE_BG[level]}`}>
          {idx + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${TAG_COLORS[p.tag] || 'bg-gray-100 text-gray-600'}`}>{p.tagLabel}</span>
            <span className="rounded-full bg-rose-100 px-2 py-px text-[10px] font-semibold text-rose-700">{srcLabel}</span>
          </div>
        </div>
        <span className="shrink-0 text-base">{MASTERY_ICON[level]}</span>
        <span className={`shrink-0 text-[13px] font-bold text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && (
        <div className="border-t border-border-light px-4 pb-5 pt-3">
          <ProblemDetail problem={p} mode="inline" />
        </div>
      )}
    </div>
  )
})

export default function FilterPanel({ problems, solveCount, filters, onToggleFilter, onSetMastery }: FilterPanelProps) {
  const [showDetail, setShowDetail] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const all: { p: Problem; setName: string; idx: number }[] = []
  ;(Object.entries(problems) as [string, Problem[]][]).forEach(([setName, list]) => {
    list.forEach((p, i) => all.push({ p, setName, idx: i }))
  })

  const filtered = all.filter(
    ({ p, setName }) =>
      filters.source.has(setName) &&
      filters.type.has(p.tag) &&
      matchesMastery(solveCount[p.id] ?? 0, filters.mastery),
  )
  const total = filtered.length
  const mastered = filtered.filter(({ p }) => (solveCount[p.id] ?? 0) >= 3).length
  const attempted = filtered.filter(({ p }) => (solveCount[p.id] ?? 0) >= 1).length
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0

  const toggleDetailMode = useCallback(() => { setShowDetail(v => !v); setCollapsedIds(new Set()) }, [])
  const toggleCard = useCallback((id: string) => {
    setCollapsedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }, [])

  const btnBase = 'cursor-pointer rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95'
  const btnOn  = 'border-rose-600 bg-rose-600 text-white'
  const btnOff = 'border-rose-300 bg-rose-50 text-rose-700'

  return (
    <div>
      <div className="mb-3 rounded-[14px] border border-rose-200 bg-gradient-to-br from-rose-50 to-[#fee2e2] p-4">
        <div className="mb-1.5 text-[15px] font-extrabold text-rose-800">🎯 综合题库 · 第42讲</div>
        <div className="mb-2.5 text-xs text-rose-700">全部{total}道题 · 多选筛选 · 按题型/来源练习</div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-rose-700">📂 来源筛选</div>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_BTNS.map(b => (
              <button key={b.key} onClick={() => onToggleFilter('source', b.key)}
                className={`${btnBase} ${filters.source.has(b.key) ? btnOn : btnOff}`}>{b.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-rose-700">🏷️ 题型筛选</div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_BTNS.map(b => (
              <button key={b.key} onClick={() => onToggleFilter('type', b.key)}
                className={`${btnBase} ${filters.type.has(b.key) ? btnOn : btnOff}`}>{b.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-rose-700">🎯 掌握度</div>
          <div className="flex flex-wrap gap-1.5">
            {MASTERY_BTNS.map(b => (
              <button key={b.key} onClick={() => onSetMastery(b.key)}
                className={`${btnBase} ${filters.mastery === b.key ? btnOn : btnOff}`}>{b.label}</button>
            ))}
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-rose-700">
            <span>练过 <strong className="text-rose-800">{attempted}</strong> 道</span>
            <span className="text-rose-300">·</span>
            <span>🦋 掌握 <strong className="text-rose-800">{mastered}</strong> 道</span>
            <span className="text-rose-300">·</span>
            <span>共 {total} 题</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-rose-100">
              <div className="absolute inset-y-0 left-0 rounded-full bg-rose-200 transition-[width] duration-400"
                style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-rose-500 transition-[width] duration-400"
                style={{ width: `${pct}%` }} />
            </div>
            <button onClick={toggleDetailMode}
              className={`shrink-0 ${btnBase} ${showDetail ? btnOn : `${btnOff} bg-white`}`}>
              {showDetail ? '收起 ↑' : '展开 ↓'}
            </button>
          </div>
        </div>
      </div>

      {showDetail ? (
        <div className="flex flex-col gap-2">
          {filtered.map(({ p, setName, idx }) => (
            <ExpandedCard key={p.id} p={p} setName={setName} idx={idx} solveCount={solveCount}
              isOpen={!collapsedIds.has(p.id)} cardId={p.id} onToggle={toggleCard} />
          ))}
          {filtered.length === 0 && <div className="py-6 text-center text-[13px] text-text-muted">没有符合筛选条件的题目</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ p, setName, idx }) => {
            const count = solveCount[p.id] ?? 0
            const level = getMasteryLevel(count)
            return (
              <Link key={p.id} href={getProblemHref(setName, idx)}
                className={`flex items-center gap-2.5 rounded-[10px] border-[1.5px] bg-white p-3 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all ${MASTERY_BORDER[level]}`}>
                <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${MASTERY_BADGE_BG[level]}`}>
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${TAG_COLORS[p.tag] || 'bg-gray-100 text-gray-600'}`}>{p.tagLabel}</span>
                    <span className="rounded-full bg-rose-100 px-2 py-px text-[10px] font-semibold text-rose-700">{SOURCE_LABELS[setName] || setName}</span>
                  </div>
                </div>
                <div className="shrink-0 text-base">{MASTERY_ICON[level]}</div>
              </Link>
            )
          })}
          {filtered.length === 0 && <div className="col-span-full py-6 text-center text-[13px] text-text-muted">没有符合筛选条件的题目</div>}
        </div>
      )}
    </div>
  )
}
