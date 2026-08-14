# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

For long-running, repeatable maintenance work (knowledge sync, catalog generation, audits, and
similar bulk jobs), prefer a resumable local CLI under `scripts/` over agent-driven manual loops.
Such scripts should be idempotent, observable, rate-limit aware, safe to rerun, and documented in
the owning package guide.

## Monorepo layout

This repo is a **pnpm workspace + Turborepo**. There is exactly one deployable Next.js app
(single Vercel project / single domain); every subject module is its own package so it can be
worked on and type-checked in isolation. Each package has its own `AGENTS.md`.

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
  chinese/   @rosie/chinese — 语文：生字认读/会写、古诗背诵、周计划（一下 / 二上 / 二下）
  ai/        @rosie/ai — RAG 知识库 + Rosie Agent（/ai、ingest、STT）
```

**Dependency DAG (no cycles):** everything → `core`. `ui`→rewards; `player` is standalone;
`math`→ui,rewards; `english`→player,ui,rewards; `chinese`→ui,rewards; `ai`→core,ui,player;
`flipbook`→english,player; `audio`→flipbook, english,player. A package must never import another subject module outside this DAG, and
`core`/`ui`/`rewards`/`player` never import a subject module.

**Imports & routes:** routes stay in `apps/web/src/app/**` and import the packages. Most
packages expose a **barrel** (`@rosie/english`, named exports). `@rosie/calc` page bodies are
imported by thin route shells via subpath (`@rosie/calc/pages/<name>`, exports map with
explicit `.tsx`). `@rosie/math` uses **deep subpaths** (`@rosie/math/components/lessonNN/...`)
because every lesson shares export names — this needs extensionless `exports` `"./*":"./src/*"`
plus a `paths` alias in BOTH `apps/web/tsconfig.json` and `packages/math/tsconfig.json` (see
`packages/math/AGENTS.md`). Inside a package, cross-file imports are **relative**. Packages are
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
pnpm lint:theme                           # reject accidental system-dark styles on light pages
pnpm typecheck                            # type-check all packages

# scoped to one module (the AI-context / fast-feedback win):
pnpm --filter @rosie/calc typecheck
pnpm --filter web build
```

No test suite gate is configured (Vitest exists under `apps/web/tests`). After any logic
change, run `pnpm lint`/`pnpm typecheck` to catch type errors. Before merging UI changes, run
`pnpm build` to confirm no TypeScript errors.

> **Keeping this file up to date:** When architecture, data flow, conventions, or tooling change, update AGENTS.md in the same commit. Module-specific guidance lives in that package's own AGENTS.md (e.g. `packages/calc/AGENTS.md`).

## Environment Variables

Required for Supabase auth and cloud sync:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=       # production origin, used for password recovery redirects
```

Admin pages and shared-curriculum mutations require `app_metadata.role = "admin"`. During the
initial rollout, server API checks may additionally use comma-separated `ADMIN_USER_IDS` or
`ADMIN_EMAILS`; RLS always treats `app_metadata` as the authoritative role source.

Promote the initial parent account with the service-role Admin API (or Dashboard SQL) by setting
`raw_app_meta_data.role` to `admin`, then sign out and back in so the JWT contains the new claim.

Without these, auth will fail. The app requires login — there is no guest mode.

Optional (enables the word-library auto-fill feature in `/admin/words` and RAG / AI 助手 at `/ai` — OpenAI-compatible，如百炼）:

```
AI_EMBED_API_KEY=
AI_EMBED_BASE_URL=   # 业务空间 compatible-mode/v1
AI_EMBED_MODEL=      # optional embedding model（如 text-embedding-v4）
AI_EMBED_DIMENSIONS=1536
AI_CHAT_MODEL=       # /ai 对话 + /admin/words 填词（默认 qwen-plus）
AI_STT_MODEL=        # optional, defaults to whisper-1
```

`AI_CHAT_API_KEY` / `AI_CHAT_BASE_URL` 可单独覆盖 chat；未设则回退到 `AI_EMBED_*`。  
填词可单独覆盖：`AI_WORD_ENRICH_MODEL` / `AI_WORD_ENRICH_API_KEY` / `AI_WORD_ENRICH_BASE_URL`。

If `AI_EMBED_API_KEY` is unset, `/api/word-enrich` returns 503 and the client auto-fill falls back to the free dictionary API (dictionaryapi.dev).

`SUPABASE_SERVICE_ROLE_KEY` is also required for `/api/ai/knowledge/ingest` and catalog sync CLI (`pnpm ai:sync-catalog`). Without `AI_EMBED_API_KEY`, ingest / STT / chat return 503.

Optional (enables Pexels auto-fill for word images, `/api/word-image`, used by the word-library「自动配图」flow):

```
PEXELS_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is also used by `/api/forgot-password`. Both keys are server-only —
never expose them with a `NEXT_PUBLIC_` prefix. If `PEXELS_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
is unset, `/api/word-image` returns 503 (`no_pexels_key` / `no_service_role`).

API rate limiting uses `public.check_api_rate_limit` from migration `0006` with service-role-only
execution. Middleware stores only a SHA-256 identity hash and falls back to an instance-local
counter if the RPC is temporarily unavailable.

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
env vars (`NEXT_PUBLIC_SUPABASE_*`, optional `AI_EMBED_*`) live in Vercel and are
unaffected by the migration. Optional: enable Turborepo Remote Caching (Vercel detects
`turbo.json`) to skip unchanged-package rebuilds.

## Architecture

This is a Next.js 15 App Router PWA for elementary school math and English learning, targeting a single child (Rosie). **Login is required** — Supabase is the sole data store. The app is almost entirely client-side with SSG; server Route Handlers include `word-enrich` (百炼填词) and `/api/ai/*` (RAG 助手).

### Settings and Admin (`/setting`, `/admin`)

`/setting` is the signed-in user's configuration hub. It shows personal configuration cards to
every authenticated user (calc settings, learning plans, stars/vouchers, media collections) and
also shows the global configuration section when `app_metadata.role = "admin"`. Personal detail
routes live under `/setting/**` and always operate on the current `user.id`.

`/admin/**` is reserved for global management and remains wrapped by `AdminGuard`. The account
button in `AccountBar` links to `/setting`; legacy personal `/admin/calc`, `/admin/awards`, and
`/admin/plans/**` URLs redirect to their `/setting/**` equivalents.

Global admin sub-pages include:

- `/admin/awards` — stars & voucher management (was previously at `/admin`)
- `/admin/words` — word-library (vocabulary) CRUD: stage = 词库, per-row add/edit/delete, single add (with AI auto-fill), and batch add (xlsx upload + paste). Uses `useWordData`'s per-row mutations (`addWords`/`updateWord`/`deleteWord`/`deleteStage`/`renameStage`), NOT the destructive `upsertByStage`.
- `/admin/word-images` — Pexels auto-match + match-score review / replace / upload for vocabulary illustrations (Storage bucket `word-images`).
- `/admin/audio` — 独立媒体（`audio_assets`）增删改查 + 收藏夹侧栏（无 tab）。上传媒体会自动加入当前选中的可收藏收藏夹。底部为共享 `<PlayerDock>`。
- `/admin/word-audit` — read-only data audit
- `/admin/plans` — plan hub (math, English, Chinese roadmap plans)

### Subject modules — read the package AGENTS.md, not here

Each subject module is its own package with an authoritative in-package `AGENTS.md`. To work on a
module, **read that package's AGENTS.md** (scoped, up to date) instead of relying on this file:

| Module | Package           | Routes                                      | Guide                         |
| ------ | ----------------- | ------------------------------------------- | ----------------------------- |
| 口算   | `@rosie/calc`     | `apps/web/src/app/calc/**` (thin shells)    | `packages/calc/AGENTS.md`     |
| 数学   | `@rosie/math`     | `apps/web/src/app/math/**`                  | `packages/math/AGENTS.md`     |
| 英语   | `@rosie/english`  | `apps/web/src/app/english/**`               | `packages/english/AGENTS.md`  |
| 绘本   | `@rosie/flipbook` | `apps/web/src/app/flipbook/**`              | `packages/flipbook/AGENTS.md` |
| 音频   | `@rosie/audio`    | `apps/web/src/app/audio/**`, `/admin/audio` | `packages/audio/AGENTS.md`    |

Shared foundations: `@rosie/core` (Supabase, contexts, types, constants, utils), `@rosie/ui`,
`@rosie/rewards` (stars/wallet/vouchers), `@rosie/player` (playback engine + `PlayerDock`).
Adding a new math lesson is a guided flow — see `.Codex/skills/add-lesson` + `docs/add-new-lesson.md`.

### Data Flow

All data hooks (`useWordMastery`, `useMathSolved`, `useWordData`, `useWeeklyPlan`, etc.) read and write Supabase directly. Each hook receives `user: User | null` from `AuthContext` and does nothing when `user` is null.

**Caching:** user-scoped lists/maps go through `createUserSessionStore` in `@rosie/core` (module-level
per-user cache + inflight dedupe). Remounting a page after `ready` must not refetch the same store.
Prefer `patchSessionData` on mutation; after localStorage hydrate use `refreshInBackground` (not
`invalidate`). Avoid remount-`useEffect` selects and avoid adding Zustand/TanStack Query for this
unless explicitly requested. See `.cursor/rules/session-store-data-fetch.mdc` and
`packages/core/AGENTS.md`.

`localStorage` is used only for UI preferences, filter/selection state, and a little transient
session state — never for persistent user data (exception: optional optimistic hydrate for large
catalogs like vocab, reconciled via `refreshInBackground`). These keys live in `STORAGE_KEYS`
(`@rosie/core` constants) — e.g. `MATH_SIDEBAR_COLLAPSED`, English/Chinese filter + selection keys,
`WEEKLY_PLAN_LAST_*`, flipbook prefs, and documented session-intermediate exceptions like
`RESCUE_QUEUE` / `ADMIN_DRAFT_STAGES`. All persistent user configuration (including plan generation
parameters) is stored in Supabase.

`AuthContext` (in `@rosie/core`) wraps the entire app and exposes `user`. Per-subject state lives in
its own context (e.g. `WordsContext` for English; per-lesson `LessonNProvider` for math, built by the
`createLessonProvider` factory in `@rosie/math`). Module-specific details live in each package's AGENTS.md.

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
