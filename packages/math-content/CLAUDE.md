# @rosie/math-content

The **lesson content layer** of the math module (~46k LOC), extracted from `@rosie/math`
(Phase 2 of `docs/math/math-package-split-design.md`). It holds every lesson's UI and its
problem-bank data — and nothing else.

## What's inside

- `components/lesson/{g1,g2}/lesson{seq}/**` — per-lesson UI: `HomePage`, `ProblemList`,
  `ProblemDetail`, `{Grade}Lesson{N}Provider`, `AppHeader`, `Sidebar`, `BottomNav`, `FilterPanel`
  wiring, etc. (27 lessons: g1 × 20, g2 × 7).
- `utils/{g1,g2}/lesson{seq}-data.(ts|tsx)` — the `ProblemSet` banks (`PROBLEMS`, `PROBLEM_TYPES`,
  `TAG_STYLE`).

## Why it's its own package — the collision zone

Every lesson exports the **same names** (`HomePage` / `ProblemList` / `ProblemDetail` / `PROBLEMS`),
so a barrel is impossible. This is the ONE layer that must keep the deep-subpath machinery:

- package `exports` `"./*": "./src/*"` (extensionless).
- `apps/web/tsconfig.json` `paths`: `"@rosie/math-content/*": ["../../packages/math-content/src/*"]`.
- `packages/math/tsconfig.json` `paths`: `"@rosie/math-content/*": ["../math-content/src/*"]` (the top
  aggregators import content) and this package's own self-alias.
- `transpilePackages` + a `@source` line in `globals.css` (Tailwind).

Consumed via deep subpaths, e.g. `@rosie/math-content/components/lesson/g1/lesson35/ProblemDetail`,
`@rosie/math-content/utils/g1/lesson35-data`.

## Dependencies

`@rosie/core` and **`@rosie/math-kit`** (all shared primitives, hooks, ScratchPad). **Never imports
`@rosie/math`** — the top layer's aggregators (`sea-data`, `lesson-module-registry`) import content,
so content must not import back (enforced by `scripts/check-package-cycles.mjs`). DAG:
`math → math-content → math-kit → {core,ui,rewards,calc}`.

## Adding a lesson

Lesson files now live here (not in `@rosie/math`). After creating them, register the lesson in the
TOP package's aggregators: `packages/math/src/utils/lesson-module-registry.ts` and `sea-data.ts`.
See `docs/add-new-lesson/` + the `add-lesson` skill (both must reflect this two-package flow).
