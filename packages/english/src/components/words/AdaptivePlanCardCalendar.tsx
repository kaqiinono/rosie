'use client'

import { useEffect, useMemo, useState } from 'react'
import type { QuizType, WordEntry, WordMasteryMap } from '@rosie/core'
import { todayStr } from '@rosie/core'
import {
  loadAdaptivePracticeLogs,
  type AdaptivePracticeSessionLog,
  type AdaptivePracticeWordLog,
} from '../../utils/adaptivePlanPracticeLog'
import type { AdaptivePlanWordProgress, AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'
import type { SimDaySnapshot } from '../../utils/adaptivePlanSimulate'
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
  quizTypes: QuizType[]
  phases: string[]
  stageLabels: string[]
}

type CalendarDay = {
  date: string
  mode: 'normal' | 'review_only' | 'boss'
  words: CalendarWord[]
  projected: boolean
  inferred: boolean
  note: string | null
  newCount: number
  reviewCount: number
  promotedCount: number | null
  masteredCount: number | null
  cumulative: SimDaySnapshot['cumulative'] | null
}

type Props = {
  plan: AdaptiveWordPlan
  vocab: WordEntry[]
  masteryMap: WordMasteryMap
  userId: string
  onClose: () => void
  trajectoryDays?: SimDaySnapshot[]
  rangeStart?: string
  rangeEnd?: string
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
          quizTypes: [...new Set([
            ...(previous?.quizTypes ?? []),
            ...item.outcomes.flatMap((outcome) => outcome.quizType ? [outcome.quizType] : []),
          ])],
          phases: [...new Set([
            ...(previous?.phases ?? []),
            ...item.outcomes.map((outcome) => outcome.phase),
          ])],
          stageLabels: [],
        })
      }
    }
    return {
      date,
      mode: daySessions.some((session) => session.mode === 'boss') ? 'boss' : 'normal',
      words: [...byWord.values()],
      projected: false,
      inferred: daySessions.some((session) => session.recordKind === 'inferred'),
      note: null,
      newCount: daySessions.reduce((sum, session) => sum + session.newWordCount, 0),
      reviewCount: daySessions.reduce((sum, session) => sum + session.reviewWordCount, 0),
      promotedCount: null,
      masteredCount: [...byWord.values()].filter((word) => word.statusAfter === 'MASTERED').length,
      cumulative: null,
    }
  })
}

function projectedDays(days: SimDaySnapshot[]): CalendarDay[] {
  return days.map((day) => {
    const byWord = new Map<string, CalendarWord>()
    for (const touch of day.touches) {
      const previous = byWord.get(touch.wordKey)
      byWord.set(touch.wordKey, {
        wordKey: touch.wordKey,
        kind:
          previous?.kind === 'new' || touch.phase === 'study'
            ? 'new'
            : touch.phase === 'boss'
              ? 'boss'
              : 'review',
        stage: stageKey(touch.boxAfter, touch.statusAfter),
        boxBefore: previous?.boxBefore ?? touch.boxBefore,
        boxAfter: touch.boxAfter,
        statusAfter: touch.statusAfter,
        questionCount: (previous?.questionCount ?? 0) + touch.questionCount,
        correctCount: (previous?.correctCount ?? 0) + touch.questionCount,
        outcomes: previous?.outcomes ?? [],
        nextReviewDate: null,
        projected: true,
        quizTypes: [...new Set([
          ...(previous?.quizTypes ?? []),
          ...touch.quizTypes,
        ])],
        phases: [...new Set([...(previous?.phases ?? []), touch.phase])],
        stageLabels: [...new Set([
          ...(previous?.stageLabels ?? []),
          ...(touch.stageLabel ? [touch.stageLabel] : []),
        ])],
      })
    }
    return {
      date: day.date,
      mode: day.mode,
      words: [...byWord.values()],
      projected: true,
      inferred: false,
      note: day.note,
      newCount: day.newWordKeys.length,
      reviewCount: day.reviewWordKeys.length,
      promotedCount: day.promotedCount,
      masteredCount: day.masteredToday.length,
      cumulative: day.cumulative,
    }
  })
}

function stageCounts(words: CalendarWord[]): Map<StageKey, number> {
  const counts = new Map<StageKey, number>()
  for (const word of words) counts.set(word.stage, (counts.get(word.stage) ?? 0) + 1)
  return counts
}

function totalQuestions(words: CalendarWord[]): number {
  return words.reduce((sum, word) => sum + word.questionCount, 0)
}

function wordLabel(key: string, vocab: WordEntry[]): string {
  return findWordByKey(vocab, key)?.word ?? key.split('::').at(-1) ?? key
}

const KIND_LABEL: Record<DayWordKind, string> = { new: '新学', review: '复习', boss: 'Boss' }
const QUIZ_LABEL: Record<QuizType, string> = { A: 'A认读', B: 'B选择', C: 'C默写', D: 'D听写' }
const PHASE_LABEL: Record<string, string> = {
  study: '认读',
  step1_review: '复习',
  step3_final: '闯关',
  boss: 'Boss',
  boss_sink: 'Boss补练',
  unknown: '练习',
}

export default function AdaptivePlanCardCalendar({
  plan,
  vocab,
  masteryMap,
  userId,
  onClose,
  trajectoryDays,
  rangeStart,
  rangeEnd,
}: Props) {
  const isTrajectory = trajectoryDays != null
  const today = todayStr()
  const initialDate = isTrajectory
    ? rangeStart && rangeEnd && today >= rangeStart && today <= rangeEnd
      ? today
      : (rangeEnd ?? rangeStart ?? today)
    : today
  const initial = parseIso(initialDate)
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate)
  const [logs, setLogs] = useState<AdaptivePracticeSessionLog[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [detailWord, setDetailWord] = useState<WordEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadAdaptivePracticeLogs(userId, plan.id)
      .then((loaded) => {
        if (cancelled) return
        setLogs(loaded)

        const latestPracticeDate = loaded.reduce<string | null>(
          (latest, session) => (!latest || session.practiceDate > latest ? session.practiceDate : latest),
          null,
        )
        if (!isTrajectory && latestPracticeDate) {
          const latest = parseIso(latestPracticeDate)
          setYear(latest.year)
          setMonth(latest.month)
          setSelectedDate(latestPracticeDate)
        }
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
  }, [isTrajectory, plan.id, userId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const days = useMemo(() => {
    const map = new Map<string, CalendarDay>()
    for (const day of projectedDays(trajectoryDays ?? [])) map.set(day.date, day)
    for (const day of actualDays(logs ?? [])) map.set(day.date, day)
    return map
  }, [logs, trajectoryDays])

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
    <div
      className="fixed inset-0 z-[280] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${plan.title}计划日历`}
        onClick={(event) => event.stopPropagation()}
        className="animate-pop-in max-h-[94dvh] w-full max-w-[1000px] overflow-y-auto rounded-t-[26px] border border-[rgba(139,92,246,.4)] bg-[#111126] p-3 shadow-[0_24px_90px_rgba(0,0,0,.65)] sm:rounded-[26px] sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-fredoka text-xl text-[#c4b5fd]">🗓️ 计划日历</div>
            <div className="mt-0.5 text-[.68rem] font-bold text-[var(--wm-text-dim)]">
              {plan.title} · {isTrajectory ? `${rangeStart ?? '计划开始'} 至 ${rangeEnd ?? '计划结束'}` : '仅显示已练习数据'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭计划日历"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-lg text-white/55 transition hover:bg-white/[.12] hover:text-white"
          >
            ×
          </button>
        </div>
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
            <div className="text-[.6rem] font-bold text-[var(--wm-text-dim)]">已结算的真实练习记录</div>
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
            const questionCount = day ? totalQuestions(day.words) : 0
            const inRange = isTrajectory && rangeStart != null && rangeEnd != null
              ? cell.date >= rangeStart && cell.date <= rangeEnd
              : false
            const counts = day ? stageCounts(day.words) : new Map<StageKey, number>()
            const selected = selectedDate === cell.date
            const isToday = cell.date === today
            const stateClass = !day
              ? ''
              : day.projected
                ? day.mode === 'boss'
                  ? 'border-amber-500/35 bg-amber-950/20'
                  : day.mode === 'review_only'
                    ? 'border-rose-500/30 bg-rose-950/15'
                    : 'border-sky-500/28 bg-sky-950/15'
                : day.mode === 'boss'
                  ? 'border-amber-300/85 bg-gradient-to-br from-amber-400/28 to-orange-500/12 shadow-[0_0_14px_rgba(245,158,11,.16),inset_0_0_18px_rgba(245,158,11,.15)]'
                  : day.mode === 'review_only'
                    ? 'border-rose-300/80 bg-gradient-to-br from-rose-400/25 to-red-500/10 shadow-[0_0_14px_rgba(244,63,94,.14),inset_0_0_18px_rgba(244,63,94,.13)]'
                    : 'border-sky-300/75 bg-gradient-to-br from-sky-400/24 to-blue-500/10 shadow-[0_0_14px_rgba(56,189,248,.14),inset_0_0_18px_rgba(56,189,248,.12)]'
            return (
              <button
                key={cell.date}
                type="button"
                disabled={!day && !inRange}
                onClick={() => setSelectedDate(selected ? null : cell.date)}
                className={`relative flex min-h-[4.8rem] min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border px-1.5 py-1.5 text-left transition hover:-translate-y-0.5 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:opacity-35 disabled:hover:translate-y-0 sm:min-h-[5.6rem] ${stateClass} ${selected ? 'ring-2 ring-[#c4b5fd]' : ''} ${isToday && !day ? 'shadow-[inset_0_0_0_1px_rgba(147,197,253,.55)]' : ''}`}
              >
                <span className={`text-[.68rem] font-black ${isToday ? 'text-[#93c5fd]' : 'text-white/80'}`}>
                  {cell.day}
                </span>
                {day && (
                  <>
                    <span className={`mt-0.5 text-[.43rem] font-black leading-none ${day.projected ? 'text-violet-300/75' : 'text-emerald-300/80'}`}>
                      {day.projected ? '计划' : '实际'}
                    </span>
                    <span
                      className={`absolute top-1 right-1 rounded-full border px-1 py-0.5 text-[.45rem] font-black leading-none sm:text-[.5rem] ${
                        day.mode === 'boss'
                          ? 'border-amber-200/45 bg-amber-300/20 text-amber-200'
                          : day.mode === 'review_only'
                            ? 'border-rose-200/40 bg-rose-300/20 text-rose-200'
                            : 'border-sky-200/40 bg-sky-300/15 text-sky-200'
                      }`}
                    >
                      {day.mode === 'boss' ? '👹 BOSS' : day.mode === 'review_only' ? '🔥 熔断' : '✦ 练习'}
                    </span>
                    <span className="mt-auto whitespace-nowrap text-[.5rem] font-extrabold text-white/90 sm:text-[.58rem]">
                      {day.words.length}词/{questionCount}题
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-1 text-[.48rem] font-bold leading-tight sm:text-[.55rem]">
                      {STAGES.filter((stage) => (counts.get(stage.key) ?? 0) > 0).map((stage) => (
                        <span key={stage.key} style={{ color: stage.color }}>
                          {stage.emoji}{counts.get(stage.key)}
                        </span>
                      ))}
                      {(counts.get('unknown') ?? 0) > 0 && <span className="text-white/35">?{counts.get('unknown')}</span>}
                    </span>
                  </>
                )}
                {!day && inRange && (
                  <span className="mt-auto text-[.55rem] font-bold text-white/30">休息</span>
                )}
              </button>
            )
          })}
        </div>

        {isTrajectory && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[.62rem] font-bold text-[var(--wm-text-dim)]">
            <span className="inline-flex items-center gap-1 text-emerald-200/80">
              <span className="h-2.5 w-2.5 rounded border border-emerald-200/80 bg-emerald-300/35 shadow-[0_0_7px_rgba(110,231,183,.55)]" />
              已执行（点亮）
            </span>
            <span className="inline-flex items-center gap-1 text-white/45">
              <span className="h-2.5 w-2.5 rounded border border-white/25 bg-white/[.04]" />
              未执行（未点亮）
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="rounded-full border border-sky-300/55 bg-sky-300/15 px-1.5 py-0.5 text-sky-200">✦</span>
              有练习
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="rounded-full border border-amber-300/60 bg-amber-300/20 px-1.5 py-0.5 text-amber-200">👹</span>
              Boss 日
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="rounded-full border border-rose-300/55 bg-rose-300/20 px-1.5 py-0.5 text-rose-200">🔥</span>
              复习熔断
            </span>
            <span>点击日期查看单词信息</span>
          </div>
        )}

        {logs == null && <div className="mt-3 text-center text-[.68rem] font-bold text-white/35">加载真实练习记录…</div>}
        {logs?.length === 0 && !loadError && !isTrajectory && (
          <div className="mt-3 rounded-xl border border-dashed border-violet-300/25 bg-violet-950/20 px-4 py-6 text-center text-sm font-bold text-violet-200/65">
            还没有已完成的练习记录
          </div>
        )}
        {loadError && <div className="mt-3 text-center text-[.68rem] font-bold text-rose-300">{loadError}</div>}

        {selectedDay && (
          <div className="mt-4 rounded-xl border border-white/[.08] bg-white/[.03] p-3">
            <div className="flex flex-wrap items-center gap-2 text-[.72rem] font-extrabold text-white/75">
              <span>{selectedDay.date}</span>
              <span className="text-white/25">·</span>
              <span className="text-[#86efac]">
                {selectedDay.words.length}词/{totalQuestions(selectedDay.words)}题
              </span>
              {selectedDay.mode === 'boss' && <span className="text-amber-300">Boss</span>}
              {selectedDay.mode === 'review_only' && <span className="text-rose-300">复习熔断</span>}
              {selectedDay.inferred && <span className="text-amber-300">推定记录</span>}
              {selectedDay.projected && <span className="text-violet-300">计划排程</span>}
              {!selectedDay.projected && !selectedDay.inferred && <span className="text-emerald-300">实际记录</span>}
            </div>
            {selectedDay.note && (
              <div className="mt-2 text-[.68rem] font-bold leading-relaxed text-white/45">
                {selectedDay.note}
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {[
                ['新学', selectedDay.newCount, '#93c5fd'],
                ['复习', selectedDay.reviewCount, '#c4b5fd'],
                ['答题', totalQuestions(selectedDay.words), '#86efac'],
                ['新掌握', selectedDay.masteredCount ?? '—', '#fbbf24'],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-lg border border-white/[.07] bg-white/[.025] px-2 py-1.5">
                  <div className="text-[.55rem] font-extrabold text-white/35">{label}</div>
                  <div className="font-fredoka text-base" style={{ color: String(color) }}>{value}</div>
                </div>
              ))}
            </div>
            {selectedDay.cumulative && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[.62rem] font-bold text-white/45">
                <span>学习中 {selectedDay.cumulative.learning}</span>
                <span>已掌握 {selectedDay.cumulative.mastered}</span>
                <span>未开始 {selectedDay.cumulative.notStarted}</span>
                <span>累计激活 {selectedDay.cumulative.totalActivated}</span>
                <span>成长 +{selectedDay.promotedCount ?? 0}</span>
              </div>
            )}
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
                      {(word.phases.length > 0 || word.quizTypes.length > 0) && (
                        <span className="mt-0.5 block text-[.56rem] font-bold text-white/40">
                          {word.phases.map((phase) => PHASE_LABEL[phase] ?? phase).join(' + ')}
                          {word.quizTypes.length > 0
                            ? ` · ${word.quizTypes.map((type) => QUIZ_LABEL[type]).join(' + ')}`
                            : ''}
                          {word.stageLabels.length > 0 ? ` · ${word.stageLabels.join(' + ')}` : ''}
                        </span>
                      )}
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
        {isTrajectory && selectedDate && !selectedDay && rangeStart && rangeEnd
          && selectedDate >= rangeStart && selectedDate <= rangeEnd && (
          <div className="mt-4 rounded-xl border border-white/[.08] bg-white/[.03] p-4 text-center text-sm font-bold text-white/45">
            {selectedDate} · 休息日，无练习安排
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
    </div>
  )
}
