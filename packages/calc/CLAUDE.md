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
                    #   calc-blocks, calc-block-gens, calc-settings-normalize,
                    #   calc-mixed, calc-helpers (buildSession),
                    #   calc-finite, calc-effective-limit, calc-apply-attempt,
                    #   calc-session-policy (target vs clock, retry ceiling, star multiplier),
                    #   calc-mastery-sync (dual-store same-frame patch),
                    #   calc-problem-state-store / calc-mistakes-store,
                    #   calc-ast, calc-answer, calc-diagnose, calc-inverse,
                    #   calc-report-stats, calc-time-targets
sql/
├── calc-cognitive-metrics.sql  # ADD COLUMN consecutive_correct + mastered index
└── calc-session-timing-modes.sql  # timing_mode + bonus_sec on calc_settings
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

## Engine model

Question generation is **composable**: `BLOCKS` + `SKELETONS`; `buildSession` allocates by
weakness weight. Per-signature state in `calc_problem_state`:

| Concept | Mechanism |
|---------|-----------|
| **Unseen prefer** | Finite 2–9 mul/div + `add:100-comp`: coverage slot from `enumerateFinite` − practiced |
| **Lagging** | `effectiveLimitSec` / `resolveTargetSec` — cognitive target (explicit seconds honored only when `timedAnswerEnabled`); UI clock optional via `resolveClockSec` |
| **Mastered** | Within-limit streak `consecutiveCorrect >= 3`; excluded from daily pool; ~5% recall via SQL-truncated candidates (`fetchMasteredRecallCandidates` → `BuildCtx.recallCandidates`; no full mastered scan in `generateBlock`) |
| **Cold start** | Infinite blocks with `< 50` states: all `generateSingle` until pool grows |
| **Sync** | `applyMasterySideEffects`: dual `patchSessionData` same stack, then remote upsert |
| **Grandfather** | On-load memory: old `prof≥4 && attempt≥3` → mastered; upsert on next settle |

**Session prep (`mode=daily`):** `/calc/session` shows `SessionPrepScreen` before `buildSession`.
Settings defaults (`timingMode`, `bonusSec`) preload; user can override per session or「设为默认」.
Three modes in `calc-session-policy.ts`:

| Mode | Clock (`T_clock`) | At 0 | Star multiplier |
|------|-------------------|------|-----------------|
| `relaxed` | optional (timed toggle + explicit sec) | no auto-advance | ×1.0 |
| `strict` | `T_target` | final wrong | ×1.2 |
| `bonus` | `T_target + bonusSec` | final wrong | `max(1, 1.2 − 0.05×bonusSec)` |

`withinLimit` always uses `T_target` (never inflated by bonus). `maxRetryCeiling(N) = max(3, floor(N×0.15))`;
daily sessions use a capped retry pool + single-pass makeup (no re-enqueue from makeup).

Mistakes use `unresolvedMistakes(mistakes, states)` (reconcile hanging vs mastered). Session init
awaits `calcMistakesStore.ensureLoaded` before reconcile/carry (no cold-visit race). Proficiency is
settled ONLY by the finish fold (`applyAttempt`): a wrong answer at answer-time uses
`pullBackFromMastered` (streak/status reset, no −2) so a single wrong costs −2, not −4; the −2 in
`demoteFromMastered` applies only to cross-session reconcile repair. Tables:
`calc_settings`, `calc_problem_state`, `calc_sessions`, `calc_mistakes`.

**NumberPad auto-submit:** `settings.autoSubmitOnMatch` (default `true`, toggle in settings).
`shouldAutoSubmitNumberPad` in `calc-answer.ts` gates int/decimal only (length ≥ `formatAnswer`,
then `checkAnswer`); session calls it from `handleNumberPadInputChange` with `settleLockRef`.
SQL: `sql/calc-autosubmit-on-match.sql` (`auto_submit_on_match` column).

**Block registry notes:** `mul:2d1d` was removed (replaced by split `mul:2d1d-nc` / `mul:2d1d-c` blocks).
`calc-block-gens` holds per-block generators; `calc-settings-normalize` migrates legacy settings keys.
P2 may evolve `sub:round` recall (not implemented yet).

Design/plan: `docs/superpowers/specs/2026-07-09-calc-cognitive-metrics-design.md`,
`docs/superpowers/plans/2026-07-09-calc-cognitive-metrics.md`,
`docs/superpowers/specs/2026-07-09-calc-session-timing-modes-design.md` (under gitignored `docs/` locally).

## Commands

```bash
pnpm --filter @rosie/calc typecheck   # scoped — type-checks ONLY calc
pnpm --filter @rosie/calc lint
```

## Parent-facing FAQ

Plain-language guide (how selection / lagging / mastery / mistakes work):

- Repo: [`FAQ.md`](./FAQ.md)
- In-app: `/calc/faq`（口算首页「口算说明」入口）
