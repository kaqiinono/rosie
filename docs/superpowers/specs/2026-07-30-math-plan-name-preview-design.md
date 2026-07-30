# Math plan name + list preview — Design

**Date:** 2026-07-30  
**Status:** Approved for implementation planning  
**Scope:** `/admin/plans/math` create/edit/list + learner-facing plan titles

## Problem

Math weekly plans have no human-readable name. The admin list only shows a lesson short label and date range, so parents cannot tell plans apart or see what each plan contains without opening the editor.

## Goals

1. Optional **计划名称** on create/edit; empty falls back to lesson summary.
2. Admin list shows **preview**: summary stats (A) + expandable per-day breakdown (C).
3. Learner-facing surfaces use the same display-name rule (admin + child).

## Non-goals

- Lesson/section text summary as the primary list preview (rejected in favor of A+C).
- Dedicated DB column `math_weekly_plans.name`.
- Editing daily problem lists from the list expand UI.
- Changing plan generation / progress / occupancy rules.

## Approach (chosen)

Store `name` inside existing `progress_data.__planMeta` (same path as `planEnd`, `lessonIds`, `sectionFilters`, `tagFilters`). No schema migration.

### Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| New `name` column | Extra migration; overkill for optional display string |
| UI-only name (not persisted) | Does not survive reload |

## Data model

```ts
// packages/core/src/type.ts — MathWeeklyPlan
name?: string  // optional display title; trim on write; omit when empty
```

Persistence (`useMathWeeklyPlan`):

- `PlanMeta` / `withPlanMeta` / `stripPlanMeta` include `name`.
- Legacy rows without `name` load as `undefined`.

Display helper (shared):

```ts
mathPlanDisplayName(plan): string
// plan.name?.trim() || lesson short / "N 个关卡" (existing AllPlansList logic)
```

## Admin UI

### Editor (`MathWeeklyPlanEditor`)

- Optional text input「计划名称」near the date range.
- Load into form when editing; save `trim`med value or omit if empty.
- Preserve name across `weekStart` change (delete-old + save-new path).

### List (`AllPlansList` on `/admin/plans/math`)

Each row:

1. **Title:** `mathPlanDisplayName(plan)` + existing 进行中 / 已过期 badges.
2. **Date line:** unchanged (`fmtDate` range).
3. **Stats line (always visible):** `N 题 · M 天 · 每天约 K 题`  
   - `N` = sum of required `day.problems.length`  
   - `M` = `days.length`  
   - `K` = `plan.problemsPerDay`
4. **Expandable day preview (default collapsed):**  
   For each day: date + required count + truncated problem title list.  
   Read-only; edit/delete buttons unchanged.

## Learner-facing titles

Prefer `mathPlanDisplayName(plan)` wherever the current UI shows lesson short / multi-lesson label:

- `MathWeeklyPlanSession` (header on `/math/ny/plan`)
- `MathDailyCard`
- `/today` math task title if it currently uses lesson label

Page chrome that is intentionally generic (e.g. sticky「数学每日一练」) may stay; the plan-specific heading uses the helper.

## Edge cases

| Case | Behavior |
|------|----------|
| Old plan, no `name` | Fallback lesson summary; identical to today |
| Whitespace-only name | Treat as unset |
| Expand preview | Read-only |
| `weekStart` edited | Existing delete+recreate; carry `name` on new plan |

## Files likely touched

- `packages/core/src/type.ts` — `name?: string`
- `packages/math/src/hooks/useMathWeeklyPlan.ts` — meta round-trip
- `packages/math/src/components/math-weekly-plan-shared.tsx` — helper + list UI
- `packages/math/src/components/MathWeeklyPlanEditor.tsx` — name field
- `packages/math/src/components/MathWeeklyPlanSession.tsx` — title
- `packages/math/src/components/MathDailyCard.tsx` — title
- `apps/web/src/components/today/TodayDashboard.tsx` — if math title uses lesson label

## Testing (manual)

1. Create plan without name → list shows lesson fallback + stats; expand shows days.
2. Create/edit with name → list + `/math/ny/plan` + daily card show name.
3. Clear name on edit → falls back again; cloud reload keeps behavior.
4. Old plans without meta `name` still load and display.
