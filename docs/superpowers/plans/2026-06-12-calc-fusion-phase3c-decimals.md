# Calc Fusion — Phase 3c Implementation Plan (Decimals 小数加减乘除)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add decimal practice (一位/两位小数加减、小数×整数、小数÷整数) to `/calc` free mode under a dedicated 「小数」 block group, answered on the number pad with a decimal-point key.

**Architecture:** Builds on Phase 3a (`CalcAnswer.decimal` kind + `decimalAnswer`/`formatAnswer`/`checkAnswer` with tolerance) and Phase 3b (`CalcBlock.noResurface`). A new `decimalBlock` factory generates questions whose answers are computed in **scaled-integer space** (tenths/hundredths) to avoid float error, then divided once; it sets `noResurface` (decimals don't round-trip the integer AST). Decimal blocks live in a new `'decimal'` group so they're grouped in the picker and excluded from mixed-op composition. `NumberPad` gains an opt-in decimal-point key.

**Tech Stack:** Next.js 15 (client components), TypeScript (no `any`), Tailwind v4, Supabase. **No test runner** — verification is `pnpm lint` + `pnpm build` + manual, **run by the user**, surfaced as checkpoints. No migration (decimal answers persist via Phase 3a's `answer_json`).

---

## Scope

Phase 3c — the last Phase 3 piece. Covers +, −, ×, ÷ with decimals via: 一位小数加减、两位小数加减、小数×整数、小数÷整数. **Deferred** (own follow-up if wanted): 小数×小数 and 小数÷小数 (÷ by a decimal needs extra generation care).

**Decisions locked:**
- **New `'decimal'` group** (not scattered into 加/减/乘/除): cleaner picker UX, and bucketize excludes it so decimals never enter mixed ops.
- **Scaled-integer generation**: operands/answers computed as integer tenths/hundredths; one final `/10` or `/100`. Grading tolerance (`0.5·10^-places`, already in Phase 3a) absorbs float repr.
- **Operand display via `String(value)`** with non-zero last fractional digit generated, so operands read like decimals (3.5, 4.56) not 3.0.
- **`noResurface`** on decimal blocks (same reason as remainder).

## File Structure

- **Modify** `src/utils/calc-blocks.ts` — `'decimal'` in group union; `BLOCK_GROUPS` += 小数; `decimalBlock` factory; 4 decimal blocks; imports.
- **Modify** `src/utils/calc-mixed.ts` — `bucketize` skips non-div groups (so `decimal` isn't pushed into the div bucket).
- **Modify** `src/components/calc/BlockPicker.tsx` — `GROUP_ICONS` += decimal.
- **Modify** `src/app/calc/settings/page.tsx` — widen `toggleGroup` param to `CalcBlock['group']`.
- **Modify** `src/components/calc/NumberPad.tsx` — `allowDecimal` prop + `.` key.
- **Modify** `src/app/calc/session/page.tsx` + `src/components/calc/QuickPracticeModal.tsx` — pass `allowDecimal` for decimal questions.

---

## Task 1: 「小数」 group plumbing

**Files:** `src/utils/calc-blocks.ts`, `src/utils/calc-mixed.ts`, `src/components/calc/BlockPicker.tsx`, `src/app/calc/settings/page.tsx`

> Adds the group so the type system + picker + report know about it. (BlockPicker will show an empty 小数 group until Task 2 adds blocks — a harmless transient.)

- [ ] **Step 1: Extend the group union** — in `src/utils/calc-blocks.ts`, change the `CalcBlock` interface line:
```ts
  group: 'add' | 'sub' | 'mul' | 'div'
```
to:
```ts
  group: 'add' | 'sub' | 'mul' | 'div' | 'decimal'
```

- [ ] **Step 2: Add to `BLOCK_GROUPS`** — in the `BLOCK_GROUPS` array, add after the `{ group: 'div', label: '除法' }` entry:
```ts
  { group: 'decimal', label: '小数' },
```

- [ ] **Step 3: Fix `bucketize`** — in `src/utils/calc-mixed.ts`, the bucket loop ends with `else div.push(b)`. Change that line:
```ts
    else div.push(b)
```
to:
```ts
    else if (b.group === 'div') div.push(b)
```
(So only real `div` blocks go to the div bucket; `decimal` blocks are skipped — they don't compose into mixed ops.)

- [ ] **Step 4: Add the group icon** — in `src/components/calc/BlockPicker.tsx`, in the `GROUP_ICONS` object (`Record<CalcBlock['group'], string>`), add:
```ts
  decimal: '🔢',
```
(TypeScript requires this entry once `'decimal'` is in the union.)

- [ ] **Step 5: Widen `toggleGroup`** — in `src/app/calc/settings/page.tsx`:
  - Ensure `CalcBlock` is imported from `@/utils/calc-blocks` (the file already imports `blocksByGroup` from there — add `type CalcBlock` to that import).
  - Change the `toggleGroup` signature:
```ts
  const toggleGroup = (group: 'add' | 'sub' | 'mul' | 'div', on: boolean) => {
```
to:
```ts
  const toggleGroup = (group: CalcBlock['group'], on: boolean) => {
```

- [ ] **Step 6: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 7: Commit**
```bash
git add src/utils/calc-blocks.ts src/utils/calc-mixed.ts src/components/calc/BlockPicker.tsx src/app/calc/settings/page.tsx
git commit -m "feat(calc): add 小数 block group plumbing"
```

---

## Task 2: `decimalBlock` factory + 4 decimal blocks

**Files:** `src/utils/calc-blocks.ts`

- [ ] **Step 1: Extend imports** — at the top of `src/utils/calc-blocks.ts`:
  - Add `OP_SYMBOL` to the `./calc-ast` import (currently `import { AstNode, CalcOp, makeQuestion, randInt, pickOne } from './calc-ast'`):
```ts
import { AstNode, CalcOp, makeQuestion, OP_SYMBOL, randInt, pickOne } from './calc-ast'
```
  - Add `decimalAnswer` to the `./calc-answer` import (currently `import { remainderAnswer } from './calc-answer'`):
```ts
import { decimalAnswer, remainderAnswer } from './calc-answer'
```
  - Add `CalcCategory` to the type import (currently `import type { CalcQuestion } from './type'`):
```ts
import type { CalcCategory, CalcQuestion } from './type'
```

- [ ] **Step 2: Add the factory** — place it near the other `*Block` factories:
```ts
function decimalBlock(
  id: string,
  label: string,
  gen: () => { left: number; right: number; op: CalcOp; value: number; places: number },
): CalcBlock {
  return {
    id,
    op: 'add',
    label,
    group: 'decimal',
    noResurface: true,
    generateSingle(): CalcQuestion {
      const { left, right, op, value, places } = gen()
      const category: CalcCategory = op === 'add' || op === 'sub' ? 'addsub' : 'muldiv'
      return {
        display: `${String(left)} ${OP_SYMBOL[op]} ${String(right)} = ?`,
        signature: `${op}(${left},${right})`,
        arity: 1,
        level: 0,
        answer: decimalAnswer(value, places),
        isChallenge: false,
        category,
        coinBase: 2,
      }
    },
    sampleTerm() {
      // Decimal blocks don't compose into mixed ops; benign integer term.
      const a = randInt(2, 9)
      return { ast: a, value: a }
    },
  }
}
```

- [ ] **Step 3: Register the 4 blocks** — at the END of the `BLOCKS` array (after the `div:rem` entry), add:
```ts
  decimalBlock('dec:add1', '一位小数加减', () => {
    const isAdd = Math.random() < 0.5
    const a = randInt(1, 8) * 10 + randInt(1, 9)
    const b = randInt(1, 8) * 10 + randInt(1, 9)
    if (isAdd) return { left: a / 10, right: b / 10, op: 'add', value: (a + b) / 10, places: 1 }
    const hi = Math.max(a, b)
    const lo = Math.min(a, b)
    return { left: hi / 10, right: lo / 10, op: 'sub', value: (hi - lo) / 10, places: 1 }
  }),
  decimalBlock('dec:add2', '两位小数加减', () => {
    const isAdd = Math.random() < 0.5
    const a = randInt(1, 8) * 100 + randInt(1, 9) * 10 + randInt(1, 9)
    const b = randInt(1, 8) * 100 + randInt(1, 9) * 10 + randInt(1, 9)
    if (isAdd) return { left: a / 100, right: b / 100, op: 'add', value: (a + b) / 100, places: 2 }
    const hi = Math.max(a, b)
    const lo = Math.min(a, b)
    return { left: hi / 100, right: lo / 100, op: 'sub', value: (hi - lo) / 100, places: 2 }
  }),
  decimalBlock('dec:mulInt', '小数×整数', () => {
    const a = randInt(1, 8) * 10 + randInt(1, 9)
    const k = randInt(2, 9)
    return { left: a / 10, right: k, op: 'mul', value: (a * k) / 10, places: 1 }
  }),
  decimalBlock('dec:divInt', '小数÷整数', () => {
    const q = randInt(1, 8) * 10 + randInt(1, 9)
    const d = randInt(2, 9)
    return { left: (q * d) / 10, right: d, op: 'div', value: q / 10, places: 1 }
  }),
```

- [ ] **Step 4: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors. The 小数 group in `/calc/settings` now shows 4 chips.

- [ ] **Step 5: Commit**
```bash
git add src/utils/calc-blocks.ts
git commit -m "feat(calc): add decimal blocks (一位/两位小数加减、小数×整数、小数÷整数)"
```

---

## Task 3: `NumberPad` decimal-point support

**Files:** `src/components/calc/NumberPad.tsx`

> Add an opt-in `.` key. In decimal mode the bottom grid slot becomes `.` and the ✓ moves to a full-width button below; non-decimal mode is unchanged.

- [ ] **Step 1: Rewrite `NumberPad`** with this content:
```tsx
'use client'

interface Props {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  disabled?: boolean
  /** When true, show a decimal-point key (✓ moves to a full-width button below the grid). */
  allowDecimal?: boolean
}

export default function NumberPad({ value, onChange, onSubmit, disabled, allowDecimal = false }: Props) {
  const maxDigits = allowDecimal ? 6 : 4
  // In decimal mode the 12th grid slot is '.', and ✓ becomes a separate full-width button.
  const gridKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', allowDecimal ? '.' : '✓']

  const press = (key: string) => {
    if (disabled) return
    if (key === '✓') {
      if (value.length > 0) onSubmit()
      return
    }
    if (key === '⌫') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '.') {
      if (!allowDecimal || value.includes('.')) return
      onChange(value === '' ? '0.' : value + '.')
      return
    }
    // digit
    if (value.replace('.', '').length >= maxDigits) return
    onChange(value === '0' ? key : value + key)
  }

  const keyStyle = (key: string): React.CSSProperties => {
    const isSubmit = key === '✓'
    const isDel = key === '⌫'
    const inactive = disabled || (isSubmit && value.length === 0)
    if (isSubmit) {
      return {
        background: inactive ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #059669, #10b981)',
        color: inactive ? 'rgba(16,185,129,0.35)' : '#ffffff',
        boxShadow: inactive ? 'none' : '0 4px 16px rgba(16,185,129,0.35)',
        border: '1px solid rgba(16,185,129,0.25)',
        cursor: inactive ? 'not-allowed' : 'pointer',
      }
    }
    if (isDel) {
      return {
        background: 'rgba(239,68,68,0.1)',
        color: disabled ? 'rgba(252,165,165,0.3)' : '#fca5a5',
        border: '1px solid rgba(239,68,68,0.2)',
      }
    }
    return {
      background: 'rgba(255,255,255,0.05)',
      color: disabled ? 'rgba(245,243,255,0.25)' : '#f5f3ff',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
    }
  }

  const keyButton = (key: string) => {
    const inactive = disabled || (key === '✓' && value.length === 0)
    return (
      <button
        key={key}
        type="button"
        onClick={() => press(key)}
        disabled={inactive}
        className="h-14 rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]"
        style={keyStyle(key)}
      >
        {key}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2.5">{gridKeys.map(keyButton)}</div>
      {allowDecimal && (
        <button
          type="button"
          onClick={() => press('✓')}
          disabled={disabled || value.length === 0}
          className="h-14 w-full rounded-2xl text-[24px] font-black transition-all select-none active:scale-[0.93]"
          style={keyStyle('✓')}
        >
          ✓
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors. (Behavior with `allowDecimal` absent/false is identical to before: 12-key grid with ✓ in the corner.)

- [ ] **Step 3: Commit**
```bash
git add src/components/calc/NumberPad.tsx
git commit -m "feat(calc): NumberPad optional decimal-point key"
```

---

## Task 4: Pass `allowDecimal` for decimal questions

**Files:** `src/app/calc/session/page.tsx`, `src/components/calc/QuickPracticeModal.tsx`

- [ ] **Step 1: Main session** — in `src/app/calc/session/page.tsx`, find the `<NumberPad ... />` in the pad branch (the `else` of the remainder/vertical dispatch, with `value={input} onChange={setInput} onSubmit={handleSubmit} disabled={!!feedback || done}`). Add the prop:
```tsx
              allowDecimal={currentQ.answer.kind === 'decimal'}
```

- [ ] **Step 2: Modal** — in `src/components/calc/QuickPracticeModal.tsx`, find the `<NumberPad ... onSubmit={session.handleSubmit} ... />` in the else branch. Add:
```tsx
            allowDecimal={currentQ?.answer.kind === 'decimal'}
```

- [ ] **Step 3: Type-check + build checkpoint (user runs)** — `pnpm lint` then `pnpm build`; expect no errors.

- [ ] **Step 4: Manual checkpoint (user runs)** — select 小数「一位小数加减」 / 「小数÷整数」 in `/calc/settings`, then practice in the main session AND the 「练一练」 modal:
  1. Decimal questions (e.g. `3.5 + 2.8 = ?`) render the number pad with a `.` key and a full-width ✓.
  2. Typing `6.3` grades correct (`2.5 + 2.8` etc.); a wrong answer reveals the decimal (e.g. 「答案是 6.3」).
  3. Integer / remainder / vertical questions still use their normal input (no stray `.` key on integer questions).
  4. `小数÷整数` answers are clean one-place decimals (e.g. `7.5 ÷ 3 = 2.5`).

- [ ] **Step 5: Commit**
```bash
git add src/app/calc/session/page.tsx src/components/calc/QuickPracticeModal.tsx
git commit -m "feat(calc): enable decimal-point input for decimal questions"
```

---

## Task 5: Final verification (user runs)

- [ ] **Step 1: Build** — `pnpm build`; expect clean.
- [ ] **Step 2: End-to-end** — 小数 group shows 4 blocks; decimal questions answered with the `.` key in both engines (correct/wrong/reveal/carry); decimals never appear in mixed ops; Phase 1–3b features (inverse, vertical, remainder) all still work.

---

## Self-Review

- **Spec coverage (Phase 3c):** "Decimal blocks (加减乘除)" → Task 2 (4 blocks covering +,−,×,÷). "tolerance comparison" → reused from Phase 3a `checkAnswer` (decimal kind). Float safety → scaled-integer generation (Task 2). Input → Task 3 (`.` key) + Task 4 (wiring). 小数×小数 / ÷小数 explicitly deferred (Scope).
- **Float-precision rationale:** every answer is computed as integer tenths/hundredths then divided once; `checkAnswer` decimal tolerance `0.5·10^-places` absorbs binary-float repr (e.g. 6.3). Operands are generated with a non-zero last fractional digit so `String()` renders them as decimals.
- **No-mixed safety:** `bucketize` change (Task 1 Step 3) skips the `decimal` group, and decimal blocks set `noResurface` (Task 2) so `buildSession` never reconstructs them through the integer AST.
- **Placeholder scan:** none — all code complete; verification steps are exact commands/manual checks.
- **Type consistency:** `decimalBlock` `gen` returns `{left,right,op,value,places}`, consumed in `generateSingle` producing `answer: decimalAnswer(value, places)` (a `CalcAnswer`). `'decimal'` added to the group union (Task 1) is consumed by `GROUP_ICONS` (required entry), `BLOCK_GROUPS`, `bucketize`, and `toggleGroup` (widened). `NumberPad` `allowDecimal?: boolean` (Task 3) passed in Task 4. No migration (Phase 3a `answer_json`).
