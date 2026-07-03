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
  chinese/   @rosie/chinese — 语文：生字认读/会写、古诗背诵、周计划（一年级下册首批）
```

**Dependency DAG (no cycles):** everything → `core`. `ui`→rewards; `player` is standalone;
`math`→ui,rewards; `english`→player,ui,rewards; `chinese`→ui,rewards; `flipbook`→english,player; `audio`→flipbook,
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

**Before extracting the next module, read [`docs/bug-report.md`](docs/bug-report.md)**
— the bugs/gotchas from this migration + a per-module extraction checklist. The most common
miss: every new `packages/<x>/src` with JSX needs an `@source` line in `globals.css`, or its
Tailwind classes won't be generated (a styling break that the build does NOT catch).

**Styling ownership:** `apps/web/src/app/globals.css` holds ONLY global/shared styles — the Tailwind
import + `@source` scan list, theme tokens (`@theme`, design-token `:root`), shared `@keyframes`
exposed as `animate-*` utilities, and cross-package animations. **Module-specific CSS (custom
classes, module-scoped CSS vars, single-module keyframes) lives inside its own package** as a plain
`.css` file imported once from within the package (e.g. `packages/english/src/english.css` via
`index.ts`, `packages/flipbook/src/flipbook.css` via `FlipbookLayoutEffects`,
`packages/math/.../gong/gong.css` via `shared.tsx`). These plain CSS files are NOT Tailwind-processed
— Tailwind utility classes used by the components are still generated from `globals.css`'s `@source`.

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

### Subject modules — read the package CLAUDE.md, not here

Each subject module is its own package with an authoritative in-package `CLAUDE.md`. To work on a
module, **read that package's CLAUDE.md** (scoped, up to date) instead of relying on this file:

| Module | Package | Routes | Guide |
|--------|---------|--------|-------|
| 口算 | `@rosie/calc` | `apps/web/src/app/calc/**` (thin shells) | `packages/calc/CLAUDE.md` |
| 数学 | `@rosie/math` | `apps/web/src/app/math/**` | `packages/math/CLAUDE.md` |
| 英语 | `@rosie/english` | `apps/web/src/app/english/**` | `packages/english/CLAUDE.md` |
| 绘本 | `@rosie/flipbook` | `apps/web/src/app/flipbook/**` | `packages/flipbook/CLAUDE.md` |
| 音频 | `@rosie/audio` | `apps/web/src/app/audio/**`, `/admin/audio` | `packages/audio/CLAUDE.md` |

Shared foundations: `@rosie/core` (Supabase, contexts, types, constants, utils), `@rosie/ui`,
`@rosie/rewards` (stars/wallet/vouchers), `@rosie/player` (playback engine + `PlayerDock`).
Adding a new math lesson is a guided flow — see `.claude/skills/add-lesson` + `docs/add-new-lesson.md`.

### Data Flow

All data hooks (`useWordMastery`, `useMathSolved`, `useWordData`, `useWeeklyPlan`, etc.) read and write Supabase directly. Each hook receives `user: User | null` from `AuthContext` and does nothing when `user` is null.

`localStorage` is used only for UI preferences — never for user data. The only remaining key is `MATH_SIDEBAR_COLLAPSED` (sidebar collapse state) in `STORAGE_KEYS` (`@rosie/core` constants). All other user configuration (including plan generation parameters) is stored in Supabase.

`AuthContext` (in `@rosie/core`) wraps the entire app and exposes `user`. Per-subject state lives in
its own context (e.g. `WordsContext` for English; per-lesson `LessonNProvider` for math, built by the
`createLessonProvider` factory in `@rosie/math`). Module-specific details live in each package's CLAUDE.md.

### Weekly Planning System (cross-cutting)

Both math and English share a weekly plan system with the same Thursday-start week convention:

- `WeeklyPlan` / `MathWeeklyPlan` — stored in Supabase (`weekly_plans` / `math_weekly_plans` tables); each plan includes `weekStartDay` and `newWordsPerDay`/`problemsPerDay` as dedicated integer columns
- `useWeeklyPlan` / `useMathWeeklyPlan` — hooks managing plan generation and daily progress
- `/today` — unified dashboard showing both English and math daily tasks

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
- Shared types live in `@rosie/core` (re-exported per package as needed); a package keeps its own narrow types local

### Naming

- Components: `PascalCase.tsx` (e.g. `FlashCard.tsx`)
- Hooks and utilities: `camelCase.ts` (e.g. `useWordMastery.ts`, `english-helpers.ts`)
- Shared constants (including `STORAGE_KEYS`) and utility helpers (including `todayStr`) live in `@rosie/core`
