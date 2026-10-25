# @rosie/core

The shared foundation every other package depends on. Keep it small and module-agnostic.

**Contents:** Supabase client (`supabase`, `Database`), `AuthContext` (`useAuth`/`AuthProvider`),
`ImmersiveContext`, shared hooks (`useNavigationLoading`, `useServiceWorker`, `useLocalStorage`),
**`sessionStore`** (`createUserSessionStore`, `invalidateSessionStore`) — in-memory per-user cache for
Supabase-backed lists/maps (inflight dedupe; remount after `ready` does not refetch),
shared types (`type.ts` — `Problem`/`WordEntry`/`Calc*`/voucher & mastery types, etc.),
`difficulty.ts`, `constant.ts` (`STORAGE_KEYS`, `todayStr`, `getWeekStart`, message pools),
`masteryUtils` (0–8 mastery levels, shared by math + english), `confetti`.

**Depends on:** only npm (`@supabase/supabase-js`, react, next). **Nothing** module-specific.

**Rule:** core must NEVER import a subject module (calc/math/english/flipbook/audio) or
ui/rewards/player. Only put something here if it's genuinely shared across modules. A type used
by exactly one module belongs in that module's package, not here.

## User data fetching (session store)

Default for any user-scoped Supabase read that pages remount often: `createUserSessionStore` in the
owning package’s hook file, then `store.useSessionData(user)`. Mutations: write Supabase, then
`patchSessionData` / `replaceSessionData`. Use `invalidate` + `ensureLoaded` only when the next
payload is unknown. After localStorage hydrate, use `refreshInBackground` to reconcile with the
network without clearing `ready` or flipping `isLoading`. Do **not** add Zustand/TanStack Query for
this unless explicitly requested.
When choosing among stable scoped stores (for example, by lesson), `useSessionData` subscriptions,
snapshot callbacks and initial-load effects follow both the user ID and the selected store's
functions. Reuse each store instance; do not create a new store on every render.
Agent rule: `.cursor/rules/session-store-data-fetch.mdc`. Design:
`docs/superpowers/specs/2026-07-30-session-store-evolution-design.md`.

Barrel: `import { … } from '@rosie/core'`. Internal cross-file imports are relative.

`Problem.displayId?: string` is display-only compatibility for existing math classroom questions. New lessons omit it and use correctly numbered real IDs. Keep all persistence, routes, references and ordering based on real IDs.
