# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

This repo is a **pnpm workspace + Turborepo**. There is exactly one deployable Next.js app
(single Vercel project / single domain); every subject module is its own package so it can be
worked on and type-checked in isolation. Each package has its own `CLAUDE.md`.

```
apps/web/          # the Next.js app — ALL routes live here; Vercel Root Directory = apps/web
packages/
  core/      @rosie/core    — Supabase client, AuthContext, ImmersiveContext, shared types,
                              constants, masteryUtils, getWeekStart, confetti, nav/SW hooks
  ui/        @rosie/ui      — shared presentational components (buttons, chrome, backgrounds)
  rewards/   @rosie/rewards — gamification: stars HUD, coin wallet, vouchers
  player/    @rosie/player  — content-agnostic playback engine + PlayerDock + media types
  calc/      @rosie/calc    — 口算
  math/      @rosie/math    — 人教版 lessons 12–44 + sea + catalog + quiz + weekly plan
  english/   @rosie/english — vocabulary (cards/quiz/spelling/weekly plan/mastery) + reading
  flipbook/  @rosie/flipbook— PDF flipbook reader (books with audio)
  audio/     @rosie/audio   — audio_assets, collections/favorites, /audio page, admin audio
```

**Dependency DAG (no cycles):** everything → `core`. `ui`→rewards; `player` is standalone;
`math`→ui,rewards; `english`→player,ui,rewards; `flipbook`→english,player; `audio`→flipbook,
english,player. A package must never import another subject module outside this DAG, and
`core`/`ui`/`rewards`/`player` never import a subject module.

**Imports & routes:** routes stay in `apps/web/src/app/**` and import the packages. Most
packages expose a **barrel** (`@rosie/english`, named exports). `@rosie/calc` page bodies are
imported by thin route shells via subpath (`@rosie/calc/pages/<name>`, exports map with
explicit `.tsx`). `@rosie/math` uses **deep subpaths** (`@rosie/math/components/lessonNN/...`)
because every lesson shares export names — this needs extensionless `exports` `"./*":"./src/*"`
plus a `paths` alias in BOTH `apps/web/tsconfig.json` and `packages/math/tsconfig.json` (see
`packages/math/CLAUDE.md`). Inside a package, cross-file imports are **relative**. Packages are
wired into the app via `transpilePackages` in `apps/web/next.config.ts`.

**Media note:** the reading and flipbook pages build their own play queues via `@rosie/player`
directly (连播 within their own scope, no ❤️favorites) so they don't depend on `@rosie/audio`;
`@rosie/audio` aggregates reading/flipbook content one-way.

## Commands

All commands run from the repo root; Turborepo fans them out across workspaces.

```bash
pnpm install                              # install all workspaces
pnpm dev                                  # dev server (turbo → web, Turbopack)
pnpm build                                # production build (turbo)
pnpm start                                # preview production build
pnpm lint                                 # lint all packages
pnpm typecheck                            # type-check all packages

# scoped to one module (the AI-context / fast-feedback win):
pnpm --filter @rosie/calc typecheck
pnpm --filter web build
```

No test suite gate is configured (Vitest exists under `apps/web/tests`). After any logic
change, run `pnpm lint`/`pnpm typecheck` to catch type errors. Before merging UI changes, run
`pnpm build` to confirm no TypeScript errors.

> **Keeping this file up to date:** When architecture, data flow, conventions, or tooling change, update CLAUDE.md in the same commit. Module-specific guidance lives in that package's own CLAUDE.md (e.g. `packages/calc/CLAUDE.md`).

## Environment Variables

Required for Supabase auth and cloud sync:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Without these, auth will fail. The app requires login — there is no guest mode.

Optional (enables the word-library auto-fill feature in `/admin/words`):

```
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=   # optional, defaults to claude-haiku-4-5-20251001
```

If `ANTHROPIC_API_KEY` is unset, the `/api/word-enrich` route returns 503 and the client auto-fill falls back to the free dictionary API (dictionaryapi.dev).

Locally, env lives in `apps/web/.env.local` (moved there with the app in the monorepo migration).

## Deploying to Vercel

One Vercel project, one domain. Because the Next.js app lives in `apps/web` (not the repo
root), the project's **Root Directory must be set to `apps/web`** (Settings → General → Root
Directory). Keep **"Include files outside of the Root Directory in the Build Step"** enabled
(default) so the build can reach `packages/*` and the workspace root (`pnpm-workspace.yaml`,
`pnpm-lock.yaml`). That's the only manual setting.

Everything else is handled in-repo: `apps/web/vercel.json` (read from the Root Directory) pins
`framework: nextjs`, `installCommand: pnpm install`, `buildCommand: next build`, plus the SW/PWA
cache headers and rewrites; Vercel auto-detects pnpm from the root lockfile + `packageManager`.
The `@rosie/*` packages compile via `transpilePackages` in `apps/web/next.config.ts`. Production
env vars (`NEXT_PUBLIC_SUPABASE_*`, optional `ANTHROPIC_API_KEY`) live in Vercel and are
unaffected by the migration. Optional: enable Turborepo Remote Caching (Vercel detects
`turbo.json`) to skip unchanged-package rebuilds.

## Architecture

This is a Next.js 15 App Router PWA for elementary school math and English learning, targeting a single child (Rosie). **Login is required** — Supabase is the sole data store. The app is almost entirely client-side with SSG; the only server code is a single Route Handler, `src/app/api/word-enrich/route.ts`, which proxies the Claude API for word auto-fill so the API key stays server-side.

### Admin (`/admin`)

`/admin` is a parent/admin hub (card menu). Sub-pages:
- `/admin/awards` — stars & voucher management (was previously at `/admin`)
- `/admin/words` — word-library (vocabulary) CRUD: stage = 词库, per-row add/edit/delete, single add (with AI auto-fill), and batch add (xlsx upload + paste). Uses `useWordData`'s per-row mutations (`addWords`/`updateWord`/`deleteWord`/`deleteStage`/`renameStage`), NOT the destructive `upsertByStage`.
- `/admin/audio` — 独立媒体（`audio_assets`）增删改查 + 收藏夹侧栏（无 tab）。上传媒体会自动加入当前选中的可收藏收藏夹。底部为共享 `<PlayerDock>`。
- `/admin/word-audit` — read-only data audit

### Audio System

Unified audio playback across the app:
- **`useAudioCollections(user)`** (`src/hooks/`) aggregates four kinds of "collection" (`AudioCollection`): `favorites`(我的最爱, DB-persistent via `audio_playlists.is_favorite`), `reading`/`flipbook`(virtual, derived from passages/books with audio), and user playlists. Exposes `toggleFavorite`, `membership(bucket,path)`, `favoriteKeySet`, and playlist CRUD. Auto-creates the favorites playlist.
- **`usePlaylistPlayer()`** (`src/hooks/`) is the single playback engine (one `<video>` media element app-wide). Loop modes 顺序/单曲/列表 (`order`/`one`/`all`) + loop count (count applies to current mode), `play`/`enqueue`/`prev`/`next`/`stop`.
- **`<PlayerDock>`** (`src/components/audio/`) is the shared bottom player UI (transport, loop mode, loop count, favorite heart). Used by `/audio`, `/flipbook`, reading index, and `/admin/audio`.
- **`<CollectionPills>`** shows which collections a track belongs to, with × to remove.
- **`/audio`** — kid-facing (dark) listening page: switch collections, build a transient play queue from cards or whole collections.
- Tables: `audio_assets`, `audio_playlists`(+`is_favorite`), `audio_playlist_items`. Migration: `docs/sql/audio-favorites-migration.sql` (run manually in Supabase).

### Data Flow

All data hooks (`useWordMastery`, `useMathSolved`, `useWordData`, `useWeeklyPlan`, etc.) read and write Supabase directly. Each hook receives `user: User | null` from `AuthContext` and does nothing when `user` is null.

`localStorage` is used only for UI preferences — never for user data. The only remaining key is `MATH_SIDEBAR_COLLAPSED` (sidebar collapse state) in `STORAGE_KEYS` (`src/utils/constant.ts`). All other user configuration (including plan generation parameters) is stored in Supabase.

The `AuthContext` (`src/contexts/AuthContext.tsx`) wraps the entire app and exposes `user`.

### Context Architecture

- `AuthContext` — Supabase auth session, sign in/up/out
- `WordsContext` — aggregates vocab (`useWordData`), mastery (`useWordMastery`), and filter state for the English module. All English sub-pages consume this context via `useWords()`.
- `Lesson34Provider` / `Lesson35Provider` / `Lesson36Provider` — per-lesson context for math problem solving state (solved set, wrong-answer set, toast, congrats modal). All three are created via `createLessonProvider` factory in `src/components/math/shared/createLessonProvider.tsx`

### Math Module

Each lesson (`34`, `35`, `36`) follows the same structure:

```
/math/ny/{lessonId}/                     # lesson hub (HomePage component)
/math/ny/{lessonId}/lesson/              # problem list
/math/ny/{lessonId}/lesson/[id]/         # problem detail
/math/ny/{lessonId}/homework/[id]/       # same for homework
/math/ny/{lessonId}/workbook/[id]/       # same for workbook
/math/ny/{lessonId}/pretest/[id]/        # same for pretest
/math/ny/{lessonId}/alltest/             # full problem bank
/math/ny/{lessonId}/mistakes/            # wrong-answer review
/math/ny/{lessonId}/magic/               # weekday drill (lesson 36 only)
```

Problem data lives in `src/utils/lesson34-data.ts`, `src/utils/lesson35-data.ts`, and `src/utils/lesson36-data.ts` as `ProblemSet` objects (`pretest`, `lesson`, `homework`, `workbook` arrays of `Problem`).

The `Problem` type (`src/utils/type.ts`) supports interactive diagrams via `type: 'ratio3' | 'ratio3b' | 'none'`, `blockScene`, and `dualSc` fields — these drive `RatioDiagram`, `BlockDiagram`, and `DualBlockDiagram` components (lesson 35 only).

**Shared math components** (`src/components/math/shared/`) eliminate duplication across lessons:
- `createLessonProvider.tsx` — factory that creates context + provider + hook for each lesson
- `LessonAppHeader.tsx` — configurable header with back button, logo, progress chip, nav links
- `LessonBottomNav.tsx` — configurable mobile bottom navigation
- `LessonSidebar.tsx` — configurable sidebar with sections, collapse state, and optional extra links
- `LessonProblemList.tsx` — configurable problem list grid with mastery indicators and tag filtering

Each lesson directory (`lesson34/`, `lesson35/`, `lesson36/`) re-exports thin wrappers around these shared components, passing lesson-specific config (colors, labels, paths). Only `ProblemDetail` and `HomePage` remain per-lesson since they have significantly different visual content.

### English Module

All English pages share `WordsContext` via the layout at `src/app/english/words/layout.tsx`.

- Vocab is stored as `WordEntry[]` (unit, lesson, word, explanation, IPA, example, phonics fields)
- Words can be imported from Excel (`.xlsx`) using the `xlsx` package
- Mastery tracking uses a spaced-repetition stage system (0–8 stages, `WordMasteryInfo` in `src/utils/type.ts`, logic in `src/utils/masteryUtils.ts`)
- Weekly plans (`WeeklyPlan`) assign new words per day starting Thursday; `useWeeklyPlan` manages creation and progress

### Weekly Planning System

Both math and English have a weekly plan system with the same Thursday-start week convention:

- `WeeklyPlan` / `MathWeeklyPlan` — stored in Supabase (`weekly_plans` / `math_weekly_plans` tables); each plan includes `weekStartDay` and `newWordsPerDay`/`problemsPerDay` as dedicated integer columns
- `useWeeklyPlan` / `useMathWeeklyPlan` — hooks managing plan generation and daily progress
- `/today` — unified dashboard showing both English and math daily tasks

### 口算 Module (`/calc`) — now `@rosie/calc`

> This module has been extracted into `packages/calc` (see `packages/calc/CLAUDE.md` for the
> authoritative, in-package guide). Routes under `apps/web/src/app/calc/**` are thin shells
> re-exporting `@rosie/calc/pages/<name>`; `layout.tsx` and the `/calc/vouchers` redirect stay
> in the app. Calc types remain in `@rosie/core` (the rewards subsystem references them);
> wallet/voucher/stars live in `@rosie/rewards`. The architecture below is unchanged.

Mental-arithmetic practice. Question generation is **composable**, not a fixed level ladder:

- **Building blocks** (`src/utils/calc-blocks.ts`) — `BLOCKS` is a catalog of pure single-operation generators, each with a difficulty range and an `op`/`group` tag (加 `add` / 减 `sub` / 乘 `mul` / 除 `div`). Each block exposes `generateSingle()` (a standalone `CalcQuestion`) and `sampleTerm()` (a sub-term for mixed composition). Difficulty ordering is inherent: 加 < 减 < 乘 < 除 < 混合.
- **Mixed operations** (`src/utils/calc-mixed.ts`) — 7 fixed skeletons (`SKELETONS`: 加减/乘除 同级、加减与乘法、加减乘除全混合、3 个带括号变体). A `MixedOp` = `{ skeleton, blockIds, enabled }`; `assembleMixed()` builds a multi-operator `CalcQuestion` whose parts are drawn from the chosen blocks (guarantees non-negative integer answers + integer division). Parents compose these in `/calc/settings` via `MixedOpComposer`/`MixedOpList`.
- **AST primitives** live in `src/utils/calc-ast.ts` (`evalAst`/`renderAst`/`signatureOf`/`parseSignature`/`makeQuestion`). `signature` is the canonical key used for proficiency tracking.
- **Session building** (`buildSession` in `src/utils/calc-helpers.ts`) — sources = selected blocks ∪ enabled+valid mixed ops; question count is allocated across sources weighted toward weak ones (`w = 1 − proficiency/5`, with a per-source floor); block sources resurface ~35% weakest specific facts (via `parseSignature`) and generate the rest fresh; carried mistakes are appended. Each question is tagged with `sourceBlockId`/`sourceMixedOpId`.
- **Proficiency** (`useCalcProblemState`, `calc_problem_state` table) — lightweight 0–5 per `signature` (no spaced-repetition/adaptive ladder; that machinery was removed). Rows carry `block_id`/`mixed_op_id` attribution.
- **Mistakes** — wrong questions are appended to the **end** of the current session for make-up (redo until correct), and unresolved ones carry into the **next** session: next total = configured count + last session's unresolved count (`calc_mistakes.session_no`, `lastSessionUnresolved`). Resolved after 3 consecutive correct.
- **Reports** — `SessionSummary` shows per-source results + next-focus preview; `/calc/report` shows per-block / per-mixed mastery (avg proficiency) + weakest problems. Both share the same `calc_problem_state` proficiency.
- **State** is in `CalcSettings` (`selectedBlocks: string[]`, `mixedOps: MixedOp[]`, plus sound/count/time-limit). Tables: `calc_settings`, `calc_problem_state`, `calc_sessions`, `calc_mistakes`. Migration: `docs/sql/calc-redesign-migration.sql` (run manually). The old `calc_level_state`/`calc_event_log` tables are no longer written.

### PWA

- Service Worker: `public/sw.js` (Workbox CDN, no npm dependency)
- Manifest: `public/manifest.json`
- SW is registered via `ServiceWorkerRegistrar` component mounted in root layout
- `next.config.ts` sets no-cache headers for `sw.js` and `manifest.json`

**Offline / Service Worker notes:**
- SW caches HTML (NetworkFirst), JS/CSS (StaleWhileRevalidate), images (CacheFirst 30d)
- `pnpm dev` registers the SW, but Workbox loads from CDN — full offline requires network on first load
- When modifying offline behavior, always test in **`pnpm start` (preview) mode**, not `pnpm dev`. The SW behaves differently in development
- After changing `public/sw.js`, hard-reload the browser (the SW update cycle is async)

### Path Aliases

`@/` maps to `src/` (configured in `tsconfig.json`).

---

## Coding Standards

### Task Execution Workflow

1. Before modifying UI, check theme tokens in `src/app/globals.css` (Tailwind v4 uses CSS variables — there is no `tailwind.config.js`)
2. After any logic change, run `pnpm lint` to confirm no type errors
3. When modifying offline / Service Worker behavior, test in `pnpm start` (preview) mode, not `pnpm dev`

### Component Structure

- Use **function components** and **Hooks** exclusively
- File order: `imports` → `Interface/Types` → `component logic` → `JSX return`
- All client components must have `'use client'` at the top

### Tailwind CSS

- Tailwind CSS **v4** — PostCSS plugin, **no `tailwind.config.js`**. Theme customization goes in CSS variables inside `src/app/globals.css`
- Use Tailwind utility classes only; do not write raw CSS in `.css` files
- Follow **mobile-first**: write base classes first, then `md:` / `lg:` overrides
- For complex conditional class combinations, use `clsx` or `tailwind-merge`

### TypeScript

- **No `any`** — all props and state must have explicit types
- Use `type` for component props; use `interface` for API/Supabase response shapes
- All shared types live in `src/utils/type.ts`

### Naming

- Components: `PascalCase.tsx` (e.g. `FlashCard.tsx`)
- Hooks and utilities: `camelCase.ts` (e.g. `useWordMastery.ts`, `english-helpers.ts`)
- All shared constants (including `STORAGE_KEYS`) and utility helpers (including `todayStr`) live in `src/utils/constant.ts`
