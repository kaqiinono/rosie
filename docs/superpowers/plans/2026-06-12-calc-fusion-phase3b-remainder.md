# Calc Fusion — Phase 3b Implementation Plan (Remainder Division 有余数除法)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 有余数除法 (e.g. `23 ÷ 5 = 4 … 3`) to `/calc` free mode — a new `div`-group block producing `remainder` answers, answered in the main session via a new商/余 `RemainderPad`.

**Architecture:** Builds on Phase 3a's `CalcAnswer` union (the `remainder` kind already exists). A `remainderBlock` factory emits questions whose `answer` is `remainderAnswer(quotient, remainder)`; such blocks set `noResurface` so `buildSession` never tries to reconstruct them through the integer AST (which would mis-evaluate `23÷5`). The main `/calc/session` gains a third input branch: when `currentQ.answer.kind === 'remainder'`, render `RemainderPad` (two cells + keypad) which emits a `"q…r"` string graded by `checkAnswer`. The practice/vouchers modal excludes remainder blocks (it only has a number pad).

**Tech Stack:** Next.js 15 (App Router, client components), TypeScript (no `any`), Tailwind v4, Supabase. **No test runner** — verification is `pnpm lint` + `pnpm build` + manual, **run by the user**, surfaced as checkpoints.

---

## Scope

Phase 3b of spec `…-calc-calculate-fusion-design.md`, building on Phase 3a (`CalcAnswer` union, merged). Adds remainder only. Decimals are Phase 3c.

**Decisions locked here:**
- **One new block** `div:rem` (有余数除法) in the `div` group; appears automatically in `BlockPicker` (no settings UI work).
- **`noResurface`** flag on blocks whose questions can't round-trip through the AST (remainder). Other blocks are unaffected.
- **Single-attempt** grading for remainder (the pad collects商+余 then submits once), consistent with vertical.
- **Practice/vouchers modal excludes remainder** (`REMAINDER_BLOCK_IDS` filter on its build) — it has only a `NumberPad`, which can't enter `"q…r"`. The main session is the full remainder surface.
- **No inverse / no vertical** for remainder: `toInverseQuestion` already returns null for non-int answers (Phase 3a), and `div:rem` is not in `VERTICAL_BLOCK_IDS`.

## File Structure

- **Modify** `src/utils/calc-blocks.ts` — `CalcBlock.noResurface?`; `remainderBlock` factory; register `div:rem`; export `REMAINDER_BLOCK_IDS`.
- **Modify** `src/utils/calc-helpers.ts` — `generateBlock` honors `noResurface`.
- **Create** `src/components/calc/RemainderPad.tsx` — 商/余 input.
- **Modify** `src/app/calc/session/page.tsx` — `handleRemainderSubmit` + remainder dispatch branch.
- **Modify** `src/components/calc/QuickPracticeModal.tsx` — filter remainder blocks out of its build.

No migration: remainder answers persist via Phase 3a's `answer_json` column.

---

## Task 1: `noResurface` flag on blocks

**Files:**
- Modify: `src/utils/calc-blocks.ts` (the `CalcBlock` interface, ~lines 6–13)
- Modify: `src/utils/calc-helpers.ts` (`generateBlock`, ~line 158)

- [ ] **Step 1: Add the flag to `CalcBlock`**

In `src/utils/calc-blocks.ts`, in `export interface CalcBlock { ... }`, add a line after `group: 'add' | 'sub' | 'mul' | 'div'`:

```ts
  /** When true, buildSession never reconstructs this block's facts from a signature
   *  (their answers don't round-trip through the integer AST, e.g. remainder). */
  noResurface?: boolean
```

- [ ] **Step 2: Honor it in `generateBlock`**

In `src/utils/calc-helpers.ts`, in `generateBlock`, change the line:

```ts
  const resurfaceN = Math.round(0.35 * n)
```

to:

```ts
  const resurfaceN = block.noResurface ? 0 : Math.round(0.35 * n)
```

- [ ] **Step 3: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors (additive optional field; existing blocks leave it `undefined`).

- [ ] **Step 4: Commit**

```bash
git add src/utils/calc-blocks.ts src/utils/calc-helpers.ts
git commit -m "feat(calc): add CalcBlock.noResurface (skip AST resurfacing)"
```

---

## Task 2: `remainderBlock` factory + `div:rem` block

**Files:**
- Modify: `src/utils/calc-blocks.ts`

- [ ] **Step 1: Import the remainder constructor**

At the top of `src/utils/calc-blocks.ts`, after the existing imports, add:

```ts
import { remainderAnswer } from './calc-answer'
```

- [ ] **Step 2: Add the factory** (place it next to the other `*Block` factory functions, e.g. after `divBlock`)

```ts
function remainderBlock(
  id: string,
  label: string,
  gen: () => { dividend: number; divisor: number; quotient: number; remainder: number },
): CalcBlock {
  return {
    id,
    op: 'div',
    label,
    group: 'div',
    noResurface: true,
    generateSingle(): CalcQuestion {
      const { dividend, divisor, quotient, remainder } = gen()
      return {
        display: `${dividend} ÷ ${divisor} = ?`,
        signature: `div(${dividend},${divisor})`,
        arity: 1,
        level: 0,
        answer: remainderAnswer(quotient, remainder),
        isChallenge: false,
        category: 'muldiv',
        coinBase: 2,
      }
    },
    sampleTerm() {
      // Remainder blocks shouldn't compose into mixed ops; provide a benign exact-div term.
      const d = randInt(2, 9)
      const q = randInt(2, 9)
      return { ast: { op: 'div', left: d * q, right: d }, value: q }
    },
  }
}
```

- [ ] **Step 3: Register the block**

In the `BLOCKS` array, insert AFTER the existing `divBlock('div:multi', '多位数÷一位数', divRange(2, 9, 11, 99)),` line:

```ts
  remainderBlock('div:rem', '有余数除法', () => {
    const divisor = randInt(2, 9)
    const quotient = randInt(2, 9)
    const remainder = randInt(1, divisor - 1)
    return { dividend: divisor * quotient + remainder, divisor, quotient, remainder }
  }),
```

- [ ] **Step 4: Export the id set**

At the END of `src/utils/calc-blocks.ts` (next to `VERTICAL_BLOCK_IDS`), add:

```ts
/** Blocks whose answers need the商/余 RemainderPad — excluded from the number-pad-only modal. */
export const REMAINDER_BLOCK_IDS = new Set<string>(['div:rem'])
```

- [ ] **Step 5: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors. The `generateSingle` literal must satisfy `CalcQuestion` (note `answer` is a `CalcAnswer` from `remainderAnswer`).

- [ ] **Step 6: Commit**

```bash
git add src/utils/calc-blocks.ts
git commit -m "feat(calc): add 有余数除法 block (div:rem) + REMAINDER_BLOCK_IDS"
```

---

## Task 3: `RemainderPad` component

**Files:**
- Create: `src/components/calc/RemainderPad.tsx`

> This is a NEW UI component. **Invoke the `frontend-design:frontend-design` skill first** to ground the visual design, then implement to calc's dark/purple, 7-year-old aesthetic (match `src/components/calc/NumberPad.tsx`). Read `NumberPad.tsx` and `VerticalCalc.tsx` (post-restyle) for the established look.

- [ ] **Step 1: Build the component**

Create `src/components/calc/RemainderPad.tsx` with this behavior (exact styling is the frontend-design step's job; the contract below is fixed):

- Props: `{ dividend: number; divisor: number; onSubmit: (combined: string) => void; disabled?: boolean }`.
- Shows the problem `{dividend} ÷ {divisor} =` then two tappable cells labelled 商 and 余 (one active at a time; 商 active initially).
- A digit keypad (0–9, ⌫) styled like `NumberPad`, writing into the active cell; tapping a cell focuses it.
- A ✓ submit key (calc green gradient), enabled only when BOTH cells are non-empty; on press it calls `onSubmit(`${quotient}…${remainder}`)` exactly once, then locks (no re-submit).
- `disabled` disables all keys.

Reference skeleton (logic — restyle freely, keep the contract):

```tsx
'use client'

import { useCallback, useState } from 'react'

interface Props {
  dividend: number
  divisor: number
  onSubmit: (combined: string) => void
  disabled?: boolean
}

export default function RemainderPad({ dividend, divisor, onSubmit, disabled = false }: Props) {
  const [quotient, setQuotient] = useState('')
  const [remainder, setRemainder] = useState('')
  const [active, setActive] = useState<'q' | 'r'>('q')
  const [submitted, setSubmitted] = useState(false)

  const setActiveValue = useCallback(
    (updater: (prev: string) => string) => {
      if (active === 'q') setQuotient((p) => updater(p))
      else setRemainder((p) => updater(p))
    },
    [active],
  )

  const handleDigit = (d: string) => {
    if (disabled || submitted) return
    setActiveValue((prev) => (prev.length < 3 ? prev + d : prev))
  }
  const handleDelete = () => {
    if (disabled || submitted) return
    setActiveValue((prev) => prev.slice(0, -1))
  }
  const canSubmit = quotient !== '' && remainder !== '' && !submitted && !disabled
  const handleSubmit = () => {
    if (!canSubmit) return
    setSubmitted(true)
    onSubmit(`${quotient}…${remainder}`)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* problem + 商/余 cells (商 = quotient, 余 = remainder) */}
      {/* digit keypad (0-9, ⌫) writing to the active cell */}
      {/* ✓ submit (enabled when canSubmit) */}
      {/* ...styled per frontend-design, matching NumberPad ... */}
    </div>
  )
}
```

- [ ] **Step 2: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/calc/RemainderPad.tsx
git commit -m "feat(calc): add RemainderPad (商/余 input) for remainder questions"
```

---

## Task 4: Wire remainder into the main session

**Files:**
- Modify: `src/app/calc/session/page.tsx`

- [ ] **Step 1: Import `RemainderPad`**

Near the other `@/components/calc` imports (`VerticalCalc`, `DivisionVertical`), add:

```ts
import RemainderPad from '@/components/calc/RemainderPad'
```

(`checkAnswer` and `parseSignature` are already imported from Phases 3a/2.)

- [ ] **Step 2: Add the submit handler** — place it immediately after the existing `handleVerticalSubmit` callback:

```ts
  // Single-attempt grading for remainder (有余数) questions: RemainderPad collects
  // 商/余 and submits a "q…r" string, graded by checkAnswer.
  const handleRemainderSubmit = useCallback(
    (combined: string) => {
      if (!questions || done || feedback) return
      const q = questions[idx]
      const wasMistake = mistakes.some((m) => !m.resolved && m.signature === q.signature)
      const elapsedMs = Math.round(performance.now() - questionStartRef.current)
      const limitMs = timeLimitFromSettings(q.level, settings)
      const withinLimit = limitMs > 0 ? elapsedMs <= limitMs : true
      questionTimesRef.current.push(elapsedMs)
      settleQuestion(q, checkAnswer(combined, q.answer), true, elapsedMs, withinLimit, wasMistake)
    },
    [questions, done, feedback, idx, mistakes, settings, settleQuestion],
  )
```

- [ ] **Step 3: Add the remainder dispatch branch**

The answer area currently begins with `{currentQ.answerMode === 'vertical' ? (`. Change that opening so remainder takes precedence, by replacing the line:

```tsx
        {currentQ.answerMode === 'vertical' ? (
```

with:

```tsx
        {currentQ.answer.kind === 'remainder' ? (
          (() => {
            const ast = parseSignature(currentQ.signature)
            if (typeof ast === 'number' || typeof ast.left !== 'number' || typeof ast.right !== 'number') {
              return null
            }
            return (
              <RemainderPad
                key={idx}
                dividend={ast.left}
                divisor={ast.right}
                disabled={!!feedback || done}
                onSubmit={handleRemainderSubmit}
              />
            )
          })()
        ) : currentQ.answerMode === 'vertical' ? (
```

(This inserts a new leading branch and leaves the existing `vertical` and pad branches intact as the `else` chain.)

- [ ] **Step 4: Type-check + build checkpoint (user runs)** — `pnpm lint` then `pnpm build`; expect no errors.

- [ ] **Step 5: Manual checkpoint (user runs)**

Select 除「有余数除法」 in `/calc/settings`, start a `/calc` session, and confirm:
1. Remainder questions render the 商/余 pad (not the number pad, not vertical).
2. Entering the correct商 and 余 grades correct + awards coins; a wrong entry reveals 「答案是 4…3」 and records a mistake.
3. A missed remainder question is carried into the next session and re-rendered with the 商/余 pad.
4. Plain division / other blocks still use their normal input.

- [ ] **Step 6: Commit**

```bash
git add src/app/calc/session/page.tsx
git commit -m "feat(calc): render RemainderPad for remainder questions in session"
```

---

## Task 5: Exclude remainder from the practice/vouchers modal

**Files:**
- Modify: `src/components/calc/QuickPracticeModal.tsx`

- [ ] **Step 1: Filter remainder blocks out of the modal build**

In `src/components/calc/QuickPracticeModal.tsx`:
- Add `REMAINDER_BLOCK_IDS` to the existing `@/utils/calc-helpers`-adjacent imports — it lives in `@/utils/calc-blocks`:
```ts
import { REMAINDER_BLOCK_IDS } from '@/utils/calc-blocks'
```
- In the `useMemo` that builds questions, replace:
```ts
    if (!settings) return []
    return buildSession(settings, buildCount, { problemStates: new Map() })
```
with:
```ts
    if (!settings) return []
    // The modal only has a NumberPad; remainder needs the商/余 pad, so drop those blocks here.
    const padSettings = {
      ...settings,
      selectedBlocks: settings.selectedBlocks.filter((id) => !REMAINDER_BLOCK_IDS.has(id)),
    }
    return buildSession(padSettings, buildCount, { problemStates: new Map() })
```

- [ ] **Step 2: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 3: Manual checkpoint (user runs)** — open Settings → 「✨ 用当前设置练一练！」 with 有余数除法 selected; confirm the modal runs normally (no remainder questions appear / nothing is unanswerable).

- [ ] **Step 4: Commit**

```bash
git add src/components/calc/QuickPracticeModal.tsx
git commit -m "feat(calc): exclude remainder blocks from the number-pad-only modal"
```

---

## Task 6: Final verification (user runs)

- [ ] **Step 1: Build** — `pnpm build`; expect clean.
- [ ] **Step 2: End-to-end** — confirm: `div:rem` selectable; remainder questions answered via 商/余 pad in the main session (correct/wrong/reveal/carry); modal excludes remainder; existing blocks (incl. Phase 2 vertical, Phase 1 inverse) unaffected.

---

## Self-Review

- **Spec coverage (Phase 3b):** "Remainder division blocks" → Task 2. "a small RemainderPad (商 + 余数)" → Task 3. Wired into the session → Task 4. The `remainder` answer kind + `checkAnswer`/`formatAnswer`/`answer_json` persistence all come from Phase 3a (no migration here).
- **Resurface safety:** `div:rem` sets `noResurface` (Task 2), and `generateBlock` honors it (Task 1), so `buildSession` never calls `makeQuestion(parseSignature("div(23,5)"))` (which would yield a wrong exact-division answer). Confirmed the inverse pass skips it (`toInverseQuestion` returns null for non-int answers, Phase 3a) and the vertical pass skips it (`div:rem` ∉ `VERTICAL_BLOCK_IDS`).
- **Two-engine handling:** main `/calc/session` gets full remainder (Task 4); the `QuickPracticeModal`/`useCalcSession` engine is number-pad-only and excludes remainder (Task 5) — flagged as a deliberate scope decision.
- **Placeholder scan:** Task 3's component is specified by a fixed behavioral contract + a logic skeleton; the only open part is visual styling, explicitly delegated to frontend-design. No `TBD`/vague steps elsewhere.
- **Type consistency:** `remainderBlock` → `generateSingle(): CalcQuestion` with `answer: remainderAnswer(...)` (a `CalcAnswer`). `RemainderPad` props `{dividend, divisor, onSubmit:(combined:string)=>void, disabled}` match the Task 4 dispatch call. `handleRemainderSubmit(combined: string)` defined in Task 4 Step 2, used in Step 3. `REMAINDER_BLOCK_IDS` defined Task 2, consumed Task 5. `noResurface?: boolean` defined Task 1, set Task 2.
