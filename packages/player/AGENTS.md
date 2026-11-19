# @rosie/player

The **content-agnostic** playback layer. Knows how to play tracks; knows nothing about
reading passages or the audio module.

**Contents:** `usePlaylistPlayer` (the single app-wide media element + queue/loop-mode engine),
`PlayerDock` (transport UI; favorites props are optional — omit them and the ❤️ is hidden),
`audio-manager-types` (`PlayerTrack`/`LoopMode`/`trackKey`), `audio-compress` (mp3 encode).

`PlayerDock` accepts optional `showProgress` (default false) to display elapsed/duration and a
keyboard-accessible seek slider. Reading detail pages opt in; existing dock layouts keep their defaults.

### PlayerDock presentation props

| Prop | Default | Opt-in behavior |
| --- | --- | --- |
| `appearance` | `'default'` | `'quiet'` removes the dock glow, top highlight, equalizer glow/animation and play-button pulse. Solid color, transport, queue and favorites remain available. |
| `placement` | `'floating'` | `'inline'` keeps the dock, expanded queue and video in document flow so they do not cover surrounding answers. The audio/video element remains mounted even with an empty queue. |
| `showProgress` | `false` | Enables the ordinary player's elapsed/duration display and seek slider. |

Either quiet or inline presentation provides at least 44px control targets and 12px auxiliary
text, including queue/video controls and seeking. Inline controls wrap inside their available
width rather than relying on the viewport's desktop breakpoint. Existing callers retain the
floating presentation and original dimensions until they opt in. Presentation is owned here;
consuming modules pass props rather than overriding dock styles or copying transport controls.

The `program` branch always remains status-only, regardless of these props or `showProgress`.
It never adds pause, seek, skip, loop, favorites or other ordinary-player transport controls to
a finite program. These props add no dependency on UI/core or subject packages.

Manual acceptance for these props has not been run: compare default/quiet and floating/inline,
including an empty queue's first playback, expanded queue/video, a narrow container, keyboard
seek, touch targets and the finite status-only branch.

**Depends on:** only npm (clsx, next, react, `@breezystack/lamejs`). NOT `@rosie/core`, NOT any
module — this is the lowest layer.

**Why it matters:** content modules such as reading build their own play queues from their
own data and feed `usePlaylistPlayer` directly, so they depend on `@rosie/player` (not on
`@rosie/audio`). Barrel: `import { usePlaylistPlayer, PlayerDock } from '@rosie/player'`.

## Finite playback programs

`usePlaybackProgram` is the separate finite transport exported by the barrel. It accepts
already-authorized, ordered `PlaybackProgramStep` values:
`{id,url,label,startMs,endMs,repeatCount,waitAfterMs}`. It does not fetch exam state, understand
subjects, verify media permissions, compute grades or extend server deadlines. Consumers
own those policies and supply a freshly authorized resume position after interruption.

The controller exposes `audioRef` (attach to the program's HTMLVideoElement), `status`,
`label`, `start(steps, positionMs?)`, `positionMs()` and `dispose()`. Status is
idle/playing/waiting/ended/failed. Program position includes repeated segments and waits;
`waitAfterMs` runs once after all repetitions of that step. Invalid boundaries/repetitions
or an already-held program lease reject startup. Source audio containing its own repeated
material must be accounted for by the caller rather than doubled by the program.

`playbackLease.ts` keeps a token-owned lease within the current client runtime. Acquisition
pauses ordinary `usePlaylistPlayer` instances and blocks ordinary play/enqueue while held;
a second finite program cannot take over. Release only clears its own token and does not
automatically restart old queues. This is coordination within the loaded runtime, not a
cross-tab lock or a server security mechanism. Keep the lease content-agnostic and do not
add exam/core dependencies to this package.

The finite controller exposes no pause, seek, playback-rate, loop or skip commands. It fixes
rate to 1, follows exact segment ends and repetitions, and treats unexpected pause, early
end, media error or prolonged stall as failure. Failure/end/disposal release the lease and
remove listeners/timers; unmount disposes. Callbacks let the owning feature persist technical
interruption or completion. Browser controls are not authorization: protected files and
deadlines must remain enforced by the server independently of this hook.

Ordinary `PlayerDock` queue/loop/favorites/progress behavior remains available outside a
program lease. Do not attach its free seek/pause/skip controls to a finite program. Exams
use the finite hook for reviewed mock listening and ordinary playback for authorized replay.

## Manual execution boundary

The finite program and lease changes were written as source only. No dependency installation,
service startup, build/test/lint/typecheck, check script, network or browser acceptance was
executed for this task. Users must manually verify lease acquisition/release, competing
queues, repeated segments, waits, authorized resume, autoplay rejection, interruption and
unmount cleanup. `docs/exams-manual-acceptance.md` covers the consuming exam flow. Its new
migrations, content import/publication, media binding and runtime acceptance remain user-run
work; this package does not apply migrations or publish content.

`PlayerDock` accepts opt-in `density="compact"` and `onClose` for homework panels. Compact mode retains the same media ref and seek events; closing stops playback before notifying the parent. Default layouts remain unchanged.
