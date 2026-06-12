# Calc Fusion — Phase 3a Implementation Plan (Answer-Model Refactor)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `CalcQuestion.answer: number` (and `CalcMistake.answer: number`) with a tagged `CalcAnswer` union, routed through a small helper layer, so later phases can add remainder/decimal/fraction answers — with **zero behavior change** (everything stays `int`).

**Architecture:** A new `CalcAnswer` discriminated union (`int | decimal | remainder | fraction`) is defined in `type.ts`. All grading/formatting goes through pure helpers in a new `src/utils/calc-answer.ts` (`intAnswer`, `formatAnswer`, `checkAnswer`, `answerToNumeric`, `answerFromRow`). The 8 sites that read `answer` switch to the union + helpers in one coordinated commit. `calc_mistakes` gains an additive `answer_json jsonb` column; reads fall back to `{kind:'int', value: <legacy numeric>}` so existing rows keep working.

**Tech Stack:** Next.js 15 (App Router, client components), TypeScript (no `any`), Tailwind v4, Supabase. **No test runner** — verification is `pnpm lint` + `pnpm build` + manual, all **run by the user** (per standing preference), surfaced as checkpoints.

---

## Scope

This plan is **Phase 3a only** — the answer-model refactor. It adds NO new question types. Two follow-up plans land on top of it:
- **Phase 3b — remainder division** (有余数除法 + `RemainderPad`): exercises the `remainder` kind.
- **Phase 3c — decimals** (小数加减乘除): exercises the `decimal` kind (needs scaled-integer arithmetic for float precision).

The `decimal` and `fraction` kinds are *defined* now (so the helpers are complete and Phase 4 fractions is unblocked) but are not *produced* by any generator until their phases.

**Success = behavior is byte-for-byte unchanged** (all answers are still int), the build is green, and the new model + `answer_json` column are in place.

## File Structure

- **Modify** `src/utils/type.ts` — add `CalcAnswer` union; change `CalcQuestion.answer` and `CalcMistake.answer` to `CalcAnswer`.
- **Create** `src/utils/calc-answer.ts` — the helper layer.
- **Modify** `src/utils/calc-ast.ts` — `makeQuestion` wraps its result as `{kind:'int'}`.
- **Modify** `src/utils/calc-inverse.ts` — read the int value from the union; emit an int answer.
- **Modify** `src/app/calc/session/page.tsx` — grade via `checkAnswer`; reveal via `formatAnswer`; `revealAnswer` becomes `string | null`.
- **Modify** `src/hooks/useCalcMistakes.ts` — `answer_json` plumbing + helper-based read/write.
- **Modify** `src/hooks/useCalcSession.ts` — second grading engine (the practice modal) grades via `checkAnswer`.
- **Modify** `src/components/calc/QuickPracticeModal.tsx` — reveal via `formatAnswer`.
- **Modify** `src/components/calc/MistakeRow.tsx` — render the mistake answer via `formatAnswer`.
- **Create** `docs/sql/calc-phase3a-answer-json-migration.sql` — add the column.

(`src/utils/calc-helpers.ts` carried-mistake object needs no edit: `answer: m.answer` is already `CalcAnswer` once the types change.)

---

## Task 1: Define the `CalcAnswer` union (additive — nothing breaks yet)

**Files:**
- Modify: `src/utils/type.ts`

- [ ] **Step 1: Add the union above `CalcQuestion`**

In `src/utils/type.ts`, immediately BEFORE the `export interface CalcQuestion {` line, insert:

```ts
/** A question's canonical answer. `int` is the only kind produced before Phase 3b/3c;
 *  `decimal`/`remainder`/`fraction` are defined now so the answer helpers are complete. */
export type CalcAnswer =
  | { kind: 'int'; value: number }
  | { kind: 'decimal'; value: number; places: number }
  | { kind: 'remainder'; quotient: number; remainder: number }
  | { kind: 'fraction'; num: number; den: number }
```

- [ ] **Step 2: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors (purely additive).

- [ ] **Step 3: Commit**

```bash
git add src/utils/type.ts
git commit -m "feat(calc): define CalcAnswer union (additive)"
```

---

## Task 2: Answer helper layer

**Files:**
- Create: `src/utils/calc-answer.ts`

- [ ] **Step 1: Write the helpers**

Create `src/utils/calc-answer.ts`:

```ts
import type { CalcAnswer } from './type'

/** Constructors. */
export function intAnswer(value: number): CalcAnswer {
  return { kind: 'int', value }
}
export function decimalAnswer(value: number, places: number): CalcAnswer {
  return { kind: 'decimal', value, places }
}
export function remainderAnswer(quotient: number, remainder: number): CalcAnswer {
  return { kind: 'remainder', quotient, remainder }
}
export function fractionAnswer(num: number, den: number): CalcAnswer {
  return { kind: 'fraction', num, den }
}

/** Human-readable answer — used for the reveal banner and mistake display. */
export function formatAnswer(a: CalcAnswer): string {
  switch (a.kind) {
    case 'int': return String(a.value)
    case 'decimal': return a.value.toFixed(a.places)
    case 'remainder': return `${a.quotient}…${a.remainder}`
    case 'fraction': return `${a.num}/${a.den}`
  }
}

/** Grade a raw user-entered string against the canonical answer. */
export function checkAnswer(input: string, a: CalcAnswer): boolean {
  const s = input.trim()
  if (s === '') return false
  switch (a.kind) {
    case 'int': {
      const n = Number(s)
      return Number.isFinite(n) && n === a.value
    }
    case 'decimal': {
      const n = Number(s)
      return Number.isFinite(n) && Math.abs(n - a.value) < 0.5 * Math.pow(10, -a.places)
    }
    case 'remainder': {
      // accepts "q…r", "q...r", or "q r"
      const m = s.match(/^(-?\d+)\s*(?:…|\.\.\.|\s)\s*(-?\d+)$/)
      return m !== null && Number(m[1]) === a.quotient && Number(m[2]) === a.remainder
    }
    case 'fraction': {
      const m = s.match(/^(-?\d+)\s*\/\s*(-?\d+)$/)
      if (!m) return false
      const num = Number(m[1])
      const den = Number(m[2])
      return den !== 0 && a.den !== 0 && num * a.den === a.num * den
    }
  }
}

/** Best-effort numeric projection for the legacy `calc_mistakes.answer` column. */
export function answerToNumeric(a: CalcAnswer): number {
  switch (a.kind) {
    case 'int':
    case 'decimal': return a.value
    case 'remainder': return a.quotient
    case 'fraction': return a.den === 0 ? 0 : a.num / a.den
  }
}

/** Reconstruct a CalcAnswer from a calc_mistakes row: prefer answer_json, else legacy int. */
export function answerFromRow(answerJson: CalcAnswer | null, legacyNumeric: number): CalcAnswer {
  return answerJson ?? { kind: 'int', value: legacyNumeric }
}
```

- [ ] **Step 2: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors. (Note: the `switch` statements are exhaustive over `kind`, so TypeScript needs no `default`.)

- [ ] **Step 3: Commit**

```bash
git add src/utils/calc-answer.ts
git commit -m "feat(calc): add answer helper layer (format/check/numeric)"
```

---

## Task 3: Migration — `answer_json` column

**Files:**
- Create: `docs/sql/calc-phase3a-answer-json-migration.sql`

- [ ] **Step 1: Write the migration**

Create `docs/sql/calc-phase3a-answer-json-migration.sql`:

```sql
-- Phase 3a: store the full structured answer (CalcAnswer) for mistakes.
-- Additive + backward-compatible: the legacy numeric `answer` column stays; reads
-- fall back to {kind:'int', value:answer} when answer_json is null. Run manually.
alter table calc_mistakes
  add column if not exists answer_json jsonb;
```

- [ ] **Step 2: Run the migration (user runs)** — run the SQL in Supabase. Required before the Task 4 manual check (the new select reads `answer_json`).

- [ ] **Step 3: Commit**

```bash
git add docs/sql/calc-phase3a-answer-json-migration.sql
git commit -m "feat(calc): add calc_mistakes.answer_json column"
```

---

## Task 4: Coordinated switch — make `answer` a `CalcAnswer` everywhere

> This is one atomic refactor: all of these edits must land together for the project to compile. After it, every answer is still `int`, so runtime behavior is identical.

**Files:**
- Modify: `src/utils/type.ts`, `src/utils/calc-ast.ts`, `src/utils/calc-inverse.ts`, `src/app/calc/session/page.tsx`, `src/hooks/useCalcMistakes.ts`, `src/hooks/useCalcSession.ts`, `src/components/calc/QuickPracticeModal.tsx`, `src/components/calc/MistakeRow.tsx`

- [ ] **Step 1: Change the two type fields**

In `src/utils/type.ts`:
- In `interface CalcQuestion`, change the line `answer: number` to:
```ts
  answer: CalcAnswer
```
- In `interface CalcMistake`, change the line `answer: number` to:
```ts
  answer: CalcAnswer
```

- [ ] **Step 2: `makeQuestion` wraps int**

In `src/utils/calc-ast.ts`:
- Add `CalcAnswer` to the existing type import from `./type` (it currently imports `CalcCategory, CalcLevel, CalcOp, CalcQuestion`). Make it:
```ts
import type { CalcCategory, CalcLevel, CalcOp, CalcQuestion, CalcAnswer } from './type'
```
- In `makeQuestion`, the line `const answer = evalAst(ast)` becomes:
```ts
  const answer: CalcAnswer = { kind: 'int', value: evalAst(ast) }
```
(The returned object literal `{ display, signature, arity, level, answer, ... }` is unchanged — `answer` is now the union. Every current caller produces integer evals, so this is correct.)

- [ ] **Step 3: `calc-inverse` reads/writes the int value**

In `src/utils/calc-inverse.ts`, the function currently does `const c = q.answer` and later `const answer = hideRight ? right : left` then `return { ...q, display, answer }`. Replace those so it works on the union (inverse only applies to int single-ops):

Change the early part of `toInverseQuestion` — after the existing `if (typeof left !== 'number' || typeof right !== 'number') return null` line, replace `const c = q.answer` with:
```ts
  if (q.answer.kind !== 'int') return null
  const c = q.answer.value
```
And change the final `const answer = hideRight ? right : left` line to:
```ts
  const answer: CalcAnswer = { kind: 'int', value: hideRight ? right : left }
```
Add `CalcAnswer` to its type import: the file imports `import type { CalcQuestion } from './type'` — change to:
```ts
import type { CalcQuestion, CalcAnswer } from './type'
```

- [ ] **Step 4: Session grades via `checkAnswer`, reveals via `formatAnswer`**

In `src/app/calc/session/page.tsx`:
- Add imports near the other `@/utils` imports:
```ts
import { checkAnswer, formatAnswer } from '@/utils/calc-answer'
```
- Change the `revealAnswer` state declaration `const [revealAnswer, setRevealAnswer] = useState<number | null>(null)` to:
```ts
  const [revealAnswer, setRevealAnswer] = useState<string | null>(null)
```
- In `settleQuestion`, change `setRevealAnswer(q.answer)` to:
```ts
      setRevealAnswer(formatAnswer(q.answer))
```
- In `handleSubmit`, the block:
```ts
    const userAns = Number(input)
    if (!Number.isFinite(userAns)) return

    const isCorrect = userAns === q.answer
```
becomes:
```ts
    const userAns = Number(input)
    if (!Number.isFinite(userAns)) return

    const isCorrect = checkAnswer(input, q.answer)
```
(The `Number.isFinite` guard stays — the pad only ever submits numeric input in this phase. `checkAnswer(input, intAnswer)` is equivalent to the old `Number(input) === value`.)

- [ ] **Step 5: `useCalcMistakes` plumbs `answer_json` + helpers**

In `src/hooks/useCalcMistakes.ts`:
- Add to imports:
```ts
import { answerFromRow, answerToNumeric } from '@/utils/calc-answer'
import type { CalcAnswer } from '@/utils/type'
```
(merge `CalcAnswer` into the existing `@/utils/type` import if one exists; the file currently imports `CalcCategory, CalcLevel, CalcMistake, CalcQuestion` from `@/utils/type` — add `CalcAnswer` there.)
- In `interface MistakeRow`, change `answer: number` to keep the numeric column AND add the json column:
```ts
  answer: number
  answer_json: CalcAnswer | null
```
- In `rowToMistake`, change `answer: r.answer,` to:
```ts
    answer: answerFromRow(r.answer_json, r.answer),
```
- In `addMistake`, the upsert payload currently has `answer: q.answer,`. Change it to:
```ts
              answer: answerToNumeric(q.answer),
              answer_json: q.answer,
```
- In `addMistake`'s optimistic local insert (the `return [{ ... }, ...prev]` object), the line `answer: q.answer,` is already correct (it's a `CalcAnswer` now) — leave it.
- In BOTH `.select('...')` strings (the `init` effect and the `refresh` callback — they list `id,signature,display,answer,level,category,last_wrong_at,consecutive_correct,resolved,session_no`), append `,answer_json` to each so they read `...,session_no,answer_json`.

- [ ] **Step 6: Second grading engine — `useCalcSession` grades via `checkAnswer`**

`src/hooks/useCalcSession.ts` is a separate session engine used by the "练一练" practice modal. In its `handleSubmit`, it currently has `const val = Number(input)`, a finite guard, and later `if (val === currentQ.answer) {`. Keep `val` and the guard (used for the finite/empty check), and change the comparison line `if (val === currentQ.answer) {` to:
```ts
    if (checkAnswer(input, currentQ.answer)) {
```
Add the import near the top of the file:
```ts
import { checkAnswer } from '@/utils/calc-answer'
```

- [ ] **Step 7: `QuickPracticeModal` reveals via `formatAnswer`**

In `src/components/calc/QuickPracticeModal.tsx`, the wrong-feedback block renders `{currentQ?.answer}` (inside a `<span>`). Change that expression to:
```tsx
              {currentQ ? formatAnswer(currentQ.answer) : ''}
```
Add the import near the top:
```ts
import { formatAnswer } from '@/utils/calc-answer'
```

- [ ] **Step 8: `MistakeRow` renders via `formatAnswer`**

In `src/components/calc/MistakeRow.tsx`, change the line `{mistake.answer}` to:
```tsx
          {formatAnswer(mistake.answer)}
```
Add the import (the file currently imports only the `CalcMistake` type from `@/utils/type`):
```ts
import { formatAnswer } from '@/utils/calc-answer'
```

- [ ] **Step 9: Type-check checkpoint (user runs)** — `pnpm lint` then `pnpm build`. Expect no errors. If anything still references an `answer` as a number, the compiler will flag it — fix by routing through `checkAnswer`/`formatAnswer`/`answerToNumeric`.

- [ ] **Step 10: Manual regression checkpoint (user runs)**

With the Task 3 migration run, confirm **identical** behavior to before across BOTH session engines:
1. Main `/calc` session: correct grades right + awards coins + advances; a wrong answer (twice) reveals 「答案是 105」 and records a mistake; the carried mistake reappears next session and grades correctly.
2. Settings → 「✨ 用当前设置练一练！」 modal: correct/wrong grading and the wrong-reveal number both work.
3. The mistakes list (`MistakeRow`) shows each mistake's answer correctly; `/calc/report` still renders.
4. Inverse blank questions (if `includeInverse` on) still grade correctly.

- [ ] **Step 11: Commit**

```bash
git add src/utils/type.ts src/utils/calc-ast.ts src/utils/calc-inverse.ts src/app/calc/session/page.tsx src/hooks/useCalcMistakes.ts src/hooks/useCalcSession.ts src/components/calc/QuickPracticeModal.tsx src/components/calc/MistakeRow.tsx
git commit -m "refactor(calc): switch answer to CalcAnswer union (int-only, no behavior change)"
```

---

## Self-Review

- **Spec coverage (Phase 3a):** "Introduce the tagged CalcAnswer union" → Tasks 1, 4. "migrate all read sites" → Task 4. The complete set of 8 read sites (found by `grep -rnE "\.answer\b|answer:" src`): `calc-ast` `makeQuestion` (4.2), `calc-inverse` (4.3), main session grade+reveal (4.4), `useCalcMistakes` read/write (4.5), **`useCalcSession` second grading engine (4.6)**, **`QuickPracticeModal` reveal (4.7)**, **`MistakeRow` render (4.8)**. `calc-helpers` carried needs no edit (`answer: m.answer` is already `CalcAnswer`). Remainder/decimals deferred to 3b/3c (flagged in Scope).
- **Report note:** `/calc/report` reads `calc_problem_state` (proficiency), NOT `calc_mistakes` and not any `answer` field — confirmed by grep. No report code changes needed.
- **Placeholder scan:** none — every code step shows complete code; every verification step is an exact command/manual check.
- **Type consistency:** `CalcAnswer` defined once (Task 1), consumed by helpers (Task 2), `makeQuestion` (Task 4.2), `calc-inverse` (4.3), session (4.4), `useCalcMistakes` (4.5). Helper names used consistently: `formatAnswer`, `checkAnswer`, `answerToNumeric`, `answerFromRow`, `intAnswer` (constructors defined in Task 2, used in Task 4). `CalcQuestion.answer` and `CalcMistake.answer` both become `CalcAnswer` in the same task so nothing reads the old `number` shape afterward.
- **Atomicity:** Task 4 must land as one commit — intermediate states don't compile because the type change breaks every reader until all are updated. Tasks 1–3 are individually additive and green.
- **Migration:** one additive `calc_mistakes.answer_json jsonb` column (Task 3), backward-compatible via `answerFromRow` fallback.
