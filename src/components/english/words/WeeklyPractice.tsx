'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { WordEntry, WeeklyPlan, WeeklyPlanDay } from '@/utils/type'
import { buildWeeklyPlan, classifyPlanWords, getOrderedLessons, getWeekStart, fmtDate, fmtWeekRange, wordKey, getOldReviewWords } from '@/utils/english-helpers'
import { CONSOLIDATE_PASS_STAGE } from '@/utils/masteryUtils'
import MasteryStatusPanel from './MasteryStatusPanel'
import OldReviewSession from './OldReviewSession'
import { useAuth } from '@/contexts/AuthContext'
import { useWordsContext } from '@/contexts/WordsContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { todayStr } from '@/utils/constant'
import { buildEnglishWeeklyReport } from '@/utils/buildEnglishWeeklyReport'

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

function lessonKey(l: { unit: string; lesson: string }): string {
  return `${l.unit}::${l.lesson}`
}

/** Reverse `unit` / `lesson` comma lists saved on `WeeklyPlan`. */
function parsePlanLessons(plan: WeeklyPlan): { unit: string; lesson: string }[] {
  const units = plan.unit.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean)
  const lessons = plan.lesson.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean)
  if (units.length === 0) return []
  const n = Math.max(units.length, lessons.length)
  const out: { unit: string; lesson: string }[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      unit: units[i] ?? units[0]!,
      lesson: lessons[i] ?? lessons[lessons.length - 1]! ?? '',
    })
  }
  return out
}

function inferLessonQuotasFromAssignments(
  plan: WeeklyPlan,
  lessons: { unit: string; lesson: string }[],
  vocab: WordEntry[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of lessons) {
    const lk = lessonKey(l)
    let maxPerDay = 0
    for (const day of plan.days) {
      let n = 0
      for (const k of day.newWordKeys) {
        const e = vocab.find(w => wordKey(w) === k)
        if (e && e.unit === l.unit && e.lesson === l.lesson) n += 1
      }
      maxPerDay = Math.max(maxPerDay, n)
    }
    out[lk] = maxPerDay > 0 ? maxPerDay : 3
  }
  return out
}

function hydrateLessonKindOverridesFromPlan(
  plan: WeeklyPlan,
  lessons: { unit: string; lesson: string }[],
  vocab: WordEntry[],
): Record<string, 'consolidate' | 'preview'> {
  const out: Record<string, 'consolidate' | 'preview'> = {}
  if (plan.previewLessonKeys !== undefined) {
    const ps = new Set(plan.previewLessonKeys)
    for (const l of lessons) {
      const lk = lessonKey(l)
      out[lk] = ps.has(lk) ? 'preview' : 'consolidate'
    }
    return out
  }
  const cls = classifyPlanWords(plan, vocab)
  for (const l of lessons) {
    const lk = lessonKey(l)
    const seen = new Set<string>()
    const inLesson: string[] = []
    for (const d of plan.days) {
      for (const k of d.newWordKeys) {
        if (seen.has(k)) continue
        const e = vocab.find(w => wordKey(w) === k)
        if (e && e.unit === l.unit && e.lesson === l.lesson) {
          seen.add(k)
          inLesson.push(k)
        }
      }
    }
    if (inLesson.length === 0) out[lk] = 'consolidate'
    else out[lk] = inLesson.every(k => cls.get(k) === 'preview') ? 'preview' : 'consolidate'
  }
  return out
}

function buildArrangeBaselineKey(
  weekStart: string,
  lessons: { unit: string; lesson: string }[],
  quotas: Record<string, number>,
): string {
  const sorted = [...lessons].sort((a, b) => lessonKey(a).localeCompare(lessonKey(b)))
  return `${weekStart}|${sorted.map(lessonKey).join('|')}|${sorted.map(l => String(quotas[lessonKey(l)] ?? 3)).join(',')}`
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
  /** Plan being edited (same form as create); keeps id/progress/weekCompletion until save. */
  const [editingPlan, setEditingPlan] = useState<WeeklyPlan | null>(null)
  /** When unchanged from open-edit, arrange step reuses existing `days` layout. */
  const [editArrangeBaselineKey, setEditArrangeBaselineKey] = useState<string | null>(null)
  const [showLessonPicker, setShowLessonPicker] = useState(false)
  const [pendingLessons, setPendingLessons] = useState<{ unit: string; lesson: string }[]>([])
  // per-lesson daily quota: key = "unit::lesson"
  const [lessonQuotas, setLessonQuotas] = useState<Record<string, number>>({})
  /** User picks 必记/预习 per lesson; keys may include deselected lessons (ignored below). */
  const [lessonKindOverrides, setLessonKindOverrides] = useState<
    Record<string, 'consolidate' | 'preview'>
  >({})
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
  const [carryoverCount, setCarryoverCount] = useState(0)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const orderedLessons = useMemo(() => getOrderedLessons(vocab), [vocab])
  const suggestedLesson = useMemo(() => orderedLessons[0] ?? null, [orderedLessons])

  const activeLessons = useMemo(() => {
    return pendingLessons.length > 0 ? pendingLessons : suggestedLesson ? [suggestedLesson] : []
  }, [pendingLessons, suggestedLesson])
  const activeLesson = activeLessons[0] ?? null

  const lessonKinds = useMemo(() => {
    const out: Record<string, 'consolidate' | 'preview'> = {}
    for (const l of activeLessons) {
      const k = lessonKey(l)
      out[k] = lessonKindOverrides[k] ?? 'consolidate'
    }
    return out
  }, [activeLessons, lessonKindOverrides])

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

  const sortedAllPlans = useMemo(
    () => [...allPlans].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [allPlans],
  )

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

  const handleMarkWeekComplete = useCallback(
    async (plan: WeeklyPlan) => {
      if (plan.weekCompletion) return
      if (!window.confirm('确定将本周标记为已结束？将根据当前进度与掌握度生成结课报告并保存。')) return
      const report = buildEnglishWeeklyReport(plan, vocab, masteryMap)
      const weekCompletion = { completedAt: new Date().toISOString(), report }
      const updated: WeeklyPlan = { ...plan, weekCompletion }
      const saved = await savePlan(updated)
      const targetId = saved.id ?? plan.id
      if (targetId) {
        router.push(`/english/words/weekly/${targetId}/report`)
      }
    },
    [vocab, masteryMap, savePlan, router],
  )

  const openEditPlan = useCallback((plan: WeeklyPlan) => {
    if (plan.weekCompletion) return
    const parsed = parsePlanLessons(plan)
    const quotas = inferLessonQuotasFromAssignments(plan, parsed, vocab)
    const lkinds = hydrateLessonKindOverridesFromPlan(plan, parsed, vocab)
    const baseline = buildArrangeBaselineKey(plan.weekStart, parsed, quotas)
    setPendingDate(plan.weekStart)
    setWeekStartDay(plan.weekStartDay)
    setPendingLessons(parsed)
    setLessonQuotas(quotas)
    setLessonKindOverrides(lkinds)
    setEditArrangeBaselineKey(baseline)
    setEditingPlan(plan)
    setIsEditingPlan(true)
    setShowLessonPicker(true)
    setStep('params')
  }, [vocab])

  const handleGoToArrange = useCallback(() => {
    if (!activeLesson) return
    const snap = buildArrangeBaselineKey(dialogWeekStart, activeLessons, lessonQuotas)
    if (isEditingPlan && editingPlan && snap === editArrangeBaselineKey) {
      setDraftDays(editingPlan.days.map(d => ({ date: d.date, newWordKeys: [...d.newWordKeys] })))
      const wordSet = new Set(lessonWords.map(w => wordKey(w)))
      const assigned = new Set(editingPlan.days.flatMap(d => d.newWordKeys))
      const un = [...wordSet].filter(k => !assigned.has(k))
      setUnassignedKeys(un)
      setCarryoverCount(0)
      setSelectedKeys(new Set())
      setStep('arrange')
      return
    }

    const { days, unassigned } = buildWeeklyPlan(
      lessonWords,
      dialogWeekStart,
      totalPerDay,
      lessonGroups,
      resolvedQuotas,
    )

    // Carryover: previous-week plan's consolidate words with stage < CONSOLIDATE_PASS_STAGE (§3.7)
    let rolloverKeys: string[] = []
    let rolloverCount = 0
    if (!isEditingPlan) {
      const [ny, nm, nd] = dialogWeekStart.split('-').map(Number)
      const prevWeekStart = new Date(ny, nm - 1, nd - 7)
      const prevWeekStartStr = `${prevWeekStart.getFullYear()}-${String(prevWeekStart.getMonth() + 1).padStart(2, '0')}-${String(prevWeekStart.getDate()).padStart(2, '0')}`
      const prevPlan = allPlans.find(p => p.weekStart === prevWeekStartStr)
      if (prevPlan) {
        const prevKindMap = classifyPlanWords(prevPlan, vocab)
        rolloverKeys = [...prevKindMap.entries()]
          .filter(([key, kind]) => {
            if (kind !== 'consolidate') return false
            const m = masteryMap[key]
            return !m || (m.stage ?? 0) < CONSOLIDATE_PASS_STAGE
          })
          .map(([key]) => key)
          .filter(k => !days.some(d => d.newWordKeys.includes(k)) && !unassigned.includes(k))
        rolloverCount = rolloverKeys.length
      }
    }

    setDraftDays(days)
    setUnassignedKeys([...unassigned, ...rolloverKeys])
    setSelectedKeys(new Set())
    if (rolloverCount > 0) {
      sessionStorage.setItem('rollover_keys', JSON.stringify(rolloverKeys))
    } else {
      sessionStorage.removeItem('rollover_keys')
    }
    setStep('arrange')
  }, [
    activeLesson,
    activeLessons,
    lessonQuotas,
    editArrangeBaselineKey,
    editingPlan,
    isEditingPlan,
    lessonWords,
    lessonGroups,
    resolvedQuotas,
    totalPerDay,
    dialogWeekStart,
    allPlans,
    vocab,
    masteryMap,
  ])

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
    const wasEditing = isEditingPlan
    const previewLessonKeys = activeLessons
      .filter((l) => (lessonKinds[lessonKey(l)] ?? 'consolidate') === 'preview')
      .map((l) => lessonKey(l))
    const planBase: WeeklyPlan = {
      weekStart: dialogWeekStart,
      unit: activeLessons.map((l) => l.unit).join(', '),
      lesson: activeLessons.map((l) => l.lesson).join(', '),
      weekStartDay,
      newWordsPerDay: totalPerDay,
      days: draftDays,
      progress: wasEditing && editingPlan ? editingPlan.progress : {},
      previewLessonKeys,
      ...(wasEditing && editingPlan?.weekCompletion
        ? { weekCompletion: editingPlan.weekCompletion }
        : {}),
      ...(wasEditing && editingPlan?.id ? { id: editingPlan.id } : {}),
    }
    const kindMap = classifyPlanWords(planBase, vocab)
    const plan: WeeklyPlan = {
      ...planBase,
      wordKinds: Object.fromEntries(kindMap),
    }
    const saved = await savePlan(plan)
    setStep('list')
    setCarryoverCount(0)
    setIsEditingPlan(false)
    setEditingPlan(null)
    setEditArrangeBaselineKey(null)
    if (!wasEditing && saved.id) {
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
    lessonKinds,
    vocab,
    isEditingPlan,
    editingPlan,
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
                  disabled={isEditingPlan}
                  onChange={(e) => e.target.value && setPendingDate(e.target.value)}
                  className={`rounded-[10px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3 py-1.5 text-[.88rem] font-bold text-[var(--wm-text)] outline-none focus:border-[var(--wm-accent)] ${
                    isEditingPlan ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                />
                <span className="text-[.75rem] font-bold text-[var(--wm-text-dim)]">
                  → 周 {fmtWeekRange(dialogWeekStart, weekStartDay)}
                </span>
              </div>
              {isEditingPlan && (
                <p className="mt-1.5 text-[.65rem] text-[var(--wm-text-dim)]">
                  编辑已有计划时不能更改周起始日，以免与已存进度错位。
                </p>
              )}
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
                  <div className="mb-4 max-h-[280px] overflow-hidden overflow-y-auto rounded-xl border border-[var(--wm-border)]">
                    {orderedLessons.map((l) => {
                      const lk = lessonKey(l)
                      const isActive = activeLessons.some(
                        (al) => al.unit === l.unit && al.lesson === l.lesson,
                      )
                      const kind = lessonKinds[lk] ?? 'consolidate'
                      return (
                        <div
                          key={lk}
                          className={`flex w-full items-stretch border-b border-[var(--wm-border)] last:border-0 ${
                            isActive ? 'bg-[rgba(245,158,11,.12)]' : 'bg-[var(--wm-surface2)]'
                          }`}
                        >
                          <button
                            type="button"
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
                            className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-[1rem] font-bold transition-all ${
                              isActive
                                ? 'text-[#fbbf24]'
                                : 'text-[var(--wm-text)] hover:bg-[var(--wm-surface)]'
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
                          {isActive && (
                            <div className="flex shrink-0 items-center gap-1 border-l border-[var(--wm-border)] px-2 py-2">
                              <button
                                type="button"
                                onClick={() => setLessonKindOverrides((p) => ({ ...p, [lk]: 'consolidate' }))}
                                className={`rounded-full border-[1.5px] px-2 py-0.5 text-[.62rem] font-extrabold transition-all ${
                                  kind === 'consolidate'
                                    ? 'border-[rgba(96,165,250,.5)] bg-[rgba(96,165,250,.12)] text-[#93c5fd]'
                                    : 'border-[var(--wm-border)] bg-transparent text-[var(--wm-text-dim)] hover:border-[rgba(96,165,250,.35)]'
                                }`}
                              >
                                必记
                              </button>
                              <button
                                type="button"
                                onClick={() => setLessonKindOverrides((p) => ({ ...p, [lk]: 'preview' }))}
                                className={`rounded-full border-[1.5px] px-2 py-0.5 text-[.62rem] font-extrabold transition-all ${
                                  kind === 'preview'
                                    ? 'border-[rgba(249,115,22,.5)] bg-[rgba(249,115,22,.1)] text-[#fb923c]'
                                    : 'border-[var(--wm-border)] bg-transparent text-[var(--wm-text-dim)] hover:border-[rgba(249,115,22,.35)]'
                                }`}
                              >
                                预习
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {!showLessonPicker && activeLessons.length > 0 && (
                  <div className="mb-4 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-4 py-3">
                    <div className="mb-2 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                      本周类型（必记 / 预习）
                    </div>
                    <div className="space-y-1">
                      {activeLessons.map((l) => {
                        const lk = lessonKey(l)
                        const kind = lessonKinds[lk] ?? 'consolidate'
                        return (
                          <div
                            key={lk}
                            className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--wm-border)] py-2 last:border-b-0 last:pb-0"
                          >
                            <span className="text-[.82rem] font-bold text-[var(--wm-text)]">
                              {l.unit} · {l.lesson}
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setLessonKindOverrides((p) => ({ ...p, [lk]: 'consolidate' }))}
                                className={`rounded-full border-[1.5px] px-2.5 py-0.5 text-[.65rem] font-extrabold transition-all ${
                                  kind === 'consolidate'
                                    ? 'border-[rgba(96,165,250,.5)] bg-[rgba(96,165,250,.12)] text-[#93c5fd]'
                                    : 'border-[var(--wm-border)] bg-transparent text-[var(--wm-text-dim)] hover:border-[rgba(96,165,250,.35)]'
                                }`}
                              >
                                必记
                              </button>
                              <button
                                type="button"
                                onClick={() => setLessonKindOverrides((p) => ({ ...p, [lk]: 'preview' }))}
                                className={`rounded-full border-[1.5px] px-2.5 py-0.5 text-[.65rem] font-extrabold transition-all ${
                                  kind === 'preview'
                                    ? 'border-[rgba(249,115,22,.5)] bg-[rgba(249,115,22,.1)] text-[#fb923c]'
                                    : 'border-[var(--wm-border)] bg-transparent text-[var(--wm-text-dim)] hover:border-[rgba(249,115,22,.35)]'
                                }`}
                              >
                                预习
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-[.65rem] leading-snug text-[var(--wm-text-dim)]">
                      必记：本周要掌握；预习：先接触。可多课标预习。
                    </p>
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
                        type="button"
                        disabled={isEditingPlan}
                        onClick={() => { if (!isEditingPlan) setWeekStartDay(opt.value) }}
                        className={`rounded-full border-[1.5px] px-3 py-1.5 text-[0.875rem] font-bold transition-all ${
                          weekStartDay === opt.value
                            ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
                            : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]'
                        } ${isEditingPlan ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
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
                  type="button"
                  onClick={() => {
                    setStep('list')
                    setCarryoverCount(0)
                    setIsEditingPlan(false)
                    setEditingPlan(null)
                    setEditArrangeBaselineKey(null)
                  }}
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
    const rolloverKeySet = new Set<string>(
      typeof window !== 'undefined'
        ? (() => { try { return JSON.parse(sessionStorage.getItem('rollover_keys') ?? '[]') as string[] } catch { return [] } })()
        : [],
    )
    const rolloverCount = rolloverKeySet.size

    // WordChip component (inline for brevity)
    const renderChip = (key: string) => {
      const entry = keyToWord.get(key)
      const word = entry?.word ?? key.split('::')[2] ?? key
      const isSelected = selectedKeys.has(key)
      const isRollover = rolloverKeySet.has(key)
      const wordKind: 'consolidate' | 'preview' = entry
        ? (lessonKinds[`${entry.unit}::${entry.lesson}`] ?? 'consolidate')
        : 'consolidate'
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
              : isRollover
                ? 'border-[rgba(167,139,250,.5)] bg-[rgba(167,139,250,.1)] text-[#c4b5fd] hover:border-[#a78bfa]'
                : wordKind === 'preview'
                  ? 'border-[rgba(249,115,22,.4)] bg-[rgba(249,115,22,.08)] text-[#fb923c] hover:border-[#f97316]'
                  : 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.07)] text-[#93c5fd] hover:border-[#60a5fa]'
          }`}
        >
          {isRollover && <span className="mr-1 text-[.6rem]">↻</span>}
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
                {isEditingPlan ? '编辑周计划 · 分配' : '编辑单词分配'}
              </div>
              <div className="text-[.72rem] font-bold text-[var(--wm-text-dim)]">
                已分配 {totalAssigned} / {lessonWords.length} 词
              </div>
            </div>
            <div className="mb-2 text-[.72rem] text-[var(--wm-text-dim)]">
              点击单词可多选，再点击目标日期批量移动
            </div>
            <div className="mb-3 flex items-center gap-3 text-[.68rem]">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[rgba(96,165,250,.6)]" />
                <span className="text-[#93c5fd]">必记</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[rgba(249,115,22,.6)]" />
                <span className="text-[#fb923c]">预习</span>
              </span>
            </div>

            {/* Rollover notice (§3.7) */}
            {rolloverCount > 0 && (
              <div className="mb-3 rounded-[10px] border border-[rgba(167,139,250,.4)] bg-[rgba(167,139,250,.08)] px-4 py-2.5 text-[.75rem] font-bold text-[#c4b5fd]">
                ↻ 上周有 {rolloverCount} 个必记词未达标，已加入待分配池，请安排到合适日子
              </div>
            )}

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

            {carryoverCount > 0 && (
              <div className="mb-3 rounded-[14px] border border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.08)] px-4 py-3 text-[.78rem] font-bold text-[#fbbf24]">
                ↻ 上周有 {carryoverCount} 个必记词未达标，已加入下方待分配池，请安排到合适的日子。
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
            <div className="flex flex-wrap items-center justify-end gap-2">
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
                  setLessonKindOverrides({})
                  setPendingDate(todayStr())
                  setIsEditingPlan(false)
                  setEditingPlan(null)
                  setEditArrangeBaselineKey(null)
                  setStep('params')
                }}
                className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-5 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
              >
                + 创建周计划
              </button>
            </div>
          </div>
          {sortedAllPlans.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--wm-text-dim)]">
              暂无周计划
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sortedAllPlans.map((plan) => {
                const doneDays = plan.days.filter(
                  (d) => plan.progress[d.date]?.quizDone === true,
                ).length
                const showWeekExpiry = !plan.weekCompletion
                const remaining = showWeekExpiry ? daysUntilExpiry(plan.weekStart) : 0
                const isExpired = showWeekExpiry && remaining < 0
                const weekEnd = getWeekEnd(plan.weekStart)
                const units = plan.unit.split(', ')
                const lessons = plan.lesson.split(', ')
                const allSameUnit = units.every((u) => u === units[0])
                const lessonLabel = allSameUnit
                  ? `${units[0]} · ${lessons.join(', ')}`
                  : units.map((u, i) => `${u} · ${lessons[i] ?? ''}`).join(', ')
                return (
                  <div
                    key={plan.id ?? plan.weekStart}
                    className="flex flex-row items-stretch gap-2"
                  >
                    <button
                      onClick={() => {
                        if (plan.id) router.push('/english/words/weekly/' + plan.id)
                      }}
                      className="min-w-0 min-h-0 flex-1 cursor-pointer rounded-[14px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3 py-3 text-left transition-all hover:border-[var(--wm-accent)] hover:bg-[var(--wm-surface)] sm:px-5 sm:py-4"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-[1rem] font-bold text-[var(--wm-text)]">
                        {lessonLabel}
                        {plan.weekCompletion && (
                          <span className="rounded-full border border-[rgba(74,222,128,.35)] bg-[rgba(74,222,128,.1)] px-2 py-0.5 text-[.62rem] font-extrabold text-[#86efac]">
                            已结课
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-[.72rem] text-[var(--wm-text-dim)]">
                        <span>
                          {fmtDate(plan.weekStart)} – {fmtDate(weekEnd)}
                        </span>
                        <span>{doneDays}/7 天完成</span>
                        {showWeekExpiry && (
                          <span className={isExpired ? 'text-[#f87171]' : 'text-[#fbbf24]'}>
                            {isExpired ? `已过期 ${Math.abs(remaining)} 天` : `还剩 ${remaining} 天`}
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="flex flex-none flex-row flex-nowrap items-center justify-end gap-1.5 self-center sm:gap-2">
                      {!plan.weekCompletion && plan.id && (
                        <button
                          type="button"
                          onClick={() => { openEditPlan(plan) }}
                          className="font-nunito inline-flex cursor-pointer items-center justify-center rounded-[10px] border border-[rgba(96,165,250,.4)] bg-[rgba(96,165,250,.08)] px-2.5 py-2.5 text-center text-[.72rem] font-extrabold text-[#93c5fd] transition-all hover:border-[#60a5fa] hover:bg-[rgba(96,165,250,.14)] sm:px-3 sm:text-[.75rem] whitespace-nowrap"
                        >
                          编辑计划
                        </button>
                      )}
                      {!plan.weekCompletion && (
                        <button
                          type="button"
                          onClick={() => { void handleMarkWeekComplete(plan) }}
                          className="font-nunito cursor-pointer rounded-[10px] border border-[rgba(74,222,128,.4)] bg-[rgba(74,222,128,.1)] px-2.5 py-2.5 text-[.72rem] font-extrabold text-[#4ade80] transition-all hover:border-[#4ade80] hover:bg-[rgba(74,222,128,.18)] sm:px-3 sm:text-[.75rem] whitespace-nowrap"
                        >
                          完成本周
                        </button>
                      )}
                      {plan.weekCompletion && plan.id && (
                        <Link
                          href={`/english/words/weekly/${plan.id}/report`}
                          className="font-nunito inline-flex cursor-pointer items-center justify-center rounded-[10px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-2.5 py-2.5 text-center text-[.72rem] font-extrabold text-[#c4b5fd] transition-all hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.12)] sm:px-3 sm:text-[.75rem] whitespace-nowrap"
                        >
                          结课报告
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm(`确定删除「${lessonLabel}」周计划？`)) {
                            void deletePlan(plan.weekStart)
                          }
                        }}
                        className="shrink-0 cursor-pointer rounded-[10px] border border-[var(--wm-border)] bg-transparent px-2.5 py-2.5 text-[.72rem] text-[var(--wm-text-dim)] transition-all hover:border-[#f87171] hover:bg-[rgba(248,113,113,.08)] hover:text-[#f87171] sm:px-3 sm:text-[.75rem] whitespace-nowrap"
                        title="删除"
                        type="button"
                      >
                        删除
                      </button>
                    </div>
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
