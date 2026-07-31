# Calc daily session pause / resume — design

**Date:** 2026-07-31  
**Package:** `@rosie/calc`  
**Status:** Approved for planning  
**Related:** Session timing modes `2026-07-09-calc-session-timing-modes-design.md`; English adaptive round snapshot (same-day `sessionStorage`) as prior art for resume UX patterns

## Goal

Allow a child to leave an in-progress **daily** oral-arithmetic session (`/calc/session?mode=daily`) and continue later from the same question index — on the same device by default, and on another device after an explicit sync.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | **daily only** — not mistakes / free / drill |
| Re-entry UX | Ask **继续上次 / 重新开始** before prep |
| Local persistence | Implicit: write once questions are built, rewrite after each settled question |
| Draft lifetime | Until finish or「重新开始」(may span calendar days) |
| Cloud sync | Manual only; button peer to「暂停」 |
| Pause meaning | Exit to `/calc`; draft already saved |
| Current-question clock | Restart on resume (do not restore remaining seconds) |
| Unsubmitted input | Not persisted |

## Approach

**Local-first draft + optional cloud snapshot (recommended).**

- Persist a full draft to `localStorage` once the question list is built, and rewrite it after each settled question.
-「暂停」navigates home; no extra save step.
-「同步」upserts the current draft to Supabase (`calc_session_drafts`, one row per user).
- On re-entry, merge local + remote by `updatedAt`, then show resume dialog when a draft exists.
- Completing a session or choosing「重新开始」clears local and best-effort deletes the cloud row.

Rejected:

- Full cloud `in_progress` session on every answer (offline-hostile; conflicts with finish-only `calc_sessions` model).
- Local-only (fails cross-device requirement).
- Auto cloud sync every answer (user explicitly wants manual sync peer to pause).

## §1 Data & storage

### Local

- Key: `calc:daily-draft:{userId}`
- Written when the daily question list is first built; rewritten after each settled question (correct final, final wrong, or timeout settle).
- Cleared on successful `finishSession` or「重新开始」.
- May persist across calendar days until cleared.

### Cloud table `calc_session_drafts`

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | uuid PK | FK auth.users; one draft per user |
| `payload` | jsonb | Full draft document |
| `updated_at` | timestamptz | Conflict / merge key; mirrors payload.updatedAt |
| `synced_at` | timestamptz | Last successful manual sync |

RLS: authenticated user can select / insert / update / delete **only** own row.  
SQL migration: `packages/calc/sql/calc-session-drafts.sql`.

### Draft payload

```ts
type CalcDailySessionDraft = {
  version: number // bump on breaking shape changes
  userId: string
  mode: 'daily'
  updatedAt: string // ISO
  startedAt: string
  elapsedSec: number // wall time accumulated before last pause/exit
  timingMode: CalcTimingMode
  bonusSec: number
  questions: CalcQuestion[]
  idx: number
  plannedCount: number
  wrongQueue: CalcQuestion[]
  maxRetry: number
  attemptsLog: AttemptStat[] // same fields session.tsx uses for finish
  questionTimesMs: number[]
  questionLog: QuestionLogEntry[]
  streak: number
  maxStreak: number
  coinsTotal: number
}
```

`version` mismatch → discard draft and fall through to prep (do not crash).

### Sync & merge

- Local: every settled question.
- Cloud: only on「同步」button → upsert.
- On session enter (daily): read local + fetch remote; keep the side with newer `updatedAt`; if only one side exists, use that.
-「重新开始」/ finish: clear local; delete cloud row (best-effort; log failures).

## §2 Interaction

### In session (daily, post-prep)

Controls at peer level (status area or header actions):

- **暂停** — `router.push('/calc')`. Draft already on disk. Replace today’s「退出」label/affordance for daily in-progress.
- **同步** — upsert cloud; toast success「已同步，可换设备继续」or failure with retry.

Header back link for daily in-progress uses the same pause semantics (leave to `/calc`).

### Re-enter `/calc/session?mode=daily`

1. Resolve merged draft (local ⊕ cloud).
2. **Draft present** → skip prep; show `SessionResumeDialog`:
   - **继续上次** — show progress e.g.「已到 8/20」; hydrate state; continue from `idx` (current question clock restarts; input empty).
   - **重新开始** — clear drafts → existing prep → `buildSession`.
3. **No draft** → existing prep flow unchanged.

Refresh mid-session follows the same re-enter path (resume dialog).

### Finish

Existing `finishSession` path unchanged for `calc_sessions` / mastery / stars. After success, clear local + delete cloud draft.

### Side effects (unchanged)

- Mistakes: still written at settle time during the original run; resume must **not** re-apply settle side effects for already-logged questions.
- Proficiency / mastery: still folded only in `finishSession`.

## §3 Modules & boundaries

### New (`packages/calc`)

| Piece | Role |
|-------|------|
| `utils/calc-session-draft.ts` | Types, serialize, local read/write/clear |
| `utils/calc-session-draft-sync.ts` | Cloud upsert / fetch / delete; merge by `updatedAt` |
| `sql/calc-session-drafts.sql` | Table + RLS |
| `components/SessionResumeDialog.tsx` | Continue vs restart |
| Session action strip (or header `rightExtra`) | 暂停 + 同步 |

### Touched

- `pages/session.tsx` — draft check before init; persist after settle; pause/sync; hydrate on continue; clear on finish/restart; skip prep when resuming.
- Core types only if shared types belong in `@rosie/core`; otherwise keep draft types inside calc.

### Out of scope

| Mode | Why excluded this pass |
|------|-------------------------|
| **mistakes** | `/calc/session?mode=mistakes` — mistakes book practice |
| **free** | Typed but unused entry in product |
| **drill** | Report drills (`weak-formulas` / `breakthrough`) |

### Edge cases

| Case | Behavior |
|------|----------|
| Not logged in | Align with today: session requires user; no cloud sync |
| Sync offline | Fail toast; local draft intact |
| Two devices both dirty | Enter uses newer `updatedAt`; without sync they diverge |
| Schema / version break | Drop draft → prep |
| Strict / bonus timer | Fresh countdown on resumed current question |
| Prep confirmed but 0 questions settled | Optional: still write draft on first leave after questions built, or only after first settle — **prefer write once questions are built** (so pause before Q1 still resumes same paper). Implementation: persist on questions ready + after each settle. |

### Testing

- Local write / clear / version reject
- Merge prefers newer `updatedAt`
- Resume dialog branches
- Finish clears local + cloud
- Non-daily modes never write draft
- Sync failure leaves local intact

## Success criteria

1. Daily session can be left mid-way and continued on the same device after「继续上次」.
2. Manual「同步」enables continue on another device with the same account.
3.「重新开始」and normal completion leave no residual draft locally or remotely (cloud delete best-effort).
4. Mistakes / drill / free behavior unchanged.
