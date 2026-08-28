# @rosie/chinese

The Chinese module — **生字** (recognize + write tracks) + **古诗** — extracted as a standalone
workspace package.

**Scope rule for agents:** change Chinese behavior in this package only. Reach into `@rosie/core` /
`@rosie/ui` / `@rosie/rewards` for shared primitives. Do not import other subject modules.

## What's inside

- **Chars (`components/chars/`)** — flash cards, pinyin quiz, **hanzi-writer 笔顺书写** (`CharWriter`).
- **Page chrome (`components/ChinesePageLayout.tsx`)** — shared responsive page shell and heading
  specification for book home / 今日 / 生字 / 阅读 / 古诗 / 积累 pages. Use a width variant instead
  of introducing one-off page gutters or heading sizes.
- **Poems (`components/poems/`)** — poem list + fill-in-blank recite flow.
- **`ChineseContext`** — aggregates `useCharMastery`, `useChineseCharData`, `useChineseWeeklyPlan` (legacy).
- **Roadmap plans (`hooks/useChineseRoadmapPlan.ts`, `components/plans/`)** — parent-managed study plans; `/today` prefers active plan over mastery roadmap.
- **`utils/g1b/` · `utils/g2a/` · `utils/g2b/`** — per-book textbook TS (一下 / 二上 / 二下). 生字/组词数据（`chars.ts`/`phrases.ts`）是 **备份**，用于生成 SQL upsert（运行时字表读 Supabase）；单元/课文/古诗/日积月累/类型（`units.ts`/`lesson-passages.ts`/`poems.ts`/`accumulation.ts`/`types.ts`/`stats.json`）在**运行时**通过 barrel 消费。
- **`utils/chinese-helpers.ts`** — `charKey`, lesson char lookups, shuffle; re-exports `getWeekStart`.

## Data model (DB-first)

Runtime reads Supabase (like English `word_entries`):

| Table                              | Role                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `chinese_char_entries`             | 一字一档：拼音、部首、笔画数、组词（`phrases[]`）— 笔顺由 hanzi-writer 客户端加载 |
| `chinese_lessons`                  | 课文元数据 + `recall_phrases[]`（读一读记一记整句）                               |
| `chinese_lesson_chars`             | 课 ↔ 字编排：认读/会写、顺序、课内拼音                                            |
| `chinese_char_mastery`             | 用户掌握度（认读/会写分轨）                                                       |
| `chinese_weekly_plans`             | 用户周计划（legacy；`/today` 不再走此路径）                                       |
| `chinese_roadmap_plans`            | 路线图学习计划：教材、起始/当前课、每批 K 关、题型子集、状态、已完成课            |
| `chinese_roadmap_plan_lesson_runs` | 计划内每关练习记录（正确率、`by_type`、是否完成）                                 |

**Setup (Supabase SQL editor, in order):**

1. `docs/sql/chinese-char-mastery.sql`
2. `docs/sql/chinese-weekly-plans.sql`
3. `docs/sql/chinese-char-entries.sql`
4. `docs/sql/chinese-g1b/` — 按 README 顺序灌库，完成后跑 `99-verify.sql` 校验
5. 若库内仍有旧前缀 `g1-下::`，执行 `docs/sql/chinese-migrate-char-key-g1b.sql`（增量，不删数据）
6. `docs/sql/chinese-drop-stroke-order.sql` — 删除 `stroke_order` 列以减小字表体积（可选，与新版 app 配套）
7. `docs/sql/chinese-wrong-items.sql` — 错题本（可选，未建则错题不落库）
8. `docs/sql/chinese-char-entries-admin-rls.sql` — 字词维护页写权限（`/admin/chinese`）
9. `packages/chinese/sql/chinese-roadmap-plans.sql` — 路线图计划表 + 练习记录表 + RLS（`/admin/plans/chinese`、 `/today` 语文入口）

Regenerate upsert after editing TS backup:

```bash
pnpm --filter @rosie/chinese generate-sql
```

课文原文（单元页展示）：`lesson-passages.ts`，由 `python3 packages/chinese/scripts/extract-lesson-passages.py` 从 `curated_passages_data.py` 生成（28 课全文已校对，非 PDF 自动提取）。

Requires `hanzi-writer-data` (devDependency) for stroke order.

## Mastery model

- Table `chinese_char_mastery`: composite key `(user_id, char_key, track)` where `track` is
  `recognize` | `write`.
- Spaced repetition via `@rosie/core` `masteryUtils` (`advanceStage` / `regressStage`).

## Weekly plan (legacy)

- Table `chinese_weekly_plans`; defaults: Thursday week start, 4 new recognize / 3 new write per day.
- Days generated from `chinese_lessons.sort_order` via `lessonGroups` from `useChineseCharData`.
- **Not the `/today` path anymore** — `/today` uses an active `chinese_roadmap_plans` row when present, otherwise falls back to mastery-based roadmap (`useChineseRoadmapProgress`).

## Roadmap plans

Parent creates/manages plans in admin; child executes from `/today` or `/chinese`.

- **Hooks:** `useChineseRoadmapPlan` (CRUD, pause/activate, lesson runs, pointer advance) + `useChineseRoadmapProgress` (mastery roadmap fallback). Session stores: `chinese_roadmap_plans`, `chinese_roadmap_plan_runs`.
- **One active plan per user** (DB unique index); creating/activating a second plan pauses the first. Book (`book_slug`) is locked after create; editor may change title, `lessons_per_batch` (K), `quiz_types`, and `current_lesson_key`.
- **Quiz types (plan-level subset of 5):** `recognize`, `stroke`, `phrase`, `passage`, `pinyin-write`. Practice URL: `/chinese/chars/practice?lessons=…&types=…&planId=…` via `buildChinesePlanPracticeHref`.
- **Batching:** K lessons per batch from `current_lesson_key`; no calendar dates. After a session, `advanceAfterSession` appends runs and moves the pointer.
- **Garden / 园地:** when a lesson has poems or accumulation content, those phases are always required (`isLessonCompleteForPlan`) even if not in `quiz_types`; pointer cannot advance until done.
- **Status:** `active` | `paused` | `completed` | `archived`. Paused or no plan → `/today` shows mastery roadmap progress instead.

### Manual QA checklist

1. Run `packages/chinese/sql/chinese-roadmap-plans.sql` in Supabase SQL editor.
2. `/admin/plans` → 语文计划 → create a g1b plan with a subset of quiz types; activate it.
3. Confirm a second create is paused by default, or activating it pauses the first active plan.
4. Edit plan: book is not editable; change K, quiz types, and current lesson — save succeeds.
5. `/today` → 语文 card opens practice with `planId` + selected types in the URL.
6. Finish a normal (non-garden) lesson → a run row appears in plan editor; plan pointer advances.
7. On a garden (园地) lesson → poems/accumulation phases appear; pointer does not advance until those are completed.
8. Pause the plan → `/today` falls back to mastery roadmap (no plan-driven practice link).

## Dependencies

- **`@rosie/core`** — Supabase, auth, `masteryUtils`, `getWeekStart`, shared mastery types.
- **`@rosie/ui`** / **`@rosie/rewards`** — shared chrome and gamification.
- npm: `react`, `next`, `clsx`, `@supabase/supabase-js`.

Chinese must never depend on another subject-module package.

## Public API

Single barrel (`src/index.ts`). Components exported as named barrel exports
(`export { default as CharFlashCard }`).

Imports **within** this package are **relative**. No path alias.

## App integration

Routes live in `apps/web/src/app/chinese/**` (parent creates thin shells).
Admin字词维护：`/admin/chinese` → `apps/web/src/components/admin/chinese/`.
Admin路线图计划：`/admin/plans/chinese`（列表）、`/admin/plans/chinese/new`（创建）、`/admin/plans/chinese/[planId]`（编辑/记录）→ thin shells in `apps/web/src/app/admin/plans/chinese/`; UI from `@rosie/chinese` (`ChineseRoadmapPlanManage`, `ChineseRoadmapPlanEditor`).
园地识字加油站测验：`/chinese/garden`（从日积月累页入口）。
Add `@source` for `packages/chinese/src` in `apps/web/src/app/globals.css` when wiring routes.

## Commands

```bash
pnpm --filter @rosie/chinese typecheck
pnpm --filter @rosie/chinese lint
pnpm --filter @rosie/chinese audit-card-phrases
pnpm --filter @rosie/chinese enrich-card-phrases -- --apply
pnpm --filter @rosie/chinese verify-data
pnpm --filter @rosie/chinese generate-sql
```
