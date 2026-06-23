# @rosie/core

The shared foundation every other package depends on. Keep it small and module-agnostic.

**Contents:** Supabase client (`supabase`, `Database`), `AuthContext` (`useAuth`/`AuthProvider`),
`ImmersiveContext`, shared hooks (`useNavigationLoading`, `useServiceWorker`, `useLocalStorage`),
shared types (`type.ts` — `Problem`/`WordEntry`/`Calc*`/voucher & mastery types, etc.),
`difficulty.ts`, `constant.ts` (`STORAGE_KEYS`, `todayStr`, `getWeekStart`, message pools),
`masteryUtils` (0–8 mastery levels, shared by math + english), `confetti`.

**Depends on:** only npm (`@supabase/supabase-js`, react, next). **Nothing** module-specific.

**Rule:** core must NEVER import a subject module (calc/math/english/flipbook/audio) or
ui/rewards/player. Only put something here if it's genuinely shared across modules. A type used
by exactly one module belongs in that module's package, not here.

Barrel: `import { … } from '@rosie/core'`. Internal cross-file imports are relative.
