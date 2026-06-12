# Calc Fusion — Phase 4a Implementation Plan (Fractions via Keypad)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full fraction practice (同/异分母加减、分数×整数/分数、分数÷整数/分数) to `/calc` free mode under a 「分数」 block group, answered via a numerator/denominator `FractionPad`, with accept-any-equivalent grading and a gentle 「可约分」 hint.

**Architecture:** Reuses Phase 3a's `CalcAnswer.fraction` kind — `checkAnswer` already accepts ANY equivalent fraction (cross-multiply), `formatAnswer` renders `num/den`, `fractionAnswer(num,den)` constructs. A `fractionBlock` factory generates questions with exact integer arithmetic over numerators/denominators (no reduction needed — grading is equivalence-based), `noResurface` (fractions don't round-trip the integer AST), in a new `'fraction'` group (bucketize already skips non-div groups since Phase 3c). A new `FractionPad` (two stacked cells + bar + keypad) emits `"num/den"`. The main session adds a fraction dispatch branch + a 约分 hint when a correct answer isn't in lowest terms.

**Tech Stack:** Next.js 15 (client components), TypeScript (no `any`), Tailwind v4, Supabase. **No test runner** — verification is `pnpm lint` + `pnpm build` + manual, **run by the user**. No migration (fraction answers persist via Phase 3a's `answer_json`).

---

## Scope

Phase 4a: fractions answered with a **num/den keypad**, all six operations. **Deferred to Phase 4b:** the pie visual (`FractionVis`) for 同分母入门 (the hybrid "intro = pie, advanced = keypad" — 4a ships keypad-for-all, 4b adds the pie).

**Decisions locked:**
- **New `'fraction'` group** (icon ½); bucketize already excludes it (Phase 3c), so fractions never enter mixed ops.
- **Grading accepts any equivalent** (`2/4` == `1/2`) — already in Phase 3a `checkAnswer`. A correct-but-reducible answer shows a soft 「还能再约一约哦」 hint (not marked wrong).
- **Generators produce unreduced exact answers** (e.g. `1/2 + 1/3` → `5/6`, `2/3 × 6` → `12/3`); the kid may answer reduced or not.
- **Signature** `frac:op(L,R)` (e.g. `frac:add(2/5,1/5)`); `noResurface` so it's never parsed back.
- Display uses inline slash notation (`2/5 + 1/5 = ?`).

## File Structure

- **Modify** `src/utils/calc-blocks.ts` — `'fraction'` in group union; `BLOCK_GROUPS` += 分数; `fractionBlock` factory; 6 blocks; imports.
- **Modify** `src/components/calc/BlockPicker.tsx` — `GROUP_ICONS` += fraction `½`.
- **Modify** `src/utils/calc-answer.ts` — `isReducibleFraction` helper.
- **Modify** `src/app/calc/report/page.tsx` — `prettySignature` renders `frac:` signatures.
- **Create** `src/components/calc/FractionPad.tsx` — num/den input.
- **Modify** `src/app/calc/session/page.tsx` — fraction dispatch + `handleFractionSubmit` + 约分 hint.
- **Modify** `src/components/calc/QuickPracticeModal.tsx` — fraction dispatch (via `submitValue`).

---

## Task 1: 「分数」 group plumbing

**Files:** `src/utils/calc-blocks.ts`, `src/components/calc/BlockPicker.tsx`

- [ ] **Step 1: Extend the group union** — in `src/utils/calc-blocks.ts`, change:
```ts
  group: 'add' | 'sub' | 'mul' | 'div' | 'decimal'
```
to:
```ts
  group: 'add' | 'sub' | 'mul' | 'div' | 'decimal' | 'fraction'
```

- [ ] **Step 2: `BLOCK_GROUPS`** — add after the `{ group: 'decimal', label: '小数' }` entry:
```ts
  { group: 'fraction', label: '分数' },
```

- [ ] **Step 3: `GROUP_ICONS`** — in `src/components/calc/BlockPicker.tsx`, add to the `GROUP_ICONS` object:
```ts
  fraction: '½',
```

- [ ] **Step 4: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors (bucketize already skips non-div groups; `GROUP_ICONS` is now complete).

- [ ] **Step 5: Commit**
```bash
git add src/utils/calc-blocks.ts src/components/calc/BlockPicker.tsx
git commit -m "feat(calc): add 分数 block group plumbing"
```

---

## Task 2: `isReducibleFraction` helper + report rendering

**Files:** `src/utils/calc-answer.ts`, `src/app/calc/report/page.tsx`

- [ ] **Step 1: Add the helper** — at the END of `src/utils/calc-answer.ts`:
```ts
function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    ;[x, y] = [y, x % y]
  }
  return x || 1
}

/** True when `input` ("a/b") is a valid non-zero fraction that is NOT in lowest terms. */
export function isReducibleFraction(input: string): boolean {
  const m = input.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/)
  if (!m) return false
  const num = Number(m[1])
  const den = Number(m[2])
  if (den === 0 || num === 0) return false
  return gcd(num, den) > 1
}
```

- [ ] **Step 2: Render `frac:` signatures in the report** — in `src/app/calc/report/page.tsx`, the `prettySignature` function starts with `const m = sig.match(/^(add|sub|mul|div)\((-?\d+),(-?\d+)\)$/)`. Add a fraction case at the TOP of the function body (before that line):
```ts
  const fm = sig.match(/^frac:(add|sub|mul|div)\(([^,]+),([^,]+)\)$/)
  if (fm) {
    const opSym = { add: '+', sub: '−', mul: '×', div: '÷' }[fm[1]] ?? '?'
    return `${fm[2]} ${opSym} ${fm[3]}`
  }
```

- [ ] **Step 3: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 4: Commit**
```bash
git add src/utils/calc-answer.ts src/app/calc/report/page.tsx
git commit -m "feat(calc): isReducibleFraction helper + fraction signature in report"
```

---

## Task 3: `fractionBlock` factory + 6 blocks

**Files:** `src/utils/calc-blocks.ts`

- [ ] **Step 1: Extend the `./calc-answer` import** — add `fractionAnswer` (the file currently imports `decimalAnswer, remainderAnswer`):
```ts
import { decimalAnswer, fractionAnswer, remainderAnswer } from './calc-answer'
```
(`OP_SYMBOL`, `CalcCategory`, `CalcOp`, `randInt`, `pickOne` are already imported from Phase 3c.)

- [ ] **Step 2: Add the factory** — near the other `*Block` factories:
```ts
type Frac = { num: number; den: number }

function fractionBlock(
  id: string,
  label: string,
  gen: () => { left: Frac; right: Frac | number; op: CalcOp; value: Frac },
): CalcBlock {
  const fmt = (x: Frac | number): string => (typeof x === 'number' ? String(x) : `${x.num}/${x.den}`)
  return {
    id,
    op: 'add',
    label,
    group: 'fraction',
    noResurface: true,
    generateSingle(): CalcQuestion {
      const { left, right, op, value } = gen()
      const category: CalcCategory = op === 'add' || op === 'sub' ? 'addsub' : 'muldiv'
      return {
        display: `${fmt(left)} ${OP_SYMBOL[op]} ${fmt(right)} = ?`,
        signature: `frac:${op}(${fmt(left)},${fmt(right)})`,
        arity: 1,
        level: 0,
        answer: fractionAnswer(value.num, value.den),
        isChallenge: false,
        category,
        coinBase: 2,
      }
    },
    sampleTerm() {
      const a = randInt(2, 9)
      return { ast: a, value: a }
    },
  }
}
```

- [ ] **Step 3: Register the 6 blocks** — at the END of the `BLOCKS` array (after the `dec:divInt` entry):
```ts
  fractionBlock('frac:add-same', '同分母加减', () => {
    const den = randInt(3, 9)
    if (Math.random() < 0.5) {
      const a = randInt(1, den - 1)
      const b = randInt(1, den - 1)
      return { left: { num: a, den }, right: { num: b, den }, op: 'add', value: { num: a + b, den } }
    }
    const a = randInt(2, den - 1)
    const b = randInt(1, a - 1)
    return { left: { num: a, den }, right: { num: b, den }, op: 'sub', value: { num: a - b, den } }
  }),
  fractionBlock('frac:add-diff', '异分母加减', () => {
    for (let t = 0; t < 12; t++) {
      const d1 = randInt(2, 6)
      const d2 = pickOne([2, 3, 4, 5, 6].filter((x) => x !== d1))
      const a = randInt(1, d1 - 1)
      const b = randInt(1, d2 - 1)
      const isAdd = Math.random() < 0.5
      let L = { num: a, den: d1 }
      let R = { num: b, den: d2 }
      if (!isAdd && L.num * R.den < R.num * L.den) [L, R] = [R, L]
      const num = isAdd ? L.num * R.den + R.num * L.den : L.num * R.den - R.num * L.den
      if (num > 0) return { left: L, right: R, op: isAdd ? 'add' : 'sub', value: { num, den: L.den * R.den } }
    }
    return { left: { num: 1, den: 2 }, right: { num: 1, den: 3 }, op: 'add', value: { num: 5, den: 6 } }
  }),
  fractionBlock('frac:mul-int', '分数×整数', () => {
    const den = randInt(2, 9)
    const a = randInt(1, den - 1)
    const k = randInt(2, 9)
    return { left: { num: a, den }, right: k, op: 'mul', value: { num: a * k, den } }
  }),
  fractionBlock('frac:mul-frac', '分数×分数', () => {
    const d1 = randInt(2, 6)
    const d2 = randInt(2, 6)
    const a = randInt(1, d1 - 1)
    const b = randInt(1, d2 - 1)
    return { left: { num: a, den: d1 }, right: { num: b, den: d2 }, op: 'mul', value: { num: a * b, den: d1 * d2 } }
  }),
  fractionBlock('frac:div-int', '分数÷整数', () => {
    const den = randInt(2, 9)
    const a = randInt(1, den - 1)
    const k = randInt(2, 9)
    return { left: { num: a, den }, right: k, op: 'div', value: { num: a, den: den * k } }
  }),
  fractionBlock('frac:div-frac', '分数÷分数', () => {
    const d1 = randInt(2, 6)
    const d2 = randInt(2, 6)
    const a = randInt(1, d1 - 1)
    const b = randInt(1, d2 - 1)
    return { left: { num: a, den: d1 }, right: { num: b, den: d2 }, op: 'div', value: { num: a * d2, den: d1 * b } }
  }),
```

- [ ] **Step 4: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors. The 分数 group in `/calc/settings` now shows 6 chips.

- [ ] **Step 5: Commit**
```bash
git add src/utils/calc-blocks.ts
git commit -m "feat(calc): add fraction blocks (同/异分母加减、分数×÷整数/分数)"
```

---

## Task 4: `FractionPad` component

**Files:** `src/components/calc/FractionPad.tsx`

> NEW UI component. **Invoke `frontend-design:frontend-design` first.** Match calc's dark/purple, 7-year-old aesthetic (read `NumberPad.tsx` and `RemainderPad.tsx`).

- [ ] **Step 1: Build the component** with this fixed contract (styling per frontend-design):
  - Props: `{ onSubmit: (combined: string) => void; disabled?: boolean }`.
  - Two stacked tappable cells — numerator on top, denominator below — separated by a horizontal fraction bar. Numerator active initially; tapping a cell focuses it.
  - A digit keypad (1-9, ⌫, 0) styled like `NumberPad`, writing into the active cell (cap each at 2 digits). A ✓ submit key (green gradient), enabled only when BOTH cells are non-empty AND denominator ≠ "0"; on press calls `onSubmit(`${numerator}/${denominator}`)` exactly once, then locks.
  - `disabled` disables all keys.

Reference skeleton (logic; restyle per frontend-design):
```tsx
'use client'

import { useState } from 'react'

interface Props {
  onSubmit: (combined: string) => void
  disabled?: boolean
}

type Cell = 'num' | 'den'
const MAX_LEN = 2

export default function FractionPad({ onSubmit, disabled }: Props) {
  const [numerator, setNumerator] = useState('')
  const [denominator, setDenominator] = useState('')
  const [active, setActive] = useState<Cell>('num')
  const [submitted, setSubmitted] = useState(false)

  const activeValue = active === 'num' ? numerator : denominator
  const setActiveValue = (next: string) => {
    if (active === 'num') setNumerator(next)
    else setDenominator(next)
  }
  const canSubmit =
    !submitted && !disabled && numerator.length > 0 && denominator.length > 0 && denominator !== '0'

  const handleKey = (key: string) => {
    if (disabled || submitted) return
    if (key === '✓') {
      if (!canSubmit) return
      setSubmitted(true)
      onSubmit(`${numerator}/${denominator}`)
      return
    }
    if (key === '⌫') {
      setActiveValue(activeValue.slice(0, -1))
      return
    }
    if (activeValue.length >= MAX_LEN) return
    setActiveValue(activeValue === '0' ? key : activeValue + key)
  }

  // ...render: numerator cell / bar / denominator cell, then keypad (1-9, ⌫, 0, ✓),
  //    styled to match NumberPad — per frontend-design...
}
```

- [ ] **Step 2: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 3: Commit**
```bash
git add src/components/calc/FractionPad.tsx
git commit -m "feat(calc): add FractionPad (num/den input) for fraction questions"
```

---

## Task 5: Wire fractions into the main session (+ 约分 hint)

**Files:** `src/app/calc/session/page.tsx`

- [ ] **Step 1: Imports** — add near the other `@/components/calc` imports:
```ts
import FractionPad from '@/components/calc/FractionPad'
```
and add `isReducibleFraction` to the existing `@/utils/calc-answer` import (currently `{ checkAnswer, formatAnswer }`):
```ts
import { checkAnswer, formatAnswer, isReducibleFraction } from '@/utils/calc-answer'
```

- [ ] **Step 2: Add the `reduceHint` state** — next to the other `useState` calls (e.g. after the `revealAnswer` state):
```ts
  const [reduceHint, setReduceHint] = useState(false)
```

- [ ] **Step 3: Reset `reduceHint` on question change** — in the effect that resets `questionStartRef` on `idx` change (the `useEffect` with `[idx, questions]` deps that sets `questionStartRef.current`), add inside it:
```ts
      setReduceHint(false)
```

- [ ] **Step 4: Add the submit handler** — immediately after `handleRemainderSubmit`:
```ts
  // Single-attempt grading for fraction questions: FractionPad submits "num/den".
  // checkAnswer accepts any equivalent fraction; a correct-but-reducible answer
  // gets a gentle 约分 hint (still counts as correct).
  const handleFractionSubmit = useCallback(
    (combined: string) => {
      if (!questions || done || feedback) return
      const q = questions[idx]
      const correct = checkAnswer(combined, q.answer)
      if (correct && isReducibleFraction(combined)) setReduceHint(true)
      const wasMistake = mistakes.some((m) => !m.resolved && m.signature === q.signature)
      const elapsedMs = Math.round(performance.now() - questionStartRef.current)
      const limitMs = timeLimitFromSettings(q.level, settings)
      const withinLimit = limitMs > 0 ? elapsedMs <= limitMs : true
      questionTimesRef.current.push(elapsedMs)
      settleQuestion(q, correct, true, elapsedMs, withinLimit, wasMistake)
    },
    [questions, done, feedback, idx, mistakes, settings, settleQuestion],
  )
```

- [ ] **Step 5: Add the fraction dispatch branch** — the answer area starts with `{currentQ.answer.kind === 'remainder' ? (`. Insert a fraction branch BEFORE it by replacing that opening line:
```tsx
        {currentQ.answer.kind === 'remainder' ? (
```
with:
```tsx
        {currentQ.answer.kind === 'fraction' ? (
          <FractionPad key={idx} disabled={!!feedback || done} onSubmit={handleFractionSubmit} />
        ) : currentQ.answer.kind === 'remainder' ? (
```

- [ ] **Step 6: Show the 约分 hint in the correct banner** — in the `{feedback === 'correct' && (` block, the text currently reads:
```tsx
              ✓ 答对啦！
              {lastResult && lastResult.stars > 0 ? `本题 +${lastResult.stars} ⭐` : '（第二次）'}
```
Change it to:
```tsx
              ✓ 答对啦！
              {reduceHint
                ? '还能再约一约哦～'
                : lastResult && lastResult.stars > 0
                  ? `本题 +${lastResult.stars} ⭐`
                  : '（第二次）'}
```

- [ ] **Step 7: Type-check + build checkpoint (user runs)** — `pnpm lint` then `pnpm build`.

- [ ] **Step 8: Manual checkpoint (user runs)** — select 分数「同分母加减」/「异分母加减」/「分数×整数」 and practice the main `/calc` session:
  1. Fraction questions render the num/den `FractionPad`.
  2. `2/5 + 1/5` → entering `3/5` (or `6/10`) grades correct; an equivalent-but-reducible answer shows 「还能再约一约哦～」.
  3. `1/2 + 1/3` → `5/6` correct. `2/3 × 6` → `12/3` or `4` correct.
  4. A missed fraction carries to the next session with the FractionPad.
  5. Integer / decimal / remainder / vertical questions unaffected.

- [ ] **Step 9: Commit**
```bash
git add src/app/calc/session/page.tsx
git commit -m "feat(calc): render FractionPad for fraction questions + 约分 hint"
```

---

## Task 6: Wire fractions into the practice modal

**Files:** `src/components/calc/QuickPracticeModal.tsx`

- [ ] **Step 1: Import** — add near the other `@/components/calc` imports:
```ts
import FractionPad from './FractionPad'
```

- [ ] **Step 2: Add a fraction branch** — the answer area is `{currentQ && currentQ.answer.kind === 'remainder' ? (<RemainderPad .../>) : (<>input + NumberPad</>)}`. Insert a fraction branch before the remainder check by changing the opening:
```tsx
      {currentQ && currentQ.answer.kind === 'remainder' ? (
```
to:
```tsx
      {currentQ && currentQ.answer.kind === 'fraction' ? (
        <FractionPad key={`frac-${idx}`} disabled={!!feedback || done} onSubmit={submitValue} />
      ) : currentQ && currentQ.answer.kind === 'remainder' ? (
```
(`submitValue` is already destructured from the session; it grades single-attempt via `checkAnswer`. No 约分 hint in the modal — kept simple.)

- [ ] **Step 3: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 4: Manual checkpoint (user runs)** — Settings → 「练一练」 with a fraction block selected: fraction questions show the FractionPad and grade correctly (no stacking, header stays — note the distinct `frac-${idx}` key avoids the duplicate-key issue).

- [ ] **Step 5: Commit**
```bash
git add src/components/calc/QuickPracticeModal.tsx
git commit -m "feat(calc): render FractionPad for fraction questions in modal"
```

---

## Task 7: Final verification (user runs)

- [ ] **Step 1: Build** — `pnpm build`; expect clean.
- [ ] **Step 2: End-to-end** — 分数 group shows 6 blocks; all six operations answerable via FractionPad in both engines; equivalent answers accepted; 约分 hint shows for unreduced-correct (main session); fractions never enter mixed ops; Phases 1–3 features all still work.

---

## Self-Review

- **Spec coverage (Phase 4, keypad portion):** full 加减乘除 fractions → Task 3 (6 blocks). num/den input → Task 4 (`FractionPad`) + Tasks 5–6 (wiring). accept-equivalent + 约分 hint → Task 2 (`isReducibleFraction`) + Task 5 (hint). The pie (同分母入门) is **Phase 4b** (flagged in Scope).
- **Grading correctness:** generators emit exact unreduced fractions via integer arithmetic; `checkAnswer` (Phase 3a) cross-multiplies so any equivalent (reduced or not) is accepted; `isReducibleFraction` only drives the soft hint, never correctness.
- **No-mixed / no-resurface safety:** `'fraction'` group is skipped by `bucketize` (Phase 3c) and blocks set `noResurface`; `toInverseQuestion` returns null for non-int answers (Phase 3a); fraction blocks aren't in `VERTICAL_BLOCK_IDS`. So fraction questions only hit the fraction dispatch branch.
- **Duplicate-key guard:** the modal FractionPad uses `key={`frac-${idx}`}` (distinct from the question div's `key={idx}`), per the lesson from the remainder modal bug.
- **Placeholder scan:** Task 4's component is a fixed contract + logic skeleton with styling delegated to frontend-design; everything else is complete code.
- **Type consistency:** `fractionBlock` `gen` returns `{left:Frac, right:Frac|number, op:CalcOp, value:Frac}`; `generateSingle` → `answer: fractionAnswer(value.num, value.den)`. `'fraction'` group consumed by `GROUP_ICONS` (required), `BLOCK_GROUPS`. `FractionPad` props `{onSubmit:(combined:string)=>void, disabled}` match the dispatch calls. `handleFractionSubmit`/`isReducibleFraction`/`reduceHint` defined and used in Task 5. No migration (Phase 3a `answer_json`).
