'use client'

import type { WeeklyPlan } from '@rosie/core'
import { STORAGE_KEYS } from '@rosie/core'

import type { WordEntry } from '@rosie/core'
import { classifyPlanWords, wordKey } from '../../utils/english-helpers'

export function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const dow = d.getDay()
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return labels[dow]
}

export function fmtShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

export const ALL_DAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' },
]

export function lessonKey(l: { unit: string; lesson: string }): string {
  return `${l.unit}::${l.lesson}`
}

/** Natural (numeric-aware) ascending compare, so "Lesson 2" < "Lesson 10". */
export function cmpNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** Ascending by unit then lesson. */
export function cmpLesson(a: { unit: string; lesson: string }, b: { unit: string; lesson: string }): number {
  return cmpNatural(a.unit, b.unit) || cmpNatural(a.lesson, b.lesson)
}

/** Reverse `unit` / `lesson` comma lists saved on `WeeklyPlan`. */
export function parsePlanLessons(plan: WeeklyPlan): { unit: string; lesson: string }[] {
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

export function inferLessonQuotasFromAssignments(
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

export function hydrateLessonKindOverridesFromPlan(
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

export function buildArrangeBaselineKey(
  weekStart: string,
  lessons: { unit: string; lesson: string }[],
  kinds: Record<string, 'consolidate' | 'preview'>,
  quotas: Record<string, number>,
): string {
  const sorted = [...lessons].sort((a, b) => lessonKey(a).localeCompare(lessonKey(b)))
  const parts = sorted.map(l => {
    const lk = lessonKey(l)
    const kind = kinds[lk] ?? 'consolidate'
    return `${lk}:${kind}:${quotas[lk] ?? 3}`
  })
  return `${weekStart}|${parts.join('|')}`
}

export function getWeekEnd(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const end = new Date(y, m - 1, d + 6)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
}

export function loadCachedLessons(): { unit: string; lesson: string }[] {
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

export function saveCachedLessons(lessons: { unit: string; lesson: string }[]): void {
  if (typeof window === 'undefined') return
  try {
    const slim = lessons.map(l => ({ unit: l.unit, lesson: l.lesson }))
    window.localStorage.setItem(STORAGE_KEYS.WEEKLY_PLAN_LAST_LESSONS, JSON.stringify(slim))
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.) — silently skip.
  }
}

export function loadCachedStages(): string[] {
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

export function saveCachedStages(stages: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEYS.WEEKLY_PLAN_LAST_STAGES, JSON.stringify(stages))
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.) — silently skip.
  }
}

export function daysUntilExpiry(weekStart: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = weekStart.split('-').map(Number)
  const expiry = new Date(y, m - 1, d + 6)
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000)
}

// Small number picker used for per-lesson quota
export function QuotaPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
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
