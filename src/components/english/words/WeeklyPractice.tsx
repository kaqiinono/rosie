'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { WordEntry, WeeklyPlan, WeeklyPlanDay } from '@/utils/type'
import { buildWeeklyPlan, getOrderedLessons, getWeekStart, fmtDate, fmtWeekRange, wordKey, getOldReviewWords } from '@/utils/english-helpers'
import MasteryStatusPanel from './MasteryStatusPanel'
import OldReviewSession from './OldReviewSession'
import { useAuth } from '@/contexts/AuthContext'
import { useWordsContext } from '@/contexts/WordsContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { todayStr } from '@/utils/constant'

interface WeeklyPracticeProps {
  vocab: WordEntry[]
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const dow = d.getDay()
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return labels[dow]
}

function fmtShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

const ALL_DAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' },
]

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

// Small number picker used for per-lesson quota
function QuotaPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`h-7 w-7 cursor-pointer rounded-full border-[1.5px] text-[.8rem] font-extrabold transition-all ${
            value === n
              ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
              : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export default function WeeklyPractice({ vocab }: WeeklyPracticeProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { masteryMap } = useWordsContext()
  const { allPlans, deletePlan, defaultParams, savePlan, isLoading } = useWeeklyPlan(user)

  // step: 'list' | 'params' | 'arrange'
  const [step, setStep] = useState<'list' | 'params' | 'arrange'>('list')
  const [isEditingPlan, setIsEditingPlan] = useState(false)
  const [showLessonPicker, setShowLessonPicker] = useState(false)
  const [pendingLessons, setPendingLessons] = useState<{ unit: string; lesson: string }[]>([])
  // per-lesson daily quota: key = "unit::lesson"
  const [lessonQuotas, setLessonQuotas] = useState<Record<string, number>>({})
  const [weekStartDay, setWeekStartDay] = useState<number>(4)
  const [pendingDate, setPendingDate] = useState<string>(todayStr())
  const [syncedDefaultParams, setSyncedDefaultParams] = useState(defaultParams)
  if (syncedDefaultParams !== defaultParams) {
    setSyncedDefaultParams(defaultParams)
    if (defaultParams) {
      setWeekStartDay(defaultParams.weekStartDay)
    }
  }

  // old-review session
  const [showOldReview, setShowOldReview] = useState(false)

  // arrange-step state
  const [draftDays, setDraftDays] = useState<WeeklyPlanDay[]>([])
  const [unassignedKeys, setUnassignedKeys] = useState<string[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const orderedLessons = useMemo(() => getOrderedLessons(vocab), [vocab])
  const suggestedLesson = useMemo(() => orderedLessons[0] ?? null, [orderedLessons])

  const activeLessons = useMemo(() => {
    return pendingLessons.length > 0 ? pendingLessons : suggestedLesson ? [suggestedLesson] : []
  }, [pendingLessons, suggestedLesson])
  const activeLesson = activeLessons[0] ?? null

  // Per-lesson word groups
  const lessonGroups = useMemo(() => {
    if (!activeLessons.length) return []
    return activeLessons.map(l =>
      vocab.filter(w => w.unit === l.unit && w.lesson === l.lesson),
    )
  }, [vocab, activeLessons])

  const lessonWords = useMemo(() => lessonGroups.flat(), [lessonGroups])

  // Resolved quotas for display (default 3 if not set)
  const resolvedQuotas = useMemo(() => {
    return activeLessons.map(l => lessonQuotas[`${l.unit}::${l.lesson}`] ?? 3)
  }, [activeLessons, lessonQuotas])

  const totalPerDay = useMemo(() => resolvedQuotas.reduce((s, q) => s + q, 0), [resolvedQuotas])

  const incompletePlans = useMemo(() => {
    return allPlans.filter(
      (plan) => !plan.days.every((day) => plan.progress[day.date]?.quizDone === true),
    )
  }, [allPlans])

  const dialogWeekStart = useMemo(
    () => getWeekStart(new Date(pendingDate + 'T12:00:00'), weekStartDay),
    [pendingDate, weekStartDay],
  )

  // Lookup map wordKey → WordEntry
  const keyToWord = useMemo(() => {
    const map = new Map<string, WordEntry>()
    for (const w of vocab) map.set(wordKey(w), w)
    return map
  }, [vocab])

  const currentAndNextWeekPlans = useMemo(() => {
    const today = todayStr()
    const sorted = [...allPlans].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    let currentIdx = -1
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].weekStart <= today) { currentIdx = i; break }
    }
    const result: typeof allPlans = []
    if (currentIdx >= 0) result.push(sorted[currentIdx])
    if (currentIdx + 1 < sorted.length) result.push(sorted[currentIdx + 1])
    return result
  }, [allPlans])

  const oldReviewWords = useMemo(
    () => getOldReviewWords(vocab, masteryMap, currentAndNextWeekPlans),
    [vocab, masteryMap, currentAndNextWeekPlans],
  )

  const handleGoToArrange = useCallback(() => {
    if (!activeLesson) return
    const { days, unassigned } = buildWeeklyPlan(
      lessonWords,
      dialogWeekStart,
      totalPerDay,
      lessonGroups,
      resolvedQuotas,
    )
    setDraftDays(days)
    setUnassignedKeys(unassigned)
    setSelectedKeys(new Set())
    setStep('arrange')
  }, [activeLesson, lessonWords, lessonGroups, resolvedQuotas, totalPerDay, dialogWeekStart])

  // Move selected keys to a day (or to unassigned pool if dayIdx === -1)
  const handleMoveWords = useCallback((keys: Set<string>, targetDayIdx: number) => {
    setDraftDays(prev => {
      const next = prev.map(d => ({ ...d, newWordKeys: [...d.newWordKeys] }))
      for (const day of next) {
        day.newWordKeys = day.newWordKeys.filter(k => !keys.has(k))
      }
      if (targetDayIdx >= 0) next[targetDayIdx].newWordKeys.push(...keys)
      return next
    })
    setUnassignedKeys(prev => {
      const withoutMoved = prev.filter(k => !keys.has(k))
      return targetDayIdx === -1 ? [...withoutMoved, ...keys] : withoutMoved
    })
    setSelectedKeys(new Set())
  }, [])

  const handleConfirmArrange = useCallback(async () => {
    if (!activeLesson) return
    const plan: WeeklyPlan = {
      weekStart: dialogWeekStart,
      unit: activeLessons.map((l) => l.unit).join(', '),
      lesson: activeLessons.map((l) => l.lesson).join(', '),
      weekStartDay,
      newWordsPerDay: totalPerDay,
      days: draftDays,
      progress: {},
    }
    const saved = await savePlan(plan)
    setStep('list')
    if (saved.id) {
      router.push('/english/words/weekly/' + saved.id)
    }
  }, [
    activeLesson,
    activeLessons,
    dialogWeekStart,
    draftDays,
    totalPerDay,
    weekStartDay,
    savePlan,
    router,
  ])

  // ── OLD REVIEW SESSION ───────────────────────────────────────────────────
  if (showOldReview) {
    return (
      <OldReviewSession
        words={oldReviewWords}
        vocab={vocab}
        onBack={() => setShowOldReview(false)}
      />
    )
  }

  // ── PARAMS DIALOG ────────────────────────────────────────────────────────
  if (step === 'params') {
    const multiLesson = activeLessons.length > 1

    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      >
        <div className="mx-auto max-w-[560px] px-4 py-10">
          <div className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-7">
            <div className="font-fredoka mb-4 bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-2xl text-transparent">
              {isEditingPlan ? '修改周计划' : '创建周计划'}
            </div>

            {/* Date picker */}
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
                {/* Lesson picker toggle */}
                <div className="mb-3">
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
                  <div className="mb-4 max-h-[240px] overflow-hidden overflow-y-auto rounded-xl border border-[var(--wm-border)]">
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

                {/* Per-lesson quota pickers */}
                <div className="mb-4 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-4 py-4">
                  <div className="mb-3 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                    每天新词数量{multiLesson ? '（每课程）' : ''}
                  </div>
                  <div className="flex flex-col gap-4">
                    {activeLessons.map((l, gi) => {
                      const lkey = `${l.unit}::${l.lesson}`
                      const q = lessonQuotas[lkey] ?? 3
                      const groupSize = lessonGroups[gi]?.length ?? 0
                      const totalAssigned = Math.min(q * 7, groupSize)
                      return (
                        <div key={lkey}>
                          {multiLesson && (
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="text-[.82rem] font-bold text-[var(--wm-text)]">
                                {l.unit} · {l.lesson}
                              </span>
                              <span className="text-[.68rem] text-[var(--wm-text-dim)]">
                                共 {groupSize} 词 · 7天可分配 {totalAssigned} 词
                              </span>
                            </div>
                          )}
                          {!multiLesson && (
                            <div className="mb-1.5 text-[.72rem] text-[var(--wm-text-dim)]">
                              共 {groupSize} 词 · 7天可分配 {totalAssigned} 词
                            </div>
                          )}
                          <QuotaPicker
                            value={q}
                            onChange={(n) =>
                              setLessonQuotas(prev => ({ ...prev, [lkey]: n }))
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                  {multiLesson && (
                    <div className="mt-3 border-t border-[var(--wm-border)] pt-2 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
                      合计每天 {totalPerDay} 个新词
                    </div>
                  )}
                </div>

                {/* Week start day */}
                <div className="mb-4">
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
              <div className="mt-2 flex gap-2.5 border-t border-[var(--wm-border)] pt-5">
                <button
                  onClick={() => setStep('list')}
                  className="font-nunito flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-[var(--wm-border)] bg-transparent py-2.5 text-[.85rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
                >
                  取消
                </button>
                <button
                  onClick={handleGoToArrange}
                  className="font-nunito flex-[2] cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
                >
                  下一步：编辑分配 ▶
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── ARRANGE STEP ─────────────────────────────────────────────────────────
  if (step === 'arrange') {
    const totalAssigned = draftDays.reduce((s, d) => s + d.newWordKeys.length, 0)
    const hasSelection = selectedKeys.size > 0

    // WordChip component (inline for brevity)
    const renderChip = (key: string) => {
      const entry = keyToWord.get(key)
      const word = entry?.word ?? key.split('::')[2] ?? key
      const isSelected = selectedKeys.has(key)
      return (
        <button
          key={key}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedKeys(prev => {
              const next = new Set(prev)
              if (next.has(key)) next.delete(key)
              else next.add(key)
              return next
            })
          }}
          className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[.82rem] font-bold transition-all ${
            isSelected
              ? 'border-[#f59e0b] bg-[rgba(245,158,11,.2)] text-[#fbbf24] shadow-[0_0_0_2px_rgba(245,158,11,.3)]'
              : 'border-[var(--wm-border)] bg-[var(--wm-surface)] text-[var(--wm-text)] hover:border-[#f59e0b] hover:text-[#fbbf24]'
          }`}
        >
          {word}
        </button>
      )
    }

    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={() => setSelectedKeys(new Set())}
      >
        <div className="mx-auto max-w-[680px] px-4 py-10" onClick={(e) => e.stopPropagation()}>
          <div className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-6">
            {/* Header */}
            <div className="mb-1 flex items-center justify-between">
              <div className="font-fredoka bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-2xl text-transparent">
                编辑单词分配
              </div>
              <div className="text-[.72rem] font-bold text-[var(--wm-text-dim)]">
                已分配 {totalAssigned} / {lessonWords.length} 词
              </div>
            </div>
            <div className="mb-3 text-[.72rem] text-[var(--wm-text-dim)]">
              点击单词可多选，再点击目标日期批量移动
            </div>

            {/* Selection status bar */}
            {hasSelection && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.08)] px-3 py-2">
                <span className="text-[.75rem] font-extrabold text-[#fbbf24]">
                  已选 {selectedKeys.size} 个单词
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedKeys(new Set()) }}
                  className="ml-auto cursor-pointer rounded-full border border-[rgba(245,158,11,.3)] px-2.5 py-0.5 text-[.65rem] font-bold text-[#fbbf24] hover:bg-[rgba(245,158,11,.15)]"
                >
                  取消选择
                </button>
              </div>
            )}

            {/* Unassigned pool */}
            {unassignedKeys.length > 0 && (
              <div className={`mb-4 rounded-[14px] border transition-all ${
                hasSelection
                  ? 'border-[rgba(248,113,113,.5)] bg-[rgba(248,113,113,.05)]'
                  : 'border-[rgba(248,113,113,.3)] bg-[rgba(248,113,113,.04)]'
              }`}>
                <button
                  onClick={() => { if (hasSelection) handleMoveWords(selectedKeys, -1) }}
                  disabled={!hasSelection}
                  className={`flex w-full items-center gap-2 rounded-t-[14px] px-4 py-2.5 text-left transition-all ${
                    hasSelection ? 'cursor-pointer hover:bg-[rgba(248,113,113,.1)]' : 'cursor-default'
                  }`}
                >
                  <span className="text-[.78rem] font-extrabold text-[#f87171]">待分配</span>
                  <span className="ml-auto text-[.68rem] font-bold text-[#f87171]">
                    {unassignedKeys.length} 词
                  </span>
                  {hasSelection && (
                    <span className="ml-1 rounded-full bg-[rgba(248,113,113,.2)] px-2 py-0.5 text-[.65rem] font-extrabold text-[#f87171]">
                      移回这里
                    </span>
                  )}
                </button>
                <div className="flex min-h-[36px] flex-wrap gap-1.5 px-4 pb-3">
                  {unassignedKeys.map(key => renderChip(key))}
                </div>
              </div>
            )}

            {/* Day rows */}
            <div className="flex flex-col gap-3">
              {draftDays.map((day, dayIdx) => (
                <div
                  key={day.date}
                  className={`rounded-[14px] border transition-all ${
                    hasSelection
                      ? 'border-[rgba(245,158,11,.5)] bg-[rgba(245,158,11,.04)]'
                      : 'border-[var(--wm-border)] bg-[var(--wm-surface2)]'
                  }`}
                >
                  <button
                    onClick={() => { if (hasSelection) handleMoveWords(selectedKeys, dayIdx) }}
                    disabled={!hasSelection}
                    className={`flex w-full items-center gap-2 rounded-t-[14px] px-4 py-2.5 text-left transition-all ${
                      hasSelection
                        ? 'cursor-pointer hover:bg-[rgba(245,158,11,.12)]'
                        : 'cursor-default'
                    }`}
                  >
                    <span className="text-[.78rem] font-extrabold text-[var(--wm-text-dim)]">
                      {getDayLabel(day.date)}
                    </span>
                    <span className="text-[.7rem] text-[var(--wm-text-dim)]">
                      {fmtShortDate(day.date)}
                    </span>
                    <span className="ml-auto text-[.68rem] font-bold text-[var(--wm-text-dim)]">
                      {day.newWordKeys.length} 词
                    </span>
                    {hasSelection && (
                      <span className="ml-1 rounded-full bg-[rgba(245,158,11,.2)] px-2 py-0.5 text-[.65rem] font-extrabold text-[#fbbf24]">
                        移到这里
                      </span>
                    )}
                  </button>
                  <div className="flex min-h-[36px] flex-wrap gap-1.5 px-4 pb-3">
                    {day.newWordKeys.length === 0 ? (
                      <span className="text-[.7rem] italic text-[var(--wm-text-dim)] opacity-50">
                        休息日
                      </span>
                    ) : (
                      day.newWordKeys.map(key => renderChip(key))
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-2.5 border-t border-[var(--wm-border)] pt-5">
              <button
                onClick={() => setStep('params')}
                className="font-nunito flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-[var(--wm-border)] bg-transparent py-2.5 text-[.85rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
              >
                ← 返回
              </button>
              <button
                onClick={handleConfirmArrange}
                className="font-nunito flex-[2] cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
              >
                {isEditingPlan ? '保存修改' : '创建周计划'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PLANS LIST ───────────────────────────────────────────────────────────
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
            <div className="flex items-center gap-2">
              {oldReviewWords.length > 0 && (
                <button
                  onClick={() => setShowOldReview(true)}
                  className="font-nunito flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-[rgba(167,139,250,.4)] bg-[rgba(167,139,250,.08)] px-4 py-2.5 text-[.88rem] font-extrabold text-[#c4b5fd] transition-all hover:border-[rgba(167,139,250,.7)] hover:bg-[rgba(167,139,250,.15)]"
                >
                  📚 旧词复习
                  <span className="rounded-full bg-[rgba(167,139,250,.25)] px-1.5 py-0.5 text-[.72rem] font-black text-[#a78bfa]">
                    {oldReviewWords.length}
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  setPendingLessons([])
                  setPendingDate(todayStr())
                  setIsEditingPlan(false)
                  setStep('params')
                }}
                className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-5 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
              >
                + 创建周计划
              </button>
            </div>
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
                        if (plan.id) router.push('/english/words/weekly/' + plan.id)
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
                          {isExpired ? `已过期 ${Math.abs(remaining)} 天` : `还剩 ${remaining} 天`}
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
