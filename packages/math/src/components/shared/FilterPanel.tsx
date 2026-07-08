'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Problem, ProblemSet } from '@rosie/core'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@rosie/core'
import type { ProblemDifficulty } from '@rosie/core'
import DifficultyFilterRow from '@rosie/math/components/shared/DifficultyFilterRow'
import ExpandedProblemCard, { type ProblemDetailInlineComponent } from '@rosie/math/components/shared/ExpandedProblemCard'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
import { useStartPracticeQueue } from '@rosie/math/components/shared/practice-queue/useStartPracticeQueue'
import { seaPoolToQueueItems } from '@rosie/math/utils/practice-queue-from-sea'
import { useMathFavoritesContext } from '@rosie/math/components/MathFavoritesProvider'
import type { SeaProblem } from '@rosie/math/utils/sea-data'
import { problemSetSectionLabel } from '@rosie/math/utils/problem-set-helpers'
import { lessonKeyFromHref } from '@rosie/math/utils/lesson-grade'

export type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'
export type PracticeFilter = 'all' | 'unpracticed' | 'practiced'

export interface Filters {
  source: Set<string>
  type: Set<string>
  mastery: MasteryFilter
  practice: PracticeFilter
  difficulty: Set<ProblemDifficulty>
}

export interface FilterPanelProps {
  problems: ProblemSet
  solveCount: Record<string, number>
  filters: Filters
  onToggleFilter: (axis: 'source' | 'type' | 'difficulty', value: string) => void
  onSetMastery: (value: MasteryFilter) => void
  onSetPractice: (value: PracticeFilter) => void
}

interface FilterPanelTheme {
  btnOn: string
  btnOff: string
  containerBorder: string
  containerGradient: string
  titleColor: string
  labelColor: string
  toggleColor: string
  progressTrack: string
  progressAttempted: string
  progressMastered: string
  dotColor: string
  strongColor: string
  srcBadge: string
  accentClass: string
}

export interface FilterPanelConfig {
  base: string
  title: string
  theme: FilterPanelTheme
  sourceBtns: { key: string; label: string }[]
  typeBtns: { key: string; label: string }[]
  tagColors: Record<string, string>
}

const MASTERY_BTNS: { key: MasteryFilter; label: string }[] = [
  { key: 'all',       label: '全部' },
  { key: 'unstarted', label: '📚 未做' },
  { key: 'reinforce', label: '🌱 需巩固' },
  { key: 'mastered',  label: '✅ 已掌握' },
]

const PRACTICE_BTNS: { key: PracticeFilter; label: string }[] = [
  { key: 'all',         label: '全部' },
  { key: 'unpracticed', label: '✨ 未练习' },
  { key: 'practiced',   label: '练过' },
]

function matchesMastery(count: number, mastery: MasteryFilter): boolean {
  if (mastery === 'all') return true
  if (mastery === 'unstarted') return count === 0
  if (mastery === 'reinforce') return count >= 1 && count < 3
  if (mastery === 'mastered') return count >= 3
  return true
}

function matchesPractice(count: number, practice: PracticeFilter): boolean {
  if (practice === 'all') return true
  if (practice === 'unpracticed') return count === 0
  if (practice === 'practiced') return count > 0
  return true
}

export function createFilterPanel(
  config: FilterPanelConfig,
  ProblemDetailComponent: ProblemDetailInlineComponent,
) {
  const { base, title, theme, sourceBtns, typeBtns, tagColors } = config
  const lessonId = lessonKeyFromHref(base) ?? base.split('/').pop() ?? ''

  function getProblemHref(setName: string, indexInSet: number): string {
    return `${base}/${setName}/${indexInSet + 1}`
  }

  return function FilterPanel({ problems, solveCount, filters, onToggleFilter, onSetMastery, onSetPractice }: FilterPanelProps) {
    const { favorites } = useMathFavoritesContext()
    const startPractice = useStartPracticeQueue()
    const [favOnly, setFavOnly] = useState(false)
    const [showDetail, setShowDetail] = useState(false)
    const [autoExpand, setAutoExpand] = useState(false)
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

    const all: { p: Problem; setName: string; idx: number }[] = []
    ;(Object.entries(problems) as [string, Problem[]][]).forEach(([setName, list]) => {
      list.forEach((p, i) => all.push({ p, setName, idx: i }))
    })

    const filtered = all.filter(
      ({ p, setName }) =>
        (filters.source.size === 0 || filters.source.has(setName)) &&
        (filters.type.size === 0 || filters.type.has(p.tag)) &&
        filters.difficulty.has(p.difficulty) &&
        matchesMastery(solveCount[p.id] ?? 0, filters.mastery) &&
        matchesPractice(solveCount[p.id] ?? 0, filters.practice) &&
        (!favOnly || favorites.has(p.id)),
    )
    const total = filtered.length
    const mastered = filtered.filter(({ p }) => (solveCount[p.id] ?? 0) >= 3).length
    const attempted = filtered.filter(({ p }) => (solveCount[p.id] ?? 0) >= 1).length
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0
    const allSourceSelected = sourceBtns.every(b => filters.source.has(b.key))
    const allTypeSelected = typeBtns.every(b => filters.type.has(b.key))

    const practicePool = useMemo((): SeaProblem[] =>
      filtered.map(({ p, setName, idx }) => ({
        problem: p,
        lessonId,
        section: setName,
        href: getProblemHref(setName, idx),
      })),
    [filtered, lessonId])

    const beginPractice = useCallback(
      (initialProblemId?: string) => {
        if (practicePool.length === 0) return
        startPractice({
          pool: seaPoolToQueueItems(practicePool),
          title: title,
          initialProblemId,
          returnHref: base,
        })
      },
      [practicePool, startPractice, title, base],
    )

    const toggleDetailMode = useCallback(() => { setShowDetail(v => !v); setCollapsedIds(new Set()) }, [])
    const toggleAutoExpand = useCallback(() => { setAutoExpand(v => !v) }, [])
    const toggleCard = useCallback((id: string) => {
      setCollapsedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
    }, [])

    const { btnOn, btnOff } = theme
    const btnBase = 'cursor-pointer rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95'

    return (
      <div>
        <div className={`mb-3 rounded-[14px] border ${theme.containerBorder} ${theme.containerGradient} p-4`}>
          <div className={`mb-1.5 text-[15px] font-extrabold ${theme.titleColor}`}>{title}</div>
          <div className={`mb-2.5 text-xs ${theme.labelColor}`}>全部{total}道题 · 多选筛选 · 按题型/来源练习</div>

          <div className="mb-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className={`text-[11px] font-bold ${theme.labelColor}`}>📂 来源筛选</span>
              <button onClick={() => sourceBtns.forEach(b => { if (allSourceSelected || !filters.source.has(b.key)) onToggleFilter('source', b.key) })} className={`cursor-pointer text-[10px] ${theme.toggleColor} transition-colors`}>{allSourceSelected ? '全不选' : '全选'}</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sourceBtns.map(b => (
                <button key={b.key} onClick={() => onToggleFilter('source', b.key)}
                  className={`${btnBase} ${filters.source.has(b.key) ? btnOn : btnOff}`}>{b.label}</button>
              ))}
            </div>
          </div>

          <div className="mb-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className={`text-[11px] font-bold ${theme.labelColor}`}>🏷️ 题型筛选</span>
              <button onClick={() => typeBtns.forEach(b => { if (allTypeSelected || !filters.type.has(b.key)) onToggleFilter('type', b.key) })} className={`cursor-pointer text-[10px] ${theme.toggleColor} transition-colors`}>{allTypeSelected ? '全不选' : '全选'}</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {typeBtns.map(b => (
                <button key={b.key} onClick={() => onToggleFilter('type', b.key)}
                  className={`${btnBase} ${filters.type.has(b.key) ? btnOn : btnOff}`}>{b.label}</button>
              ))}
            </div>
          </div>

          <DifficultyFilterRow
            selected={filters.difficulty}
            onToggle={level => onToggleFilter('difficulty', String(level))}
            btnBase={btnBase}
            btnOn={btnOn}
            btnOff={btnOff}
            accentClass={theme.accentClass}
          />

          <div className="mb-2">
            <div className={`mb-1.5 text-[11px] font-bold ${theme.labelColor}`}>📊 练习</div>
            <div className="flex flex-wrap gap-1.5">
              {PRACTICE_BTNS.map(b => (
                <button key={b.key} onClick={() => onSetPractice(b.key)}
                  className={`${btnBase} ${filters.practice === b.key ? btnOn : btnOff}`}>{b.label}</button>
              ))}
            </div>
          </div>

          <div className="mb-2">
            <div className={`mb-1.5 text-[11px] font-bold ${theme.labelColor}`}>🎯 掌握度</div>
            <div className="flex flex-wrap gap-1.5">
              {MASTERY_BTNS.map(b => (
                <button key={b.key} onClick={() => onSetMastery(b.key)}
                  className={`${btnBase} ${filters.mastery === b.key ? btnOn : btnOff}`}>{b.label}</button>
              ))}
            </div>
          </div>

          <div className="mb-2">
            <div className={`mb-1.5 text-[11px] font-bold ${theme.labelColor}`}>⭐ 收藏</div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFavOnly(v => !v)}
                className={`${btnBase} ${favOnly ? btnOn : btnOff}`}>
                {favOnly ? '❤️ 只看收藏' : '🤍 只看收藏'}
              </button>
            </div>
          </div>

          <div className="mb-2">
            <div className={`mb-1.5 text-[11px] font-bold ${theme.labelColor}`}>📖 题解显示</div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={toggleAutoExpand}
                className={`${btnBase} ${autoExpand ? btnOn : btnOff}`}>
                {autoExpand ? '✅ 自动展开题解' : '⭕ 自动展开题解'}
              </button>
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            <div className={`flex items-center gap-1.5 text-[11px] ${theme.labelColor}`}>
              <span>练过 <strong className={theme.strongColor}>{attempted}</strong> 道</span>
              <span className={theme.dotColor}>·</span>
              <span>🦋 掌握 <strong className={theme.strongColor}>{mastered}</strong> 道</span>
              <span className={theme.dotColor}>·</span>
              <span>共 {total} 题</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`relative h-[6px] flex-1 overflow-hidden rounded-full ${theme.progressTrack}`}>
                <div className={`absolute inset-y-0 left-0 rounded-full ${theme.progressAttempted} transition-[width] duration-400`}
                  style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
                <div className={`absolute inset-y-0 left-0 rounded-full ${theme.progressMastered} transition-[width] duration-400`}
                  style={{ width: `${pct}%` }} />
              </div>
              <button
                onClick={() => beginPractice()}
                disabled={total === 0}
                className={`shrink-0 ${btnBase} ${btnOn} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                开始练习
              </button>
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
              <ExpandedProblemCard
                key={p.id}
                problem={p}
                index={idx}
                solveCount={solveCount}
                tagStyles={tagColors}
                isOpen={!collapsedIds.has(p.id)}
                onToggle={() => toggleCard(p.id)}
                ProblemDetail={ProblemDetailComponent}
                defaultSolutionOpen={autoExpand}
                sourceLabel={problemSetSectionLabel(setName, lessonId)}
                sourceBadgeClass={theme.srcBadge}
              />
            ))}
            {filtered.length === 0 && <div className="py-6 text-center text-[13px] text-text-muted">没有符合筛选条件的题目</div>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(({ p, setName, idx }) => {
              const count = solveCount[p.id] ?? 0
              const level = getMasteryLevel(count)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => beginPractice(p.id)}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-[1.5px] bg-white p-3 text-left shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all ${MASTERY_BORDER[level]}`}
                >
                  <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${MASTERY_BADGE_BG[level]}`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${tagColors[p.tag] || 'bg-gray-100 text-gray-600'}`}>{p.tagLabel}</span>
                      <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${theme.srcBadge}`}>{problemSetSectionLabel(setName, lessonId)}</span>
                      <PracticeCountBadge count={count} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <div className="text-base">{MASTERY_ICON[level]}</div>
                    <FavoriteHeart problemId={p.id} size="sm" />
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && <div className="col-span-full py-6 text-center text-[13px] text-text-muted">没有符合筛选条件的题目</div>}
          </div>
        )}
      </div>
    )
  }
}
