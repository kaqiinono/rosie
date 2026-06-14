# Calc Fusion — Phase 5 Implementation Plan (Error Diagnosis + Weak-Point Report)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the child answers wrong, deterministically classify the mistake (进位遗漏 / 运算顺序混淆 / 数位偏差 / 分子分母混淆 / 粗心), store the wrong answer + tag, and surface an 「错误类型分布」 section in `/calc/report`.

**Architecture:** A new pure `calc-diagnose.ts` `diagnose(question, userAnswer)` uses the question's **AST signature + display** to detect error patterns with certainty (no choice-question distractors needed — calc is free-input): no-carry addition → `carry_miss`; strict left-to-right re-eval of a mixed expression → `order_confusion`; ×10/÷10 → `place_value`; 分母直加 → `fraction_concept`; small off-by → `careless`; else null. The session threads the raw user answer into the existing `settleQuestion`, which diagnoses on the final-wrong path and persists `user_answer` + `error_tag` to `calc_mistakes`. The report aggregates `error_tag` into a distribution. **Proficiency/mastery is untouched** — this is a purely additive, orthogonal axis.

**Tech Stack:** Next.js 15 (client components), TypeScript (no `any`), Tailwind v4, Supabase. **No test runner** — verification is `pnpm lint` + `pnpm build` + manual, **run by the user**.

---

## Scope

Phase 5 of the spec. Reuses `calculate`'s 8-tag `ErrorTag` taxonomy + Chinese labels, but the **engine is rebuilt** on calc's AST (the ported `detectErrorTag`/`diagnoseBlank` depend on choice questions / are weak — not used).

**In scope:** the diagnoser, storing `user_answer`+`error_tag` on `calc_mistakes`, and a global 「错误类型分布」 report section.
**Deferred (own follow-up if wanted):** per-block error breakdown (needs a signature→block join) and per-session `calc_sessions.error_summary` (session-summary integration). Tags realistically produced now: `carry_miss`, `place_value`, `order_confusion`, `fraction_concept`, `careless`; the other 3 (`comprehension`/`formula_misuse`/`estimation_off`) exist in the taxonomy but aren't generated (no word problems/percentages).

## File Structure

- **Modify** `src/utils/type.ts` — add `ErrorTag` type; `CalcMistake` += `userAnswer?`/`errorTag?`.
- **Create** `src/utils/calc-diagnose.ts` — `diagnose()` + `ERROR_TAG_LABELS`.
- **Create** `docs/sql/calc-phase5-error-tags-migration.sql` — `calc_mistakes` += `user_answer`, `error_tag`.
- **Modify** `src/hooks/useCalcMistakes.ts` — plumb `user_answer`/`error_tag`.
- **Modify** `src/app/calc/session/page.tsx` — thread `userAnswer` into `settleQuestion`; diagnose on final wrong.
- **Modify** `src/app/calc/report/page.tsx` — 「错误类型分布」 section.

---

## Task 1: `ErrorTag` type + `calc-diagnose.ts`

**Files:** `src/utils/type.ts`, `src/utils/calc-diagnose.ts`

- [ ] **Step 1: Add `ErrorTag` to `type.ts`** — near the other calc types (e.g. after `CalcAnswer`):
```ts
export type ErrorTag =
  | 'carry_miss'
  | 'order_confusion'
  | 'place_value'
  | 'fraction_concept'
  | 'comprehension'
  | 'careless'
  | 'formula_misuse'
  | 'estimation_off'
```

- [ ] **Step 2: Add `userAnswer`/`errorTag` to `CalcMistake`** — in `interface CalcMistake`, after the existing fields, add:
```ts
  /** The child's (final-wrong) answer, for review. */
  userAnswer?: string
  /** Deterministic error classification, or null when unrecognized. */
  errorTag?: ErrorTag | null
```

- [ ] **Step 3: Create `src/utils/calc-diagnose.ts`**:
```ts
import { parseSignature } from './calc-ast'
import type { CalcQuestion, ErrorTag } from './type'

export const ERROR_TAG_LABELS: Record<ErrorTag, string> = {
  carry_miss: '进位遗漏',
  order_confusion: '运算顺序混淆',
  place_value: '数位理解偏差',
  fraction_concept: '分子分母混淆',
  comprehension: '题意理解偏差',
  careless: '粗心计算失误',
  formula_misuse: '公式套用错误',
  estimation_off: '估算范围偏差',
}

/** Column-wise addition with carries DROPPED (the classic "forgot to carry" result). */
function noCarryAdd(a: number, b: number): number {
  const as = String(a).split('').reverse()
  const bs = String(b).split('').reverse()
  const len = Math.max(as.length, bs.length)
  const digits: number[] = []
  for (let i = 0; i < len; i++) {
    digits.push(((Number(as[i]) || 0) + (Number(bs[i]) || 0)) % 10)
  }
  return Number(digits.reverse().join('')) || 0
}

/** Evaluate a paren-free expression strictly left-to-right, ignoring precedence. */
function evalLeftToRight(display: string): number | null {
  const expr = display.replace(/\s*=\s*\?\s*$/, '')
  if (/[()□]/.test(expr)) return null
  const tokens = expr.match(/\d+|[+\-−×÷]/g)
  if (!tokens || tokens.length < 3) return null
  let acc = Number(tokens[0])
  for (let i = 1; i < tokens.length - 1; i += 2) {
    const op = tokens[i]
    const n = Number(tokens[i + 1])
    if (op === '+') acc += n
    else if (op === '-' || op === '−') acc -= n
    else if (op === '×') acc *= n
    else if (op === '÷') {
      if (n === 0) return null
      acc /= n
    }
  }
  return acc
}

/**
 * Deterministically classify a WRONG answer using the question's AST + display.
 * Returns null when no pattern is recognized (the answer is still recorded).
 */
export function diagnose(q: CalcQuestion, userAnswer: string): ErrorTag | null {
  const ans = q.answer

  // Fractions: 分母直加 (added denominators) on a + question.
  if (ans.kind === 'fraction') {
    const um = userAnswer.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
    const dm = q.display.match(/^(\d+)\/(\d+)\s*([+−-])\s*(\d+)\/(\d+)/)
    if (um && dm && dm[3] === '+') {
      const n1 = Number(dm[1])
      const d1 = Number(dm[2])
      const n2 = Number(dm[4])
      const d2 = Number(dm[5])
      if (Number(um[1]) === n1 + n2 && Number(um[2]) === d1 + d2) return 'fraction_concept'
    }
    return null
  }

  const userNum = Number(userAnswer)
  if (!Number.isFinite(userNum)) return null

  if (ans.kind === 'decimal') {
    if (Math.abs(userNum - ans.value * 10) < 1e-9 || Math.abs(userNum - ans.value / 10) < 1e-9) {
      return 'place_value'
    }
    return Math.abs(userNum - ans.value) <= 0.2 ? 'careless' : null
  }
  if (ans.kind !== 'int') return null // remainder: no reliable single-number signal

  const correct = ans.value
  if (userNum === correct) return null

  // Wrong operation order on a multi-step expression.
  if (q.arity > 1) {
    const ltr = evalLeftToRight(q.display)
    if (ltr !== null && ltr !== correct && userNum === ltr) return 'order_confusion'
  }

  // ×10 / ÷10 place-value slip.
  if (userNum === correct * 10 || userNum === correct / 10) return 'place_value'

  // Forgot to carry on a single addition.
  if (q.arity === 1) {
    const ast = parseSignature(q.signature)
    if (typeof ast !== 'number' && ast.op === 'add' && typeof ast.left === 'number' && typeof ast.right === 'number') {
      if (userNum === noCarryAdd(ast.left, ast.right)) return 'carry_miss'
    }
  }

  // Small slip.
  if (Math.abs(userNum - correct) <= 2) return 'careless'

  return null
}
```

- [ ] **Step 4: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 5: Commit**
```bash
git add src/utils/type.ts src/utils/calc-diagnose.ts
git commit -m "feat(calc): add ErrorTag taxonomy + AST-aware diagnose()"
```

---

## Task 2: Migration — `user_answer` + `error_tag`

**Files:** `docs/sql/calc-phase5-error-tags-migration.sql`

- [ ] **Step 1: Write the migration**
```sql
-- Phase 5: store the child's wrong answer + a deterministic error classification.
-- Additive + backward-compatible. Run manually in Supabase.
alter table calc_mistakes
  add column if not exists user_answer text,
  add column if not exists error_tag text;
```

- [ ] **Step 2: Run it (user runs)** — in Supabase, before the Task 4/5 manual checks.

- [ ] **Step 3: Commit**
```bash
git add docs/sql/calc-phase5-error-tags-migration.sql
git commit -m "feat(calc): add calc_mistakes.user_answer + error_tag columns"
```

---

## Task 3: `useCalcMistakes` plumbing

**Files:** `src/hooks/useCalcMistakes.ts`

- [ ] **Step 1: Imports** — add `ErrorTag` to the `@/utils/type` import.

- [ ] **Step 2: `MistakeRow`** — add to the interface:
```ts
  user_answer: string | null
  error_tag: string | null
```

- [ ] **Step 3: `rowToMistake`** — add to the returned object:
```ts
    userAnswer: r.user_answer ?? undefined,
    errorTag: (r.error_tag as ErrorTag | null) ?? null,
```

- [ ] **Step 4: `addMistake` signature + writes** — change the signature to accept the answer + tag:
```ts
  const addMistake = useCallback(
    async (q: CalcQuestion, sessionNo: number, userAnswer?: string, errorTag?: ErrorTag | null) => {
```
In its Supabase upsert payload, add:
```ts
              user_answer: userAnswer ?? null,
              error_tag: errorTag ?? null,
```
In the optimistic local-insert object (and the update branch if present), include `userAnswer` and `errorTag` so local state matches.

- [ ] **Step 5: Selects** — append `,user_answer,error_tag` to BOTH `.select('...')` strings (init effect + refresh).

- [ ] **Step 6: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 7: Commit**
```bash
git add src/hooks/useCalcMistakes.ts
git commit -m "feat(calc): persist user_answer + error_tag on mistakes"
```

---

## Task 4: Thread the user answer + diagnosis through the session

**Files:** `src/app/calc/session/page.tsx`

- [x] **Step 1: Import the diagnoser** — near the other `@/utils` imports:
```ts
import { diagnose } from '@/utils/calc-diagnose'
```

- [x] **Step 2: `settleQuestion` gains a `userAnswer` param** — add `userAnswer: string` as the LAST parameter of the `settleQuestion` useCallback. In its **final-wrong branch**, the line `void addMistake(q, settings.sessionCounter + 1)` becomes:
```ts
      const errorTag = diagnose(q, userAnswer)
      void addMistake(q, settings.sessionCounter + 1, userAnswer, errorTag)
```
(No new dep needed — `diagnose` is a pure import. `addMistake` is already a dep.)

- [x] **Step 3: Pass `userAnswer` from every caller:**
  - In `handleSubmit`, BOTH `settleQuestion(...)` calls get `input` as the final arg: `settleQuestion(q, true, attemptsForCurrent === 0, elapsedMs, withinLimit, wasMistake, input)` and `settleQuestion(q, false, false, elapsedMs, withinLimit, wasMistake, input)`.
  - In `handleVerticalSubmit`, pass `''` (the vertical component grades internally; no raw string): `settleQuestion(q, isCorrect, true, elapsedMs, withinLimit, wasMistake, '')`.
  - In `handleRemainderSubmit`, pass `combined`: `settleQuestion(q, checkAnswer(combined, q.answer), true, elapsedMs, withinLimit, wasMistake, combined)`.
  - In `handleFractionSubmit`, pass `combined`: `settleQuestion(q, correct, true, elapsedMs, withinLimit, wasMistake, combined)`.

- [ ] **Step 4: Type-check + build checkpoint (user runs)** — `pnpm lint` then `pnpm build`.

- [ ] **Step 5: Manual checkpoint (user runs)** — practice and miss some questions (with the Task 2 migration run); confirm wrong answers still record mistakes and behave as before. (The tag is stored silently; it surfaces in Task 5.)

- [x] **Step 6: Commit**
```bash
git add src/app/calc/session/page.tsx
git commit -m "feat(calc): diagnose + store the user's wrong answer per mistake"
```

---

## Task 5: 「错误类型分布」 report section

**Files:** `src/app/calc/report/page.tsx`

> Adds one section to the existing report. **Invoke `frontend-design:frontend-design` first**, but match the report's EXISTING section style (the 薄弱点-style horizontal bars + `BLOCK_GROUPS` sections already in this file) — consistency over novelty.

- [x] **Step 1: Load error tags** — add a state + effect that queries `calc_mistakes` for the user and aggregates `error_tag` counts among UNRESOLVED rows:
```ts
  const [errorCounts, setErrorCounts] = useState<{ tag: ErrorTag; count: number }[]>([])
```
In the existing data-loading effect (or a new one keyed on `user`), after loading problem states, query:
```ts
      const { data: mistakeRows } = await supabase
        .from('calc_mistakes')
        .select('error_tag,resolved')
        .eq('user_id', user.id)
        .eq('resolved', false)
        .not('error_tag', 'is', null)
      const counts = new Map<ErrorTag, number>()
      for (const r of (mistakeRows ?? []) as { error_tag: ErrorTag }[]) {
        counts.set(r.error_tag, (counts.get(r.error_tag) ?? 0) + 1)
      }
      setErrorCounts([...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count))
```
Add imports: `import { ERROR_TAG_LABELS } from '@/utils/calc-diagnose'` and `import type { ErrorTag } from '@/utils/type'`.

- [x] **Step 2: Render the section** — add a new `<section>` (place it after 「最弱 10 题」, before 「最近练习」), rendered only when `errorCounts.length > 0`, matching the file's existing section heading + bar style:
```tsx
            {errorCounts.length > 0 && (
              <section>
                <h2
                  className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
                  style={{ color: 'rgba(196,181,253,0.45)' }}
                >
                  错误类型分布
                </h2>
                <div className="space-y-1.5">
                  {errorCounts.map(({ tag, count }) => {
                    const max = errorCounts[0].count
                    return (
                      <div key={tag} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-[12px]" style={{ color: '#e9d5ff' }}>
                          {ERROR_TAG_LABELS[tag]}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round((count / max) * 100)}%`,
                              background: count >= 3 ? '#f87171' : '#fbbf24',
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-[11px] font-extrabold tabular-nums" style={{ color: 'rgba(196,181,253,0.6)' }}>
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
```
(Adjust class names to exactly match the surrounding sections if they differ; the goal is visual consistency with the existing report.)

- [ ] **Step 3: Type-check + build checkpoint (user runs)** — `pnpm lint` then `pnpm build`.

- [ ] **Step 4: Manual checkpoint (user runs)** — make a few diagnosable mistakes (e.g. answer `48 + 57` as `95` → 进位遗漏; `3 + 4 × 2` as `14` → 运算顺序混淆; `2/5 + 1/5` as `3/10` → 分子分母混淆), then open `/calc/report` and confirm the 「错误类型分布」 section lists those tags with counts; the existing mastery/weakest/recent sections are unchanged.

- [x] **Step 5: Commit**
```bash
git add src/app/calc/report/page.tsx
git commit -m "feat(calc): add 错误类型分布 section to the report"
```

---

## Task 6: Final verification (user runs)

- [ ] **Step 1: Build** — `pnpm build`; expect clean.
- [ ] **Step 2: End-to-end** — verified tags: `48 + 57`→`95` = 进位遗漏; `3 + 4 × 2`→`14` = 运算顺序混淆; an answer off by ×10 = 数位理解偏差; `2/5 + 1/5`→`3/10` = 分子分母混淆; off-by-1 = 粗心. The report 错误类型分布 reflects them; proficiency/mastery sections unaffected; Phases 1–4 features still work.

---

## Self-Review

- **Spec coverage (Phase 5):** "new calc-diagnose.ts, AST-aware" → Task 1. "Extend calc_mistakes (+user_answer, +error_tag)" → Tasks 2–4. "report gains 错误类型分布" → Task 5. "Proficiency/mastery untouched" → confirmed (only `calc_mistakes` + report-read changes; no `calc_problem_state` writes). Per-block error + `calc_sessions.error_summary` deferred (flagged in Scope).
- **Diagnoser determinism:** every tag is a deterministic check (no-carry reconstruction, strict L-to-R re-eval, ×10/÷10, 分母直加, small-diff); unrecognized wrongs return null (recorded, uncategorized) rather than mislabeled — more honest than `calculate`'s catch-all `careless`.
- **Engine NOT ported:** `detectErrorTag` (needs choice distractors) and `diagnoseBlank` (heuristic) are intentionally unused — calc's AST gives certainty.
- **Placeholder scan:** Task 5's render is concrete; class names noted to match the existing report (the one judgement call, hence frontend-design). Everything else is complete code.
- **Type consistency:** `ErrorTag` (Task 1) used by `diagnose`/`ERROR_TAG_LABELS` (Task 1), `CalcMistake.errorTag` (Task 1), `addMistake(..., errorTag?: ErrorTag | null)` (Task 3), session diagnosis (Task 4), and the report (Task 5). `settleQuestion`'s new trailing `userAnswer: string` param is passed by all four callers (Task 4 Step 3). Migration adds two text columns (Task 2).
