# @rosie/calc

The 口算 (mental-arithmetic) module, extracted as a standalone workspace package so it can be
worked on, type-checked, and reasoned about in isolation.

**Scope rule for agents:** to change calc behavior, you almost always only need files in this
package. Read here first; reach into `@rosie/core` / `@rosie/rewards` only for the shared
primitives below. You should not need to read other subject modules (math, english, etc.).

## Dependencies (the only things calc imports from outside)

- **`@rosie/core`** — Supabase client, `useAuth`/`AuthProvider`, shared types (incl. the calc
  types `CalcQuestion`, `CalcSession`, `CalcBlock`, `MixedOp`, `CalcSettings`, `CalcLevel`,
  `CalcCategory`, `CalcMistake`, voucher/ledger types), constants (`todayStr`, `STORAGE_KEYS`,
  message pools), `confetti`. **Calc types live in core** (not here) because the shared
  rewards subsystem also references them — moving them here would create a cycle.
- **`@rosie/rewards`** — the shared gamification subsystem: `StarHudProvider`/`useStarHud`,
  `ColoredStar`, `useCalcWallet` (coin wallet), `useVoucherCatalog`/`useCalcVouchers`. Shared
  across admin/vouchers/today/math/english, so it is NOT part of calc.
- npm: `react`, `next`, `@supabase/supabase-js`.

Calc must never depend on another subject-module package, and `core`/`rewards` must never
depend on calc.

## Layout

```
src/
├── index.ts        # public API for the app: VoucherCard, playSfx, useCalcDaily
├── pages/          # route page bodies (home, session, settings, report, mistakes)
│                   #   the app's app/calc/**/page.tsx are thin shells re-exporting these
├── components/     # calc UI (CalcAppHeader, CalcQuestionStage, NumberPad, vertical calc, …)
│                   #   + audio.ts (playSfx SFX), vertical-cell-style.ts
├── hooks/          # useCalcSettings, useCalcProblemState (applyAttempt), useCalcMistakes,
│                   #   useCalcDaily
└── utils/          # the arithmetic engine:
                    #   calc-blocks (BLOCKS catalog), calc-mixed (SKELETONS), calc-helpers
                    #   (buildSession), calc-ast, calc-answer, calc-diagnose, calc-inverse,
                    #   calc-report-stats, calc-time-targets
```

Imports within this package are **relative** (`../utils/calc-helpers`, `./NumberPad`). Do not
introduce a path alias — Next compiles this package via `transpilePackages` and only the app's
tsconfig aliases are honored at build time.

## How it plugs into the app

- Routes stay in `apps/web/src/app/calc/` as thin shells:
  `export { default } from '@rosie/calc/pages/<name>'`. `layout.tsx` (pure dark chrome) and
  `vouchers/page.tsx` (redirect to `/vouchers`) remain in the app — they hold no calc logic.
- External consumers of the public API: `today` dashboard (`useCalcDaily`) and the `/vouchers`
  page (`VoucherCard`, `playSfx`).

## Engine model (unchanged by the extraction)

Question generation is **composable**: `BLOCKS` (single-op generators, `calc-blocks.ts`) +
`SKELETONS` (mixed-op shapes, `calc-mixed.ts`); `buildSession` (`calc-helpers.ts`) allocates a
session weighted toward weak signatures; `signature` (`calc-ast.ts`) is the proficiency key.
Proficiency 0–5 per signature lives in `calc_problem_state` (`useCalcProblemState`). Mistakes
carry to the next session (`useCalcMistakes`, `calc_mistakes`). Tables: `calc_settings`,
`calc_problem_state`, `calc_sessions`, `calc_mistakes` (wallet/voucher tables belong to
`@rosie/rewards`).

## Commands

```bash
pnpm --filter @rosie/calc typecheck   # scoped — type-checks ONLY calc
pnpm --filter @rosie/calc lint
```
