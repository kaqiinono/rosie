# @rosie/english

The English module — **vocabulary** (words) + **reading** (passages) — extracted as a standalone
workspace package so it can be worked on and type-checked in isolation.

**Scope rule for agents:** to change English behavior you almost always only need files in this
package. Read here first; reach into `@rosie/core` / `@rosie/ui` / `@rosie/player` / `@rosie/rewards`
only for the shared primitives below. You should not need to read other subject modules (math, calc,
audio, flipbook).

## What's inside

- **Vocabulary (`components/words/`)** — flash cards, quiz runner, spelling tiles, study/practice
  phases, daily + weekly-plan sessions, mastery panels, monster-eat error feedback, xlsx import.
  Mastery uses the spaced-repetition stage system (logic in `@rosie/core`'s `masteryUtils`).
- **Reading (`components/reading/`)** — passages with glossary/word popups, recall quizzes, and
  **their own audio** stored in `reading_passage_media` (hooks `useReadingPassageMedia` /
  `useReadingPassageAudio`). Reading playback was **decoupled from the audio module**: it builds its
  own play queue via `@rosie/player` directly, with **no ❤️ favorites / audio-collection coupling**.
- **`WordsContext`** — aggregates vocab (`useWordData`), mastery (`useWordMastery`), and filter
  state; all English routes consume it via `useWordsContext()`.
- **`utils/`** — `english-helpers` (`wordKey`/`shuffle`/`hilite`/`parseWordRows`; re-exports
  `getWeekStart` from `@rosie/core`), `english-data*`, `phonics`, `reading-data`
  (`readingPassages`/`buildWordMatchRegex`/`resolveMatchedWord`/`findPassage`/`parseFocusLessonKey`),
  `reading-audio-types`, weekly-plan payload/progress/report builders, `word-enrich`, `speak`.

## Adding phonics rules

Phonics rules live in `utils/phonics.ts` in `PH_RULES_RAW`. They're auto-sorted longest-first
(longer patterns beat shorter prefixes — add 3-letter rules before their 2-letter subsets for
readability). Categories: `ph-r` (R-controlled), `ph-digraph` (vowel combo), `ph-cluster`
(consonant combo), `ph-blend` (consonant blend), `ph-suffix`, `ph-long`, `ph-vowel`. Each
category's color is a CSS variable in this package's own `src/english.css` (`--ph-digraph`, …)
mirrored in `PHONICS_LEGEND` in `phonics.ts`. `english.css` is package-private (imported once from
`src/index.ts`) and also holds the `.ph-*`/`.kw-*` classes, the word-monster (`--wm-*`) + rescue
(`--rescue-*`) vars, the `belly-pop` keyframe, and the reading recall-quiz decorations — none of
this lives in the app's `globals.css`.

## Dependencies (the only things English imports from outside)

- **`@rosie/core`** — Supabase client, `useAuth`, shared types, constants, `masteryUtils`,
  `getWeekStart`.
- **`@rosie/ui`** — shared UI primitives.
- **`@rosie/player`** — base playback engine (reading audio) + `compressAudioToMp3`.
- **`@rosie/rewards`** — shared gamification (stars / wallet / vouchers).
- npm: `react`, `next`, `clsx`, `xlsx`, `@supabase/supabase-js`.

English must never depend on another subject-module package; `core`/`ui`/`player`/`rewards` must
never depend on English.

## Public API & convention

The package exposes a **single barrel** (`src/index.ts`) — there are no name collisions, so there is
no `/pages/*` subpath (unlike calc). Components are re-exported as **named** barrel exports
(`export { default as FlashCard }`); import them as `import { FlashCard } from '@rosie/english'`.

Imports **within** this package are **relative** (`../utils/english-helpers`, `./FlashCard`). Do not
add a path alias — Next compiles this package via `transpilePackages`.

## How it plugs into the app

Routes stay in `apps/web/src/app/english/**` (cards/daily/flash/practice/reading/weekly + layout)
and import everything from the `@rosie/english` barrel. `reading-data` is **English-owned**; the
audio and flipbook modules consume it from `@rosie/english`.

## Commands

```bash
pnpm --filter @rosie/english typecheck
pnpm --filter @rosie/english lint
```
