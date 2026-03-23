# Plan Params In Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store `weekStartDay`, `newWordsPerDay`, and `problemsPerDay` inside each weekly plan rather than in localStorage, so params persist in Supabase and default to the previous plan's values when generating a new one. Plan generation shows a modal dialog with pre-filled params the user can adjust before confirming.

**Architecture:** Add two new integer columns to each Supabase plan table, update both hooks to load `defaultParams` from the most recent prior plan (async, before computing `currentWeekStart`), update both components to initialize local param state from `defaultParams` and embed params when saving a plan, replace the existing setup full-page rendering with a modal dialog overlay, and remove the 4 now-unused localStorage keys from `STORAGE_KEYS`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase (`@supabase/supabase-js`), pnpm. No test suite — verification is `pnpm build`.

---

### Task 1: Supabase schema migration

**Files:**
- No source files — SQL run directly in Supabase dashboard

The new columns must exist before the app tries to read or write them.

- [ ] **Step 1: Run migration SQL in Supabase dashboard**

Open the Supabase project → SQL Editor → run:

```sql
ALTER TABLE weekly_plans
  ADD COLUMN IF NOT EXISTS week_start_day integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS new_words_per_day integer DEFAULT 3;

ALTER TABLE math_weekly_plans
  ADD COLUMN IF NOT EXISTS week_start_day integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS problems_per_day integer DEFAULT 3;
```

In PostgreSQL, `ALTER TABLE ADD COLUMN ... DEFAULT x` sets the default on all existing rows immediately (since PG 11). Existing rows will have `4` and `3` — no data migration needed. The `?? 4` / `?? 3` fallbacks in the code are harmless safety nets for any edge case.

- [ ] **Step 2: Verify columns exist**

In Supabase dashboard → Table Editor → confirm `weekly_plans` has `week_start_day` and `new_words_per_day`, and `math_weekly_plans` has `week_start_day` and `problems_per_day`.

---

### Task 2: Update type definitions

**Files:**
- Modify: `src/utils/type.ts`

Add two fields to each plan interface. These are non-optional — existing plans loaded from Supabase will have them coerced from `null` to defaults in the hook (Task 3/4).

- [ ] **Step 1: Add fields to `WeeklyPlan`**

In `src/utils/type.ts`, find the `WeeklyPlan` interface and add two fields:

```ts
export interface WeeklyPlan {
  weekStart: string
  unit: string
  lesson: string
  weekStartDay: number      // NEW: 0–6, 4 = Thursday
  newWordsPerDay: number    // NEW: default 3
  days: WeeklyPlanDay[]
  progress: Record<string, WeekDayProgress>
}
```

- [ ] **Step 2: Add fields to `MathWeeklyPlan`**

```ts
export interface MathWeeklyPlan {
  weekStart: string
  lessonId: string
  weekStartDay: number      // NEW: 0–6, 4 = Thursday
  problemsPerDay: number    // NEW: default 3
  days: MathWeeklyPlanDay[]
  progress: Record<string, MathDayProgress>
}
```

- [ ] **Step 3: Verify build catches usages**

```bash
cd /Users/meinuo/workspace/outer/rosie && pnpm build 2>&1 | grep "error TS" | head -20
```

Expected: TypeScript errors about `WeeklyPlan` and `MathWeeklyPlan` missing the new fields — these will be fixed in Tasks 3–6.

- [ ] **Step 4: Commit**

```bash
git add src/utils/type.ts
git commit -m "feat: add weekStartDay and newWordsPerDay/problemsPerDay to plan types"
```

---

### Task 3: Rewrite `useWeeklyPlan.ts`

**Files:**
- Modify: `src/hooks/useWeeklyPlan.ts`

Key changes:
- Remove `loadWeekStartDay()` localStorage helper and `saveWeekStartDay` function
- Add `loadMostRecentPlan` to get `defaultParams` from Supabase
- Load sequence: load `defaultParams` first → compute `currentWeekStart` → load current plan
- Update `loadFromCloud` and `saveToCloud` to include the new columns
- Expose `defaultParams` (type `{ weekStartDay: number; newWordsPerDay: number } | null`) — `null` while loading

Note: `currentWeekStart` is now `string | null` — it's `null` until `defaultParams` resolves. All callers must handle this.

- [ ] **Step 1: Rewrite the file**

Full new content for `src/hooks/useWeeklyPlan.ts`:

```ts
'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getWeekStart } from '@/utils/english-helpers'
import type { WeeklyPlan, WeekDayProgress } from '@/utils/type'

const SYSTEM_DEFAULTS = { weekStartDay: 4, newWordsPerDay: 3 }

async function loadMostRecentPlan(userId: string, beforeWeekStart: string): Promise<{ weekStartDay: number; newWordsPerDay: number } | null> {
  try {
    const { data } = await supabase
      .from('weekly_plans')
      .select('week_start_day, new_words_per_day')
      .eq('user_id', userId)
      .lt('week_start', beforeWeekStart)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return {
      weekStartDay: data.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
      newWordsPerDay: data.new_words_per_day ?? SYSTEM_DEFAULTS.newWordsPerDay,
    }
  } catch {
    return null
  }
}

async function loadFromCloud(userId: string, weekStart: string): Promise<WeeklyPlan | null> {
  try {
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('unit, lesson, week_start_day, new_words_per_day, plan_data, progress_data')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .single()
    if (error || !data) return null
    return {
      weekStart,
      unit: data.unit,
      lesson: data.lesson,
      weekStartDay: data.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
      newWordsPerDay: data.new_words_per_day ?? SYSTEM_DEFAULTS.newWordsPerDay,
      days: data.plan_data as WeeklyPlan['days'],
      progress: (data.progress_data as WeeklyPlan['progress']) ?? {},
    }
  } catch {
    return null
  }
}

async function saveToCloud(userId: string, plan: WeeklyPlan): Promise<void> {
  try {
    await supabase
      .from('weekly_plans')
      .upsert(
        {
          user_id: userId,
          week_start: plan.weekStart,
          unit: plan.unit,
          lesson: plan.lesson,
          week_start_day: plan.weekStartDay,
          new_words_per_day: plan.newWordsPerDay,
          plan_data: plan.days,
          progress_data: plan.progress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' },
      )
  } catch { /* ignore */ }
}

export function useWeeklyPlan(user: User | null) {
  const [defaultParams, setDefaultParams] = useState<{ weekStartDay: number; newWordsPerDay: number } | null>(null)
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Step 1: load defaultParams (most recent prior plan's params, or system defaults)
  // Use a far-future date so we include all existing plans (including the current week's if any)
  useEffect(() => {
    if (!user) { setIsLoading(false); return }
    const farFuture = '9999-12-31'
    void loadMostRecentPlan(user.id, farFuture).then(params => {
      setDefaultParams(params ?? SYSTEM_DEFAULTS)
    })
  }, [user])

  // Step 2: currentWeekStart derives from defaultParams.weekStartDay (null until defaultParams loads)
  const currentWeekStart = useMemo(() => {
    if (!defaultParams) return null
    return getWeekStart(undefined, defaultParams.weekStartDay)
  }, [defaultParams])

  // Step 3: load current plan once currentWeekStart is known
  useEffect(() => {
    if (!user || !currentWeekStart) return
    void (async () => {
      setIsLoading(true)
      const cloud = await loadFromCloud(user.id, currentWeekStart)
      setWeeklyPlan(cloud)
      setIsLoading(false)
    })()
  }, [user, currentWeekStart])

  const savePlan = useCallback(async (plan: WeeklyPlan) => {
    setWeeklyPlan(plan)
    if (user) await saveToCloud(user.id, plan)
  }, [user])

  const updateDayProgress = useCallback(async (date: string, progress: WeekDayProgress) => {
    setWeeklyPlan(prev => {
      if (!prev) return prev
      const updated: WeeklyPlan = {
        ...prev,
        progress: { ...prev.progress, [date]: progress },
      }
      if (user) void saveToCloud(user.id, updated)
      return updated
    })
  }, [user])

  return {
    weeklyPlan,
    previousPlan: null,
    currentWeekStart,
    defaultParams,
    savePlan,
    updateDayProgress,
    isLoading,
  }
}
```

- [ ] **Step 2: Search for all other callers of `useWeeklyPlan` and fix `string | null` usage**

```bash
grep -r "useWeeklyPlan\|currentWeekStart" /Users/meinuo/workspace/outer/rosie/src --include="*.ts" --include="*.tsx" -l
```

For each file (other than `WeeklyPractice.tsx` which is fixed in Task 5): check if `currentWeekStart` is passed to a function expecting `string`. If so, add a null guard or pass a fallback.

- [ ] **Step 3: Verify build**

```bash
cd /Users/meinuo/workspace/outer/rosie && pnpm build 2>&1 | grep "useWeeklyPlan\|error TS" | head -20
```

Expected: errors about callers using the removed `weekStartDay` / `saveWeekStartDay` — fixed in Task 5. No errors in the hook file itself.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWeeklyPlan.ts
git commit -m "feat: useWeeklyPlan loads defaultParams from Supabase, removes localStorage"
```

---

### Task 4: Rewrite `useMathWeeklyPlan.ts`

**Files:**
- Modify: `src/hooks/useMathWeeklyPlan.ts`

Key changes:
- Remove `loadWeekStartDay()`, `loadProblemsPerDay()` localStorage helpers and their savers
- Update `loadAllPriorPlans` to also select `week_start_day` and `problems_per_day`
- Update `loadFromCloud` and `saveToCloud` to include the new columns
- Derive `defaultParams` from priorPlans (most recent by weekStart)
- Expose `defaultParams`; remove `weekStartDay`, `problemsPerDay`, `saveWeekStartDay`, `saveProblemsPerDay` from return
- Bootstrap `currentWeekStart` using a literal string `'rosie-math-week-start-day'` (not `STORAGE_KEYS` — key is removed in Task 7)

- [ ] **Step 1: Rewrite the file**

Full new content for `src/hooks/useMathWeeklyPlan.ts`:

```ts
'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getWeekStart } from '@/utils/english-helpers'
import type { MathWeeklyPlan, MathDayProgress } from '@/utils/type'

const SYSTEM_DEFAULTS = { weekStartDay: 4, problemsPerDay: 3 }

async function loadFromCloud(userId: string, weekStart: string): Promise<MathWeeklyPlan | null> {
  try {
    const { data, error } = await supabase
      .from('math_weekly_plans')
      .select('lesson_id, week_start_day, problems_per_day, plan_data, progress_data')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .single()
    if (error || !data) return null
    return {
      weekStart,
      lessonId: data.lesson_id,
      weekStartDay: data.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
      problemsPerDay: data.problems_per_day ?? SYSTEM_DEFAULTS.problemsPerDay,
      days: data.plan_data as MathWeeklyPlan['days'],
      progress: (data.progress_data as MathWeeklyPlan['progress']) ?? {},
    }
  } catch {
    return null
  }
}

async function saveToCloud(userId: string, plan: MathWeeklyPlan): Promise<void> {
  try {
    await supabase
      .from('math_weekly_plans')
      .upsert(
        {
          user_id: userId,
          week_start: plan.weekStart,
          lesson_id: plan.lessonId,
          week_start_day: plan.weekStartDay,
          problems_per_day: plan.problemsPerDay,
          plan_data: plan.days,
          progress_data: plan.progress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' },
      )
  } catch { /* ignore */ }
}

async function loadAllPriorPlans(userId: string, currentWeekStart: string): Promise<MathWeeklyPlan[]> {
  try {
    const { data } = await supabase
      .from('math_weekly_plans')
      .select('lesson_id, week_start_day, problems_per_day, plan_data, progress_data, week_start')
      .eq('user_id', userId)
      .neq('week_start', currentWeekStart)
    if (data) {
      return data.map(row => ({
        weekStart: row.week_start,
        lessonId: row.lesson_id,
        weekStartDay: row.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
        problemsPerDay: row.problems_per_day ?? SYSTEM_DEFAULTS.problemsPerDay,
        days: row.plan_data as MathWeeklyPlan['days'],
        progress: (row.progress_data as MathWeeklyPlan['progress']) ?? {},
      }))
    }
  } catch { /* ignore */ }
  return []
}

export function useMathWeeklyPlan(user: User | null) {
  const [weeklyPlan, setWeeklyPlan] = useState<MathWeeklyPlan | null>(null)
  const [priorPlans, setPriorPlans] = useState<MathWeeklyPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // defaultParams derived from most recent prior plan (sorted by weekStart desc)
  const defaultParams = useMemo((): { weekStartDay: number; problemsPerDay: number } => {
    if (priorPlans.length === 0) return SYSTEM_DEFAULTS
    const sorted = [...priorPlans].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    const recent = sorted[0]
    return {
      weekStartDay: recent.weekStartDay,
      problemsPerDay: recent.problemsPerDay,
    }
  }, [priorPlans])

  // Bootstrap currentWeekStart from a localStorage pref (UI-only, not plan data).
  // This key is cleaned up in Task 7; we use the literal string here since STORAGE_KEYS
  // will no longer contain it after Task 7.
  const [bootstrapWeekStartDay] = useState(() => {
    try {
      const v = window.localStorage.getItem('rosie-math-week-start-day')
      return v !== null ? Number(v) : 4
    } catch { return 4 }
  })

  const currentWeekStart = useMemo(() => {
    return getWeekStart(undefined, bootstrapWeekStartDay)
  }, [bootstrapWeekStartDay])

  useEffect(() => {
    if (!user) return
    const init = async () => {
      setIsLoading(true)
      const [cloud, prior] = await Promise.all([
        loadFromCloud(user.id, currentWeekStart),
        loadAllPriorPlans(user.id, currentWeekStart),
      ])
      setWeeklyPlan(cloud)
      setPriorPlans(prior)
      setIsLoading(false)
    }
    void init()
  }, [user, currentWeekStart])

  const savePlan = useCallback(async (plan: MathWeeklyPlan) => {
    setWeeklyPlan(plan)
    if (user) await saveToCloud(user.id, plan)
  }, [user])

  const addDoneKey = useCallback(async (date: string, key: string) => {
    setWeeklyPlan(prev => {
      if (!prev) return prev
      const existing = prev.progress[date] ?? { doneKeys: [] }
      if (existing.doneKeys.includes(key)) return prev
      const today = new Date().toISOString()
      const dayPlan = prev.days.find(d => d.date === date)
      const newDoneKeys = [...existing.doneKeys, key]
      const allRequired = dayPlan?.problems.map(p => p.key) ?? []
      const allDone = allRequired.every(k => newDoneKeys.includes(k))
      const updated: MathWeeklyPlan = {
        ...prev,
        progress: {
          ...prev.progress,
          [date]: {
            doneKeys: newDoneKeys,
            completedAt: allDone ? (existing.completedAt ?? today) : existing.completedAt,
          },
        },
      }
      if (user) void saveToCloud(user.id, updated)
      return updated
    })
  }, [user])

  const updateDayProgress = useCallback(async (date: string, progress: MathDayProgress) => {
    setWeeklyPlan(prev => {
      if (!prev) return prev
      const updated: MathWeeklyPlan = {
        ...prev,
        progress: { ...prev.progress, [date]: progress },
      }
      if (user) void saveToCloud(user.id, updated)
      return updated
    })
  }, [user])

  const allPriorKeys: string[] = useMemo(() => priorPlans.flatMap(plan =>
    plan.days.flatMap(day => [...day.problems, ...day.optionalProblems].map(p => p.key))
  ), [priorPlans])

  const priorProblemMap = useMemo(() => Object.fromEntries(
    priorPlans.flatMap(plan =>
      plan.days.flatMap(day =>
        [...day.problems, ...day.optionalProblems].map(p => [p.key, p])
      )
    )
  ), [priorPlans])

  return {
    weeklyPlan, priorPlans, allPriorKeys, priorProblemMap,
    currentWeekStart, defaultParams,
    savePlan, addDoneKey, updateDayProgress,
    isLoading,
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/meinuo/workspace/outer/rosie && pnpm build 2>&1 | grep "useMathWeeklyPlan\|error TS" | head -20
```

Expected: errors about callers using the removed `saveWeekStartDay` / `saveProblemsPerDay` / `weekStartDay` / `problemsPerDay` — fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMathWeeklyPlan.ts
git commit -m "feat: useMathWeeklyPlan loads defaultParams from priorPlans, removes localStorage"
```

---

### Task 5: Update `WeeklyPractice.tsx`

**Files:**
- Modify: `src/components/english/words/WeeklyPractice.tsx`

Key changes:
- Remove `STORAGE_KEYS` import (after removing all usages)
- Change `newPerDay` state init: localStorage → `3` (synced from `defaultParams` via `useEffect`)
- Add local `weekStartDay` state initialized to `4`, synced from `defaultParams`
- Remove the localStorage write in the "每天新词数量" onClick handler
- Replace `saveWeekStartDay(opt.value)` with `setWeekStartDay(opt.value)` (local state)
- Add `showParamsDialog` state; replace `showSetup` throughout
- Convert setup section from full-page rendering to modal overlay dialog
- Auto-open dialog when no plan exists and `defaultParams` is ready
- Update `handleConfirmLesson` to embed `weekStartDay`/`newWordsPerDay` in plan and close dialog
- Fix `fmtWeekRange` in week-view header to use `weeklyPlan.weekStartDay` (the stored plan param)
- Handle `currentWeekStart` being `null` while loading

- [ ] **Step 1: Read the current file**

```bash
# Read src/components/english/words/WeeklyPractice.tsx before making any edits
```

- [ ] **Step 2: Update hook destructuring**

```ts
// Before (line ~67):
const { weeklyPlan, currentWeekStart, weekStartDay, saveWeekStartDay, savePlan, updateDayProgress, isLoading } = useWeeklyPlan(user)

// After:
const { weeklyPlan, currentWeekStart, defaultParams, savePlan, updateDayProgress, isLoading } = useWeeklyPlan(user)
```

- [ ] **Step 3: Replace `newPerDay` localStorage init; add local `weekStartDay` state**

```ts
// Remove:
const [newPerDay, setNewPerDay] = useState<number>(() => {
  try { const v = localStorage.getItem(STORAGE_KEYS.WEEKLY_NEW_PER_DAY); return v ? Number(v) : 3 } catch { return 3 }
})

// Add (simple initial values, synced from defaultParams below):
const [newPerDay, setNewPerDay] = useState<number>(3)
const [weekStartDay, setWeekStartDay] = useState<number>(4)

// Add this useEffect (after the existing immersive useEffect):
useEffect(() => {
  if (defaultParams) {
    setNewPerDay(defaultParams.newWordsPerDay)
    setWeekStartDay(defaultParams.weekStartDay)
  }
}, [defaultParams])
```

- [ ] **Step 4: Add `showParamsDialog` state and auto-open effect**

```ts
const [showParamsDialog, setShowParamsDialog] = useState(false)

// Auto-open dialog when no plan exists and defaults are ready
useEffect(() => {
  if (!isLoading && !weeklyPlan && defaultParams) setShowParamsDialog(true)
}, [isLoading, weeklyPlan, defaultParams])
```

- [ ] **Step 5: Remove localStorage write from "每天新词数量" onClick**

```ts
// Before:
onClick={() => { setNewPerDay(n); try { localStorage.setItem(STORAGE_KEYS.WEEKLY_NEW_PER_DAY, String(n)) } catch { /**/ } }}

// After:
onClick={() => setNewPerDay(n)}
```

- [ ] **Step 6: Replace `saveWeekStartDay` call with `setWeekStartDay`**

```ts
// Before:
onClick={() => saveWeekStartDay(opt.value)}

// After:
onClick={() => setWeekStartDay(opt.value)}
```

- [ ] **Step 7: Update `handleConfirmLesson` to embed params and close dialog**

```ts
const handleConfirmLesson = useCallback(async () => {
  if (!activeLesson || !currentWeekStart) return
  const plan: WeeklyPlan = {
    weekStart: currentWeekStart,
    unit: activeLesson.unit,
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
```

- [ ] **Step 8: Replace `showSetup` with `showParamsDialog` throughout; convert setup section to modal dialog**

Replace the `showSetup` state declaration:
```ts
// Remove:
const [showSetup, setShowSetup] = useState(false)

// Add (already done in Step 4):
// showParamsDialog serves the same role
```

Update `effectivePhase` memo — replace `showSetup` with `showParamsDialog`:
```ts
const effectivePhase = useMemo(() => {
  if (!showParamsDialog && phase === 'setup' && weeklyPlan && !isLoading) return 'week-view'
  return phase
}, [phase, weeklyPlan, isLoading, showParamsDialog])
```

Replace the setup section early return. Instead of:
```tsx
if (effectivePhase === 'setup') {
  return (
    <div className="max-w-[560px] mx-auto px-4 py-10">
      <div className="bg-[var(--wm-surface)] border border-[var(--wm-border)] rounded-[20px] p-7">
        ...
      </div>
    </div>
  )
}
```

Write:
```tsx
if (showParamsDialog) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div className="max-w-[560px] mx-auto px-4 py-10">
        <div className="bg-[var(--wm-surface)] border border-[var(--wm-border)] rounded-[20px] p-7">
          {/* Keep ALL existing setup content unchanged: title, week range, lesson picker,
              newPerDay selector, weekStartDay selector, confirm button */}
          {/* Only changes needed inside:
              1. week range display: guard currentWeekStart null:
                   {currentWeekStart && fmtWeekRange(currentWeekStart, weekStartDay)}
              2. confirm button ("开始 {...}") already calls handleConfirmLesson — no change needed
              3. Add cancel button after the existing buttons (only when weeklyPlan exists): */}
          {weeklyPlan && (
            <button
              onClick={() => setShowParamsDialog(false)}
              className="mt-3 w-full text-center text-[.78rem] text-[var(--wm-text-dim)] hover:text-[var(--wm-text)] cursor-pointer py-2"
            >
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Update "换课" button in week-view**

```tsx
// Before:
onClick={() => { setPendingLessons([]); setShowSetup(true); setPhase('setup') }}

// After:
onClick={() => { setPendingLessons([]); setShowParamsDialog(true) }}
```

- [ ] **Step 10: Fix `fmtWeekRange` in week-view header to use plan's stored weekStartDay**

In the week-view header (currently around line 346), `fmtWeekRange` is called with the local `weekStartDay` state. This is wrong — when displaying an existing plan, use the plan's own stored `weekStartDay`:

```tsx
// Before:
{fmtWeekRange(currentWeekStart, weekStartDay)}

// After:
{fmtWeekRange(weeklyPlan.weekStart, weeklyPlan.weekStartDay)}
```

Note: `weeklyPlan` is guaranteed non-null inside the `effectivePhase === 'week-view' && weeklyPlan` block, so no null guard needed here.

- [ ] **Step 11: Remove `STORAGE_KEYS` import**

```ts
// Remove this line entirely:
import { STORAGE_KEYS } from '@/utils/constant'
```

- [ ] **Step 12: Verify build**

```bash
cd /Users/meinuo/workspace/outer/rosie && pnpm build 2>&1 | grep "WeeklyPractice\|error TS" | head -20
```

Expected: no errors in this file.

- [ ] **Step 13: Commit**

```bash
git add src/components/english/words/WeeklyPractice.tsx
git commit -m "feat: WeeklyPractice uses modal dialog for plan params, stores params in plan"
```

---

### Task 6: Update `MathWeeklyPractice.tsx`

**Files:**
- Modify: `src/components/math/MathWeeklyPractice.tsx`

Key changes:
- Remove `weekStartDay`, `problemsPerDay`, `saveWeekStartDay`, `saveProblemsPerDay` from hook destructuring
- Add local `weekStartDay` and `problemsPerDay` state, initialized from `defaultParams` via `useEffect`
- Add `showParamsDialog` state; replace `showSetup` throughout
- Convert setup section from full-page rendering to modal overlay dialog
- Auto-open dialog when no plan exists and `defaultParams` is ready
- Replace all `saveWeekStartDay(x)` calls with `setWeekStartDay(x)`
- Replace all `saveProblemsPerDay(x)` calls with `setProblemsPerDay(x)`
- Embed params in plan when calling `savePlan` in `handleCreatePlan`; close dialog
- Fix `fmtWeekRange` in week-view header to use `weeklyPlan.weekStartDay` (stored param)
- Guard `currentWeekStart` null in auto-switch effect

- [ ] **Step 1: Read the current file**

```bash
# Read src/components/math/MathWeeklyPractice.tsx before making any edits
```

- [ ] **Step 2: Update hook destructuring**

```ts
// Before:
const {
  weeklyPlan, allPriorKeys, priorProblemMap, currentWeekStart,
  weekStartDay, problemsPerDay,
  savePlan, addDoneKey, saveWeekStartDay, saveProblemsPerDay,
  isLoading,
} = useMathWeeklyPlan(user)

// After:
const {
  weeklyPlan, allPriorKeys, priorProblemMap, currentWeekStart,
  defaultParams,
  savePlan, addDoneKey,
  isLoading,
} = useMathWeeklyPlan(user)
```

- [ ] **Step 3: Add local param state with defaultParams sync**

```ts
const [weekStartDay, setWeekStartDay] = useState<number>(4)
const [problemsPerDay, setProblemsPerDay] = useState<number>(3)

useEffect(() => {
  if (defaultParams) {
    setWeekStartDay(defaultParams.weekStartDay)
    setProblemsPerDay(defaultParams.problemsPerDay)
  }
}, [defaultParams])
```

- [ ] **Step 4: Add `showParamsDialog` state and auto-open effect**

```ts
const [showParamsDialog, setShowParamsDialog] = useState(false)

// Auto-open dialog when no plan exists and defaults are ready
useEffect(() => {
  if (!isLoading && !weeklyPlan && defaultParams) setShowParamsDialog(true)
}, [isLoading, weeklyPlan, defaultParams])
```

- [ ] **Step 5: Update auto-switch effect to guard `currentWeekStart` null**

```ts
// Before:
if (!isLoading && weeklyPlan && weeklyPlan.weekStart === currentWeekStart && !showSetup) {

// After:
if (!isLoading && weeklyPlan && currentWeekStart && weeklyPlan.weekStart === currentWeekStart && !showParamsDialog) {
```

Also update deps array to replace `showSetup` with `showParamsDialog`.

- [ ] **Step 6: Update `handleCreatePlan` to embed params and close dialog**

```ts
const handleCreatePlan = useCallback(async () => {
  if (!currentWeekStart) return
  const ps = problemSets[selectedLesson]
  if (!ps) return
  const plan: MathWeeklyPlan = {
    weekStart: currentWeekStart,
    lessonId: selectedLesson,
    weekStartDay,
    problemsPerDay,
    days: buildMathWeeklyPlan(selectedLesson, ps, currentWeekStart, problemsPerDay),
    progress: {},
  }
  await savePlan(plan)
  setShowParamsDialog(false)
  setPhase('week-view')
  setSelectedDate(today)
}, [problemSets, selectedLesson, currentWeekStart, problemsPerDay, weekStartDay, savePlan, today])
```

- [ ] **Step 7: Replace `saveProblemsPerDay` and `saveWeekStartDay` calls with setters**

```ts
// Before:
onClick={() => saveProblemsPerDay(n)}
// After:
onClick={() => setProblemsPerDay(n)}

// Before:
onClick={() => saveWeekStartDay(opt.value)}
// After:
onClick={() => setWeekStartDay(opt.value)}
```

- [ ] **Step 8: Replace `showSetup` with `showParamsDialog`; convert setup to modal dialog**

Remove `showSetup` state. Replace the setup section:

```tsx
// Before:
if (phase === 'setup' || showSetup) {
  return (
    <>
      <div className="mx-auto max-w-[520px] px-4 py-8">
        ...
      </div>
    </>
  )
}

// After:
if (showParamsDialog) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div className="mx-auto max-w-[520px] px-4 py-8">
        {/* Keep ALL existing setup content unchanged: lesson selector, preview card,
            problemsPerDay picker, weekStartDay picker, CTA button */}
        {/* Only changes needed inside:
            1. week range display on line ~209: guard currentWeekStart:
                 {currentWeekStart && fmtWeekRange(currentWeekStart, weekStartDay)}
            2. CTA button ("出发冒险！") already calls handleCreatePlan — no change
            3. Cancel button: already exists when weeklyPlan is truthy — update its onClick:
                 onClick={() => setShowParamsDialog(false)}
                 (remove the old: setShowSetup(false); setPhase('week-view')) */}
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Update "换课 ✏️" button in week-view**

```tsx
// Before:
onClick={() => { setShowSetup(true); setPhase('setup') }}

// After:
onClick={() => setShowParamsDialog(true)}
```

- [ ] **Step 10: Fix `fmtWeekRange` in week-view header to use plan's stored weekStartDay**

In the week-view header (around line 393), `fmtWeekRange` uses the local `weekStartDay` state. When displaying an existing plan, use the plan's own stored value:

```tsx
// Before:
{fmtWeekRange(weeklyPlan.weekStart, weekStartDay)}

// After:
{fmtWeekRange(weeklyPlan.weekStart, weeklyPlan.weekStartDay)}
```

- [ ] **Step 11: Verify build**

```bash
cd /Users/meinuo/workspace/outer/rosie && pnpm build 2>&1 | grep "MathWeeklyPractice\|error TS" | head -20
```

Expected: no errors in this file.

- [ ] **Step 12: Commit**

```bash
git add src/components/math/MathWeeklyPractice.tsx
git commit -m "feat: MathWeeklyPractice uses modal dialog for plan params, stores params in plan"
```

---

### Task 7: Clean up `constant.ts` and `CLAUDE.md`

**Files:**
- Modify: `src/utils/constant.ts`
- Modify: `CLAUDE.md`

Remove the 4 now-unused localStorage keys. After this task, `STORAGE_KEYS` contains only `MATH_SIDEBAR_COLLAPSED`.

- [ ] **Step 1: Read `src/utils/constant.ts`**

Verify current content before editing.

- [ ] **Step 2: Remove the 4 keys from `STORAGE_KEYS`**

```ts
// Before:
export const STORAGE_KEYS = {
  MATH_SIDEBAR_COLLAPSED: 'math-sidebar-collapsed',
  WEEK_START_DAY: 'rosie-week-start-day',
  WEEKLY_NEW_PER_DAY: 'rosie-weekly-new-per-day',
  MATH_WEEK_START_DAY: 'rosie-math-week-start-day',
  MATH_WEEKLY_PROBLEMS_PER_DAY: 'rosie-math-weekly-problems-per-day',
} as const

// After:
export const STORAGE_KEYS = {
  MATH_SIDEBAR_COLLAPSED: 'math-sidebar-collapsed',
} as const
```

- [ ] **Step 3: Verify no remaining usages of removed keys**

```bash
grep -r "WEEK_START_DAY\|WEEKLY_NEW_PER_DAY\|MATH_WEEKLY_PROBLEMS_PER_DAY\|MATH_WEEK_START_DAY" /Users/meinuo/workspace/outer/rosie/src --include="*.ts" --include="*.tsx"
```

Expected: zero results. (Task 4 already uses the literal string `'rosie-math-week-start-day'` directly, not via `STORAGE_KEYS`.)

- [ ] **Step 4: Update `CLAUDE.md`**

In `CLAUDE.md`, update two places:

**Data Flow section** — update the localStorage note:
```markdown
`localStorage` is used only for UI preferences — never for user data. The only remaining key is `MATH_SIDEBAR_COLLAPSED` (sidebar collapse state) in `STORAGE_KEYS`. All other user configuration (including plan generation parameters) is stored in Supabase.
```

**Weekly Planning System section** — add a note about params:
```markdown
- `WeeklyPlan` / `MathWeeklyPlan` — stored in Supabase (`weekly_plans` / `math_weekly_plans` tables); each plan includes `weekStartDay` and `newWordsPerDay`/`problemsPerDay` as dedicated integer columns
```

- [ ] **Step 5: Full build verification**

```bash
cd /Users/meinuo/workspace/outer/rosie && pnpm build 2>&1
```

Expected: clean build with no TypeScript errors.

- [ ] **Step 6: Check all localStorage references**

```bash
grep -r "localStorage" /Users/meinuo/workspace/outer/rosie/src --include="*.ts" --include="*.tsx" -n
```

Expected: only `MATH_SIDEBAR_COLLAPSED` (via `useLocalStorage.ts` or similar) and the bootstrap literal string in `useMathWeeklyPlan.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/utils/constant.ts CLAUDE.md
git commit -m "refactor: remove last 4 localStorage keys; STORAGE_KEYS now has only MATH_SIDEBAR_COLLAPSED"
```
