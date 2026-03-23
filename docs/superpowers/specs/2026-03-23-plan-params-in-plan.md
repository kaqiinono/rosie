# Design: Store Plan Generation Parameters Inside the Plan

## Goal

Move `weekStartDay`, `newWordsPerDay`, and `problemsPerDay` out of localStorage and into the plan itself. Each weekly plan carries the parameters used to generate it. Before generating a new plan, a dialog lets the user confirm or adjust these parameters, defaulting to the previous plan's values.

## Background

Previously these settings lived in localStorage:
- `WEEK_START_DAY` / `MATH_WEEK_START_DAY` — which day the week starts
- `WEEKLY_NEW_PER_DAY` — new English words per day
- `MATH_WEEKLY_PROBLEMS_PER_DAY` — required math problems per day

They were applied at plan-generation time but not stored with the plan, so there was no record of what parameters produced a given plan, and they didn't sync across devices.

## Design

### 1. Type Changes (`src/utils/type.ts`)

Add parameters directly to the plan types:

```ts
interface WeeklyPlan {
  weekStart: string
  unit: string
  lesson: string
  weekStartDay: number    // 0–6, 4 = Thursday (default)
  newWordsPerDay: number  // default 3
  days: WeeklyPlanDay[]
  progress: Record<string, WeekDayProgress>
}

interface MathWeeklyPlan {
  weekStart: string
  lessonId: string
  weekStartDay: number    // 0–6, 4 = Thursday (default)
  problemsPerDay: number  // default 3
  days: MathWeeklyPlanDay[]
  progress: Record<string, MathDayProgress>
}
```

### 2. Supabase Storage

The new fields are stored as **dedicated integer columns** in the existing tables — not embedded in `plan_data`.

**`weekly_plans` table** — add columns:
- `week_start_day` (integer, default 4)
- `new_words_per_day` (integer, default 3)

**`math_weekly_plans` table** — add columns:
- `week_start_day` (integer, default 4)
- `problems_per_day` (integer, default 3)

**Updated `loadFromCloud` for `useWeeklyPlan`:**
```ts
const { data, error } = await supabase
  .from('weekly_plans')
  .select('unit, lesson, week_start_day, new_words_per_day, plan_data, progress_data')
  .eq('user_id', userId)
  .eq('week_start', weekStart)
  .single()

return {
  weekStart,
  unit: data.unit,
  lesson: data.lesson,
  weekStartDay: data.week_start_day ?? 4,
  newWordsPerDay: data.new_words_per_day ?? 3,
  days: data.plan_data as WeeklyPlan['days'],
  progress: (data.progress_data as WeeklyPlan['progress']) ?? {},
}
```

**Updated `saveToCloud` for `useWeeklyPlan`:**
```ts
await supabase.from('weekly_plans').upsert({
  user_id: userId,
  week_start: plan.weekStart,
  unit: plan.unit,
  lesson: plan.lesson,
  week_start_day: plan.weekStartDay,
  new_words_per_day: plan.newWordsPerDay,
  plan_data: plan.days,
  progress_data: plan.progress,
  updated_at: new Date().toISOString(),
}, { onConflict: 'user_id,week_start' })
```

Same pattern applies to `math_weekly_plans` with `week_start_day` and `problems_per_day`.

**Backwards compatibility:** Existing rows have `null` for the new columns. The `?? 4` / `?? 3` fallback in `loadFromCloud` handles this — they behave as if they have system defaults.

### 3. Hook Changes

**`useWeeklyPlan`:**

Remove:
- `weekStartDay` state, `loadWeekStartDay()`, `saveWeekStartDay()` (and its `STORAGE_KEYS.WEEK_START_DAY` write)
- `saveWeekStartDay` from the hook's return value

Add:
- `defaultParams: { weekStartDay: number; newWordsPerDay: number }` — derived by loading the most recent prior plan:

```ts
async function loadMostRecentPlan(userId: string, beforeWeekStart: string) {
  const { data } = await supabase
    .from('weekly_plans')
    .select('week_start_day, new_words_per_day')
    .eq('user_id', userId)
    .lt('week_start', beforeWeekStart)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
    ? { weekStartDay: data.week_start_day ?? 4, newWordsPerDay: data.new_words_per_day ?? 3 }
    : { weekStartDay: 4, newWordsPerDay: 3 }
}
```

- Expose `defaultParams` in the hook return. It is loaded once on mount alongside `currentWeekStart`.

**Mount sequence (English):** To avoid a double-fetch, `defaultParams` must be resolved before `currentWeekStart` is first computed. The hook must load them in this order:
1. `isLoading = true`
2. Await `loadMostRecentPlan` → set `defaultParams` (and from it, `weekStartDay`)
3. Compute `currentWeekStart` from resolved `weekStartDay`
4. Await `loadFromCloud(currentWeekStart)` → set `weeklyPlan`
5. `isLoading = false`

During step 1–2, `weeklyPlan` is `null` and the UI shows a loading state. This prevents a spurious fetch for the wrong week.

**`useMathWeeklyPlan`:**

Remove:
- `weekStartDay` / `problemsPerDay` state
- `loadWeekStartDay()`, `loadProblemsPerDay()`, `saveWeekStartDay()`, `saveProblemsPerDay()`
- All four from the hook's return value

Add:
- `defaultParams: { weekStartDay: number; problemsPerDay: number }` — derived from the most recent prior plan by sorting `priorPlans` by `weekStart` descending and taking the first. Falls back to `{ weekStartDay: 4, problemsPerDay: 3 }` if no prior plans.
- Update `loadAllPriorPlans` `select()` to include `week_start_day, problems_per_day` alongside the existing columns, so that the derivation can read these values from loaded rows.

Remove from `STORAGE_KEYS` in `src/utils/constant.ts`:
- `WEEK_START_DAY`
- `MATH_WEEK_START_DAY`
- `MATH_WEEKLY_PROBLEMS_PER_DAY`

**`WeeklyPractice.tsx`:**

Remove:
- `newPerDay` state initialized from `localStorage.getItem(STORAGE_KEYS.WEEKLY_NEW_PER_DAY)`
- The `onClick` handler on the "每天新单词数" picker that calls `localStorage.setItem(STORAGE_KEYS.WEEKLY_NEW_PER_DAY, ...)`
- `WEEKLY_NEW_PER_DAY` reference (remove from `STORAGE_KEYS` as well)

`newWordsPerDay` becomes a param confirmed in the plan generation dialog (see below), not persistent local state.

**`MathWeeklyPractice.tsx`:**

Remove:
- Usages of `saveWeekStartDay` and `saveProblemsPerDay` from `useMathWeeklyPlan`
- Any direct reads of `weekStartDay` / `problemsPerDay` as standalone values

These values now come through the plan generation dialog.

### 4. Plan Generation Dialog UI

When the user clicks "生成新计划", a modal appears before generating.

**English plan dialog (`WeeklyPractice.tsx`):**
- 周开始日（select, Mon–Sun, pre-filled from `defaultParams.weekStartDay`）
- 每天新单词数（number picker 1–10, pre-filled from `defaultParams.newWordsPerDay`）
- Unit / Lesson selection（existing logic, unchanged）

**Math plan dialog (`MathWeeklyPractice.tsx`):**
- 周开始日（select, Mon–Sun, pre-filled from `defaultParams.weekStartDay`）
- 每天必做题数（number picker 1–10, pre-filled from `defaultParams.problemsPerDay`）
- 课节选择（existing logic, unchanged）

**Flow:**
```
Click "生成新计划"
  → Modal opens with pre-filled params from defaultParams
  → User adjusts if needed → Confirms
  → currentWeekStart recomputed from chosen weekStartDay
  → Plan generated with those params
  → Plan (params + days + progress) saved to Supabase
```

The modal style follows existing modals in the codebase (e.g. `LoginModal`). No new shared component needed — each page has its own inline boolean dialog state (`showParamsDialog: boolean`), independent of the existing `Phase` state machine. The dialog is a modal overlay on top of whatever phase is currently showing.

### 5. Default Values

| Parameter | Default |
|---|---|
| `weekStartDay` | 4 (Thursday) |
| `newWordsPerDay` | 3 |
| `problemsPerDay` | 3 |

Defaults apply when there is no prior plan. Once any plan exists, its params become the defaults for the next plan.

### 6. localStorage Cleanup

After this change, `STORAGE_KEYS` contains only:
- `MATH_SIDEBAR_COLLAPSED`

All other user-visible configuration lives in Supabase plan rows.

## Files Affected

| File | Change |
|---|---|
| `src/utils/type.ts` | Add `weekStartDay` + `newWordsPerDay` to `WeeklyPlan`; add `weekStartDay` + `problemsPerDay` to `MathWeeklyPlan` |
| `src/utils/constant.ts` | Remove `WEEK_START_DAY`, `MATH_WEEK_START_DAY`, `WEEKLY_NEW_PER_DAY`, `MATH_WEEKLY_PROBLEMS_PER_DAY` from `STORAGE_KEYS` |
| `src/hooks/useWeeklyPlan.ts` | Remove localStorage param handling; add `loadMostRecentPlan`; expose `defaultParams` |
| `src/hooks/useMathWeeklyPlan.ts` | Remove localStorage param handling; derive `defaultParams` from `priorPlans`; remove `saveWeekStartDay` / `saveProblemsPerDay` from return |
| `src/components/english/words/WeeklyPractice.tsx` | Remove `WEEKLY_NEW_PER_DAY` localStorage reads/writes (initial state + onClick handler); add plan generation dialog |
| `src/components/math/MathWeeklyPractice.tsx` | Remove `saveWeekStartDay` / `saveProblemsPerDay` usages; add plan generation dialog |
| `CLAUDE.md` | Update localStorage key list to `MATH_SIDEBAR_COLLAPSED` only; update Weekly Planning System section to note params are stored in plan |

## Supabase Migration Required

Two `ALTER TABLE` statements must be run in the Supabase SQL editor before deploying:

```sql
ALTER TABLE weekly_plans
  ADD COLUMN IF NOT EXISTS week_start_day integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS new_words_per_day integer DEFAULT 3;

ALTER TABLE math_weekly_plans
  ADD COLUMN IF NOT EXISTS week_start_day integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS problems_per_day integer DEFAULT 3;
```

Existing rows will have these columns defaulting to the correct system defaults, so no data migration is needed.
