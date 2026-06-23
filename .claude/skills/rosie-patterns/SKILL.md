---
name: rosie-patterns
description: Coding patterns extracted from the Rosie learning platform (Next.js 15 PWA for elementary school math and English)
version: 1.0.0
source: local-git-analysis
analyzed_commits: 200
---

# Rosie Platform Patterns

## Commit Conventions

This project uses **conventional commits**:
- `feat:` — New features or pages
- `fix:` — Bug fixes
- `refactor:` — Code restructuring without behavior change
- `chore:` — Maintenance (deps, lint, config)
- `docs:` — Documentation only

Messages are written in English, often with a concise Chinese phrase for UI/UX intent (e.g. `refactor: 自动进入沉浸模式`).

## Project Structure (pnpm/Turborepo monorepo — since the 2026-06 migration)

One deployable Next.js app (`apps/web`, Vercel Root Directory = `apps/web`) + per-module
packages. **Routes always stay in `apps/web/src/app/**`**; module logic (components/hooks/
utils/data) lives in its package and is imported via `@rosie/<pkg>`.

```
apps/web/src/app/         # ALL routes (english/words, math/ny/{N}, today, audio, flipbook, …)
packages/
  core/      @rosie/core     # supabase, AuthContext, ImmersiveContext, type.ts, constant.ts
                             #   (STORAGE_KEYS), masteryUtils, getWeekStart, confetti, nav/SW hooks
  ui/        @rosie/ui       # shared components (CandyButton, BackLink, OrbBackground, …)
  rewards/   @rosie/rewards  # stars HUD, coin wallet, vouchers
  player/    @rosie/player   # playback engine + PlayerDock + media types
  calc/      @rosie/calc     # 口算 (route bodies in src/pages, app routes are thin shells)
  math/      @rosie/math     # components/lessonNN, utils/lessonNN-data, sea-data, math hooks
  english/   @rosie/english  # components/{words,reading}, hooks (useWordData…), utils
                             #   (english-data, reading-data, phonics, english-helpers), WordsContext
  flipbook/  @rosie/flipbook # PDF reader
  audio/     @rosie/audio    # audio_assets, collections, admin audio
```

**Dependency DAG (no cycles):** everything → core; ui→rewards; player standalone; math→ui,rewards;
english→player,ui,rewards; flipbook→english,player; audio→flipbook,english,player. A package
never imports another subject module outside this DAG.

**Imports:** most packages expose a barrel (`@rosie/english` named exports). `@rosie/math` uses
deep subpaths (`@rosie/math/utils/lessonNN-data`, `@rosie/math/components/lessonNN/X`) because
lessons share export names — needs the tsconfig `paths` aliases in `apps/web` + `packages/math`
(see `packages/math/CLAUDE.md`). Inside a package, cross-file imports are relative. Each package
has its own `CLAUDE.md` — read it before working in that module.

## Workflow: Adding a New Math Lesson

When adding a new lesson (e.g. lesson 38):

1. **Create routes** by copying an existing lesson directory:
   ```
   apps/web/src/app/math/ny/38/
   ├── layout.tsx
   ├── page.tsx
   ├── lesson/[id]/page.tsx
   ├── homework/[id]/page.tsx
   ├── workbook/[id]/page.tsx
   ├── pretest/[id]/page.tsx
   ├── alltest/page.tsx
   └── mistakes/page.tsx
   ```

2. **Create data file** `packages/math/src/utils/lesson38-data.ts` with `ProblemSet` shape (`pretest`, `lesson`, `homework`, `workbook` arrays).

3. **Create provider** `packages/math/src/components/lesson38/Lesson38Provider.tsx` using `createLessonProvider` factory.

4. **Create thin wrappers** around shared math components (AppHeader, Sidebar, BottomNav, ProblemList). Only `ProblemDetail` and `HomePage` need per-lesson implementations.

5. **Add to math hub** `apps/web/src/app/math/page.tsx`.

6. Run `pnpm lint` then `pnpm build` to confirm no type errors.

## Workflow: Adding English Phonics Rules

Phonics rules live in `packages/english/src/utils/phonics.ts` in `PH_RULES_RAW`.

- Rules are sorted longest-first automatically — longer patterns always win over shorter prefixes
- Rule categories: `ph-r` (R-controlled), `ph-digraph` (vowel combo), `ph-cluster` (consonant combo), `ph-blend` (consonant blend), `ph-suffix`, `ph-long`, `ph-vowel`
- Add 3-letter rules before their 2-letter subsets to avoid confusion (the sort handles priority, but placement aids readability)
- Colors for each category are CSS variables in `apps/web/src/app/globals.css` (`--ph-digraph`, etc.) and mirrored in `PHONICS_LEGEND` in `phonics.ts`

## Data & State Conventions

- **All user data** → Supabase directly from hooks. No localStorage for user data.
- **UI preferences only** → `localStorage` via `STORAGE_KEYS` in `packages/core/src/constant.ts`. Currently only `MATH_SIDEBAR_COLLAPSED`.
- **Weekly plans** (English + math) share a Thursday-start week convention. Stored in Supabase with `weekStartDay` and `newWordsPerDay`/`problemsPerDay` columns.
- All hooks receive `user: User | null` from `AuthContext` and are no-ops when null.

## Most Frequently Co-Changed Files

| Files changed together | Reason |
|---|---|
| `type.ts` + `constant.ts` | New shared type or constant |
| `useWordData.ts` + `english-helpers.ts` | English data pipeline |
| `WeeklyPractice.tsx` + `useWeeklyPlan.ts` | Weekly plan feature |
| `FlashCard.tsx` + `QuizCard.tsx` + `ImmersiveMode.tsx` | Practice mode UI |
| `FilterBar.tsx` + `WordsContext.tsx` | Filter state |

## TypeScript Standards

- **No `any`** — all types explicit
- `type` for component props, `interface` for Supabase/API response shapes
- All shared types → `packages/core/src/type.ts`
- All shared constants → `packages/core/src/constant.ts`

## CSS / Tailwind

- Tailwind v4 — no `tailwind.config.js`. Theme tokens in `apps/web/src/app/globals.css` as CSS variables.
- Dark theme for English module, light for Math — check existing pages before adding colors.
- Use `clsx` or `tailwind-merge` for conditional class combinations.
- Mobile-first: base classes → `md:` → `lg:`.

## After Any Change

```bash
pnpm lint    # catches TypeScript errors
pnpm build   # confirm no build errors before merging UI changes
```
