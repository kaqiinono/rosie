# @rosie/flipbook

The **PDF flipbook reader** module — extracted as a standalone workspace package so it can be worked
on and type-checked in isolation.

**Scope rule for agents:** to change flipbook behavior you almost always only need files in this
package. Read here first; reach into `@rosie/core` / `@rosie/english` / `@rosie/player` only for the
shared primitives below.

## What's inside

- **`components/`** — the reader (`FlipbookReader`/`FlipbookPage`, powered by `react-pageflip`),
  page-words overlay + word carousel modal, audio bar, single + batch uploaders, upload guide /
  progress, duplicate dialog, layout effects.
- **`hooks/`** — `useFlipbookBooks` (CRUD over books in Supabase), `useFlipbookProgress`,
  `useFlipbookReaderImmersive`, `useFlipbookDuplicatePrompt`.
- **`utils/`** — PDF rendering (`flipbook-pdf`, `pdfjs-dist`), page image conversion/loading,
  naming/batch-match/sync helpers, viewport sizing, `flipbook-types` (`FLIPBOOK_BUCKET`,
  `FlipbookBook`, …), and `flipbook-word-match` (matches reading vocabulary against page text).

Books and their audio live in the **`FLIPBOOK_BUCKET`** storage bucket.

## Dependencies

- **`@rosie/core`** — Supabase client, `useAuth`, shared types/constants.
- **`@rosie/english`** — `reading-data` (vocabulary) for page word-matching.
- **`@rosie/player`** — base playback engine for the audio bar.
- npm: `react`, `next`, `clsx`, `pdfjs-dist`, `react-pageflip`, `@supabase/supabase-js`.

Flipbook must never depend on another subject-module package (audio depends on flipbook, not the
reverse); `core`/`english`/`player` must never depend on flipbook.

## Public API & convention

A **single barrel** (`src/index.ts`). Components are re-exported as **named** barrel exports
(`export { default as FlipbookReader }`). Imports **within** this package are **relative**.

Routes stay in `apps/web/src/app/flipbook/**` and import everything from the `@rosie/flipbook`
barrel. The audio module consumes `useFlipbookBooks` + `FLIPBOOK_BUCKET`/types from here.

## Commands

```bash
pnpm --filter @rosie/flipbook typecheck
pnpm --filter @rosie/flipbook lint
```
