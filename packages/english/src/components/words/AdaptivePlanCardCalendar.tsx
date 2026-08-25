'use client'

import { useEffect, useMemo, useState } from 'react'
import type { WordEntry, WordMasteryMap } from '@rosie/core'
import { todayStr } from '@rosie/core'
import {
  loadAdaptivePracticeLogs,
  type AdaptivePracticeSessionLog,
  type AdaptivePracticeWordLog,
} from '../../utils/adaptivePlanPracticeLog'
import { simulateAdaptivePlan, type SimDaySnapshot } from '../../utils/adaptivePlanSimulate'
import type { AdaptivePlanWordProgress, AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'
import { findWordByKey } from '../../utils/english-helpers'
import TodayWordDetailModal from './TodayWordDetailModal'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const
const STAGES = [
  { key: '1', emoji: '🥚', color: '#fbbf24' },
  { key: '2', emoji: '🐛', color: '#a3e635' },
  { key: '3', emoji: '🦋', color: '#60a5fa' },
  { key: '4', emoji: '🌸', color: '#f472b6' },
  { key: '5', emoji: '🌳', color: '#4ade80' },
  { key: 'mastered', emoji: '👑', color: '#c4b5fd' },
] as const

type StageKey = (typeof STAGES)[number]['key'] | 'unknown'
type DayWordKind = 'new' | 'review' | 'boss'

type CalendarWord = {
  wordKey: string
  kind: DayWordKind
  stage: StageKey
  boxBefore: number | null
  boxAfter: number | null
  statusAfter: AdaptivePlanWordProgress['status'] | null
  questionCount: number
  correctCount: number
  outcomes: AdaptivePracticeWordLog['outcomes']
  nextReviewDate: string | null
  projected: boolean
}

type CalendarDay = {
  date: string
  mode: 'normal' | 'review_only' | 'boss'
  words: CalendarWord[]
  projected: boolean
  inferred: boolean
}

type Props = {
  plan: AdaptiveWordPlan
  rows: AdaptivePlanWordProgress[]
  vocab: WordEntry[]
  masteryMap: WordMasteryMap
  userId: string
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function parseIso(iso: string): { year: number; month: number } {
  const [year, month] = iso.split('-').map(Number)
  return { year: year ?? 1970, month: (month ?? 1) - 1 }
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

function monthGrid(year: number, month: number): Array<{ date: string; day: number } | null> {
  const cells: Array<{ date: string; day: number } | null> = []
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7
  for (let i = 0; i < mondayOffset; i += 1) cells.push(null)
  const count = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= count; day += 1) {
    cells.push({ date: isoDate(year, month, day), day })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function stageKey(box: number | null, status: AdaptivePlanWordProgress['status'] | null): StageKey {
  if (status === 'MASTERED') return 'mastered'
  if (box != null && box >= 1 && box <= 5) return String(box) as StageKey
  return 'unknown'
}

function actualDays(sessions: AdaptivePracticeSessionLog[]): CalendarDay[] {
  const byDate = new Map<string, AdaptivePracticeSessionLog[]>()
  for (const session of sessions) {
    const list = byDate.get(session.practiceDate) ?? []
    list.push(session)
    byDate.set(session.practiceDate, list)
  }

  return [...byDate].map(([date, daySessions]) => {
    const byWord = new Map<string, CalendarWord>()
    for (const session of daySessions) {
      for (const item of session.words) {
        const previous = byWord.get(item.wordKey)
        const isNew =
          item.statusBefore === 'NOT_STARTED' || item.statusBefore === 'LEARNING_PENDING'
        byWord.set(item.wordKey, {
          wordKey: item.wordKey,
          kind: previous?.kind === 'new' || isNew ? 'new' : session.mode === 'boss' ? 'boss' : 'review',
          stage: stageKey(item.boxAfter, item.statusAfter),
          boxBefore: previous?.boxBefore ?? item.boxBefore,
          boxAfter: item.boxAfter,
          statusAfter: item.statusAfter,
          questionCount: (previous?.questionCount ?? 0) + item.questionCount,
          correctCount: (previous?.correctCount ?? 0) + item.correctCount,
          outcomes: [...(previous?.outcomes ?? []), ...item.outcomes],
          nextReviewDate: item.nextReviewAfter,
          projected: false,
        })
      }
    }
    return {
      date,
      mode: daySessions.some((session) => session.mode === 'boss') ? 'boss' : 'normal',
      words: [...byWord.values()],
      projected: false,
      inferred: daySessions.some((session) => session.recordKind === 'inferred'),
    }
  })
}

function projectedDay(day: SimDaySnapshot): CalendarDay {
  return {
    date: day.date,
    mode: day.mode,
    projected: true,
    inferred: false,
    words: day.touches.map((touch) => ({
      wordKey: touch.wordKey,
      kind:
        touch.phase === 'study' ? 'new' : touch.phase === 'boss' ? 'boss' : 'review',
      stage: stageKey(touch.boxAfter, touch.statusAfter),
      boxBefore: touch.boxBefore,
      boxAfter: touch.boxAfter,
      statusAfter: touch.statusAfter,
      questionCount: touch.questionCount,
      correctCount: touch.questionCount,
      outcomes: [],
      nextReviewDate: null,
      projected: true,
    })),
  }
}

function stageCounts(words: CalendarWord[]): Map<StageKey, number> {
  const counts = new Map<StageKey, number>()
  for (const word of words) counts.set(word.stage, (counts.get(word.stage) ?? 0) + 1)
  return counts
}

function wordLabel(key: string, vocab: WordEntry[]): string {
  return findWordByKey(vocab, key)?.word ?? key.split('::').at(-1) ?? key
}

const KIND_LABEL: Record<DayWordKind, string> = { new: '新学', review: '复习', boss: 'Boss' }

export default function AdaptivePlanCardCalendar({
  plan,
  rows,
  vocab,
  masteryMap,
  userId,
}: Props) {
  const today = todayStr()
  const initial = parseIso(today)
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [selectedDate, setSelectedDate] = useState<string | null>(today)
  const [logs, setLogs] = useState<AdaptivePracticeSessionLog[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [detailWord, setDetailWord] = useState<WordEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadAdaptivePracticeLogs(userId, plan.id)
      .then((loaded) => {
        if (!cancelled) setLogs(loaded)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('[adaptive_word_plan] card calendar log load failed', error)
        setLoadError('练习记录加载失败，请稍后重试。')
        setLogs([])
      })
    return () => {
      cancelled = true
    }
  }, [plan.id, userId])

  const projection = useMemo(() => {
    const activeRows = rows.filter((row) => row.archivedAt == null)
    if (activeRows.length === 0 || plan.status !== 'active') return []
    return simulateAdaptivePlan({
      plan,
      wordKeys: activeRows.map((row) => row.wordKey),
      initialRows: activeRows,
      startDate: today,
      maxDays: 500,
      allCorrect: true,
    }).days
  }, [plan, rows, today])

  const days = useMemo(() => {
    const map = new Map<string, CalendarDay>()
    for (const day of projection) map.set(day.date, projectedDay(day))
    for (const day of actualDays(logs ?? [])) map.set(day.date, day)
    return map
  }, [logs, projection])

  const grid = useMemo(() => monthGrid(year, month), [month, year])
  const selectedDay = selectedDate ? days.get(selectedDate) : undefined
  const selectedEntries = useMemo(
    () =>
      (selectedDay?.words ?? [])
        .map((word) => findWordByKey(vocab, word.wordKey))
        .filter((entry): entry is WordEntry => entry != null),
    [selectedDay, vocab],
  )

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
    setSelectedDate(null)
  }

  return (
    <div className="border-t border-[var(--wm-border)] bg-black/10 px-3 py-4 sm:px-5">
      <div className="rounded-2xl border border-[rgba(139,92,246,.25)] bg-[rgba(15,23,42,.42)] p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="上一个月"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:border-[#93c5fd] hover:text-[#93c5fd]"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="font-fredoka text-base text-[#c4b5fd]">
              {year}年{month + 1}月
            </div>
            <div className="text-[.6rem] font-bold text-[var(--wm-text-dim)]">
              实线为真实练习 · 虚线为未来预计
            </div>
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="下一个月"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:border-[#93c5fd] hover:text-[#93c5fd]"
          >
            ›
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((label) => (
            <div key={label} className="py-1 text-center text-[.6rem] font-extrabold text-white/35">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, index) => {
            if (!cell) return <div key={`pad-${index}`} className="min-h-[4.8rem]" />
            const day = days.get(cell.date)
            const counts = day ? stageCounts(day.words) : new Map<StageKey, number>()
            const selected = selectedDate === cell.date
            const isToday = cell.date === today
            return (
              <button
                key={cell.date}
                type="button"
                disabled={!day}
                onClick={() => setSelectedDate(selected ? null : cell.date)}
                className={`flex min-h-[4.8rem] min-w-0 cursor-pointer flex-col rounded-lg border px-1 py-1 text-left transition disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:opacity-35 sm:min-h-[5.6rem] ${
                  day?.projected ? 'border-dashed' : 'border-solid'
                } ${
                  day?.mode === 'boss'
                    ? 'border-amber-400/45 bg-amber-400/[.08]'
                    : day
                      ? 'border-sky-400/30 bg-sky-400/[.06]'
                      : ''
                } ${selected ? 'ring-2 ring-[#c4b5fd]' : ''} ${isToday ? 'shadow-[inset_0_0_0_1px_rgba(147,197,253,.55)]' : ''}`}
              >
                <span className={`text-[.68rem] font-black ${isToday ? 'text-[#93c5fd]' : 'text-white/70'}`}>
                  {cell.day}
                </span>
                {day && (
                  <>
                    <span className="mt-0.5 text-[.56rem] font-extrabold text-[#86efac] sm:text-[.62rem]">
                      {day.words.length}词
                    </span>
                    <span className="mt-auto flex flex-wrap gap-x-1 text-[.48rem] font-bold leading-tight sm:text-[.55rem]">
                      {STAGES.filter((stage) => (counts.get(stage.key) ?? 0) > 0).map((stage) => (
                        <span key={stage.key} style={{ color: stage.color }}>
                          {stage.emoji}{counts.get(stage.key)}
                        </span>
                      ))}
                      {(counts.get('unknown') ?? 0) > 0 && <span className="text-white/35">?{counts.get('unknown')}</span>}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>

        {logs == null && <div className="mt-3 text-center text-[.68rem] font-bold text-white/35">加载真实练习记录…</div>}
        {loadError && <div className="mt-3 text-center text-[.68rem] font-bold text-rose-300">{loadError}</div>}

        {selectedDay && (
          <div className="mt-4 rounded-xl border border-white/[.08] bg-white/[.03] p-3">
            <div className="flex flex-wrap items-center gap-2 text-[.72rem] font-extrabold text-white/75">
              <span>{selectedDay.date}</span>
              <span className="text-white/25">·</span>
              <span className="text-[#86efac]">共 {selectedDay.words.length} 词</span>
              {selectedDay.mode === 'boss' && <span className="text-amber-300">Boss</span>}
              {selectedDay.projected && <span className="text-[#c4b5fd]">预计</span>}
              {selectedDay.inferred && <span className="text-amber-300">推定记录</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STAGES.map((stage) => {
                const count = stageCounts(selectedDay.words).get(stage.key) ?? 0
                return count > 0 ? (
                  <span key={stage.key} className="rounded-full border border-white/10 bg-white/[.04] px-2 py-0.5 text-[.65rem] font-bold" style={{ color: stage.color }}>
                    {stage.emoji} {count}
                  </span>
                ) : null
              })}
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {selectedDay.words.map((word) => {
                const entry = findWordByKey(vocab, word.wordKey)
                return (
                  <button
                    key={word.wordKey}
                    type="button"
                    disabled={!entry}
                    onClick={() => entry && setDetailWord(entry)}
                    className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-white/[.07] bg-white/[.025] px-2.5 py-2 text-left hover:border-[#a78bfa]/50 disabled:cursor-default"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[.78rem] font-extrabold text-[var(--wm-text)]">
                        {wordLabel(word.wordKey, vocab)}
                      </span>
                      <span className="text-[.6rem] font-bold text-[var(--wm-text-dim)]">
                        {KIND_LABEL[word.kind]}
                        {!word.projected && word.questionCount > 0
                          ? ` · ${word.correctCount}/${word.questionCount}题`
                          : ` · ${word.questionCount}题`}
                        {word.nextReviewDate ? ` · 下次 ${word.nextReviewDate}` : ''}
                      </span>
                    </span>
                    <span className="text-[.68rem] font-extrabold text-[#c4b5fd]">
                      {word.boxBefore ?? '—'} → {word.statusAfter === 'MASTERED' ? '👑' : (word.boxAfter ?? '?')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {detailWord && (
        <TodayWordDetailModal
          words={selectedEntries}
          initialWord={detailWord}
          masteryMap={masteryMap}
          onClose={() => setDetailWord(null)}
        />
      )}
    </div>
  )
}
