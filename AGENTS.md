# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

For long-running, repeatable maintenance work (knowledge sync, catalog generation, audits, and
similar bulk jobs), prefer a resumable local CLI under `scripts/` over agent-driven manual loops.
Such scripts should be idempotent, observable, rate-limit aware, safe to rerun, and documented in
the owning package guide.

**Script placement:** `scripts/` root holds ONLY long-lived, reusable CLIs (referenced by npm
scripts, CI, skills, or docs) plus their companion data files (e.g. `grammar-page-map.json`).
One-off / temporary scripts (data fixes, diagnostics, migration patches, POCs, one-time SQL seeds)
go in `scripts/tmp/` and can be deleted at any time. When moving a script between the two, fix its
dirname-based root path resolution accordingly.

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
                              + grammar (剑桥初级英语语法 116 单元，内容存 Supabase，CLI 提取)
  exams/     @rosie/exams   — 考一考：KET 内容/审核、练习模考、词汇补练与报告；API 由 web 承载
  flipbook/  @rosie/flipbook— PDF flipbook reader (books with audio)
  audio/     @rosie/audio   — audio_assets, collections/favorites, /audio page, admin audio
  chinese/   @rosie/chinese — 语文：生字认读/会写、古诗背诵、周计划（一下 / 二上 / 二下）
  ai/        @rosie/ai — RAG 知识库 + Rosie Agent（/ai、ingest、STT）
  tasks/     @rosie/tasks — 课程表、排课与课前提醒
```

**Dependency DAG (no cycles):** everything → `core`. `ui`→rewards; `player` is standalone;
`math`→ui,rewards; `math-content`→math-kit,ui; `english`→player,ui,rewards; `chinese`→ui,rewards; `ai`→core,ui,player;
`flipbook`→english,player; `audio`→flipbook, english,player; `exams`→core,ui,player. A package must never import another subject module outside this DAG, and
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

**Database migration history:** `supabase/migrations/` mirrors the hosted
Supabase migration history. Earlier files are archived in
`supabase/legacy-migrations/`; the former `public.schema_migrations` runner
is retired. Use `scripts/supabase-migrations.mjs` for remote migration
list/dry-run/push through the session pooler. See `supabase/README.md`.

**UI icons:** Prefer the project's Streamline Plump icons (`LearningIcon`) for colorful illustrations
and Lucide for line icons. Use other icon sources only when the project libraries cannot serve the task.

**Visual guidelines:** the app follows the 「软糖贴纸」 visual language for a 7-year-old user — solid colors,
2px warm borders, flat bottom-edge shadows (`shadow-sticker*`), large radii, spring motion. Gradients, soft
blurred shadows (`shadow-sm/md/lg/xl`), glass blur and highlight layers are forbidden. Read
[`docs/visual-guidelines.md`](docs/visual-guidelines.md) before touching UI. `pnpm lint:visual` (part of
`pnpm lint` and CI) blocks new violations; legacy debt lives in `scripts/visual-style-baseline.json` and may only
shrink — never raise the baseline to get a change through. Cards/panels use `StickerCard` and tags use
Radix `Badge` (see the 场景→组件速查 table in the guide and `packages/ui/AGENTS.md`); hand-rolled card
class recipes are blocked by the `hand-card` rule, and hand-written native `<button>/<input>/<select>/<textarea>`
by the `native-control` rule (use `@rosie/ui/themes`; dark immersive areas wrap in `DarkScope`).

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

The web dev server writes to `apps/web/.next-dev`. Production build and preview share
`apps/web/.next`, so compiling while the dev server is open keeps their artifacts separate.
`pnpm dev` and `pnpm fresh` load the optional, gitignored `apps/web/.env.proxy.local`
at Node startup. The dev command explicitly enables `--use-env-proxy` on Node 24;
setting `NODE_USE_ENV_PROXY` only inside the env file does not reliably activate fetch proxying.
Set `HTTPS_PROXY` and `NO_PROXY` there. Restart the dev server after changing this file.

```bash
pnpm install                              # install all workspaces
pnpm dev                                  # dev server (turbo → web, Turbopack)
pnpm build                                # production build (turbo)
pnpm start                                # preview production build
pnpm lint                                 # lint all packages
pnpm lint:theme                           # reject accidental system-dark styles on light pages
pnpm lint:visual                          # reject new gradients / soft shadows / glass (docs/visual-guidelines.md)
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

### Baidu Netdisk OAuth

`/setting` does not show personal Netdisk authorization. Signed-in users access shared
course resources without binding a Baidu account. The existing personal API
`POST /api/baidu/oauth/personal/start` and its credentials remain available in the backend;
the callback stores credentials by the verified initiator's user ID in
`baidu_user_oauth_credentials`. Admins manage the shared course and materials account
at `/admin/sync` through `POST /api/baidu/oauth/start`.
Both flows use a ten-minute, single-use state whose hash binds the target and initiator. Configure
`BAIDU_APP_KEY`, `BAIDU_SECRET_KEY`, `BAIDU_REDIRECT_URI` and the existing
`SUPABASE_SERVICE_ROLE_KEY`. The state table and both credential tables are
service-role-only, with no browser grants or RLS policies. New shared course media files belong on Baidu Netdisk. Supabase stores binding metadata. Existing Storage resources migrate incrementally. Legacy textbook narration maps keys such as
`5a-u3l1` to `/airosie/english/audio/5A/U3L1.mp3`. Authenticated audio-session POST establishes
an HttpOnly cookie; each audio stream validates its Supabase session and supports Range requests,
with public Storage fallback. Token refresh uses a database lease and compare-and-set persistence;
legacy shared credentials acquire their missing account identity on first use through Baidu
identity verification and a version-guarded update. Math replay checks this at session creation.
Ambiguous refresh failures require administrator reauthorization. Proxy audio is excluded from SW
caching. See `docs/baidu-oauth.md` for migrations, setup and manual verification.

The shared authorization card shows stored expiry and the last explicit online check.
Admin-only GET `/api/baidu/oauth/status` reads metadata; POST checks the live Baidu account
and uses the existing refresh lease when needed. Neither returns tokens. Resource failures
distinguish missing authorization, rejected authorization, uncertain refresh, and temporary
unavailability. Core owns their public error messages and same-origin media probes.

Each math lesson may publish one authorized Baidu directory. In `/admin/sync`, choosing a bookmarked directory
loads its direct MP4 inventory. Admins can refresh it after changing files. Saving the whole lesson atomically publishes its
real problem IDs and exact Baidu file IDs. Each file is unique per shared account across lessons.
Student replay controls read only published IDs. The authenticated media route resolves
the binding and checks the live file's parent directory before streaming. Migration
`20261101033221_manual_math_replay_bindings.sql` preserves unique legacy mappings from the old
lesson catalog and the frozen question-bank index. Requires the directory bookmarks migration first.
See `packages/math-kit/AGENTS.md` and `docs/baidu-oauth.md`.

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
counter if the RPC is temporarily unavailable. The RPC request and response body share a 1.5-second
timeout. Failures open a 30-second per-instance cooldown; subsequent requests use local limiting,
and only one recovery probe is allowed after the cooldown before distributed limiting resumes.

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

- `/admin/sync` — shared Baidu authorization, account-scoped directory bookmarks and read-only file browsing,
  on-demand 路径 / 数学 / 英语 panels, per-lesson math replay and English lesson audio bindings. Under 英语 → Story, admins select an English series and book to bind one full-book recording and one recording per chapter. Directory APIs require an administrator.
  Shared callbacks return here. Legacy personal callbacks still return to `/setting`, which no longer displays a Netdisk card.

- `/admin/awards` — stars & voucher management (was previously at `/admin`)
- `/admin/users` — account management plus per-user parent PIN reset. Parent PIN hashes live in
  server-only `user_parent_pins`; missing rows use the default PIN `666666`. On `/setting/awards`,
spending is unrestricted while manual star grants and free vouchers require admin status or
successful server-side verification of the current user's parent PIN.

`/setting/calc` manages named口算策略. A user may create multiple strategies, but at most one is
enabled; that enabled row is the default used by normal口算 and direct entry from 今日计划.
- `/admin/words` — word-library (vocabulary) CRUD: stage = 词库, per-row add/edit/delete, single add (with AI auto-fill), and batch add (xlsx upload + paste). Uses `useWordData`'s per-row mutations (`addWords`/`updateWord`/`deleteWord`/`deleteStage`/`renameStage`), NOT the destructive `upsertByStage`.
- `/admin/word-images` — Pexels auto-match + match-score review / replace / upload for vocabulary illustrations (Storage bucket `word-images`).
- `/admin/audio` — 独立媒体（`audio_assets`）增删改查 + 收藏夹侧栏（无 tab）。上传媒体会自动加入当前选中的可收藏收藏夹。底部为共享 `<PlayerDock>`。
- `/admin/word-audit` — read-only data audit
- `/admin/plans` — plan hub (math, English, Chinese roadmap plans)

The home 故事会 card opens `/stories`, the shared Chinese and English story shelf. Legacy English reading story links redirect there.

### Subject modules — read the package AGENTS.md, not here

Each subject module is its own package with an authoritative in-package `AGENTS.md`. To work on a
module, **read that package's AGENTS.md** (scoped, up to date) instead of relying on this file:

| Module | Package           | Routes                                      | Guide                         |
| ------ | ----------------- | ------------------------------------------- | ----------------------------- |
| 口算   | `@rosie/calc`     | `apps/web/src/app/calc/**` (thin shells)    | `packages/calc/AGENTS.md`     |
| 数学   | `@rosie/math`     | `apps/web/src/app/math/**`                  | `packages/math/AGENTS.md`     |
| 英语   | `@rosie/english`  | `apps/web/src/app/english/**`               | `packages/english/AGENTS.md`  |
| 考试   | `@rosie/exams`    | `apps/web/src/app/exams/**`, `/admin/exams` | `packages/exams/AGENTS.md`    |
| 绘本   | `@rosie/flipbook` | `apps/web/src/app/flipbook/**`              | `packages/flipbook/AGENTS.md` |
| 音频   | `@rosie/audio`    | `apps/web/src/app/audio/**`, `/admin/audio` | `packages/audio/AGENTS.md`    |

Shared foundations: `@rosie/core` (Supabase, contexts, types, constants, utils), `@rosie/ui`,
`@rosie/rewards` (stars/wallet/vouchers), `@rosie/player` (playback engine + `PlayerDock`).
`@rosie/tasks` reads owner-scoped timetable data through core. See `packages/tasks/AGENTS.md`.
Adding a new math lesson is a guided flow — see `.Codex/skills/add-lesson` + `docs/add-new-lesson.md`.

### 考一考

`/admin/exams/images` provides a source-page crop task workspace. Temporary originals are
admin-only in private Supabase Storage; finished crops automatically upload to shared Baidu
and bind to the draft's image slot with version checks and idempotent receipts. Deleting an
authoring task cleans unused originals while preserving electronic questions, finished images
and bindings. Cleanup protects published/current content and historical attempt references.
See `docs/exams-image-workbench.md` for configuration, applied migrations and manual acceptance.

`@rosie/exams` owns versioned KET content, complete-group practice, mock attempts,
submitted-scope review, parent/admin assessment, independent vocabulary review and reports.
The web app owns every route and server adapter. `/exams/ket` links to practice, ongoing
attempts and `/exams/reports`; `/admin/exams` manages draft/review/publication, and
`/admin/exams/attempts` requires an explicit target user. `/admin/sync` has an on-demand
exam media panel. All private APIs use no-store responses and SW NetworkOnly rules.

Draft and publication edits use version checks and server audit records. Attempts freeze
content/media revisions, register material-family exposure before disclosure, and persist
answers, timing and operation receipts through service-only RPCs. Mock timeout freezes the
last saved answers; listening uses the reviewed finite program with an exclusive player lease
and recorded technical interruptions. PIN authorization opens only the current speaking
Part script for ten minutes. Private recordings and manual assessment history remain
owner-scoped; ungraded writing/speaking is pending, not zero. Optional reflection reasons
are stored separately and never inferred from skill tags or used to change scores.

Vocabulary links use canonical `word_entries.id` plus validated snapshots. An app-layer
bridge joins exams and English; exams never imports English. Exam word-review batches and
new-material application evidence do not write mastery, Boss, plans or rewards. Reports
separate first independent/new-material evidence from help, repeated work and interruptions.

The seven local exam migrations, source bundles, importer and runtime source are written;
the user subsequently authorized and completed the seven hosted migrations through this task.
Both full papers and both Trainer training bundles are now imported as drafts with private
solutions; extraction samples remain unimported. Image binding is handled by the crop workbench;
audio binding remains manual. Publication and
application runtime checks remain unexecuted. See
`docs/exams-environment-status.md` for the applied versions and configuration record.
Real authoring bundles in `packages/exams/source-data` stay outside browser imports. Media,
source/solution review and real vocabulary links must be completed before explicit publication.
See `packages/exams/AGENTS.md`, `docs/exams-manual-acceptance.md` and the exam handoff for
current contracts, content gaps and the manual acceptance sequence.

### Practice entry management

Homework course selection supports progression stored in the existing binding JSON:
enabled by default on saving the new settings, daily, weekly on a chosen weekday, or once per homework
occurrence following its recurrence schedule. Homework mode freezes its schedule in the binding and
shares period calculation with generation; split/flower sessions and rescheduling never advance it again.
Weekday-only daily work skips weekends. New occurrences freeze their course at generation; completion and
makeup never advance these snapshots. Legacy unsaved bindings retain their completion cursor.
See `packages/tasks/AGENTS.md` and `docs/task-practice-entries.md`.

`/setting/task-entries` manages owner-scoped named links and full ordered parameter lists. Homework
selects only an entry and start row; immutable bindings and per-occurrence snapshots protect ongoing
work from catalog edits. Garden revision commits advance each whole homework occurrence once.
Web owns subject catalog adapters. Opening `/setting/task-entries` loads the saved list only. Preset creation and refresh, including English reading and grammar, run when the user clicks 内容预设.
See `docs/task-practice-entries.md`; migrations `20261113160000_task_practice_entries.sql` and `20261115104405_apply_task_practice_presets.sql` are required.

### Tomato timer

`/tomato` hosts the sandboxed tomato-timer demo with the garden and closet removed. The authenticated host saves timer, task and reward snapshots in owner-scoped `tomato_timer_sessions` with revision checks.

### Lucky wheel

`/draw` reproduces the supplied lucky-wheel demo in an isolated same-origin renderer
(`apps/web/public/draw-wheel/`) with an authenticated React host. The full workshop,
weighted server draws, preferences and history share the existing reward/penalty catalog
with life-tree blind boxes. Entries are repeatable; optional no-repeat disables them.
Fulfilment retains entries. Tree reservations protect edits and are released on redemption.
The service-only workshop RPC uses pool locks, catalog revisions and operation receipts.
`draw_workshop` is a user session store; no persistent business state is stored locally.
Migration `20261114122234_draw_wheel_workshop` is applied to the hosted database. See
`packages/rewards/AGENTS.md` and `docs/draw-wheel.md` for contracts and manual acceptance.

### Life tree

Weekly, biweekly and three-weekly academic assignments use daily flower collection independently of automatic course progression, starting at each occurrence's window opening. Normal sync upgrades untouched current/future legacy occurrences, preserving frozen content and notes. A versioned garden commit stores each session and its rewards; the practice occurrence spans sessions until the whole assignment is complete. See `tree.md` and `packages/tasks/AGENTS.md`.

Daily homework supports an owner-saved `include_weekends` option, defaulting off for new definitions
and remaining on for existing definitions. Migration `20261115104319_task_homework_include_weekends.sql`
is applied to the hosted database (2026-11-15). Garden sync excludes untouched current/future
weekend occurrences into a reversible holding list; history and work already started are preserved.
See `packages/tasks/AGENTS.md` for the persistence and manual acceptance contract.

Date labels on `/time-tree` open task lists with progress and status, including grouped historical
dates. Past tasks support makeup work and future scheduled tasks support early execution without
changing their planned date. Only manually started future tasks enter the bubble queue. The shared
StepPanel and server engine apply this behavior to homework views as well; practice binding keeps
its existing active-occurrence guard. Date-list cards start collapsed. Today’s list accepts one-off custom crown bubbles with zero duration and same-day life-bubble completion and expiry. Lists show saved learning content, task instructions and
occurrence notes. Unbound pending tasks use read-only previews from the homework session cache
and garden cursor; browsing does not bind or advance practice. See `tree.md`.

The life tree header can minimize the page to a draggable launcher above the AI assistant.
Minimizing returns home, and the launcher stays available during navigation until the tree
reopens. Both launchers share the core drag hook and save their positions independently.

`/time-tree`, the execution list at `/tasks/homework` and the homework view of `/today/calendar`
share the account's versioned Supabase garden via `POST /api/time-tree`. The route derives the
owner and timestamps on the server, snapshots homework occurrences, and atomically commits
timing, rewards and blind-box reservations. Completion always grants uncapped base sunlight and water;
early timed completion doubles both, with a reward dialog highlighting the bonus. API responses
provide server time for client countdown calibration. Parent PIN gates time entry, wish redemption and
next-day settings at `/setting/time-tree`. See `tree.md` for the live rules.

### Dev previews

`/dev-preview/homework-content` selects actual owner-scoped saved task content by subject and parameter row, then directly renders the same `HomeworkContentPanel` used by life-tree details. It reads `usePracticeEntries` without creating presets, binding occurrences or writing progress. Detail URLs resolve the selected row's real variables. The preview uses the current catalog; life-tree retains its frozen occurrence snapshot. See `docs/homework-content-demo.md`.

`apps/web/src/app/dev-preview/**` holds visual-only demo pages with static mock data (no Supabase).
`/dev-preview/exams` remains the in-memory review surface for 14 exam presentations plus a
handwriting assessment workflow demo. It shares `AnswerChoiceGroup`, `MatchingBoard`,
`InlineChoiceField` and `SentenceHighlightText` with formal exam rendering. The handwriting
assessment workflow is approved for formal use, gated by the new handwriting migration
(`20261113170244`, applied; readiness RPC returns true). The demo creates no attempt or learning record;
code and source-referenced samples live in `apps/web/src/components/exams-preview/`.
Formal attempt, submitted review and admin previews use `ExamGroupRenderer` with authored
activities, answer slots and sentence ranges. Four corrected r2 drafts retain 36 media bindings;
they remain unpublished and frozen old attempts remain unchanged. The sentence-annotation
migration `20261113163105` is applied; the service-only capability RPC returns true.
The capability fallback remains for environments without this migration.
See `docs/exams-question-rendering.md` and `packages/exams/AGENTS.md`.
The outdated `/dev-preview/time-tree` prototype and its standalone in-memory store/seed are removed.
Use `/time-tree` for the production life tree (rules in `tree.md`). Shared scene code remains in
`apps/web/src/components/tree-demo/garden/`: model types, layout, TreeScene, Sky, Bubbles, particles,
audio, styles and shared dialogs are still used by production. Do not delete this directory as demo-only.
The illustration intentionally uses gradients and glow, marked `visual-ok: 插画`; controls use `@rosie/ui`.
`data.ts` / `TimeTreeScene.tsx` (the older R3F tree) still back the separate
`/dev-preview/time-tree-organic` experiment, whose back link goes to `/time-tree`.

### Data Flow

All data hooks (`useWordMastery`, `useMathPracticeStats`, `useWordData`, `useWeeklyPlan`, etc.) read and write Supabase directly. Each hook receives `user: User | null` from `AuthContext` and does nothing when `user` is null.

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
- The home page asynchronously loads the four daily progress cards (口算、英语、数学、语文)
  above the menu, with direct practice links. 「查看全部」 opens `/today` for details and progress backup. The separate
  home learning overview loads only when expanded.

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

1. Before modifying UI, read `docs/visual-guidelines.md` and check theme tokens in `src/app/globals.css` (Tailwind v4 uses CSS variables — there is no `tailwind.config.js`)
2. After any logic change, run `pnpm lint` to confirm no type errors
3. When modifying offline / Service Worker behavior, test in `pnpm start` (preview) mode, not `pnpm dev`
4. When adding a new page route, check `packages/ui/src/breadcrumb-map.ts` and add a breadcrumb entry — otherwise the page only shows a plain 返回首页 button (no level-by-level back navigation)

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

### 受控 UI 组件

- 所有页面的数据请求都必须展示与真实请求状态同步的加载反馈。页面级等待统一使用 `@rosie/ui` 的 `LoadingOverlay`，传入 `placement="content"` 展示 Rosie 转圈动画。页面布局为加载区域分配页头、导航等占用后的剩余视口高度，动画在该区域水平、垂直居中。局部请求和提交操作按受控组件清单处理。
- 请求成功、失败或取消时及时结束对应的加载态。并行请求按各自影响的内容区管理；同一区域依赖多个请求时，等待所需数据就绪再展示结果。成功返回空数据后才显示空态。已有缓存可继续展示，后台请求期间使用局部加载提示。
- 业务页及业务包新增或修改控件时，先查阅 [受控组件入口清单](packages/ui/AGENTS.md#受控组件入口清单)。命中适用场景时必须从指定入口导入，通过公开属性选择变体、尺寸和状态。
- 新增或修改通用控件时，必须优先使用 Radix Themes 提供的组件和样式，通过 `@rosie/ui/themes` 导入；已有业务封装使用清单指定入口。禁止用原生标签搭配 Tailwind 类、手写 CSS 或内联样式自行实现控件，包括按钮、下拉框、输入框、Tab 和弹窗。
- 发现多个页面重复实现同一控件，或新需求适合沉淀为共享组件时，主动提醒用户，列出复用场景、可复用的现有组件或 Radix Themes 组件，以及建议的公开接口；用户确认后再封装并登记。
- 调用处可安排控件在页面中的位置与外部间距。禁止通过 `className`、`style`、父级选择器或事件拦截覆盖受控组件的外观，以及悬停、按下、焦点、禁用、加载等交互状态。
- 组件能力不足时，先说明具体使用场景、现有接口的限制和建议扩展的接口，等待用户确认后再实施。确认前禁止在业务页复制组件、直接使用底层原语或临时覆盖样式绕过限制。

`/dev-preview/exams` now opens the 14-pattern in-memory question interaction gallery in
`apps/web/src/components/exams-preview/ExamTypePreview.tsx`. It uses student-visible excerpts,
provided question-image crops and explicitly labelled synthetic examples; no source-data or
private solutions are imported. Local microphone recording is optional and never uploaded.
Question-bank revisions await user review. See `docs/exams-question-rendering.md` for coverage,
recognition rules, gaps and manual acceptance. The earlier single-notice preview remains in
`ExamAnswerPreview.tsx` but is no longer the route entry.

Task-entry rows also hold display content and multiple media references. Opening a due bubble uses
`preparePractice` to bind without starting its timer. Inline audio/video use the shared player;
English sentence and Chinese reading/recognition/words/poem/accumulation content comes from
existing source data. See `docs/task-practice-entries.md` for resource discovery and refresh behavior.

## 数据迁移执行偏好

用户已明确授权：后续开发任务涉及的数据迁移由代理自动执行并核对结果，不再要求用户手动操作或重复确认。仅应用当前任务所需迁移；先确认项目、远端历史和依赖，不夹带无关待执行迁移，不使用 `--include-all` 强推。成功后核对远端记录及必要的只读元数据，并同步本地迁移版本与状态文档。此授权不包含无关数据删除或数据库重置；构建、测试仍按用户的手动控制规则执行。
