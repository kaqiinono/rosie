# Calc Fusion — Phase 2 Implementation Plan (Vertical 竖式 Answer Mode)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let big-number questions in `/calc` free mode be answered in a column ("竖式") layout — multi-digit add/sub, 两位数×一位数, and 多位数÷一位数 — using the salvaged `VerticalCalc`/`DivisionVertical` components, gated by a default-on setting.

**Architecture:** Each `CalcQuestion` gains an optional `answerMode: 'pad' | 'vertical'`. `buildSession` tags questions from a fixed set of vertical-capable blocks as `'vertical'` when the new `verticalForBigNumbers` setting is on (and never inverts them). The session page parses the question's `signature` to get operands and renders `VerticalCalc`/`DivisionVertical` (which self-grade) instead of the number pad; their outcome flows through a shared `settleQuestion` extracted from the existing `handleSubmit`. Ported components are first wired functionally, then restyled to calc's theme via frontend-design.

**Tech Stack:** Next.js 15 (App Router, client components), TypeScript (no `any`), Tailwind v4, Supabase. **No test runner exists** — verification is `pnpm lint` + `pnpm build` + manual checks, all **run by the user** (per standing preference), surfaced as checkpoints.

---

## Scope

Phase 2 only, of spec `docs/superpowers/specs/2026-06-12-calc-calculate-fusion-design.md`. Builds on Phase 2's predecessor (`…-phase1.md`, merged).

**Decisions locked here (spec left these open):**
- **Vertical-capable blocks** = `add:1000`, `add:10000`, `sub:1000`, `sub:10000`, `mul:2d1d` (new), `div:multi`. 100以内 and table facts stay pad (they're mental math). 两位×两位 (`mul:2d`) stays pad (the component lacks two-row partial-product multiplication).
- **New block** `mul:2d1d` (两位数×一位数, e.g. `47 × 6`) is added because it's the canonical multiplication-竖式 case the component supports.
- **Toggle granularity:** a single global `verticalForBigNumbers` boolean (default **true**), not the per-block `answerModeOverrides` map the spec sketched. Simpler for one child; per-block can come later. (Deviation flagged.)
- **Attempts:** vertical questions are **single-attempt** (the component checks once and locks); the pad keeps its two-try retry.
- **Inverse interaction:** a vertical question is never turned into the Phase 1 inverse blank form.

## File Structure

- **Modify** `src/utils/calc-blocks.ts` — add `mul:2d1d` block; export `VERTICAL_BLOCK_IDS: Set<string>`.
- **Modify** `src/utils/type.ts` — `CalcQuestion.answerMode?`; `CalcSettings.verticalForBigNumbers`.
- **Modify** `src/hooks/useCalcSettings.ts` — plumb `vertical_for_big_numbers` (default true).
- **Create** `docs/sql/calc-phase2-vertical-migration.sql` — add the column.
- **Modify** `src/utils/calc-helpers.ts` — tag vertical questions in `buildSession`; skip them in the inverse pass.
- **Create** `src/components/calc/VerticalCalc.tsx`, `src/components/calc/DivisionVertical.tsx` — ports.
- **Modify** `src/app/calc/session/page.tsx` — extract `settleQuestion`; add `handleVerticalSubmit`; dispatch vertical UI.
- **Modify** `src/app/calc/settings/page.tsx` — add the toggle to the existing 题型选项 section.

---

## Task 1: Block config — new `mul:2d1d` block + vertical-capable set

**Files:**
- Modify: `src/utils/calc-blocks.ts`

- [ ] **Step 1: Add the 两位数×一位数 block**

In `src/utils/calc-blocks.ts`, in the `BLOCKS` array, insert this line IMMEDIATELY BEFORE the existing line `mulBlock('mul:2d', '两位数×两位数', mulBoth(11, 99)),`:

```ts
  mulBlock('mul:2d1d', '两位数×一位数', () => [randInt(11, 99), randInt(2, 9)]),
```

(`randInt` is already imported at the top of the file. The fixed `[two-digit, one-digit]` order matters: `VerticalCalc` multiplies the first operand by the single-digit second operand.)

- [ ] **Step 2: Export the vertical-capable id set**

At the END of `src/utils/calc-blocks.ts` (after the existing `BLOCK_GROUPS` export), add:

```ts
/** Block ids whose questions can be answered in a column ("竖式") layout.
 *  add/sub: multi-digit; mul: two-digit × one-digit; div: multi-digit ÷ one-digit. */
export const VERTICAL_BLOCK_IDS = new Set<string>([
  'add:1000', 'add:10000',
  'sub:1000', 'sub:10000',
  'mul:2d1d',
  'div:multi',
])
```

- [ ] **Step 3: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/calc-blocks.ts
git commit -m "feat(calc): add 两位数×一位数 block + VERTICAL_BLOCK_IDS set"
```

---

## Task 2: Types + setting + migration

**Files:**
- Modify: `src/utils/type.ts`
- Modify: `src/hooks/useCalcSettings.ts`
- Create: `docs/sql/calc-phase2-vertical-migration.sql`

- [ ] **Step 1: Add `answerMode` to `CalcQuestion`**

In `src/utils/type.ts`, inside `interface CalcQuestion`, add after the `sourceMixedOpId?: string` line (before the closing `}`):

```ts
  /** How this question is answered. Absent/'pad' = number pad; 'vertical' = column (竖式) layout. */
  answerMode?: 'pad' | 'vertical'
```

- [ ] **Step 2: Add `verticalForBigNumbers` to `CalcSettings`**

In `interface CalcSettings`, add after the `includeInverse: boolean` line:

```ts
  /** When true, questions from vertical-capable blocks are answered in 竖式 layout. */
  verticalForBigNumbers: boolean
```

- [ ] **Step 3: Plumb it through `useCalcSettings.ts`**

(a) In `DEFAULT_SETTINGS`, add after `includeInverse: false,`:
```ts
    verticalForBigNumbers: true,
```

(b) In `interface RawRow`, add after `include_inverse: boolean | null`:
```ts
  vertical_for_big_numbers: boolean | null
```

(c) In `rowToSettings`, add after `includeInverse: row.include_inverse ?? false,`:
```ts
    verticalForBigNumbers: row.vertical_for_big_numbers ?? true,
```

(d) In `settingsToRow`, add after `include_inverse: s.includeInverse,`:
```ts
    vertical_for_big_numbers: s.verticalForBigNumbers,
```

(e) In the `.select('...')` string in the `init` effect, append `,vertical_for_big_numbers` so it ends with `...,include_inverse,vertical_for_big_numbers`.

- [ ] **Step 4: Create the migration**

Create `docs/sql/calc-phase2-vertical-migration.sql`:

```sql
-- Phase 2: vertical (竖式) answer mode for big-number blocks.
-- Additive, backward-compatible, default ON. Run manually in Supabase.
alter table calc_settings
  add column if not exists vertical_for_big_numbers boolean not null default true;
```

- [ ] **Step 5: Run the migration (user runs)** — run the SQL above in Supabase before the manual checks in later tasks.

- [ ] **Step 6: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors (both `DEFAULT_SETTINGS` and `rowToSettings` supply the new required field, so `CalcSettings` stays complete).

- [ ] **Step 7: Commit**

```bash
git add src/utils/type.ts src/hooks/useCalcSettings.ts docs/sql/calc-phase2-vertical-migration.sql
git commit -m "feat(calc): add answerMode + verticalForBigNumbers setting + migration"
```

---

## Task 3: Tag vertical questions in `buildSession`

**Files:**
- Modify: `src/utils/calc-helpers.ts`

- [ ] **Step 1: Import the id set**

At the top of `src/utils/calc-helpers.ts`, change the existing import from `./calc-blocks` to also bring in `VERTICAL_BLOCK_IDS`. The current import is:

```ts
import { BLOCKS, blockById, type CalcBlock } from './calc-blocks'
```

Change it to:

```ts
import { BLOCKS, blockById, VERTICAL_BLOCK_IDS, type CalcBlock } from './calc-blocks'
```

- [ ] **Step 2: Tag vertical questions, BEFORE the inverse pass**

In `buildSession`, immediately AFTER the Step-4 `sources.forEach(...)` generation block and BEFORE the `// 4.5` inverse comment, insert:

```ts
  // 4.4 Tag questions from vertical-capable blocks so the session renders a 竖式 layout.
  if (settings.verticalForBigNumbers) {
    for (let i = 0; i < out.length; i++) {
      const q = out[i]
      if (q.sourceBlockId && VERTICAL_BLOCK_IDS.has(q.sourceBlockId)) {
        out[i] = { ...q, answerMode: 'vertical' }
      }
    }
  }
```

- [ ] **Step 3: Keep the inverse pass off vertical questions**

The Phase-1 inverse pass (the `// 4.5` block) currently reads:

```ts
      if (q.sourceBlockId && q.arity === 1 && Math.random() < 0.3) {
```

Change that condition to also exclude vertical questions:

```ts
      if (q.sourceBlockId && q.arity === 1 && q.answerMode !== 'vertical' && Math.random() < 0.3) {
```

- [ ] **Step 4: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors.

- [ ] **Step 5: Commit**

```bash
git add src/utils/calc-helpers.ts
git commit -m "feat(calc): tag vertical-capable questions in buildSession"
```

---

## Task 4: Port `VerticalCalc` and `DivisionVertical` into components/calc

**Files:**
- Create: `src/components/calc/VerticalCalc.tsx`
- Create: `src/components/calc/DivisionVertical.tsx`

> Functional port only — copy the existing components verbatim. Restyling to calc's theme happens in Task 7.

- [ ] **Step 1: Copy `VerticalCalc`**

Copy `src/components/calculate/VerticalCalc.tsx` to `src/components/calc/VerticalCalc.tsx` with identical contents (it is self-contained: only imports `clsx` and React hooks; props `{ a, b, op, onSubmit, disabled }`, `onSubmit` receives `{ correct, carryCorrect, resultCorrect, userCarries, userResult }`).

```bash
cp src/components/calculate/VerticalCalc.tsx src/components/calc/VerticalCalc.tsx
```

- [ ] **Step 2: Copy `DivisionVertical`**

```bash
cp src/components/calculate/DivisionVertical.tsx src/components/calc/DivisionVertical.tsx
```

(Self-contained; props `{ dividend, divisor, onSubmit, disabled }`, `onSubmit` receives `{ correct, quotient, remainder }`.)

- [ ] **Step 3: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors (these are copies of already-compiling files; the originals still exist and are untouched).

- [ ] **Step 4: Commit**

```bash
git add src/components/calc/VerticalCalc.tsx src/components/calc/DivisionVertical.tsx
git commit -m "chore(calc): port VerticalCalc + DivisionVertical into components/calc"
```

---

## Task 5: Extract `settleQuestion` in the session (pure refactor)

**Files:**
- Modify: `src/app/calc/session/page.tsx`

> This refactor must NOT change pad behavior. It pulls the "correct" and "final-wrong" bookkeeping out of `handleSubmit` into a shared `settleQuestion`, so a single-attempt vertical path can reuse it in Task 6.

- [ ] **Step 1: Add `settleQuestion` above `handleSubmit`**

In `src/app/calc/session/page.tsx`, immediately BEFORE the existing `const handleSubmit = useCallback(() => {` declaration, insert this new callback:

```ts
  // Shared outcome bookkeeping for a settled question (correct, or final-wrong with
  // no further retry). Updates streak/coins/log/mistakes/feedback and schedules advance.
  const settleQuestion = useCallback(
    (
      q: CalcQuestion,
      isCorrect: boolean,
      isFirstTry: boolean,
      elapsedMs: number,
      withinLimit: boolean,
      wasMistake: boolean,
    ) => {
      const goNext = () => {
        setFeedback(null)
        setInput('')
        setAttemptsForCurrent(0)
        setLastResult(null)
        setRevealAnswer(null)
        if (!questions) return
        if (idx + 1 < questions.length) {
          setIdx((i) => i + 1)
          return
        }
        if (wrongQueueRef.current.length > 0) {
          const drained = wrongQueueRef.current
          wrongQueueRef.current = []
          setQuestions((prev) => (prev ? [...prev, ...drained] : prev))
          setIdx((i) => i + 1)
          return
        }
        void finishSession()
      }

      if (isCorrect) {
        const reward = isFirstTry ? coinReward(q, streak) : 0
        const isChallengeCorrect = q.isChallenge && isFirstTry
        const bonus = isFirstTry ? (streak >= 10 ? 2 : streak >= 5 ? 1 : 0) : 0
        if (isFirstTry && reward > 0) setLastResult({ stars: reward, bonus })
        setFeedback(isChallengeCorrect ? 'challenge-correct' : 'correct')
        playSfx(isChallengeCorrect ? 'streak' : 'correct', settings.soundEnabled)
        if (reward > 0) playSfx('coin', settings.soundEnabled)
        if (isChallengeCorrect) launchConfetti(20)
        coinsTotalRef.current += reward
        setCoinsTotal((c) => c + reward)
        const nextStreak = isFirstTry ? streak + 1 : 0
        setStreak(nextStreak)
        if (nextStreak > maxStreakRef.current) {
          maxStreakRef.current = nextStreak
          setMaxStreak(nextStreak)
        }
        attemptsLogRef.current.push({
          signature: q.signature,
          level: q.level,
          isChallenge: q.isChallenge,
          firstTryCorrect: isFirstTry,
          finallyCorrect: true,
          wasMistake,
          timeMs: elapsedMs,
          withinLimit: isFirstTry ? withinLimit : false,
          sourceBlockId: q.sourceBlockId,
          sourceMixedOpId: q.sourceMixedOpId,
        })
        if (wasMistake) void recordCorrect(q.signature, settings.sessionCounter + 1)
        window.setTimeout(goNext, isChallengeCorrect ? 1100 : 750)
        return
      }

      // final wrong
      setFeedback('wrong')
      setRevealAnswer(q.answer)
      setStreak(0)
      playSfx('wrong', settings.soundEnabled)
      void addMistake(q, settings.sessionCounter + 1)
      attemptsLogRef.current.push({
        signature: q.signature,
        level: q.level,
        isChallenge: q.isChallenge,
        firstTryCorrect: false,
        finallyCorrect: false,
        wasMistake,
        timeMs: elapsedMs,
        withinLimit: false,
        sourceBlockId: q.sourceBlockId,
        sourceMixedOpId: q.sourceMixedOpId,
        display: q.display.replace(/\s*=\s*\?\s*$/, ''),
      })
      if (!q.isChallenge && mode !== 'mistakes') wrongQueueRef.current.push({ ...q })
      window.setTimeout(goNext, 1700)
    },
    [
      questions,
      idx,
      streak,
      mode,
      settings.soundEnabled,
      settings.sessionCounter,
      addMistake,
      recordCorrect,
      finishSession,
    ],
  )
```

- [ ] **Step 2: Replace `handleSubmit`'s body to delegate to `settleQuestion`**

Replace the ENTIRE existing `const handleSubmit = useCallback(() => { ... }, [ ... ])` block with:

```ts
  const handleSubmit = useCallback(() => {
    if (!questions || done || feedback) return
    const q = questions[idx]
    const userAns = Number(input)
    if (!Number.isFinite(userAns)) return

    const isCorrect = userAns === q.answer
    const wasMistake = mistakes.some((m) => !m.resolved && m.signature === q.signature)

    const elapsedMs = Math.round(performance.now() - questionStartRef.current)
    const limitMs = timeLimitFromSettings(q.level, settings)
    const withinLimit = limitMs > 0 ? elapsedMs <= limitMs : true
    if (attemptsForCurrent === 0) questionTimesRef.current.push(elapsedMs)

    if (isCorrect) {
      settleQuestion(q, true, attemptsForCurrent === 0, elapsedMs, withinLimit, wasMistake)
      return
    }

    // wrong: first miss → retry; second miss → settle as final wrong.
    if (attemptsForCurrent === 0) {
      setFeedback('retry')
      setStreak(0)
      playSfx('retry', settings.soundEnabled)
      window.setTimeout(() => {
        setFeedback(null)
        setInput('')
        setAttemptsForCurrent(1)
      }, 700)
    } else {
      settleQuestion(q, false, false, elapsedMs, withinLimit, wasMistake)
    }
  }, [
    questions,
    done,
    feedback,
    idx,
    input,
    attemptsForCurrent,
    mistakes,
    settings,
    settleQuestion,
  ])
```

- [ ] **Step 3: Type-check checkpoint (user runs)** — `pnpm lint`; expect no errors. Confirm there are no "unused variable" warnings (every state setter referenced still exists).

- [ ] **Step 4: Manual regression checkpoint (user runs)**

Ask the user to practice a normal pad session and confirm UNCHANGED behavior: correct → coins/streak/✓ and advance; first wrong → 「🤔 再想想～」 then retry; second wrong → reveals answer, records a mistake, makes it up at the tail. (This task is a pure refactor; nothing should visibly change.)

- [ ] **Step 5: Commit**

```bash
git add src/app/calc/session/page.tsx
git commit -m "refactor(calc): extract settleQuestion from handleSubmit (no behavior change)"
```

---

## Task 6: Dispatch the vertical UI in the session

**Files:**
- Modify: `src/app/calc/session/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/app/calc/session/page.tsx`, add with the other component imports:

```ts
import VerticalCalc from '@/components/calc/VerticalCalc'
import DivisionVertical from '@/components/calc/DivisionVertical'
```

And add `parseSignature` to the existing `calc-ast` usage — there is currently no import from `calc-ast` in this file, so add a new import line near the other `@/utils` imports:

```ts
import { parseSignature } from '@/utils/calc-ast'
```

- [ ] **Step 2: Add the vertical submit handler**

Immediately AFTER the `settleQuestion` callback (added in Task 5) and before `handleSubmit`, insert:

```ts
  // Single-attempt grading for vertical (竖式) questions: the component self-checks
  // and locks, so there is no two-try retry — settle directly on first submit.
  const handleVerticalSubmit = useCallback(
    (isCorrect: boolean) => {
      if (!questions || done || feedback) return
      const q = questions[idx]
      const wasMistake = mistakes.some((m) => !m.resolved && m.signature === q.signature)
      const elapsedMs = Math.round(performance.now() - questionStartRef.current)
      const limitMs = timeLimitFromSettings(q.level, settings)
      const withinLimit = limitMs > 0 ? elapsedMs <= limitMs : true
      questionTimesRef.current.push(elapsedMs)
      settleQuestion(q, isCorrect, true, elapsedMs, withinLimit, wasMistake)
    },
    [questions, done, feedback, idx, mistakes, settings, settleQuestion],
  )
```

- [ ] **Step 3: Branch the answer area on `answerMode`**

In the JSX, find the answer area — the `{/* Input */}` box (`<div className="mx-auto mb-4 flex h-16 ...">`) followed by the `{/* Pad */}` block (`<div className="mx-auto max-w-[320px]"> <NumberPad ... /> </div>`). Wrap BOTH of those in a conditional so they only render for the pad mode, and render the vertical components otherwise. Replace the two blocks (the Input box div and the Pad div) with:

```tsx
        {currentQ.answerMode === 'vertical' ? (
          (() => {
            const ast = parseSignature(currentQ.signature)
            if (typeof ast === 'number' || typeof ast.left !== 'number' || typeof ast.right !== 'number') {
              return null
            }
            const disabled = !!feedback || done
            if (ast.op === 'div') {
              return (
                <DivisionVertical
                  key={idx}
                  dividend={ast.left}
                  divisor={ast.right}
                  disabled={disabled}
                  onSubmit={(r) => handleVerticalSubmit(r.correct)}
                />
              )
            }
            const opSym = ast.op === 'add' ? '+' : ast.op === 'sub' ? '-' : '×'
            return (
              <VerticalCalc
                key={idx}
                a={ast.left}
                b={ast.right}
                op={opSym}
                disabled={disabled}
                onSubmit={(r) => handleVerticalSubmit(r.resultCorrect)}
              />
            )
          })()
        ) : (
          <>
            {/* Input */}
            <div
              className="mx-auto mb-4 flex h-16 max-w-[260px] items-center justify-center rounded-2xl transition-all duration-200"
              style={{
                background: 'rgba(139,92,246,0.08)',
                border: `1.5px solid ${input ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.2)'}`,
                boxShadow: input ? '0 0 14px rgba(139,92,246,0.15)' : 'none',
              }}
            >
              <span
                className="font-fredoka leading-none font-black tabular-nums"
                style={{
                  fontSize: 'clamp(28px, 6vw, 38px)',
                  color: input ? '#e9d5ff' : 'rgba(196,181,253,0.25)',
                }}
              >
                {input || '·'}
              </span>
            </div>

            {/* Pad */}
            <div className="mx-auto max-w-[320px]">
              <NumberPad
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                disabled={!!feedback || done}
              />
            </div>
          </>
        )}
```

(The `key={idx}` remounts the vertical component for each question so its internal state resets. For division, `r.correct` is the graded result; for add/sub/mul, `r.resultCorrect` grades the answer digits without forcing the carry row.)

- [ ] **Step 4: Type-check checkpoint (user runs)** — `pnpm lint` then `pnpm build`; expect no errors.

- [ ] **Step 5: Manual checkpoint (user runs)**

Ask the user (with `vertical_for_big_numbers` on and the Phase 1 + Phase 2 migrations run): select 加法「1000 以内」/「万以内」, 「两位数×一位数」, 除「多位数÷一位数」, and practice. Confirm:
1. Those questions render a column layout with their own digit pad + 检查, not the standard number pad.
2. A correct vertical answer awards coins and advances; a wrong one reveals (component shows red/green cells) and is recorded as a mistake.
3. 100以内 / table-fact / 两位×两位 questions still use the normal number pad.

- [ ] **Step 6: Commit**

```bash
git add src/app/calc/session/page.tsx
git commit -m "feat(calc): render vertical 竖式 input for big-number questions"
```

---

## Task 7: Settings toggle + restyle ported components to calc theme

**Files:**
- Modify: `src/app/calc/settings/page.tsx`
- Modify: `src/components/calc/VerticalCalc.tsx`, `src/components/calc/DivisionVertical.tsx`

- [ ] **Step 1: Add the settings toggle**

In `src/app/calc/settings/page.tsx`, inside the existing `{/* 题型选项 */}` section (added in Phase 1, currently containing the 「包含逆运算（挖空）」 `ToggleRow`), add a SECOND `ToggleRow` right after the inverse one:

```tsx
          <ToggleRow
            label="大数题用竖式作答"
            description="1000以内 / 万以内加减、两位数×一位数、多位数÷一位数 用竖式格子作答"
            value={settings.verticalForBigNumbers}
            onChange={(v) => update({ verticalForBigNumbers: v })}
          />
```

- [ ] **Step 2: Type-check + manual toggle checkpoint (user runs)** — `pnpm lint`; then in-app confirm the new toggle appears, persists across reload, and that turning it OFF makes the big-number blocks fall back to the number pad.

- [ ] **Step 3: Commit the toggle**

```bash
git add src/app/calc/settings/page.tsx
git commit -m "feat(calc): settings toggle for vertical 竖式 answer mode"
```

- [ ] **Step 4: Restyle the ported components (USE frontend-design)**

**Invoke the `frontend-design:frontend-design` skill** before editing. The two ported components (`src/components/calc/VerticalCalc.tsx`, `src/components/calc/DivisionVertical.tsx`) currently use `calculate`'s light/blue palette (white number buttons, `bg-white/[0.06]`, blue active/`检查`). Restyle them to match `/calc`'s dark, playful, 7-year-old aesthetic, consistent with the existing `src/components/calc/NumberPad.tsx` and `QuestionDisplay.tsx`. Token guidance (match what those files already use):
- Panel background `rgba(255,255,255,0.03)`–`0.05`, borders `rgba(255,255,255,0.08)` / active `rgba(139,92,246,0.4)`.
- Text `#f5f3ff` / `#e9d5ff`; muted `rgba(196,181,253,0.4)`.
- Active cell purple (`rgba(139,92,246,0.2)` bg, `#c4b5fd` text); correct `#4ade80`; wrong `#f87171`.
- Digit keys styled like calc's `NumberPad` keys (rounded-2xl, `rgba(255,255,255,0.05)`, `#f5f3ff`); the 检查 / submit key in calc's green gradient (`linear-gradient(135deg,#059669,#10b981)`).
- Keep all logic, props, and `onSubmit` shapes unchanged — visual only. Keep gentle/playful feedback (no harsh red ✗).

Commit:
```bash
git add src/components/calc/VerticalCalc.tsx src/components/calc/DivisionVertical.tsx
git commit -m "style(calc): restyle vertical components to calc theme"
```

- [ ] **Step 5: Final manual checkpoint (user runs)** — `pnpm build`; then confirm the vertical components look at home in `/calc` (dark/purple), behave correctly, and that the whole Phase 2 flow works end to end.

---

## Self-Review

- **Spec coverage (Phase 2):** "港 VerticalCalc + DivisionVertical → components/calc" → Task 4. "answerMode on questions; multi-digit add/sub/mul/div default to vertical" → Task 1 (`VERTICAL_BLOCK_IDS`) + Task 2 (`answerMode`) + Task 3 (tagging). "/calc/session gains an answer-mode dispatch" → Tasks 5–6. Settings control → Task 7. Restyle to calc theme → Task 7 Step 4.
- **Deviations flagged:** (1) global `verticalForBigNumbers` toggle instead of per-block `answerModeOverrides`; (2) 两位×两位 (`mul:2d`) stays pad — only the new 两位×一位 (`mul:2d1d`) is vertical, because the ported component lacks two-row partial-product multiplication; (3) vertical questions are single-attempt. Each is justified inline.
- **Placeholder scan:** none — every code step shows complete code; every verification step is an exact command/manual check.
- **Type consistency:** `answerMode?: 'pad' | 'vertical'` defined in Task 2, written in Task 3 (`buildSession`), read in Task 6 (dispatch). `verticalForBigNumbers` defined in Task 2, read in Task 3 + Task 7. `VERTICAL_BLOCK_IDS` defined Task 1, consumed Task 3. `settleQuestion(q, isCorrect, isFirstTry, elapsedMs, withinLimit, wasMistake)` defined in Task 5 and called in Task 5 (`handleSubmit`) and Task 6 (`handleVerticalSubmit`) with the same arg order. `VerticalCalc` props `{a,b,op,onSubmit,disabled}` and `DivisionVertical` props `{dividend,divisor,onSubmit,disabled}` match the ported files; `onSubmit` payloads (`resultCorrect` / `correct`) match what Task 6 reads.
- **Migration:** one additive `calc_settings` column (`vertical_for_big_numbers`, default true), Task 2.
