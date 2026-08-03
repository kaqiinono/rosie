# Chinese Roadmap Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-managed Chinese roadmap plans that control today’s lesson batch + quiz types, with one active plan, pause/resume, per-plan progress, and per-lesson practice runs.

**Architecture:** New Supabase tables `chinese_roadmap_plans` + `chinese_roadmap_plan_lesson_runs`. Pure helpers for create-status, batch lessons, plan-local roadmap, and lesson completion (including garden poems/accumulation). `useChineseRoadmapPlan` session store mirrors English adaptive plans. Admin UI under `/admin/plans/chinese`; child `/today` + practice session read `planId` and write runs / advance on settle.

**Tech Stack:** `@rosie/chinese`, `@rosie/core` `createUserSessionStore`, Supabase RLS SQL, Next.js App Router thin shells in `apps/web`, Vitest in `apps/web/tests`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-03-chinese-roadmap-plan-design.md`
- At most one `active` plan per user; activate pauses others
- `book_slug` immutable after create
- Plan `quiz_types`: only `recognize` | `stroke` | `phrase` | `passage` | `pinyin-write` (not `blank`)
- No calendar `days[]`; anytime practice; finish → next lesson
- Garden: poems/accumulation auto-included; empty plan quiz types do not auto-complete the lesson
- Do not delete/migrate `chinese_weekly_plans`
- User data via `createUserSessionStore`; no new Zustand/TanStack Query
- SQL incremental only (no TRUNCATE / wipe)
- After logic changes: `pnpm --filter @rosie/chinese typecheck`
- Spec/plan under `docs/` are gitignored — commit with `git add -f`

## File structure

| File | Responsibility |
|------|----------------|
| `packages/chinese/sql/chinese-roadmap-plans.sql` | DDL + RLS for plans + lesson runs |
| `packages/chinese/src/utils/chineseRoadmapPlanTypes.ts` | Plan / run / status types + defaults |
| `packages/chinese/src/utils/chineseRoadmapPlanMappers.ts` | Row ↔ model |
| `packages/chinese/src/utils/chineseRoadmapPlanLogic.ts` | create status, batch keys, plan roadmap, completion |
| `packages/chinese/src/hooks/useChineseRoadmapPlan.ts` | Session store + CRUD / activate / pause / advance / appendRun |
| `packages/chinese/src/components/plans/ChineseRoadmapPlanManage.tsx` | Admin list |
| `packages/chinese/src/components/plans/ChineseRoadmapPlanEditor.tsx` | Create / edit (book locked on edit) |
| `packages/chinese/src/components/plans/ChinesePlanRoadmapPreview.tsx` | Plan-local roadmap + run drill-in |
| `packages/chinese/src/components/chars/ChineseCharsPracticeSession.tsx` | `planId` settle → runs + advance |
| `packages/chinese/src/components/ChineseDailyCard.tsx` | Prefer active plan href |
| `packages/chinese/src/components/ChineseDailyPage.tsx` | Prefer active plan batch + types |
| `packages/chinese/src/index.ts` | Barrel exports |
| `apps/web/src/app/admin/plans/page.tsx` | Add 语文计划 card |
| `apps/web/src/app/admin/plans/chinese/page.tsx` | List shell |
| `apps/web/src/app/admin/plans/chinese/new/page.tsx` | New shell |
| `apps/web/src/app/admin/plans/chinese/[planId]/page.tsx` | Edit shell |
| `apps/web/src/components/today/TodayDashboard.tsx` | Active plan → chinese href |
| `apps/web/src/components/today/TodayPracticeRecords.tsx` | Show latest runs; drop weekly-plan dependency for display |
| `apps/web/tests/chinese-roadmap-plan-logic.test.ts` | Pure logic unit tests |
| `packages/chinese/CLAUDE.md` | Document new tables / admin routes |

---

### Task 1: SQL schema

**Files:**
- Create: `packages/chinese/sql/chinese-roadmap-plans.sql`

**Interfaces:**
- Produces: tables `chinese_roadmap_plans`, `chinese_roadmap_plan_lesson_runs` (run in Supabase SQL editor)

- [ ] **Step 1: Write incremental SQL**

```sql
-- Chinese roadmap plans — incremental. No destructive data ops.
-- Run in Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS public.chinese_roadmap_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  book_slug VARCHAR(16) NOT NULL,
  start_lesson_key VARCHAR(64) NOT NULL,
  current_lesson_key VARCHAR(64) NOT NULL,
  lessons_per_batch INT NOT NULL DEFAULT 1,
  quiz_types TEXT[] NOT NULL DEFAULT ARRAY['recognize','stroke','phrase','passage','pinyin-write']::text[],
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  completed_lesson_keys TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT chinese_roadmap_plans_book_chk
    CHECK (book_slug IN ('g1b', 'g2a', 'g2b')),
  CONSTRAINT chinese_roadmap_plans_status_chk
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  CONSTRAINT chinese_roadmap_plans_batch_chk
    CHECK (lessons_per_batch >= 1 AND lessons_per_batch <= 10)
);

CREATE INDEX IF NOT EXISTS idx_chinese_roadmap_plans_user_status
  ON public.chinese_roadmap_plans (user_id, status);

-- At most one non-archived active plan per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_chinese_roadmap_plans_one_active
  ON public.chinese_roadmap_plans (user_id)
  WHERE status = 'active' AND archived_at IS NULL;

ALTER TABLE public.chinese_roadmap_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chinese_roadmap_plans_own ON public.chinese_roadmap_plans;
CREATE POLICY chinese_roadmap_plans_own ON public.chinese_roadmap_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.chinese_roadmap_plan_lesson_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.chinese_roadmap_plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_key VARCHAR(64) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed BOOLEAN NOT NULL DEFAULT false,
  total INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  accuracy NUMERIC(5, 2),
  by_type JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz_types TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chinese_roadmap_plan_runs_plan_lesson
  ON public.chinese_roadmap_plan_lesson_runs (plan_id, lesson_key, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_chinese_roadmap_plan_runs_user
  ON public.chinese_roadmap_plan_lesson_runs (user_id, plan_id);

ALTER TABLE public.chinese_roadmap_plan_lesson_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chinese_roadmap_plan_lesson_runs_own ON public.chinese_roadmap_plan_lesson_runs;
CREATE POLICY chinese_roadmap_plan_lesson_runs_own ON public.chinese_roadmap_plan_lesson_runs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```bash
git add packages/chinese/sql/chinese-roadmap-plans.sql
git commit -m "feat(chinese): add roadmap plan SQL schema"
```

---

### Task 2: Types, mappers, pure logic + tests

**Files:**
- Create: `packages/chinese/src/utils/chineseRoadmapPlanTypes.ts`
- Create: `packages/chinese/src/utils/chineseRoadmapPlanMappers.ts`
- Create: `packages/chinese/src/utils/chineseRoadmapPlanLogic.ts`
- Create: `apps/web/tests/chinese-roadmap-plan-logic.test.ts`
- Modify: `packages/chinese/src/index.ts` (export types + logic helpers used by tests/admin)

**Interfaces:**
- Produces:
  - `export type ChineseRoadmapPlanStatus = 'active' | 'paused' | 'completed' | 'archived'`
  - `export type ChinesePlanQuizType = 'recognize' | 'stroke' | 'phrase' | 'passage' | 'pinyin-write'`
  - `export const CHINESE_PLAN_QUIZ_TYPES: ChinesePlanQuizType[]`
  - `export interface ChineseRoadmapPlan { id: string; userId: string; title: string; bookSlug: ChineseBookSlug; startLessonKey: string; currentLessonKey: string; lessonsPerBatch: number; quizTypes: ChinesePlanQuizType[]; status: ChineseRoadmapPlanStatus; completedLessonKeys: string[]; createdAt: string; updatedAt: string; archivedAt: string | null }`
  - `export interface ChineseRoadmapPlanLessonRun { id: string; planId: string; userId: string; lessonKey: string; startedAt: string; finishedAt: string; completed: boolean; total: number; correct: number; accuracy: number | null; byType: Record<string, { total: number; correct: number }>; quizTypes: string[] }`
  - `export function resolveChinesePlanCreateStatus(hasActive: boolean): 'active' | 'paused'`
  - `export function currentBatchLessonKeys(orderedKeys: string[], currentLessonKey: string, k: number, completed: Set<string>): string[]`
  - `export function buildPlanRoadmapNodes(lessons, lessonGroups, plan, bookSlug): RoadmapNode[]` — reuse `RoadmapNode` shape; state from plan `completedLessonKeys` / `currentLessonKey` (not mastery)
  - `export function isLessonCompleteForPlan(args): boolean` — see Step 3
  - `mapPlanRowToModel` / `mapPlanModelToRow` / `mapRunRowToModel` / `mapRunModelToRow`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  resolveChinesePlanCreateStatus,
  currentBatchLessonKeys,
  isLessonCompleteForPlan,
} from '@rosie/chinese'

describe('resolveChinesePlanCreateStatus', () => {
  it('active when none active', () => {
    expect(resolveChinesePlanCreateStatus(false)).toBe('active')
  })
  it('paused when another active', () => {
    expect(resolveChinesePlanCreateStatus(true)).toBe('paused')
  })
})

describe('currentBatchLessonKeys', () => {
  const ordered = ['a', 'b', 'c', 'd']
  it('returns K lessons from current, skipping completed before current', () => {
    expect(currentBatchLessonKeys(ordered, 'b', 2, new Set(['a']))).toEqual(['b', 'c'])
  })
  it('stops at end of book', () => {
    expect(currentBatchLessonKeys(ordered, 'd', 3, new Set(['a', 'b', 'c']))).toEqual(['d'])
  })
})

describe('isLessonCompleteForPlan', () => {
  it('normal lesson: all present plan quiz types done; missing types ignored', () => {
    expect(
      isLessonCompleteForPlan({
        lessonKind: 'lesson',
        planQuizTypes: ['recognize', 'stroke', 'passage'],
        presentPhases: ['recognize', 'stroke'], // no passage content
        finishedPhases: ['recognize', 'stroke'],
      }),
    ).toBe(true)
  })
  it('garden: empty plan types do not complete; needs poems/accumulation if present', () => {
    expect(
      isLessonCompleteForPlan({
        lessonKind: 'garden',
        planQuizTypes: ['recognize', 'stroke'],
        presentPhases: ['poems', 'accumulation'],
        finishedPhases: [],
      }),
    ).toBe(false)
    expect(
      isLessonCompleteForPlan({
        lessonKind: 'garden',
        planQuizTypes: ['recognize', 'stroke'],
        presentPhases: ['poems', 'accumulation'],
        finishedPhases: ['poems', 'accumulation'],
      }),
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter web exec vitest run apps/web/tests/chinese-roadmap-plan-logic.test.ts
```

Expected: FAIL — exports missing

- [ ] **Step 3: Implement types + logic**

`isLessonCompleteForPlan` rules:

```ts
export type PlanSessionPhase =
  | ChinesePlanQuizType
  | 'poems'
  | 'accumulation'
  | 'phrase' // alias ok if presentPhases uses CharQuizType names

export function isLessonCompleteForPlan(args: {
  lessonKind: string
  planQuizTypes: ChinesePlanQuizType[]
  /** Phases that actually have content for this lesson */
  presentPhases: string[]
  /** Phases finished in this session (or prior completed run) */
  finishedPhases: string[]
}): boolean {
  const present = new Set(args.presentPhases)
  const finished = new Set(args.finishedPhases)
  const required = new Set<string>()
  for (const t of args.planQuizTypes) {
    if (present.has(t)) required.add(t)
  }
  // Always require auto content phases when present (garden + any lesson with poems)
  for (const extra of ['poems', 'accumulation'] as const) {
    if (present.has(extra)) required.add(extra)
  }
  if (required.size === 0) return false // never complete on empty
  for (const r of required) {
    if (!finished.has(r)) return false
  }
  return true
}
```

`currentBatchLessonKeys`: find index of `currentLessonKey` in `orderedKeys`; take next `k` keys that are not in `completed` (if current is completed, start at first incomplete ≥ index). Prefer: start at `currentLessonKey`, include it even if somehow completed, then following incomplete — match spec “from current_lesson_key 起共 K 关”.

Implement mappers with snake_case columns matching SQL.

- [ ] **Step 4: Re-run tests — expect PASS**

```bash
pnpm --filter web exec vitest run apps/web/tests/chinese-roadmap-plan-logic.test.ts
pnpm --filter @rosie/chinese typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/chinese/src/utils/chineseRoadmapPlanTypes.ts \
  packages/chinese/src/utils/chineseRoadmapPlanMappers.ts \
  packages/chinese/src/utils/chineseRoadmapPlanLogic.ts \
  packages/chinese/src/index.ts \
  apps/web/tests/chinese-roadmap-plan-logic.test.ts
git commit -m "feat(chinese): add roadmap plan types and pure logic"
```

---

### Task 3: `useChineseRoadmapPlan` session store

**Files:**
- Create: `packages/chinese/src/hooks/useChineseRoadmapPlan.ts`
- Modify: `packages/chinese/src/index.ts`

**Interfaces:**
- Consumes: mappers, `resolveChinesePlanCreateStatus`, types from Task 2
- Produces:
  - `chineseRoadmapPlansStore = createUserSessionStore<ChineseRoadmapPlan[]>('chinese_roadmap_plans', …)`
  - `chineseRoadmapPlanRunsStore` keyed cache OR load runs per planId into `Record<planId, ChineseRoadmapPlanLessonRun[]>` store `'chinese_roadmap_plan_runs'`
  - `useChineseRoadmapPlan(user)` → `{ plans, activePlan, isLoading, createPlan, savePlan, pausePlan, activatePlan, archivePlan, appendLessonRuns, advanceAfterSession, loadRunsForPlan, runsByPlanId }`

`createPlan` input:

```ts
type CreateChineseRoadmapPlanInput = {
  title: string
  bookSlug: ChineseBookSlug
  startLessonKey: string
  lessonsPerBatch?: number
  quizTypes: ChinesePlanQuizType[]
  /** if true and another active exists, pause it then create as active */
  activateNow?: boolean
}
```

- [ ] **Step 1: Implement hook**

Patterns to copy from `packages/english/src/hooks/useAdaptiveWordPlan.ts`:

- `fetch` throws on error (do not swallow)
- `patchSessionData` after successful writes
- `activatePlan(planId)`: set all other `active` → `paused`, then target → `active` (handle unique index: pause others in DB first)
- `createPlan`: compute status via `resolveChinesePlanCreateStatus`; if `activateNow && hasActive`, pause others first then insert `active`
- `appendLessonRuns(planId, runs[])`: insert rows, patch runs store
- `advanceAfterSession(planId, { completedLessonKeysInBatch, nextCurrentLessonKey, bookFinished })`: patch plan `completed_lesson_keys`, `current_lesson_key`, maybe `status: 'completed'`

Select columns must match SQL. Book slug never updated in `savePlan` (omit from update payload or reject if changed).

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @rosie/chinese typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/chinese/src/hooks/useChineseRoadmapPlan.ts packages/chinese/src/index.ts
git commit -m "feat(chinese): add useChineseRoadmapPlan session store"
```

---

### Task 4: Admin manage + editor UI

**Files:**
- Create: `packages/chinese/src/components/plans/ChineseRoadmapPlanManage.tsx`
- Create: `packages/chinese/src/components/plans/ChineseRoadmapPlanEditor.tsx`
- Create: `packages/chinese/src/components/plans/ChinesePlanRoadmapPreview.tsx`
- Modify: `packages/chinese/src/index.ts`
- Create: `apps/web/src/app/admin/plans/chinese/page.tsx`
- Create: `apps/web/src/app/admin/plans/chinese/new/page.tsx`
- Create: `apps/web/src/app/admin/plans/chinese/[planId]/page.tsx`
- Modify: `apps/web/src/app/admin/plans/page.tsx`

**Interfaces:**
- Consumes: `useChineseRoadmapPlan`, `useChineseCharData` / lessons for book, `CHINESE_BOOKS`, `buildPlanRoadmapNodes`, `serializeQuizTypes`-style helpers for plan types
- Produces: default exports wired by route shells

- [ ] **Step 1: Hub card**

In `apps/web/src/app/admin/plans/page.tsx`, add to `PLAN_MODULES`:

```ts
{
  href: '/admin/plans/chinese',
  emoji: '📜',
  title: '语文计划',
  description: '按教材路线图推进：控制关卡与题型，暂停/恢复，查看每关练习记录',
  color: '#b45309',
  bg: 'rgba(245,158,11,.08)',
  border: 'rgba(245,158,11,.25)',
},
```

- [ ] **Step 2: List page shell + Manage**

Shell mirrors math admin chrome (`apps/web/src/app/admin/plans/math/page.tsx`). Manage shows plans sorted by `updatedAt`, status badge, activate/pause/edit links, CTA `+ 创建计划` → `/admin/plans/chinese/new`.

- [ ] **Step 3: Editor**

**New (`editPlanId` undefined):**
- Book select (`CHINESE_BOOKS`)
- Start lesson select (lessons for book, pedagogical order; exclude `happy_reading`)
- K number input 1–10
- Quiz type toggles for `CHINESE_PLAN_QUIZ_TYPES` with labels 认字/笔顺/词语检测/阅读题/看拼写字
- Title (default `${book.label}计划`)
- Checkbox「创建后立即激活」(maps to `activateNow`)
- Save → `createPlan` → router.push list

**Edit:**
- Book: read-only text
- Editable: title, current lesson, K, quiz types
- Buttons: 暂停 / 恢复（`pausePlan` / `activatePlan`）
- Embed `ChinesePlanRoadmapPreview` + list recent runs for selected lesson

Load lessons: use `useChineseCharData(user)` filtered by editor `bookSlug` (new) or plan.bookSlug (edit). Do not call `setActiveBook` from admin unless necessary — pass bookSlug into data fetch if hook supports filter; if `useChineseCharData` is tied to active book, temporarily document that admin editor uses `getChineseBook` + existing fetch pattern from `useChineseRoadmapProgress`’s catalog fetch, or add optional `bookSlug` override prop to a thin `useChineseBookCatalog(bookSlug)` helper in this task (preferred: small fetch in editor via supabase for lessons of that book only — keep in package).

Minimal catalog fetch inside editor (avoid fighting global active book):

```ts
// packages/chinese/src/hooks/useChineseBookLessons.ts
export function useChineseBookLessons(bookSlug: ChineseBookSlug | null): {
  lessons: ChineseLessonRow[]
  lessonGroups: LessonCharGroup[]
  isLoading: boolean
}
```

Reuse fetch logic from `useChineseRoadmapProgress` / `useChineseCharData` (extract shared `fetchBookRoadmapCatalog` if not already exported).

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter @rosie/chinese typecheck
pnpm --filter web typecheck
git add packages/chinese/src/components/plans \
  packages/chinese/src/hooks/useChineseBookLessons.ts \
  packages/chinese/src/index.ts \
  apps/web/src/app/admin/plans
git commit -m "feat(chinese): admin roadmap plan manage and editor"
```

---

### Task 5: Practice session settle → runs + advance

**Files:**
- Modify: `packages/chinese/src/components/chars/ChineseCharsPracticeSession.tsx`
- Modify: `packages/chinese/src/utils/chinese-practice-session-snapshot.ts` (optional: persist `planId` in snapshot if mid-exit)
- Test: extend `apps/web/tests/chinese-roadmap-plan-logic.test.ts` if adding `summarizeSessionForPlan` helper

**Interfaces:**
- Consumes: `useChineseRoadmapPlan`, `isLessonCompleteForPlan`, `currentBatchLessonKeys`
- Produces: on phase `done`, if `searchParams.get('planId')` set:
  - build per-lesson run payloads from session counters
  - `appendLessonRuns`
  - for each lesson in batch with `isLessonCompleteForPlan` → collect keys
  - `advanceAfterSession`

- [ ] **Step 1: Add helper `summarizeLessonPhases`**

In `chineseRoadmapPlanLogic.ts`:

```ts
/** Map PracticeSessionPlan content for one lessonKey → present phase names */
export function presentPhasesForLesson(
  lessonKey: string,
  lessonKind: string,
  plan: {
    charQuestions: { lessonKey: string; quizType?: string; track?: string }[]
    phraseItems: { lessonKey: string }[]
    poems: { unit: number; source?: string; lesson?: number }[]
    accumulationItems: { unit: number }[]
    readingLessons: { lessonKey: string }[]
    pinyinWriteItems: { lessonKey: string }[]
  },
  lessonMeta: { unit: number; lesson: number },
): string[]
```

Implement by filtering plan arrays belonging to that lesson/unit (match existing `poemMatchesLesson` rules — export or duplicate thin check).

- [ ] **Step 2: Wire settle in practice session**

Near done/settlement UI (where moons finalize):

```ts
const planId = searchParams.get('planId')
// after user finishes (phase === 'done' first mount effect, once):
// 1) compute per-lesson present/finished from session tracking
// 2) appendLessonRuns(...)
// 3) advanceAfterSession(...)
```

Track finished phases during the session (extend existing `correctCounts` or add `finishedPhasesByLesson: Record<string, Set<string>>` updated when a phase for that lesson completes). Keep minimal: on settle, if all items of a phase were answered, mark phase finished for involved lessons.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @rosie/chinese typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/chinese/src/components/chars/ChineseCharsPracticeSession.tsx \
  packages/chinese/src/utils/chineseRoadmapPlanLogic.ts \
  packages/chinese/src/utils/chinese-practice-session-snapshot.ts \
  apps/web/tests/chinese-roadmap-plan-logic.test.ts
git commit -m "feat(chinese): write plan lesson runs and advance on practice settle"
```

---

### Task 6: Today + daily card/page integration

**Files:**
- Modify: `packages/chinese/src/components/ChineseDailyCard.tsx`
- Modify: `packages/chinese/src/components/ChineseDailyPage.tsx`
- Modify: `packages/chinese/src/hooks/useChineseRoadmapProgress.ts` — optional: export helper `buildActivePlanPracticeHref(plan, orderedLessonKeys)`
- Modify: `apps/web/src/components/today/TodayDashboard.tsx`
- Modify: `apps/web/src/components/today/TodayPracticeRecords.tsx`
- Modify: `apps/web/src/components/today/TodayPlanOverview.tsx` if it hardcodes chinese href

**Interfaces:**
- Produces:
  - `export function buildChinesePlanPracticeHref(plan: ChineseRoadmapPlan, batchKeys: string[]): string`
    → `/chinese/chars/practice?lessons=${batchKeys.join(',')}&types=${plan.quizTypes.join(',')}&planId=${plan.id}`

- [ ] **Step 1: Helper + daily surfaces**

When `activePlan` exists and `activePlan.bookSlug` matches (or force book from plan):

- `ChineseDailyCard` / `ChineseDailyPage` / TodayDashboard chinese href use `buildChinesePlanPracticeHref`
- Subtitle shows plan current lesson title + quiz type summary
- If `activePlan.status === 'completed'`, show 通关 CTA to roadmap/weekly page

Ensure active book aligns: if `useActiveChineseBook()` ≠ plan.bookSlug, daily card should still link with plan’s lessons (practice session uses `bookSlug` from context — **must** switch active book or pass book in URL). Prefer: when rendering with active plan, call existing book setter / navigate under `/chinese/${plan.bookSlug}/...` if routes are book-scoped; practice is at `/chinese/chars/practice` using context book — so on today click, set active book to `plan.bookSlug` before navigate, or add `?book=` support. Spec:「活动册以计划 book_slug 为准」.

Concrete approach in this task:

1. Export `setActiveChineseBook` from `useActiveChineseBook` if not already
2. Before router.push to practice, `setActiveChineseBook(plan.bookSlug)`

- [ ] **Step 2: TodayPracticeRecords**

- Load `activePlan` + `loadRunsForPlan(activePlan.id)`
- Replace `chinese_weekly_plans` progress block with latest run summary (accuracy, completed, finishedAt) for current lesson
- Keep pending banner href = plan practice href

Remove hard dependency on `useChineseWeeklyPlan` in this file if only used for chinese display (leave import only if still needed elsewhere in file).

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @rosie/chinese typecheck
pnpm --filter web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/chinese/src/components/ChineseDailyCard.tsx \
  packages/chinese/src/components/ChineseDailyPage.tsx \
  packages/chinese/src/hooks/useActiveChineseBook.ts \
  packages/chinese/src/utils/chineseRoadmapPlanLogic.ts \
  packages/chinese/src/index.ts \
  apps/web/src/components/today
git commit -m "feat(chinese): drive today and daily tasks from active roadmap plan"
```

---

### Task 7: Docs + manual QA checklist

**Files:**
- Modify: `packages/chinese/CLAUDE.md`
- Modify: root `CLAUDE.md` only if admin plans table listing mentions subjects (optional one-line)

- [ ] **Step 1: Update `packages/chinese/CLAUDE.md`**

Add tables to data model; setup step for `packages/chinese/sql/chinese-roadmap-plans.sql`; note admin routes; note weekly plans deprecated for today path.

- [ ] **Step 2: Manual QA** (human or browser)

1. Run SQL in Supabase
2. `/admin/plans` → 语文计划 → create g1b plan with subset of quiz types, activate
3. Confirm second create is paused or activate pauses first
4. Edit: book not editable; change K / types / current lesson
5. `/today` opens practice with `planId` + types
6. Finish a normal lesson → run row + pointer advances
7. On garden lesson → poems/accumulation appear; cannot advance until those done
8. Pause plan → today falls back to mastery roadmap

- [ ] **Step 3: Commit**

```bash
git add -f packages/chinese/CLAUDE.md
git commit -m "docs(chinese): document roadmap plans in CLAUDE.md"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| New tables + RLS | Task 1 |
| One active; pause/resume/modify | Tasks 3–4 |
| Book locked after create | Task 4 editor |
| Plan-level quiz types (5) | Tasks 2, 4 |
| K lessons batch; no calendar | Tasks 2, 5–6 |
| Per-plan roadmap progress | Tasks 2, 4 preview |
| Per-lesson runs visible | Tasks 1, 3, 4, 6 |
| Today integration | Task 6 |
| Garden poems/accumulation rule A | Task 2 `isLessonCompleteForPlan`, Task 5 |
| Keep `chinese_weekly_plans` | No delete tasks |
| Session store | Task 3 |

No TBD placeholders left in steps. Types named consistently `ChineseRoadmapPlan*`.
