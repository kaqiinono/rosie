# Calc session timing modes + retry ceiling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add daily-session prep (宽松/严格/自定义加成), split target vs clock limits, and harden all daily sessions with a capped single-pass retry pool.

**Architecture:** Pure helpers for `MaxRetry`, `T_target` / `T_clock`, and retry-pool enqueue; settings persist default `timingMode` + `bonusSec` via incremental SQL columns; `/calc/session` stays on a prep state for `mode=daily` until confirm, then builds the session and runs a state machine that auto-advances on clock expiry in strict/bonus and never requeues from makeup.

**Tech Stack:** TypeScript, `@rosie/calc` + `@rosie/core`, Supabase `ALTER … ADD COLUMN IF NOT EXISTS`, Vitest via `apps/web`.

**Spec:** [`docs/superpowers/specs/2026-07-09-calc-session-timing-modes-design.md`](../specs/2026-07-09-calc-session-timing-modes-design.md)

## Global Constraints

- Daily only (`mode=daily`): prep screen + retry ceiling + single-pass makeup; drills / mistakes mode unchanged
- `MaxRetry = max(3, floor(plannedCount × 0.15))`
- Makeup: single-pass — never re-enqueue from makeup tail
- `T_target` = explicit seconds `> 0` else `TIME_TARGETS.fluent[1]` — used for `withinLimit` / lagging; **never** + bonus
- `T_clock` = `T_target` (strict) or `T_target + bonusSec` (bonus); relaxed: optional countdown, **no** auto-advance
- Timeout auto-advance = unanswered → **final wrong** (no partial keypad submit)
- Custom `bonusSec` clamp **0–15**; chips +2 / +3 / +5 + custom
- Prep offers all three modes even when `timedAnswerEnabled` is false
- End-of-session star multiplier (daily): relaxed ×1.0; strict ×1.2; bonus ×`max(1.0, 1.2 - 0.05×bonusSec)`; `finalStars = Math.round(rawStars × multiplier)` applied once in `finishSession` before wallet write
- SQL: only `ALTER … ADD COLUMN IF NOT EXISTS`; no DELETE/TRUNCATE/重灌
- Before done: `pnpm --filter @rosie/calc typecheck` and focused vitest for new helpers

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `docs/sql/calc-session-timing-modes.sql` | Create | Add `timing_mode`, `bonus_sec` columns |
| `packages/core/src/type.ts` | Modify | `CalcTimingMode`, settings fields |
| `packages/calc/src/utils/calc-session-policy.ts` | Create | `maxRetryCeiling`, `clampBonusSec`, `resolveTargetSec`, `resolveClockSec`, retry-pool helpers |
| `packages/calc/src/utils/calc-effective-limit.ts` | Modify | Align / delegate target resolution to policy helpers (keep `effectiveLimitSec` for lagging) |
| `packages/calc/src/hooks/useCalcSettings.ts` | Modify | Load/persist new fields |
| `packages/calc/src/components/SessionPrepScreen.tsx` | Create | Prep UI |
| `packages/calc/src/pages/session.tsx` | Modify | Prep gate, clock auto-advance, capped single-pass retry |
| `packages/calc/src/pages/settings.tsx` | Modify | Default mode + 目标时间 copy |
| `packages/calc/FAQ.md`, `faq.tsx`, `CLAUDE.md` | Modify | Document modes + iron rules |
| `packages/calc/src/index.ts` | Modify | Export pure helpers for tests |
| `apps/web/tests/calc-session-policy.test.ts` | Create | Unit tests |

---

### Task 1: Pure policy helpers + tests

**Files:**
- Create: `packages/calc/src/utils/calc-session-policy.ts`
- Create: `apps/web/tests/calc-session-policy.test.ts`
- Modify: `packages/calc/src/index.ts`
- Modify: `packages/calc/src/utils/calc-effective-limit.ts` (thin wrap / shared target resolve)

**Interfaces:**
- Produces:
  - `export type CalcTimingMode = 'relaxed' | 'strict' | 'bonus'`
  - `maxRetryCeiling(plannedCount: number): number` → `max(3, Math.floor(plannedCount * 0.15))`
  - `clampBonusSec(n: number): number` → integer clamp 0..15
  - `resolveTargetSec(args: { explicitSeconds: number | null | undefined; sourceId: string | undefined }): number` — if `explicitSeconds != null && explicitSeconds > 0` use it; else `TIME_TARGETS[sourceId].fluent[1]` or `groupDefaultLimitSec(sourceId)`
  - `resolveClockSec(args: { mode: CalcTimingMode; targetSec: number; bonusSec: number; timedAnswerEnabled: boolean; explicitSeconds: number | null | undefined }): number | null` — `null` means ∞ UI:
    - `strict` → `targetSec`
    - `bonus` → `targetSec + clampBonusSec(bonusSec)`
    - `relaxed` → if `timedAnswerEnabled && explicitSeconds > 0` then `explicitSeconds`, else `null`
  - `tryEnqueueRetry(pool: T[], item: T, maxRetry: number): { pool: T[]; enqueued: boolean }` — push if `pool.length < maxRetry`
  - `isInMakeupPhase(idx: number, plannedCount: number): boolean` → `idx >= plannedCount`
  - `sessionStarMultiplier(mode: CalcTimingMode, bonusSec: number): number` — relaxed `1`; strict `1.2`; bonus `Math.max(1, 1.2 - 0.05 * clampBonusSec(bonusSec))`
  - `applySessionStarMultiplier(rawStars: number, mode: CalcTimingMode, bonusSec: number): number` → `Math.round(rawStars * sessionStarMultiplier(...))`

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/tests/calc-session-policy.test.ts
import { describe, it, expect } from 'vitest'
import {
  maxRetryCeiling,
  clampBonusSec,
  resolveTargetSec,
  resolveClockSec,
  tryEnqueueRetry,
} from '@rosie/calc'

describe('maxRetryCeiling', () => {
  it('uses 15% floored with floor of 3', () => {
    expect(maxRetryCeiling(20)).toBe(3)   // floor(3)=3
    expect(maxRetryCeiling(100)).toBe(15)
    expect(maxRetryCeiling(10)).toBe(3)   // floor(1.5)=1 → max 3
    expect(maxRetryCeiling(0)).toBe(3)
  })
})

describe('clampBonusSec', () => {
  it('clamps 0..15', () => {
    expect(clampBonusSec(-1)).toBe(0)
    expect(clampBonusSec(3.7)).toBe(3)
    expect(clampBonusSec(99)).toBe(15)
  })
})

describe('resolveTargetSec / resolveClockSec', () => {
  it('target prefers explicit > 0 else fluent for known block', () => {
    expect(resolveTargetSec({ explicitSeconds: 6, sourceId: 'mul:25' })).toBe(6)
    // mul:25 fluent[1] is 4 per TIME_TARGETS
    expect(resolveTargetSec({ explicitSeconds: 0, sourceId: 'mul:25' })).toBe(4)
    expect(resolveTargetSec({ explicitSeconds: null, sourceId: 'mul:25' })).toBe(4)
  })

  it('clock: strict=target, bonus=target+bonus, relaxed optional', () => {
    expect(resolveClockSec({
      mode: 'strict', targetSec: 5, bonusSec: 3,
      timedAnswerEnabled: false, explicitSeconds: null,
    })).toBe(5)
    expect(resolveClockSec({
      mode: 'bonus', targetSec: 5, bonusSec: 3,
      timedAnswerEnabled: false, explicitSeconds: null,
    })).toBe(8)
    expect(resolveClockSec({
      mode: 'relaxed', targetSec: 5, bonusSec: 3,
      timedAnswerEnabled: false, explicitSeconds: 6,
    })).toBeNull()
    expect(resolveClockSec({
      mode: 'relaxed', targetSec: 5, bonusSec: 3,
      timedAnswerEnabled: true, explicitSeconds: 6,
    })).toBe(6)
  })
})

describe('tryEnqueueRetry', () => {
  it('caps at maxRetry', () => {
    let pool: string[] = []
    let r = tryEnqueueRetry(pool, 'a', 2)
    expect(r.enqueued).toBe(true)
    pool = r.pool
    r = tryEnqueueRetry(pool, 'b', 2)
    expect(r.enqueued).toBe(true)
    pool = r.pool
    r = tryEnqueueRetry(pool, 'c', 2)
    expect(r.enqueued).toBe(false)
    expect(r.pool).toEqual(['a', 'b'])
  })
})

describe('sessionStarMultiplier', () => {
  it('relaxed 1, strict 1.2, bonus decays 5pp per second to floor 1', () => {
    expect(sessionStarMultiplier('relaxed', 0)).toBe(1)
    expect(sessionStarMultiplier('strict', 99)).toBe(1.2)
    expect(sessionStarMultiplier('bonus', 0)).toBe(1.2)
    expect(sessionStarMultiplier('bonus', 2)).toBeCloseTo(1.1)
    expect(sessionStarMultiplier('bonus', 4)).toBe(1)
    expect(sessionStarMultiplier('bonus', 10)).toBe(1)
  })

  it('applySessionStarMultiplier rounds', () => {
    expect(applySessionStarMultiplier(10, 'strict', 0)).toBe(12)
    expect(applySessionStarMultiplier(10, 'bonus', 2)).toBe(11)
    expect(applySessionStarMultiplier(10, 'relaxed', 0)).toBe(10)
  })
})
```

Import `sessionStarMultiplier` and `applySessionStarMultiplier` in the test file.
- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter web exec vitest run tests/calc-session-policy.test.ts
```

- [ ] **Step 3: Implement `calc-session-policy.ts`**

```ts
import { TIME_TARGETS } from './calc-time-targets'
import { groupDefaultLimitSec } from './calc-effective-limit'

export type CalcTimingMode = 'relaxed' | 'strict' | 'bonus'

export function maxRetryCeiling(plannedCount: number): number {
  return Math.max(3, Math.floor(Math.max(0, plannedCount) * 0.15))
}

export function clampBonusSec(n: number): number {
  return Math.min(15, Math.max(0, Math.floor(n)))
}

export function resolveTargetSec(args: {
  explicitSeconds: number | null | undefined
  sourceId: string | undefined
}): number {
  const { explicitSeconds, sourceId } = args
  if (explicitSeconds != null && explicitSeconds > 0) return explicitSeconds
  if (sourceId && TIME_TARGETS[sourceId]) return TIME_TARGETS[sourceId].fluent[1]
  return groupDefaultLimitSec(sourceId)
}

export function resolveClockSec(args: {
  mode: CalcTimingMode
  targetSec: number
  bonusSec: number
  timedAnswerEnabled: boolean
  explicitSeconds: number | null | undefined
}): number | null {
  const { mode, targetSec, bonusSec, timedAnswerEnabled, explicitSeconds } = args
  if (mode === 'strict') return targetSec
  if (mode === 'bonus') return targetSec + clampBonusSec(bonusSec)
  // relaxed
  if (timedAnswerEnabled && explicitSeconds != null && explicitSeconds > 0) return explicitSeconds
  return null
}

export function tryEnqueueRetry<T>(pool: T[], item: T, maxRetry: number): { pool: T[]; enqueued: boolean } {
  if (pool.length >= maxRetry) return { pool, enqueued: false }
  return { pool: [...pool, item], enqueued: true }
}

export function isInMakeupPhase(idx: number, plannedCount: number): boolean {
  return idx >= plannedCount
}

export function sessionStarMultiplier(mode: CalcTimingMode, bonusSec: number): number {
  if (mode === 'relaxed') return 1
  if (mode === 'strict') return 1.2
  return Math.max(1, 1.2 - 0.05 * clampBonusSec(bonusSec))
}

export function applySessionStarMultiplier(
  rawStars: number,
  mode: CalcTimingMode,
  bonusSec: number,
): number {
  return Math.round(rawStars * sessionStarMultiplier(mode, bonusSec))
}
```

Update `effectiveLimitSec` so lagging path always uses target semantics (explicit > 0 else fluent) **without** requiring `timedAnswerEnabled` for the fluent fallback — i.e. when timed is off, still return fluent/target (matches current cognitive behavior and prep strict/bonus). Keep function name; adjust body if today it only uses fluent when timed is off (read file — current code already uses fluent when timed off / no explicit). Ensure session `withinLimitForQuestion` calls `resolveTargetSec` (or `effectiveLimitSec` that ignores bonus).

- [ ] **Step 4: Export from `@rosie/calc` index; run tests PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/utils/calc-session-policy.ts packages/calc/src/utils/calc-effective-limit.ts packages/calc/src/index.ts apps/web/tests/calc-session-policy.test.ts
git commit -m "$(cat <<'EOF'
feat(calc): add session timing policy helpers and retry ceiling math

EOF
)"
```

---

### Task 2: Settings schema + types + persist

**Files:**
- Create: `docs/sql/calc-session-timing-modes.sql`
- Modify: `packages/core/src/type.ts`
- Modify: `packages/calc/src/hooks/useCalcSettings.ts`

**Interfaces:**
- Extends `CalcSettings` with:
  - `timingMode: CalcTimingMode` default `'relaxed'`
  - `bonusSec: number` default `3` (clamped on write)
- SQL columns: `timing_mode text not null default 'relaxed'`, `bonus_sec integer not null default 3`
- Re-export or import `CalcTimingMode` from calc policy in core? **Prefer define the union in `@rosie/core` next to `CalcSettings`** so settings types stay in core; calc-session-policy imports/re-exports the same union from core to avoid drift:

```ts
// packages/core/src/type.ts
export type CalcTimingMode = 'relaxed' | 'strict' | 'bonus'
```

Then `calc-session-policy.ts` does `import type { CalcTimingMode } from '@rosie/core'` and re-exports it.

- [ ] **Step 1: SQL file**

```sql
-- docs/sql/calc-session-timing-modes.sql
ALTER TABLE calc_settings
  ADD COLUMN IF NOT EXISTS timing_mode text NOT NULL DEFAULT 'relaxed';

ALTER TABLE calc_settings
  ADD COLUMN IF NOT EXISTS bonus_sec integer NOT NULL DEFAULT 3;
```

- [ ] **Step 2: Types + hook mapping**

In `CalcSettings` add fields. In `RawRow` / `rowToSettings` / `settingsToRow` / `DEFAULT_SETTINGS` map `timing_mode` ↔ `timingMode`, `bonus_sec` ↔ `bonusSec` with clamp + mode whitelist (`relaxed|strict|bonus`, else `relaxed`).

Apply `normalizeSettings` (existing) then ensure new fields survive.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @rosie/calc typecheck
pnpm --filter @rosie/core typecheck
```

- [ ] **Step 4: Commit**

```bash
git add docs/sql/calc-session-timing-modes.sql packages/core/src/type.ts packages/calc/src/hooks/useCalcSettings.ts packages/calc/src/utils/calc-session-policy.ts
git commit -m "$(cat <<'EOF'
feat(calc): persist default timing mode and bonus seconds

EOF
)"
```

Note in commit/PR body: operator must run the SQL once on Supabase (incremental).

---

### Task 3: Retry pool + single-pass in daily session

**Files:**
- Modify: `packages/calc/src/pages/session.tsx`
- Optional extract: keep enqueue logic inline calling `tryEnqueueRetry` / `maxRetryCeiling`

**Behavior changes (daily only):**

1. After `buildSession`, set `plannedCount` as today; `maxRetryRef.current = maxRetryCeiling(plannedCount)`.
2. Replace unbounded `wrongQueueRef` append on final wrong:
   - If `idx < plannedCount` (main path): `tryEnqueueRetry`; if not enqueued, still `addMistake` / proficiency updates.
   - If `idx >= plannedCount` (makeup): **never** enqueue; on wrong show feedback then `goNext` only.
3. When draining queue at end of main path: append **at most** current pool (already capped); do not accept new items during makeup.
4. Immersive mode: same enqueue rules; makeup still single-pass.

**Do not** change drill / `mode=mistakes` paths (no ceiling).

- [ ] **Step 1: Implement session wiring** (manual test checklist in report; unit coverage already on `tryEnqueueRetry`)

Key snippet for final-wrong / timeout-wrong:

```ts
const inMakeup = idx >= plannedCountRef.current
if (!q.isChallenge && mode !== 'mistakes' && !drillParams) {
  if (!inMakeup) {
    const { pool, enqueued } = tryEnqueueRetry(
      wrongQueueRef.current,
      { ...q },
      maxRetryRef.current,
    )
    wrongQueueRef.current = pool
    void enqueued // long-term mistake write happens regardless below
  }
}
// addMistake always for daily final wrong (including timeout), as today
```

When advancing after last main-path item, append `wrongQueueRef` once (existing drain), then clear ref so makeup cannot grow.

- [ ] **Step 2: Status bar already shows makeup i/M via `planned` vs `total` — ensure `total = planned + pool.length` after drain**

- [ ] **Step 3: Typecheck**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(calc): cap daily makeup queue and enforce single-pass retry

EOF
)"
```

---

### Task 4: Prep screen + timing mode clock / auto-advance

**Files:**
- Create: `packages/calc/src/components/SessionPrepScreen.tsx`
- Modify: `packages/calc/src/pages/session.tsx`

**Prep gate (daily only):**
- Do **not** call `buildSession` until user confirms (or estimate `N` for display: auto → `settings.lastCount`; manual → sum of counts — same as home).
- Show `M = maxRetryCeiling(N)`.
- Mode radios + bonus chips;「设为默认」→ `update({ timingMode, bonusSec })`.
-「开始练习」→ store session-local `sessionTimingMode` / `sessionBonusSec` in refs/state → then run existing init/`buildSession`.
- Drill / mistakes: skip prep (current immediate init).

**Clock + withinLimit:**
- `withinLimitForQuestion`: use `resolveTargetSec` only (ignore mode bonus; ignore need for timed toggle).
- `secondsForQuestion` / `remainingSec`: use `resolveClockSec` with session mode.
- Auto-advance: `useEffect` when `mode` is daily and session mode is `strict|bonus` and `remainingSec === 0` and not in feedback and question active → call settle as final wrong with empty/unanswered answer (reuse diagnose path; `userAnswer` empty string), then advance. Guard with a ref so it fires once per question.

**Relaxed:** no auto-advance effect.

**End-of-session stars (daily):** In `finishSession`, before writing `coinsEarned` / wallet:

```ts
const raw = coinsTotalRef.current
const finalStars = applySessionStarMultiplier(raw, sessionTimingMode, sessionBonusSec)
coinsTotalRef.current = finalStars
setCoinsTotal(finalStars)
// persist coinsEarned: finalStars
```

Prep screen **must** show the live multiplier preview from `sessionStarMultiplier` (updates when mode / bonusSec changes). Drills / mistakes: multiplier **1.0** (no mode).

- [ ] **Step 1: Build `SessionPrepScreen`**

Props sketch:

```ts
type Props = {
  plannedEstimate: number
  maxRetry: number
  timingMode: CalcTimingMode
  bonusSec: number
  onChangeMode: (m: CalcTimingMode) => void
  onChangeBonus: (n: number) => void
  onSaveDefault: () => void
  onStart: () => void
  onBack: () => void
}
```

UI: dark calc chrome consistent with home/settings; three mode cards; bonus row when `bonus`; **dedicated star-bonus line** always visible (宽松 无/+0%、严格 +20%、自定义随秒数变); primary CTA.

- [ ] **Step 2: Wire session.tsx prep + timeout effect**

- [ ] **Step 3: Typecheck + smoke mentally / browser if available**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(calc): add daily session prep and strict/bonus clock auto-advance

EOF
)"
```

---

### Task 5: Settings copy + FAQ + CLAUDE

**Files:**
- Modify: `packages/calc/src/pages/settings.tsx`
- Modify: `packages/calc/FAQ.md`
- Modify: `packages/calc/src/pages/faq.tsx`
- Modify: `packages/calc/CLAUDE.md`

- [ ] **Step 1: Settings**
  - Relabel per-type「限时」→「目标时间」where user-facing.
  - Add default timing mode picker + bonus default (same chips).
  - Soften「限时答题」description: controls editing targets / relaxed countdown; prep always offers modes.

- [ ] **Step 2: FAQ** — short section on 三模式、补练上限、单次清算、自定义加成「倒计时含加成 / 卡顿仍按目标」.

- [ ] **Step 3: CLAUDE.md** — engine blurb for prep, `calc-session-policy`, retry ceiling.

- [ ] **Step 4: Typecheck + commit**

```bash
git commit -m "$(cat <<'EOF'
docs(calc): document session timing modes and retry ceiling

EOF
)"
```

---

### Task 6: Final verification

- [ ] **Step 1: Commands**

```bash
pnpm --filter @rosie/calc typecheck
pnpm --filter web exec vitest run tests/calc-session-policy.test.ts
```

- [ ] **Step 2: Manual / code smoke**
  - Daily: prep visible; start → questions; strict timeout advances as wrong; makeup ≤ M; makeup wrong does not grow tail.
  - Confirm SQL file present for ops.

- [ ] **Step 3: Commit only if fixups**

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| MaxRetry formula + daily scope | T1, T3 |
| Single-pass makeup | T3 |
| T_target vs T_clock + bonus | T1, T4 |
| Timeout = final wrong | T4 |
| End-of-session star multiplier | T1 helpers, T4 `finishSession` |
| Prep + defaults in settings | T2, T4, T5 |
| Modes available when timed off | T1 clock/target, T4 |
| FAQ / CLAUDE | T5 |
| Incremental SQL | T2 |

## Self-review notes

- `CalcTimingMode` lives in `@rosie/core` (settings owner); policy module re-exports.
- Prep estimate `N` may differ slightly from post-`buildSession` `plannedCount` if carried mistakes append — status bar uses real `plannedCount` after start; prep copy says「约 N 题」.
- Speed bonus coins still require UI `secondsForQuestion` / withinLimit as today — under strict/bonus, prefer gating speed bonus on `withinLimit` (target), not clock.
- Session mode star multiplier is **end-of-session only** (option A); live HUD during play shows raw running total; summary / wallet use multiplied total (option: briefly show「模式加成 +X」on the summary card).
