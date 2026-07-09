# Calc NumberPad auto-submit on match — design

**Date:** 2026-07-09  
**Package:** `@rosie/calc`  
**Status:** Approved for planning  
**Related:** Session timing modes (`2026-07-09-calc-session-timing-modes-design.md`); answer grading via `checkAnswer` / `formatAnswer`

## Goal

Speed up mental-arithmetic practice: when the child uses the **NumberPad** and the typed value already fully matches the correct answer, settle as correct and advance **without** requiring an explicit confirm tap. Wrong or incomplete input still waits for confirm.

## Approach

**Session-level watch on NumberPad input (recommended):** after each input change, if auto-submit is enabled and the current question is NumberPad-graded, and the input length has reached the canonical answer string length and `checkAnswer` passes → invoke the same success path as manual confirm. Keep grading logic in `checkAnswer`; do not push answer knowledge into `NumberPad`.

Rejected: NumberPad-owned auto-submit (couples pad to answers); changing Enter-key semantics only (does not remove the confirm requirement).

## Behavior

**In scope:** integer and decimal questions answered via `NumberPad` only.

**Out of scope this pass:** vertical calc, remainder pad, fraction pad / pie, any auto-fail on mismatch.

**Trigger (option B):**
1. Setting `autoSubmitOnMatch === true` (default **true**).
2. Current question uses NumberPad (not vertical / rem / frac).
3. After trim, `input.length >= formatAnswer(q.answer).length`.
4. `checkAnswer(input, q.answer) === true`.
5. Not already in feedback / transitioning to next question.

Then: run the existing **correct** settlement (elapsed ms, `withinLimit`, coins/streak, advance) — identical to tapping confirm on a correct answer.

**Mismatch or too short:** no auto action; user may still tap confirm (existing wrong / soft-retry / makeup rules apply).

**Other modes:**
- Immersive: auto-advance on match the same way (no feedback chrome).
- Strict/bonus timeout: existing auto-advance-as-wrong still wins if the clock hits 0 first.
- Soft-retry after a main-path first miss: auto-submit on match still allowed on the second attempt when input becomes correct.

## Settings + schema

- `CalcSettings.autoSubmitOnMatch: boolean`, default `true`.
- Incremental SQL only:

```sql
ALTER TABLE calc_settings
  ADD COLUMN IF NOT EXISTS auto_submit_on_match boolean NOT NULL DEFAULT true;
```

- Settings UI toggle:「数字键盘答对即过」— subtitle: 输入已与正确答案完全一致时无需点确认，直接进入下一题；答错仍需确认。
- Mirror under `packages/calc/sql/` if `docs/sql/` remains gitignored (same pattern as timing-modes).

## Implementation hint

| Area | Likely files |
|------|----------------|
| Gate + trigger | `packages/calc/src/pages/session.tsx` (or thin helper + call from `onInputChange`) |
| Optional pure helper | `packages/calc/src/utils/calc-answer.ts` e.g. `shouldAutoSubmitNumberPad(input, answer)` |
| Settings | `@rosie/core` `CalcSettings`; `useCalcSettings.ts`; `settings.tsx` |
| Docs | short FAQ / CLAUDE note |

**Race guard:** ignore auto-submit while `feedback != null` or while a settle is in flight (ref flag), so double settlement cannot occur.

## Success criteria

1. NumberPad correct full-length match advances without confirm when setting on.
2. Incomplete prefix (e.g. answer `12`, typed `1`) never auto-submits.
3. Wrong full-length input does not auto-fail; confirm still required.
4. Vertical / rem / frac unchanged.
5. Setting defaults on; can be turned off and persists.
6. `pnpm --filter @rosie/calc typecheck` passes.
