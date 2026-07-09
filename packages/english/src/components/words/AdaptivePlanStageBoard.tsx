'use client'

import { useMemo, useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { findWordByKey } from '../../utils/english-helpers'
import {
  ADAPTIVE_BOX_STAGES,
  ADAPTIVE_MASTERED_STAGE,
  adaptiveBoxStage,
  adaptiveStageSortKey,
} from '../../utils/adaptivePlanStages'
import type { AdaptivePlanWordProgress } from '../../utils/adaptivePlanTypes'

type AdaptivePlanStageBoardProps = {
  rows: AdaptivePlanWordProgress[]
  vocab: WordEntry[]
}

type StageFilter = 'all' | 'learning' | 'queue' | 'mastered' | 1 | 2 | 3 | 4 | 5

function displayWord(key: string, vocab: WordEntry[]): string {
  const entry = findWordByKey(vocab, key)
  if (entry) return entry.word
  const parts = key.split('::')
  return parts[parts.length - 1] || key
}

function displayMeta(key: string, vocab: WordEntry[]): string {
  const entry = findWordByKey(vocab, key)
  if (!entry) return key
  return `${entry.unit} · ${entry.lesson}`
}

export default function AdaptivePlanStageBoard({ rows, vocab }: AdaptivePlanStageBoardProps) {
  const [filter, setFilter] = useState<StageFilter>('all')
  const [expanded, setExpanded] = useState(false)

  const activeRows = useMemo(
    () => rows.filter((row) => row.archivedAt == null),
    [rows],
  )

  const counts = useMemo(() => {
    const byBox = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let mastered = 0
    let pending = 0
    let notStarted = 0
    for (const row of activeRows) {
      if (row.status === 'MASTERED') {
        mastered += 1
        continue
      }
      if (row.status === 'LEARNING') {
        const box = adaptiveBoxStage(row.boxIndex).box
        byBox[box] += 1
        continue
      }
      if (row.status === 'LEARNING_PENDING') pending += 1
      else notStarted += 1
    }
    return { byBox, mastered, pending, notStarted, learning: Object.values(byBox).reduce((a, b) => a + b, 0) }
  }, [activeRows])

  const visibleRows = useMemo(() => {
    const filtered = activeRows.filter((row) => {
      if (filter === 'all') return true
      if (filter === 'mastered') return row.status === 'MASTERED'
      if (filter === 'queue') return row.status === 'NOT_STARTED' || row.status === 'LEARNING_PENDING'
      if (filter === 'learning') return row.status === 'LEARNING'
      return row.status === 'LEARNING' && adaptiveBoxStage(row.boxIndex).box === filter
    })
    return [...filtered].sort((a, b) => {
      const stageDiff = adaptiveStageSortKey(a) - adaptiveStageSortKey(b)
      if (stageDiff !== 0) return stageDiff
      return displayWord(a.wordKey, vocab).localeCompare(displayWord(b.wordKey, vocab))
    })
  }, [activeRows, filter, vocab])

  const shownRows = expanded ? visibleRows : visibleRows.slice(0, 12)

  return (
    <div className="rounded-[18px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[.68rem] font-extrabold tracking-[.16em] text-[var(--wm-text-dim)] uppercase">
            单词成长阶段
          </div>
          <div className="font-fredoka text-xl text-[var(--wm-text)]">
            🥚→🐛→🦋→🌸→🌳
          </div>
        </div>
        <div className="text-right text-[.72rem] font-bold text-[var(--wm-text-dim)]">
          共 {activeRows.length} 词
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(
          [
            { id: 'all' as const, label: '全部', count: activeRows.length },
            ...ADAPTIVE_BOX_STAGES.map((stage) => ({
              id: stage.box as StageFilter,
              label: stage.shortLabel,
              count: counts.byBox[stage.box],
            })),
            {
              id: 'mastered' as const,
              label: ADAPTIVE_MASTERED_STAGE.shortLabel,
              count: counts.mastered,
            },
            {
              id: 'queue' as const,
              label: '💤 未开始',
              count: counts.notStarted + counts.pending,
            },
          ]
        ).map((chip) => (
          <button
            key={String(chip.id)}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-[.7rem] font-extrabold transition-colors ${
              filter === chip.id
                ? 'border-[#a78bfa] bg-[rgba(167,139,250,.18)] text-[#c4b5fd]'
                : 'border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:border-[#a78bfa]/60'
            }`}
          >
            {chip.label} {chip.count}
          </button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-5 gap-1.5 text-center text-[.68rem] font-bold text-[var(--wm-text-dim)]">
        {ADAPTIVE_BOX_STAGES.map((stage) => (
          <div
            key={stage.box}
            className="rounded-xl border border-white/[.07] bg-white/[.035] px-1 py-2"
          >
            <div className="text-[1.1rem] leading-none">{stage.emoji}</div>
            <div className="mt-1 text-[var(--wm-text)]">{counts.byBox[stage.box]}</div>
            <div className="text-white/35">{stage.name}</div>
          </div>
        ))}
      </div>

      {visibleRows.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--wm-text-dim)]">这一阶段还没有单词</div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface2)]">
          <div className="divide-y divide-white/[.06]">
            {shownRows.map((row) => {
              const stage =
                row.status === 'MASTERED'
                  ? ADAPTIVE_MASTERED_STAGE
                  : row.status === 'LEARNING'
                    ? adaptiveBoxStage(row.boxIndex)
                    : row.status === 'LEARNING_PENDING'
                      ? { emoji: '⏳', name: '待激活', shortLabel: '⏳ 待激活', hint: '排队中' }
                      : { emoji: '💤', name: '未开始', shortLabel: '💤 未开始', hint: '还在词库里' }
              return (
                <div
                  key={row.wordKey}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[.92rem] font-extrabold text-[var(--wm-text)]">
                      {displayWord(row.wordKey, vocab)}
                    </div>
                    <div className="truncate text-[.68rem] font-bold text-[var(--wm-text-dim)]">
                      {displayMeta(row.wordKey, vocab)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/[.1] bg-white/[.05] px-2 py-0.5 text-[.68rem] font-extrabold text-[var(--wm-text)]">
                    {stage.emoji} {stage.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {visibleRows.length > 12 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full cursor-pointer rounded-[10px] border border-[var(--wm-border)] bg-transparent py-2 text-[.75rem] font-extrabold text-[var(--wm-text-dim)] hover:text-[#c4b5fd]"
        >
          {expanded ? '收起列表' : `展开全部 ${visibleRows.length} 词`}
        </button>
      )}
    </div>
  )
}
