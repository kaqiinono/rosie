'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { WordEntry, WeeklyPlan, WeeklyPlanDay } from '@rosie/core'
import { buildWeeklyPlan, classifyPlanWords, getOrderedLessons, getAllStages, getWeekStart, fmtDate, fmtWeekRange, wordKey, getOldReviewWords, lessonChipTag } from '@/utils/english-helpers'
import { CONSOLIDATE_PASS_STAGE } from '@rosie/core'
import MasteryStatusPanel from './MasteryStatusPanel'
import OldReviewSession from './OldReviewSession'
import { useAuth } from '@rosie/core'
import { useWordsContext } from '@/contexts/WordsContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { todayStr, STORAGE_KEYS } from '@rosie/core'
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

/** Natural (numeric-aware) ascending compare, so "Lesson 2" < "Lesson 10". */
function cmpNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** Ascending by unit then lesson. */
function cmpLesson(a: { unit: string; lesson: string }, b: { unit: string; lesson: string }): number {
  return cmpNatural(a.unit, b.unit) || cmpNatural(a.lesson, b.lesson)
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

/** Max number of 必记 (consolidate) words assigned to any single day of a saved plan. */
function inferConsolidateDailyQuota(
  plan: WeeklyPlan,
  vocab: WordEntry[],
  kinds: Record<string, 'consolidate' | 'preview'>,
): number {
  let maxPerDay = 0
  for (const day of plan.days) {
    let n = 0
    for (const k of day.newWordKeys) {
      const e = vocab.find(w => wordKey(w) === k)
      if (!e) continue
      const kind = kinds[`${e.unit}::${e.lesson}`] ?? 'consolidate'
      if (kind === 'consolidate') n += 1
    }
    maxPerDay = Math.max(maxPerDay, n)
  }
  return maxPerDay > 0 ? maxPerDay : 3
}

function buildArrangeBaselineKey(
  weekStart: string,
  lessons: { unit: string; lesson: string }[],
  kinds: Record<string, 'consolidate' | 'preview'>,
  previewQuotas: Record<string, number>,
  consolidatePerDay: number,
): string {
  const sorted = [...lessons].sort((a, b) => lessonKey(a).localeCompare(lessonKey(b)))
  const parts = sorted.map(l => {
    const lk = lessonKey(l)
    const kind = kinds[lk] ?? 'consolidate'
    const q = kind === 'preview' ? String(previewQuotas[lk] ?? 3) : 'c'
    return `${lk}:${kind}:${q}`
  })
  return `${weekStart}|c${consolidatePerDay}|${parts.join('|')}`
}

function getWeekEnd(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const end = new Date(y, m - 1, d + 6)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
}

function loadCachedLessons(): { unit: string; lesson: string }[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.WEEKLY_PLAN_LAST_LESSONS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is { unit: string; lesson: string } =>
        x != null && typeof x.unit === 'string' && typeof x.lesson === 'string',
    )
  } catch {
    return []
  }
}

function saveCachedLessons(lessons: { unit: string; lesson: string }[]): void {
  if (typeof window === 'undefined') return
  try {
    const slim = lessons.map(l => ({ unit: l.unit, lesson: l.lesson }))
    window.localStorage.setItem(STORAGE_KEYS.WEEKLY_PLAN_LAST_LESSONS, JSON.stringify(slim))
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.) — silently skip.
  }
}

function loadCachedStages(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.WEEKLY_PLAN_LAST_STAGES)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

function saveCachedStages(stages: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEYS.WEEKLY_PLAN_LAST_STAGES, JSON.stringify(stages))
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.) — silently skip.
  }
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
  /** Selected vocab libraries (stage) that filter the lesson picker. Multi-select, cached. */
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set())
  // per-lesson daily quota: key = "unit::lesson"
  const [lessonQuotas, setLessonQuotas] = useState<Record<string, number>>({})
  /** User picks 必记/预习 per lesson; keys may include deselected lessons (ignored below). */
  const [lessonKindOverrides, setLessonKindOverrides] = useState<
    Record<string, 'consolidate' | 'preview'>
  >({})
  /** Single lesson key marked as this week's 重点 (focus). Mutually exclusive across lessons,
   *  must be a 必记 lesson; auto-clears when the lesson is removed or flipped to 预习. */
  const [focusLessonOverride, setFocusLessonOverride] = useState<string | null>(null)
  const [weekStartDay, setWeekStartDay] = useState<number>(4)
  /** Single daily quota for 必记 words across all 必记 lessons (auto-allocated). */
  const [consolidatePerDay, setConsolidatePerDay] = useState<number>(3)
  const [pendingDate, setPendingDate] = useState<string>(todayStr())
  const [syncedDefaultParams, setSyncedDefaultParams] = useState(defaultParams)
  if (syncedDefaultParams !== defaultParams) {
    setSyncedDefaultParams(defaultParams)
    if (defaultParams) {
      setWeekStartDay(defaultParams.weekStartDay)
      setConsolidatePerDay(defaultParams.newWordsPerDay)
    }
  }

  // old-review session
  const [showOldReview, setShowOldReview] = useState(false)

  // arrange-step state
  const [draftDays, setDraftDays] = useState<WeeklyPlanDay[]>([])
  const [unassignedKeys, setUnassignedKeys] = useState<string[]>([])
  const [carryoverCount, setCarryoverCount] = useState(0)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  // drag-and-drop state: dragOverIdx uses -1 for the unassigned pool, 0..N-1 for day rows
  const [draggedKeys, setDraggedKeys] = useState<string[] | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const orderedLessons = useMemo(() => getOrderedLessons(vocab), [vocab])
  const suggestedLesson = useMemo(() => orderedLessons[0] ?? null, [orderedLessons])

  const allStages = useMemo(() => getAllStages(vocab), [vocab])

  // Unique (unit, lesson) pairs carrying their vocab library (stage), sorted ascending
  // by unit then lesson. Drives the lesson picker; also used to look up a lesson's stage.
  const orderedLessonsFull = useMemo(() => {
    const seen = new Map<string, { unit: string; lesson: string; stage: string }>()
    for (const w of vocab) {
      const k = `${w.unit}::${w.lesson}`
      if (!seen.has(k)) seen.set(k, { unit: w.unit, lesson: w.lesson, stage: w.stage ?? '' })
    }
    return [...seen.values()].sort(cmpLesson)
  }, [vocab])

  const lessonStageMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const l of orderedLessonsFull) map.set(lessonKey(l), l.stage)
    return map
  }, [orderedLessonsFull])

  // Lessons shown in the picker: filtered by the selected stages (all when none selected).
  const pickerLessons = useMemo(() => {
    if (selectedStages.size === 0) return orderedLessonsFull
    return orderedLessonsFull.filter(l => selectedStages.has(l.stage))
  }, [orderedLessonsFull, selectedStages])

  const baseLessons = useMemo(
    () => (pendingLessons.length > 0 ? pendingLessons : suggestedLesson ? [suggestedLesson] : []),
    [pendingLessons, suggestedLesson],
  )

  // Active lessons in *display* order: 必记 first, then 预习, each ascending by
  // unit/lesson. Drives the params dialog summary/pickers only.
  const activeLessons = useMemo(() => {
    return [...baseLessons].sort((a, b) => {
      const ra = (lessonKindOverrides[lessonKey(a)] ?? 'consolidate') === 'preview' ? 1 : 0
      const rb = (lessonKindOverrides[lessonKey(b)] ?? 'consolidate') === 'preview' ? 1 : 0
      return ra - rb || cmpLesson(a, b)
    })
  }, [baseLessons, lessonKindOverrides])
  const activeLesson = activeLessons[0] ?? null

  const lessonKinds = useMemo(() => {
    const out: Record<string, 'consolidate' | 'preview'> = {}
    for (const l of baseLessons) {
      const k = lessonKey(l)
      out[k] = lessonKindOverrides[k] ?? 'consolidate'
    }
    return out
  }, [baseLessons, lessonKindOverrides])

  // 必记 lessons in *selection order* (earlier-selected = higher priority); 预习
  // lessons keep unit/lesson order so preview behavior stays unchanged.
  const consolidateLessons = useMemo(
    () => baseLessons.filter(l => (lessonKinds[lessonKey(l)] ?? 'consolidate') === 'consolidate'),
    [baseLessons, lessonKinds],
  )
  const previewLessons = useMemo(
    () => activeLessons.filter(l => (lessonKinds[lessonKey(l)] ?? 'consolidate') === 'preview'),
    [activeLessons, lessonKinds],
  )

  // 必记 words: a single stream across all 必记 lessons (selection order). Each
  // lesson is ordered ascending by mastery stage so the least-familiar words land
  // in the earliest days — initial assignment only; edit path reuses saved layout.
  const consolidateWords = useMemo(() => {
    return consolidateLessons.flatMap(l => {
      const group = vocab.filter(w => w.unit === l.unit && w.lesson === l.lesson)
      return group
        .map((w, i) => ({ w, i, stage: masteryMap[wordKey(w)]?.stage ?? 0 }))
        .sort((a, b) => a.stage - b.stage || a.i - b.i)
        .map(({ w }) => w)
    })
  }, [consolidateLessons, vocab, masteryMap])

  // 预习 words: one group per 预习 lesson, natural vocab order (unchanged).
  const previewGroups = useMemo(
    () => previewLessons.map(l => vocab.filter(w => w.unit === l.unit && w.lesson === l.lesson)),
    [previewLessons, vocab],
  )

  // Groups + per-group daily quotas fed to buildWeeklyPlan: 必记 is one merged
  // group with a single daily quota; each 预习 lesson keeps its own quota.
  const planGroups = useMemo(() => {
    const g: WordEntry[][] = []
    if (consolidateWords.length > 0) g.push(consolidateWords)
    for (const grp of previewGroups) g.push(grp)
    return g
  }, [consolidateWords, previewGroups])

  const planQuotas = useMemo(() => {
    const q: number[] = []
    if (consolidateWords.length > 0) q.push(consolidatePerDay)
    for (const l of previewLessons) q.push(lessonQuotas[lessonKey(l)] ?? 3)
    return q
  }, [consolidateWords, consolidatePerDay, previewLessons, lessonQuotas])

  const lessonWords = useMemo(() => planGroups.flat(), [planGroups])

  const totalPerDay = useMemo(() => planQuotas.reduce((s, q) => s + q, 0), [planQuotas])

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
    const lkinds = hydrateLessonKindOverridesFromPlan(plan, parsed, vocab)
    const quotas = inferLessonQuotasFromAssignments(plan, parsed, vocab)
    const cPerDay = inferConsolidateDailyQuota(plan, vocab, lkinds)
    const baseline = buildArrangeBaselineKey(plan.weekStart, parsed, lkinds, quotas, cPerDay)
    const planStages = new Set(
      parsed.map(l => lessonStageMap.get(lessonKey(l)) ?? '').filter(Boolean),
    )
    setPendingDate(plan.weekStart)
    setWeekStartDay(plan.weekStartDay)
    setConsolidatePerDay(cPerDay)
    setSelectedStages(planStages)
    setPendingLessons(parsed)
    setLessonQuotas(quotas)
    setLessonKindOverrides(lkinds)
    setFocusLessonOverride(plan.focusLessonKey ?? null)
    setEditArrangeBaselineKey(baseline)
    setEditingPlan(plan)
    setIsEditingPlan(true)
    setShowLessonPicker(true)
    setStep('params')
  }, [vocab, lessonStageMap])

  const handleGoToArrange = useCallback(() => {
    if (!activeLesson) return
    const snap = buildArrangeBaselineKey(dialogWeekStart, activeLessons, lessonKinds, lessonQuotas, consolidatePerDay)
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
      planGroups,
      planQuotas,
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
    lessonKinds,
    lessonQuotas,
    consolidatePerDay,
    editArrangeBaselineKey,
    editingPlan,
    isEditingPlan,
    lessonWords,
    planGroups,
    planQuotas,
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
    // Only persist focusLessonKey if it points to an active 必记 lesson
    const activeKeys = new Set(activeLessons.map(lessonKey))
    const previewSet = new Set(previewLessonKeys)
    const validFocus =
      focusLessonOverride &&
      activeKeys.has(focusLessonOverride) &&
      !previewSet.has(focusLessonOverride)
        ? focusLessonOverride
        : undefined
    const planBase: WeeklyPlan = {
      weekStart: dialogWeekStart,
      unit: activeLessons.map((l) => l.unit).join(', '),
      lesson: activeLessons.map((l) => l.lesson).join(', '),
      weekStartDay,
      newWordsPerDay: totalPerDay,
      days: draftDays,
      progress: wasEditing && editingPlan ? editingPlan.progress : {},
      previewLessonKeys,
      ...(validFocus !== undefined ? { focusLessonKey: validFocus } : {}),
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
    saveCachedLessons(activeLessons)
    saveCachedStages([...selectedStages])
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
    focusLessonOverride,
    vocab,
    isEditingPlan,
    editingPlan,
    selectedStages,
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
    const sourceCount = (consolidateWords.length > 0 ? 1 : 0) + previewLessons.length

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
                {/* Stage (词库) selector — pick libraries first, then units/lessons below */}
                {allStages.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                      选择词库（可多选）
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {allStages.map((s) => {
                        const on = selectedStages.has(s)
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() =>
                              setSelectedStages((prev) => {
                                const next = new Set(prev)
                                if (next.has(s)) next.delete(s)
                                else next.add(s)
                                return next
                              })
                            }
                            className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[.78rem] font-bold transition-all ${
                              on
                                ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
                                : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]'
                            }`}
                          >
                            {s}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

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
                    {pickerLessons.length === 0 && (
                      <div className="px-4 py-3 text-[.8rem] text-[var(--wm-text-dim)]">
                        该词库下暂无课程
                      </div>
                    )}
                    {pickerLessons.map((l) => {
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
                                if (exists) {
                                  if (focusLessonOverride === lk) setFocusLessonOverride(null)
                                  return prev.filter(
                                    (p) => !(p.unit === l.unit && p.lesson === l.lesson),
                                  )
                                }
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
                            {focusLessonOverride === lk && (
                              <span className="ml-1 text-[.85rem]" title="本周重点">⭐</span>
                            )}
                          </button>
                          {isActive && (
                            <div className="flex shrink-0 items-center gap-1 border-l border-[var(--wm-border)] px-2 py-2">
                              <button
                                type="button"
                                disabled={kind !== 'consolidate'}
                                title={kind !== 'consolidate' ? '只有必记课才能设为本周重点' : '设为本周重点（启用阅读+课文题型）'}
                                onClick={() =>
                                  setFocusLessonOverride((prev) => (prev === lk ? null : lk))
                                }
                                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] text-[.8rem] transition-all ${
                                  focusLessonOverride === lk
                                    ? 'border-[#f59e0b] bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] text-white shadow-[0_2px_8px_rgba(245,158,11,.4)]'
                                    : kind === 'consolidate'
                                      ? 'cursor-pointer border-[var(--wm-border)] bg-transparent text-[var(--wm-text-dim)] hover:border-[#f59e0b] hover:text-[#f59e0b]'
                                      : 'cursor-not-allowed border-[var(--wm-border)]/40 bg-transparent text-[var(--wm-text-dim)]/40'
                                }`}
                              >
                                ⭐
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLessonKindOverrides((p) => ({ ...p, [lk]: 'consolidate' }))
                                }}
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
                                onClick={() => {
                                  setLessonKindOverrides((p) => ({ ...p, [lk]: 'preview' }))
                                  if (focusLessonOverride === lk) setFocusLessonOverride(null)
                                }}
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
                      本周类型（必记 / 预习 / ⭐重点）
                    </div>
                    <div className="space-y-1">
                      {activeLessons.map((l) => {
                        const lk = lessonKey(l)
                        const kind = lessonKinds[lk] ?? 'consolidate'
                        const isFocus = focusLessonOverride === lk
                        return (
                          <div
                            key={lk}
                            className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--wm-border)] py-2 last:border-b-0 last:pb-0"
                          >
                            <span className="flex items-center gap-1.5 text-[.82rem] font-bold text-[var(--wm-text)]">
                              {l.unit} · {l.lesson}
                              {isFocus && <span title="本周重点">⭐</span>}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={kind !== 'consolidate'}
                                title={kind !== 'consolidate' ? '只有必记课才能设为本周重点' : '设为本周重点'}
                                onClick={() =>
                                  setFocusLessonOverride((prev) => (prev === lk ? null : lk))
                                }
                                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] text-[.8rem] transition-all ${
                                  isFocus
                                    ? 'border-[#f59e0b] bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] text-white shadow-[0_2px_8px_rgba(245,158,11,.4)]'
                                    : kind === 'consolidate'
                                      ? 'cursor-pointer border-[var(--wm-border)] bg-transparent text-[var(--wm-text-dim)] hover:border-[#f59e0b] hover:text-[#f59e0b]'
                                      : 'cursor-not-allowed border-[var(--wm-border)]/40 bg-transparent text-[var(--wm-text-dim)]/40'
                                }`}
                              >
                                ⭐
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLessonKindOverrides((p) => ({ ...p, [lk]: 'consolidate' }))
                                }}
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
                                onClick={() => {
                                  setLessonKindOverrides((p) => ({ ...p, [lk]: 'preview' }))
                                  if (focusLessonOverride === lk) setFocusLessonOverride(null)
                                }}
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
                      必记：本周要掌握；预习：先接触；⭐：本周核心课（启用阅读+课文题型）。
                    </p>
                  </div>
                )}

                {/* 必记: single daily quota auto-allocated across lessons (selection order) */}
                {consolidateWords.length > 0 && (
                  <div className="mb-4 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-4 py-4">
                    <div className="mb-1.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                      每天必记新词数量
                    </div>
                    <div className="mb-3 text-[.68rem] text-[var(--wm-text-dim)]">
                      共 {consolidateWords.length} 个必记词 · 7天可分配{' '}
                      {Math.min(consolidatePerDay * 7, consolidateWords.length)} 词
                      {consolidateLessons.length > 1 && '（按选择顺序自动分配到各课程）'}
                    </div>
                    <QuotaPicker value={consolidatePerDay} onChange={setConsolidatePerDay} />
                  </div>
                )}

                {/* 预习: per-lesson daily quota (unchanged) */}
                {previewLessons.length > 0 && (
                  <div className="mb-4 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-4 py-4">
                    <div className="mb-3 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                      每天预习新词数量{previewLessons.length > 1 ? '（每课程）' : ''}
                    </div>
                    <div className="flex flex-col gap-4">
                      {previewLessons.map((l, gi) => {
                        const lkey = `${l.unit}::${l.lesson}`
                        const q = lessonQuotas[lkey] ?? 3
                        const groupSize = previewGroups[gi]?.length ?? 0
                        const totalAssigned = Math.min(q * 7, groupSize)
                        return (
                          <div key={lkey}>
                            {previewLessons.length > 1 && (
                              <div className="mb-1.5 flex items-center gap-2">
                                <span className="text-[.82rem] font-bold text-[var(--wm-text)]">
                                  {l.unit} · {l.lesson}
                                </span>
                                <span className="text-[.68rem] text-[var(--wm-text-dim)]">
                                  共 {groupSize} 词 · 7天可分配 {totalAssigned} 词
                                </span>
                              </div>
                            )}
                            {previewLessons.length === 1 && (
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
                  </div>
                )}

                {sourceCount > 1 && (
                  <div className="mb-4 -mt-1 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
                    合计每天 {totalPerDay} 个新词
                  </div>
                )}

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
    const isDragging = draggedKeys !== null

    const handleChipDragStart = (e: React.DragEvent<HTMLButtonElement>, key: string) => {
      e.stopPropagation()
      // If the chip the user grabbed is part of a multi-selection, drag the whole batch;
      // otherwise drag just this chip (without disturbing existing selection).
      const keys = selectedKeys.has(key) && selectedKeys.size > 1
        ? Array.from(selectedKeys)
        : [key]
      setDraggedKeys(keys)
      try {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', keys.join(','))
      } catch {
        // Some browsers (older Safari) throw on setData; safe to ignore.
      }
    }

    const handleChipDragEnd = () => {
      setDraggedKeys(null)
      setDragOverIdx(null)
    }

    const handleZoneDragOver = (e: React.DragEvent, idx: number) => {
      if (!draggedKeys) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dragOverIdx !== idx) setDragOverIdx(idx)
    }

    const handleZoneDrop = (e: React.DragEvent, idx: number) => {
      e.preventDefault()
      e.stopPropagation()
      if (!draggedKeys || draggedKeys.length === 0) return
      handleMoveWords(new Set(draggedKeys), idx)
      setDraggedKeys(null)
      setDragOverIdx(null)
    }

    // WordChip component (inline for brevity)
    const renderChip = (key: string) => {
      const entry = keyToWord.get(key)
      const word = entry?.word ?? key.split('::')[2] ?? key
      const isSelected = selectedKeys.has(key)
      const isRollover = rolloverKeySet.has(key)
      const isDraggingThis = draggedKeys?.includes(key) ?? false
      const wordKind: 'consolidate' | 'preview' = entry
        ? (lessonKinds[`${entry.unit}::${entry.lesson}`] ?? 'consolidate')
        : 'consolidate'
      const lessonTag = entry ? lessonChipTag(entry.unit, entry.lesson) : ''
      return (
        <button
          key={key}
          draggable
          onDragStart={(e) => handleChipDragStart(e, key)}
          onDragEnd={handleChipDragEnd}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedKeys(prev => {
              const next = new Set(prev)
              if (next.has(key)) next.delete(key)
              else next.add(key)
              return next
            })
          }}
          className={`cursor-grab rounded-full border-[1.5px] px-3 py-1 text-[.82rem] font-bold transition-all active:cursor-grabbing ${
            isDraggingThis ? 'opacity-40' : ''
          } ${
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
          {lessonTag && (
            <span className="ml-1 rounded-[3px] bg-[rgba(255,255,255,.08)] px-1 py-px text-[.5rem] font-extrabold leading-none tracking-tight opacity-60 align-middle">
              {lessonTag}
            </span>
          )}
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
              拖拽单词到目标星期块；或点击多选后再点目标日期批量移动
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
              <div
                onDragOver={(e) => handleZoneDragOver(e, -1)}
                onDrop={(e) => handleZoneDrop(e, -1)}
                className={`mb-4 rounded-[14px] border transition-all ${
                  dragOverIdx === -1
                    ? 'border-[#f87171] bg-[rgba(248,113,113,.14)] shadow-[0_0_0_2px_rgba(248,113,113,.3)]'
                    : hasSelection || isDragging
                      ? 'border-[rgba(248,113,113,.5)] bg-[rgba(248,113,113,.05)]'
                      : 'border-[rgba(248,113,113,.3)] bg-[rgba(248,113,113,.04)]'
                }`}
              >
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
                  {(hasSelection || isDragging) && (
                    <span className="ml-1 rounded-full bg-[rgba(248,113,113,.2)] px-2 py-0.5 text-[.65rem] font-extrabold text-[#f87171]">
                      {isDragging ? '拖到这里' : '移回这里'}
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
                  onDragOver={(e) => handleZoneDragOver(e, dayIdx)}
                  onDrop={(e) => handleZoneDrop(e, dayIdx)}
                  className={`rounded-[14px] border transition-all ${
                    dragOverIdx === dayIdx
                      ? 'border-[#f59e0b] bg-[rgba(245,158,11,.14)] shadow-[0_0_0_2px_rgba(245,158,11,.3)]'
                      : hasSelection || isDragging
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
                    {(hasSelection || isDragging) && (
                      <span className="ml-1 rounded-full bg-[rgba(245,158,11,.2)] px-2 py-0.5 text-[.65rem] font-extrabold text-[#fbbf24]">
                        {isDragging ? '拖到这里' : '移到这里'}
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
                  const cached = loadCachedLessons().filter(c =>
                    orderedLessons.some(o => o.unit === c.unit && o.lesson === c.lesson),
                  )
                  const cachedStages = loadCachedStages().filter(s => allStages.includes(s))
                  setSelectedStages(new Set(cachedStages))
                  setPendingLessons(cached)
                  setLessonKindOverrides({})
                  setConsolidatePerDay(defaultParams?.newWordsPerDay ?? 3)
                  setFocusLessonOverride(null)
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
                    className="group flex flex-col rounded-[14px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] transition-all hover:border-[var(--wm-accent)] hover:bg-[var(--wm-surface)] sm:flex-row sm:items-stretch"
                  >
                    <button
                      onClick={() => {
                        if (plan.id) router.push('/english/words/weekly/' + plan.id)
                      }}
                      className="min-w-0 min-h-0 flex-1 cursor-pointer rounded-t-[14px] px-3 py-3 text-left sm:rounded-l-[14px] sm:rounded-tr-none sm:px-5 sm:py-4"
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
                    <div className="flex flex-row flex-wrap items-center justify-end gap-1.5 px-3 pt-1 pb-3 sm:flex-none sm:flex-nowrap sm:gap-2 sm:self-center sm:px-4 sm:py-4 sm:pl-0 sm:pt-4">
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
