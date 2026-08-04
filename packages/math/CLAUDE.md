# @rosie/math

The math module (人教版 lessons 12–44 + 海域 sea bank + catalog + quiz + weekly plan),
extracted as a standalone workspace package so it can be worked on, type-checked, and
reasoned about in isolation.

**Scope rule for agents:** to change math behavior you almost always only need files in
this package. Read here first; reach into `@rosie/core` / `@rosie/ui` / `@rosie/rewards`
only for the shared primitives below. You should not need to read other subject modules
(calc, english, etc.) — math has no dependency on any of them.

## Dependencies (the only things math imports from outside)

- **`@rosie/core`** — Supabase client, `useAuth`/`AuthProvider`, shared types (incl. `Problem`,
  `ProblemSet`, `MathWeeklyPlan`, mastery types), constants (`todayStr`, `STORAGE_KEYS`,
  message pools), shared utils (`masteryUtils`, `getWeekStart`), confetti. (~238 imports)
- **`@rosie/ui`** — shared presentational primitives. (~7 imports)
- **`@rosie/rewards`** — the shared gamification subsystem (stars HUD, `ColoredStar`, wallet).
  (~5 imports)
- npm: `react`, `react-dom`, `next`, `clsx`.

Math must never depend on another subject-module package, and `core`/`ui`/`rewards` must
never depend on math.

## Drafts / scratch（练习记录驱动）

**草稿一定通过对应的练习记录（`math_practice_attempts`）查找。** 需要按题目查时：先用
`problemId`（+ 时间/对错/`paper_id` 等）定位**正确的那一条 attempt**，再读该 attempt 的
`objects`（空则回退 `draft_id`）。UI 打开草稿必须带 `attemptId`，禁止用「该题任意一次有画布
的练习」顶替当前练习。详见 `.cursor/rules/math-draft-via-attempt.mdc` 与
`docs/superpowers/specs/2026-08-04-math-practice-attempt-draft-design.md`。

## Layout

```
src/
├── index.ts        # public API: top-level entry cards (CourseCard, MathDailyCard,
│                   #   MathSeaCard, MathQuizCard, MathCatalogCard). NOT a full barrel —
│                   #   see "Imports" below.
├── components/     # all math UI:
│   ├── lesson/     #   g{grade}/lesson{seq}/ — HomePage, ProblemList, Provider, …
│   ├── shared/     #   createLessonProvider, LessonAppHeader, dynamic-lesson, …
│   ├── catalog/    #   CatalogTree + treeLayout (course map)
│   └── *Card.tsx   #   top-level entry cards (the public surface)
├── hooks/          # useMathSolved, useMathWrong, useMathQuiz, useMathRotatingReview,
│                   #   useMathWeeklyLessonReview, useMathWeeklyPlan, useProblemMastery
└── utils/          # g1/lesson{seq}-data, g2/lesson{seq}-data (ProblemSet banks);
                    #   lesson-registry (lessonKey + grade + seq), lesson-module-registry,
                    #   sea-data, courses-data, catalog-data, math-helpers
```

## Imports — deep subpaths, NOT a barrel

Every lesson exports the same names (`HomePage`/`ProblemList`/`ProblemDetail`/`PROBLEMS`),
so a single barrel would collide. The app and this package import math via **deep subpaths**
that map 1:1 onto the source tree:

- `@rosie/math/components/lesson/g2/lesson7/HomePage`
- `@rosie/math/utils/g2/lesson7-data`
- `@rosie/math/hooks/useMathWeeklyPlan`

Resolution setup (deep subpaths with mixed `.ts`/`.tsx` need all three):
- package `exports` `"./*": "./src/*"` (extensionless) — webpack/`next build` appends the
  extension via `resolve.extensions`.
- `apps/web/tsconfig.json` `paths`: `"@rosie/math/*": ["../../packages/math/src/*"]` — so the
  app's `tsc` resolves the deep subpaths (TS does not append extensions to bare exports
  wildcards).
- `packages/math/tsconfig.json` `paths`: `"@rosie/math/*": ["./src/*"]` — so the package's own
  scoped `tsc` resolves its **self-referential** imports (a package can't resolve its own name
  via node_modules).

Imports within this package use the **same** `@rosie/math/...` deep-subpath form
(self-reference), except a few co-located relative imports (`./treeLayout`,
`./createLessonProvider`, `./lessonNN-data` inside `sea-data.ts`). `index.ts` only re-exports
the entry cards.

## How it plugs into the app

- **Routes stay in `apps/web/src/app/math/**`** (unlike calc). The 223 `page.tsx` + 18
  `layout.tsx` are thin wrappers that import math components/data/hooks via `@rosie/math/*`
  deep subpaths. They were NOT moved into the package.
- External consumers of the public surface: the `today` dashboard
  (`@rosie/math/hooks/useMathWeeklyPlan`).

## Commands

```bash
pnpm --filter @rosie/math typecheck   # scoped — type-checks ONLY math
pnpm --filter @rosie/math lint
```
