# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (uses pnpm)
pnpm install

# Dev server with Turbopack
pnpm dev

# Clear build cache and restart
pnpm fresh

# Production build
pnpm build

# Preview production build
pnpm start

# Lint
pnpm lint
```

No test suite is configured. There is no `.env` setup needed locally beyond Supabase keys — see Environment Variables below.

## Environment Variables

Required for Supabase auth and cloud sync:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Without these, auth will fail but the app still works in guest (localStorage-only) mode.

## Architecture

This is a Next.js 15 App Router PWA for elementary school math and English learning, targeting a single child (Rosie). All state is either in `localStorage` (guest) or synced to Supabase (logged-in). There is no traditional backend — it is a purely client-side app with SSG.

### Data Flow: Guest vs. Authenticated

Every data hook (`useWordMastery`, `useMathSolved`, `useWordData`, `useWeeklyPlan`, etc.) implements a dual-path pattern:

- **Guest**: reads/writes `localStorage` via keys defined in `STORAGE_KEYS` (`src/utils/constant.ts`)
- **Logged in**: reads/writes Supabase tables, falls back to `localStorage` on error

The `AuthContext` (`src/contexts/AuthContext.tsx`) wraps the entire app and exposes `user`. All data hooks receive `user` as a parameter to decide which path to use.

### Context Architecture

- `AuthContext` — Supabase auth session, sign in/up/out
- `WordsContext` — aggregates vocab (`useWordData`), mastery (`useWordMastery`), and filter state for the English module. All English sub-pages consume this context via `useWords()`.
- `Lesson35Provider` / `Lesson36Provider` — per-lesson context for math problem solving state (solved set, wrong-answer set, toast, congrats modal)

### Math Module

Each lesson (`35`, `36`) follows the same structure:

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

Problem data lives in `src/utils/lesson35-data.ts` and `src/utils/lesson36-data.ts` as `ProblemSet` objects (`pretest`, `lesson`, `homework`, `workbook` arrays of `Problem`).

The `Problem` type (`src/utils/type.ts`) supports interactive diagrams via `type: 'ratio3' | 'ratio3b' | 'none'`, `blockScene`, and `dualSc` fields — these drive `RatioDiagram`, `BlockDiagram`, and `DualBlockDiagram` components.

Lesson 34 (`/math/ny/34`) is a standalone interactive demo (distributive law), not part of the lesson35/36 system.

### English Module

All English pages share `WordsContext` via the layout at `src/app/english/words/layout.tsx`.

- Vocab is stored as `WordEntry[]` (unit, lesson, word, explanation, IPA, example, phonics fields)
- Words can be imported from Excel (`.xlsx`) using the `xlsx` package
- Mastery tracking uses a spaced-repetition stage system (0–8 stages, `WordMasteryInfo` in `src/utils/type.ts`, logic in `src/utils/masteryUtils.ts`)
- Weekly plans (`WeeklyPlan`) assign new words per day starting Thursday; `useWeeklyPlan` manages creation and progress

### Weekly Planning System

Both math and English have a weekly plan system with the same Thursday-start week convention:

- `WeeklyPlan` / `MathWeeklyPlan` — stored in `localStorage` or Supabase `weekly_plans` table
- `useWeeklyPlan` / `useMathWeeklyPlan` — hooks managing plan generation and daily progress
- `/today` — unified dashboard showing both English and math daily tasks

### PWA

- Service Worker: `public/sw.js` (Workbox CDN, no npm dependency)
- Manifest: `public/manifest.json`
- SW is registered via `ServiceWorkerRegistrar` component mounted in root layout
- `next.config.ts` sets no-cache headers for `sw.js` and `manifest.json`

### Path Aliases

`@/` maps to `src/` (configured in `tsconfig.json`).

### Key Conventions

- All client components are marked `'use client'` at the top
- Tailwind CSS v4 is used (PostCSS plugin, no `tailwind.config.js`)
- All storage keys are centralized in `STORAGE_KEYS` in `src/utils/constant.ts`
- All shared TypeScript types are in `src/utils/type.ts`
