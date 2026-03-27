'use client'

import {useState, useMemo, useCallback, useRef, useEffect} from 'react'
import type {WordEntry, WeeklyPlan} from '@/utils/type'
import {
  buildWeeklyPlan,
  buildQuizOptions,
  getReviewWordsForDay,
  getOrderedLessons,
  hilite,
  highlightExample,
  wordKey,
} from '@/utils/english-helpers'
import {getMasteryLevel, MASTERY_ICON} from '@/utils/masteryUtils'
import PhonicsWord from './PhonicsWord'
import QuizCard from './QuizCard'
import MasteryStatusPanel from './MasteryStatusPanel'
import {useAuth} from '@/contexts/AuthContext'
import {useWordMastery} from '@/hooks/useWordMastery'
import {useWeeklyPlan} from '@/hooks/useWeeklyPlan'
import {todayStr} from '@/utils/constant'

interface WeeklyPracticeProps {
  vocab: WordEntry[]
}

type Phase = 'setup' | 'week-view' | 'study' | 'quiz' | 'done'

interface DpQuizQ {
  word: WordEntry;
  type: 'A' | 'B' | 'C';
  isReview: boolean
}

const ALL_CN_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const ALL_DAY_OPTIONS = [
  {value: 1, label: '周一'},
  {value: 2, label: '周二'},
  {value: 3, label: '周三'},
  {value: 4, label: '周四'},
  {value: 5, label: '周五'},
  {value: 6, label: '周六'},
  {value: 0, label: '周日'},
]

function getWeekDayLabels(startDay: number): string[] {
  return Array.from({length: 7}, (_, i) => ALL_CN_DAYS[(startDay + i) % 7])
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

export default function WeeklyPractice({vocab}: WeeklyPracticeProps) {
  const {user} = useAuth()
  const {masteryMap, recordBatch} = useWordMastery(user)
  const {weeklyPlan, currentWeekStart, defaultParams, savePlan, updateDayProgress, isLoading} = useWeeklyPlan(user)

  const [isImmersive, setIsImmersive] = useState(false);

  useEffect(() => {
    const check = () => setIsImmersive(document.body.classList.contains('words-immersive'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.body, {attributes: true, attributeFilter: ['class']})
    return () => obs.disconnect()
  }, []);

  const exitImmersive = useCallback(() => {
    window.dispatchEvent(new Event('exit-words-immersive'))
  }, [])

  const [phase, setPhase] = useState<Phase>('setup')
  const [showParamsDialog, setShowParamsDialog] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showLessonPicker, setShowLessonPicker] = useState(false)
  const [pendingLessons, setPendingLessons] = useState<{ unit: string; lesson: string }[]>([])
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set(['A', 'B', 'C']))
  const [newPerDay, setNewPerDay] = useState<number>(3)
  const [weekStartDay, setWeekStartDay] = useState<number>(4)

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

  // Sync local state from defaultParams once loaded
  useEffect(() => {
    if (defaultParams) {
      setNewPerDay(defaultParams.newWordsPerDay)
      setWeekStartDay(defaultParams.weekStartDay)
    }
  }, [defaultParams])

  // Auto-open dialog when no plan exists and params are loaded
  useEffect(() => {
    if (!isLoading && !weeklyPlan && defaultParams) setShowParamsDialog(true)
  }, [isLoading, weeklyPlan, defaultParams])

  const suggestedLesson = useMemo(() => {
    return orderedLessons[0] ?? null
  }, [orderedLessons])

  const activeLessons = useMemo(() => {
    return pendingLessons.length > 0 ? pendingLessons : (suggestedLesson ? [suggestedLesson] : [])
  }, [pendingLessons, suggestedLesson])
  const activeLesson = activeLessons[0] ?? null

  // Words for the active lessons (for setup)
  const lessonWords = useMemo(() => {
    if (!activeLessons.length) return []
    return vocab.filter(w => activeLessons.some(l => l.unit === w.unit && l.lesson === w.lesson))
  }, [vocab, activeLessons])

  // Transition: if plan loaded and phase is still 'setup', jump to week-view
  // unless showParamsDialog is explicitly true (e.g. user clicked 换课)
  const effectivePhase = useMemo(() => {
    if (!showParamsDialog && phase === 'setup' && weeklyPlan && !isLoading) return 'week-view'
    return phase
  }, [phase, weeklyPlan, isLoading, showParamsDialog])

  const handleConfirmLesson = useCallback(async () => {
    if (!activeLesson || !currentWeekStart) return
    const plan: WeeklyPlan = {
      weekStart: currentWeekStart,
      unit: activeLessons.map(l => l.unit).join(', '),
      lesson: activeLessons.map(l => l.lesson).join(', '),
      weekStartDay,
      newWordsPerDay: newPerDay,
      days: buildWeeklyPlan(lessonWords, currentWeekStart, newPerDay),
      progress: {},
    }
    await savePlan(plan)
    setShowParamsDialog(false)
    setPhase('week-view')
  }, [activeLesson, activeLessons, currentWeekStart, lessonWords, newPerDay, weekStartDay, savePlan])

  // Build session words for a given day
  const buildSessionWords = useCallback((dateStr: string) => {
    if (!weeklyPlan) return []
    const dayIndex = weeklyPlan.days.findIndex(d => d.date === dateStr)
    if (dayIndex === -1) return []
    const dayPlan = weeklyPlan.days[dayIndex]
    const newWords = dayPlan.newWordKeys
      .map(k => vocab.find(w => wordKey(w) === k))
      .filter((w): w is WordEntry => !!w)
    const {weekReview, oldReview} = getReviewWordsForDay(vocab, masteryMap, weeklyPlan, dayIndex)
    return [
      ...newWords.map(e => ({entry: e, isReview: false})),
      ...weekReview.map(e => ({entry: e, isReview: true})),
      ...oldReview.map(e => ({entry: e, isReview: true})),
    ]
  }, [weeklyPlan, vocab, masteryMap])

  const startStudy = useCallback((dateStr: string) => {
    if (!enabledTypes.size) {
      alert('请至少选择一种题型！');
      return
    }
    const session = buildSessionWords(dateStr)
    setWords(session)
    setStudyIdx(0)
    setStudyWordVisible(false)
    setStudyDefOnly(false)
    setSelectedDate(dateStr)
    setPhase('study')
  }, [enabledTypes, buildSessionWords])

  const startQuiz = useCallback(() => {
    const types = [...enabledTypes] as ('A' | 'B' | 'C')[]
    const qs: DpQuizQ[] = []
    words.forEach(w => types.forEach(t => qs.push({word: w.entry, type: t, isReview: w.isReview})))
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qs[i], qs[j]] = [qs[j], qs[i]]
    }
    quizResultBuffer.current = []
    setQuizQs(qs)
    setCurQ(0)
    setScore(0)
    setPhase('quiz')
  }, [words, enabledTypes])

  const handleAnswer = useCallback((correct: boolean) => {
    if (correct) setScore(s => s + 1)
    if (quizQs[curQ]) quizResultBuffer.current.push({entry: quizQs[curQ].word, correct})
  }, [quizQs, curQ])

  const nextQ = useCallback(() => {
    const next = curQ + 1
    if (next >= quizQs.length) {
      const finalScore = quizResultBuffer.current.filter(r => r.correct).length
      const pct = Math.round(finalScore / quizQs.length * 100)
      if (selectedDate) {
        void updateDayProgress(selectedDate, {quizDone: true, lastScore: pct, completedAt: todayStr()})
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

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-[var(--wm-text-dim)] text-sm">加载中…</div>
  }

  // ── PARAMS DIALOG ────────────────────────────────────────────────────────
  if (showParamsDialog) {
    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)'}}
      >
        <div className="max-w-[560px] mx-auto px-4 py-10">
          <div className="bg-[var(--wm-surface)] border border-[var(--wm-border)] rounded-[20px] p-7">
            <div
              className="font-fredoka text-2xl bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-transparent mb-1">
              本周计划
            </div>
            <div className="text-[.75rem] text-[var(--wm-text-dim)] font-bold mb-5">
              {currentWeekStart && fmtWeekRange(currentWeekStart, weekStartDay)}
            </div>

            {activeLesson ? (
              <>
                <div className="bg-[var(--wm-surface2)] border border-[var(--wm-border)] rounded-xl px-5 py-4 mb-4">
                  <div
                    className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-widest mb-1.5">建议学习
                  </div>
                  <div className="font-bold text-[1.1rem] text-[var(--wm-text)]">
                    {activeLessons.every(l => l.unit === activeLessons[0].unit)
                      ? `${activeLessons[0].unit} · ${activeLessons.map(l => l.lesson).join(', ')}`
                      : activeLessons.map(l => `${l.unit} · ${l.lesson}`).join(', ')
                    }
                  </div>

                  <div className="text-[.72rem] text-[var(--wm-text-dim)] mt-0.5">
                    共 {lessonWords.length} 个单词 · 每天 {newPerDay} 个新词
                  </div>
                </div>

                <div className="mb-4">
                  <button
                    onClick={() => {
                      if (!showLessonPicker && pendingLessons.length === 0 && suggestedLesson) {
                        setPendingLessons([suggestedLesson])
                      }
                      setShowLessonPicker(v => !v)
                    }}
                    className="px-4 py-1.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-full text-[var(--wm-text-dim)] font-nunito font-bold text-[.78rem] cursor-pointer hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)] transition-all"
                  >
                    选择课程{pendingLessons.length > 0 ? ` (${pendingLessons.length})` : ''} {showLessonPicker ? '▴' : '▾'}
                  </button>
                </div>

                {showLessonPicker && (
                  <div
                    className="border border-[var(--wm-border)] rounded-xl overflow-hidden max-h-[240px] overflow-y-auto">
                    {orderedLessons.map(l => {
                      const isActive = activeLessons.some(al => al.unit === l.unit && al.lesson === l.lesson)
                      return (
                        <button
                          key={`${l.unit}::${l.lesson}`}
                          onClick={() => {
                            setPendingLessons(prev => {
                              const exists = prev.some(p => p.unit === l.unit && p.lesson === l.lesson)
                              if (exists) return prev.filter(p => !(p.unit === l.unit && p.lesson === l.lesson))
                              return [...prev, l]
                            })
                          }}
                          className={`w-full text-left px-4 py-2.5 text-[.82rem] font-bold border-b border-[var(--wm-border)] last:border-0 transition-all cursor-pointer flex items-center gap-2.5 ${
                            isActive
                              ? 'bg-[rgba(245,158,11,.12)] text-[#fbbf24]'
                              : 'bg-[var(--wm-surface2)] text-[var(--wm-text)] hover:bg-[var(--wm-surface)]'
                          }`}
                        >
                          <span
                            className={`inline-flex items-center justify-center w-[16px] h-[16px] rounded-[4px] border shrink-0 text-[.6rem] font-black transition-all ${
                              isActive ? 'border-[#f59e0b] bg-[rgba(245,158,11,.3)] text-[#fbbf24]' : 'border-[var(--wm-border)] bg-transparent'
                            }`}>
                            {isActive && '✓'}
                          </span>
                          {l.unit} · {l.lesson}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* New words per day selector */}
                <div className="mt-5 pt-4 border-t border-[var(--wm-border)]">
                  <div
                    className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-widest mb-2.5">每天新词数量
                  </div>
                  <div className="flex gap-1.5 mb-5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <button
                        key={n}
                        onClick={() => setNewPerDay(n)}
                        className={`w-9 h-9 rounded-full border-[1.5px] text-[.82rem] font-extrabold cursor-pointer transition-all ${
                          newPerDay === n
                            ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
                            : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div
                    className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-widest mb-2.5">每周开始于
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_DAY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setWeekStartDay(opt.value)}
                        className={`px-3 py-1.5 rounded-full border-[1.5px] text-[.78rem] font-bold cursor-pointer transition-all ${
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
              <div className="text-[var(--wm-text-dim)] text-sm">没有找到课程数据，请先导入单词。</div>
            )}
            {activeLesson && (
              <div className="flex gap-2.5 mt-6 pt-5 border-t border-[var(--wm-border)]">
                {weeklyPlan && (
                  <button
                    onClick={() => setShowParamsDialog(false)}
                    className="flex-1 py-2.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-[10px] text-[var(--wm-text-dim)] font-nunito font-bold text-[.85rem] cursor-pointer hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)] transition-all"
                  >
                    取消
                  </button>
                )}
                <button
                  onClick={handleConfirmLesson}
                  className="flex-[2] py-2.5 bg-gradient-to-br from-[#d97706] to-[#f59e0b] border-0 rounded-[10px] text-white font-nunito font-extrabold text-[.88rem] cursor-pointer shadow-[0_3px_12px_rgba(245,158,11,.35)] hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)] transition-all"
                >
                  开始 {activeLessons.length > 1 ? `${activeLessons.length} 课 · ${lessonWords.length} 词` : activeLesson.lesson}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── WEEK VIEW ────────────────────────────────────────────────────────────
  if (effectivePhase === 'week-view' && weeklyPlan) {
    const today = todayStr()
    return (
      <>
        <div className="max-w-[1280px] mx-auto px-4 py-5">
          <div className="bg-[var(--wm-surface)] border border-[var(--wm-border)] rounded-[20px] p-7 mb-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <div
                  className="font-fredoka text-2xl bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-transparent">
                  {(() => {
                    const units = weeklyPlan.unit.split(', ')
                    const lessons = weeklyPlan.lesson.split(', ')
                    const allSameUnit = units.every(u => u === units[0])
                    return allSameUnit
                      ? `${units[0]} · ${lessons.join(', ')}`
                      : units.map((u, i) => `${u} · ${lessons[i] ?? ''}`).join(', ')
                  })()}
                </div>
                <div className="text-[.75rem] text-[var(--wm-text-dim)] font-bold mt-1">
                  {fmtWeekRange(weeklyPlan.weekStart, weeklyPlan.weekStartDay)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPendingLessons([]);
                    setShowParamsDialog(true)
                  }}
                  className="px-4 py-1.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-full text-[var(--wm-text-dim)] font-nunito text-[.75rem] font-bold cursor-pointer hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)] transition-all"
                >
                  换课
                </button>
                {isImmersive && (
                  <button
                    onClick={exitImmersive}
                    className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/55 text-[.72rem] font-bold hover:bg-white/20 hover:text-white/80 transition-all cursor-pointer"
                  >
                    ✕ 退出沉浸
                  </button>
                )}
              </div>
            </div>

            {/* 7-day grid */}
            <div
              className="flex gap-2 mb-5 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:overflow-visible sm:pb-0 scrollbar-none">
              {weeklyPlan.days.map((day, i) => {
                const isDone = weeklyPlan.progress[day.date]?.quizDone === true
                const isToday = day.date === today
                const isPast = day.date < today && !isDone
                const newCount = day.newWordKeys.length
                const {weekReview, oldReview} = getReviewWordsForDay(vocab, masteryMap, weeklyPlan, i)
                const reviewCount = weekReview.length + oldReview.length
                const isSelected = selectedDate === day.date

                let borderColor = 'rgba(255,255,255,.07)'
                let textColor = 'rgba(255,255,255,.35)'
                let bgColor = 'rgba(255,255,255,.03)'
                if (isDone) {
                  borderColor = '#4ade80';
                  textColor = '#4ade80';
                  bgColor = 'rgba(74,222,128,.08)'
                } else if (isToday) {
                  borderColor = '#f59e0b';
                  textColor = '#fbbf24';
                  bgColor = 'rgba(245,158,11,.1)'
                } else if (isPast) {
                  borderColor = 'rgba(248,113,113,.3)';
                  textColor = 'rgba(248,113,113,.6)'
                }
                if (isSelected) {
                  bgColor = isDone ? 'rgba(74,222,128,.2)' : isToday ? 'rgba(245,158,11,.2)' : 'rgba(255,255,255,.08)'
                }

                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(isSelected ? null : day.date)}
                    className="flex flex-col items-center gap-1 py-3 px-2 rounded-[12px] border-[1.5px] cursor-pointer transition-all select-none shrink-0 min-w-[3.6rem] sm:min-w-0 sm:px-1"
                    style={{
                      borderColor,
                      background: bgColor,
                      color: textColor,
                      transform: isSelected ? 'translateY(-2px)' : undefined
                    }}
                  >
                    <div className="text-[.6rem] font-extrabold opacity-70">{cnDays[i]}</div>
                    <div className="font-fredoka text-[1.05rem] leading-none">{fmtDate(day.date)}</div>
                    <div className="text-[.58rem] font-bold opacity-60 text-center leading-tight">
                      {isDone ? '✓ 完成' : isToday ? '今天' : `${newCount}+${reviewCount}`}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Selected day info + word lists + quiz type + start */}
            {selectedDate && (() => {
              const dayIndex = weeklyPlan.days.findIndex(d => d.date === selectedDate)
              const dayPlan = weeklyPlan.days[dayIndex]!
              const isDone = weeklyPlan.progress[selectedDate]?.quizDone === true
              const newWords = dayPlan.newWordKeys
                .map(k => vocab.find(w => wordKey(w) === k))
                .filter((w): w is WordEntry => !!w)
              const {weekReview, oldReview} = getReviewWordsForDay(vocab, masteryMap, weeklyPlan, dayIndex)
              const total = newWords.length + weekReview.length + oldReview.length
              return (
                <div className="border-t border-[var(--wm-border)] pt-4">
                  {/* Summary row */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-[.72rem] font-extrabold text-[var(--wm-text-dim)]">
                    {fmtDate(selectedDate)} {cnDays[dayIndex]}
                  </span>
                    <span
                      className="bg-[rgba(249,115,22,.15)] text-[#fb923c] border border-[rgba(249,115,22,.3)] px-2 py-0.5 rounded-full text-[.65rem] font-bold">新词 {newWords.length}</span>
                    {weekReview.length > 0 && <span
                      className="bg-[rgba(96,165,250,.15)] text-[#93c5fd] border border-[rgba(96,165,250,.3)] px-2 py-0.5 rounded-full text-[.65rem] font-bold">本周复习 {weekReview.length}</span>}
                    {oldReview.length > 0 && <span
                      className="bg-[rgba(167,139,250,.15)] text-[#c4b5fd] border border-[rgba(167,139,250,.3)] px-2 py-0.5 rounded-full text-[.65rem] font-bold">旧词 {oldReview.length}</span>}
                    <span className="text-[.68rem] text-[var(--wm-text-dim)]">共 {total} 词</span>
                    {isDone && weeklyPlan.progress[selectedDate]?.lastScore !== undefined && (
                      <span
                        className="ml-auto text-[.72rem] font-bold text-[#4ade80]">上次 {weeklyPlan.progress[selectedDate].lastScore}%</span>
                    )}
                  </div>

                  {/* New words */}
                  {newWords.length > 0 && (
                    <div className="mb-3">
                      <div
                        className="text-[.6rem] font-extrabold text-[#fb923c] uppercase tracking-widest mb-1.5">今日新词
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {newWords.map(w => {
                          const level = getMasteryLevel(masteryMap[wordKey(w)]?.correct ?? 0)
                          return (
                            <span key={wordKey(w)}
                                  className="px-2.5 py-1 rounded-full border-[1.5px] border-[rgba(249,115,22,.4)] bg-[rgba(249,115,22,.08)] text-[#fb923c] text-[.78rem] font-bold">
                            {level > 0 && <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>}{w.word}
                          </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Week review words */}
                  {weekReview.length > 0 && (
                    <div className="mb-3">
                      <div
                        className="text-[.6rem] font-extrabold text-[#93c5fd] uppercase tracking-widest mb-1.5">本周复习
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {weekReview.map(w => {
                          const level = getMasteryLevel(masteryMap[wordKey(w)]?.correct ?? 0)
                          return (
                            <span key={wordKey(w)}
                                  className="px-2.5 py-1 rounded-full border-[1.5px] border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)] text-[#93c5fd] text-[.78rem] font-bold">
                            {level > 0 && <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>}{w.word}
                          </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Old review words */}
                  {oldReview.length > 0 && (
                    <div className="mb-4">
                      <div
                        className="text-[.6rem] font-extrabold text-[#c4b5fd] uppercase tracking-widest mb-1.5">旧词复习
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {oldReview.map(w => {
                          const level = getMasteryLevel(masteryMap[wordKey(w)]?.correct ?? 0)
                          return (
                            <span key={wordKey(w)}
                                  className="px-2.5 py-1 rounded-full border-[1.5px] border-[rgba(167,139,250,.35)] bg-[rgba(167,139,250,.08)] text-[#c4b5fd] text-[.78rem] font-bold">
                            {level > 0 && <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>}{w.word}
                          </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {total === 0 && (
                    <div className="text-[.8rem] text-[var(--wm-text-dim)] mb-4">暂无单词，所有词已掌握！</div>
                  )}

                  <div
                    className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-widest mb-2.5">题型选择
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(['A', 'B', 'C'] as const).map(t => {
                      const labels = {A: '释义 → 选单词', B: '单词 → 选释义', C: '释义 → 默写'}
                      const on = enabledTypes.has(t)
                      return (
                        <button
                          key={t}
                          onClick={() => setEnabledTypes(prev => {
                            const n = new Set(prev);
                            n.has(t) ? n.delete(t) : n.add(t);
                            return n
                          })}
                          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] border-[1.5px] cursor-pointer text-[.82rem] font-bold transition-all select-none ${
                            on ? 'border-[rgba(167,139,250,.5)] bg-[rgba(167,139,250,.1)] text-[#c4b5fd]' : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
                          }`}
                        >
                        <span
                          className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-[5px] text-[.6rem] font-black ${
                            t === 'A' ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]' : t === 'B' ? 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]' : 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                          }`}>{t}</span>
                          {labels[t]}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => startStudy(selectedDate)}
                    className="px-6 py-2.5 bg-gradient-to-br from-[#d97706] to-[#f59e0b] border-0 rounded-[10px] text-white font-nunito font-extrabold text-[.88rem] cursor-pointer shadow-[0_3px_12px_rgba(245,158,11,.35)] hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)] transition-all"
                  >
                    {isDone ? '🔄 重新练习' : '🚀 开始练习'}
                  </button>
                </div>
              )
            })()}

            {/* Auto-select today button */}
            {!selectedDate && (() => {
              const todayInPlan = weeklyPlan.days.find(d => d.date === today)
              if (!todayInPlan) return null
              return (
                <button
                  onClick={() => setSelectedDate(today)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[.65rem] font-extrabold bg-[rgba(245,158,11,.12)] border border-[rgba(245,158,11,.3)] text-[#fbbf24] cursor-pointer hover:bg-[rgba(245,158,11,.2)] transition-all"
                >
                  ⚡ 开始今天的练习
                </button>
              )
            })()}
          </div>
        </div>
        <MasteryStatusPanel vocab={vocab} masteryMap={masteryMap}/>
      </>
    )
  }

  // ── STUDY ────────────────────────────────────────────────────────────────
  if (effectivePhase === 'study' && words[studyIdx]) {
    const w = words[studyIdx]
    const total = words.length
    return (
      <div
        className="max-w-[1280px] mx-auto px-4 max-sm:px-3 flex flex-col overflow-hidden"
        style={{height: isImmersive ? '100dvh' : 'calc(100dvh - 56px)'}}
      >
        <div className="flex items-center gap-2 flex-wrap mb-0 py-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button onClick={() => setPhase('week-view')}
                    className="px-3 py-1.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-full text-[var(--wm-text-dim)] font-nunito text-[.75rem] font-bold cursor-pointer transition-all shrink-0 hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]">
              ← 返回
            </button>
            <div className="font-fredoka text-[1rem] text-[var(--wm-text)] truncate">📖 记忆单词</div>
          </div>
          <div
            className="text-[.72rem] font-bold text-[var(--wm-text-dim)] bg-[var(--wm-surface)] border border-[var(--wm-border)] px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
            {studyIdx + 1} / {total}
          </div>
          <button
            onClick={() => {
              setStudyDefOnly(!studyDefOnly);
              setStudyWordVisible(false)
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[1.5px] cursor-pointer text-[.72rem] font-extrabold transition-all select-none whitespace-nowrap shrink-0 ${
              studyDefOnly ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]' : 'border-white/10 bg-white/5 text-white/50'
            }`}
          >
            <span>✨</span> 仅看释义
            <div
              className={`w-7 h-3.5 rounded-[7px] relative transition-colors ${studyDefOnly ? 'bg-[rgba(245,158,11,.5)]' : 'bg-white/10'}`}>
              <div
                className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-all ${studyDefOnly ? 'translate-x-3.5 bg-[#f59e0b]' : 'bg-white/40'}`}/>
            </div>
          </button>
          {isImmersive && (
            <button
              onClick={exitImmersive}
              className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/55 text-[.72rem] font-bold hover:bg-white/20 hover:text-white/80 transition-all cursor-pointer shrink-0"
            >
              ✕ 退出沉浸
            </button>
          )}
        </div>
        <div className="h-[3px] bg-white/[.04] rounded-sm mb-2 shrink-0">
          <div
            className="h-full bg-gradient-to-r from-[#d97706] via-[#f59e0b] to-[#fbbf24] rounded-sm transition-[width] duration-400"
            style={{width: `${((studyIdx + 1) / total) * 100}%`}}/>
        </div>

        <div
          className="flex max-sm:flex-col relative rounded-[16px] overflow-hidden border border-[var(--wm-border)] flex-1 min-h-0">
          {/* Left */}
          <div
            className={`flex flex-col items-center justify-center px-7 max-sm:px-5 py-6 gap-3 relative overflow-hidden transition-all duration-400 ${
              studyDefOnly && !studyWordVisible ? 'w-0 max-sm:w-full max-sm:h-0 opacity-0 overflow-hidden p-0' : 'w-1/2 max-sm:w-full max-sm:h-[45%] opacity-100'
            }`} style={{background: 'linear-gradient(135deg, #1a1a30 0%, #12122a 100%)'}}>
            <div
              className="absolute right-[-10px] top-1/2 -translate-y-1/2 font-fredoka text-[min(35vw,240px)] text-white/[.022] leading-none pointer-events-none select-none">
              {w.entry.word.charAt(0).toUpperCase()}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-center relative z-[1]">
              <span className={`px-2 py-0.5 rounded-full text-[.6rem] font-extrabold uppercase tracking-wider border ${
                w.isReview ? 'bg-[rgba(96,165,250,.2)] text-[#93c5fd] border-[rgba(96,165,250,.3)]' : 'bg-[rgba(249,115,22,.2)] text-[#fb923c] border-[rgba(249,115,22,.3)]'
              }`}>{w.isReview ? '复习' : '新词'}</span>
              <span
                className="px-2 py-0.5 rounded-full text-[.6rem] font-extrabold uppercase tracking-wider bg-[rgba(233,69,96,.2)] text-[var(--wm-accent)] border border-[rgba(233,69,96,.3)]">{w.entry.unit}</span>
            </div>
            <div
              className="font-nunito text-[clamp(2rem,5vw,3.5rem)] font-black text-center break-words leading-tight relative z-[1]">
              <PhonicsWord text={w.entry.word}/>
            </div>
            {w.entry.ipa && <div
              className="text-[clamp(.85rem,1.8vw,1rem)] text-[var(--wm-accent2)] italic font-semibold opacity-85 relative z-[1]">{w.entry.ipa}</div>}
            {w.entry.example && (
              <div className="border-t border-white/[.07] pt-3 w-full text-center relative z-[1]">
                <div className="text-[.55rem] font-extrabold uppercase tracking-widest text-white/30 mb-1.5">例句</div>
                <div
                  className="text-[.82rem] text-[rgba(200,200,255,.5)] italic leading-loose [&_strong]:text-[#4ade80] [&_strong]:not-italic [&_strong]:font-extrabold"
                  dangerouslySetInnerHTML={{__html: highlightExample(w.entry.example, w.entry.word)}}
                />
              </div>
            )}
          </div>

          {/* Right */}
          <div
            onClick={() => {
              if (studyDefOnly) setStudyWordVisible(!studyWordVisible)
            }}
            className={`flex flex-col items-center justify-center px-7 max-sm:px-5 py-6 relative transition-all duration-400 max-sm:w-full ${
              studyDefOnly && !studyWordVisible ? 'w-full max-sm:flex-1 cursor-pointer' : studyDefOnly ? 'w-1/2 max-sm:flex-1 cursor-pointer' : 'w-1/2 max-sm:flex-1 cursor-default'
            }`}
            style={{background: 'linear-gradient(135deg, #0e2a50 0%, #1a1a2e 100%)'}}
          >
            <div className="flex flex-col gap-2 items-start w-full max-w-[420px]">
              <div className="text-[.6rem] font-extrabold uppercase tracking-widest text-[rgba(96,165,250,.6)]">释义
              </div>
              <div className="text-[clamp(1rem,2.5vw,1.45rem)] font-bold leading-loose text-[#f0f0ff]"
                   dangerouslySetInnerHTML={{__html: hilite(w.entry.explanation, w.entry.word)}}
              />
            </div>
            {studyDefOnly && (
              <div className="absolute bottom-4 right-5 text-[.65rem] text-white/25 font-bold flex items-center gap-1">
                {studyWordVisible ? '点击隐藏单词' : '点击查看单词'}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3.5 py-2 shrink-0">
          <button
            onClick={() => {
              if (studyIdx > 0) {
                setStudyIdx(studyIdx - 1);
                setStudyWordVisible(false)
              }
            }}
            disabled={studyIdx === 0}
            className="px-6 py-2.5 rounded-full border-[1.5px] border-white/10 bg-transparent text-white/40 font-nunito font-bold text-[.82rem] cursor-pointer transition-all hover:border-[#60a5fa] hover:text-[#93c5fd] disabled:opacity-20 disabled:cursor-default"
          >
            ← 上一个
          </button>
          <div className="text-[.78rem] font-bold text-white/30 min-w-[60px] text-center">{studyIdx + 1} / {total}</div>
          <button
            onClick={() => {
              if (studyIdx < total - 1) {
                setStudyIdx(studyIdx + 1);
                setStudyWordVisible(false)
              } else startQuiz()
            }}
            className="px-7 py-2.5 rounded-full border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] text-white font-nunito font-extrabold text-[.82rem] cursor-pointer shadow-[0_3px_12px_rgba(217,119,6,.4)] hover:-translate-y-px"
          >
            {studyIdx === total - 1 ? '✅ 开始测试 →' : '下一个 →'}
          </button>
        </div>
      </div>
    )
  }

  // ── QUIZ ─────────────────────────────────────────────────────────────────
  if (effectivePhase === 'quiz' && quizQs[curQ]) {
    const q = quizQs[curQ]
    const options = quizOptions

    return (
      <div className="max-w-[1280px] mx-auto px-4 py-5">
        <div className="flex items-center gap-3 py-3 mb-2">
          <button
            onClick={() => {
              setStudyIdx(0);
              setStudyWordVisible(false);
              setPhase('study')
            }}
            className="px-3.5 py-1.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-full text-[var(--wm-text-dim)] font-nunito text-[.78rem] font-bold cursor-pointer shrink-0 hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)] transition-all"
          >
            ← 回到记忆
          </button>
          <div className="font-fredoka text-[1.1rem] text-[var(--wm-text)]">✏️ 单词测试</div>
        </div>
        <QuizCard
          question={{word: q.word, type: q.type}}
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
  if (effectivePhase === 'done') {
    const total = quizQs.length
    const pct = total ? Math.round(score / total * 100) : 0
    const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '💪'
    const msg = pct >= 90 ? '完美！' : pct >= 70 ? '太棒了！' : pct >= 50 ? '不错哦！' : '继续加油！'
    const masteredCount = words.filter(w => getMasteryLevel((masteryMap[`${w.entry.unit}::${w.entry.lesson}::${w.entry.word}`]?.correct ?? 0)) === 3).length

    return (
      <>
        <div className="max-w-[500px] mx-auto py-10 px-5 text-center">
          <div className="text-[3.5rem] mb-3.5">{emoji}</div>
          <div
            className="font-fredoka text-[3rem] bg-gradient-to-br from-[#d97706] to-[#f59e0b] bg-clip-text text-transparent mb-1.5">
            {score} / {total}
          </div>
          <div className="text-[var(--wm-text-dim)] text-[.9rem] font-bold mb-2.5">{msg}</div>
          <div className="text-[.78rem] text-[var(--wm-text-dim)] leading-loose mb-2">
            正确率 {pct}% · {words.length} 个单词
            {selectedDate && weeklyPlan && ` · ${fmtDate(selectedDate)} ${cnDays[weeklyPlan.days.findIndex(d => d.date === selectedDate)]}`}
          </div>
          <div className="text-[.82rem] font-bold text-[#4ade80] mb-5">
            本次练习：{masteredCount}/{words.length} 个单词已掌握 🦋
          </div>
          <div className="flex gap-2.5 justify-center flex-wrap">
            <button onClick={() => startQuiz()}
                    className="px-6 py-2.5 bg-gradient-to-br from-[#d97706] to-[#f59e0b] border-0 rounded-[10px] text-white font-nunito font-extrabold text-[.88rem] cursor-pointer shadow-[0_3px_12px_rgba(245,158,11,.35)]">
              🔄 重新测试
            </button>
            <button onClick={() => setPhase('week-view')}
                    className="px-5 py-2.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-[10px] text-[var(--wm-text-dim)] font-nunito font-bold text-[.82rem] cursor-pointer">
              返回本周
            </button>
          </div>
        </div>
        <MasteryStatusPanel vocab={vocab} masteryMap={masteryMap}/>
      </>
    )
  }

  return null
}
