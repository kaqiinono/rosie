# @rosie/chinese

The Chinese module — **生字** (recognize + write tracks) + **古诗** — extracted as a standalone
workspace package.

**Scope rule for agents:** change Chinese behavior in this package only. Reach into `@rosie/core` /
`@rosie/ui` / `@rosie/rewards` for shared primitives. Do not import other subject modules.

## What's inside

- **Chars (`components/chars/`)** — flash cards, pinyin quiz, **hanzi-writer 笔顺书写** (`CharWriter`).
- **Poems (`components/poems/`)** — poem list + fill-in-blank recite flow.
- **`ChineseContext`** — aggregates `useCharMastery`, `useChineseCharData`, `useChineseWeeklyPlan`.
- **`utils/grade1-down/`** — **backup only** (一年级下册 TS); used to generate SQL upserts, not runtime.
- **`utils/chinese-helpers.ts`** — `charKey`, lesson char lookups, shuffle; re-exports `getWeekStart`.

## Data model (DB-first)

Runtime reads Supabase (like English `word_entries`):

| Table | Role |
|-------|------|
| `chinese_char_entries` | 一字一档：拼音、部首、笔顺、组词（`phrases[]`）— 部首/笔顺 NOT NULL |
| `chinese_lessons` | 课文元数据 + `recall_phrases[]`（读一读记一记整句） |
| `chinese_lesson_chars` | 课 ↔ 字编排：认读/会写、顺序、课内拼音 |
| `chinese_char_mastery` | 用户掌握度（认读/会写分轨） |
| `chinese_weekly_plans` | 用户周计划 |

**Setup (Supabase SQL editor, in order):**

1. `docs/sql/chinese-char-mastery.sql`
2. `docs/sql/chinese-weekly-plans.sql`
3. `docs/sql/chinese-char-entries.sql`
4. `docs/sql/chinese-g1-down/` — 按 README 顺序灌库，完成后跑 `99-verify.sql` 校验
5. `docs/sql/chinese-wrong-items.sql` — 错题本（可选，未建则错题不落库）
6. `docs/sql/chinese-char-entries-admin-rls.sql` — 字词维护页写权限（`/admin/chinese`）

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

## Weekly plan

- Table `chinese_weekly_plans`; defaults: Thursday week start, 4 new recognize / 3 new write per day.
- Days generated from `chinese_lessons.sort_order` via `lessonGroups` from `useChineseCharData`.

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
园地识字加油站测验：`/chinese/garden`（从日积月累页入口）。
Add `@source` for `packages/chinese/src` in `apps/web/src/app/globals.css` when wiring routes.

## Commands

```bash
pnpm --filter @rosie/chinese typecheck
pnpm --filter @rosie/chinese lint
pnpm --filter @rosie/chinese verify-data
pnpm --filter @rosie/chinese generate-sql
```
