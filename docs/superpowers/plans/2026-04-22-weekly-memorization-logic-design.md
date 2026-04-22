# Weekly Memorization Logic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the English weekly-plan session so required words (`consolidate`) and preview words (`preview`) are classified and treated differently; remove the 9-word cap; fix `recordBatch`'s multi-type stage over-advancement; desynchronize SRS `nextReviewDate` with a hash-based jitter; and add unfinished-word carryover between weeks. See spec: `docs/superpowers/specs/2026-04-22-weekly-memorization-logic-design.md`.

**Architecture:** Pure-function work lives in `src/utils/english-helpers.ts` and `src/utils/masteryUtils.ts` (classification, daily word selection, hash offset, `advanceStage(key)`). Hooks (`useWordMastery`, `useProblemMastery`) aggregate per-session results so a word advances at most once per session/day. UI work in `WeeklyPlanSession.tsx` swaps the single `enabledTypes` set for two independent sets (`consolidateTypes` / `previewTypes`), changes day-card labels to `必记 N · 预习 M`, adds a weekly progress bar + Sunday fallback banner, and groups the selected-day word list by kind. `WeeklyPractice.tsx` gets the `excludeWeekPlans` wiring and a carryover prefill at the arrange step.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase. No test suite — verification is `pnpm lint` + `pnpm build`, plus the per-task manual smoke checks described below.

---

## File Structure

**Modify:**
- `src/utils/masteryUtils.ts` — add `hashOffset`; extend `advanceStage` signature with `wordKey`
- `src/utils/english-helpers.ts` — add `classifyPlanWords`, `getDailySessionWords`, extended `getOldReviewWords(... excludeWeekPlans)`; remove `getReviewWordsForDay`
- `src/hooks/useWordMastery.ts` — `recordBatch` aggregates by word, single stage change per word per session + same-day guard
- `src/hooks/useProblemMastery.ts` — `recordProblemResult` same-day guard + pass `key` to `advanceStage`
- `src/components/english/words/WeeklyPractice.tsx` — pass `excludeWeekPlans` to `getOldReviewWords`; carryover unfinished `consolidate` words into `unassignedKeys` on new plan arrange
- `src/components/english/words/WeeklyPlanSession.tsx` — swap `enabledTypes` → `consolidateTypes` + `previewTypes`; rewrite `buildSessionWords` to call `getDailySessionWords`; update `SessionSnapshot` (version bump); add day-card `必记 N · 预习 M` label; add weekly progress bar; Sunday red banner; grouped detail list; two-row type selector UI

**No changes needed:**
- `OldReviewSession.tsx` — benefits automatically from the fixed `recordBatch` in `useWordMastery`
- Supabase schema — unchanged per spec §4

---

### Task 1: Add `hashOffset` helper and extend `advanceStage` with `wordKey`

**Files:**
- Modify: `src/utils/masteryUtils.ts`

Ebbinghaus `nextReviewDate` is currently deterministic on `(today, stage)`, so the N words all completed together today get the exact same `nextReviewDate`, clustering into a single future "exploding" day. Spec §3.9 adds a `wordKey`-based stable offset in `{0, 1, 2}` days.

- [ ] **Step 1: Implement `hashOffset` and extend `advanceStage`**

In `src/utils/masteryUtils.ts`, add `hashOffset` just below the existing `addDays` helper, and update `advanceStage`. Full edited section:

```ts
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Stable integer hash in [0, mod). Used to desynchronize SRS nextReviewDate
 * so a batch of words advanced the same day don't all come due on the same
 * future day.
 */
export function hashOffset(key: string, mod: number = 3): number {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0
  }
  return Math.abs(h) % mod
}

export function ensureStageInit(info: WordMasteryInfo, today: string): WordMasteryInfo {
  if (info.stage !== undefined) return info
  const correct = info.correct ?? 0
  const incorrect = info.incorrect ?? 0
  const stage = correct >= 5 ? 3 : correct >= 3 ? 2 : correct >= 1 ? 1 : 0
  const isHard = incorrect >= 2 || incorrect > correct
  const intervals = isHard ? HARD_INTERVALS : NORMAL_INTERVALS
  const baseDate = info.lastSeen || today
  return {
    ...info,
    stage,
    isHard,
    nextReviewDate: addDays(baseDate, intervals[stage] ?? 1),
  }
}

export function advanceStage(
  info: WordMasteryInfo,
  today: string,
  wordKey?: string,
): WordMasteryInfo {
  const initialized = ensureStageInit(info, today)
  const intervals = initialized.isHard ? HARD_INTERVALS : NORMAL_INTERVALS
  const maxStage = initialized.isHard ? GRADUATED_STAGE_HARD : GRADUATED_STAGE_NORMAL
  const newStage = Math.min((initialized.stage ?? 0) + 1, maxStage)
  const offset = wordKey ? hashOffset(wordKey, 3) : 0
  return {
    ...initialized,
    stage: newStage,
    nextReviewDate:
      newStage >= maxStage ? undefined : addDays(today, (intervals[newStage] ?? 90) + offset),
  }
}
```

`wordKey` is optional to keep the function backward-compatible for any manual caller, but every production call site will be updated in Tasks 5 and 6 to pass it.

- [ ] **Step 2: Lint + build**

```bash
pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/utils/masteryUtils.ts
git commit -m "feat(mastery): add hashOffset jitter to advanceStage nextReviewDate"
```

---

### Task 2: Add `classifyPlanWords`

**Files:**
- Modify: `src/utils/english-helpers.ts`

Classifies every word referenced by a plan as either `'consolidate'` (must-memorize, reinforce to stage ≥ 2 this week) or `'preview'` (first-touch, becomes next week's consolidate). The latest lesson in vocab order is the preview lesson.

**Rules** (spec §3.1):
- Plan spans only 1 lesson → all words are `consolidate` (集中突破周)
- Plan spans ≥ 2 lessons → words in the latest lesson (by `getOrderedLessons(vocab)` order) are `preview`; everything else is `consolidate`
- Keys that no longer exist in vocab are silently skipped

- [ ] **Step 1: Implement `classifyPlanWords`**

In `src/utils/english-helpers.ts`, add this function directly below `getOrderedLessons` (around line 430):

```ts
/**
 * Classify every word referenced by a plan as consolidate (must-memorize this week)
 * or preview (first-touch, next week's consolidate).
 *
 * Rule: find the (unit, lesson) pairs covered by the plan, pick the one that appears
 * latest in `getOrderedLessons(vocab)`, and mark its words as 'preview'. All others
 * are 'consolidate'. A single-lesson plan has no preview words.
 */
export function classifyPlanWords(
  plan: WeeklyPlan,
  vocab: WordEntry[],
): Map<string, 'consolidate' | 'preview'> {
  const result = new Map<string, 'consolidate' | 'preview'>()

  const planKeys = new Set<string>()
  for (const day of plan.days) for (const k of day.newWordKeys) planKeys.add(k)
  if (planKeys.size === 0) return result

  const keyToEntry = new Map<string, WordEntry>()
  for (const w of vocab) keyToEntry.set(wordKey(w), w)

  const lessonsInPlan = new Set<string>()
  for (const k of planKeys) {
    const entry = keyToEntry.get(k)
    if (entry) lessonsInPlan.add(`${entry.unit}::${entry.lesson}`)
  }

  const ordered = getOrderedLessons(vocab)
  let previewLessonKey: string | null = null
  if (lessonsInPlan.size >= 2) {
    for (let i = ordered.length - 1; i >= 0; i--) {
      const key = `${ordered[i].unit}::${ordered[i].lesson}`
      if (lessonsInPlan.has(key)) {
        previewLessonKey = key
        break
      }
    }
  }

  for (const k of planKeys) {
    const entry = keyToEntry.get(k)
    if (!entry) continue
    const lk = `${entry.unit}::${entry.lesson}`
    result.set(k, lk === previewLessonKey ? 'preview' : 'consolidate')
  }
  return result
}
```

- [ ] **Step 2: Lint + build**

```bash
pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/utils/english-helpers.ts
git commit -m "feat(english): add classifyPlanWords consolidate/preview classifier"
```

---

### Task 3: Add `getDailySessionWords`

**Files:**
- Modify: `src/utils/english-helpers.ts`

Replaces the old `getReviewWordsForDay` for the weekly session. Returns every word introduced from day 0 through `dayIndex` (no 9-cap, no old-review mixing), tagged with classification and sorted: unfinished-consolidate → finished-consolidate → preview.

**Sort key rules** (spec §3.2):
1. consolidate & not yet met (stage < 2): `stage asc, correct asc, incorrect desc`
2. consolidate & met (stage >= 2): original plan insertion order
3. preview: original plan insertion order

- [ ] **Step 1: Add the `DailySessionWord` interface**

In `src/utils/english-helpers.ts`, add this exported interface next to `QuizQuestion` (around line 150):

```ts
export interface DailySessionWord {
  entry: WordEntry
  kind: 'consolidate' | 'preview'
  /** true iff this is a consolidate word whose mastery stage >= 2 */
  met: boolean
}
```

- [ ] **Step 2: Implement `getDailySessionWords`**

Add the function directly after `classifyPlanWords`:

```ts
/**
 * Returns every word introduced in plan.days[0..dayIndex] (union), tagged with
 * consolidate/preview classification and sorted:
 *   1. consolidate & not yet met (stage < 2): stage asc, correct asc, incorrect desc
 *   2. consolidate & met (stage >= 2)
 *   3. preview (plan insertion order)
 *
 * No 9-cap, no old-review mixing. See spec §3.2.
 */
export function getDailySessionWords(
  plan: WeeklyPlan,
  vocab: WordEntry[],
  masteryMap: WordMasteryMap,
  dayIndex: number,
): DailySessionWord[] {
  if (dayIndex < 0 || dayIndex >= plan.days.length) return []
  const cls = classifyPlanWords(plan, vocab)

  const seen = new Set<string>()
  const introducedOrder: string[] = []
  for (let i = 0; i <= dayIndex; i++) {
    for (const k of plan.days[i].newWordKeys) {
      if (!seen.has(k)) {
        seen.add(k)
        introducedOrder.push(k)
      }
    }
  }

  const keyToEntry = new Map<string, WordEntry>()
  for (const w of vocab) keyToEntry.set(wordKey(w), w)

  type Bucket = DailySessionWord & { order: number }
  const consolidateUnmet: Bucket[] = []
  const consolidateMet: Bucket[] = []
  const preview: Bucket[] = []

  introducedOrder.forEach((k, order) => {
    const entry = keyToEntry.get(k)
    if (!entry) return
    const kind = cls.get(k) ?? 'consolidate'
    const m = masteryMap[k]
    const stage = m?.stage ?? 0
    const met = stage >= 2
    const item: Bucket = { entry, kind, met, order }
    if (kind === 'preview') preview.push(item)
    else if (met) consolidateMet.push(item)
    else consolidateUnmet.push(item)
  })

  consolidateUnmet.sort((a, b) => {
    const ma = masteryMap[wordKey(a.entry)]
    const mb = masteryMap[wordKey(b.entry)]
    const sa = ma?.stage ?? 0
    const sb = mb?.stage ?? 0
    if (sa !== sb) return sa - sb
    const ca = ma?.correct ?? 0
    const cb = mb?.correct ?? 0
    if (ca !== cb) return ca - cb
    const ia = ma?.incorrect ?? 0
    const ib = mb?.incorrect ?? 0
    return ib - ia
  })
  consolidateMet.sort((a, b) => a.order - b.order)
  preview.sort((a, b) => a.order - b.order)

  return [...consolidateUnmet, ...consolidateMet, ...preview].map(({ entry, kind, met }) => ({
    entry, kind, met,
  }))
}
```

- [ ] **Step 3: Lint + build**

```bash
pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/utils/english-helpers.ts
git commit -m "feat(english): add getDailySessionWords with consolidate/preview sort"
```

---

### Task 4: Add `excludeWeekPlans` to `getOldReviewWords`

**Files:**
- Modify: `src/utils/english-helpers.ts`

Spec §3.6: the old-review pool must exclude words in the current weekly plan (and any next-week plan already created) so plans don't "double-book" words.

- [ ] **Step 1: Replace `getOldReviewWords`**

In `src/utils/english-helpers.ts`, replace the existing `getOldReviewWords` body (currently lines 395-417) with:

```ts
/**
 * Returns all words due for spaced-repetition review today (including overdue),
 * excluding words that appear in any of `excludeWeekPlans` (typically the current
 * and next week's plans — see spec §3.6). Excludes graduated words.
 * Sorted by overdue days desc, then stage asc.
 */
export function getOldReviewWords(
  vocab: WordEntry[],
  masteryMap: WordMasteryMap,
  excludeWeekPlans: WeeklyPlan[] = [],
): WordEntry[] {
  const today = new Date().toISOString().slice(0, 10)
  const excludeKeys = new Set<string>()
  for (const plan of excludeWeekPlans) {
    for (const day of plan.days) for (const k of day.newWordKeys) excludeKeys.add(k)
  }
  return vocab
    .filter(w => {
      const k = wordKey(w)
      if (excludeKeys.has(k)) return false
      const m = masteryMap[k]
      if (!m || isGraduated(m)) return false
      const init = ensureStageInit(m, today)
      const due = init.nextReviewDate ?? today
      return due <= today
    })
    .map(w => {
      const m = ensureStageInit(masteryMap[wordKey(w)]!, today)
      const overdueDays = Math.max(
        0,
        Math.floor((Date.parse(today) - Date.parse(m.nextReviewDate ?? today)) / 86400000),
      )
      return { w, overdueDays, stage: m.stage ?? 0 }
    })
    .sort((a, b) => b.overdueDays - a.overdueDays || a.stage - b.stage)
    .map(({ w }) => w)
}
```

Existing callers still work because the third parameter defaults to `[]`.

- [ ] **Step 2: Lint + build**

```bash
pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/utils/english-helpers.ts
git commit -m "feat(english): getOldReviewWords accepts excludeWeekPlans"
```

---

### Task 5: Rewrite `useWordMastery.recordBatch` to aggregate per word

**Files:**
- Modify: `src/hooks/useWordMastery.ts`

Spec §3.8: within one session, a single word advances (or regresses) at most once; same-day repeat sessions only accumulate correct/incorrect + reviewHistory. Passes the new `wordKey` argument through to `advanceStage` so jitter applies.

- [ ] **Step 1: Replace `recordBatch`**

In `src/hooks/useWordMastery.ts`, replace the entire `recordBatch` callback (currently lines 37-76) with:

```ts
  const recordBatch = useCallback((results: { entry: WordEntry; correct: boolean }[]) => {
    if (!user) return
    if (results.length === 0) return
    const today = new Date().toISOString().slice(0, 10)

    // Aggregate by word key so we do at most one stage change per word per call
    type Group = { entry: WordEntry; corrects: number; total: number }
    const byKey = new Map<string, Group>()
    for (const { entry, correct } of results) {
      const k = wordKey(entry)
      const g = byKey.get(k) ?? { entry, corrects: 0, total: 0 }
      if (correct) g.corrects += 1
      g.total += 1
      byKey.set(k, g)
    }

    setMasteryMap(prev => {
      const next = { ...prev }
      const touchedKeys: string[] = []

      for (const [key, g] of byKey) {
        const cur: WordMasteryInfo = next[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
        const allCorrect = g.corrects === g.total
        const majorityCorrect = g.corrects > g.total / 2
        const sameDay = cur.lastSeen === today

        let stageUpdated: WordMasteryInfo
        if (allCorrect && !sameDay) {
          stageUpdated = advanceStage(cur, today, key)
        } else if (!majorityCorrect && !sameDay) {
          stageUpdated = regressStage(cur, today)
        } else {
          // Same day, or mixed correct/incorrect on a new day: keep stage/nextReviewDate
          stageUpdated = cur
        }

        // Append each individual answer to reviewHistory for full history
        const historyAppends = results
          .filter(r => wordKey(r.entry) === key)
          .map(r => ({ date: today, correct: r.correct }))

        next[key] = {
          ...stageUpdated,
          correct: cur.correct + g.corrects,
          incorrect: cur.incorrect + (g.total - g.corrects),
          lastSeen: today,
          reviewHistory: [...(cur.reviewHistory ?? []), ...historyAppends],
        }
        touchedKeys.push(key)
      }

      const rows = touchedKeys.map(key => {
        const updated = next[key]
        return {
          user_id: user.id,
          word_key: key,
          correct: updated.correct,
          incorrect: updated.incorrect,
          last_seen: today,
          stage: updated.stage,
          next_review_date: updated.nextReviewDate ?? null,
          is_hard: updated.isHard ?? false,
          review_history: updated.reviewHistory ?? [],
          updated_at: new Date().toISOString(),
        }
      })
      supabase
        .from('word_mastery')
        .upsert(rows, { onConflict: 'user_id,word_key' })
        .then(({ error }) => {
          if (error) console.error('[word_mastery] upsert failed', error)
        })

      return next
    })
  }, [user])
```

Key differences from the previous implementation:
- Aggregate by `wordKey` first; at most one stage change per word per call
- Check `cur.lastSeen === today` to suppress stage changes on repeat same-day sessions
- Only upsert one row per unique word (previously we upserted one row per question, which caused unnecessary writes even before the bug)
- Pass `key` to `advanceStage` so jitter kicks in

- [ ] **Step 2: Lint + build**

```bash
pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 3: Manual smoke test**

Start the dev server:

```bash
pnpm dev
```

In the browser, sign in, open an English weekly plan, run a quiz with all three types (A, B, C) on at least one word. Before this change, finishing a word correctly on 3 types would jump its stage by 3. After this change, Supabase's `word_mastery` row for that word should show `stage` incremented by **exactly 1**, and `correct` incremented by 3.

Verify in the Supabase dashboard: `select stage, correct, next_review_date from word_mastery where user_id=... and word_key=...` before and after.

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWordMastery.ts
git commit -m "fix(mastery): aggregate recordBatch by word, one stage change per session"
```

---

### Task 6: Same-day guard in `useProblemMastery.recordProblemResult`

**Files:**
- Modify: `src/hooks/useProblemMastery.ts`

Spec §3.8 "影响面": `useProblemMastery.ts` has the same over-advance pattern in a different shape — the user can redo a problem multiple times per day and its stage advances each time. Apply the same-day guard and pass the problem key to `advanceStage`.

- [ ] **Step 1: Update `recordProblemResult`**

In `src/hooks/useProblemMastery.ts`, replace the entire callback (currently lines 38-71) with:

```ts
  const recordProblemResult = useCallback((key: string, correct: boolean) => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    const cur: WordMasteryInfo = masteryMapRef.current[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
    const sameDay = cur.lastSeen === today

    let stageUpdated: WordMasteryInfo
    if (correct && !sameDay) {
      stageUpdated = advanceStage(cur, today, key)
    } else if (!correct && !sameDay) {
      stageUpdated = regressStage(cur, today)
    } else {
      stageUpdated = cur
    }

    const info: WordMasteryInfo = {
      ...stageUpdated,
      correct: correct ? cur.correct + 1 : cur.correct,
      incorrect: correct ? cur.incorrect : cur.incorrect + 1,
      lastSeen: today,
    }

    setMasteryMap(prev => ({ ...prev, [key]: info }))

    supabase
      .from('problem_mastery')
      .upsert(
        {
          user_id: user.id,
          problem_key: key,
          correct: info.correct,
          incorrect: info.incorrect,
          last_seen: today,
          stage: info.stage,
          next_review_date: info.nextReviewDate ?? null,
          is_hard: info.isHard ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,problem_key' },
      )
      .then(({ error }) => {
        if (error) console.error('[problem_mastery] upsert error:', error)
      })
  }, [user])
```

- [ ] **Step 2: Lint + build**

```bash
pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProblemMastery.ts
git commit -m "fix(mastery): same-day guard and key-based jitter in recordProblemResult"
```

---

### Task 7: Wire `excludeWeekPlans` into `WeeklyPractice.tsx` old-review pool

**Files:**
- Modify: `src/components/english/words/WeeklyPractice.tsx`

Spec §3.6: the 📚 旧词复习 button should hide words that already appear in the current week and the next week (if that plan exists).

- [ ] **Step 1: Replace the `oldReviewWords` memo**

In `src/components/english/words/WeeklyPractice.tsx`, replace the existing memo at lines 149-153:

```ts
const oldReviewWords = useMemo(
  () => getOldReviewWords(vocab, masteryMap),
  [vocab, masteryMap],
)
```

with:

```ts
const currentAndNextWeekPlans = useMemo(() => {
  const today = todayStr()
  const sorted = [...allPlans].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  let currentIdx = -1
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].weekStart <= today) { currentIdx = i; break }
  }
  const result: typeof allPlans = []
  if (currentIdx >= 0) result.push(sorted[currentIdx])
  if (currentIdx + 1 < sorted.length) result.push(sorted[currentIdx + 1])
  return result
}, [allPlans])

const oldReviewWords = useMemo(
  () => getOldReviewWords(vocab, masteryMap, currentAndNextWeekPlans),
  [vocab, masteryMap, currentAndNextWeekPlans],
)
```

The manual descending loop (instead of `findLastIndex`) sidesteps any TS target concerns.

- [ ] **Step 2: Lint + build**

```bash
pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/english/words/WeeklyPractice.tsx
git commit -m "feat(english): exclude current/next week plan words from old-review pool"
```

---

### Task 8: Carryover unfinished consolidate words into new plan's `unassignedKeys`

**Files:**
- Modify: `src/components/english/words/WeeklyPractice.tsx`

Spec §3.7: when the user clicks "+创建周计划" and advances to `step === 'arrange'`, if the *previous* week's plan had consolidate words that did not reach `stage >= 2`, append them to the arrange-step's `unassignedKeys` pool and show a one-time banner.

- [ ] **Step 1: Import `classifyPlanWords`**

At the top of `src/components/english/words/WeeklyPractice.tsx`, update the import from `@/utils/english-helpers` to include the new helper:

```ts
import { buildWeeklyPlan, classifyPlanWords, getOrderedLessons, getWeekStart, fmtDate, fmtWeekRange, wordKey, getOldReviewWords } from '@/utils/english-helpers'
```

- [ ] **Step 2: Add `carryoverCount` state**

Next to `unassignedKeys` (around line 103):

```ts
const [carryoverCount, setCarryoverCount] = useState(0)
```

- [ ] **Step 3: Compute carryover keys in `handleGoToArrange`**

Replace the current `handleGoToArrange` (lines 155-168) with:

```ts
const handleGoToArrange = useCallback(() => {
  if (!activeLesson) return
  const { days, unassigned } = buildWeeklyPlan(
    lessonWords,
    dialogWeekStart,
    totalPerDay,
    lessonGroups,
    resolvedQuotas,
  )

  // Carryover: previous-week plan's consolidate words with stage < 2 (spec §3.7)
  const prevWeekStart = (() => {
    const [y, m, d] = dialogWeekStart.split('-').map(Number)
    const prev = new Date(y, m - 1, d - 7)
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
  })()
  const prevPlan = allPlans.find(p => p.weekStart === prevWeekStart)
  const carryover: string[] = []
  if (prevPlan) {
    const cls = classifyPlanWords(prevPlan, vocab)
    const alreadyAssigned = new Set<string>(days.flatMap(d => d.newWordKeys))
    const alreadyUnassigned = new Set(unassigned)
    for (const [k, kind] of cls) {
      if (kind !== 'consolidate') continue
      if (alreadyAssigned.has(k) || alreadyUnassigned.has(k)) continue
      const m = masteryMap[k]
      const stage = m?.stage ?? 0
      if (stage < 2) carryover.push(k)
    }
  }

  setDraftDays(days)
  setUnassignedKeys([...unassigned, ...carryover])
  setCarryoverCount(carryover.length)
  setSelectedKeys(new Set())
  setStep('arrange')
}, [activeLesson, lessonWords, lessonGroups, resolvedQuotas, totalPerDay, dialogWeekStart, allPlans, vocab, masteryMap])
```

- [ ] **Step 4: Render the carryover banner in the arrange step**

In the arrange-step JSX, immediately above the existing "Unassigned pool" block (around line 484 `unassignedKeys.length > 0 &&`), insert:

```tsx
{carryoverCount > 0 && (
  <div className="mb-3 rounded-[14px] border border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.08)] px-4 py-3 text-[.78rem] font-bold text-[#fbbf24]">
    ↻ 上周有 {carryoverCount} 个必记词未达标，已加入下方待分配池，请安排到合适的日子。
  </div>
)}
```

- [ ] **Step 5: Reset `carryoverCount` on clean exit paths**

In the params-step "取消" button (around line 395-398), change the handler:

```tsx
<button
  onClick={() => { setStep('list'); setCarryoverCount(0) }}
  ...
>
  取消
</button>
```

In `handleConfirmArrange`, right after `setStep('list')` (around line 199), add:

```ts
setCarryoverCount(0)
```

- [ ] **Step 6: Lint + build**

```bash
pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 7: Manual verification**

```bash
pnpm dev
```

Create a plan for this week with at least two lessons; complete only some of the quizzes (leaving some consolidate words at stage 0). Then advance the week (change your system date or wait a week) and click "+ 创建周计划". The arrange step should show the orange banner `↻ 上周有 N 个必记词未达标...` and the unfinished words should appear as chips in the 待分配 pool.

Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/components/english/words/WeeklyPractice.tsx
git commit -m "feat(english): carryover last week's unmet consolidate words on new plan"
```

---

### Task 9: Rewrite `WeeklyPlanSession.buildSessionWords` and session state for `kind`

**Files:**
- Modify: `src/components/english/words/WeeklyPlanSession.tsx`

This is a structural change inside the session component. We replace the single `enabledTypes` set with two separate sets, rename the per-word `isReview: boolean` to `kind: 'consolidate' | 'preview'`, and swap the `getReviewWordsForDay` call for `getDailySessionWords`.

- [ ] **Step 1: Update imports**

At the top of `src/components/english/words/WeeklyPlanSession.tsx`, change the import from `@/utils/english-helpers` to:

```ts
import {
  buildQuizOptions,
  classifyPlanWords,
  getDailySessionWords,
  hilite,
  highlightExample,
  wordKey,
  ALL_CN_DAYS,
  fmtDate,
  fmtWeekRange,
} from '@/utils/english-helpers'
```

`getReviewWordsForDay` is no longer imported. `classifyPlanWords` is added for the week-level progress bar (Task 11).

- [ ] **Step 2: Update the `DpQuizQ` and `SessionSnapshot` types**

Replace the existing `DpQuizQ` interface (lines 33-37) and `SessionSnapshot` interface (lines 39-47) with:

```ts
type WordKind = 'consolidate' | 'preview'

interface DpQuizQ {
  word: WordEntry
  type: 'A' | 'B' | 'C'
  kind: WordKind
}

interface SessionSnapshot {
  version: 2
  phase: 'study' | 'quiz'
  selectedDate: string
  studyIdx: number
  words: { key: string; kind: WordKind }[]
  quizQs: { key: string; type: 'A' | 'B' | 'C'; kind: WordKind }[]
  curQ: number
  quizResults: { key: string; correct: boolean }[]
}
```

The `version: 2` bump invalidates any in-flight session saved under the previous schema. This is intentional — the data shape changed (`isReview` → `kind`).

- [ ] **Step 3: Update `loadSessionSnapshot` to reject old schema**

Replace `loadSessionSnapshot` (lines 53-61) with:

```ts
function loadSessionSnapshot(planId: string | undefined): SessionSnapshot | null {
  if (!planId || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`weekly_session_${planId}`)
    if (!raw) return null
    const snap = JSON.parse(raw) as Partial<SessionSnapshot>
    if (snap.version !== 2) return null
    if (snap.phase !== 'study' && snap.phase !== 'quiz') return null
    return snap as SessionSnapshot
  } catch { return null }
}
```

- [ ] **Step 4: Replace `enabledTypes` with two independent sets**

Around line 104, replace:

```ts
const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set(['A', 'B', 'C']))
```

with:

```ts
const [consolidateTypes, setConsolidateTypes] = useState<Set<'A' | 'B' | 'C'>>(
  new Set(['A', 'C']),
)
const [previewTypes, setPreviewTypes] = useState<Set<'A' | 'B' | 'C'>>(
  new Set(['A', 'B']),
)
```

Defaults per spec §3.3.

- [ ] **Step 5: Update `wordKeys` / `words` and `quizQKeys` / `quizQs` to use `kind`**

Replace the `wordKeys` state + `words` memo (lines 108-118) with:

```ts
const [wordKeys, setWordKeys] = useState<{ key: string; kind: WordKind }[]>(
  () => snap0?.words ?? [],
)
const words = useMemo(
  () =>
    wordKeys
      .map(({ key, kind }) => {
        const entry = vocab.find((w) => wordKey(w) === key)
        return entry ? { entry, kind } : null
      })
      .filter((w): w is { entry: WordEntry; kind: WordKind } => w !== null),
  [wordKeys, vocab],
)
```

Replace the `quizQKeys` state + `quizQs` memo (lines 124-136) with:

```ts
const [quizQKeys, setQuizQKeys] = useState<{ key: string; type: 'A' | 'B' | 'C'; kind: WordKind }[]>(
  () => snap0?.quizQs ?? [],
)
const quizQs = useMemo(
  () =>
    quizQKeys
      .map(({ key, type, kind }) => {
        const entry = vocab.find((w) => wordKey(w) === key)
        return entry ? { word: entry, type, kind } : null
      })
      .filter((q): q is DpQuizQ => q !== null),
  [quizQKeys, vocab],
)
```

- [ ] **Step 6: Update the persistence effect to write `version: 2`**

Replace the body inside `sessionStorage.setItem(...)` (around line 164) with:

```ts
sessionStorage.setItem(
  key,
  JSON.stringify({
    version: 2,
    phase,
    selectedDate: selectedDate ?? '',
    studyIdx,
    words: wordKeys,
    quizQs: quizQKeys,
    curQ,
    quizResults: quizResultBuffer.current
      .slice(0, curQ)
      .map(({ entry, correct }) => ({ key: wordKey(entry), correct })),
  } satisfies SessionSnapshot),
)
```

- [ ] **Step 7: Replace `buildSessionWords` with `getDailySessionWords`**

Replace the `buildSessionWords` callback (lines 197-212) with:

```ts
const buildSessionWords = useCallback(
  (dateStr: string) => {
    const dayIndex = plan.days.findIndex((d) => d.date === dateStr)
    if (dayIndex === -1) return []
    return getDailySessionWords(plan, vocab, masteryMap, dayIndex)
  },
  [plan, vocab, masteryMap],
)
```

- [ ] **Step 8: Update `startStudy` to store `kind`**

Replace the `startStudy` callback (lines 214-230) with:

```ts
const startStudy = useCallback(
  (dateStr: string) => {
    const anyTypeSelected = consolidateTypes.size + previewTypes.size > 0
    if (!anyTypeSelected) {
      alert('请至少选择一种题型！')
      return
    }
    const session = buildSessionWords(dateStr)
    if (session.length === 0) return
    setWordKeys(session.map(({ entry, kind }) => ({ key: wordKey(entry), kind })))
    setStudyIdx(0)
    setStudyWordVisible(false)
    setStudyDefOnly(false)
    setSelectedDate(dateStr)
    setPhase('study')
    setIsImmersive(true)
  },
  [consolidateTypes, previewTypes, buildSessionWords, setIsImmersive],
)
```

- [ ] **Step 9: Update `startQuiz` to branch types by `kind`**

Replace the `startQuiz` callback (lines 232-247) with:

```ts
const startQuiz = useCallback(() => {
  const qs: { key: string; type: 'A' | 'B' | 'C'; kind: WordKind }[] = []
  words.forEach((w) => {
    const types = w.kind === 'consolidate' ? [...consolidateTypes] : [...previewTypes]
    types.forEach((t) => qs.push({ key: wordKey(w.entry), type: t, kind: w.kind }))
  })
  for (let i = qs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[qs[i], qs[j]] = [qs[j], qs[i]]
  }
  quizResultBuffer.current = []
  setQuizQKeys(qs)
  setCurQ(0)
  setScore(0)
  setPhase('quiz')
}, [words, consolidateTypes, previewTypes])
```

- [ ] **Step 10: Update the study-phase card's kind badge**

In the study-phase JSX (around lines 640-649), the current code renders a 复习 / 新词 badge based on `w.isReview`. Replace that `<span>` with:

```tsx
<span
  className={`rounded-full border px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider uppercase ${
    w.kind === 'consolidate'
      ? 'border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.2)] text-[#93c5fd]'
      : 'border-[rgba(249,115,22,.3)] bg-[rgba(249,115,22,.2)] text-[#fb923c]'
  }`}
>
  {w.kind === 'consolidate' ? '必记' : '预习'}
</span>
```

Visual convention: consolidate = blue (必记/须稳住); preview = orange (预习/首次接触).

- [ ] **Step 11: Lint + build**

```bash
pnpm lint && pnpm build
```

Fix any type errors surfaced by the rename (e.g. stale `.isReview` references elsewhere in the file — whole-file search for `isReview` and convert remaining UI text/logic to `.kind` equivalents).

Expected: clean.

- [ ] **Step 12: Commit**

```bash
git add src/components/english/words/WeeklyPlanSession.tsx
git commit -m "refactor(english-session): classify session words by kind, split type sets"
```

---

### Task 10: Two-row type selector UI + day-card labels + grouped detail view

**Files:**
- Modify: `src/components/english/words/WeeklyPlanSession.tsx`

Now we rebuild the three user-visible affordances in the week-view screen: day-cell sub-label (`必记 N · 预习 M`), the grouped selected-day detail view, and the dual-row type selector.

- [ ] **Step 1: Build per-plan classification once via useMemo**

Near the top of the `if (phase === 'week-view')` block (just before `const today = todayStr()` around line 286), add:

```ts
const planClassification = useMemo(() => classifyPlanWords(plan, vocab), [plan, vocab])
```

- [ ] **Step 2: Replace the day-cell sub-label computation**

In the 7-day grid loop (around lines 328-399), replace the lines that currently compute `newCount` / `reviewCount`:

```tsx
const newCount = day.newWordKeys.length
const { weekReview, oldReview } = getReviewWordsForDay(vocab, masteryMap, plan, i)
const reviewCount = weekReview.length + oldReview.length
```

with:

```tsx
// Count words introduced up to and including this day, split by kind
const introducedUpTo = new Set<string>()
for (let j = 0; j <= i; j++) plan.days[j].newWordKeys.forEach(k => introducedUpTo.add(k))
let consolidateCount = 0
let previewCount = 0
for (const k of introducedUpTo) {
  const kind = planClassification.get(k)
  if (kind === 'preview') previewCount += 1
  else consolidateCount += 1
}
```

- [ ] **Step 3: Replace the sub-label text**

Around line 395, replace:

```tsx
{isDone ? '✓ 完成' : isToday ? '今天' : `${newCount}+${reviewCount}`}
```

with:

```tsx
{isDone ? '✓ 完成' : isToday ? '今天' : `必记 ${consolidateCount} · 预习 ${previewCount}`}
```

- [ ] **Step 4: Replace the selected-day detail area**

Around lines 402-487, the selected-day panel currently renders two sections keyed on `newWords` + `weekReview` from `getReviewWordsForDay`. Replace the entire `selectedDate && (() => { ... })()` IIFE body with:

```tsx
{selectedDate &&
  (() => {
    const dayIndex = plan.days.findIndex((d) => d.date === selectedDate)
    const dayPlan = plan.days[dayIndex]
    if (!dayPlan) return null
    const isDone = plan.progress[selectedDate]?.quizDone === true
    const session = getDailySessionWords(plan, vocab, masteryMap, dayIndex)
    const consolidateList = session.filter(s => s.kind === 'consolidate')
    const previewList = session.filter(s => s.kind === 'preview')
    const metCount = consolidateList.filter(s => s.met).length
    const total = session.length
    return (
      <div className="border-t border-[var(--wm-border)] pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[.72rem] font-extrabold text-[var(--wm-text-dim)]">
            {fmtDate(selectedDate)} {cnDays[dayIndex]}
          </span>
          <span className="rounded-full border border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.15)] px-2 py-0.5 text-[.65rem] font-bold text-[#93c5fd]">
            必记 {consolidateList.length}（已达标 {metCount}）
          </span>
          {previewList.length > 0 && (
            <span className="rounded-full border border-[rgba(249,115,22,.3)] bg-[rgba(249,115,22,.15)] px-2 py-0.5 text-[.65rem] font-bold text-[#fb923c]">
              预习 {previewList.length}
            </span>
          )}
          <span className="text-[.68rem] text-[var(--wm-text-dim)]">共 {total} 词</span>
          {isDone && plan.progress[selectedDate]?.lastScore !== undefined && (
            <span className="ml-auto text-[.72rem] font-bold text-[#4ade80]">
              上次 {plan.progress[selectedDate].lastScore}%
            </span>
          )}
        </div>

        {consolidateList.length > 0 && (
          <div className="mb-3">
            <div className="mb-1.5 text-[.6rem] font-extrabold tracking-widest text-[#93c5fd] uppercase">
              必记（{consolidateList.length} 个，已达标 {metCount}）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {consolidateList.map((s) => {
                const level = getWordMasteryLevel(masteryMap[wordKey(s.entry)]?.correct ?? 0)
                return (
                  <span
                    key={wordKey(s.entry)}
                    className={`rounded-full border-[1.5px] px-2.5 py-1 text-[0.875rem] font-bold ${
                      s.met
                        ? 'border-[rgba(74,222,128,.4)] bg-[rgba(74,222,128,.1)] text-[#86efac]'
                        : 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)] text-[#93c5fd]'
                    }`}
                  >
                    {level > 0 && (
                      <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>
                    )}
                    {s.entry.word}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {previewList.length > 0 && (
          <div className="mb-3">
            <div className="mb-1.5 text-[.6rem] font-extrabold tracking-widest text-[#fb923c] uppercase">
              预习（{previewList.length} 个）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {previewList.map((s) => {
                const level = getWordMasteryLevel(masteryMap[wordKey(s.entry)]?.correct ?? 0)
                return (
                  <span
                    key={wordKey(s.entry)}
                    className="rounded-full border-[1.5px] border-[rgba(249,115,22,.4)] bg-[rgba(249,115,22,.08)] px-2.5 py-1 text-[0.875rem] font-bold text-[#fb923c]"
                  >
                    {level > 0 && (
                      <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>
                    )}
                    {s.entry.word}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {total === 0 && (
          <div className="mb-4 text-[1.125rem] text-[var(--wm-text-dim)]">
            暂无单词
          </div>
        )}

        <div className="mb-2.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
          题型选择
        </div>

        {/* Two-row type selector */}
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[5.5rem] text-[.72rem] font-bold text-[#93c5fd]">必记词题型</span>
            {(['A', 'B', 'C'] as const).map((t) => {
              const labels = { A: '释义 → 选单词', B: '单词 → 选释义', C: '释义 → 默写' }
              const on = consolidateTypes.has(t)
              return (
                <button
                  key={`c-${t}`}
                  onClick={() =>
                    setConsolidateTypes((prev) => {
                      const n = new Set(prev)
                      if (n.has(t)) n.delete(t); else n.add(t)
                      return n
                    })
                  }
                  className={`flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-2 text-[.82rem] font-bold transition-all select-none ${
                    on
                      ? 'border-[rgba(167,139,250,.5)] bg-[rgba(167,139,250,.1)] text-[#c4b5fd]'
                      : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
                  }`}
                >
                  <span
                    className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[.6rem] font-black ${
                      t === 'A'
                        ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
                        : t === 'B'
                          ? 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]'
                          : 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                    }`}
                  >
                    {t}
                  </span>
                  {labels[t]}
                </button>
              )
            })}
          </div>
          {previewList.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-[5.5rem] text-[.72rem] font-bold text-[#fb923c]">预习词题型</span>
              {(['A', 'B', 'C'] as const).map((t) => {
                const labels = { A: '释义 → 选单词', B: '单词 → 选释义', C: '释义 → 默写' }
                const on = previewTypes.has(t)
                return (
                  <button
                    key={`p-${t}`}
                    onClick={() =>
                      setPreviewTypes((prev) => {
                        const n = new Set(prev)
                        if (n.has(t)) n.delete(t); else n.add(t)
                        return n
                      })
                    }
                    className={`flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-2 text-[.82rem] font-bold transition-all select-none ${
                      on
                        ? 'border-[rgba(167,139,250,.5)] bg-[rgba(167,139,250,.1)] text-[#c4b5fd]'
                        : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
                    }`}
                  >
                    <span
                      className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[.6rem] font-black ${
                        t === 'A'
                          ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
                          : t === 'B'
                            ? 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]'
                            : 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                      }`}
                    >
                      {t}
                    </span>
                    {labels[t]}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => startStudy(selectedDate)}
          className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-6 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
        >
          {isDone ? '🔄 重新练习' : '🚀 开始练习'}
        </button>
      </div>
    )
  })()}
```

The preview row auto-hides when `previewList.length === 0` (1-lesson plan case per spec §3.5.1).

- [ ] **Step 5: Lint + build**

```bash
pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/english/words/WeeklyPlanSession.tsx
git commit -m "feat(english-session): dual-row type selector, day labels, grouped word list"
```

---

### Task 11: Week-level progress bar and Sunday fallback banner

**Files:**
- Modify: `src/components/english/words/WeeklyPlanSession.tsx`

Spec §3.5.3 and §3.5.4.

- [ ] **Step 1: Compute weekly consolidate metrics**

In the `if (phase === 'week-view')` block, right after the `planClassification` memo added in Task 10 Step 1, add:

```ts
const { consolidateTotal, consolidateMet } = useMemo(() => {
  const keys: string[] = []
  for (const [k, kind] of planClassification) if (kind === 'consolidate') keys.push(k)
  const met = keys.filter(k => (masteryMap[k]?.stage ?? 0) >= 2).length
  return { consolidateTotal: keys.length, consolidateMet: met }
}, [planClassification, masteryMap])

const isLastDayToday = plan.days[plan.days.length - 1]?.date === todayStr()
const showSundayBanner = isLastDayToday && consolidateTotal - consolidateMet > 0
```

- [ ] **Step 2: Render the progress bar inside the week-card header**

Inside the 7-day grid's parent (around line 327, right BEFORE the `<div className="scrollbar-none mt-3 ...">` that opens the day grid), insert:

```tsx
{consolidateTotal > 0 && (
  <div className="mt-3 rounded-[12px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-4 py-2.5">
    <div className="mb-1.5 flex items-center justify-between text-[.7rem] font-bold">
      <span className="text-[#93c5fd]">本周必记达标</span>
      <span className="text-[var(--wm-text-dim)]">{consolidateMet} / {consolidateTotal}</span>
    </div>
    <div className="h-[6px] w-full rounded-full bg-white/[.06]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#60a5fa] to-[#a78bfa] transition-[width] duration-400"
        style={{ width: `${consolidateTotal === 0 ? 0 : Math.round((consolidateMet / consolidateTotal) * 100)}%` }}
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: Render the Sunday fallback banner above the selected-day panel**

Right above the `{selectedDate && (...)}` block (around line 402, before the opening brace), insert:

```tsx
{showSundayBanner && (
  <div className="mt-4 rounded-[14px] border border-[rgba(248,113,113,.5)] bg-[rgba(248,113,113,.1)] px-4 py-3 text-[.82rem] font-extrabold text-[#f87171]">
    ⚠️ 今日兜底：还有 {consolidateTotal - consolidateMet} 个必记词未达标，今天务必攻克。
  </div>
)}
```

- [ ] **Step 4: Lint + build**

```bash
pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 5: Manual smoke verification**

```bash
pnpm dev
```

Open a weekly plan. Confirm:
1. The progress bar shows `X / N` above the day cells
2. Each day cell (non-today, non-completed) shows `必记 K · 预习 M`
3. The selected-day panel renders 必记 and 预习 sections separately, with mastery badges on the chips
4. The 题型选择 area has two rows (or one row if 1-lesson plan)
5. To trigger the Sunday banner, temporarily shift your system clock to the plan's final day, and ensure at least one consolidate word is unmet — the red banner should appear above the selected-day panel

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/english/words/WeeklyPlanSession.tsx
git commit -m "feat(english-session): weekly progress bar and Sunday fallback banner"
```

---

### Task 12: Remove the now-unused `getReviewWordsForDay` and final verification

**Files:**
- Modify: `src/utils/english-helpers.ts`

All callers of `getReviewWordsForDay` were replaced in Tasks 9–11. Remove the dead function to prevent future misuse.

- [ ] **Step 1: Verify no remaining callers**

```bash
rg -n "getReviewWordsForDay"
```

Expected: only the `export function` line inside `src/utils/english-helpers.ts` and occurrences inside `docs/superpowers/` (OK — markdown spec).

If any `.tsx` or `.ts` file under `src/` still references it, go back and replace with `getDailySessionWords`. Do not proceed until grep is clean of source-code hits.

- [ ] **Step 2: Delete the function**

In `src/utils/english-helpers.ts`, remove the entire `getReviewWordsForDay` block — the doc comment plus the function body (previously lines 317-388). Save.

- [ ] **Step 3: Final full verification**

```bash
pnpm lint && pnpm build
```

Expected: both clean.

- [ ] **Step 4: Manual end-to-end sanity check**

```bash
pnpm dev
```

Walk the full flow:
1. Create a 2-lesson plan → arrange step shows no carryover banner (first run) → create → opens session
2. Day cards show `必记 K · 预习 M`
3. Progress bar visible above day grid
4. Select a day → grouped display of 必记 / 预习 chips with mastery badges
5. Two-row type selector works — uncheck C for 必记, check only A for 预习
6. Start practice → quiz questions match the selected types per word kind
7. Finish quiz → mastery row in Supabase updates `stage` by exactly 1 per word (not 2+), `next_review_date` is NOT identical across the batch (spot check two words)
8. Open `📚 旧词复习` — should exclude all words from the just-created plan

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/utils/english-helpers.ts
git commit -m "chore(english): remove unused getReviewWordsForDay helper"
```

---

## Self-Review (executed before handing off)

**1. Spec coverage**

| Spec § | Requirement | Task |
|---|---|---|
| 3.1 | `classifyPlanWords` | Task 2 |
| 3.2 | `getDailySessionWords`, no 9-cap, no old-review mix | Tasks 3, 9 |
| 3.3 | Dual `consolidateTypes` / `previewTypes` | Tasks 9, 10 |
| 3.4 | `stage >= 2` pass criterion (used in UI + sort) | Tasks 3, 11 |
| 3.5.1 | Dual-row type UI, hide preview row when 1-lesson | Task 10 |
| 3.5.2 | Day card sub-label `必记 N · 预习 M` | Task 10 |
| 3.5.3 | Week progress bar | Task 11 |
| 3.5.4 | Sunday fallback banner | Task 11 |
| 3.5.5 | Grouped 必记/预习 list | Task 10 |
| 3.6 | `getOldReviewWords` excludes plan words | Tasks 4, 7 |
| 3.7 | Carryover unmet consolidate words | Task 8 |
| 3.8 | `recordBatch` aggregation + same-day guard | Tasks 5, 6 |
| 3.9 | `hashOffset` jitter in `advanceStage` | Task 1 |

Spec §7 (unit test plan) is intentionally not implemented — per user direction, verification is lint + build + manual smoke check per task.

**2. Placeholder scan**

All steps contain actual code or explicit commands. No `TODO`, no `similar to Task N`, no "add appropriate error handling" hand-waves.

**3. Type consistency**

- `classifyPlanWords(plan, vocab)` → `Map<string, 'consolidate' | 'preview'>` — consistent across Tasks 2, 8, 10, 11
- `getDailySessionWords(plan, vocab, masteryMap, dayIndex)` → `DailySessionWord[]` with fields `{entry, kind, met}` — consistent in Tasks 3, 9, 10
- `advanceStage(info, today, wordKey?)` — optional `wordKey`; all new production callers (Tasks 5, 6) pass it
- `getOldReviewWords(vocab, masteryMap, excludeWeekPlans?)` — third arg defaults to `[]`; Task 7 supplies it
- `WordKind = 'consolidate' | 'preview'` — consistent in Task 9

No naming or signature drift between tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-weekly-memorization-logic-design.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
