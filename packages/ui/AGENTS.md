# @rosie/ui

Shared **presentational** components used across modules. No data fetching, no business logic.

**Contents:** `CandyButton`/`JellyButton` (+ presets/tiles), `PageBreadcrumb`, `ArrowIcon`,
`OrbBackground`, `LoadingOverlay`, `ModuleCard`, `AccountBar`, `AuthGuard`, `NavigationLink`,
`TopRightBar`, `ServiceWorkerRegistrar`.

`PageBreadcrumb` renders the site breadcrumb (or a 返回首页 button when the parent is home)
driven by the route map in `breadcrumb-map.ts` (subpath export `@rosie/ui/breadcrumb-map`).
**When adding a new page route, check `breadcrumb-map.ts` and add an entry** — otherwise the
page falls back to the plain 返回首页 button.

`ProblemSolutionView` and `AnalysisImage` are data-agnostic shared presentation for authoritative
math solutions. Math-kit resolves `Problem`/Supabase image data; AI passes structured block data.
The UI package must not query math tables or import a subject package.

**Depends on:** `@rosie/core` (auth/contexts/types), `@rosie/rewards` (TopRightBar shows the
stars HUD) + npm. Never a subject module.

**Notes:** interactive components need `'use client'` at the top (the barrel is pulled into
server components like `app/layout.tsx`). Barrel: `import { CandyButton } from '@rosie/ui'`
(named exports — default-exported components are re-exported as named).
