'use client'

import { useCallback, useId, useMemo, useState } from 'react'
import type { Problem, ProblemSet } from '@rosie/core'
import { Button } from '@rosie/ui/themes'
import type { ProblemDifficulty } from '@rosie/core'
import DifficultyFilterRow from '@rosie/math-kit/components/shared/DifficultyFilterRow'
import ExpandedProblemCard, {
  type ProblemDetailInlineComponent,
} from '@rosie/math-kit/components/shared/ExpandedProblemCard'
import MasonryGrid from '@rosie/math-kit/components/shared/MasonryGrid'
import { useStartPracticeQueue } from '@rosie/math-kit/components/shared/practice-queue/useStartPracticeQueue'
import type { PracticeQueueItem } from '@rosie/math-kit/utils/practice-queue-types'
import { findHelpProblems } from '@rosie/math-kit/utils/practice-help-problems'
import { useMathFavoritesContext } from '@rosie/math-kit/components/MathFavoritesProvider'
import { problemSetSectionLabel } from '@rosie/math-kit/utils/problem-set-helpers'
import { lessonKeyFromHref } from '@rosie/math-kit/utils/lesson-grade'

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
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
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
  { key: 'all', label: '全部' },
  { key: 'unstarted', label: '📚 未做' },
  { key: 'reinforce', label: '🌱 需巩固' },
  { key: 'mastered', label: '✅ 已掌握' },
]

const PRACTICE_BTNS: { key: PracticeFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'unpracticed', label: '✨ 未练习' },
  { key: 'practiced', label: '练过' },
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

  return function FilterPanel({
    problems,
    practiceCount,
    correctCount,
    filters,
    onToggleFilter,
    onSetMastery,
    onSetPractice,
  }: FilterPanelProps) {
    const { favorites } = useMathFavoritesContext()
    const startPractice = useStartPracticeQueue()
    const [favOnly, setFavOnly] = useState(false)
    const [autoExpand, setAutoExpand] = useState(true)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const filterRegionId = useId()
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    const all: { p: Problem; setName: string; idx: number }[] = []
    ;(Object.entries(problems) as [string, Problem[]][]).forEach(([setName, list]) => {
      list.forEach((p, i) => all.push({ p, setName, idx: i }))
    })

    const filtered = all.filter(
      ({ p, setName }) =>
        (filters.source.size === 0 || filters.source.has(setName)) &&
        (filters.type.size === 0 || filters.type.has(p.tag)) &&
        filters.difficulty.has(p.difficulty) &&
        matchesMastery(correctCount[p.id] ?? 0, filters.mastery) &&
        matchesPractice(practiceCount[p.id] ?? 0, filters.practice) &&
        (!favOnly || favorites.has(p.id)),
    )
    const total = filtered.length
    const mastered = filtered.filter(({ p }) => (correctCount[p.id] ?? 0) >= 3).length
    const attempted = filtered.filter(({ p }) => (practiceCount[p.id] ?? 0) >= 1).length
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0
    const allSourceSelected = sourceBtns.every((b) => filters.source.has(b.key))
    const allTypeSelected = typeBtns.every((b) => filters.type.has(b.key))

    const practicePool = useMemo(
      (): PracticeQueueItem[] =>
        filtered.map(({ p, setName, idx }) => ({
          problem: p,
          lessonId,
          section: setName,
          detailHref: getProblemHref(setName, idx),
          helpProblems: findHelpProblems(problems, p, practiceCount),
        })),
      [filtered, problems, practiceCount],
    )

    const beginPractice = useCallback(
      (initialProblemId?: string) => {
        if (practicePool.length === 0) return
        startPractice({
          pool: practicePool,
          source: 'lesson',
          title: title,
          initialProblemId,
          returnHref: base,
        })
      },
      [practicePool, startPractice],
    )

    const allExpanded = total > 0 && filtered.every(({ p }) => expandedIds.has(p.id))

    const toggleAutoExpand = useCallback(() => {
      setAutoExpand((v) => !v)
    }, [])
    const toggleBatchExpand = useCallback(() => {
      setExpandedIds(allExpanded ? new Set() : new Set(filtered.map(({ p }) => p.id)))
    }, [allExpanded, filtered])
    const toggleCard = useCallback((id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }, [])

    return (
      <div>
        <div
          className={`mb-3 rounded-[14px] border ${theme.containerBorder} ${theme.containerGradient} p-4`}
        >
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className={`text-[15px] font-extrabold ${theme.titleColor}`}>{title}</div>
            <Button
              type="button"
              size="1"
              radius="full"
              variant="soft"
              aria-expanded={filtersOpen}
              aria-controls={filterRegionId}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? '收起筛选 ↑' : '展开筛选 ↓'}
            </Button>
          </div>
          <div className={`mb-2.5 text-xs ${theme.labelColor}`}>
            全部{total}道题 · 多选筛选 · 按题型/来源练习
          </div>

          <div id={filterRegionId} hidden={!filtersOpen}>
            <div className="mb-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className={`text-[11px] font-bold ${theme.labelColor}`}>📂 来源筛选</span>
                <Button
                  type="button"
                  size="1"
                  variant="ghost"
                  onClick={() =>
                    sourceBtns.forEach((b) => {
                      if (allSourceSelected || !filters.source.has(b.key))
                        onToggleFilter('source', b.key)
                    })
                  }
                >
                  {allSourceSelected ? '全不选' : '全选'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sourceBtns.map((b) => (
                  <Button
                    key={b.key}
                    type="button"
                    size="1"
                    radius="full"
                    variant={filters.source.has(b.key) ? 'solid' : 'soft'}
                    onClick={() => onToggleFilter('source', b.key)}
                  >
                    {b.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className={`text-[11px] font-bold ${theme.labelColor}`}>🏷️ 题型筛选</span>
                <Button
                  type="button"
                  size="1"
                  variant="ghost"
                  onClick={() =>
                    typeBtns.forEach((b) => {
                      if (allTypeSelected || !filters.type.has(b.key)) onToggleFilter('type', b.key)
                    })
                  }
                >
                  {allTypeSelected ? '全不选' : '全选'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {typeBtns.map((b) => (
                  <Button
                    key={b.key}
                    type="button"
                    size="1"
                    radius="full"
                    variant={filters.type.has(b.key) ? 'solid' : 'soft'}
                    onClick={() => onToggleFilter('type', b.key)}
                  >
                    {b.label}
                  </Button>
                ))}
              </div>
            </div>

            <DifficultyFilterRow
              selected={filters.difficulty}
              onToggle={(level) => onToggleFilter('difficulty', String(level))}
              accentClass={theme.accentClass}
            />

            <div className="mb-2">
              <div className={`mb-1.5 text-[11px] font-bold ${theme.labelColor}`}>📊 练习</div>
              <div className="flex flex-wrap gap-1.5">
                {PRACTICE_BTNS.map((b) => (
                  <Button
                    key={b.key}
                    type="button"
                    size="1"
                    radius="full"
                    variant={filters.practice === b.key ? 'solid' : 'soft'}
                    onClick={() => onSetPractice(b.key)}
                  >
                    {b.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <div className={`mb-1.5 text-[11px] font-bold ${theme.labelColor}`}>🎯 掌握度</div>
              <div className="flex flex-wrap gap-1.5">
                {MASTERY_BTNS.map((b) => (
                  <Button
                    key={b.key}
                    type="button"
                    size="1"
                    radius="full"
                    variant={filters.mastery === b.key ? 'solid' : 'soft'}
                    onClick={() => onSetMastery(b.key)}
                  >
                    {b.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <div className={`mb-1.5 text-[11px] font-bold ${theme.labelColor}`}>⭐ 收藏</div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="1"
                  radius="full"
                  variant={favOnly ? 'solid' : 'soft'}
                  onClick={() => setFavOnly((v) => !v)}
                >
                  {favOnly ? '❤️ 只看收藏' : '🤍 只看收藏'}
                </Button>
              </div>
            </div>

            <div className="mb-2">
              <div className={`mb-1.5 text-[11px] font-bold ${theme.labelColor}`}>📖 题解显示</div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="1"
                  radius="full"
                  variant={autoExpand ? 'solid' : 'soft'}
                  onClick={toggleAutoExpand}
                >
                  自动展开题解
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            <div className={`flex items-center gap-1.5 text-[11px] ${theme.labelColor}`}>
              <span>
                练过 <strong className={theme.strongColor}>{attempted}</strong> 道
              </span>
              <span className={theme.dotColor}>·</span>
              <span>
                🦋 掌握 <strong className={theme.strongColor}>{mastered}</strong> 道
              </span>
              <span className={theme.dotColor}>·</span>
              <span>共 {total} 题</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`relative h-[6px] flex-1 overflow-hidden rounded-full ${theme.progressTrack}`}
              >
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${theme.progressAttempted} transition-[width] duration-400`}
                  style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }}
                />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${theme.progressMastered} transition-[width] duration-400`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <Button
                type="button"
                size="1"
                radius="full"
                variant="solid"
                className="shrink-0"
                onClick={() => beginPractice()}
                disabled={total === 0}
              >
                开始练习
              </Button>
              <Button
                type="button"
                size="1"
                radius="full"
                variant={allExpanded ? 'solid' : 'soft'}
                className="shrink-0"
                onClick={toggleBatchExpand}
              >
                {allExpanded ? '收起 ↑' : '展开 ↓'}
              </Button>
            </div>
          </div>
        </div>

        <MasonryGrid>
          {filtered.map(({ p, setName, idx }) => (
            <ExpandedProblemCard
              key={p.id}
              problem={p}
              index={idx}
              practiceCount={practiceCount}
              correctCount={correctCount}
              tagStyles={tagColors}
              isOpen={expandedIds.has(p.id)}
              onToggle={() => toggleCard(p.id)}
              ProblemDetail={ProblemDetailComponent}
              defaultSolutionOpen={autoExpand}
              sourceLabel={problemSetSectionLabel(setName, lessonId)}
              sourceBadgeClass={theme.srcBadge}
              onActivate={() => beginPractice(p.id)}
            />
          ))}
        </MasonryGrid>
        {filtered.length === 0 && (
          <div className="text-text-muted py-6 text-center text-[13px]">没有符合筛选条件的题目</div>
        )}
      </div>
    )
  }
}
