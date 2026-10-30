# @rosie/math-kit

The **foundation layer** of the math module, extracted from `@rosie/math` (Phase 1 of the split
described in `docs/math/math-package-split-design.md`). It holds the lesson-agnostic building
blocks that the lesson content depends on — and **nothing that knows about a specific lesson**.

## What's inside (~112 files, ~16.6k LOC)

- `components/shared/**` — lesson UI primitives: `createLessonProvider`, `LessonAppHeader`,
  `LessonProblemList`, `LessonSidebar`, `ProblemAnswerSection`, `QuestionLayout`, `NumericAnswerPanel`,
  `DifficultyStars`, `RichTextEditor` + `rich-text-*`, `AnalysisImage`, `VerticalDigitPuzzle(Panel)`,
  and the whole `ScratchPad/` subsystem.

`ProblemWorkspace` is the shared single-problem core for routed lesson details and practice queues.
It owns common answer-adjacent capabilities (`不会`, paper draft upload, solution, notes, and attempt
integration). Outer shells keep route navigation or queue/session progress. Practice injects its
lifecycle through `ProblemWorkspaceRuntimeProvider` while rendering the registered lesson's real
`ProblemDetail`; never reimplement lesson-specific figures or answer widgets in the queue layer.

`ProblemSolutionPanel` is the math-data wrapper around `@rosie/ui`'s `ProblemSolutionView`.
It resolves uploaded/static analysis images and enables trusted lesson-data HTML; keep the pure
visual layer in UI so the AI package can reuse it without depending on math-kit.

- `hooks/**` — `useMathPracticeStats/Wrong/RotatingReview/WeeklyLessonReview/WeeklyPlan`,
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

Question labels use `utils/problem-display-id.ts`: prefer legacy-only Problem.displayId, otherwise remove only the canonical/legacy lesson prefix, preserving L1-1/L1a/L1-1a in full. Source classification reads the complete real-ID suffix. Keep real IDs for storage and navigation; practice progress and paper sequence numbers retain their meaning. See `docs/add-new-lesson/data.md#题目-id`.

`ProblemCardActions` owns the shared bottom action bar for `LessonProblemList`,
`ExpandedProblemCard`, and `QuestionLayout`: replay, analysis, electronic/paper drafts,
favorite, and optional expansion. Expanded cards suppress the nested detail footer via
`ExternalProblemActions`. List draft actions receive a per-card `ProblemScratchProvider`
with the correct problem index and source section. `ProblemVideoReplay` is the shared
Baidu video entry. `utils/problem-video.ts` resolves
`{lessonKey}-{displayId}` when a nonempty displayId exists, otherwise the full real problem ID.
The app owns `/api/baidu/video/**` and maps these keys to `/airosie/math/ny/{key}.mp4`.
`useProblemVideoCatalog(user, lessonKey)` reads each lesson's persisted catalog once through
stable per-lesson `createUserSessionStore` instances and shares a Set across its cards.
Only confirmed matches render replay; missing, unsynced,
loading, and failed catalog reads render no button or placeholder. These states remain
distinct internally. The app's `/admin/sync` selects grade/lesson for both Baidu filename search
and question comparison. Existing snapshots are reused; explicit resync atomically replaces only
that lesson's `math_video_lesson_catalog` row and updates its current-user store. It never searches
from question components or periodically. Sign-out invalidates all lesson stores. A page refresh
loads changes made by another administrator session. The app owns report aggregation via
the existing math question catalog; math-kit must not import the math aggregator.
Card action controls use their `toolbar` variants and the shared `ProblemActionIcon`
SVG family; replay always occupies the rightmost footer column. Default control variants
remain available for other surfaces. Keep the analysis marker non-interactive.
Cards, detail headers, and replay labels use `problemCardDisplayId`: a nonempty trimmed
`displayId` wins; otherwise omit the lesson prefix (`2-10-L1` → `L1`), preserving
compound question suffixes such as `L1-1a`. Stored IDs and video filenames stay complete.
The existing short-number helper remains unchanged for search and other consumers.
`utils/problem-practice-style.ts` is the shared two-color palette for card top accents,
borders, and footer tints: zero practices = amber; positive practice count = emerald.
Pass `practiceCount` to `ProblemCardActions`; unknown counts use a neutral footer.
Difficulty is neutral text. `tagStyles` still colors knowledge-point labels, and mastery
growth icons retain their meaning without introducing extra card-border colors.

`loadProblemVideoCatalog(userId,lessonKey)` is the imperative application-adapter reader of the
same session store used by `useProblemVideoCatalog`; it never syncs Baidu or mutates practice.
TasksHost uses its confirmed keys to inject the existing replay control into independent tasks.
