# Calc mid-late speed blocks — design

**Date:** 2026-07-09  
**Package:** `@rosie/calc`  
**Status:** Approved for planning  
**Related:** A+ selection engine (`lagging` / `coveragePass` / cold-start) in `calc-helpers` + `calc-finite`; prior cognitive metrics design `2026-07-09-calc-cognitive-metrics-design.md`

## Goal

Split coarse multi-digit calc types into cognitively distinct blocks so lagging soft-fail and (where Finite) unseen-prefer coverage hit real skill gaps — not blended “盲盒” pools. Mid-late speed pass only; no mixed-skeleton redesign, no DB schema change.

## Approach

**Generators + predicates module (recommended):** extend `BLOCKS` / `TIME_TARGETS` / Finite wiring; put shared digit/carry/mid-remainder/zeros helpers in a thin `calc-block-gens.ts` (or equivalent) with rejection-sample generators and safe retry caps. Settings normalize `mul:2d1d` → split ids on load.

Rejected alternatives: catalog-only inline gens (harder to audit); full picker regroup (out of scope).

## §1 Block catalog & generators

### Replace

| Old id | Action |
|--------|--------|
| `mul:2d1d`（两位数×一位数） | Remove from picker. Settings migration: replace with `mul:2d1d-nc` + `mul:2d1d-c` (dedupe). Delete `TIME_TARGETS['mul:2d1d']`. |

### New / changed blocks

| id | label | domain | Generator rule |
|----|-------|--------|----------------|
| `add:100-comp` | 100 以内凑整 | **Finite** | Both operands ∈ **10..90**, `a + b = 100`. Universe includes both orders when `a ≠ b`; `50+50` once. |
| `sub:round` | 整百/整千减多位数 | Infinite | **P0 minuends ∈ {100, 1000} only.** Subtrahend strictly `<` minuend; for 100 → 11..99; for 1000 → 101..999. Prefer at least one borrow chain (前九后十). No `100−100` / `1000−1000`. |
| `mul:2d1d-nc` | 两位数×一位数（不进位） | Infinite | `a ∈ 11..99`, `k ∈ 2..9`; **every** digit × k `< 10`. |
| `mul:2d1d-c` | 两位数×一位数（进位） | Infinite | Same ranges; **≥1** digit × k `≥ 10`. |
| `mul:3d1d-nc` | 三位数×一位数（不进位） | Infinite | `a ∈ 100..999`, `k ∈ 2..9`; every digit × k `< 10` (zero digits never carry). |
| `mul:3d1d-c` | 三位数×一位数（进位） | Infinite | Same ranges; **≥2 consecutive (adjacent) digit positions** each with digit × k `≥ 10`. Reject single-carry and non-adjacent double-carry fakes (e.g. `412×2`). Zero digits do not count toward a carry run. |
| `div:2d1d-borrow` | 两位数÷一位数（满十/带借位） | Infinite | Exact 2-digit dividend ÷ 1-digit divisor; **tens digit not divisible by divisor** (forces mid-step remainder). |
| `div:multi` | 多位数÷一位数 | Infinite | **Narrowed (same id):** exact; complementary set — tens digit **is** divisible by divisor (no mid remainder); quotient still 11..99 via existing `divRange`-style construction. |
| `mul:zeros` | 整十/整百乘法 | Infinite | Forms like `40×6`, `300×4`, `120×5`: strip trailing zeros → core 口诀 (factors 2–9) → restore zeros. Group: **mul**. |
| `div:zeros` | 整十/整百除法 | Infinite | Forms like `240÷60`, `1200÷4`, `800÷20`: same strip / core / restore. Group: **div**. Exact integer results only. |

### Helpers

New thin module (e.g. `packages/calc/src/utils/calc-block-gens.ts`):

- `digitsOf(n)`, `mulCarryMask(a, k)`, `hasAnyCarry`, `hasConsecutiveCarries(a, k, minRun=2)`
- `needsDivMidRemainder(dividend, divisor)` — tens digit `% divisor !== 0` for 2-digit dividends
- `complementsTo100()` / enumerate for Finite
- `genZerosMul` / `genZerosDiv`
- Rejection sample with retry cap; on exhaustion use a known-good seed pair (never hang `buildSession`)

### P2 (explicitly out of this pass)

Expand `sub:round` minuends to round hundreds/thousands (`200…900`, `2000…9000`) as a **hidden evolution inside the mastered recall pool** — not a new picker block and not implemented in P0.

## §2 Engine wiring

| Concern | Change |
|---------|--------|
| Finite / `coveragePass` | Add `add:100-comp` to `FINITE_BLOCK_IDS` and `enumerateFinite` (full U of two-digit complements). All other new blocks remain Infinite (cold-start `< 50` states → explore via `generateSingle`). |
| Lagging | No algorithm change. Each new id must have `TIME_TARGETS`; `effectiveLimitSec` uses explicit seconds ∥ `fluent[1]`. |
| Mastery / recall | Unchanged; new signatures master independently. |
| Vertical | Add to `VERTICAL_BLOCK_IDS`: `add:100-comp`, `sub:round`, `mul:2d1d-nc`, `mul:2d1d-c`, `mul:3d1d-nc`, `mul:3d1d-c`, `div:2d1d-borrow`; keep `div:multi`. **Exclude** `mul:zeros` / `div:zeros` (mental strip-zeros, not 竖式). |
| TIME_TARGETS | Add bands for every new id; remove `mul:2d1d`. Guidance: 凑整 ≈ `add:100*`; `sub:round` ≈ `sub:1000`; 2d×1d-nc slightly faster than `-c`; 3d×1d slower than 2d; borrow-div ≈ current `div:multi`; zeros slightly faster than plain 2d mul/div. Exact numbers fixed in implementation plan. |
| Settings migration | Normalize on load: `mul:2d1d` → `[mul:2d1d-nc, mul:2d1d-c]`. No SQL migration. `div:multi` id unchanged. |
| Mixed ops | No skeleton changes; new blocks participate via existing `sampleTerm` when selected. |

## §3 Settings, UI, docs, edge cases

**Picker / settings**

- BlockPicker under existing 加/减/乘/除 groups only (no new「速算」group).
- Normalize helper in settings load path so legacy `blockIds` keep working.
- Update settings vertical-mode description: drop coarse「两位数×一位数」; mention split 2d/3d ×1d and 满十除法 as appropriate.

**FAQ / CLAUDE**

- FAQ: short bullets — 凑整 + Finite 未见优先; mul 进位拆分; 满十除法 vs narrowed `div:multi`; 整十/整百 ×÷.
- `packages/calc/CLAUDE.md`: note new blocks + `mul:2d1d` removal; optional one-liner that P2 may evolve `sub:round` recall.

**Edge cases (normative)**

- `add:100-comp`: `50+50` once; `34+66` and `66+34` both in Finite U.
- `mul:3d1d-c`: consecutive = **adjacent** digit positions (ones–tens and/or tens–hundreds), not ones+hundreds only.
- `sub:round` P0: only 100 and 1000 as minuend.
- Zeros: after stripping zeros, core factors in 2–9; leading significant digit non-zero; div results exact integers.
- Generator failure: capped retries → known-good fallback, never empty session.

## Out of scope

- P2 `sub:round` round-hundred/thousand recall evolution
- New picker group / mixed-skeleton redesign
- Decimal / fraction changes
- DB / SQL migrations
- Changing lagging / mastery thresholds

## Touch map (implementation hint)

| Area | Files (expected) |
|------|------------------|
| Blocks + vertical set | `packages/calc/src/utils/calc-blocks.ts` |
| Generators / predicates | `packages/calc/src/utils/calc-block-gens.ts` (new) |
| Finite | `packages/calc/src/utils/calc-finite.ts` |
| Time targets | `packages/calc/src/utils/calc-time-targets.ts` |
| Settings normalize | `packages/calc/src/hooks/useCalcSettings.ts` (or small helper next to it) |
| Copy | `packages/calc/src/pages/settings.tsx`, `FAQ.md`, `faq.tsx`, `CLAUDE.md` |

## Success criteria

1. Picker no longer offers `mul:2d1d`; legacy settings expand to nc+c.
2. `add:100-comp` participates in Finite coverage (unseen prefer).
3. `mul:3d1d-c` never emits single-carry or non-adjacent-only carry items.
4. `div:multi` and `div:2d1d-borrow` partition 2-digit÷1-digit by mid-remainder rule with no intentional overlap.
5. `missingTargetIds()` empty after adding TIME_TARGETS.
6. `pnpm --filter @rosie/calc typecheck` passes.
