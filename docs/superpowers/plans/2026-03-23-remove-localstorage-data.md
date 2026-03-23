# Remove localStorage Data Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all localStorage usage for data storage, keeping only UI preference keys, since the app always requires login and Supabase is the single source of truth.

**Architecture:** Every data hook currently has a dual guest/auth path; we eliminate the guest path entirely. Hooks become Supabase-only. UI preference keys (`MATH_SIDEBAR_COLLAPSED`, `WEEK_START_DAY`, `MATH_WEEK_START_DAY`, `WEEKLY_NEW_PER_DAY`, `MATH_WEEKLY_PROBLEMS_PER_DAY`) stay in localStorage since they don't need cloud sync.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase (`@supabase/supabase-js`), pnpm

> **Note:** This project has no test suite. Verification is done by running `pnpm build` (TypeScript compilation) and manual smoke-testing in the browser.

---

### Task 1: Clean up `STORAGE_KEYS` in `src/utils/constant.ts`

**Files:**
- Modify: `src/utils/constant.ts`

Remove the data keys that will no longer be used. Keep only UI preference keys.

- [ ] **Step 1: Edit `STORAGE_KEYS`**

Replace the `STORAGE_KEYS` object so it contains only:

```ts
export const STORAGE_KEYS = {
  MATH_SIDEBAR_COLLAPSED: 'math-sidebar-collapsed',
  WEEK_START_DAY: 'rosie-week-start-day',
  WEEKLY_NEW_PER_DAY: 'rosie-weekly-new-per-day',
  MATH_WEEK_START_DAY: 'rosie-math-week-start-day',
  MATH_WEEKLY_PROBLEMS_PER_DAY: 'rosie-math-weekly-problems-per-day',
} as const
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | head -40
```

Expected: errors about removed keys being referenced elsewhere — that's fine, those will be fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/utils/constant.ts
git commit -m "refactor: remove data storage keys from STORAGE_KEYS"
```

---

### Task 2: Simplify `src/hooks/useMathSolved.ts`

**Files:**
- Modify: `src/hooks/useMathSolved.ts`

Remove `loadLocal`, `saveLocal`, guest path in `useEffect`, and localStorage fallback in `handleSolve`.

- [ ] **Step 1: Rewrite the file**

```ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useMathSolved(user: User | null) {
  const [solveCount, setSolveCount] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!user) return
    supabase
      .from('math_solved')
      .select('problem_id, solve_count')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const record: Record<string, number> = {}
          data.forEach(row => { record[row.problem_id] = row.solve_count ?? 1 })
          setSolveCount(record)
        }
      })
  }, [user])

  const handleSolve = useCallback(async (id: string): Promise<number> => {
    if (!user) return 0

    const { data, error } = await supabase.rpc('increment_math_solved', {
      p_user_id: user.id,
      p_prob_id: id,
    })

    if (!error && typeof data === 'number') {
      setSolveCount(prev => ({ ...prev, [id]: data }))
      return data
    }

    // Optimistic fallback if RPC fails
    const newCount = (solveCount[id] ?? 0) + 1
    setSolveCount(prev => ({ ...prev, [id]: newCount }))
    return newCount
  }, [user, solveCount])

  return { solveCount, handleSolve }
}
```

- [ ] **Step 2: Verify**

```bash
pnpm build 2>&1 | grep "useMathSolved"
```

Expected: no errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMathSolved.ts
git commit -m "refactor: remove localStorage from useMathSolved"
```

---

### Task 3: Simplify `src/hooks/useWordData.ts`

**Files:**
- Modify: `src/hooks/useWordData.ts`

Remove `loadLocal`, `saveLocal`, and guest path. When logged in with no cloud data, fall back to `SAMPLE_WORDS`.

- [ ] **Step 1: Rewrite the file**

```ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { WordEntry } from '@/utils/type'
import { SAMPLE_WORDS } from '@/utils/english-data'

export function useWordData(user: User | null) {
  const [vocab, setVocabState] = useState<WordEntry[]>(SAMPLE_WORDS)

  useEffect(() => {
    if (!user) return
    supabase
      .from('word_entries')
      .select('unit, lesson, word, explanation, ipa, example, phonics')
      .eq('user_id', user.id)
      .order('unit')
      .order('lesson')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setVocabState(data.map(row => ({
            unit: row.unit,
            lesson: row.lesson,
            word: row.word,
            explanation: row.explanation,
            ipa: row.ipa ?? undefined,
            example: row.example ?? undefined,
            phonics: row.phonics ?? undefined,
          })))
        } else {
          setVocabState(SAMPLE_WORDS)
        }
      })
  }, [user])

  const setVocab = useCallback(async (words: WordEntry[]) => {
    setVocabState(words)
    if (!user) return
    await supabase.from('word_entries').delete().eq('user_id', user.id)
    if (words.length > 0) {
      await supabase.from('word_entries').insert(
        words.map(w => ({
          user_id: user.id,
          unit: w.unit,
          lesson: w.lesson,
          word: w.word,
          explanation: w.explanation,
          ipa: w.ipa ?? null,
          example: w.example ?? null,
          phonics: w.phonics ?? null,
        }))
      )
    }
  }, [user])

  return { vocab, setVocab }
}
```

- [ ] **Step 2: Verify**

```bash
pnpm build 2>&1 | grep "useWordData"
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWordData.ts
git commit -m "refactor: remove localStorage from useWordData"
```

---

### Task 4: Simplify `src/hooks/useWordMastery.ts`

**Files:**
- Modify: `src/hooks/useWordMastery.ts`

Remove `loadLocal`, `saveLocal`, guest/fallback paths.

- [ ] **Step 1: Rewrite the file**

```ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getMasteryLevel, advanceStage, regressStage } from '@/utils/masteryUtils'
import { wordKey } from '@/utils/english-helpers'
import type { WordEntry, WordMasteryMap, WordMasteryInfo } from '@/utils/type'

export function useWordMastery(user: User | null) {
  const [masteryMap, setMasteryMap] = useState<WordMasteryMap>({})

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await supabase
        .from('word_mastery')
        .select('word_key, correct, incorrect, last_seen, stage, next_review_date, is_hard')
        .eq('user_id', user.id)
      if (!data) return
      const record: WordMasteryMap = {}
      data.forEach(row => {
        record[row.word_key] = {
          correct: row.correct ?? 0,
          incorrect: row.incorrect ?? 0,
          lastSeen: row.last_seen ?? '',
          stage: row.stage ?? undefined,
          nextReviewDate: row.next_review_date ?? undefined,
          isHard: row.is_hard ?? undefined,
        }
      })
      setMasteryMap(record)
    })()
  }, [user])

  const recordBatch = useCallback((results: { entry: WordEntry; correct: boolean }[]) => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    setMasteryMap(prev => {
      const next = { ...prev }
      for (const { entry, correct: isCorrect } of results) {
        const key = wordKey(entry)
        const cur = next[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
        const updated = isCorrect ? advanceStage(cur, today) : regressStage(cur, today)
        next[key] = {
          ...updated,
          correct: isCorrect ? cur.correct + 1 : cur.correct,
          incorrect: isCorrect ? cur.incorrect : cur.incorrect + 1,
          lastSeen: today,
        }
      }

      const rows = results.map(({ entry, correct: isCorrect }) => {
        const key = wordKey(entry)
        const updated = next[key]
        return {
          user_id: user.id,
          word_key: key,
          correct: updated.correct,
          incorrect: updated.incorrect,
          last_seen: today,
          stage: updated.stage,
          next_review_date: updated.nextReviewDate ?? null,
          is_hard: updated.isHard ?? false,
          updated_at: new Date().toISOString(),
        }
      })
      void supabase.from('word_mastery').upsert(rows, { onConflict: 'user_id,word_key' })

      return next
    })
  }, [user])

  const getMastery = useCallback((entry: WordEntry): WordMasteryInfo => {
    return masteryMap[wordKey(entry)] ?? { correct: 0, incorrect: 0, lastSeen: '' }
  }, [masteryMap])

  const isMastered = useCallback((entry: WordEntry): boolean => {
    return getMasteryLevel(getMastery(entry).correct) === 3
  }, [getMastery])

  return { masteryMap, recordBatch, getMastery, isMastered }
}
```

- [ ] **Step 2: Verify**

```bash
pnpm build 2>&1 | grep "useWordMastery"
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWordMastery.ts
git commit -m "refactor: remove localStorage from useWordMastery"
```

---

### Task 5: Simplify `src/hooks/useProblemMastery.ts`

**Files:**
- Modify: `src/hooks/useProblemMastery.ts`

Remove `loadLocal`, `saveLocal`, guest/fallback paths.

- [ ] **Step 1: Rewrite the file**

```ts
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { advanceStage, regressStage } from '@/utils/masteryUtils'
import type { ProblemMasteryMap, WordMasteryInfo } from '@/utils/type'

export function useProblemMastery(user: User | null) {
  const [masteryMap, setMasteryMap] = useState<ProblemMasteryMap>({})

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await supabase
        .from('problem_mastery')
        .select('problem_key, correct, incorrect, last_seen, stage, next_review_date, is_hard')
        .eq('user_id', user.id)
      if (!data) return
      const record: ProblemMasteryMap = {}
      data.forEach(row => {
        record[row.problem_key] = {
          correct: row.correct ?? 0,
          incorrect: row.incorrect ?? 0,
          lastSeen: row.last_seen ?? '',
          stage: row.stage ?? undefined,
          nextReviewDate: row.next_review_date ?? undefined,
          isHard: row.is_hard ?? undefined,
        }
      })
      setMasteryMap(record)
    })()
  }, [user])

  const masteryMapRef = useRef(masteryMap)
  useEffect(() => { masteryMapRef.current = masteryMap }, [masteryMap])

  const recordProblemResult = useCallback((key: string, correct: boolean) => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    const cur: WordMasteryInfo = masteryMapRef.current[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
    const updated = correct ? advanceStage(cur, today) : regressStage(cur, today)
    const info: WordMasteryInfo = {
      ...updated,
      correct: correct ? cur.correct + 1 : cur.correct,
      incorrect: correct ? cur.incorrect : cur.incorrect + 1,
      lastSeen: today,
    }

    setMasteryMap(prev => ({ ...prev, [key]: info }))

    supabase
      .from('problem_mastery')
      .upsert(
        {
          user_id: user.id,
          problem_key: key,
          correct: info.correct,
          incorrect: info.incorrect,
          last_seen: today,
          stage: info.stage,
          next_review_date: info.nextReviewDate ?? null,
          is_hard: info.isHard ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,problem_key' },
      )
      .then(({ error }) => {
        if (error) console.error('[problem_mastery] upsert error:', error)
      })
  }, [user])

  return { masteryMap, recordProblemResult }
}
```

- [ ] **Step 2: Verify**

```bash
pnpm build 2>&1 | grep "useProblemMastery"
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProblemMastery.ts
git commit -m "refactor: remove localStorage from useProblemMastery"
```

---

### Task 6: Simplify `src/hooks/useWeeklyPlan.ts`

**Files:**
- Modify: `src/hooks/useWeeklyPlan.ts`

Remove `loadLocal`, `saveLocal`, the initial localStorage read in `init`. Keep `WEEK_START_DAY` localStorage (UI preference). Always load from Supabase.

- [ ] **Step 1: Rewrite the file**

```ts
'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { STORAGE_KEYS } from '@/utils/constant'
import { getWeekStart } from '@/utils/english-helpers'
import type { WeeklyPlan, WeekDayProgress } from '@/utils/type'

async function loadFromCloud(userId: string, weekStart: string): Promise<WeeklyPlan | null> {
  try {
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('unit, lesson, plan_data, progress_data')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .single()
    if (error || !data) return null
    return {
      weekStart,
      unit: data.unit,
      lesson: data.lesson,
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
          plan_data: plan.days,
          progress_data: plan.progress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' },
      )
  } catch { /* ignore */ }
}

function loadWeekStartDay(): number {
  try {
    const v = window.localStorage.getItem(STORAGE_KEYS.WEEK_START_DAY)
    return v !== null ? Number(v) : 4
  } catch {
    return 4
  }
}

export function useWeeklyPlan(user: User | null) {
  const [weekStartDay, setWeekStartDay] = useState<number>(4)
  const currentWeekStart = useMemo(() => getWeekStart(undefined, weekStartDay), [weekStartDay])
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setWeekStartDay(loadWeekStartDay())
  }, [])

  useEffect(() => {
    if (!user) return
    const init = async () => {
      setIsLoading(true)
      const cloud = await loadFromCloud(user.id, currentWeekStart)
      setWeeklyPlan(cloud)
      setIsLoading(false)
    }
    void init()
  }, [user, currentWeekStart])

  const saveWeekStartDay = useCallback((day: number) => {
    setWeekStartDay(day)
    try { window.localStorage.setItem(STORAGE_KEYS.WEEK_START_DAY, String(day)) } catch { /* ignore */ }
  }, [])

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

  return { weeklyPlan, previousPlan: null, currentWeekStart, weekStartDay, saveWeekStartDay, savePlan, updateDayProgress, isLoading }
}
```

> **Note:** `previousPlan` is returned as `null` since it was only ever used to detect stale local state. Check if callers use it — if so, adjust accordingly (see Task 6b below).

- [ ] **Step 2: Check callers of `previousPlan`**

```bash
grep -r "previousPlan" src/ --include="*.tsx" --include="*.ts" -l
```

If any files use `previousPlan`, they'll need to be updated to handle `null`. Read those files and remove/adapt the `previousPlan` logic.

- [ ] **Step 3: Verify**

```bash
pnpm build 2>&1 | grep "useWeeklyPlan\|previousPlan"
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWeeklyPlan.ts
git commit -m "refactor: remove localStorage from useWeeklyPlan"
```

---

### Task 7: Simplify `src/hooks/useMathWeeklyPlan.ts`

**Files:**
- Modify: `src/hooks/useMathWeeklyPlan.ts`

Remove `loadLocal`, `saveLocal`, initial localStorage read. Keep `MATH_WEEK_START_DAY` and `MATH_WEEKLY_PROBLEMS_PER_DAY` localStorage (UI preferences). Always load from Supabase.

- [ ] **Step 1: Rewrite the file**

```ts
'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { STORAGE_KEYS } from '@/utils/constant'
import { getWeekStart } from '@/utils/english-helpers'
import type { MathWeeklyPlan, MathDayProgress } from '@/utils/type'

async function loadFromCloud(userId: string, weekStart: string): Promise<MathWeeklyPlan | null> {
  try {
    const { data, error } = await supabase
      .from('math_weekly_plans')
      .select('lesson_id, plan_data, progress_data')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .single()
    if (error || !data) return null
    return {
      weekStart,
      lessonId: data.lesson_id,
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
      .select('lesson_id, plan_data, progress_data, week_start')
      .eq('user_id', userId)
      .neq('week_start', currentWeekStart)
    if (data) {
      return data.map(row => ({
        weekStart: row.week_start,
        lessonId: row.lesson_id,
        days: row.plan_data as MathWeeklyPlan['days'],
        progress: (row.progress_data as MathWeeklyPlan['progress']) ?? {},
      }))
    }
  } catch { /* ignore */ }
  return []
}

function loadWeekStartDay(): number {
  try {
    const v = window.localStorage.getItem(STORAGE_KEYS.MATH_WEEK_START_DAY)
    return v !== null ? Number(v) : 4
  } catch { return 4 }
}

function loadProblemsPerDay(): number {
  try {
    const v = window.localStorage.getItem(STORAGE_KEYS.MATH_WEEKLY_PROBLEMS_PER_DAY)
    return v !== null ? Number(v) : 3
  } catch { return 3 }
}

export function useMathWeeklyPlan(user: User | null) {
  const [weekStartDay, setWeekStartDay] = useState<number>(4)
  const [problemsPerDay, setProblemsPerDayState] = useState<number>(3)
  const currentWeekStart = useMemo(() => getWeekStart(undefined, weekStartDay), [weekStartDay])
  const [weeklyPlan, setWeeklyPlan] = useState<MathWeeklyPlan | null>(null)
  const [priorPlans, setPriorPlans] = useState<MathWeeklyPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setWeekStartDay(loadWeekStartDay())
    setProblemsPerDayState(loadProblemsPerDay())
  }, [])

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

  const saveWeekStartDay = useCallback((day: number) => {
    setWeekStartDay(day)
    try { window.localStorage.setItem(STORAGE_KEYS.MATH_WEEK_START_DAY, String(day)) } catch { /* ignore */ }
  }, [])

  const saveProblemsPerDay = useCallback((n: number) => {
    setProblemsPerDayState(n)
    try { window.localStorage.setItem(STORAGE_KEYS.MATH_WEEKLY_PROBLEMS_PER_DAY, String(n)) } catch { /* ignore */ }
  }, [])

  return {
    weeklyPlan, priorPlans, allPriorKeys, priorProblemMap,
    currentWeekStart, weekStartDay, problemsPerDay,
    savePlan, addDoneKey, updateDayProgress,
    saveWeekStartDay, saveProblemsPerDay,
    isLoading,
  }
}
```

- [ ] **Step 2: Verify**

```bash
pnpm build 2>&1 | grep "useMathWeeklyPlan"
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMathWeeklyPlan.ts
git commit -m "refactor: remove localStorage from useMathWeeklyPlan"
```

---

### Task 8: Simplify `src/hooks/useDailyProgress.ts` and update `DailyPractice.tsx`

**Files:**
- Modify: `src/hooks/useDailyProgress.ts`
- Modify: `src/components/english/words/DailyPractice.tsx`

`useDailyProgress` currently exports `loadProgress` and `saveProgress` as standalone functions used directly in `DailyPractice.tsx`. Remove these and update the component to start with empty state (cloud load already happens via `loadProgressFromCloud`).

- [ ] **Step 1: Rewrite `useDailyProgress.ts`**

```ts
'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type DailyProgressRecord = Record<string, { quizDone?: boolean; lastScore?: number; lastDate?: string }>

export function useDailyProgress(user: User | null) {
  const syncProgressToCloud = useCallback(async (p: DailyProgressRecord) => {
    if (!user) return
    const rows = Object.entries(p).map(([day, val]) => ({
      user_id: user.id,
      day_number: Number(day),
      quiz_done: val.quizDone ?? false,
      last_score: val.lastScore ?? null,
      last_date: val.lastDate ?? null,
    }))
    if (rows.length > 0) {
      await supabase
        .from('daily_progress')
        .upsert(rows, { onConflict: 'user_id,day_number' })
    }
  }, [user])

  const loadProgressFromCloud = useCallback(async (): Promise<DailyProgressRecord | null> => {
    if (!user) return null
    const { data } = await supabase
      .from('daily_progress')
      .select('day_number, quiz_done, last_score, last_date')
      .eq('user_id', user.id)
    if (!data || data.length === 0) return null
    const record: DailyProgressRecord = {}
    data.forEach(row => {
      record[String(row.day_number)] = {
        quizDone: row.quiz_done,
        lastScore: row.last_score ?? undefined,
        lastDate: row.last_date ?? undefined,
      }
    })
    return record
  }, [user])

  return { syncProgressToCloud, loadProgressFromCloud }
}
```

- [ ] **Step 2: Update `DailyPractice.tsx`**

In `DailyPractice.tsx`, find and fix these two usages:

**Line 9** — remove `loadProgress` and `saveProgress` from the import:
```ts
// Before:
import { loadProgress, saveProgress, useDailyProgress, type DailyProgressRecord } from '@/hooks/useDailyProgress'
// After:
import { useDailyProgress, type DailyProgressRecord } from '@/hooks/useDailyProgress'
```

**Line 44** — change the `prog` state initializer:
```ts
// Before:
const [prog, setProg] = useState<DailyProgressRecord>(() => loadProgress())
// After:
const [prog, setProg] = useState<DailyProgressRecord>({})
```

**Lines 69-74** — remove `saveProgress` call in the `loadProgressFromCloud` effect:
```ts
// Before:
useEffect(() => {
  loadProgressFromCloud().then(cloudProg => {
    if (cloudProg) {
      saveProgress(cloudProg)
      setProg(cloudProg)
    }
  })
}, [loadProgressFromCloud])

// After:
useEffect(() => {
  loadProgressFromCloud().then(cloudProg => {
    if (cloudProg) setProg(cloudProg)
  })
}, [loadProgressFromCloud])
```

- [ ] **Step 3: Verify**

```bash
pnpm build 2>&1 | grep -E "useDailyProgress|DailyPractice|loadProgress|saveProgress"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDailyProgress.ts src/components/english/words/DailyPractice.tsx
git commit -m "refactor: remove localStorage from useDailyProgress and DailyPractice"
```

---

### Task 9: Simplify `Lesson35Provider.tsx` and `Lesson36Provider.tsx`

**Files:**
- Modify: `src/components/math/lesson35/Lesson35Provider.tsx`
- Modify: `src/components/math/lesson36/Lesson36Provider.tsx`

Both files have identical `loadWrongLocal`/`saveWrongLocal` functions and a guest path. Remove them both.

- [ ] **Step 1: Rewrite `Lesson35Provider.tsx`**

Remove `loadWrongLocal`, `saveWrongLocal`, `STORAGE_KEYS` import. Replace the `useEffect` for wrong IDs. Remove all `saveWrongLocal(...)` calls inside `handleSolve`, `addWrong`, `removeWrong`.

```ts
'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useMathSolved } from '@/hooks/useMathSolved'
import { supabase } from '@/lib/supabase'

interface Lesson35ContextType {
  solveCount: Record<string, number>
  solved: Record<string, boolean>
  handleSolve: (id: string) => void
  wrongIds: Set<string>
  addWrong: (id: string) => void
  removeWrong: (id: string) => void
  toast: string | null
  setToast: (msg: string | null) => void
  showCongrats: boolean
  setShowCongrats: (v: boolean) => void
}

const Lesson35Context = createContext<Lesson35ContextType | null>(null)

export function useLesson35() {
  const ctx = useContext(Lesson35Context)
  if (!ctx) throw new Error('useLesson35 must be used within Lesson35Provider')
  return ctx
}

export default function Lesson35Provider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { solveCount, handleSolve: solveAndSync } = useMathSolved(user)
  const [toast, setToast] = useState<string | null>(null)
  const [showCongrats, setShowCongrats] = useState(false)
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    supabase
      .from('math_wrong')
      .select('problem_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setWrongIds(new Set(data.map(r => r.problem_id)))
      })
  }, [user])

  const solved: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(solveCount)) {
    if (v >= 1) solved[k] = true
  }

  const handleSolve = async (id: string) => {
    const newCount = await solveAndSync(id)

    setWrongIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      if (user) {
        supabase.from('math_wrong').delete().eq('user_id', user.id).eq('problem_id', id)
      }
      return next
    })

    if (newCount === 1) {
      setShowCongrats(true)
    } else if (newCount === 2) {
      setToast('💪 第2次答对！再练一次就掌握了！')
    } else if (newCount === 3) {
      setToast('🏆 已掌握！答对3次，厉害！')
    } else {
      setToast(`⭐ 第${newCount}次答对！继续保持！`)
    }
  }

  const addWrong = useCallback((id: string) => {
    setWrongIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      if (user) {
        supabase.from('math_wrong').upsert(
          { user_id: user.id, problem_id: id },
          { onConflict: 'user_id,problem_id' },
        )
      }
      return next
    })
  }, [user])

  const removeWrong = useCallback((id: string) => {
    setWrongIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      if (user) {
        supabase.from('math_wrong').delete().eq('user_id', user.id).eq('problem_id', id)
      }
      return next
    })
  }, [user])

  return (
    <Lesson35Context.Provider value={{
      solveCount, solved, handleSolve,
      wrongIds, addWrong, removeWrong,
      toast, setToast, showCongrats, setShowCongrats,
    }}>
      {children}
    </Lesson35Context.Provider>
  )
}
```

- [ ] **Step 2: Apply the same changes to `Lesson36Provider.tsx`**

Identical changes — remove `loadWrongLocal`, `saveWrongLocal`, `STORAGE_KEYS` import, and all localStorage calls. The logic is exactly the same, just with `Lesson36Context` and `useLesson36`.

- [ ] **Step 3: Verify**

```bash
pnpm build 2>&1 | grep -E "Lesson3[56]Provider|STORAGE_KEYS"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/math/lesson35/Lesson35Provider.tsx src/components/math/lesson36/Lesson36Provider.tsx
git commit -m "refactor: remove localStorage from Lesson35Provider and Lesson36Provider"
```

---

### Task 10: Final verification and cleanup

- [ ] **Step 1: Full build**

```bash
pnpm build
```

Expected: clean build with no TypeScript errors.

- [ ] **Step 2: Check for any remaining stale localStorage references**

```bash
grep -r "localStorage" src/ --include="*.ts" --include="*.tsx" -n
```

Expected output should only contain:
- `MATH_SIDEBAR_COLLAPSED` usage (sidebar state)
- `WEEK_START_DAY` usage in `useWeeklyPlan.ts`
- `MATH_WEEK_START_DAY` usage in `useMathWeeklyPlan.ts`
- `WEEKLY_NEW_PER_DAY` usage in `WeeklyPractice.tsx`
- `MATH_WEEKLY_PROBLEMS_PER_DAY` usage in `useMathWeeklyPlan.ts`

If any data storage keys appear, fix them.

- [ ] **Step 3: Check for dead imports of removed STORAGE_KEYS**

```bash
grep -r "STORAGE_KEYS" src/ --include="*.ts" --include="*.tsx" -n
```

Any file importing `STORAGE_KEYS` but only using removed keys should have its import removed.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: finalize localStorage removal — Supabase is now sole data store"
```
