# @rosie/ui

Shared **presentational** components used across modules. No data fetching, no business logic.

**Contents:** `CandyButton`/`JellyButton` (+ presets/tiles), `BackLink`, `ArrowIcon`,
`OrbBackground`, `LoadingOverlay`, `ModuleCard`, `AccountBar`, `AuthGuard`, `NavigationLink`,
`TopRightBar`, `ServiceWorkerRegistrar`.

**Depends on:** `@rosie/core` (auth/contexts/types), `@rosie/rewards` (TopRightBar shows the
stars HUD) + npm. Never a subject module.

**Notes:** interactive components need `'use client'` at the top (the barrel is pulled into
server components like `app/layout.tsx`). Barrel: `import { CandyButton } from '@rosie/ui'`
(named exports — default-exported components are re-exported as named).
