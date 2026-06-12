# Calc Fusion — Phase 1 Implementation Plan (Bigger Integer Ranges + Inverse Blank Form)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Broaden `/calc` free mode with larger-number blocks (1000以内 / 万以内 / 两位×两位 / 多位÷一位) and an optional "inverse blank" question form (`48 + □ = 105`), with no risk to existing behavior.

**Architecture:** New blocks are pure catalog data in `calc-blocks.ts` answered by the existing NumberPad. Inverse is a generation-time pure transform (`toInverseQuestion`) applied inside `buildSession` when a new `includeInverse` setting is on; it rewrites `display` to the blank form and sets `answer` to the hidden operand while keeping `signature`, so proficiency and source attribution track the same underlying fact. `QuestionDisplay` already renders the `□` blank form and the session already grades by comparing a typed number to `answer`, so no session/component changes are needed.

**Tech Stack:** Next.js 15 (App Router, client components), TypeScript (no `any`), Tailwind v4, Supabase. **No test runner exists** in this repo (per `CLAUDE.md`), so the usual TDD red/green is replaced by `pnpm lint` + `pnpm build` (type-check) + targeted manual verification in the running app. Per user preference, **the user runs `pnpm lint`/`pnpm build` manually** — verification steps below are written as checkpoints to hand to the user, not commands the agent runs.

---

## Scope

This plan covers **Phase 1 only** of the spec `docs/superpowers/specs/2026-06-12-calc-calculate-fusion-design.md`. Phases 2–6 (vertical mode, answer-model refactor + remainder/decimals, fractions, error diagnosis + report, decommission `/calculate`) are each planned just-in-time before they run, because Phase 3's answer-model union shape feeds Phase 4's fraction generator.

**Refinements vs. the spec's Phase 1 note:**
- The `EquationFill` component port is **dropped**. Inverse number-fill reuses the existing `QuestionDisplay` + `NumberPad`. (Operator-fill, e.g. `12 □ 4 = 3`, is out of scope — YAGNI.)
- Phase 1 **does** add one small `calc_settings` column (`include_inverse`). This is a one-line additive migration; the spec's "no schema change in Phase 1" was slightly optimistic. It is safe and backward-compatible (`?? false` default).

## File Structure

- **Modify** `src/utils/calc-blocks.ts` — add 4 generators + 6 `BLOCKS` entries (bigger ranges).
- **Create** `src/utils/calc-inverse.ts` — pure `toInverseQuestion(q)` transform.
- **Modify** `src/utils/calc-helpers.ts` — apply inverse in `buildSession`; guard carried-mistake reconstruction against the blank form.
- **Modify** `src/utils/type.ts` — add `includeInverse: boolean` to `CalcSettings`.
- **Modify** `src/hooks/useCalcSettings.ts` — plumb `include_inverse` (default, row map, row write, select columns, RawRow).
- **Modify** `src/app/calc/settings/page.tsx` — add a "题型选项" toggle (reuses existing `ToggleRow`).
- **Create** `docs/sql/calc-phase1-inverse-migration.sql` — add the column.

---

## Task 1: Add larger-number integer blocks

**Files:**
- Modify: `src/utils/calc-blocks.ts` (add to `addGen`/`subGen` objects ~lines 62–92; add to `BLOCKS` array ~lines 109–135)

- [ ] **Step 1: Add the four new generators**

In `src/utils/calc-blocks.ts`, add two entries to the `addGen` object (after the existing `r100b` entry, before the closing `}`):

```ts
  r1000: (): [number, number] => { const a = randInt(100, 899); return [a, randInt(50, Math.min(999 - a, 500))] },
  r10000: (): [number, number] => { const a = randInt(1000, 8000); return [a, randInt(500, Math.min(9999 - a, 3000))] },
```

And two entries to the `subGen` object (after its existing `r100b`, before the closing `}`):

```ts
  r1000: (): [number, number] => { const a = randInt(100, 999); return [a, randInt(50, a - 1)] },
  r10000: (): [number, number] => { const a = randInt(1000, 9999); return [a, randInt(100, a - 1)] },
```

(`mulBoth` and `divRange` already exist — Task 1 uses them directly, no new mul/div gens needed.)

- [ ] **Step 2: Register the six new blocks**

In the `BLOCKS` array, insert after `addBlock('add:100b', '100 以内进位', addGen.r100b),`:

```ts
  addBlock('add:1000', '1000 以内', addGen.r1000),
  addBlock('add:10000', '万以内', addGen.r10000),
```

Insert after `subBlock('sub:100b', '100 以内退位', subGen.r100b),`:

```ts
  subBlock('sub:1000', '1000 以内', subGen.r1000),
  subBlock('sub:10000', '万以内', subGen.r10000),
```

Insert after `mulBlock('mul:219', '2-19 综合', mulBoth(2, 19)),`:

```ts
  mulBlock('mul:2d', '两位数×两位数', mulBoth(11, 99)),
```

Insert after `divBlock('div:219', '÷2-19 综合', divRange(2, 19, 2, 19)),`:

```ts
  divBlock('div:multi', '多位数÷一位数', divRange(2, 9, 11, 99)),
```

- [ ] **Step 3: Type-check checkpoint (user runs)**

Ask the user to run: `pnpm lint`
Expected: no errors (the new gens match the `() => [number, number]` shape; `BLOCKS` stays `CalcBlock[]`).

- [ ] **Step 4: Manual checkpoint (user runs)**

Ask the user to open `/calc/settings` and confirm the new chips appear under their groups: 加法 → 「1000 以内」「万以内」; 减法 → same; 乘法 → 「两位数×两位数」; 除法 → 「多位数÷一位数」. Select a couple, tap 「✨ 用当前设置练一练！」, and confirm questions generate and grade correctly (e.g. a `两位数×两位数` answer matches).

- [ ] **Step 5: Commit**

```bash
git add src/utils/calc-blocks.ts
git commit -m "feat(calc): add larger-number blocks (1000/万以内, 两位×两位, 多位÷一位)"
```

---

## Task 2: Add the `includeInverse` setting (type + hook + migration)

**Files:**
- Modify: `src/utils/type.ts` (`CalcSettings`, ~lines 360–368)
- Modify: `src/hooks/useCalcSettings.ts` (DEFAULT_SETTINGS, RawRow, rowToSettings, settingsToRow, select string)
- Create: `docs/sql/calc-phase1-inverse-migration.sql`

- [ ] **Step 1: Add the field to the `CalcSettings` type**

In `src/utils/type.ts`, inside `interface CalcSettings`, add the field after `soundEnabled: boolean`:

```ts
  /** When true, ~30% of single-op questions render as an inverse blank form (48 + □ = 105). */
  includeInverse: boolean
```

- [ ] **Step 2: Plumb it through `useCalcSettings.ts`**

In `DEFAULT_SETTINGS`, add:

```ts
  includeInverse: false,
```

In `interface RawRow`, add:

```ts
  include_inverse: boolean | null
```

In `rowToSettings`, add to the returned object:

```ts
    includeInverse: row.include_inverse ?? false,
```

In `settingsToRow`, add to the returned object:

```ts
    include_inverse: s.includeInverse,
```

In BOTH `.select('...')` column strings (the `init` effect ~line 64 and the description: there are two identical select strings — one in `useEffect`), append `,include_inverse` to the column list so it reads:

```ts
'selected_blocks,mixed_ops,sound_enabled,last_count,last_time_limit,session_counter,time_limit_overrides,include_inverse'
```

(There is one `.select(...)` in this file — in the `init` effect. Update that one.)

- [ ] **Step 3: Create the migration**

Create `docs/sql/calc-phase1-inverse-migration.sql`:

```sql
-- Phase 1: optional inverse blank-form questions (48 + □ = 105).
-- Additive, backward-compatible. Run manually in Supabase.
alter table calc_settings
  add column if not exists include_inverse boolean not null default false;
```

- [ ] **Step 4: Run the migration (user runs)**

Ask the user to run the SQL in `docs/sql/calc-phase1-inverse-migration.sql` in the Supabase SQL editor. This must happen before Step 5's manual check, otherwise `.select('...,include_inverse')` errors and settings fall back to defaults.

- [ ] **Step 5: Type-check checkpoint (user runs)**

Ask the user to run: `pnpm lint`
Expected: no errors. `CalcSettings` now requires `includeInverse`; the next tasks consume it. (`DEFAULT_SETTINGS` and `rowToSettings` both supply it, so no missing-property errors.)

- [ ] **Step 6: Commit**

```bash
git add src/utils/type.ts src/hooks/useCalcSettings.ts docs/sql/calc-phase1-inverse-migration.sql
git commit -m "feat(calc): add includeInverse setting + migration"
```

---

## Task 3: Inverse transform utility

**Files:**
- Create: `src/utils/calc-inverse.ts`

- [ ] **Step 1: Write the transform**

Create `src/utils/calc-inverse.ts`:

```ts
import { parseSignature, OP_SYMBOL } from './calc-ast'
import type { CalcQuestion } from './type'

/** Glyph used for the hidden operand. Matches the blank form QuestionDisplay already supports. */
const BLANK = '□'

/**
 * Convert a single-op question into an inverse "blank" form, hiding one operand:
 *   add(48,57)=105  →  "48 + □ = 105" (answer 57)   or   "□ + 57 = 105" (answer 48)
 *
 * Returns null for anything that isn't a single binary op over two number leaves
 * (arity !== 1, or a parsed signature that isn't `{op, left:number, right:number}`).
 * Keeps signature / level / category / coinBase / isChallenge / source* so proficiency
 * and attribution continue tracking the same underlying fact.
 */
export function toInverseQuestion(q: CalcQuestion): CalcQuestion | null {
  if (q.arity !== 1) return null
  const ast = parseSignature(q.signature)
  if (typeof ast === 'number') return null
  const { op, left, right } = ast
  if (typeof left !== 'number' || typeof right !== 'number') return null

  const sym = OP_SYMBOL[op]
  const c = q.answer
  const hideRight = Math.random() < 0.5
  const display = hideRight
    ? `${left} ${sym} ${BLANK} = ${c}`
    : `${BLANK} ${sym} ${right} = ${c}`
  const answer = hideRight ? right : left

  return { ...q, display, answer }
}
```

(`parseSignature` and `OP_SYMBOL` are exported from `src/utils/calc-ast.ts` — verified.)

- [ ] **Step 2: Type-check checkpoint (user runs)**

Ask the user to run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/calc-inverse.ts
git commit -m "feat(calc): add toInverseQuestion blank-form transform"
```

---

## Task 4: Apply inverse in `buildSession` + guard carried-mistake reconstruction

**Files:**
- Modify: `src/utils/calc-helpers.ts` (`buildSession`, generation step ~lines 80–92 and carried step ~lines 94–107; add import at top)

- [ ] **Step 1: Import the transform**

At the top of `src/utils/calc-helpers.ts`, add to the existing imports:

```ts
import { toInverseQuestion } from './calc-inverse'
```

- [ ] **Step 2: Apply inverse to freshly-generated single-op questions**

In `buildSession`, immediately AFTER the `sources.forEach(...)` generation block (the loop that fills `out` per source, ending at the line `})` before the carried-over comment) and BEFORE step 5 (the carried `for (const m of carry)` block), insert:

```ts
  // 4.5 Optionally rewrite ~30% of eligible single-op block questions into the
  // inverse blank form (48 + □ = 105). Only block-sourced arity-1 questions are
  // eligible; mixed-op and carried questions are left as-is.
  if (settings.includeInverse) {
    for (let i = 0; i < out.length; i++) {
      const q = out[i]
      if (q.sourceBlockId && q.arity === 1 && Math.random() < 0.3) {
        const inv = toInverseQuestion(q)
        if (inv) out[i] = inv
      }
    }
  }
```

- [ ] **Step 3: Guard the carried-mistake display reconstruction**

In step 5 of `buildSession`, the carried loop currently builds each make-up question like:

```ts
  for (const m of carry) {
    out.push({
      display: `${m.display.replace(/\s*=\s*\?\s*$/, '')} = ?`,
      signature: m.signature,
      ...
```

Replace the `display:` line's value by computing it first. Change the loop body to:

```ts
  for (const m of carry) {
    // Inverse mistakes are stored as a complete blank equation ("48 + □ = 105");
    // normal mistakes are stored as a bare LHS needing "= ?". Detect by the blank glyph.
    const expr = m.display.replace(/\s*=\s*\?\s*$/, '')
    const display = expr.includes('□') ? expr : `${expr} = ?`
    out.push({
      display,
      signature: m.signature,
      arity: 1,
      level: m.level,
      answer: m.answer,
      isChallenge: false,
      category: m.category,
      coinBase: 1,
    })
  }
```

- [ ] **Step 4: Type-check checkpoint (user runs)**

Ask the user to run: `pnpm lint`
Expected: no errors.

- [ ] **Step 5: Manual checkpoint (user runs)**

Ask the user to: open `/calc/settings`, enable the new 「包含逆运算（挖空）」 toggle (added in Task 5 — if running tasks out of order, temporarily flip `include_inverse` to `true` in Supabase), select some single-op blocks, and practice. Confirm:
1. Some questions appear as `48 + □ = 105` (blank in the middle, no trailing `= ?`).
2. Typing the missing operand (57) grades as correct; a wrong answer reveals the operand.
3. Mixed-op questions are never turned into blank form.

- [ ] **Step 6: Commit**

```bash
git add src/utils/calc-helpers.ts
git commit -m "feat(calc): emit inverse blank questions + carry them correctly"
```

---

## Task 5: Settings toggle UI

**Files:**
- Modify: `src/app/calc/settings/page.tsx` (add a section after 混合运算 ~line 157, before 题量·限时 ~line 159)

> **Design note:** This reuses the existing `ToggleRow` component verbatim (same as the 音效 toggle) — no new visual treatment, so the `frontend-design` skill is not required for this step. If a richer treatment is later wanted, invoke `frontend-design:frontend-design` first.

- [ ] **Step 1: Add the toggle section**

In `src/app/calc/settings/page.tsx`, insert this `<section>` between the 混合运算 section's closing `</section>` and the 题量 · 限时 section's opening `<section>`:

```tsx
        {/* 题型选项 */}
        <section>
          <SectionHeading>题型选项</SectionHeading>
          <ToggleRow
            label="包含逆运算（挖空）"
            description="部分单运算题以 48 + □ = 105 的形式出现，考察更深"
            value={settings.includeInverse}
            onChange={(v) => update({ includeInverse: v })}
          />
        </section>
```

(`ToggleRow`, `SectionHeading`, `settings`, and `update` are all already defined/in-scope in this file.)

- [ ] **Step 2: Type-check checkpoint (user runs)**

Ask the user to run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Manual checkpoint (user runs)**

Ask the user to open `/calc/settings`, confirm the 「题型选项」 section with the 「包含逆运算（挖空）」 toggle renders, toggling it persists (reload page → state retained), and that with it ON a practice session shows blank-form questions (re-confirm Task 4 Step 5 end-to-end through the real toggle).

- [ ] **Step 4: Commit**

```bash
git add src/app/calc/settings/page.tsx
git commit -m "feat(calc): settings toggle for inverse blank questions"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full build checkpoint (user runs)**

Ask the user to run: `pnpm build`
Expected: build succeeds with no TypeScript errors (per `CLAUDE.md`, run a build before merging UI changes).

- [ ] **Step 2: End-to-end manual checkpoint (user runs)**

Ask the user to confirm, in `pnpm dev` or a preview build:
1. New larger-number blocks selectable and practiced (Task 1 Step 4).
2. Inverse toggle off → no blank questions (regression: existing behavior unchanged).
3. Inverse toggle on → ~1/3 of single-op questions are blank form, graded correctly.
4. A blank-form question answered wrong twice becomes a mistake, and on the next session is carried back **without** a doubled `= ?` (renders as `48 + □ = 105`, not `48 + □ = 105 = ?`).

- [ ] **Step 3: Done**

Phase 1 complete. Update `MEMORY.md`/project notes if desired, and start the Phase 2 (vertical mode) plan when ready.

---

## Self-Review

- **Spec coverage (Phase 1 section):** "更大整数范围" → Task 1. "逆运算/等式挖空" → Tasks 3–5 (number-fill blank form; operator-fill explicitly dropped as YAGNI). "/calc/settings 加入新积木 + 逆运算开关" → new blocks auto-appear via `BlockPicker` (Task 1 Step 4), toggle added in Task 5. "无答案模型改动" → confirmed: `answer` stays `number`, no `CalcQuestion` shape change.
- **Placeholder scan:** none — every code step has complete code; every verification step has an exact command and expected result.
- **Type consistency:** `includeInverse: boolean` defined in `CalcSettings` (Task 2) and read in `buildSession` (Task 4) and the settings page (Task 5). `toInverseQuestion` signature `(q: CalcQuestion) => CalcQuestion | null` defined in Task 3, imported/called in Task 4. Block ids (`add:1000`, `add:10000`, `sub:1000`, `sub:10000`, `mul:2d`, `div:multi`) are introduced once in Task 1 and not referenced by string elsewhere. The carried-reconstruction object in Task 4 keeps the exact same fields the original had (`display, signature, arity, level, answer, isChallenge, category, coinBase`).
- **Deviation flagged:** Phase 1 adds one additive `calc_settings` column (migration in Task 2), refining the spec's "no schema change in Phase 1."
