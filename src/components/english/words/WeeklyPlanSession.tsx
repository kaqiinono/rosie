'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { WordEntry, WeeklyPlan, WeekDayProgress } from '@/utils/type'
import { encodeWeeklyPlanProgress } from '@/utils/weeklyPlanProgress'
import {
  buildQuizOptions,
  classifyPlanWords,
  getDailySessionWords,
  hilite,
  highlightExample,
  interleaveOrderedQuizSlots,
  normalizeQuizTypes,
  shuffle,
  wordKey,
  ALL_CN_DAYS,
  fmtDate,
  fmtWeekRange,
} from '@/utils/english-helpers'
import { getWordMasteryLevel, MASTERY_ICON, CONSOLIDATE_PASS_STAGE } from '@/utils/masteryUtils'
import PhonicsWord from './PhonicsWord'
import QuizCard from './QuizCard'
import MasteryStatusPanel from './MasteryStatusPanel'
import { useAuth } from '@/contexts/AuthContext'
import { useWordsContext } from '@/contexts/WordsContext'
import { useImmersive } from '@/contexts/ImmersiveContext'
import { supabase } from '@/lib/supabase'
import { todayStr } from '@/utils/constant'

interface WeeklyPlanSessionProps {
  initialPlan: WeeklyPlan
  vocab: WordEntry[]
  onBack: () => void
}

type Phase = 'week-view' | 'study' | 'quiz' | 'done'

type WordKind = 'consolidate' | 'preview'

interface DpQuizQ {
  word: WordEntry
  type: 'A' | 'B' | 'C'
  kind: WordKind
}

interface SessionSnapshot {
  version: 2
  phase: 'study' | 'quiz'
  selectedDate: string
  subTask: 'all' | 'consolidate' | 'preview'
  studyIdx: number
  words: { key: string; kind: WordKind }[]
  quizQs: { key: string; type: 'A' | 'B' | 'C'; kind: WordKind }[]
  curQ: number
  quizResults: { key: string; correct: boolean }[]
}

function getWeekDayLabels(startDay: number): string[] {
  return Array.from({ length: 7 }, (_, i) => ALL_CN_DAYS[(startDay + i) % 7])
}

function loadSessionSnapshot(planId: string | undefined): SessionSnapshot | null {
  if (!planId || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`weekly_session_${planId}`)
    if (!raw) return null
    const snap = JSON.parse(raw) as Partial<SessionSnapshot>
    if (snap.version !== 2) return null
    if (snap.phase !== 'study' && snap.phase !== 'quiz') return null
    return snap as SessionSnapshot
  } catch { return null }
}

async function saveProgressToCloud(userId: string, plan: WeeklyPlan): Promise<void> {
  if (!plan.id) return
  try {
    await supabase
      .from('weekly_plans')
      .update({
        progress_data: encodeWeeklyPlanProgress(plan.progress, plan.weekCompletion),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('id', plan.id)
  } catch {
    /* ignore */
  }
}

export default function WeeklyPlanSession({ initialPlan, vocab, onBack }: WeeklyPlanSessionProps) {
  const { user } = useAuth()
  const { masteryMap, recordBatch } = useWordsContext()
  const { isImmersive, setIsImmersive } = useImmersive()
  const exitImmersive = useCallback(() => setIsImmersive(false), [setIsImmersive])

  const [plan, setPlan] = useState<WeeklyPlan>(initialPlan)
  const planRef = useRef<WeeklyPlan>(initialPlan)
  useEffect(() => {
    planRef.current = plan
  }, [plan])

  // Read sessionStorage exactly once via a lazy-init state (immutable after mount, not a ref)
  const [snap0] = useState(() => loadSessionSnapshot(initialPlan.id))
  const hydrationDone = useRef(false)

  const [phase, setPhase] = useState<Phase>(() => snap0?.phase ?? 'week-view')
  const [selectedDate, setSelectedDate] = useState<string | null>(() => snap0?.selectedDate ?? null)
  // When restoring a session, skip the "first unfinished day" defaulting by pre-seeding syncedPlanId
  const [syncedPlanId, setSyncedPlanId] = useState<string | undefined>(() =>
    snap0 ? initialPlan.id : undefined,
  )
  if (plan.id !== syncedPlanId) {
    setSyncedPlanId(plan.id)
    const firstUnfinished = plan.days.find((d) => !plan.progress[d.date]?.quizDone)
    setSelectedDate(firstUnfinished?.date ?? plan.days[plan.days.length - 1]?.date ?? null)
  }

  const [consolidateTypes, setConsolidateTypes] = useState<Set<'A' | 'B' | 'C'>>(
    new Set(['A', 'C']),
  )
  const [previewTypes, setPreviewTypes] = useState<Set<'A' | 'B' | 'C'>>(
    new Set(['A', 'B']),
  )

  // Words and quiz questions are stored as key arrays; actual WordEntry objects are derived via useMemo
  // so they hydrate automatically when vocab loads — no setState-in-effect required
  const [wordKeys, setWordKeys] = useState<{ key: string; kind: WordKind }[]>(
    () => snap0?.words ?? [],
  )
  const words = useMemo(
    () =>
      wordKeys
        .map(({ key, kind }) => {
          const entry = vocab.find((w) => wordKey(w) === key)
          return entry ? { entry, kind } : null
        })
        .filter((w): w is { entry: WordEntry; kind: WordKind } => w !== null),
    [wordKeys, vocab],
  )

  const [studyIdx, setStudyIdx] = useState(() => snap0?.studyIdx ?? 0)
  const [studyDefOnly, setStudyDefOnly] = useState(false)
  const [currentSubTask, setCurrentSubTask] = useState<'all' | 'consolidate' | 'preview'>(
    () => snap0?.subTask ?? 'all',
  )
  const [studyWordVisible, setStudyWordVisible] = useState(false)

  const [quizQKeys, setQuizQKeys] = useState<{ key: string; type: 'A' | 'B' | 'C'; kind: WordKind }[]>(
    () => snap0?.quizQs ?? [],
  )
  const quizQs = useMemo(
    () =>
      quizQKeys
        .map(({ key, type, kind }) => {
          const entry = vocab.find((w) => wordKey(w) === key)
          return entry ? { word: entry, type, kind } : null
        })
        .filter((q): q is DpQuizQ => q !== null),
    [quizQKeys, vocab],
  )

  const [curQ, setCurQ] = useState(() => snap0?.curQ ?? 0)
  const [score, setScore] = useState(() => snap0?.quizResults.filter((r) => r.correct).length ?? 0)
  const quizResultBuffer = useRef<{ entry: WordEntry; correct: boolean }[]>([])

  // One-time: hydrate quizResultBuffer (ref write — no setState) and activate immersive mode
  useEffect(() => {
    if (hydrationDone.current || !snap0 || !vocab.length) return
    hydrationDone.current = true
    quizResultBuffer.current = snap0.quizResults
      .map(({ key, correct }) => {
        const entry = vocab.find((w) => wordKey(w) === key)
        return entry ? { entry, correct } : null
      })
      .filter((r): r is { entry: WordEntry; correct: boolean } => r !== null)
    setIsImmersive(true)
  }, [snap0, vocab, setIsImmersive])

  // Persist active session to sessionStorage on every relevant state change
  useEffect(() => {
    if (!plan.id) return
    const key = `weekly_session_${plan.id}`
    if (phase === 'week-view' || phase === 'done') {
      try { sessionStorage.removeItem(key) } catch { /* noop */ }
      return
    }
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          version: 2,
          phase,
          selectedDate: selectedDate ?? '',
          subTask: currentSubTask,
          studyIdx,
          words: wordKeys,
          quizQs: quizQKeys,
          curQ,
          quizResults: quizResultBuffer.current
            .slice(0, curQ)
            .map(({ entry, correct }) => ({ key: wordKey(entry), correct })),
        } satisfies SessionSnapshot),
      )
    } catch { /* noop */ }
  }, [plan.id, phase, selectedDate, currentSubTask, studyIdx, wordKeys, quizQKeys, curQ])

  const cnDays = useMemo(() => getWeekDayLabels(plan.weekStartDay), [plan.weekStartDay])

  /** Unique plan words in calendar order (Thu→Wed), for mastery panel scope. */
  const planOrderedVocab = useMemo(() => {
    const byKey = new Map(vocab.map((w) => [wordKey(w), w]))
    const out: WordEntry[] = []
    const seen = new Set<string>()
    for (const d of plan.days) {
      for (const k of d.newWordKeys) {
        if (seen.has(k)) continue
        seen.add(k)
        const e = byKey.get(k)
        if (e) out.push(e)
      }
    }
    return out
  }, [plan.days, vocab])

  const updateDayProgress = useCallback(
    async (date: string, progress: WeekDayProgress) => {
      const current = planRef.current
      const updated: WeeklyPlan = {
        ...current,
        progress: { ...current.progress, [date]: progress },
      }
      planRef.current = updated
      setPlan(updated)
      if (user) void saveProgressToCloud(user.id, updated)
    },
    [user],
  )

  const buildSessionWords = useCallback(
    (dateStr: string) => {
      const dayIndex = plan.days.findIndex((d) => d.date === dateStr)
      if (dayIndex === -1) return []
      return getDailySessionWords(plan, vocab, masteryMap, dayIndex)
    },
    [plan, vocab, masteryMap],
  )

  const startStudy = useCallback(
    (dateStr: string, subTask: 'all' | 'consolidate' | 'preview' = 'all') => {
      const relevantTypes = subTask === 'preview' ? previewTypes : consolidateTypes
      const anyTypeSelected =
        subTask === 'all'
          ? consolidateTypes.size + previewTypes.size > 0
          : relevantTypes.size > 0
      if (!anyTypeSelected) {
        alert('请至少选择一种题型！')
        return
      }
      const session = buildSessionWords(dateStr)
      const filtered =
        subTask === 'all' ? session : session.filter((s) => s.kind === subTask)
      if (filtered.length === 0) return
      setCurrentSubTask(subTask)
      setWordKeys(filtered.map(({ entry, kind }) => ({ key: wordKey(entry), kind })))
      setStudyIdx(0)
      setStudyWordVisible(false)
      setStudyDefOnly(false)
      setSelectedDate(dateStr)
      setPhase('study')
      setIsImmersive(true)
    },
    [consolidateTypes, previewTypes, buildSessionWords, setIsImmersive],
  )

  const startQuiz = useCallback(() => {
    const seed = Date.now()
    const shuffled = shuffle(words, seed)
    const groups = shuffled.map(w => {
      const raw = w.kind === 'consolidate' ? consolidateTypes : previewTypes
      const types = normalizeQuizTypes(Array.from(raw))
      return types.map(t => ({ key: wordKey(w.entry), type: t, kind: w.kind }))
    })
    const qs = interleaveOrderedQuizSlots(groups, seed + 1)
    quizResultBuffer.current = []
    setQuizQKeys(qs)
    setCurQ(0)
    setScore(0)
    setPhase('quiz')
  }, [words, consolidateTypes, previewTypes])

  const handleAnswer = useCallback(
    (correct: boolean) => {
      if (correct) setScore((s) => s + 1)
      if (quizQs[curQ]) quizResultBuffer.current.push({ entry: quizQs[curQ].word, correct })
    },
    [quizQs, curQ],
  )

  const nextQ = useCallback(() => {
    const next = curQ + 1
    if (next >= quizQs.length) {
      const finalScore = quizResultBuffer.current.filter((r) => r.correct).length
      const pct = Math.round((finalScore / quizQs.length) * 100)
      if (selectedDate) {
        const existing = planRef.current.progress[selectedDate] ?? {}

        if (currentSubTask === 'all') {
          // Original behavior: mark the whole day done
          void updateDayProgress(selectedDate, {
            quizDone: true,
            lastScore: pct,
            completedAt: todayStr(),
          })
        } else {
          // Sub-task behavior: only mark the sub-task done
          const consolidateDone =
            currentSubTask === 'consolidate' ? true : existing.consolidateDone
          const previewDone =
            currentSubTask === 'preview' ? true : existing.previewDone

          const dayIndex = planRef.current.days.findIndex((d) => d.date === selectedDate)
          const session = getDailySessionWords(planRef.current, vocab, masteryMap, dayIndex)
          const hasPreview = session.some((s) => s.kind === 'preview')
          const quizDone =
            consolidateDone === true && (!hasPreview || previewDone === true)

          void updateDayProgress(selectedDate, {
            ...existing,
            quizDone,
            lastScore: pct,
            completedAt: existing.completedAt ?? todayStr(),
            consolidateDone,
            previewDone,
            ...(currentSubTask === 'consolidate'
              ? { consolidateScore: pct }
              : { previewScore: pct }),
          })
        }
      }
      recordBatch(quizResultBuffer.current)
      quizResultBuffer.current = []
      setPhase('done')
    } else {
      setCurQ(next)
    }
  }, [curQ, quizQs, selectedDate, currentSubTask, vocab, masteryMap, updateDayProgress, recordBatch])

  const quizOptions = useMemo(() => {
    const q = quizQs[curQ]
    if (!q) return []
    const seed = curQ * 997 + quizQs.length
    return buildQuizOptions(q.word, vocab, seed)
  }, [quizQs, curQ, vocab])

  const planClassification = useMemo(() => classifyPlanWords(plan, vocab), [plan, vocab])

  const { consolidateTotal, consolidateMet } = useMemo(() => {
    const keys: string[] = []
    for (const [k, kind] of planClassification) if (kind === 'consolidate') keys.push(k)
    const met = keys.filter(k => (masteryMap[k]?.stage ?? 0) >= 2).length
    return { consolidateTotal: keys.length, consolidateMet: met }
  }, [planClassification, masteryMap])

  const isLastDayToday = plan.days[plan.days.length - 1]?.date === todayStr()
  const showSundayBanner = isLastDayToday && consolidateTotal - consolidateMet > 0

  // ── WEEK VIEW ────────────────────────────────────────────────────────────
  if (phase === 'week-view') {
    const today = todayStr()
    const kindMap = classifyPlanWords(plan, vocab)
    const lastDay = plan.days[plan.days.length - 1]
    const isLastDay = lastDay?.date === today

    // Progress bar data
    const allConsolidateKeys = [...kindMap.entries()]
      .filter(([, k]) => k === 'consolidate')
      .map(([key]) => key)
    const consolidateTotal = allConsolidateKeys.length
    const consolidateDone = allConsolidateKeys.filter(k => {
      const m = masteryMap[k]
      return m !== undefined && (m.stage ?? 0) >= CONSOLIDATE_PASS_STAGE
    }).length

    // Sunday fallback: unmastered consolidate words
    const unmasteredConsolidate = consolidateTotal - consolidateDone

    return (
      <>
        <div className="mx-auto max-w-[1280px] px-4 py-5">
          <div className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-7">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-fredoka bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-2xl text-transparent">
                  {(() => {
                    const units = plan.unit.split(', ')
                    const lessons = plan.lesson.split(', ')
                    const allSameUnit = units.every((u) => u === units[0])
                    return allSameUnit
                      ? `${units[0]} · ${lessons.join(', ')}`
                      : units.map((u, i) => `${u} · ${lessons[i] ?? ''}`).join(', ')
                  })()}
                </div>
                <div className="mt-1 text-[.75rem] font-bold text-[var(--wm-text-dim)]">
                  {fmtWeekRange(plan.weekStart, plan.weekStartDay)}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={onBack}
                  className="font-nunito cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-4 py-1.5 text-[.75rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
                >
                  ← 返回列表
                </button>
                {isImmersive && (
                  <button
                    onClick={exitImmersive}
                    className="cursor-pointer rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[.72rem] font-bold text-white/55 transition-all hover:bg-white/20 hover:text-white/80"
                  >
                    ✕ 退出沉浸
                  </button>
                )}
              </div>
            </div>

            {consolidateTotal > 0 && (
              <div className="mt-3 rounded-[12px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-4 py-2.5">
                <div className="mb-1.5 flex items-center justify-between text-[.7rem] font-bold">
                  <span className="text-[#93c5fd]">本周必记达标</span>
                  <span className="text-[var(--wm-text-dim)]">{consolidateMet} / {consolidateTotal}</span>
                </div>
                <div className="h-[6px] w-full rounded-full bg-white/[.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#60a5fa] to-[#a78bfa] transition-[width] duration-400"
                    style={{ width: `${consolidateTotal === 0 ? 0 : Math.round((consolidateMet / consolidateTotal) * 100)}%` }}
                  />
                </div>
              </div>
            )}


            {/* 7-day grid */}
            <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto px-7 py-2 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 sm:py-0">
              {plan.days.map((day, i) => {
                const isDone = plan.progress[day.date]?.quizDone === true
                const isToday = day.date === today
                const isPast = day.date < today && !isDone
                const introducedUpTo = new Set<string>()
                for (let j = 0; j <= i; j++) plan.days[j].newWordKeys.forEach(k => introducedUpTo.add(k))
                let consolidateCount = 0
                let previewCount = 0
                for (const k of introducedUpTo) {
                  const kind = planClassification.get(k)
                  if (kind === 'preview') previewCount += 1
                  else consolidateCount += 1
                }
                const isSelected = selectedDate === day.date

                let borderColor = 'rgba(255,255,255,.07)'
                let textColor = 'rgba(255,255,255,.35)'
                let bgColor = 'rgba(255,255,255,.03)'
                if (isDone) {
                  borderColor = '#4ade80'
                  textColor = '#4ade80'
                  bgColor = 'rgba(74,222,128,.08)'
                } else if (isToday) {
                  borderColor = '#f59e0b'
                  textColor = '#fbbf24'
                  bgColor = 'rgba(245,158,11,.1)'
                } else if (isPast) {
                  borderColor = 'rgba(248,113,113,.3)'
                  textColor = 'rgba(248,113,113,.6)'
                }
                let boxShadow: string | undefined
                if (isSelected) {
                  if (isDone) {
                    bgColor = 'rgba(74,222,128,.25)'
                    borderColor = '#4ade80'
                    textColor = '#6ee7a0'
                    boxShadow = '0 0 0 2px rgba(74,222,128,.4), 0 4px 16px rgba(74,222,128,.3)'
                  } else if (isToday) {
                    bgColor = 'rgba(245,158,11,.25)'
                    borderColor = '#f59e0b'
                    textColor = '#fcd34d'
                    boxShadow = '0 0 0 2px rgba(245,158,11,.5), 0 4px 16px rgba(245,158,11,.3)'
                  } else if (isPast) {
                    bgColor = 'rgba(248,113,113,.18)'
                    borderColor = 'rgba(248,113,113,.8)'
                    textColor = 'rgba(248,113,113,1)'
                    boxShadow = '0 0 0 2px rgba(248,113,113,.35), 0 4px 16px rgba(248,113,113,.2)'
                  } else {
                    bgColor = 'rgba(255,255,255,.14)'
                    borderColor = 'rgba(255,255,255,.7)'
                    textColor = 'rgba(255,255,255,.9)'
                    boxShadow = '0 0 0 2px rgba(255,255,255,.25), 0 4px 16px rgba(255,255,255,.1)'
                  }
                }

                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(isSelected ? null : day.date)}
                    className="flex min-w-[3.6rem] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[12px] border-[1.5px] px-2 py-3 transition-all select-none sm:min-w-0 sm:px-1"
                    style={{
                      borderColor,
                      background: bgColor,
                      color: textColor,
                      boxShadow,
                      transform: isSelected ? 'translateY(-2px) scale(1.05)' : undefined,
                    }}
                  >
                    <div className="text-[.6rem] font-extrabold opacity-70">{cnDays[i]}</div>
                    <div className="font-fredoka text-[1.05rem] leading-none">
                      {fmtDate(day.date)}
                    </div>
                    <div className="text-center text-[.58rem] leading-tight font-bold opacity-60">
                      {isDone ? '✓ 完成' : isToday ? '今天' : `必记 ${consolidateCount} · 预习 ${previewCount}`}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          {showSundayBanner && (
            <div className="mt-4 rounded-[14px] border border-[rgba(248,113,113,.5)] bg-[rgba(248,113,113,.1)] px-4 py-3 text-[.82rem] font-extrabold text-[#f87171]">
              ⚠️ 今日兜底：还有 {consolidateTotal - consolidateMet} 个必记词未达标，今天务必攻克。
            </div>
          )}

          {/* Selected day detail */}
          {selectedDate &&
            (() => {
              const dayIndex = plan.days.findIndex((d) => d.date === selectedDate)
              const dayPlan = plan.days[dayIndex]
              if (!dayPlan) return null
              const isDone = plan.progress[selectedDate]?.quizDone === true
              const session = getDailySessionWords(plan, vocab, masteryMap, dayIndex)
              const consolidateList = session.filter(s => s.kind === 'consolidate')
              const previewList = session.filter(s => s.kind === 'preview')
              const metCount = consolidateList.filter(s => s.met).length
              const total = session.length
              const consolidateDoneToday = plan.progress[selectedDate]?.consolidateDone === true
              const previewDoneToday = plan.progress[selectedDate]?.previewDone === true
              const consolidateScore = plan.progress[selectedDate]?.consolidateScore
              const previewScore = plan.progress[selectedDate]?.previewScore
              const hasBothKinds = consolidateList.length > 0 && previewList.length > 0
              return (
                <div className="border-t border-[var(--wm-border)] pt-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-[.72rem] font-extrabold text-[var(--wm-text-dim)]">
                      {fmtDate(selectedDate)} {cnDays[dayIndex]}
                    </span>
                    <span className="rounded-full border border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.15)] px-2 py-0.5 text-[.65rem] font-bold text-[#93c5fd]">
                      必记 {consolidateList.length}（已达标 {metCount}）
                    </span>
                    {previewList.length > 0 && (
                      <span className="rounded-full border border-[rgba(249,115,22,.3)] bg-[rgba(249,115,22,.15)] px-2 py-0.5 text-[.65rem] font-bold text-[#fb923c]">
                        预习 {previewList.length}
                      </span>
                    )}
                    <span className="text-[.68rem] text-[var(--wm-text-dim)]">共 {total} 词</span>
                    {isDone && plan.progress[selectedDate]?.lastScore !== undefined && (
                      <span className="ml-auto text-[.72rem] font-bold text-[#4ade80]">
                        上次 {plan.progress[selectedDate].lastScore}%
                      </span>
                    )}
                  </div>

                  {consolidateList.length > 0 && (
                    <div className="mb-3">
                      <div className="mb-1.5 text-[.6rem] font-extrabold tracking-widest text-[#93c5fd] uppercase">
                        必记（{consolidateList.length} 个，已达标 {metCount}）
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {consolidateList.map((s) => {
                          const level = getWordMasteryLevel(masteryMap[wordKey(s.entry)]?.correct ?? 0)
                          return (
                            <span
                              key={wordKey(s.entry)}
                              className={`rounded-full border-[1.5px] px-2.5 py-1 text-[0.875rem] font-bold ${
                                s.met
                                  ? 'border-[rgba(74,222,128,.4)] bg-[rgba(74,222,128,.1)] text-[#86efac]'
                                  : 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)] text-[#93c5fd]'
                              }`}
                            >
                              {level > 0 && (
                                <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>
                              )}
                              {s.entry.word}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {previewList.length > 0 && (
                    <div className="mb-3">
                      <div className="mb-1.5 text-[.6rem] font-extrabold tracking-widest text-[#fb923c] uppercase">
                        预习（{previewList.length} 个）
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {previewList.map((s) => {
                          const level = getWordMasteryLevel(masteryMap[wordKey(s.entry)]?.correct ?? 0)
                          return (
                            <span
                              key={wordKey(s.entry)}
                              className="rounded-full border-[1.5px] border-[rgba(249,115,22,.4)] bg-[rgba(249,115,22,.08)] px-2.5 py-1 text-[0.875rem] font-bold text-[#fb923c]"
                            >
                              {level > 0 && (
                                <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>
                              )}
                              {s.entry.word}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {total === 0 && (
                    <div className="mb-4 text-[1.125rem] text-[var(--wm-text-dim)]">
                      暂无单词
                    </div>
                  )}

                  <div className="mb-2.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                    题型选择
                  </div>

                  {/* Two-row type selector */}
                  <div className="mb-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-[5.5rem] text-[.72rem] font-bold text-[#93c5fd]">必记词题型</span>
                      {(['A', 'B', 'C'] as const).map((t) => {
                        const labels = { A: '释义 → 选单词', B: '单词 → 选释义', C: '释义 → 默写' }
                        const on = consolidateTypes.has(t)
                        return (
                          <button
                            key={`c-${t}`}
                            onClick={() =>
                              setConsolidateTypes((prev) => {
                                const n = new Set(prev)
                                if (n.has(t)) n.delete(t); else n.add(t)
                                return n
                              })
                            }
                            className={`flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-2 text-[.82rem] font-bold transition-all select-none ${
                              on
                                ? 'border-[rgba(167,139,250,.5)] bg-[rgba(167,139,250,.1)] text-[#c4b5fd]'
                                : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
                            }`}
                          >
                            <span
                              className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[.6rem] font-black ${
                                t === 'A'
                                  ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
                                  : t === 'B'
                                    ? 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]'
                                    : 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                              }`}
                            >
                              {t}
                            </span>
                            {labels[t]}
                          </button>
                        )
                      })}
                    </div>
                    {previewList.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-[5.5rem] text-[.72rem] font-bold text-[#fb923c]">预习词题型</span>
                        {(['A', 'B', 'C'] as const).map((t) => {
                          const labels = { A: '释义 → 选单词', B: '单词 → 选释义', C: '释义 → 默写' }
                          const on = previewTypes.has(t)
                          return (
                            <button
                              key={`p-${t}`}
                              onClick={() =>
                                setPreviewTypes((prev) => {
                                  const n = new Set(prev)
                                  if (n.has(t)) n.delete(t); else n.add(t)
                                  return n
                                })
                              }
                              className={`flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-2 text-[.82rem] font-bold transition-all select-none ${
                                on
                                  ? 'border-[rgba(167,139,250,.5)] bg-[rgba(167,139,250,.1)] text-[#c4b5fd]'
                                  : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
                              }`}
                            >
                              <span
                                className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[.6rem] font-black ${
                                  t === 'A'
                                    ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
                                    : t === 'B'
                                      ? 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]'
                                      : 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                                }`}
                              >
                                {t}
                              </span>
                              {labels[t]}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* 主按钮：全部练习（原有行为） */}
                  <button
                    onClick={() => startStudy(selectedDate)}
                    className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-6 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
                  >
                    {isDone ? '🔄 重新练习' : '🚀 开始练习'}
                  </button>

                  {/* 可选分开练习行：仅当同时有必记和预习词时显示 */}
                  {hasBothKinds && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[.65rem] font-bold text-[var(--wm-text-dim)]">分开练习：</span>
                      <button
                        onClick={() => startStudy(selectedDate, 'consolidate')}
                        className={`font-nunito cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[.75rem] font-extrabold transition-all hover:-translate-y-px ${
                          consolidateDoneToday
                            ? 'border-[rgba(96,165,250,.6)] bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
                            : 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.07)] text-[#93c5fd] hover:border-[#60a5fa]'
                        }`}
                      >
                        {consolidateDoneToday
                          ? `✓ 必记${consolidateScore !== undefined ? ' ' + consolidateScore + '%' : ''}`
                          : `📘 必记 (${consolidateList.length})`}
                      </button>
                      <button
                        onClick={() => startStudy(selectedDate, 'preview')}
                        className={`font-nunito cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[.75rem] font-extrabold transition-all hover:-translate-y-px ${
                          previewDoneToday
                            ? 'border-[rgba(249,115,22,.6)] bg-[rgba(249,115,22,.15)] text-[#f97316]'
                            : 'border-[rgba(249,115,22,.35)] bg-[rgba(249,115,22,.07)] text-[#fb923c] hover:border-[#f97316]'
                        }`}
                      >
                        {previewDoneToday
                          ? `✓ 预习${previewScore !== undefined ? ' ' + previewScore + '%' : ''}`
                          : `🔖 预习 (${previewList.length})`}
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}

          {!selectedDate &&
            (() => {
              const today2 = todayStr()
              const todayInPlan = plan.days.find((d) => d.date === today2)
              if (!todayInPlan) return null
              return (
                <button
                  onClick={() => startStudy(today2)}
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-[rgba(245,158,11,.3)] bg-[rgba(245,158,11,.12)] px-2.5 py-1 text-[.65rem] font-extrabold text-[#fbbf24] transition-all hover:bg-[rgba(245,158,11,.2)]"
                >
                  ⚡ 开始今天的练习
                </button>
              )
            })()}
        </div>
        <MasteryStatusPanel
          vocab={vocab}
          masteryMap={masteryMap}
          orderedWordsInScope={planOrderedVocab}
          panelTitle="本周词汇学习状态"
        />
      </>
    )
  }

  // ── STUDY ────────────────────────────────────────────────────────────────
  if (phase === 'study' && words[studyIdx]) {
    const w = words[studyIdx]
    const total = words.length
    return (
      <div
        className="mx-auto flex max-w-[1280px] flex-col overflow-hidden px-4 max-sm:px-3"
        style={{ height: isImmersive ? '100dvh' : 'calc(100dvh - 56px)' }}
      >
        <div className="mb-0 flex shrink-0 flex-wrap items-center gap-2 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              onClick={() => setPhase('week-view')}
              className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3 py-1.5 text-[.75rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]"
            >
              ← 返回
            </button>
            <div className="font-fredoka truncate text-[1rem] text-[var(--wm-text)]">
              📖 记忆单词
            </div>
          </div>
          <div className="shrink-0 rounded-full border border-[var(--wm-border)] bg-[var(--wm-surface)] px-2.5 py-1 text-[.72rem] font-bold whitespace-nowrap text-[var(--wm-text-dim)]">
            {studyIdx + 1} / {total}
          </div>
          <button
            onClick={() => {
              setStudyDefOnly(!studyDefOnly)
              setStudyWordVisible(false)
            }}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[.72rem] font-extrabold whitespace-nowrap transition-all select-none ${
              studyDefOnly
                ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
                : 'border-white/10 bg-white/5 text-white/50'
            }`}
          >
            <span>✨</span> 仅看释义
            <div
              className={`relative h-3.5 w-7 rounded-[7px] transition-colors ${studyDefOnly ? 'bg-[rgba(245,158,11,.5)]' : 'bg-white/10'}`}
            >
              <div
                className={`absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full transition-all ${studyDefOnly ? 'translate-x-3.5 bg-[#f59e0b]' : 'bg-white/40'}`}
              />
            </div>
          </button>
          {isImmersive && (
            <button
              onClick={exitImmersive}
              className="shrink-0 cursor-pointer rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[.72rem] font-bold text-white/55 transition-all hover:bg-white/20 hover:text-white/80"
            >
              ✕ 退出沉浸
            </button>
          )}
        </div>
        <div className="mb-2 h-[3px] shrink-0 rounded-sm bg-white/[.04]">
          <div
            className="h-full rounded-sm bg-gradient-to-r from-[#d97706] via-[#f59e0b] to-[#fbbf24] transition-[width] duration-400"
            style={{ width: `${((studyIdx + 1) / total) * 100}%` }}
          />
        </div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[16px] border border-[var(--wm-border)] max-sm:flex-col">
          {/* Left — word */}
          <div
            className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden px-7 py-6 transition-all duration-400 max-sm:px-5 ${
              studyDefOnly && !studyWordVisible
                ? 'w-0 overflow-hidden p-0 opacity-0 max-sm:h-0 max-sm:w-full'
                : 'w-1/2 opacity-100 max-sm:h-[45%] max-sm:w-full'
            }`}
            style={{ background: 'linear-gradient(135deg, #1a1a30 0%, #12122a 100%)' }}
          >
            <div className="font-fredoka pointer-events-none absolute top-1/2 right-[-10px] -translate-y-1/2 text-[min(35vw,240px)] leading-none text-white/[.022] select-none">
              {w.entry.word.charAt(0).toUpperCase()}
            </div>
            <div className="relative z-[1] flex flex-wrap justify-center gap-1.5">
              <span
                className={`rounded-full border px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider uppercase ${
                  w.kind === 'consolidate'
                    ? 'border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.2)] text-[#93c5fd]'
                    : 'border-[rgba(249,115,22,.3)] bg-[rgba(249,115,22,.2)] text-[#fb923c]'
                }`}
              >
                {w.kind === 'consolidate' ? '必记' : '预习'}
              </span>
              <span className="rounded-full border border-[rgba(233,69,96,.3)] bg-[rgba(233,69,96,.2)] px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider text-[var(--wm-accent)] uppercase">
                {w.entry.unit}
              </span>
            </div>
            <div className="font-nunito relative z-[1] text-center text-[clamp(2rem,5vw,3.5rem)] leading-tight font-black break-words">
              <PhonicsWord text={w.entry.word} syllables={w.entry.syllables} />
            </div>
            {w.entry.ipa && (
              <div className="relative z-[1] text-[clamp(.85rem,1.8vw,1rem)] font-semibold text-[var(--wm-accent2)] italic opacity-85">
                {w.entry.ipa}
              </div>
            )}
            {w.entry.example && (
              <div className="relative z-[1] w-full border-t border-white/[.07] pt-3 text-center">
                <div className="mb-1.5 text-[.55rem] font-extrabold tracking-widest text-white/30 uppercase">
                  例句
                </div>
                <div
                  className="text-[1rem] leading-loose text-[rgba(200,200,255,.5)] italic [&_strong]:font-extrabold [&_strong]:text-[#4ade80] [&_strong]:not-italic"
                  dangerouslySetInnerHTML={{
                    __html: highlightExample(w.entry.example, w.entry.word),
                  }}
                />
              </div>
            )}
          </div>

          {/* Right — definition */}
          <div
            onClick={() => {
              if (studyDefOnly) setStudyWordVisible(!studyWordVisible)
            }}
            className={`relative flex flex-col items-center justify-center px-7 py-6 transition-all duration-400 max-sm:w-full max-sm:px-5 ${
              studyDefOnly && !studyWordVisible
                ? 'w-full cursor-pointer max-sm:flex-1'
                : studyDefOnly
                  ? 'w-1/2 cursor-pointer max-sm:flex-1'
                  : 'w-1/2 cursor-default max-sm:flex-1'
            }`}
            style={{ background: 'linear-gradient(135deg, #0e2a50 0%, #1a1a2e 100%)' }}
          >
            <div className="flex w-full max-w-[420px] flex-col items-start gap-2">
              <div className="text-[.6rem] font-extrabold tracking-widest text-[rgba(96,165,250,.6)] uppercase">
                释义
              </div>
              <div
                className="text-[clamp(1rem,2.5vw,1.45rem)] leading-loose font-bold text-[#f0f0ff]"
                dangerouslySetInnerHTML={{
                  __html: hilite(w.entry.explanation, w.entry.word, w.entry.keywords),
                }}
              />
            </div>
            {studyDefOnly && (
              <div className="absolute right-5 bottom-4 flex items-center gap-1 text-[.65rem] font-bold text-white/25">
                {studyWordVisible ? '点击隐藏单词' : '点击查看单词'}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-3.5 py-2">
          <button
            onClick={() => {
              if (studyIdx > 0) {
                setStudyIdx(studyIdx - 1)
                setStudyWordVisible(false)
              }
            }}
            disabled={studyIdx === 0}
            className="font-nunito cursor-pointer rounded-full border-[1.5px] border-white/10 bg-transparent px-6 py-2.5 text-[1rem] font-bold text-white/40 transition-all hover:border-[#60a5fa] hover:text-[#93c5fd] disabled:cursor-default disabled:opacity-20"
          >
            ← 上一个
          </button>
          <div className="min-w-[60px] text-center text-[0.875rem] font-bold text-white/30">
            {studyIdx + 1} / {total}
          </div>
          <button
            onClick={() => {
              if (studyIdx < total - 1) {
                setStudyIdx(studyIdx + 1)
                setStudyWordVisible(false)
              } else startQuiz()
            }}
            className="font-nunito cursor-pointer rounded-full border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-7 py-2.5 text-[1rem] font-extrabold text-white shadow-[0_3px_12px_rgba(217,119,6,.4)] hover:-translate-y-px"
          >
            {studyIdx === total - 1 ? '✅ 开始测试 →' : '下一个 →'}
          </button>
        </div>
      </div>
    )
  }

  // ── QUIZ ─────────────────────────────────────────────────────────────────
  if (phase === 'quiz' && quizQs[curQ]) {
    const q = quizQs[curQ]
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-5">
        <div className="mb-2 flex items-center gap-3 py-3">
          <button
            onClick={() => {
              // Flush results so far before returning to study phase
              if (quizResultBuffer.current.length > 0) {
                recordBatch(quizResultBuffer.current)
                quizResultBuffer.current = []
              }
              setStudyIdx(0)
              setStudyWordVisible(false)
              setPhase('study')
            }}
            className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]"
          >
            ← 回到记忆
          </button>
          <div className="font-fredoka text-[1.1rem] text-[var(--wm-text)]">✏️ 单词测试</div>
        </div>
        <QuizCard
          question={{ word: q.word, type: q.type }}
          options={quizOptions}
          currentIndex={curQ}
          totalCount={quizQs.length}
          score={score}
          onAnswer={handleAnswer}
          onNext={nextQ}
        />
      </div>
    )
  }

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const total = quizQs.length
    const pct = total ? Math.round((score / total) * 100) : 0
    const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '💪'
    const msg =
      pct >= 90 ? '完美！' : pct >= 70 ? '太棒了！' : pct >= 50 ? '不错哦！' : '继续加油！'
    const masteredCount = words.filter(
      (w) =>
        getWordMasteryLevel(
          masteryMap[`${w.entry.unit}::${w.entry.lesson}::${w.entry.word}`]?.correct ?? 0,
        ) === 3,
    ).length

    return (
      <>
        <div className="mx-auto max-w-[500px] px-5 py-10 text-center">
          <div className="mb-3.5 text-[3.5rem]">{emoji}</div>
          <div className="font-fredoka mb-1.5 bg-gradient-to-br from-[#d97706] to-[#f59e0b] bg-clip-text text-[3rem] text-transparent">
            {score} / {total}
          </div>
          <div className="mb-2.5 text-[.9rem] font-bold text-[var(--wm-text-dim)]">{msg}</div>
          <div className="mb-2 text-[0.875rem] leading-loose text-[var(--wm-text-dim)]">
            正确率 {pct}% · {words.length} 个单词
            {selectedDate &&
              ` · ${fmtDate(selectedDate)} ${cnDays[plan.days.findIndex((d) => d.date === selectedDate)]}`}
          </div>
          <div className="mb-5 text-[1rem] font-bold text-[#4ade80]">
            本次练习：{masteredCount}/{words.length} 个单词已掌握 🦋
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              onClick={() => startQuiz()}
              className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-6 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)]"
            >
              🔄 重新测试
            </button>
            <button
              onClick={() => setPhase('week-view')}
              className="font-nunito cursor-pointer rounded-[10px] border-[1.5px] border-[var(--wm-border)] bg-transparent px-5 py-2.5 text-[1rem] font-bold text-[var(--wm-text-dim)]"
            >
              返回周计划
            </button>
          </div>
        </div>
        <MasteryStatusPanel
          vocab={vocab}
          masteryMap={masteryMap}
          orderedWordsInScope={planOrderedVocab}
          panelTitle="本周词汇学习状态"
        />
      </>
    )
  }

  return null
}
