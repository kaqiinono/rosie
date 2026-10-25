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

## Question numbering

Follow `docs/add-new-lesson/data.md#题目-id`: preserve textbook numbers and gaps, example1 practice is L1-1/L1-2, split items use letters (L1a/L1-1a). New lessons use canonical real IDs without displayId. Existing IDs and array order must not change; only confirmed legacy classroom corrections receive an explicit short displayId. Infer practice parentage from example grouping, titles, problem types and textbook order; a regular example/practice sequence is sufficient without an explicit parent label. Separate independent practices (-1/-2) from subquestions of one practice (-1a/-1b), and distinguish globally corresponding practice numbers from local ordinals. Only conflicting or cross-group-ambiguous cases stay unchanged in `scripts/math-problem-numbering-review.json`; avoid display collisions with unresolved old questions.

Reusable read-only CLI: `node scripts/audit-math-problem-numbers.mjs` (optional `--lesson`, `--json`, `--strict`), including factory/map-generated questions. This command, all project checks and browser verification are user-manual only. See the numbering guide for manual acceptance.
