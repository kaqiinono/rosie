# @rosie/math-kit

The **foundation layer** of the math module, extracted from `@rosie/math` (Phase 1 of the split
described in `docs/math/math-package-split-design.md`). It holds the lesson-agnostic building
blocks that the lesson content depends on — and **nothing that knows about a specific lesson**.

## What's inside (~112 files, ~16.6k LOC)

- `components/shared/**` — lesson UI primitives: `createLessonProvider`, `LessonAppHeader`,
  `LessonProblemList`, `LessonSidebar`, `ProblemAnswerSection`, `QuestionLayout`, `NumericAnswerPanel`,
  `DifficultyStars`, `RichTextEditor` + `rich-text-*`, `AnalysisImage`, `VerticalDigitPuzzle(Panel)`,
  and the whole `ScratchPad/` subsystem.

`ProblemSolutionPanel` is the math-data wrapper around `@rosie/ui`'s `ProblemSolutionView`.
It resolves uploaded/static analysis images and enables trusted lesson-data HTML; keep the pure
visual layer in UI so the AI package can reuse it without depending on math-kit.

- `hooks/**` — `useMathSolved/Wrong/Skipped/RotatingReview/WeeklyLessonReview/WeeklyPlan`,
  `useProblemAnswer/Mastery/Notes`, `useMathFavorites`, image/notes hooks, `math-scratch-types`.
- `utils/**` — generic helpers only: `check-problem-answer`, `math-helpers`, `math-practice-attempt`,
  `math-scratch-db`, `lesson-registry`, `lesson-grade`, `practice-queue-types`, `submitPracticeAttempt`,
  `sanitize-*`, `problem-nav/location`, `vertical-digit-puzzle`, …
- `components/MathFavoritesProvider`, `constants.ts` — pulled in as clean dependencies of the above.

**Not here (stays in `@rosie/math`):** anything content-dependent — the cross-lesson aggregators
(`sea-data`, `lesson-module-registry`, `courses-data`, `quiz-*`), the lesson banks, entry cards,
plan/quiz/sea engine, `dynamic-lesson/`, `practice-queue/` runtime, and the content-coupled shared
files (`FilterPanel`, `ProblemPracticeSession`, `LessonMistakesPage`, …).

## Dependencies

`@rosie/core`, `@rosie/ui`, `@rosie/rewards`, and **`@rosie/calc`** (the vertical-digit answer pad
`VerticalDigitPuzzlePanel` reuses `@rosie/calc/components/VerticalDigitPad`). npm: react, next,
clsx, tiptap, dompurify, html-to-image, pdfjs-dist. **Never imports `@rosie/math`** (enforced by
`scripts/check-package-cycles.mjs` in CI). The DAG is `math → math-kit → {core,ui,rewards,calc}`.

## Imports — deep subpaths (same convention as `@rosie/math`)

Consumed via **deep subpaths** that map 1:1 onto `src/` (no barrel — export names collide across the
module). Needs all three, mirroring `@rosie/math`:

- package `exports` `"./*": "./src/*"` (extensionless).
- `apps/web/tsconfig.json` `paths`: `"@rosie/math-kit/*": ["../../packages/math-kit/src/*"]`.
- `packages/math/tsconfig.json` `paths`: `"@rosie/math-kit/*": ["../math-kit/src/*"]` (so math resolves it),
  and this package's own `tsconfig.json` self-alias.
- Wired into the app via `transpilePackages` + a `@source` line in `globals.css` (Tailwind).

Within this package, cross-file imports keep the `@rosie/math-kit/...` deep-subpath form (self-reference)
or co-located relative form, same as `@rosie/math`.
