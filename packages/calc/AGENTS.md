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
├── calc-session-timing-modes.sql  # timing_mode + bonus_sec on calc_settings
└── calc-autosubmit-on-match.sql  # ADD COLUMN auto_submit_on_match on calc_settings
```

`calc_curriculum_snapshots` was an unverified rollout prototype and was confirmed absent from the
remote migration ledger. Its local migration and client request were removed on 2026-09-01;
`calc_block_progress` is the only compact progress projection. It is read through the legacy-named
in-memory snapshot adapter so the arithmetic engine can keep using finite-index sets without a
second database writer. During the compatibility window, legacy mistake writes remain available.
`calc_sessions.question_log` is the permanent practice fact; `calc_problem_state` and block
progress are rebuildable current projections.
Production received the additive foundation, registry v1 activation, reward idempotency index,
settlement/report/details RPCs on 2026-08-31 and bounded `prepare_calc_session` on 2026-09-01.
Unified settlement has passed authenticated Preview smoke tests. Unified settlement, block progress,
server selection, and server report default on as of 2026-09-01; their environment variables are
optional emergency overrides only. Do not drop legacy tables merely because the RPCs exist—the
production observation gate still applies.

Imports within this package are **relative** (`../utils/calc-helpers`, `./NumberPad`). Do not
introduce a path alias — Next compiles this package via `transpilePackages` and only the app's
tsconfig aliases are honored at build time.

## How it plugs into the app

- Routes stay in `apps/web/src/app/calc/` as thin shells:
  `export { default } from '@rosie/calc/pages/<name>'`. `layout.tsx` (pure dark chrome) and
  `vouchers/page.tsx` (redirect to `/vouchers`) remain in the app — they hold no calc logic.
- Calc settings UI is parent/admin-hosted at `/admin/calc`; the child route `/calc/settings`
  has been removed. Child pages read `settings.soundEnabled` for SFX but do not expose a sound
  toggle.
- External consumers of the public API: `today` dashboard (`useCalcDaily`) and the `/vouchers`
  page (`VoucherCard`, `playSfx`).

## Engine model

Question generation is **composable**: `BLOCKS` + `SKELETONS`; `buildSession` allocates by
weakness weight. Per-signature state in `calc_problem_state`:

| Concept           | Mechanism                                                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unseen prefer** | Finite 2–9 mul/div + `add:100-comp`: coverage slot from `enumerateFinite` − practiced                                                                                                                                      |
| **Lagging**       | `effectiveLimitSec` / `resolveTargetSec` — cognitive target (explicit seconds honored only when `timedAnswerEnabled`); UI clock via `resolveClockSec` (relaxed soft `T_target`)                                            |
| **Mastered**      | Within-limit streak `consecutiveCorrect >= 3`; excluded from daily pool; ~5% recall via SQL-truncated candidates (`fetchMasteredRecallCandidates` → `BuildCtx.recallCandidates`; no full mastered scan in `generateBlock`) |
| **Cold start**    | Infinite blocks with `< 50` states: all `generateSingle` until pool grows                                                                                                                                                  |
| **Sync**          | `applyMasterySideEffects`: dual `patchSessionData` same stack, then remote upsert                                                                                                                                          |
| **Grandfather**   | On-load memory: old `prof≥4 && attempt≥3` → mastered; upsert on next settle                                                                                                                                                |

**Coverage + adaptive scheduling:** `calc-coverage.ts` defines versioned core finite universes
for early add/sub, 2–9 mul/div, and complements. Coverage membership is derived from `signature`
(not the mutable source `blockId`) and reports covered / within-target / fluent / mastered /
review-due plus family drill-down. `countMode='auto'` is adaptive within the parent-selected
scope: prerequisite-not-ready selected blocks retain a 20% exploration weight; manual mode is
strict per-type authority. `buildSession` reserves carried mistakes, performs whole-session
bounded dedupe, and tags every question with a `selectionReason`; logs persist the signature,
reason, occurrence, and intentional-repeat flag. Child practice only surfaces friendly `新题` /
`补练` badges; the growth report shows the detailed coverage and repeat audit.
Session settlement atomically merges only touched finite indices. Reports combine compact history
with newer hot states and can rebuild snapshots idempotently from existing problem states. When a
compatible snapshot exists, finite-block selection excludes covered indices without loading a
separate completion table; a newer hot state always wins for regressible fluent/mastered status.

Large or effectively unbounded blocks use a separate, versioned **ability-structure coverage**
denominator in `calc-structure-coverage.ts`; it never pretends to enumerate every formula.
It covers operand bands, carry/borrow positions for multi-digit vertical arithmetic, factor/divisor
families, quotient/remainder structure, decimal operation/magnitude, fraction denominator/operation,
and mixed-operation root/depth. Only generator-reachable cells belong to the denominator. Run
`pnpm calc:audit -- --structures --samples 20000` after changing a generator or structure model;
every static model must report zero missing cells, zero unclassified samples, and zero unknown keys.

Adaptive progression is implemented in `calc-progression.ts`: explicit dependencies gate the next
block at 90% exposure, 85% recent independent accuracy, 75% stable-tier ratio and 60% fluent-tier
ratio. Recovery is triggered by recent accuracy below 70% or review-due ratio above 15%. The parent
setting `adaptiveExpansionEnabled` (migration `20260829160000_add_calc_adaptive_expansion.sql`)
is required before selected-scope expansion; it defaults off. `calc-features.ts` provides emergency
release switches: `NEXT_PUBLIC_CALC_COVERAGE_REPORT`, `NEXT_PUBLIC_CALC_SESSION_DEDUPE`,
`NEXT_PUBLIC_CALC_MASTERY_V2`, and `NEXT_PUBLIC_CALC_ADAPTIVE_PROGRESSION` (`0`/`false` disables).

Coverage evidence is centralized in `calc-evidence.ts`: formula, concept, rule, structure, speed,
and progression coverage use independent attempts only; make-up never raises coverage or mastery,
and recall participates only in durable mastery verification. A formula becomes fluent from the
latest independent evidence across sessions; mastered additionally requires a successful recall on
a later day. Finite-block progression always uses the versioned universe as its denominator rather
than mutable `problem_state.blockId` attribution. Presentation coefficients normalize system
targets only; an explicit parent-configured seconds value is final.

**Home:** `/calc` is practice-only for children. The recent sessions list lazy-loads wallet
sessions only after the accordion is opened, then reuses the session cache while mounted.

**Session prep (`mode=daily`):** `/calc/session` shows `SessionPrepScreen` before `buildSession`.
Settings defaults (`timingMode`, `bonusSec`) preload from `/admin/calc`; user can override them
for the current session only.
Three modes in `calc-session-policy.ts`:

| Mode      | Clock (`T_clock`)              | At 0                                                      | Star multiplier               |
| --------- | ------------------------------ | --------------------------------------------------------- | ----------------------------- |
| `relaxed` | `T_target` (hidden soft clock) | no auto-advance; elapsed time continues in the background | ×1.0                          |
| `strict`  | `T_target`                     | final wrong                                               | ×1.2                          |
| `bonus`   | `T_target + bonusSec`          | final wrong                                               | `max(1, 1.2 − 0.05×bonusSec)` |

`withinLimit` always uses `T_target` (never inflated by bonus). `maxRetryCeiling(N) = max(3, floor(N×0.15))`;
daily sessions use one shared remediation budget for carried mistakes plus same-session retries,
with carried mistakes taking priority. Makeup is single-pass and is never re-enqueued.

Mistakes use `unresolvedMistakes(mistakes, states)` (reconcile hanging vs mastered). Session init
awaits `calcMistakesStore.ensureLoaded` before reconcile/carry (no cold-visit race). Proficiency is
settled ONLY by the finish fold (`applyAttempt`): a wrong answer at answer-time uses
`pullBackFromMastered` (streak/status reset, no −2) so a single wrong costs −2, not −4; the −2 in
`demoteFromMastered` applies only to cross-session reconcile repair. Tables:
`calc_settings`, `calc_problem_state`, `calc_sessions`, `calc_mistakes`.

**NumberPad / 竖式 auto-submit:** `settings.autoSubmitOnMatch` (default `true`, toggle in settings).
`shouldAutoSubmitNumberPad` in `calc-answer.ts` gates int/decimal number-pad; vertical surfaces
(`VerticalCalc` / `MultiplicationVertical` / `DivisionVertical`) auto-submit when answer cells are
complete and correct. Session passes the flag via `CalcQuestionStage`.

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
pnpm --filter @rosie/calc test        # package + apps/web/tests/calc-* regression suite
pnpm calc:progress -- registry-manifest # deterministic registry rows + SHA-256 hashes
pnpm calc:progress -- registry-sql      # draft-only idempotent seed SQL (stdout)
```

## Parent-facing FAQ

Plain-language guide (how selection / lagging / mastery / mistakes work):

- Repo: [`FAQ.md`](./FAQ.md)
- In-app: `/calc/faq`（口算首页「口算说明」入口）
