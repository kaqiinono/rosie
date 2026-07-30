# Math Plan Name + List Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optional math plan names (persisted in `__planMeta`) plus admin list stats and expandable day previews; learner UI uses the same display-name helper.

**Architecture:** Add `name?: string` on `MathWeeklyPlan`, round-trip via existing `progress_data.__planMeta`. Shared `mathPlanDisplayName` + list expand UI in `math-weekly-plan-shared.tsx`. Editor gains an optional name field; session/daily card prefer the name.

**Tech Stack:** TypeScript, React, Next.js App Router, Supabase JSON meta (no DDL).

## Global Constraints

- No `math_weekly_plans` schema migration; store `name` only in `__planMeta`.
- Name is optional; whitespace-only means unset.
- List preview = stats line + expandable per-day titles (not section summary).
- Do not change plan generation / progress / occupancy logic.
- Verify with `pnpm --filter @rosie/math typecheck` and `pnpm --filter @rosie/core typecheck` (no dedicated unit tests for this UI).

---

### Task 1: Type + meta persistence + display helper

**Files:**
- Modify: `packages/core/src/type.ts` (`MathWeeklyPlan`)
- Modify: `packages/math/src/hooks/useMathWeeklyPlan.ts` (`PlanMeta`, `withPlanMeta`, `stripPlanMeta` / load map)
- Modify: `packages/math/src/components/math-weekly-plan-shared.tsx` (add `mathPlanDisplayName`)

**Interfaces:**
- Produces: `MathWeeklyPlan.name?: string`
- Produces: `mathPlanDisplayName(plan: MathWeeklyPlan): string`

- [ ] **Step 1:** Add `name?: string` to `MathWeeklyPlan` in `type.ts`.
- [ ] **Step 2:** Extend `PlanMeta` with `name?: string`; include in `withPlanMeta` and load path in `loadAllPlansFromCloud`.
- [ ] **Step 3:** Export `mathPlanDisplayName(plan)` next to `MATH_PLAN_LESSONS` — return `plan.name?.trim()` if non-empty, else existing single-lesson short / `N 个关卡` logic.
- [ ] **Step 4:** Run `pnpm --filter @rosie/core typecheck && pnpm --filter @rosie/math typecheck`.
- [ ] **Step 5:** Commit: `feat(math): persist optional weekly plan name in plan meta`

---

### Task 2: Editor name field

**Files:**
- Modify: `packages/math/src/components/MathWeeklyPlanEditor.tsx`

**Interfaces:**
- Consumes: `MathWeeklyPlan.name`
- Produces: saved plans include trimmed `name` or omit when empty

- [ ] **Step 1:** Add `planName` state; set in `loadPlanIntoForm`; clear/reset when appropriate for new plans.
- [ ] **Step 2:** Add optional「计划名称」input above or inside the date-range card.
- [ ] **Step 3:** In `handleCreatePlan`, set `name: planName.trim() || undefined` on the plan object.
- [ ] **Step 4:** Typecheck math package; commit: `feat(math): add optional plan name field to weekly plan editor`

---

### Task 3: Admin list stats + day expand

**Files:**
- Modify: `packages/math/src/components/math-weekly-plan-shared.tsx` (`AllPlansList`)

**Interfaces:**
- Consumes: `mathPlanDisplayName`, `plan.days`, `plan.problemsPerDay`

- [ ] **Step 1:** Title uses `mathPlanDisplayName(plan)`.
- [ ] **Step 2:** Always show stats: `N 题 · M 天 · 每天约 K 题` from required problem sum / `days.length` / `problemsPerDay`.
- [ ] **Step 3:** Per-row expand toggle; expanded body lists each day date, required count, truncated titles (join with ` · `, truncate long lines).
- [ ] **Step 4:** Typecheck; commit: `feat(math): show plan stats and day preview in admin plan list`

---

### Task 4: Learner-facing titles

**Files:**
- Modify: `packages/math/src/components/MathWeeklyPlanSession.tsx` (headerTitle)
- Modify: `packages/math/src/components/MathDailyCard.tsx` (show display name chip when plan exists)

**Interfaces:**
- Consumes: `mathPlanDisplayName`

- [ ] **Step 1:** Session header uses `mathPlanDisplayName(weeklyPlan)` (keep emoji from lesson info).
- [ ] **Step 2:** Daily card: when `weeklyPlan` exists, show `mathPlanDisplayName(weeklyPlan)` (prefer over narrow `LESSON_INFO` map, or show name as the chip text).
- [ ] **Step 3:** TodayDashboard — only if a plan title string exists; otherwise skip (current UI lists problems, no plan title).
- [ ] **Step 4:** Typecheck; commit: `feat(math): use plan display name on learner plan surfaces`

---

## Spec coverage

| Spec requirement | Task |
|------------------|------|
| `name` on type + `__planMeta` | 1 |
| Optional editor field | 2 |
| List title fallback | 3 |
| Stats line A | 3 |
| Expand day preview C | 3 |
| Learner titles | 4 |
| No DDL / no generation changes | Global |
