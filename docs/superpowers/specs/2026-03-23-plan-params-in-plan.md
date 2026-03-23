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

### 2. Hook Changes

**`useWeeklyPlan`:**
- Remove `weekStartDay` state, `loadWeekStartDay()`, `saveWeekStartDay()`
- Expose `defaultParams: { weekStartDay: number; newWordsPerDay: number }` derived from the most recent loaded plan, or system defaults if no history
- `savePlan` receives the full plan object (params already embedded)

**`useMathWeeklyPlan`:**
- Remove `weekStartDay` / `problemsPerDay` state, their localStorage loaders and savers
- Expose `defaultParams: { weekStartDay: number; problemsPerDay: number }` derived from the most recent plan, or system defaults
- `savePlan` receives the full plan object (params already embedded)

**`WeeklyPractice.tsx`:**
- Remove direct localStorage read/write of `WEEKLY_NEW_PER_DAY`

**`src/utils/constant.ts`:**
- Remove `WEEK_START_DAY`, `MATH_WEEK_START_DAY`, `WEEKLY_NEW_PER_DAY`, `MATH_WEEKLY_PROBLEMS_PER_DAY` from `STORAGE_KEYS`
- `STORAGE_KEYS` will contain only `MATH_SIDEBAR_COLLAPSED`

### 3. Plan Generation Dialog UI

When the user clicks "生成新计划", a modal appears before generating:

**English plan dialog fields:**
- 周开始日（select, Mon–Sun, pre-filled from `defaultParams.weekStartDay`）
- 每天新单词数（number picker 1–10, pre-filled from `defaultParams.newWordsPerDay`）
- Unit / Lesson selection（existing logic, unchanged）

**Math plan dialog fields:**
- 周开始日（select, Mon–Sun, pre-filled from `defaultParams.weekStartDay`）
- 每天必做题数（number picker 1–10, pre-filled from `defaultParams.problemsPerDay`）
- 课节选择（existing logic, unchanged）

**Flow:**
```
Click "生成新计划"
  → Modal opens with pre-filled params from last plan (or defaults)
  → User adjusts if needed → Confirms
  → Plan generated with those params
  → Plan (including params) saved to Supabase
```

The modal style matches existing modals in the codebase (e.g. `LoginModal`).

### 4. Default Values

| Parameter | Default |
|---|---|
| `weekStartDay` | 4 (Thursday) |
| `newWordsPerDay` | 3 |
| `problemsPerDay` | 3 |

Defaults apply only when there is no prior plan. Once any plan exists, its params become the defaults for the next plan.

### 5. localStorage Cleanup

After this change, `STORAGE_KEYS` contains only:
- `MATH_SIDEBAR_COLLAPSED`

All other user-visible configuration is either in Supabase (plan params) or managed by React state.

## Files Affected

| File | Change |
|---|---|
| `src/utils/type.ts` | Add `weekStartDay` + `newWordsPerDay` to `WeeklyPlan`; add `weekStartDay` + `problemsPerDay` to `MathWeeklyPlan` |
| `src/utils/constant.ts` | Remove 4 localStorage keys from `STORAGE_KEYS` |
| `src/hooks/useWeeklyPlan.ts` | Remove localStorage param handling; expose `defaultParams` |
| `src/hooks/useMathWeeklyPlan.ts` | Remove localStorage param handling; expose `defaultParams` |
| `src/components/english/words/WeeklyPractice.tsx` | Remove localStorage read/write for `WEEKLY_NEW_PER_DAY`; add plan generation dialog |
| `src/components/math/lesson35/HomePage.tsx` (or equivalent) | Add plan generation dialog for math |
| `src/components/math/lesson36/HomePage.tsx` (or equivalent) | Add plan generation dialog for math |
| `CLAUDE.md` | Update localStorage key list |
