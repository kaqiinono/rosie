# Calc session timing modes + retry ceiling — design

**Date:** 2026-07-09  
**Package:** `@rosie/calc`  
**Status:** Approved for planning  
**Related:** Implicit limit / lagging via `effectiveLimitSec` + `TIME_TARGETS.fluent`; mid-late blocks design `2026-07-09-calc-midlate-speed-blocks-design.md`

## Goal

Treat per-type settings seconds as **target time**. Before a daily session starts, let the child/parent pick a **session timing mode** (宽松 / 严格 / 自定义加成) on a prep screen, with defaults stored in settings. Separately, harden **all daily sessions** with a capped retry pool and single-pass makeup so sessions always have a visible end.

## Approach

**Session-prep overlay inside `/calc/session` (recommended):** daily entry still navigates to `/calc/session`; the page stays on a prep state until confirm, then `buildSession` runs. Settings hold default mode + bonus. Retry ceiling + single-pass makeup apply to every `mode=daily` session regardless of timing mode.

Rejected: separate `/calc/ready` route (extra hop); settings-only mode with no prep confirm (fails “choose rules before practice”).

## §1 Daily session structure (retry iron rules)

**Scope:** `mode=daily` only (home / settings「开始口算」). Mistakes-only sessions and drills (`weak-formulas`, `breakthrough`) keep current short-session behavior — **no** retry ceiling / single-pass changes in this pass.

**Main path**
- Planned size `N` = current `buildSession` planned length (`lastCount` in auto mode, sum of per-type counts in manual), matching today’s `plannedCount`.
- Carried unresolved mistakes from the previous session continue to follow existing append/mix rules; **`MaxRetry` is computed from `plannedCount` only**.

**Retry pool**
- `MaxRetry = max(3, floor(plannedCount × 0.15))`
- On main path: wrong answer **or** strict/custom timeout auto-advance → try enqueue into `retry_pool`.
- If pool already has `MaxRetry` items: do **not** enqueue for this session’s makeup; still write long-term mistake + proficiency / weight updates as today.
- After main path finishes: enter makeup phase over pool only.

**Single-pass makeup**
- Each makeup item gets **one** attempt (correct, wrong, or timeout-as-wrong).
- No re-enqueue from makeup. After the last makeup item → force session report / finish.

**UI**
- Prep screen previews `N` and `M = MaxRetry`.
- Status bar in makeup:「补练 i / M」(M ≤ MaxRetry).

## §2 Timing modes and judgment

**Target time `T_target` (cognitive / lagging)**  
Per question source: explicit per-type `seconds` when `> 0`, else `TIME_TARGETS[sourceId].fluent[1]` (same self-heal as today’s implicit path). Used for `withinLimit` / lagging / mastery streak — **never** inflated by session bonus.

**Clock time `T_clock` (UI countdown / auto-advance)**

| Mode | `T_clock` | Countdown | At 0 |
|------|-----------|-----------|------|
| **宽松** | Optional display when timed UI + explicit seconds; else ∞ | Shows if configured; stops at 0 | **No** auto-advance (current behavior) |
| **严格** | `T_target` | Always shown | Auto-advance; settle as **final wrong** (attempt A) |
| **自定义加成** | `T_target + bonusSec` | Always shown | Same as 严格 |

**Custom bonus UI:** chips +2 / +3 / +5 plus custom integer seconds (clamp **0–15**). Session uses confirmed `bonusSec`; may persist as settings default.

**`withinLimit`:** always `elapsedMs <= T_target * 1000`. Under custom bonus, answering after `T_target` but before `T_clock` can still be lagging while the clock has not yet forced advance.

**「限时答题」toggle:** controls whether settings UI edits per-type target seconds. **Does not** gate mode availability on the prep screen. If the user picks 严格/自定义 while the toggle is off, `T_target` still resolves via explicit seconds if present, else fluent — prep stays usable without bouncing to settings.

### Session star multiplier (end-of-session)

Applied **once at session finish** to the session’s earned-star total (not per-question). Formula:

| Mode | Multiplier |
|------|------------|
| **宽松** | `1.0`（无加成） |
| **严格** | `1.2`（+20%） |
| **自定义加成** | `max(1.0, 1.2 - 0.05 × bonusSec)` — each +1s of clock bonus reduces the 20% premium by 5 percentage points, floored at no premium |

Settlement: `finalStars = Math.round(rawStars × multiplier)` (0.5 rounds toward +∞ / standard `Math.round`). Wallet / session row persist **`finalStars`**. Prep UI **must** preview the live multiplier for the selected mode (see §3).

Examples: `bonusSec=0` → ×1.2; `bonusSec=2` → ×1.1; `bonusSec=4` → ×1.0; `bonusSec≥4` → ×1.0.

## §3 Settings defaults + prep screen

**Settings**
- Relabel per-type seconds as **目标时间** (suggestion chips still from `TIME_TARGETS`).
- Persist default session policy: `timingMode`: `relaxed` | `strict` | `bonus`; optional default `bonusSec`.
- Incremental schema only (`ALTER` / JSON field) — no wipe / truncate / reseed.

**Prep screen (daily only, before first question)**
- Show approx main-path `N`, makeup cap `M`, prefilled default mode (editable).
- Mode picker: 宽松 / 严格 / 自定义加成; bonus controls when bonus selected.
- **Star multiplier preview (required):** always show the live end-of-session star bonus for the currently selected mode / `bonusSec`, derived from `sessionStarMultiplier`:
  - 宽松 →「星星加成：无（×1.0）」
  - 严格 →「星星加成：+20%（×1.2）」
  - 自定义 →「星星加成：+X%（×Y）」where `X = round((multiplier - 1) * 100)`, `Y = multiplier` (updates when bonus chips / custom seconds change; at floor show「无额外加成（×1.0）」)
- Optional「设为默认」writes settings.
- CTA「开始练习」→ `buildSession`, start timers, enter answering.
- Back → home, no session row.

**Session authority:** confirmed prep values apply for this run; no per-session DB table required.

**FAQ / CLAUDE:** document three modes, retry ceiling, single-pass makeup, “clock soft / lagging hard” under bonus, and end-of-session star multipliers.

## Out of scope

- Drill / mistakes-mode prep screens
- Changing selection weights / coverage / cold-start formulas
- Auto-submit of partial keypad input on timeout (timeout = unanswered → final wrong)
- Changing per-question coin / streak formulas (only the end-of-session mode multiplier is added)

## Touch map (implementation hint)

| Area | Likely files |
|------|----------------|
| Prep UI + session state machine | `packages/calc/src/pages/session.tsx` (+ small prep component) |
| Limit helpers | `packages/calc/src/utils/calc-effective-limit.ts` (split target vs clock) |
| Settings type + persist | `@rosie/core` calc settings types; `useCalcSettings.ts` |
| Settings UI | `packages/calc/src/pages/settings.tsx` |
| Retry pool / makeup | `session.tsx` wrong-queue logic (replace unbounded requeue) |
| Docs | `FAQ.md`, `faq.tsx`, `CLAUDE.md` |
| SQL | incremental `docs/sql/…` if new columns |

## Success criteria

1. Daily prep always offers three modes even when「限时答题」is off; strict/bonus clocks use fluent when no explicit seconds.
2. Strict/bonus timeout auto-advances as final wrong; relaxed never auto-advances.
3. `withinLimit` ignores `bonusSec`.
4. Every daily session: makeup size ≤ `max(3, floor(N×0.15))`; makeup never requeues.
5. Settings defaults round-trip; prep can override for one session.
6. End-of-session stars: relaxed ×1.0; strict ×1.2; bonus ×`max(1.0, 1.2 - 0.05×bonusSec)`, `Math.round`.
7. Prep screen always shows live star-bonus preview for the selected mode / bonusSec.
8. `pnpm --filter @rosie/calc typecheck` passes.
