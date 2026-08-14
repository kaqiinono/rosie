'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { QuizType, WordEntry } from '@rosie/core'
import { todayStr, useAuth } from '@rosie/core'
import { useAdaptiveWordPlan } from '../../hooks/useAdaptiveWordPlan'
import { findWordByKey } from '../../utils/english-helpers'
import {
  formatQuizTypes,
  simulateAdaptivePlan,
  wordLabelFromKey,
  type AdaptiveStageMatrix,
  type SimDaySnapshot,
  type SimWordPhase,
  type SimWordTouch,
  type SimulateAdaptivePlanResult,
} from '../../utils/adaptivePlanSimulate'
import type { AdaptivePlanWordProgress, AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'
import {
  loadAdaptivePracticeLogs,
  type AdaptivePracticeSessionLog,
} from '../../utils/adaptivePlanPracticeLog'
import { useWordsContext } from '../../WordsContext'
import AdaptivePlanPreviewOverview from './AdaptivePlanPreviewOverview'
import AdaptivePlanPreviewCalendar from './AdaptivePlanPreviewCalendar'

type DetailViewMode = 'list' | 'calendar'

type AdaptivePlanPreviewProps = {
  planId: string
  onBack: () => void
}

type DayWordRow = {
  wordKey: string
  phases: SimWordPhase[]
  stageLabels: string[]
  quizTypes: QuizType[]
  questionCount: number
}

const MODE_LABELS = {
  normal: '普通',
  review_only: '仅复习',
  boss: 'Boss',
} as const

const PHASE_LABELS = {
  study: 'Step 2 认读',
  step1_review: 'Step 1 复习',
  step3_final: 'Step 3 闯关',
  boss: 'Boss 考核',
} as const

/** Session order: 复习 → 新学 → 闯关 → Boss */
const PHASE_ORDER: SimWordPhase[] = ['step1_review', 'study', 'step3_final', 'boss']

function scopeLabel(plan: AdaptiveWordPlan): string {
  const parts: string[] = []
  if (plan.scope.stages && plan.scope.stages.length > 0) {
    parts.push(`词库 ${plan.scope.stages.join('、')}`)
  }
  if (plan.scope.lessonKeys && plan.scope.lessonKeys.length > 0) {
    parts.push(`课程 ${plan.scope.lessonKeys.map((k) => k.replace('::', ' · ')).join('、')}`)
  }
  return parts.join(' / ') || '未限定范围'
}

function displayWord(key: string, vocab: WordEntry[]): string {
  const entry = findWordByKey(vocab, key)
  return entry?.word ?? wordLabelFromKey(key)
}

function joinStacked(parts: string[]): string {
  return parts.length > 0 ? parts.join(' + ') : '—'
}

function localDateFromTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function inclusiveCalendarDays(startDate: string, endDate: string): number {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const start = Date.UTC(startYear ?? 0, (startMonth ?? 1) - 1, startDay ?? 1)
  const end = Date.UTC(endYear ?? 0, (endMonth ?? 1) - 1, endDay ?? 1)
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1)
}

function addCalendarDays(dateStr: string, amount: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + amount))
  return date.toISOString().slice(0, 10)
}

function calendarDayIndex(startDate: string, dateStr: string): number {
  return inclusiveCalendarDays(startDate, dateStr)
}

/** One row per word; stack phases / stages / quiz types like「题型」. */
function groupTouchesByWord(touches: SimWordTouch[]): DayWordRow[] {
  const byKey = new Map<string, SimWordTouch[]>()
  for (const touch of touches) {
    const list = byKey.get(touch.wordKey)
    if (list) list.push(touch)
    else byKey.set(touch.wordKey, [touch])
  }

  return [...byKey.entries()].map(([wordKey, wordTouches]) => {
    const phases = PHASE_ORDER.filter((phase) => wordTouches.some((t) => t.phase === phase))
    const stageLabels: string[] = []
    for (const touch of wordTouches) {
      if (touch.stageLabel && !stageLabels.includes(touch.stageLabel)) {
        stageLabels.push(touch.stageLabel)
      }
    }
    const quizTypes: QuizType[] = []
    for (const touch of wordTouches) {
      if (touch.phase === 'study') continue
      for (const type of touch.quizTypes) {
        if (!quizTypes.includes(type)) quizTypes.push(type)
      }
    }
    const questionCount = wordTouches.reduce((sum, t) => sum + t.questionCount, 0)
    return { wordKey, phases, stageLabels, quizTypes, questionCount }
  })
}

function DayCard({
  day,
  vocab,
  defaultOpen = false,
}: {
  day: SimDaySnapshot
  vocab: WordEntry[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [wordsOpen, setWordsOpen] = useState(false)

  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen, day.date])
  const hasWork =
    day.newWordKeys.length > 0 ||
    day.reviewWordKeys.length > 0 ||
    day.bossWordKeys.length > 0 ||
    day.totalQuestions > 0

  const wordRows = useMemo(() => groupTouchesByWord(day.touches), [day.touches])

  return (
    <div className="rounded-[16px] border border-[var(--wm-border)] bg-[var(--wm-surface2)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="font-fredoka min-w-[3.5rem] text-xl text-[#93c5fd]">D{day.dayIndex}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[.9rem] font-extrabold text-[var(--wm-text)]">{day.date}</div>
          <div className="mt-0.5 text-[.72rem] font-bold text-[var(--wm-text-dim)]">{day.note}</div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[.62rem] font-extrabold ${
            day.mode === 'boss'
              ? 'border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.1)] text-[#fbbf24]'
              : day.mode === 'review_only'
                ? 'border-[rgba(248,113,113,.35)] bg-[rgba(248,113,113,.1)] text-[#f87171]'
                : 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.1)] text-[#93c5fd]'
          }`}
        >
          {MODE_LABELS[day.mode]}
        </span>
        <span className="text-[.75rem] text-[var(--wm-text-dim)]">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-white/[.06] px-4 py-4">
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatPill label="新学" value={day.newWordKeys.length} color="#93c5fd" />
            <StatPill label="复习" value={day.reviewWordKeys.length} color="#c4b5fd" />
            <StatPill label="答题" value={day.totalQuestions} color="#86efac" />
            <StatPill label="新掌握" value={day.masteredToday.length} color="#fbbf24" />
          </div>

          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
            <span>学习中 {day.cumulative.learning}</span>
            <span>已掌握 {day.cumulative.mastered}</span>
            <span>未开始 {day.cumulative.notStarted}</span>
            <span>累计激活 {day.cumulative.totalActivated}</span>
            <span>成长 +{day.promotedCount}</span>
          </div>

          {!hasWork ? (
            <div className="text-[.78rem] font-bold text-[var(--wm-text-dim)]">今日无练习任务</div>
          ) : (
            <div className="rounded-xl border border-[var(--wm-border)]">
              <button
                type="button"
                onClick={() => setWordsOpen((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left"
              >
                <span className="text-[.75rem] font-extrabold text-[#c4b5fd]">
                  单词明细 · {wordRows.length} 词
                </span>
                <span className="shrink-0 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
                  {wordsOpen ? '收起 ▴' : '展开 ▾'}
                </span>
              </button>

              {wordsOpen && (
                <div className="overflow-x-auto border-t border-[var(--wm-border)]">
                  <table className="w-full min-w-[640px] text-left text-[.75rem]">
                    <thead>
                      <tr className="border-b border-[var(--wm-border)] bg-white/[.03] text-[.68rem] font-extrabold tracking-wide text-[var(--wm-text-dim)] uppercase">
                        <th className="px-3 py-2">单词</th>
                        <th className="px-3 py-2">环节</th>
                        <th className="px-3 py-2">阶段</th>
                        <th className="px-3 py-2">题型</th>
                        <th className="px-3 py-2 text-right">题数</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[.05]">
                      {wordRows.map((row) => (
                        <tr key={row.wordKey}>
                          <td className="px-3 py-2 font-extrabold text-[var(--wm-text)]">
                            {displayWord(row.wordKey, vocab)}
                          </td>
                          <td className="px-3 py-2 font-bold text-[#c4b5fd]">
                            {joinStacked(row.phases.map((phase) => PHASE_LABELS[phase]))}
                          </td>
                          <td className="px-3 py-2 font-bold text-[var(--wm-text-dim)]">
                            {joinStacked(row.stageLabels)}
                          </td>
                          <td className="px-3 py-2 font-bold text-[var(--wm-text-dim)]">
                            {formatQuizTypes(row.quizTypes)}
                          </td>
                          <td className="px-3 py-2 text-right font-extrabold text-[#86efac]">
                            {row.questionCount > 0 ? row.questionCount : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {day.masteredToday.length > 0 && (
            <div className="mt-3 rounded-xl border border-[rgba(74,222,128,.25)] bg-[rgba(74,222,128,.06)] px-3 py-2 text-[.72rem] font-bold text-[#86efac]">
              今日毕业：{day.masteredToday.map((k) => displayWord(k, vocab)).join('、')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2 text-center">
      <div className="text-[.65rem] font-extrabold text-[var(--wm-text-dim)]">{label}</div>
      <div className="font-fredoka text-xl" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function PracticeHistory({
  sessions,
  vocab,
}: {
  sessions: AdaptivePracticeSessionLog[]
  vocab: WordEntry[]
}) {
  if (sessions.length === 0) return null
  return (
    <div className="mb-5 rounded-[24px] border border-[rgba(74,222,128,.25)] bg-[var(--wm-surface)] p-6">
      <div className="font-fredoka text-xl text-[#86efac]">真实练习轨迹</div>
      <div className="mt-1 mb-4 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
        共 {sessions.length} 轮 · 精确记录题数、正确率与结算前后箱位
      </div>
      <div className="flex flex-col gap-2.5">
        {sessions.map((session, index) => {
          const accuracy =
            session.questionCount > 0
              ? Math.round((session.correctCount / session.questionCount) * 100)
              : 0
          return (
            <details
              key={session.id}
              className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)]"
            >
              <summary className="cursor-pointer px-4 py-3 text-[.78rem] font-extrabold text-[var(--wm-text)]">
                D{index + 1} · {session.practiceDate} · {session.mode === 'boss' ? 'Boss' : '普通'}{' '}
                ·{' '}
                {session.questionCount > 0
                  ? `${session.questionCount} 题 · ${accuracy}%`
                  : `激活 ${session.newWordCount} 词`}
                {session.recordKind === 'inferred' && (
                  <span className="ml-2 rounded-full border border-[rgba(251,191,36,.3)] bg-[rgba(251,191,36,.08)] px-2 py-0.5 text-[.62rem] text-[#fbbf24]">
                    推定记录
                  </span>
                )}
              </summary>
              <div className="overflow-x-auto border-t border-[var(--wm-border)]">
                {session.recordKind === 'inferred' && (
                  <div className="border-b border-[var(--wm-border)] px-3 py-2 text-[.65rem] font-bold text-[#fbbf24]">
                    依据：{session.inferenceBasis.includes('introduced_on') ? '首次激活日期' : ''}
                    {session.inferenceBasis.length > 1 ? '、' : ''}
                    {session.inferenceBasis.includes('unique_plan_word_review_history')
                      ? '唯一计划匹配的答题历史'
                      : ''}
                    ；未知轮次、题型和箱位变化保持空白。
                  </div>
                )}
                <table className="w-full min-w-[700px] text-left text-[.72rem]">
                  <thead className="text-[var(--wm-text-dim)]">
                    <tr>
                      <th className="px-3 py-2">单词</th>
                      <th className="px-3 py-2">题目</th>
                      <th className="px-3 py-2">正确率</th>
                      <th className="px-3 py-2">箱位变化</th>
                      <th className="px-3 py-2">下次复习</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[.05]">
                    {session.words.map((word) => (
                      <tr key={word.wordKey}>
                        <td className="px-3 py-2 font-extrabold text-[var(--wm-text)]">
                          {displayWord(word.wordKey, vocab)}
                        </td>
                        <td className="px-3 py-2 font-bold text-[var(--wm-text-dim)]">
                          {word.outcomes.length > 0
                            ? word.outcomes
                                .map(
                                  (outcome) =>
                                    `${outcome.quizType ?? '题型未知'}${outcome.correct ? '✓' : '✗'}${outcome.usedRetry ? '↺' : ''}`,
                                )
                                .join(' · ')
                            : '仅确认首次激活'}
                        </td>
                        <td className="px-3 py-2 font-extrabold text-[#86efac]">
                          {word.questionCount > 0
                            ? `${word.correctCount}/${word.questionCount}`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 font-extrabold text-[#c4b5fd]">
                          {word.boxBefore == null && word.boxAfter == null
                            ? '未知'
                            : `${word.boxBefore ?? '—'} → ${word.boxAfter ?? (word.statusAfter === 'MASTERED' ? '👑' : '—')}`}
                        </td>
                        <td className="px-3 py-2 font-bold text-[var(--wm-text-dim)]">
                          {word.nextReviewAfter ??
                            (session.recordKind === 'exact' ? '已完成' : '未知')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}

const BOSS_CELL = '👹' as const
const MASTERED_CELL = '👑' as const

const STAGE_LEGEND = [
  { cell: '🥚', label: '蛋箱' },
  { cell: '🐛', label: '虫箱' },
  { cell: '🦋', label: '蝴蝶箱' },
  { cell: '🌸', label: '花箱' },
  { cell: '🌳', label: '树箱' },
  { cell: MASTERED_CELL, label: '已掌握' },
  { cell: '⏳', label: '待激活' },
  { cell: BOSS_CELL, label: 'Boss 考核（箱位未变）' },
  { cell: '?', label: '历史箱位未知' },
] as const

function stageCellClass(cell: string): string {
  if (!cell) return ''
  if (cell === BOSS_CELL) return 'text-[#fbbf24] bg-[rgba(245,158,11,.14)]'
  if (cell === MASTERED_CELL) return 'text-[#fbbf24] bg-[rgba(251,191,36,.12)]'
  if (cell === '⏳') return 'text-[#fbbf24] bg-[rgba(251,191,36,.1)]'
  if (cell === '🥚') return 'text-[#93c5fd] bg-[rgba(96,165,250,.1)]'
  if (cell === '🐛') return 'text-[#a78bfa] bg-[rgba(167,139,250,.1)]'
  if (cell === '🦋') return 'text-[#c4b5fd] bg-[rgba(196,181,253,.1)]'
  if (cell === '🌸') return 'text-[#f0abfc] bg-[rgba(240,171,252,.1)]'
  if (cell === '🌳') return 'text-[#86efac] bg-[rgba(74,222,128,.08)]'
  if (cell === '?') return 'text-[#fbbf24] bg-[rgba(251,191,36,.08)]'
  return 'text-[var(--wm-text-dim)]'
}

function stageLegendLabel(cell: string): string {
  return STAGE_LEGEND.find((item) => item.cell === cell)?.label ?? cell
}

/** True when this word was practiced / activated / mastered on that sim day. */
function wordTouchedOnDay(day: SimDaySnapshot | undefined, wordKey: string): boolean {
  if (!day) return false
  return (
    day.newWordKeys.includes(wordKey) ||
    day.reviewWordKeys.includes(wordKey) ||
    day.bossWordKeys.includes(wordKey) ||
    day.masteredToday.includes(wordKey) ||
    day.touches.some((t) => t.wordKey === wordKey)
  )
}

/** Boss drill with no box/status change → boss icon; otherwise show end-of-day stage. */
function keyStageCell(
  matrix: AdaptiveStageMatrix,
  days: SimDaySnapshot[],
  wordIdx: number,
  dayIdx: number,
): string {
  const wordKey = matrix.words[wordIdx]?.wordKey
  const day = days[dayIdx]
  if (!wordKey || !day || !wordTouchedOnDay(day, wordKey)) return ''

  if (day.masteredToday.includes(wordKey)) return MASTERED_CELL

  const bossTouch = day.touches.find((t) => t.wordKey === wordKey && t.phase === 'boss')
  if (bossTouch) {
    const unchanged =
      bossTouch.boxBefore === bossTouch.boxAfter && bossTouch.statusBefore === bossTouch.statusAfter
    if (unchanged) return BOSS_CELL
  }

  const cell = matrix.cells[wordIdx]?.[dayIdx] ?? ''
  if (!cell || cell === '—') return ''
  return cell
}

function StageTrajectoryMatrix({
  matrix,
  days,
  vocab,
  displayCells,
}: {
  matrix: AdaptiveStageMatrix
  days: SimDaySnapshot[]
  vocab: WordEntry[]
  displayCells?: string[][]
}) {
  const [open, setOpen] = useState(false)

  if (matrix.dayIndices.length === 0) return null

  return (
    <div className="mb-5 rounded-[24px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
      >
        <div>
          <div className="font-fredoka text-xl text-[#c4b5fd]">阶段总览表</div>
          <div className="mt-1 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
            {matrix.words.length} 词 × {matrix.dayIndices.length} 天 · 练到显示箱位，Boss
            同箱考核显示老板图标
          </div>
        </div>
        <span className="shrink-0 text-sm font-bold text-[var(--wm-text-dim)]">
          {open ? '收起 ▴' : '展开 ▾'}
        </span>
      </button>

      {open && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[.68rem] font-bold text-[var(--wm-text-dim)]">
            {STAGE_LEGEND.map((item) => (
              <span key={item.cell} className="inline-flex items-center gap-1">
                <span className={`rounded px-1 ${stageCellClass(item.cell)}`}>{item.cell}</span>
                {item.label}
              </span>
            ))}
            <span className="text-[var(--wm-text-dim)]/60">空白 = 当日未练到</span>
          </div>

          <div className="max-h-[min(70vh,640px)] overflow-auto rounded-xl border border-[var(--wm-border)]">
            <table className="border-collapse text-center text-[.72rem]">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 min-w-[7.5rem] border-r border-b border-[var(--wm-border)] bg-[var(--wm-surface)] px-2 py-2 text-left text-[.68rem] font-extrabold text-[var(--wm-text-dim)]">
                    单词
                  </th>
                  {matrix.dayIndices.map((day, colIdx) => (
                    <th
                      key={`${day}-${matrix.dates[colIdx]}`}
                      className="sticky top-0 z-20 min-w-[2.4rem] border-b border-[var(--wm-border)] bg-[var(--wm-surface)] px-1 py-2 text-[.62rem] font-extrabold text-[#93c5fd]"
                    >
                      <div>D{day}</div>
                      <div className="mt-0.5 font-bold text-[var(--wm-text-dim)]">
                        {matrix.dates[colIdx]?.slice(5)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.words.map((word, rowIdx) => (
                  <tr key={word.wordKey} className="border-b border-white/[.04]">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 max-w-[9rem] truncate border-r border-[var(--wm-border)] bg-[var(--wm-surface2)] px-2 py-1.5 text-left text-[.7rem] font-extrabold text-[var(--wm-text)]"
                      title={displayWord(word.wordKey, vocab)}
                    >
                      {displayWord(word.wordKey, vocab)}
                    </th>
                    {matrix.dayIndices.map((day, colIdx) => {
                      const cell = displayCells?.[rowIdx]?.[colIdx]
                        ?? keyStageCell(matrix, days, rowIdx, colIdx)
                      return (
                        <td
                          key={`${word.wordKey}-${day}`}
                          className={`px-1 py-1.5 font-extrabold ${stageCellClass(cell)}`}
                          title={cell ? `D${day} ${stageLegendLabel(cell)}` : undefined}
                        >
                          {cell}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdaptivePlanPreview({ planId, onBack }: AdaptivePlanPreviewProps) {
  const { user } = useAuth()
  const { vocab } = useWordsContext()
  const { plans, isLoading: plansLoading, loadProgress } = useAdaptiveWordPlan(user)

  const [rows, setRows] = useState<AdaptivePlanWordProgress[]>([])
  const [isLoadingRows, setIsLoadingRows] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [detailView, setDetailView] = useState<DetailViewMode>('list')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [practiceLogs, setPracticeLogs] = useState<AdaptivePracticeSessionLog[]>([])

  const today = todayStr()
  const plan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId])

  const reload = useCallback(() => {
    setRefreshToken((t) => t + 1)
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  useEffect(() => {
    if (plansLoading || !plan) return

    let cancelled = false
    setIsLoadingRows(true)
    setLoadError(null)

    void loadProgress(plan.id)
      .then((loaded) => {
        if (cancelled) return
        setRows(loaded)
        setIsLoadingRows(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[adaptive_word_plan] preview load failed', err)
        setLoadError(err instanceof Error ? err.message : '加载进度失败')
        setIsLoadingRows(false)
      })

    if (user) {
      void loadAdaptivePracticeLogs(user.id, plan.id)
        .then((loaded) => {
          if (!cancelled) setPracticeLogs(loaded)
        })
        .catch((err) => {
          if (!cancelled) console.error('[adaptive_word_plan] practice log load failed', err)
        })
    }

    return () => {
      cancelled = true
    }
  }, [loadProgress, plan, plansLoading, refreshToken, user])

  const simulation: SimulateAdaptivePlanResult | null = useMemo(() => {
    if (!plan || rows.length === 0) return null

    const wordKeys = rows.filter((r) => r.archivedAt == null).map((r) => r.wordKey)

    return simulateAdaptivePlan({
      plan,
      wordKeys,
      initialRows: rows,
      startDate: today,
      maxDays: 500,
      allCorrect: true,
      captureStageMatrix: true,
    })
  }, [plan, rows, today])

  const activeRows = useMemo(() => rows.filter((r) => r.archivedAt == null), [rows])

  const actualProgress = useMemo(() => {
    if (!plan) return null
    const planStartDate = localDateFromTimestamp(plan.createdAt)
    const introducedByDate = new Map<string, number>()
    for (const row of activeRows) {
      if (!row.introducedOn || row.introducedOn > today) continue
      introducedByDate.set(row.introducedOn, (introducedByDate.get(row.introducedOn) ?? 0) + 1)
    }
    const introducedCount = [...introducedByDate.values()].reduce((sum, count) => sum + count, 0)
    return {
      planStartDate,
      calendarDays: inclusiveCalendarDays(planStartDate, today),
      activeDays: introducedByDate.size,
      introducedCount,
      averagePerActiveDay: introducedByDate.size > 0 ? introducedCount / introducedByDate.size : 0,
    }
  }, [activeRows, plan, today])

  const fullTrajectory = useMemo(() => {
    const projected = simulation?.stageMatrix
    if (!plan || !projected) return null

    const planStartDate = localDateFromTimestamp(plan.createdAt)
    const dates: string[] = []
    for (let date = planStartDate; date < today; date = addCalendarDays(date, 1)) {
      dates.push(date)
    }
    for (const date of projected.dates) {
      if (!dates.includes(date)) dates.push(date)
    }
    dates.sort()

    const projectedWordIndex = new Map(
      projected.words.map((word, index) => [word.wordKey, index]),
    )
    const projectedDateIndex = new Map(projected.dates.map((date, index) => [date, index]))
    const logsByDate = new Map<string, AdaptivePracticeSessionLog[]>()
    for (const session of practiceLogs) {
      const list = logsByDate.get(session.practiceDate) ?? []
      list.push(session)
      logsByDate.set(session.practiceDate, list)
    }

    const displayCells = projected.words.map((word) => dates.map((date) => {
      const logged = (logsByDate.get(date) ?? [])
        .flatMap((session) => session.words
          .filter((item) => item.wordKey === word.wordKey)
          .map((item) => ({ session, item })))
        .at(-1)
      if (logged) {
        if (logged.session.recordKind === 'inferred') return '?'
        if (logged.item.statusAfter === 'MASTERED') return MASTERED_CELL
        if (
          logged.session.mode === 'boss'
          && logged.item.boxBefore === logged.item.boxAfter
          && logged.item.statusBefore === logged.item.statusAfter
        ) {
          return BOSS_CELL
        }
        if (logged.item.boxAfter != null) {
          return ['🥚', '🐛', '🦋', '🌸', '🌳'][logged.item.boxAfter - 1] ?? '?'
        }
        return '?'
      }

      const projectedCol = projectedDateIndex.get(date)
      const projectedRow = projectedWordIndex.get(word.wordKey)
      if (projectedCol == null || projectedRow == null) return ''
      return keyStageCell(projected, simulation.days, projectedRow, projectedCol)
    }))

    return {
      matrix: {
        words: projected.words,
        dates,
        dayIndices: dates.map((date) => calendarDayIndex(planStartDate, date)),
        cells: displayCells,
      } satisfies AdaptiveStageMatrix,
      displayCells,
    }
  }, [plan, practiceLogs, simulation, today])

  // `isLoadingRows` only ever clears from the row load, which never runs when
  // the plan list resolves without this id — gate on the plan so a missing /
  // deleted plan lands on the not-found screen instead of a stuck spinner.
  if (plansLoading || (plan != null && isLoadingRows)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
        加载计划预览…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-[1.05rem] font-extrabold text-[#f0abfc]">预览加载失败</div>
        <div className="text-sm text-[var(--wm-text-dim)]">{loadError}</div>
        <button
          type="button"
          onClick={reload}
          className="font-nunito cursor-pointer rounded-full border border-[var(--wm-border)] px-4 py-2 text-sm font-bold text-[#93c5fd]"
        >
          重试
        </button>
      </div>
    )
  }

  if (!plan || !simulation) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="text-sm text-[var(--wm-text-dim)]">计划不存在或暂无单词进度</div>
        <button
          type="button"
          onClick={onBack}
          className="font-nunito cursor-pointer rounded-full border border-[var(--wm-border)] px-4 py-2 text-sm font-bold text-[var(--wm-text-dim)]"
        >
          ← 返回
        </button>
      </div>
    )
  }

  const { baseline, days } = simulation
  const lastDay = days.at(-1)
  const selectedDay = selectedDate ? (days.find((d) => d.date === selectedDate) ?? null) : null

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="font-nunito cursor-pointer rounded-full border border-[var(--wm-border)] px-4 py-2 text-sm font-bold text-[var(--wm-text-dim)]"
        >
          ← 返回
        </button>
        <button
          type="button"
          onClick={reload}
          className="font-nunito cursor-pointer rounded-full border border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)] px-4 py-2 text-sm font-bold text-[#93c5fd]"
        >
          刷新预览
        </button>
      </div>

      <div className="mb-5 rounded-[24px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-6">
        <div className="font-fredoka mb-1 bg-gradient-to-br from-[#60a5fa] to-[#f0abfc] bg-clip-text text-3xl text-transparent">
          {plan.title} · 学习轨迹预览
        </div>
        <div className="mb-4 text-sm font-bold text-[var(--wm-text-dim)]">
          {scopeLabel(plan)} · 每日新词 {plan.newWordsPerDay} · 复习上限 {plan.reviewCap} · 熔断{' '}
          {plan.backlogFuse} · Boss 题包 {plan.bossPackLimit}
        </div>

        <div className="mb-4">
          <AdaptivePlanPreviewOverview rows={activeRows} plan={plan} simulation={simulation} />
        </div>

        {actualProgress && (
          <div className="mb-4 rounded-[18px] border border-[rgba(74,222,128,.22)] bg-[rgba(74,222,128,.05)] p-4">
            <div className="mb-3 text-[.68rem] font-extrabold tracking-[.16em] text-[#86efac] uppercase">
              实际执行统计 · {actualProgress.planStartDate} 至 {today}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatPill label="计划运行" value={actualProgress.calendarDays} color="#e2e8f0" />
              <StatPill label="实际学习日" value={actualProgress.activeDays} color="#86efac" />
              <StatPill label="已激活新词" value={actualProgress.introducedCount} color="#93c5fd" />
              <StatPill
                label="学习日均新词"
                value={Number(actualProgress.averagePerActiveDay.toFixed(1))}
                color="#c4b5fd"
              />
            </div>
            <div className="mt-2 text-[.65rem] font-bold text-[var(--wm-text-dim)]">
              注：现有进度表保存每个词的首次激活日和当前状态，因此历史学习日按真实激活记录统计，不会把今天当成计划第一天。
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
          {actualProgress && <span>计划开始 {actualProgress.planStartDate}</span>}
          <span>后续推演起点 {baseline.date}</span>
          <span>当前模式 {MODE_LABELS[baseline.mode]}</span>
          {lastDay && (
            <span>
              全对模拟至 {lastDay.date}（{days.length} 个学习日）
            </span>
          )}
        </div>
      </div>

      {fullTrajectory && (
        <StageTrajectoryMatrix
          matrix={fullTrajectory.matrix}
          days={days}
          vocab={vocab}
          displayCells={fullTrajectory.displayCells}
        />
      )}

      <PracticeHistory sessions={practiceLogs} vocab={vocab} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[.8rem] font-extrabold tracking-wide text-[var(--wm-text-dim)] uppercase">
          后续每日详情（承接实际进度）
        </div>
        <div
          className="inline-flex rounded-full border border-[var(--wm-border)] bg-white/[.03] p-0.5"
          role="tablist"
          aria-label="每日详情视图"
        >
          <button
            type="button"
            role="tab"
            aria-selected={detailView === 'list'}
            onClick={() => {
              setDetailView('list')
              setSelectedDate(null)
            }}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[.72rem] font-extrabold transition-colors ${
              detailView === 'list'
                ? 'bg-[rgba(96,165,250,.15)] text-[#93c5fd]'
                : 'text-[var(--wm-text-dim)] hover:text-[#93c5fd]'
            }`}
          >
            列表
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={detailView === 'calendar'}
            onClick={() => setDetailView('calendar')}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[.72rem] font-extrabold transition-colors ${
              detailView === 'calendar'
                ? 'bg-[rgba(139,92,246,.15)] text-[#c4b5fd]'
                : 'text-[var(--wm-text-dim)] hover:text-[#c4b5fd]'
            }`}
          >
            日历
          </button>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="rounded-[16px] border border-[rgba(74,222,128,.3)] bg-[rgba(74,222,128,.08)] px-4 py-6 text-center text-sm font-bold text-[#86efac]">
          计划已全部完成，无需后续预览。
        </div>
      ) : detailView === 'calendar' ? (
        <div className="flex flex-col gap-3">
          <AdaptivePlanPreviewCalendar
            days={days}
            today={today}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          {selectedDay && (
            <DayCard key={selectedDay.date} day={selectedDay} vocab={vocab} defaultOpen />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {days.map((day) => (
            <DayCard key={day.date} day={day} vocab={vocab} />
          ))}
        </div>
      )}
    </div>
  )
}
