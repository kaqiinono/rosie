'use client'

import { useEffect, useMemo, useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { findWordByKey } from '../../utils/english-helpers'
import {
  ADAPTIVE_BOX_STAGES,
  ADAPTIVE_BOSS_STAGE,
  ADAPTIVE_MASTERED_STAGE,
  ADAPTIVE_NOT_STARTED_STAGE,
  ADAPTIVE_PENDING_STAGE,
  adaptiveBoxStage,
  adaptiveStageSortKey,
} from '../../utils/adaptivePlanStages'
import type { AdaptivePlanWordProgress } from '../../utils/adaptivePlanTypes'

const PAGE_SIZE = 20

type AdaptivePlanStageBoardProps = {
  rows: AdaptivePlanWordProgress[]
  vocab: WordEntry[]
  panelTitle?: string
  className?: string
  /** Rows per page when the table is expanded. Default 20. */
  pageSize?: number
}

function resolveWord(key: string, vocab: WordEntry[]): WordEntry | null {
  return findWordByKey(vocab, key) ?? null
}

function fallbackWord(key: string): string {
  const parts = key.split('::')
  return parts[parts.length - 1] || key
}

function lessonLabel(entry: WordEntry | null, key: string): string {
  if (entry) {
    return `${entry.unit.replace(/\D+(\d+)/, 'U$1')} ${entry.lesson.replace(/\D+(\d+)/, 'L$1')}`
  }
  const parts = key.split('::')
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`
  return '—'
}

type PanelRow = {
  progress: AdaptivePlanWordProgress
  entry: WordEntry | null
  stageEmoji: string
  stageName: string
  statusLabel: string
  weak: boolean
}

export default function AdaptivePlanStageBoard({
  rows,
  vocab,
  panelTitle = '词汇学习状态',
  className,
  pageSize = PAGE_SIZE,
}: AdaptivePlanStageBoardProps) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const panelRows: PanelRow[] = useMemo(() => {
    const active = rows.filter((row) => row.archivedAt == null)
    return active
      .map((progress) => {
        const entry = resolveWord(progress.wordKey, vocab)
        const mastered = progress.status === 'MASTERED'
        if (mastered) {
          return {
            progress,
            entry,
            stageEmoji: ADAPTIVE_MASTERED_STAGE.emoji,
            stageName: ADAPTIVE_MASTERED_STAGE.name,
            statusLabel: '✓ 已掌握',
            weak: false,
          }
        }
        if (progress.status === 'LEARNING') {
          const stage = adaptiveBoxStage(progress.boxIndex)
          return {
            progress,
            entry,
            stageEmoji: stage.emoji,
            stageName: stage.name,
            statusLabel: progress.streakWrong > 0 ? '⚠️ 弱词' : '待主线推进',
            weak: progress.streakWrong > 0,
          }
        }
        if (progress.status === 'LEARNING_PENDING') {
          const bossPending = progress.targetBox == null && progress.boxIndex === 5
          const target = progress.targetBox != null ? adaptiveBoxStage(progress.targetBox) : null
          return {
            progress,
            entry,
            stageEmoji: bossPending ? ADAPTIVE_BOSS_STAGE.emoji : ADAPTIVE_PENDING_STAGE.emoji,
            stageName: bossPending ? ADAPTIVE_BOSS_STAGE.name : target ? `激活→${target.name}` : ADAPTIVE_PENDING_STAGE.name,
            statusLabel: bossPending ? '等待 Boss 验收' : '排队中',
            weak: false,
          }
        }
        return {
          progress,
          entry,
          stageEmoji: ADAPTIVE_NOT_STARTED_STAGE.emoji,
          stageName: ADAPTIVE_NOT_STARTED_STAGE.name,
          statusLabel: '未练习',
          weak: false,
        }
      })
      .sort((a, b) => {
        if (a.weak !== b.weak) return a.weak ? -1 : 1
        const stageDiff = adaptiveStageSortKey(a.progress) - adaptiveStageSortKey(b.progress)
        if (stageDiff !== 0) return stageDiff
        const aw = a.entry?.word ?? fallbackWord(a.progress.wordKey)
        const bw = b.entry?.word ?? fallbackWord(b.progress.wordKey)
        return aw.localeCompare(bw)
      })
  }, [rows, vocab])

  const counts = useMemo(() => {
    const byBox = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let mastered = 0
    let learning = 0
    let queue = 0
    let weak = 0
    let bossPending = 0
    for (const row of panelRows) {
      if (row.progress.status === 'MASTERED') {
        mastered += 1
        continue
      }
      if (row.progress.status === 'LEARNING') {
        learning += 1
        byBox[adaptiveBoxStage(row.progress.boxIndex).box] += 1
        if (row.weak) weak += 1
        continue
      }
      if (row.progress.status === 'LEARNING_PENDING' && row.progress.targetBox == null && row.progress.boxIndex === 5) {
        bossPending += 1
      } else {
        queue += 1
      }
    }
    return { byBox, mastered, learning, queue, weak, bossPending, total: panelRows.length }
  }, [panelRows])

  const totalPages = Math.max(1, Math.ceil(panelRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return panelRows.slice(start, start + pageSize)
  }, [panelRows, pageSize, safePage])
  const rangeStart = panelRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, panelRows.length)

  useEffect(() => {
    setPage(1)
  }, [rows])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const tableBody = (
    <div className="border-t border-[var(--wm-border)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[var(--wm-surface)]">
              <th className="px-4 py-2 text-left text-[10px] font-bold tracking-wider text-[var(--wm-text-dim)]">
                单词
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-bold tracking-wider text-[var(--wm-text-dim)]">
                课程
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-bold tracking-wider text-[var(--wm-text-dim)]">
                阶段
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-bold tracking-wider text-[var(--wm-text-dim)]">
                状态
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const mastered = row.progress.status === 'MASTERED'
              const word = row.entry?.word ?? fallbackWord(row.progress.wordKey)
              return (
                <tr
                  key={row.progress.wordKey}
                  className="border-t border-[var(--wm-border)]"
                  style={{ opacity: mastered ? 0.6 : 1 }}
                >
                  <td
                    className="px-4 py-2 font-bold"
                    style={{ color: mastered ? '#4ade80' : 'var(--wm-text)' }}
                  >
                    {word}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-[var(--wm-text-dim)]">
                    {lessonLabel(row.entry, row.progress.wordKey)}
                  </td>
                  <td className="px-3 py-2 text-center text-[var(--wm-text-dim)]">
                    {row.stageEmoji} {row.stageName}
                  </td>
                  <td className="px-4 py-2 text-center text-[10px] font-bold">
                    {mastered ? (
                      <span className="text-green-400">{row.statusLabel}</span>
                    ) : row.weak ? (
                      <span className="text-red-400">{row.statusLabel}</span>
                    ) : row.progress.status === 'NOT_STARTED' || row.progress.status === 'LEARNING_PENDING' ? (
                      <span className="text-[var(--wm-text-dim)]">{row.statusLabel}</span>
                    ) : (
                      <span className="text-[#93c5fd]">{row.statusLabel}</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {panelRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[12px] text-[var(--wm-text-dim)]">
                  计划暂无单词进度
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {panelRows.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--wm-border)] bg-[var(--wm-surface)] px-4 py-2.5">
          <div className="text-[11px] font-bold text-[var(--wm-text-dim)]">
            第 {rangeStart}–{rangeEnd} 词 · 共 {panelRows.length} 词
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="cursor-pointer rounded-full border border-[var(--wm-border)] bg-transparent px-3 py-1 text-[11px] font-extrabold text-[var(--wm-text-dim)] disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#a78bfa] hover:text-[#c4b5fd]"
            >
              ← 上一页
            </button>
            <span className="min-w-[4.5rem] text-center text-[11px] font-extrabold text-[var(--wm-text)]">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="cursor-pointer rounded-full border border-[var(--wm-border)] bg-transparent px-3 py-1 text-[11px] font-extrabold text-[var(--wm-text-dim)] disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#a78bfa] hover:text-[#c4b5fd]"
            >
              下一页 →
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const summaryBlock = (
    <div className="font-nunito flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-snug text-[var(--wm-text-dim)]">
      <span>
        共 <strong className="text-[var(--wm-text)]">{counts.total}</strong> 词
      </span>
      <span className="text-[var(--wm-border)]">·</span>
      <span>
        学习中 <strong className="text-[#93c5fd]">{counts.learning}</strong>
      </span>
      <span className="text-[var(--wm-border)]">·</span>
      <span>
        排队 <strong className={counts.queue > 0 ? 'text-[#fbbf24]' : 'text-[var(--wm-text)]'}>{counts.queue}</strong>
      </span>
      {ADAPTIVE_BOX_STAGES.map((stage) =>
        counts.byBox[stage.box] > 0 ? (
          <span key={stage.box} className="inline-flex items-center gap-1">
            <span className="text-[var(--wm-border)]">·</span>
            <span>
              {stage.emoji}
              <strong className="ml-0.5 text-[var(--wm-text)]">{counts.byBox[stage.box]}</strong>
            </span>
          </span>
        ) : null,
      )}
      {counts.bossPending > 0 && (
        <>
          <span className="text-[var(--wm-border)]">·</span>
          <span>
            Boss 等待 <strong className="text-[#fbbf24]">{counts.bossPending}</strong>
          </span>
        </>
      )}
      {counts.weak > 0 && (
        <>
          <span className="text-[var(--wm-border)]">·</span>
          <span>
            弱词 <strong className="text-red-400">{counts.weak}</strong>
          </span>
        </>
      )}
      {counts.mastered > 0 && (
        <>
          <span className="text-[var(--wm-border)]">·</span>
          <span>
            已掌握 <strong className="text-[#4ade80]">{counts.mastered}</strong>
          </span>
        </>
      )}
    </div>
  )

  return (
    <div className={`px-4 pb-8 ${className ?? ''}`}>
      <div className="overflow-hidden rounded-[14px] border border-[var(--wm-border)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full cursor-pointer border-0 bg-[var(--wm-surface)] px-4 py-3 text-left transition-colors hover:bg-[var(--wm-surface2)]"
        >
          <div className="flex w-full min-w-0 flex-col gap-2">
            <div className="flex w-full min-w-0 items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="shrink-0 text-[15px]">📊</span>
                <span className="font-nunito text-[13px] font-bold text-[var(--wm-text)]">{panelTitle}</span>
                <span className="text-[10px] font-bold text-[var(--wm-text-dim)]">
                  🥚→🐛→🦋→🌸→🌳
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {counts.mastered > 0 && (
                  <span className="hidden rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400 sm:inline">
                    ✨ {counts.mastered}
                  </span>
                )}
                <svg
                  className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{ color: 'var(--wm-text-dim)' }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
            {summaryBlock}
          </div>
        </button>
        {open && tableBody}
      </div>
    </div>
  )
}
