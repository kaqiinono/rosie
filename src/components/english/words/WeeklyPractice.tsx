'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { WordEntry, WeeklyPlan } from '@/utils/type'
import { buildWeeklyPlan, getOrderedLessons, getWeekStart, fmtDate, fmtWeekRange } from '@/utils/english-helpers'
import MasteryStatusPanel from './MasteryStatusPanel'
import { useAuth } from '@/contexts/AuthContext'
import { useWordsContext } from '@/contexts/WordsContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { todayStr } from '@/utils/constant'

interface WeeklyPracticeProps {
  vocab: WordEntry[]
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

export default function WeeklyPractice({ vocab }: WeeklyPracticeProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { masteryMap } = useWordsContext()
  const { allPlans, deletePlan, defaultParams, savePlan, isLoading } = useWeeklyPlan(user)

  const [showParamsDialog, setShowParamsDialog] = useState(false)
  const [isEditingPlan, setIsEditingPlan] = useState(false)
  const [showLessonPicker, setShowLessonPicker] = useState(false)
  const [pendingLessons, setPendingLessons] = useState<{ unit: string; lesson: string }[]>([])
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

  const orderedLessons = useMemo(() => getOrderedLessons(vocab), [vocab])

  const suggestedLesson = useMemo(() => orderedLessons[0] ?? null, [orderedLessons])

  const activeLessons = useMemo(() => {
    return pendingLessons.length > 0 ? pendingLessons : suggestedLesson ? [suggestedLesson] : []
  }, [pendingLessons, suggestedLesson])
  const activeLesson = activeLessons[0] ?? null

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
    const saved = await savePlan(plan)
    setShowParamsDialog(false)
    if (saved.id) {
      router.push('/english/words/weekly/' + saved.id)
    }
  }, [
    activeLesson,
    activeLessons,
    dialogWeekStart,
    lessonWords,
    newPerDay,
    weekStartDay,
    savePlan,
    router,
  ])

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
                  onClick={() => setShowParamsDialog(false)}
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
