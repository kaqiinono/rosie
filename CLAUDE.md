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

No test suite is configured. After any logic change, run `pnpm lint` to catch type errors. Before merging UI changes, run `pnpm build` to confirm no TypeScript errors.

> **Keeping this file up to date:** When architecture, data flow, conventions, or tooling change, update CLAUDE.md in the same commit.

## Environment Variables

Required for Supabase auth and cloud sync:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Without these, auth will fail. The app requires login — there is no guest mode.

## Architecture

This is a Next.js 15 App Router PWA for elementary school math and English learning, targeting a single child (Rosie). **Login is required** — Supabase is the sole data store. There is no traditional backend; the app is purely client-side with SSG.

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
