# @rosie/player

The **content-agnostic** playback layer. Knows how to play tracks; knows nothing about
reading passages, flipbook books, or the audio module.

**Contents:** `usePlaylistPlayer` (the single app-wide media element + queue/loop-mode engine),
`PlayerDock` (transport UI; favorites props are optional — omit them and the ❤️ is hidden),
`audio-manager-types` (`PlayerTrack`/`LoopMode`/`trackKey`), `audio-compress` (mp3 encode).

**Depends on:** only npm (clsx, next, react, `@breezystack/lamejs`). NOT `@rosie/core`, NOT any
module — this is the lowest layer.

**Why it matters:** content modules (reading, flipbook) build their own play queues from their
own data and feed `usePlaylistPlayer` directly, so they depend on `@rosie/player` (not on
`@rosie/audio`). Barrel: `import { usePlaylistPlayer, PlayerDock } from '@rosie/player'`.
