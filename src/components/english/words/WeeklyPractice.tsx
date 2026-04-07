'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import type { WordEntry, WeeklyPlan } from '@/utils/type'
import {
  buildWeeklyPlan,
  buildQuizOptions,
  getReviewWordsForDay,
  getOrderedLessons,
  getWeekStart,
  hilite,
  highlightExample,
  wordKey,
} from '@/utils/english-helpers'
import { getWordMasteryLevel, MASTERY_ICON } from '@/utils/masteryUtils'
import PhonicsWord from './PhonicsWord'
import QuizCard from './QuizCard'
import MasteryStatusPanel from './MasteryStatusPanel'
import { useAuth } from '@/contexts/AuthContext'
import { useWordsContext } from '@/contexts/WordsContext'
import { useImmersive } from '@/contexts/ImmersiveContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { todayStr } from '@/utils/constant'

interface WeeklyPracticeProps {
  vocab: WordEntry[]
}

type Phase = 'plans-list' | 'setup' | 'week-view' | 'study' | 'quiz' | 'done'

interface DpQuizQ {
  word: WordEntry
  type: 'A' | 'B' | 'C'
  isReview: boolean
}

const ALL_CN_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const ALL_DAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' },
]

function getWeekDayLabels(startDay: number): string[] {
  return Array.from({ length: 7 }, (_, i) => ALL_CN_DAYS[(startDay + i) % 7])
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

function fmtWeekRange(weekStart: string, startDay: number): string {
  const [y, m, day] = weekStart.split('-').map(Number)
  const end = new Date(y, m - 1, day + 6)
  const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  const startLabel = ALL_CN_DAYS[startDay]
  const endLabel = ALL_CN_DAYS[(startDay + 6) % 7]
  return `${fmtDate(weekStart)} ${startLabel} – ${fmtDate(endStr)} ${endLabel}`
}

function getWeekEnd(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const end = new Date(y, m - 1, d + 6)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
}

function daysUntilExpiry(weekStart: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = weekStart.split('-').map(Number)
  const expiry = new Date(y, m - 1, d + 6)
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000)
}

export default function WeeklyPractice({ vocab }: WeeklyPracticeProps) {
  const { user } = useAuth()
  const { masteryMap, recordBatch } = useWordsContext()
  const {
    weeklyPlan,
    allPlans,
    selectPlan,
    deletePlan,
    defaultParams,
    savePlan,
    updateDayProgress,
    isLoading,
  } = useWeeklyPlan(user)

  const { isImmersive, setIsImmersive } = useImmersive()
  const exitImmersive = useCallback(() => setIsImmersive(false), [setIsImmersive])

  const [phase, setPhase] = useState<Phase>('plans-list')
  const [showParamsDialog, setShowParamsDialog] = useState(false)
  const [isEditingPlan, setIsEditingPlan] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [syncedWeeklyPlanId, setSyncedWeeklyPlanId] = useState<string | null>(null)
  if (weeklyPlan && weeklyPlan.weekStart !== syncedWeeklyPlanId) {
    setSyncedWeeklyPlanId(weeklyPlan.weekStart)
    const firstUnfinished = weeklyPlan.days.find(
      (d) => !weeklyPlan.progress[d.date]?.quizDone,
    )
    setSelectedDate(firstUnfinished?.date ?? weeklyPlan.days[weeklyPlan.days.length - 1]?.date ?? null)
  }
  const [showLessonPicker, setShowLessonPicker] = useState(false)
  const [pendingLessons, setPendingLessons] = useState<{ unit: string; lesson: string }[]>([])
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set(['A', 'B', 'C']))
  const [newPerDay, setNewPerDay] = useState<number>(3)
  const [weekStartDay, setWeekStartDay] = useState<number>(4)
  const [pendingDate, setPendingDate] = useState<string>(todayStr())
  const [syncedDefaultParams, setSyncedDefaultParams] = useState(defaultParams)
  if (syncedDefaultParams !== defaultParams) {
    setSyncedDefaultParams(defaultParams)
    if (defaultParams) {
      setNewPerDay(defaultParams.newWordsPerDay)
      setWeekStartDay(defaultParams.weekStartDay)
    }
  }

  // Study/quiz state
  const [words, setWords] = useState<{ entry: WordEntry; isReview: boolean }[]>([])
  const [studyIdx, setStudyIdx] = useState(0)
  const [studyDefOnly, setStudyDefOnly] = useState(false)
  const [studyWordVisible, setStudyWordVisible] = useState(false)
  const [quizQs, setQuizQs] = useState<DpQuizQ[]>([])
  const [curQ, setCurQ] = useState(0)
  const [score, setScore] = useState(0)
  const quizResultBuffer = useRef<{ entry: WordEntry; correct: boolean }[]>([])

  const orderedLessons = useMemo(() => getOrderedLessons(vocab), [vocab])
  const cnDays = useMemo(() => getWeekDayLabels(weekStartDay), [weekStartDay])

  const suggestedLesson = useMemo(() => {
    return orderedLessons[0] ?? null
  }, [orderedLessons])

  const activeLessons = useMemo(() => {
    return pendingLessons.length > 0 ? pendingLessons : suggestedLesson ? [suggestedLesson] : []
  }, [pendingLessons, suggestedLesson])
  const activeLesson = activeLessons[0] ?? null

  // Words for the active lessons (for setup)
  const lessonWords = useMemo(() => {
    if (!activeLessons.length) return []
    return vocab.filter((w) =>
      activeLessons.some((l) => l.unit === w.unit && l.lesson === w.lesson),
    )
  }, [vocab, activeLessons])

  const incompletePlans = useMemo(() => {
    return allPlans.filter(
      (plan) => !plan.days.every((day) => plan.progress[day.date]?.quizDone === true),
    )
  }, [allPlans])

  // Set of "unit::lesson" keys belonging to the current plan
  const planLessonSet = useMemo(() => {
    if (!weeklyPlan) return new Set<string>()
    const units = weeklyPlan.unit.split(', ')
    const lessons = weeklyPlan.lesson.split(', ')
    return new Set(units.map((u, i) => `${u}::${lessons[i] ?? ''}`))
  }, [weeklyPlan])

  // Which out-of-plan old review words the user has manually toggled on
  const [selectedOldReviewKeys, setSelectedOldReviewKeys] = useState<Set<string>>(new Set())
  const [syncedSelectedDate, setSyncedSelectedDate] = useState(selectedDate)
  if (syncedSelectedDate !== selectedDate) {
    setSyncedSelectedDate(selectedDate)
    setSelectedOldReviewKeys(new Set())
  }

  const dialogWeekStart = useMemo(
    () => getWeekStart(new Date(pendingDate + 'T12:00:00'), weekStartDay),
    [pendingDate, weekStartDay],
  )

  const handleConfirmLesson = useCallback(async () => {
    if (!activeLesson) return
    const plan: WeeklyPlan = {
      weekStart: dialogWeekStart,
      unit: activeLessons.map((l) => l.unit).join(', '),
      lesson: activeLessons.map((l) => l.lesson).join(', '),
      weekStartDay,
      newWordsPerDay: newPerDay,
      days: buildWeeklyPlan(lessonWords, dialogWeekStart, newPerDay),
      progress: {},
    }
    await savePlan(plan)
    setShowParamsDialog(false)
    setPhase('week-view')
  }, [activeLesson, activeLessons, dialogWeekStart, lessonWords, newPerDay, weekStartDay, savePlan])

  // Build session words for a given day
  const buildSessionWords = useCallback(
    (dateStr: string) => {
      if (!weeklyPlan) return []
      const dayIndex = weeklyPlan.days.findIndex((d) => d.date === dateStr)
      if (dayIndex === -1) return []
      const dayPlan = weeklyPlan.days[dayIndex]
      const newWords = dayPlan.newWordKeys
        .map((k) => vocab.find((w) => wordKey(w) === k))
        .filter((w): w is WordEntry => !!w)
      const { weekReview, oldReview } = getReviewWordsForDay(
        vocab,
        masteryMap,
        weeklyPlan,
        dayIndex,
      )
      const includedOldReview = oldReview.filter(
        (e) => planLessonSet.has(`${e.unit}::${e.lesson}`) || selectedOldReviewKeys.has(wordKey(e)),
      )
      return [
        ...newWords.map((e) => ({ entry: e, isReview: false })),
        ...weekReview.map((e) => ({ entry: e, isReview: true })),
        ...includedOldReview.map((e) => ({ entry: e, isReview: true })),
      ]
    },
    [weeklyPlan, vocab, masteryMap, planLessonSet, selectedOldReviewKeys],
  )

  const startStudy = useCallback(
    (dateStr: string) => {
      if (!enabledTypes.size) {
        alert('请至少选择一种题型！')
        return
      }
      const session = buildSessionWords(dateStr)
      setWords(session)
      setStudyIdx(0)
      setStudyWordVisible(false)
      setStudyDefOnly(false)
      setSelectedDate(dateStr)
      setPhase('study')
      setIsImmersive(true)
    },
    [enabledTypes, buildSessionWords, setIsImmersive],
  )

  const startQuiz = useCallback(() => {
    const types = [...enabledTypes] as ('A' | 'B' | 'C')[]
    const qs: DpQuizQ[] = []
    words.forEach((w) =>
      types.forEach((t) => qs.push({ word: w.entry, type: t, isReview: w.isReview })),
    )
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[qs[i], qs[j]] = [qs[j], qs[i]]
    }
    quizResultBuffer.current = []
    setQuizQs(qs)
    setCurQ(0)
    setScore(0)
    setPhase('quiz')
  }, [words, enabledTypes])

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
        void updateDayProgress(selectedDate, {
          quizDone: true,
          lastScore: pct,
          completedAt: todayStr(),
        })
      }
      recordBatch(quizResultBuffer.current)
      quizResultBuffer.current = []
      setPhase('done')
    } else {
      setCurQ(next)
    }
  }, [curQ, quizQs, selectedDate, updateDayProgress, recordBatch])

  const quizOptions = useMemo(() => {
    const q = quizQs[curQ]
    if (!q) return []
    const seed = curQ * 997 + quizQs.length
    return buildQuizOptions(q.word, vocab, seed)
  }, [quizQs, curQ, vocab])

  // ── PLANS LIST ───────────────────────────────────────────────────────────
  if (phase === 'plans-list' && !showParamsDialog) {
    if (isLoading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
          加载中…
        </div>
      )
    }
    return (
      <>
        <div className="mx-auto max-w-[1280px] px-4 pt-5 pb-3">
          <div className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="font-fredoka bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-2xl text-transparent">
                周计划
              </div>
              <button
                onClick={() => {
                  setPendingLessons([])
                  setPendingDate(todayStr())
                  setIsEditingPlan(false)
                  setShowParamsDialog(true)
                }}
                className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-5 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
              >
                + 创建周计划
              </button>
            </div>
            {incompletePlans.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--wm-text-dim)]">
                暂无未完成的周计划
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {incompletePlans.map((plan) => {
                  const doneDays = plan.days.filter(
                    (d) => plan.progress[d.date]?.quizDone === true,
                  ).length
                  const remaining = daysUntilExpiry(plan.weekStart)
                  const isExpired = remaining < 0
                  const weekEnd = getWeekEnd(plan.weekStart)
                  const units = plan.unit.split(', ')
                  const lessons = plan.lesson.split(', ')
                  const allSameUnit = units.every((u) => u === units[0])
                  const lessonLabel = allSameUnit
                    ? `${units[0]} · ${lessons.join(', ')}`
                    : units.map((u, i) => `${u} · ${lessons[i] ?? ''}`).join(', ')
                  return (
                    <div key={plan.weekStart} className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          selectPlan(plan)
                          setPhase('week-view')
                        }}
                        className="min-w-0 flex-1 cursor-pointer rounded-[14px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-5 py-4 text-left transition-all hover:border-[var(--wm-accent)] hover:bg-[var(--wm-surface)]"
                      >
                        <div className="mb-1 text-[1rem] font-bold text-[var(--wm-text)]">
                          {lessonLabel}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-[.72rem] text-[var(--wm-text-dim)]">
                          <span>
                            {fmtDate(plan.weekStart)} – {fmtDate(weekEnd)}
                          </span>
                          <span>{doneDays}/7 天完成</span>
                          <span className={isExpired ? 'text-[#f87171]' : 'text-[#fbbf24]'}>
                            {isExpired
                              ? `已过期 ${Math.abs(remaining)} 天`
                              : `还剩 ${remaining} 天`}
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`确定删除「${lessonLabel}」周计划？`)) {
                            void deletePlan(plan.weekStart)
                          }
                        }}
                        className="shrink-0 cursor-pointer rounded-[10px] border border-[var(--wm-border)] bg-transparent px-3 py-3 text-[.75rem] text-[var(--wm-text-dim)] transition-all hover:border-[#f87171] hover:bg-[rgba(248,113,113,.08)] hover:text-[#f87171]"
                        title="删除"
                      >
                        🗑
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-[1280px]">
          <MasteryStatusPanel vocab={vocab} masteryMap={masteryMap} />
        </div>
      </>
    )
  }

  // ── PARAMS DIALOG ────────────────────────────────────────────────────────
  if (showParamsDialog) {
    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      >
        <div className="mx-auto max-w-[560px] px-4 py-10">
          <div className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-7">
            <div className="font-fredoka mb-1 bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-2xl text-transparent">
              {isEditingPlan ? '修改周计划' : '创建周计划'}
            </div>
            <div className="mb-4">
              <div className="mb-1.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                选择日期
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="date"
                  value={pendingDate}
                  onChange={(e) => e.target.value && setPendingDate(e.target.value)}
                  className="cursor-pointer rounded-[10px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3 py-1.5 text-[.88rem] font-bold text-[var(--wm-text)] outline-none focus:border-[var(--wm-accent)]"
                />
                <span className="text-[.75rem] font-bold text-[var(--wm-text-dim)]">
                  → 周 {fmtWeekRange(dialogWeekStart, weekStartDay)}
                </span>
              </div>
            </div>

            {activeLesson ? (
              <>
                <div className="mb-4 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-5 py-4">
                  <div className="mb-1.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                    建议学习
                  </div>
                  <div className="text-[1.1rem] font-bold text-[var(--wm-text)]">
                    {activeLessons.every((l) => l.unit === activeLessons[0].unit)
                      ? `${activeLessons[0].unit} · ${activeLessons.map((l) => l.lesson).join(', ')}`
                      : activeLessons.map((l) => `${l.unit} · ${l.lesson}`).join(', ')}
                  </div>

                  <div className="mt-0.5 text-[.72rem] text-[var(--wm-text-dim)]">
                    共 {lessonWords.length} 个单词 · 每天 {newPerDay} 个新词
                  </div>
                </div>

                <div className="mb-4">
                  <button
                    onClick={() => {
                      if (!showLessonPicker && pendingLessons.length === 0 && suggestedLesson) {
                        setPendingLessons([suggestedLesson])
                      }
                      setShowLessonPicker((v) => !v)
                    }}
                    className="font-nunito cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-4 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
                  >
                    选择课程{pendingLessons.length > 0 ? ` (${pendingLessons.length})` : ''}{' '}
                    {showLessonPicker ? '▴' : '▾'}
                  </button>
                </div>

                {showLessonPicker && (
                  <div className="max-h-[240px] overflow-hidden overflow-y-auto rounded-xl border border-[var(--wm-border)]">
                    {orderedLessons.map((l) => {
                      const isActive = activeLessons.some(
                        (al) => al.unit === l.unit && al.lesson === l.lesson,
                      )
                      return (
                        <button
                          key={`${l.unit}::${l.lesson}`}
                          onClick={() => {
                            setPendingLessons((prev) => {
                              const exists = prev.some(
                                (p) => p.unit === l.unit && p.lesson === l.lesson,
                              )
                              if (exists)
                                return prev.filter(
                                  (p) => !(p.unit === l.unit && p.lesson === l.lesson),
                                )
                              return [...prev, l]
                            })
                          }}
                          className={`flex w-full cursor-pointer items-center gap-2.5 border-b border-[var(--wm-border)] px-4 py-2.5 text-left text-[1rem] font-bold transition-all last:border-0 ${
                            isActive
                              ? 'bg-[rgba(245,158,11,.12)] text-[#fbbf24]'
                              : 'bg-[var(--wm-surface2)] text-[var(--wm-text)] hover:bg-[var(--wm-surface)]'
                          }`}
                        >
                          <span
                            className={`inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border text-[.6rem] font-black transition-all ${
                              isActive
                                ? 'border-[#f59e0b] bg-[rgba(245,158,11,.3)] text-[#fbbf24]'
                                : 'border-[var(--wm-border)] bg-transparent'
                            }`}
                          >
                            {isActive && '✓'}
                          </span>
                          {l.unit} · {l.lesson}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* New words per day selector */}
                <div className="mt-5 border-t border-[var(--wm-border)] pt-4">
                  <div className="mb-2.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                    每天新词数量
                  </div>
                  <div className="mb-5 flex gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => setNewPerDay(n)}
                        className={`h-9 w-9 cursor-pointer rounded-full border-[1.5px] text-[1rem] font-extrabold transition-all ${
                          newPerDay === n
                            ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
                            : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="mb-2.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                    每周开始于
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_DAY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setWeekStartDay(opt.value)}
                        className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1.5 text-[0.875rem] font-bold transition-all ${
                          weekStartDay === opt.value
                            ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
                            : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-[var(--wm-text-dim)]">
                没有找到课程数据，请先导入单词。
              </div>
            )}
            {activeLesson && (
              <div className="mt-6 flex gap-2.5 border-t border-[var(--wm-border)] pt-5">
                <button
                  onClick={() => {
                    setShowParamsDialog(false)
                    setPhase('plans-list')
                  }}
                  className="font-nunito flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-[var(--wm-border)] bg-transparent py-2.5 text-[.85rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmLesson}
                  className="font-nunito flex-[2] cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
                >
                  {isEditingPlan ? '保存修改' : '创建周计划'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── WEEK VIEW ────────────────────────────────────────────────────────────
  if (phase === 'week-view' && weeklyPlan) {
    const today = todayStr()
    return (
      <>
        <div className="mx-auto max-w-[1280px] px-4 py-5">
          <div className="mb-5 rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-7">
            {/* Header */}
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-fredoka bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-2xl text-transparent">
                  {(() => {
                    const units = weeklyPlan.unit.split(', ')
                    const lessons = weeklyPlan.lesson.split(', ')
                    const allSameUnit = units.every((u) => u === units[0])
                    return allSameUnit
                      ? `${units[0]} · ${lessons.join(', ')}`
                      : units.map((u, i) => `${u} · ${lessons[i] ?? ''}`).join(', ')
                  })()}
                </div>
                <div className="mt-1 text-[.75rem] font-bold text-[var(--wm-text-dim)]">
                  {fmtWeekRange(weeklyPlan.weekStart, weeklyPlan.weekStartDay)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPhase('plans-list')}
                  className="font-nunito cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-4 py-1.5 text-[.75rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
                >
                  ← 返回列表
                </button>
                <button
                  onClick={() => {
                    if (weeklyPlan) {
                      const units = weeklyPlan.unit.split(', ')
                      const lessons = weeklyPlan.lesson.split(', ')
                      setPendingLessons(
                        units.map((u, i) => ({ unit: u, lesson: lessons[i] ?? '' })),
                      )
                      setNewPerDay(weeklyPlan.newWordsPerDay)
                      setWeekStartDay(weeklyPlan.weekStartDay)
                      setPendingDate(weeklyPlan.weekStart)
                      setIsEditingPlan(true)
                    } else {
                      setPendingLessons([])
                      setPendingDate(todayStr())
                      setIsEditingPlan(false)
                    }
                    setShowParamsDialog(true)
                  }}
                  className="font-nunito cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-4 py-1.5 text-[.75rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
                >
                  换课
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

            {/* 7-day grid */}
            <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:overflow-visible sm:pb-0">
              {weeklyPlan.days.map((day, i) => {
                const isDone = weeklyPlan.progress[day.date]?.quizDone === true
                const isToday = day.date === today
                const isPast = day.date < today && !isDone
                const newCount = day.newWordKeys.length
                const { weekReview, oldReview } = getReviewWordsForDay(
                  vocab,
                  masteryMap,
                  weeklyPlan,
                  i,
                )
                const reviewCount = weekReview.length + oldReview.length
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
                      {isDone ? '✓ 完成' : isToday ? '今天' : `${newCount}+${reviewCount}`}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Selected day info + word lists + quiz type + start */}
            {selectedDate &&
              (() => {
                const dayIndex = weeklyPlan.days.findIndex((d) => d.date === selectedDate)
                const dayPlan = weeklyPlan.days[dayIndex]
                if (!dayPlan) return null
                const isDone = weeklyPlan.progress[selectedDate]?.quizDone === true
                const newWords = dayPlan.newWordKeys
                  .map((k) => vocab.find((w) => wordKey(w) === k))
                  .filter((w): w is WordEntry => !!w)
                const { weekReview, oldReview } = getReviewWordsForDay(
                  vocab,
                  masteryMap,
                  weeklyPlan,
                  dayIndex,
                )
                const inPlanOldReview = oldReview.filter((w) =>
                  planLessonSet.has(`${w.unit}::${w.lesson}`),
                )
                const outOfPlanOldReview = oldReview.filter(
                  (w) => !planLessonSet.has(`${w.unit}::${w.lesson}`),
                )
                const selectedOutCount = outOfPlanOldReview.filter((w) =>
                  selectedOldReviewKeys.has(wordKey(w)),
                ).length
                const total =
                  newWords.length + weekReview.length + inPlanOldReview.length + selectedOutCount
                return (
                  <div className="border-t border-[var(--wm-border)] pt-4">
                    {/* Summary row */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-[.72rem] font-extrabold text-[var(--wm-text-dim)]">
                        {fmtDate(selectedDate)} {cnDays[dayIndex]}
                      </span>
                      <span className="rounded-full border border-[rgba(249,115,22,.3)] bg-[rgba(249,115,22,.15)] px-2 py-0.5 text-[.65rem] font-bold text-[#fb923c]">
                        新词 {newWords.length}
                      </span>
                      {weekReview.length > 0 && (
                        <span className="rounded-full border border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.15)] px-2 py-0.5 text-[.65rem] font-bold text-[#93c5fd]">
                          本周复习 {weekReview.length}
                        </span>
                      )}
                      {oldReview.length > 0 && (
                        <span className="rounded-full border border-[rgba(167,139,250,.3)] bg-[rgba(167,139,250,.15)] px-2 py-0.5 text-[.65rem] font-bold text-[#c4b5fd]">
                          旧词 {inPlanOldReview.length + selectedOutCount}/{oldReview.length}
                        </span>
                      )}
                      <span className="text-[.68rem] text-[var(--wm-text-dim)]">共 {total} 词</span>
                      {isDone && weeklyPlan.progress[selectedDate]?.lastScore !== undefined && (
                        <span className="ml-auto text-[.72rem] font-bold text-[#4ade80]">
                          上次 {weeklyPlan.progress[selectedDate].lastScore}%
                        </span>
                      )}
                    </div>

                    {/* New words */}
                    {newWords.length > 0 && (
                      <div className="mb-3">
                        <div className="mb-1.5 text-[.6rem] font-extrabold tracking-widest text-[#fb923c] uppercase">
                          今日新词
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {newWords.map((w) => {
                            const level = getWordMasteryLevel(masteryMap[wordKey(w)]?.correct ?? 0)
                            return (
                              <span
                                key={wordKey(w)}
                                className="rounded-full border-[1.5px] border-[rgba(249,115,22,.4)] bg-[rgba(249,115,22,.08)] px-2.5 py-1 text-[0.875rem] font-bold text-[#fb923c]"
                              >
                                {level > 0 && (
                                  <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>
                                )}
                                {w.word}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Week review words */}
                    {weekReview.length > 0 && (
                      <div className="mb-3">
                        <div className="mb-1.5 text-[.6rem] font-extrabold tracking-widest text-[#93c5fd] uppercase">
                          本周复习
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {weekReview.map((w) => {
                            const level = getWordMasteryLevel(masteryMap[wordKey(w)]?.correct ?? 0)
                            return (
                              <span
                                key={wordKey(w)}
                                className="rounded-full border-[1.5px] border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)] px-2.5 py-1 text-[0.875rem] font-bold text-[#93c5fd]"
                              >
                                {level > 0 && (
                                  <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>
                                )}
                                {w.word}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Old review words */}
                    {oldReview.length > 0 && (
                      <div className="mb-4">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-[.6rem] font-extrabold tracking-widest text-[#c4b5fd] uppercase">
                            旧词复习
                          </span>
                          {outOfPlanOldReview.length > 0 && (
                            <span className="text-[.6rem] text-[var(--wm-text-dim)]">
                              · 课外词可自由选择
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {inPlanOldReview.map((w) => {
                            const level = getWordMasteryLevel(masteryMap[wordKey(w)]?.correct ?? 0)
                            return (
                              <span
                                key={wordKey(w)}
                                className="rounded-full border-[1.5px] border-[rgba(167,139,250,.35)] bg-[rgba(167,139,250,.08)] px-2.5 py-1 text-[0.875rem] font-bold text-[#c4b5fd]"
                              >
                                {level > 0 && (
                                  <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>
                                )}
                                {w.word}
                              </span>
                            )
                          })}
                          {outOfPlanOldReview.map((w) => {
                            const key = wordKey(w)
                            const on = selectedOldReviewKeys.has(key)
                            const level = getWordMasteryLevel(masteryMap[key]?.correct ?? 0)
                            return (
                              <button
                                key={key}
                                onClick={() =>
                                  setSelectedOldReviewKeys((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(key)) next.delete(key)
                                    else next.add(key)
                                    return next
                                  })
                                }
                                className={`cursor-pointer rounded-full border-[1.5px] px-2.5 py-1 text-[0.875rem] font-bold transition-all select-none ${
                                  on
                                    ? 'border-[rgba(167,139,250,.5)] bg-[rgba(167,139,250,.15)] text-[#c4b5fd]'
                                    : 'border-[var(--wm-border)] bg-transparent text-[var(--wm-text-dim)] opacity-50 hover:opacity-80'
                                }`}
                              >
                                {level > 0 && (
                                  <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>
                                )}
                                {w.word}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {total === 0 && (
                      <div className="mb-4 text-[1.125rem] text-[var(--wm-text-dim)]">
                        暂无单词，所有词已掌握！
                      </div>
                    )}

                    <div className="mb-2.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                      题型选择
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {(['A', 'B', 'C'] as const).map((t) => {
                        const labels = { A: '释义 → 选单词', B: '单词 → 选释义', C: '释义 → 默写' }
                        const on = enabledTypes.has(t)
                        return (
                          <button
                            key={t}
                            onClick={() =>
                              setEnabledTypes((prev) => {
                                const n = new Set(prev)
                                if (n.has(t)) {
                                  n.delete(t)
                                } else {
                                  n.add(t)
                                }
                                return n
                              })
                            }
                            className={`flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-3.5 py-2.5 text-[0.875rem] font-bold transition-all select-none ${
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

                    <button
                      onClick={() => startStudy(selectedDate)}
                      className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-6 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
                    >
                      {isDone ? '🔄 重新练习' : '🚀 开始练习'}
                    </button>
                  </div>
                )
              })()}

            {/* Auto-select today button */}
            {!selectedDate &&
              (() => {
                const todayInPlan = weeklyPlan.days.find((d) => d.date === today)
                if (!todayInPlan) return null
                return (
                  <button
                    onClick={() => startStudy(today)}
                    className="flex cursor-pointer items-center gap-1 rounded-full border border-[rgba(245,158,11,.3)] bg-[rgba(245,158,11,.12)] px-2.5 py-1 text-[.65rem] font-extrabold text-[#fbbf24] transition-all hover:bg-[rgba(245,158,11,.2)]"
                  >
                    ⚡ 开始今天的练习
                  </button>
                )
              })()}
          </div>
        </div>
        <MasteryStatusPanel vocab={vocab} masteryMap={masteryMap} />
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
          {/* Left */}
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
                  w.isReview
                    ? 'border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.2)] text-[#93c5fd]'
                    : 'border-[rgba(249,115,22,.3)] bg-[rgba(249,115,22,.2)] text-[#fb923c]'
                }`}
              >
                {w.isReview ? '复习' : '新词'}
              </span>
              <span className="rounded-full border border-[rgba(233,69,96,.3)] bg-[rgba(233,69,96,.2)] px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider text-[var(--wm-accent)] uppercase">
                {w.entry.unit}
              </span>
            </div>
            <div className="font-nunito relative z-[1] text-center text-[clamp(2rem,5vw,3.5rem)] leading-tight font-black break-words">
              <PhonicsWord text={w.entry.word} />
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

          {/* Right */}
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
                dangerouslySetInnerHTML={{ __html: hilite(w.entry.explanation, w.entry.word) }}
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
    const options = quizOptions

    return (
      <div className="mx-auto max-w-[1280px] px-4 py-5">
        <div className="mb-2 flex items-center gap-3 py-3">
          <button
            onClick={() => {
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
          options={options}
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
              weeklyPlan &&
              ` · ${fmtDate(selectedDate)} ${cnDays[weeklyPlan.days.findIndex((d) => d.date === selectedDate)]}`}
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
        <MasteryStatusPanel vocab={vocab} masteryMap={masteryMap} />
      </>
    )
  }

  return null
}
