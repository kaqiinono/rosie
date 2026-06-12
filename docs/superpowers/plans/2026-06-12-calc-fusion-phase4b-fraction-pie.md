# Calc Fusion — Phase 4b Implementation Plan (Fraction Pie for 同分母入门)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the hybrid fraction input — for 同分母加减 with a proper result, answer with a tactile **`FractionPie`** (operand pies + a tap-to-fill answer pie); all other fraction questions keep the `FractionPad` keypad from Phase 4a.

**Architecture:** A pure helper `fractionPieSpec(q)` decides pie-eligibility by parsing the question's display (same-denominator add/sub, answer ≤ 1), returning the operand numerators + shared denominator + op (or null). The session/modal fraction branch chooses `FractionPie` when a spec exists, else `FractionPad`. `FractionPie` renders read-only operand pies and one answer pie whose `den` slices the child taps to set the numerator, then submits `numerator` (the dispatch wraps it into `"numerator/den"` for the existing `handleFractionSubmit`/`submitValue`).

**Tech Stack:** Next.js 15 (client components), TypeScript (no `any`), Tailwind v4 + inline SVG, Supabase. **No test runner** — verification is `pnpm lint` + `pnpm build` + manual, **run by the user**. No migration.

---

## Scope

Phase 4b — the deferred visual half of Phase 4's hybrid input. Builds on Phase 4a (fraction blocks, `FractionPad`, `handleFractionSubmit`/`submitValue`, 约分 hint). Pie applies ONLY to 同分母加减 with proper (≤1) result; 异分母 / ×/÷ / improper results stay on `FractionPad` (unchanged).

**Decisions locked:**
- **New tactile `FractionPie`** (tap slices to fill), NOT a port of `calculate`'s `FractionVis` (whose denominator `<select>` can't represent dens 7/9 and isn't tactile). Reuses `FractionVis`'s SVG slice geometry.
- **Eligibility via display parsing** (`fractionPieSpec`) so it also works for carried mistakes (no `sourceBlockId` needed).
- Pie submits a numerator (0..den); the shared denominator is fixed (= operand denominator), reinforcing "同分母 → 分母不变".

## File Structure

- **Modify** `src/utils/calc-helpers.ts` — add `fractionPieSpec(q)` helper.
- **Create** `src/components/calc/FractionPie.tsx` — operand pies + tap-to-fill answer pie.
- **Modify** `src/app/calc/session/page.tsx` — fraction branch chooses pie vs pad.
- **Modify** `src/components/calc/QuickPracticeModal.tsx` — same hybrid choice.

---

## Task 1: `fractionPieSpec` helper

**Files:** `src/utils/calc-helpers.ts`

- [ ] **Step 1: Add the helper** — at the END of `src/utils/calc-helpers.ts` (it already imports `CalcQuestion` from `./type`):
```ts
/**
 * Pie-eligibility for a fraction question: same-denominator add/sub with a proper
 * (≤ 1) non-negative answer. Returns the two operand numerators, the shared
 * denominator, and the op — or null (caller falls back to the FractionPad keypad).
 * Parses the display so it also works for carried mistakes (no sourceBlockId).
 */
export function fractionPieSpec(
  q: CalcQuestion,
): { operands: [number, number]; den: number; op: '+' | '−' } | null {
  if (q.answer.kind !== 'fraction') return null
  if (q.answer.num < 0 || q.answer.num > q.answer.den) return null
  const m = q.display.match(/^(\d+)\/(\d+)\s*([+−-])\s*(\d+)\/(\d+)\s*=/)
  if (!m) return null
  const d1 = Number(m[2])
  const d2 = Number(m[5])
  if (d1 !== d2) return null
  return { operands: [Number(m[1]), Number(m[4])], den: d1, op: m[3] === '+' ? '+' : '−' }
}
```

- [ ] **Step 2: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 3: Commit**
```bash
git add src/utils/calc-helpers.ts
git commit -m "feat(calc): add fractionPieSpec (pie-eligibility for 同分母加减)"
```

---

## Task 2: `FractionPie` component

**Files:** `src/components/calc/FractionPie.tsx`

> NEW UI component. **Invoke `frontend-design:frontend-design` first.** Match calc's dark/purple, playful 7-year-old aesthetic (read `src/components/calc/RemainderPad.tsx` for the panel/submit look, and `src/components/calculate/FractionVis.tsx` for the SVG pie slice geometry to reuse).

- [ ] **Step 1: Build the component** with this fixed contract (styling per frontend-design):
  - Props: `{ operands: [number, number]; den: number; op: '+' | '−'; onSubmit: (numerator: number) => void; disabled?: boolean }`.
  - Renders, left→right: operand-1 pie (filled `operands[0]`/`den`), the `op` symbol, operand-2 pie (filled `operands[1]`/`den`), an `=`, then the ANSWER pie (`den` slices, initially empty) which is tappable.
  - Each pie is an SVG circle split into `den` equal slices; filled slices use an accent fill, empty slices a faint fill (reuse `FractionVis`'s slice-path math: for slice `i`, angles `(i/den)*2π − π/2` to `((i+1)/den)*2π − π/2`).
  - **Tap-to-fill** the answer pie: track `filled` (0..den). Tapping slice `i` sets `filled = i + 1`, EXCEPT tapping the current boundary slice (`filled === i + 1`) sets `filled = i` (so the child can reduce, including to 0). Show the running `filled/den` as text under the answer pie.
  - A ✓ submit button (calc green gradient); on press calls `onSubmit(filled)` EXACTLY ONCE (a `submitted` lock), then disables.
  - `disabled` (and `submitted`) disable tapping and the submit button.

Reference skeleton (logic; restyle per frontend-design):
```tsx
'use client'

import { useState } from 'react'

interface Props {
  operands: [number, number]
  den: number
  op: '+' | '−'
  onSubmit: (numerator: number) => void
  disabled?: boolean
}

function slicePath(i: number, den: number, cx: number, cy: number, r: number): string {
  const a0 = (i / den) * 2 * Math.PI - Math.PI / 2
  const a1 = ((i + 1) / den) * 2 * Math.PI - Math.PI / 2
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  const large = 1 / den > 0.5 ? 1 : 0
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
}

export default function FractionPie({ operands, den, op, onSubmit, disabled }: Props) {
  const [filled, setFilled] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const tap = (i: number) => {
    if (disabled || submitted) return
    setFilled((prev) => (prev === i + 1 ? i : i + 1))
  }
  const submit = () => {
    if (disabled || submitted) return
    setSubmitted(true)
    onSubmit(filled)
  }
  // ...render operand pies (read-only, fill = operands[k]), op symbol, '=',
  //    tappable answer pie (fill = filled, onClick per slice = tap(i)), filled/den text,
  //    and a ✓ submit button — per frontend-design, calc dark-purple theme...
}
```

- [ ] **Step 2: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 3: Commit**
```bash
git add src/components/calc/FractionPie.tsx
git commit -m "feat(calc): add FractionPie (tap-to-fill pie for 同分母 fractions)"
```

---

## Task 3: Hybrid dispatch in the main session

**Files:** `src/app/calc/session/page.tsx`

- [ ] **Step 1: Imports** — add near the other `@/components/calc` imports:
```ts
import FractionPie from '@/components/calc/FractionPie'
```
and add `fractionPieSpec` to the existing `@/utils/calc-helpers` import (currently `{ buildSession, calcTimeBonus, coinReward }`):
```ts
import { buildSession, calcTimeBonus, coinReward, fractionPieSpec } from '@/utils/calc-helpers'
```

- [ ] **Step 2: Choose pie vs pad in the fraction branch** — the fraction branch currently is:
```tsx
        {currentQ.answer.kind === 'fraction' ? (
          <FractionPad key={idx} disabled={!!feedback || done} onSubmit={handleFractionSubmit} />
        ) : currentQ.answer.kind === 'remainder' ? (
```
Replace the `<FractionPad ... />` line (the inner content of that branch) so it chooses pie vs pad:
```tsx
        {currentQ.answer.kind === 'fraction' ? (
          (() => {
            const spec = fractionPieSpec(currentQ)
            return spec ? (
              <FractionPie
                key={idx}
                operands={spec.operands}
                den={spec.den}
                op={spec.op}
                disabled={!!feedback || done}
                onSubmit={(n) => handleFractionSubmit(`${n}/${spec.den}`)}
              />
            ) : (
              <FractionPad key={idx} disabled={!!feedback || done} onSubmit={handleFractionSubmit} />
            )
          })()
        ) : currentQ.answer.kind === 'remainder' ? (
```

- [ ] **Step 3: Type-check + build checkpoint (user runs)** — `pnpm lint` then `pnpm build`.

- [ ] **Step 4: Manual checkpoint (user runs)** — select 分数「同分母加减」 + 「异分母加减」 and practice the main session:
  1. 同分母加减 with a proper result (e.g. `1/5 + 2/5`) → shows operand pies + a tap-to-fill answer pie; tapping slices sets the numerator; correct grades + (if applicable) the 约分 hint still works.
  2. 同分母 with improper result (e.g. `3/5 + 4/5 = 7/5`) → falls back to the `FractionPad` keypad.
  3. 异分母 / 分数×÷ → `FractionPad` keypad.
  4. Non-fraction questions unaffected.

- [ ] **Step 5: Commit**
```bash
git add src/app/calc/session/page.tsx
git commit -m "feat(calc): hybrid fraction input — pie for 同分母, keypad otherwise"
```

---

## Task 4: Hybrid dispatch in the practice modal

**Files:** `src/components/calc/QuickPracticeModal.tsx`

- [ ] **Step 1: Imports** — add near the other `@/components/calc` imports:
```ts
import FractionPie from './FractionPie'
```
and add `fractionPieSpec` to the existing `@/utils/calc-helpers` import (the file imports `{ buildSession }` from there):
```ts
import { buildSession, fractionPieSpec } from '@/utils/calc-helpers'
```

- [ ] **Step 2: Choose pie vs pad in the modal fraction branch** — the branch currently is:
```tsx
      {currentQ && currentQ.answer.kind === 'fraction' ? (
        <FractionPad key={`frac-${idx}`} disabled={!!feedback || done} onSubmit={submitValue} />
      ) : currentQ && currentQ.answer.kind === 'remainder' ? (
```
Replace the `<FractionPad ... />` line so it chooses pie vs pad (distinct keys to avoid the duplicate-key bug with the question div's `key={idx}`):
```tsx
      {currentQ && currentQ.answer.kind === 'fraction' ? (
        (() => {
          const spec = fractionPieSpec(currentQ)
          return spec ? (
            <FractionPie
              key={`fpie-${idx}`}
              operands={spec.operands}
              den={spec.den}
              op={spec.op}
              disabled={!!feedback || done}
              onSubmit={(n) => submitValue(`${n}/${spec.den}`)}
            />
          ) : (
            <FractionPad key={`frac-${idx}`} disabled={!!feedback || done} onSubmit={submitValue} />
          )
        })()
      ) : currentQ && currentQ.answer.kind === 'remainder' ? (
```

- [ ] **Step 3: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 4: Manual checkpoint (user runs)** — Settings → 「练一练」 with 同分母加减 selected: proper-result questions show the tap-to-fill pie and grade correctly; questions stack cleanly (single question, header stays — distinct `fpie-${idx}` / `frac-${idx}` keys).

- [ ] **Step 5: Commit**
```bash
git add src/components/calc/QuickPracticeModal.tsx
git commit -m "feat(calc): hybrid fraction input in the practice modal"
```

---

## Task 5: Final verification (user runs)

- [ ] **Step 1: Build** — `pnpm build`; expect clean.
- [ ] **Step 2: End-to-end** — 同分母加减 proper → pie (tap-to-fill, correct grading, 约分 hint preserved); improper/异分母/×÷ → keypad; both engines; no stacking; Phases 1–4a features all still work.

---

## Self-Review

- **Spec coverage (Phase 4 pie half):** "入门用饼图" → `FractionPie` (Task 2) used for 同分母加减 proper via `fractionPieSpec` (Task 1) in both engines (Tasks 3–4). "进阶用键盘" → `FractionPad` fallback (unchanged from 4a). Completes the hybrid input the user chose in brainstorming.
- **Eligibility correctness:** `fractionPieSpec` returns non-null only for same-denominator add/sub with a non-negative answer ≤ 1 — parsed from the display (handles fresh and carried questions); ×/÷ displays use `×`/`÷` so the `[+−-]` regex fails → keypad; improper results (`num > den`) → keypad.
- **Grading unchanged:** `FractionPie` emits a numerator; the dispatch wraps it into `"n/den"` and routes through the SAME `handleFractionSubmit` (session) / `submitValue` (modal), so accept-equivalent grading and the 约分 hint are untouched.
- **Duplicate-key guard:** modal uses `key={`fpie-${idx}`}` / `key={`frac-${idx}`}` (distinct from the question div's `key={idx}`); session pies/pads use `key={idx}` but only one renders per question and the QuestionDisplay is keyless — no collision.
- **Placeholder scan:** Task 2 is a fixed contract + logic skeleton with SVG geometry given; styling delegated to frontend-design. Everything else is complete code.
- **Type consistency:** `fractionPieSpec(q): { operands: [number, number]; den: number; op: '+' | '−' } | null` (Task 1) consumed by both dispatches (Tasks 3–4); `FractionPie` props match exactly; `onSubmit(numerator: number)` wrapped to `"n/den"` strings for the existing handlers. No migration.
