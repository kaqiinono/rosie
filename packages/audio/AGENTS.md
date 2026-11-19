# @rosie/audio

The **unified audio** module — extracted as a standalone workspace package. It is the top of the
subject-module DAG: it consumes English reading passages as a virtual collection and supports personal playlists.

**Scope rule for agents:** to change audio behavior you almost always only need files in this
package. Read here first; reach into `@rosie/core` / `@rosie/english` /
`@rosie/player` only for the shared primitives below.

## What's inside

- **`components/AudioPageView`** — the kid-facing (dark) listening page: switch collections, build a
  transient play queue from cards or whole collections.
- **`components/CollectionPills`** — shows which collections a track belongs to, with × to remove.
- **`admin/`** — `AudioManagerPage` (personal collections) + `CollectionView` / `PlaylistSidebar`.
- **`hooks/`** — `useAudioCollections` (aggregates favorites / reading / user playlists
  into `AudioCollection`s; `toggleFavorite`, `membership`, playlist CRUD), `useAudioPlaylists` (`audio_playlists` + items, `is_favorite`).

Tables: `audio_playlists` (+`is_favorite`), `audio_playlist_items`.

## Dependencies

- **`@rosie/core`** — Supabase client, `useAuth`, shared types/constants.
- **`@rosie/english`** — `readingPassages` / reading-audio types (virtual reading collection).
- **`@rosie/player`** — the single playback engine (`usePlaylistPlayer`, `<PlayerDock>`).
- npm: `react`, `next`, `clsx`, `@supabase/supabase-js`.

Audio sits at the top of the DAG; nothing else depends on it. `core`/`english`/`player`
must never depend on audio.

## Public API & convention

A **single barrel** (`src/index.ts`); components re-exported as **named** (`export { default as
AudioPageView }`). Imports **within** this package are **relative**.

Routes stay in `apps/web/src/app/audio/page.tsx` and `apps/web/src/app/setting/audio/page.tsx` and
import from the `@rosie/audio` barrel.

## Commands

```bash
pnpm --filter @rosie/audio typecheck
pnpm --filter @rosie/audio lint
```
