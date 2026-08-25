'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  ADAPTIVE_BOX_STAGES,
  ADAPTIVE_MASTERED_STAGE,
  ADAPTIVE_NOT_STARTED_STAGE,
  ADAPTIVE_PENDING_STAGE,
} from '../../utils/adaptivePlanStages'
import {
  computeAdaptivePlanStageCounts,
  type AdaptivePlanFocusStage,
} from '../../utils/adaptivePlanStageCounts'
import type { AdaptivePlanWordProgress } from '../../utils/adaptivePlanTypes'

type AdaptivePlanStageRoadmapProps = {
  rows: AdaptivePlanWordProgress[]
  today?: string
  compact?: boolean
  className?: string
  title?: string
  footer?: ReactNode
}

type RoadmapNode = {
  key: string
  emoji: string
  name: string
  count: number
  dueToday: number
  focus: boolean
  dimmed: boolean
  hint: string
}

function displayWord(wordKey: string): string {
  const parts = wordKey.split('::')
  return parts[parts.length - 1] || wordKey
}

function rowStageKey(row: AdaptivePlanWordProgress): string {
  if (row.status === 'MASTERED') return 'mastered'
  if (row.status === 'LEARNING_PENDING') return 'pending'
  if (row.status === 'LEARNING') return `box-${Math.min(5, Math.max(1, row.boxIndex ?? 1))}`
  return 'not_started'
}

function focusLabel(focus: AdaptivePlanFocusStage): string {
  if (focus === 'not_started') return ADAPTIVE_NOT_STARTED_STAGE.shortLabel
  if (focus === 'pending') return ADAPTIVE_PENDING_STAGE.shortLabel
  if (focus === 'mastered') return '全部毕业'
  const stage = ADAPTIVE_BOX_STAGES[focus - 1]
  return stage ? `${stage.emoji} ${stage.name}关` : '当前关卡'
}

function buildNodes(
  counts: ReturnType<typeof computeAdaptivePlanStageCounts>,
  showPreStages: boolean,
): RoadmapNode[] {
  const nodes: RoadmapNode[] = []

  if (showPreStages) {
    nodes.push({
      key: 'not_started',
      emoji: ADAPTIVE_NOT_STARTED_STAGE.emoji,
      name: ADAPTIVE_NOT_STARTED_STAGE.name,
      count: counts.notStarted,
      dueToday: 0,
      focus: counts.focus === 'not_started',
      dimmed: counts.notStarted === 0,
      hint: ADAPTIVE_NOT_STARTED_STAGE.hint,
    })
    nodes.push({
      key: 'pending',
      emoji: ADAPTIVE_PENDING_STAGE.emoji,
      name: ADAPTIVE_PENDING_STAGE.name,
      count: counts.pending,
      dueToday: 0,
      focus: counts.focus === 'pending',
      dimmed: counts.pending === 0,
      hint: ADAPTIVE_PENDING_STAGE.hint,
    })
  }

  for (const stage of ADAPTIVE_BOX_STAGES) {
    nodes.push({
      key: `box-${stage.box}`,
      emoji: stage.emoji,
      name: stage.name,
      count: counts.byBox[stage.box],
      dueToday: counts.byBoxDueToday[stage.box],
      focus: counts.focus === stage.box,
      dimmed: counts.byBox[stage.box] === 0,
      hint: stage.hint,
    })
  }

  nodes.push({
    key: 'mastered',
    emoji: '👑',
    name: '毕业',
    count: counts.mastered,
    dueToday: 0,
    focus: counts.focus === 'mastered',
    dimmed: counts.mastered === 0,
    hint: ADAPTIVE_MASTERED_STAGE.hint,
  })

  return nodes
}

export default function AdaptivePlanStageRoadmap({
  rows,
  today,
  compact = false,
  className,
  title = '通关路线图',
  footer,
}: AdaptivePlanStageRoadmapProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const counts = useMemo(() => computeAdaptivePlanStageCounts(rows, today), [rows, today])

  const showPreStages = counts.queue > 0 || counts.learning === 0
  const nodes = useMemo(() => buildNodes(counts, showPreStages), [counts, showPreStages])
  const remaining = Math.max(0, counts.total - counts.mastered)
  const selectedNode = nodes.find((node) => node.key === selectedStage) ?? null
  const selectedWords = useMemo(() => {
    if (!selectedStage || selectedStage === 'not_started') return []
    return rows
      .filter((row) => row.archivedAt == null && rowStageKey(row) === selectedStage)
      .map((row) => ({ key: row.wordKey, word: displayWord(row.wordKey) }))
      .sort((a, b) => a.word.localeCompare(b.word, 'en'))
  }, [rows, selectedStage])

  if (counts.total === 0) return null

  return (
    <div
      className={`rounded-[16px] border border-[var(--wm-border)] bg-white/[.02] px-3 py-3 sm:px-4 sm:py-4 ${className ?? ''}`}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[.68rem] font-extrabold tracking-[.14em] text-[var(--wm-text-dim)] uppercase">
            {title}
          </div>
          {!compact && (
            <div className="mt-0.5 text-[.75rem] font-bold text-[var(--wm-text-dim)]">
              每词经历五关成长，数字为当前停在该关的单词数
            </div>
          )}
        </div>
        <div className="rounded-full border border-[rgba(96,165,250,.28)] bg-[rgba(96,165,250,.08)] px-2.5 py-1 text-[.68rem] font-extrabold text-[#93c5fd]">
          主攻 {focusLabel(counts.focus)}
        </div>
      </div>

      <div className="relative overflow-x-auto pt-1 pb-1">
        <div className="flex min-w-max items-end gap-1 sm:gap-1.5">
          {nodes.map((node, index) => (
            <div key={node.key} className="flex items-end">
              {index > 0 && (
                <div className="mb-8 flex w-3 shrink-0 items-center sm:w-4">
                  <div className="h-px w-full bg-gradient-to-r from-white/10 via-white/25 to-white/10" />
                </div>
              )}
              <div className="flex flex-col items-center">
                {node.focus && (
                  <div className="mb-1 rounded-full bg-[#a78bfa] px-1.5 py-0.5 text-[.55rem] leading-none font-extrabold text-white">
                    当前
                  </div>
                )}
                <button
                  type="button"
                  disabled={node.count === 0 || node.key === 'not_started'}
                  aria-pressed={node.key === selectedStage}
                  aria-label={`${node.name}，${node.count}个单词${node.key === 'not_started' ? '' : '，点击查看'}`}
                  onClick={() =>
                    setSelectedStage((current) => (current === node.key ? null : node.key))
                  }
                  title={`${node.name}：${node.count} 词${node.dueToday > 0 ? `，今日到期 ${node.dueToday}` : ''}`}
                  className={`flex w-[4.6rem] flex-col items-center rounded-xl border px-1.5 py-2 text-center transition sm:w-[5.2rem] ${
                    node.count > 0 && node.key !== 'not_started'
                      ? 'cursor-pointer touch-manipulation hover:-translate-y-0.5 hover:border-[rgba(167,139,250,.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a78bfa] active:translate-y-0'
                      : 'cursor-default'
                  } ${
                    node.key === selectedStage
                      ? 'border-[rgba(167,139,250,.75)] bg-[rgba(139,92,246,.2)] shadow-[0_0_0_2px_rgba(167,139,250,.22)]'
                      : node.focus
                      ? 'border-[rgba(167,139,250,.55)] bg-[rgba(139,92,246,.12)] shadow-[0_0_0_1px_rgba(167,139,250,.2)]'
                      : node.dimmed
                        ? 'border-white/[.06] bg-white/[.02] opacity-55'
                        : 'border-white/[.1] bg-white/[.04]'
                  }`}
                >
                  <div className={compact ? 'text-lg' : 'text-xl'}>{node.emoji}</div>
                  <div className="mt-0.5 text-[.62rem] font-extrabold text-[var(--wm-text-dim)]">
                    {node.name}
                  </div>
                  <div
                    className={`font-fredoka mt-0.5 leading-none ${
                      compact ? 'text-lg' : 'text-xl'
                    } ${node.focus ? 'text-[#e9d5ff]' : 'text-[var(--wm-text)]'}`}
                  >
                    {node.count}
                  </div>
                  {node.dueToday > 0 ? (
                    <div className="mt-1 rounded-full bg-[rgba(248,113,113,.18)] px-1.5 py-px text-[.55rem] font-extrabold text-[#f87171]">
                      今 {node.dueToday}
                    </div>
                  ) : (
                    !compact && (
                      <div className="mt-1 text-[.55rem] font-bold text-white/25">{node.hint}</div>
                    )
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedNode && selectedWords.length > 0 && (
        <div className="mt-3 rounded-xl border border-[rgba(167,139,250,.22)] bg-[rgba(139,92,246,.06)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[.72rem] font-extrabold text-[#e9d5ff]">
              {selectedNode.emoji} {selectedNode.name} · {selectedWords.length} 词
            </div>
            <button
              type="button"
              onClick={() => setSelectedStage(null)}
              className="min-h-8 cursor-pointer touch-manipulation rounded-lg px-2 text-[.68rem] font-bold text-[var(--wm-text-dim)] hover:bg-white/[.06] hover:text-[var(--wm-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a78bfa]"
            >
              收起
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-live="polite">
            {selectedWords.map(({ key, word }) => (
              <span
                key={key}
                className="rounded-lg border border-white/[.08] bg-white/[.04] px-2 py-1 text-[.72rem] font-bold text-[var(--wm-text)]"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[.68rem] font-bold text-[var(--wm-text-dim)]">
        <span>
          待通关 <strong className="text-[#93c5fd]">{remaining}</strong> 词
        </span>
        <span>
          在学 <strong className="text-[#c4b5fd]">{counts.learning}</strong>
        </span>
        {counts.notStarted > 0 && (
          <span>
            待启程 <strong className="text-[#e2e8f0]">{counts.notStarted}</strong>
          </span>
        )}
        {counts.pending > 0 && (
          <span>
            激活 <strong className="text-[#fbbf24]">{counts.pending}</strong>
          </span>
        )}
        <span>
          已毕业 <strong className="text-[#86efac]">{counts.mastered}</strong>
        </span>
      </div>
      {footer && <div className="mt-3 border-t border-white/[.08] pt-3">{footer}</div>}
    </div>
  )
}
