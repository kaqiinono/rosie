# Calc NumberPad auto-submit on match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When NumberPad input fully matches the correct int/decimal answer, auto-settle as correct and advance without a confirm tap; wrong/incomplete input still requires confirm.

**Architecture:** Pure `shouldAutoSubmitNumberPad` helper; settings flag `autoSubmitOnMatch` (default true) with incremental SQL; `session.tsx` wraps NumberPad `onInputChange` to call the helper and, on match, reuse the existing correct path of `handleSubmit` behind a settle-in-flight guard.

**Tech Stack:** TypeScript, `@rosie/calc` + `@rosie/core`, Supabase `ALTER … ADD COLUMN IF NOT EXISTS`, Vitest via `apps/web`.

**Spec:** [`docs/superpowers/specs/2026-07-09-calc-autosubmit-on-match-design.md`](../specs/2026-07-09-calc-autosubmit-on-match-design.md)

## Global Constraints

- NumberPad int/decimal only — never vertical / remainder / fraction / pie
- Trigger only when `trim(input).length >= formatAnswer(answer).length` **and** `checkAnswer` true
- Never auto-fail on mismatch; confirm still required for wrongs
- Setting `autoSubmitOnMatch` default **true**; user can disable
- SQL: only `ADD COLUMN IF NOT EXISTS`; no DELETE/TRUNCATE/重灌
- Reuse existing correct settlement (timing, withinLimit, coins, soft-retry rules) — do not fork a second success path
- Guard against double settle while feedback / transition in flight
- Before done: `pnpm --filter @rosie/calc typecheck` + focused vitest

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/calc/src/utils/calc-answer.ts` | Modify | Add `shouldAutoSubmitNumberPad` |
| `apps/web/tests/calc-autosubmit.test.ts` | Create | Unit tests for helper |
| `packages/calc/src/index.ts` | Modify | Export helper |
| `docs/sql/calc-autosubmit-on-match.sql` | Create | Incremental column |
| `packages/calc/sql/calc-autosubmit-on-match.sql` | Create | Tracked mirror (docs/ gitignored) |
| `packages/core/src/type.ts` | Modify | `CalcSettings.autoSubmitOnMatch` |
| `packages/calc/src/hooks/useCalcSettings.ts` | Modify | Load/persist flag |
| `packages/calc/src/pages/session.tsx` | Modify | Input watch + auto settle |
| `packages/calc/src/pages/settings.tsx` | Modify | Toggle UI |
| `packages/calc/FAQ.md` / `faq.tsx` / `CLAUDE.md` | Modify | Short note |

---

### Task 1: Pure helper + tests

**Files:**
- Modify: `packages/calc/src/utils/calc-answer.ts`
- Create: `apps/web/tests/calc-autosubmit.test.ts`
- Modify: `packages/calc/src/index.ts`

**Interfaces:**
- Produces:

```ts
/** True when NumberPad input is long enough and grades correct for int/decimal. */
export function shouldAutoSubmitNumberPad(input: string, answer: CalcAnswer): boolean
```

Rules:
- Return `false` unless `answer.kind` is `'int'` or `'decimal'`
- Let `s = input.trim()`; if `s.length < formatAnswer(answer).length` → `false`
- Else return `checkAnswer(s, answer)`

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/tests/calc-autosubmit.test.ts
import { describe, it, expect } from 'vitest'
import {
  shouldAutoSubmitNumberPad,
  intAnswer,
  decimalAnswer,
  remainderAnswer,
  fractionAnswer,
} from '@rosie/calc'

describe('shouldAutoSubmitNumberPad', () => {
  it('rejects incomplete int prefix', () => {
    expect(shouldAutoSubmitNumberPad('1', intAnswer(12))).toBe(false)
    expect(shouldAutoSubmitNumberPad('12', intAnswer(12))).toBe(true)
  })

  it('rejects wrong full-length int', () => {
    expect(shouldAutoSubmitNumberPad('13', intAnswer(12))).toBe(false)
  })

  it('accepts matching decimal at canonical length', () => {
    const a = decimalAnswer(1.5, 1) // formatAnswer → "1.5"
    expect(shouldAutoSubmitNumberPad('1.', a)).toBe(false)
    expect(shouldAutoSubmitNumberPad('1.5', a)).toBe(true)
  })

  it('never auto-submits rem/frac kinds', () => {
    expect(shouldAutoSubmitNumberPad('3…1', remainderAnswer(3, 1))).toBe(false)
    expect(shouldAutoSubmitNumberPad('1/2', fractionAnswer(1, 2))).toBe(false)
  })

  it('trims whitespace', () => {
    expect(shouldAutoSubmitNumberPad(' 12 ', intAnswer(12))).toBe(true)
  })
})
```

Also export `intAnswer` / `decimalAnswer` / `remainderAnswer` / `fractionAnswer` from `@rosie/calc` if not already public (today only `formatAnswer` is exported from calc-answer — add the constructors + `shouldAutoSubmitNumberPad` + keep `checkAnswer` export if useful).

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter web exec vitest run tests/calc-autosubmit.test.ts
```

- [ ] **Step 3: Implement**

```ts
export function shouldAutoSubmitNumberPad(input: string, answer: CalcAnswer): boolean {
  if (answer.kind !== 'int' && answer.kind !== 'decimal') return false
  const s = input.trim()
  if (s.length < formatAnswer(answer).length) return false
  return checkAnswer(s, answer)
}
```

- [ ] **Step 4: Export from index; tests PASS**

```ts
export {
  formatAnswer,
  checkAnswer,
  shouldAutoSubmitNumberPad,
  intAnswer,
  decimalAnswer,
  remainderAnswer,
  fractionAnswer,
} from './utils/calc-answer'
```

(Merge with existing `formatAnswer` export — do not duplicate.)

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/utils/calc-answer.ts packages/calc/src/index.ts apps/web/tests/calc-autosubmit.test.ts
git commit -m "$(cat <<'EOF'
feat(calc): add shouldAutoSubmitNumberPad helper

EOF
)"
```

---

### Task 2: Settings schema + persist + toggle

**Files:**
- Create: `docs/sql/calc-autosubmit-on-match.sql`
- Create: `packages/calc/sql/calc-autosubmit-on-match.sql` (same contents)
- Modify: `packages/core/src/type.ts`
- Modify: `packages/calc/src/hooks/useCalcSettings.ts`
- Modify: `packages/calc/src/pages/settings.tsx`

- [ ] **Step 1: SQL**

```sql
-- calc-autosubmit-on-match.sql
ALTER TABLE calc_settings
  ADD COLUMN IF NOT EXISTS auto_submit_on_match boolean NOT NULL DEFAULT true;
```

- [ ] **Step 2: Types + hook**

Add to `CalcSettings`:

```ts
autoSubmitOnMatch: boolean // 数字键盘答对即过；默认 true
```

`DEFAULT_SETTINGS.autoSubmitOnMatch = true`  
`RawRow.auto_submit_on_match: boolean | null`  
`rowToSettings`: `autoSubmitOnMatch: row.auto_submit_on_match ?? true`  
`settingsToRow` + `fetch` select list include the column.

**Deploy note:** same blast-radius as timing_mode — run SQL before prod select includes the new column, or fetch fails entirely.

- [ ] **Step 3: Settings UI**

Add `ToggleRow` near immersive / timed toggles:

```ts
<ToggleRow
  label="数字键盘答对即过"
  description="输入已与正确答案完全一致时无需点确认，直接进入下一题；答错仍需确认。竖式/分数/余数不受影响。"
  value={settings.autoSubmitOnMatch}
  onChange={(v) => update({ autoSubmitOnMatch: v })}
/>
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter @rosie/core typecheck
pnpm --filter @rosie/calc typecheck
git commit -m "$(cat <<'EOF'
feat(calc): persist autoSubmitOnMatch setting

EOF
)"
```

---

### Task 3: Session wiring

**Files:**
- Modify: `packages/calc/src/pages/session.tsx`

**Logic:**

1. Add `settleLockRef = useRef(false)` — set true at start of any settle path that advances; clear when entering a new question (`idx` change / after clearing input for next).

2. Replace bare `onInputChange={setInput}` with:

```ts
const handleNumberPadInputChange = useCallback((next: string) => {
  setInput(next)
  if (!settings.autoSubmitOnMatch) return
  if (!questions || done) return
  const q = questions[idx]
  if (!q) return
  // NumberPad only: skip vertical and non int/decimal
  if (q.answerMode === 'vertical') return
  if (q.answer.kind !== 'int' && q.answer.kind !== 'decimal') return
  if (feedback) return // waiting on wrong banner / etc.
  if (settleLockRef.current) return
  if (!shouldAutoSubmitNumberPad(next, q.answer)) return
  settleLockRef.current = true
  // Reuse the same path as confirm — call handleSubmit body with `next`
  // Prefer extracting the core of handleSubmit to accept an explicit input string
  // so we don't race on stale `input` state:
  submitNumberPadAnswer(next)
}, [/* deps */])
```

3. Refactor `handleSubmit` to call shared `submitNumberPadAnswer(raw: string)` that uses `raw` instead of closure `input`. NumberPad confirm button keeps calling `handleSubmit` → `submitNumberPadAnswer(input)`.

4. On question advance / `setInput('')` for next item, set `settleLockRef.current = false`.

5. Do **not** change remainder / fraction / vertical submit handlers.

**Detect NumberPad path:** `answerMode !== 'vertical'` and `answer.kind` in `int|decimal` matches `CalcAnswerInput` (rem/frac kinds use other pads even when not vertical).

- [ ] **Step 1: Implement refactor + auto path**

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @rosie/calc typecheck
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(calc): auto-advance NumberPad when input matches answer

EOF
)"
```

---

### Task 4: Docs + verify

**Files:**
- Modify: `packages/calc/FAQ.md`, `faq.tsx` (one short bullet), `CLAUDE.md`

- [ ] **Step 1: FAQ** — under 答题 / 设置: 可开「数字键盘答对即过」；匹配后免确认；错仍要确认。

- [ ] **Step 2: Commands**

```bash
pnpm --filter @rosie/calc typecheck
pnpm --filter web exec vitest run tests/calc-autosubmit.test.ts
```

- [ ] **Step 3: Code smoke** — helper cases; settings field present; session uses `shouldAutoSubmitNumberPad`; SQL file exists.

- [ ] **Step 4: Commit docs if changed**

```bash
git commit -m "$(cat <<'EOF'
docs(calc): document NumberPad auto-submit on match

EOF
)"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Length gate + checkAnswer | T1 |
| int/decimal only | T1, T3 |
| No auto-fail | T3 (only success path) |
| Setting default true + toggle | T2 |
| Incremental SQL | T2 |
| Race guard | T3 settleLockRef |
| FAQ | T4 |

## Self-review notes

- Decimal length uses `toFixed(places)` from `formatAnswer` — matches NumberPad decimal entry expectations.
- Leading zeros: `checkAnswer` uses `Number(s)` so `"012"` vs int `12` may grade true once length ≥ 2; length gate uses `"12".length` so `"0"` alone won't fire; `"012"` length 3 ≥ 2 and Number equals — acceptable (same as manual confirm).
- Operator must run SQL before production deploy (same class of risk as `timing_mode` columns).
