# Calc daily session pause / resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist in-progress daily calc sessions locally (and optionally to cloud via manual sync) so leaving mid-session and re-entering can resume or restart.

**Architecture:** Local-first `localStorage` draft rewritten when the question list is built and after each settled question; peer UI actions「暂停」(leave home) and「同步」(upsert Supabase one-row-per-user); on daily re-entry merge local⊕cloud by `updatedAt` and show continue/restart dialog before prep.

**Tech Stack:** TypeScript, `@rosie/calc` + `@rosie/core`, Supabase `CREATE TABLE IF NOT EXISTS` + RLS, Vitest via `apps/web`.

**Spec:** [`docs/superpowers/specs/2026-07-31-calc-daily-session-pause-resume-design.md`](../specs/2026-07-31-calc-daily-session-pause-resume-design.md)

## Global Constraints

- **daily only** (`mode=daily` and no `drill` params) — mistakes / free / drill must never write or resume drafts
- Local: write when questions first built; rewrite after each settled question; clear on finish or「重新开始」
- Cloud: write **only** on「同步」button; delete best-effort on finish / restart
- Merge: newer `updatedAt` wins
- `version` mismatch → discard draft → prep
- Resume: current question clock restarts; unsubmitted input not restored
- Mistakes still written at settle; proficiency still only in `finishSession`; resume must not re-apply settle side effects for already-logged questions
- SQL: idempotent create + RLS only; no DELETE/TRUNCATE of user practice data
- Before done: `pnpm --filter @rosie/calc typecheck` + focused vitest

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/calc/src/utils/calc-session-draft.ts` | Create | Draft type, version, local key, validate, read/write/clear, `mergeDrafts`, `buildDraft` |
| `packages/calc/src/utils/calc-session-draft-sync.ts` | Create | Cloud fetch / upsert / delete; `resolveDailyDraft` (local⊕cloud) |
| `packages/calc/sql/calc-session-drafts.sql` | Create | Tracked SQL mirror |
| `docs/sql/calc-session-drafts.sql` | Create | Operator-runnable copy (docs/ gitignored) |
| `apps/web/tests/calc-session-draft.test.ts` | Create | Unit tests for local + merge |
| `packages/calc/src/components/SessionResumeDialog.tsx` | Create | Continue / restart chooser |
| `packages/calc/src/components/SessionDraftActions.tsx` | Create | 暂停 + 同步 peer controls + sync status text |
| `packages/calc/src/pages/session.tsx` | Modify | Gate, hydrate, persist, clear, wire actions |
| `packages/calc/src/index.ts` | Modify | Export draft helpers for tests |
| `packages/calc/FAQ.md`, `faq.tsx`, `CLAUDE.md` | Modify | Short parent/agent notes |

---

### Task 1: Draft types + local storage helpers + tests

**Files:**
- Create: `packages/calc/src/utils/calc-session-draft.ts`
- Create: `apps/web/tests/calc-session-draft.test.ts`
- Modify: `packages/calc/src/index.ts`

**Interfaces:**
- Produces:

```ts
export const CALC_DAILY_DRAFT_VERSION = 1

/** Same shape as session.tsx AttemptStat (move definition here; session imports it). */
export interface CalcDraftAttemptStat {
  signature: string
  level: CalcLevel
  isChallenge: boolean
  firstTryCorrect: boolean
  finallyCorrect: boolean
  wasMistake: boolean
  timeMs: number
  withinLimit: boolean
  sourceBlockId?: string
  sourceMixedOpId?: string
  display?: string
}

export interface CalcDailySessionDraft {
  version: number
  userId: string
  mode: 'daily'
  updatedAt: string
  startedAt: string
  elapsedSec: number
  timingMode: CalcTimingMode
  bonusSec: number
  questions: CalcQuestion[]
  idx: number
  plannedCount: number
  wrongQueue: CalcQuestion[]
  maxRetry: number
  attemptsLog: CalcDraftAttemptStat[]
  questionTimesMs: number[]
  questionLog: QuestionLogEntry[]
  streak: number
  maxStreak: number
  coinsTotal: number
}

export function calcDailyDraftStorageKey(userId: string): string
  // → `calc:daily-draft:${userId}`

export function isValidDailyDraft(raw: unknown, userId: string): raw is CalcDailySessionDraft
  // version === CALC_DAILY_DRAFT_VERSION, mode === 'daily', userId match,
  // Array.isArray(questions/attemptsLog/…), idx number, questions.length > 0

export function readLocalDailyDraft(userId: string): CalcDailySessionDraft | null
export function writeLocalDailyDraft(draft: CalcDailySessionDraft): void
export function clearLocalDailyDraft(userId: string): void

export function mergeDrafts(
  local: CalcDailySessionDraft | null,
  remote: CalcDailySessionDraft | null,
): CalcDailySessionDraft | null
  // null if both null; else the one with later Date.parse(updatedAt); tie → prefer local

export function buildDailyDraft(args: {
  userId: string
  startedAt: string
  elapsedSec: number
  timingMode: CalcTimingMode
  bonusSec: number
  questions: CalcQuestion[]
  idx: number
  plannedCount: number
  wrongQueue: CalcQuestion[]
  maxRetry: number
  attemptsLog: CalcDraftAttemptStat[]
  questionTimesMs: number[]
  questionLog: QuestionLogEntry[]
  streak: number
  maxStreak: number
  coinsTotal: number
  nowIso?: string // default new Date().toISOString()
}): CalcDailySessionDraft
```

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/tests/calc-session-draft.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  CALC_DAILY_DRAFT_VERSION,
  buildDailyDraft,
  calcDailyDraftStorageKey,
  clearLocalDailyDraft,
  isValidDailyDraft,
  mergeDrafts,
  readLocalDailyDraft,
  writeLocalDailyDraft,
  type CalcDailySessionDraft,
} from '@rosie/calc'
import type { CalcQuestion } from '@rosie/core'

const q = (sig: string): CalcQuestion => ({
  display: '1+1=?',
  signature: sig,
  arity: 1,
  level: 1,
  answer: { kind: 'int', value: 2 },
  isChallenge: false,
  category: 'addsub',
  coinBase: 1,
})

function sample(over: Partial<CalcDailySessionDraft> = {}): CalcDailySessionDraft {
  return buildDailyDraft({
    userId: 'u1',
    startedAt: '2026-07-31T01:00:00.000Z',
    elapsedSec: 30,
    timingMode: 'relaxed',
    bonusSec: 3,
    questions: [q('a'), q('b')],
    idx: 1,
    plannedCount: 2,
    wrongQueue: [],
    maxRetry: 3,
    attemptsLog: [],
    questionTimesMs: [],
    questionLog: [],
    streak: 0,
    maxStreak: 0,
    coinsTotal: 0,
    nowIso: '2026-07-31T01:05:00.000Z',
    ...over,
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe('calcDailyDraftStorageKey', () => {
  it('namespaces by user', () => {
    expect(calcDailyDraftStorageKey('u1')).toBe('calc:daily-draft:u1')
  })
})

describe('isValidDailyDraft', () => {
  it('accepts current version daily draft for user', () => {
    expect(isValidDailyDraft(sample(), 'u1')).toBe(true)
  })
  it('rejects wrong version / user / empty questions', () => {
    expect(isValidDailyDraft({ ...sample(), version: 0 }, 'u1')).toBe(false)
    expect(isValidDailyDraft(sample(), 'other')).toBe(false)
    expect(isValidDailyDraft({ ...sample(), questions: [] }, 'u1')).toBe(false)
  })
})

describe('local read/write/clear', () => {
  it('round-trips and clears', () => {
    const d = sample()
    writeLocalDailyDraft(d)
    expect(readLocalDailyDraft('u1')?.idx).toBe(1)
    clearLocalDailyDraft('u1')
    expect(readLocalDailyDraft('u1')).toBeNull()
  })
  it('discards corrupt JSON', () => {
    localStorage.setItem(calcDailyDraftStorageKey('u1'), '{')
    expect(readLocalDailyDraft('u1')).toBeNull()
  })
})

describe('mergeDrafts', () => {
  it('prefers newer updatedAt; ties prefer local', () => {
    const older = sample({ updatedAt: '2026-07-31T01:00:00.000Z', idx: 0 })
    const newer = sample({ updatedAt: '2026-07-31T02:00:00.000Z', idx: 1 })
    expect(mergeDrafts(older, newer)?.idx).toBe(1)
    expect(mergeDrafts(newer, older)?.idx).toBe(1)
    const a = sample({ updatedAt: '2026-07-31T01:00:00.000Z', idx: 0 })
    const b = sample({ updatedAt: '2026-07-31T01:00:00.000Z', idx: 1 })
    expect(mergeDrafts(a, b)?.idx).toBe(0)
  })
  it('returns sole side when other null', () => {
    const d = sample()
    expect(mergeDrafts(d, null)).toBe(d)
    expect(mergeDrafts(null, d)).toBe(d)
    expect(mergeDrafts(null, null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter web exec vitest run tests/calc-session-draft.test.ts
```

Expected: FAIL (module / exports missing)

- [ ] **Step 3: Implement `calc-session-draft.ts`**

```ts
'use client' // only if file touches window; prefer no directive — guard typeof localStorage

import type { CalcLevel, CalcQuestion, CalcTimingMode, QuestionLogEntry } from '@rosie/core'

export const CALC_DAILY_DRAFT_VERSION = 1

// ... types as in Interfaces ...

export function calcDailyDraftStorageKey(userId: string): string {
  return `calc:daily-draft:${userId}`
}

export function isValidDailyDraft(raw: unknown, userId: string): raw is CalcDailySessionDraft {
  if (!raw || typeof raw !== 'object') return false
  const d = raw as CalcDailySessionDraft
  return (
    d.version === CALC_DAILY_DRAFT_VERSION &&
    d.mode === 'daily' &&
    d.userId === userId &&
    typeof d.updatedAt === 'string' &&
    typeof d.startedAt === 'string' &&
    typeof d.elapsedSec === 'number' &&
    (d.timingMode === 'relaxed' || d.timingMode === 'strict' || d.timingMode === 'bonus') &&
    typeof d.bonusSec === 'number' &&
    Array.isArray(d.questions) &&
    d.questions.length > 0 &&
    typeof d.idx === 'number' &&
    d.idx >= 0 &&
    d.idx < d.questions.length &&
    typeof d.plannedCount === 'number' &&
    Array.isArray(d.wrongQueue) &&
    typeof d.maxRetry === 'number' &&
    Array.isArray(d.attemptsLog) &&
    Array.isArray(d.questionTimesMs) &&
    Array.isArray(d.questionLog) &&
    typeof d.streak === 'number' &&
    typeof d.maxStreak === 'number' &&
    typeof d.coinsTotal === 'number'
  )
}

export function readLocalDailyDraft(userId: string): CalcDailySessionDraft | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(calcDailyDraftStorageKey(userId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isValidDailyDraft(parsed, userId)) {
      clearLocalDailyDraft(userId)
      return null
    }
    return parsed
  } catch {
    clearLocalDailyDraft(userId)
    return null
  }
}

export function writeLocalDailyDraft(draft: CalcDailySessionDraft): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(calcDailyDraftStorageKey(draft.userId), JSON.stringify(draft))
  } catch {
    /* quota / private mode — degrade */
  }
}

export function clearLocalDailyDraft(userId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(calcDailyDraftStorageKey(userId))
  } catch {
    /* noop */
  }
}

export function mergeDrafts(
  local: CalcDailySessionDraft | null,
  remote: CalcDailySessionDraft | null,
): CalcDailySessionDraft | null {
  if (!local) return remote
  if (!remote) return local
  const lt = Date.parse(local.updatedAt)
  const rt = Date.parse(remote.updatedAt)
  if (Number.isNaN(lt) && Number.isNaN(rt)) return local
  if (Number.isNaN(rt)) return local
  if (Number.isNaN(lt)) return remote
  if (rt > lt) return remote
  return local
}

export function buildDailyDraft(args: {
  userId: string
  startedAt: string
  elapsedSec: number
  timingMode: CalcTimingMode
  bonusSec: number
  questions: CalcQuestion[]
  idx: number
  plannedCount: number
  wrongQueue: CalcQuestion[]
  maxRetry: number
  attemptsLog: CalcDraftAttemptStat[]
  questionTimesMs: number[]
  questionLog: QuestionLogEntry[]
  streak: number
  maxStreak: number
  coinsTotal: number
  nowIso?: string
}): CalcDailySessionDraft {
  return {
    version: CALC_DAILY_DRAFT_VERSION,
    userId: args.userId,
    mode: 'daily',
    updatedAt: args.nowIso ?? new Date().toISOString(),
    startedAt: args.startedAt,
    elapsedSec: args.elapsedSec,
    timingMode: args.timingMode,
    bonusSec: args.bonusSec,
    questions: args.questions,
    idx: args.idx,
    plannedCount: args.plannedCount,
    wrongQueue: args.wrongQueue,
    maxRetry: args.maxRetry,
    attemptsLog: args.attemptsLog,
    questionTimesMs: args.questionTimesMs,
    questionLog: args.questionLog,
    streak: args.streak,
    maxStreak: args.maxStreak,
    coinsTotal: args.coinsTotal,
  }
}
```

Export from `packages/calc/src/index.ts`:

```ts
export {
  CALC_DAILY_DRAFT_VERSION,
  calcDailyDraftStorageKey,
  isValidDailyDraft,
  readLocalDailyDraft,
  writeLocalDailyDraft,
  clearLocalDailyDraft,
  mergeDrafts,
  buildDailyDraft,
  type CalcDailySessionDraft,
  type CalcDraftAttemptStat,
} from './utils/calc-session-draft'
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter web exec vitest run tests/calc-session-draft.test.ts
pnpm --filter @rosie/calc typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/utils/calc-session-draft.ts packages/calc/src/index.ts apps/web/tests/calc-session-draft.test.ts
git commit -m "$(cat <<'EOF'
feat(calc): add daily session draft local helpers

EOF
)"
```

---

### Task 2: SQL + cloud sync helpers

**Files:**
- Create: `packages/calc/sql/calc-session-drafts.sql`
- Create: `docs/sql/calc-session-drafts.sql` (mirror; force-add if committing docs)
- Create: `packages/calc/src/utils/calc-session-draft-sync.ts`
- Modify: `apps/web/tests/calc-session-draft.test.ts` (add `resolveDailyDraft` merge path with mocked fetch — or keep resolve unmocked and unit-test only pure `mergeDrafts` already covered; add sync module tests that mock `supabase` if the web vitest suite already mocks it — **prefer**: export `resolveDailyDraft(local, remote)` as thin alias of merge after validation, and keep supabase I/O thin without unit tests; smoke via typecheck)
- Modify: `packages/calc/src/index.ts`

**Interfaces:**
- Produces:

```ts
export async function fetchRemoteDailyDraft(userId: string): Promise<CalcDailySessionDraft | null>
export async function upsertRemoteDailyDraft(draft: CalcDailySessionDraft): Promise<{ ok: true } | { ok: false; error: string }>
export async function deleteRemoteDailyDraft(userId: string): Promise<void>
export async function resolveDailyDraft(userId: string): Promise<CalcDailySessionDraft | null>
  // local = readLocalDailyDraft; remote = fetchRemote; return mergeDrafts(local, remote)
```

- [ ] **Step 1: SQL files (identical content)**

```sql
-- Calc daily in-progress session draft (one row per user).
-- Spec: docs/superpowers/specs/2026-07-31-calc-daily-session-pause-resume-design.md
-- Tracked mirror: packages/calc/sql/calc-session-drafts.sql
-- Run in Supabase SQL editor. Idempotent. No destructive data ops.

CREATE TABLE IF NOT EXISTS public.calc_session_drafts (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.calc_session_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calc_session_drafts_own ON public.calc_session_drafts;
CREATE POLICY calc_session_drafts_own ON public.calc_session_drafts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Implement sync module**

```ts
import { supabase } from '@rosie/core'
import {
  isValidDailyDraft,
  mergeDrafts,
  readLocalDailyDraft,
  type CalcDailySessionDraft,
} from './calc-session-draft'

type DraftRow = {
  user_id: string
  payload: unknown
  updated_at: string
  synced_at: string
}

export async function fetchRemoteDailyDraft(userId: string): Promise<CalcDailySessionDraft | null> {
  const { data, error } = await supabase
    .from('calc_session_drafts')
    .select('user_id,payload,updated_at,synced_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[calc_session_drafts] fetch failed', error)
    return null
  }
  if (!data) return null
  const row = data as DraftRow
  const payload = row.payload
  // Prefer payload.updatedAt; if missing, stamp row.updated_at onto a copy only for merge
  if (isValidDailyDraft(payload, userId)) return payload
  return null
}

export async function upsertRemoteDailyDraft(
  draft: CalcDailySessionDraft,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('calc_session_drafts').upsert(
    {
      user_id: draft.userId,
      payload: draft,
      updated_at: draft.updatedAt,
      synced_at: now,
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    console.error('[calc_session_drafts] upsert failed', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function deleteRemoteDailyDraft(userId: string): Promise<void> {
  const { error } = await supabase.from('calc_session_drafts').delete().eq('user_id', userId)
  if (error) console.error('[calc_session_drafts] delete failed', error)
}

export async function resolveDailyDraft(userId: string): Promise<CalcDailySessionDraft | null> {
  const local = readLocalDailyDraft(userId)
  const remote = await fetchRemoteDailyDraft(userId)
  return mergeDrafts(local, remote)
}
```

Export `resolveDailyDraft`, `upsertRemoteDailyDraft`, `deleteRemoteDailyDraft`, `fetchRemoteDailyDraft` from `index.ts`.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @rosie/calc typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/calc/sql/calc-session-drafts.sql packages/calc/src/utils/calc-session-draft-sync.ts packages/calc/src/index.ts
# optional: git add -f docs/sql/calc-session-drafts.sql
git commit -m "$(cat <<'EOF'
feat(calc): add session draft cloud sync helpers and SQL

EOF
)"
```

**Operator note (not a code step):** run `packages/calc/sql/calc-session-drafts.sql` in Supabase before manual sync can succeed in prod/staging.

---

### Task 3: Resume dialog + pause/sync action strip

**Files:**
- Create: `packages/calc/src/components/SessionResumeDialog.tsx`
- Create: `packages/calc/src/components/SessionDraftActions.tsx`

**Interfaces:**
- Produces React components:

```tsx
// SessionResumeDialog
type Props = {
  progressLabel: string // e.g. "已到 8 / 20"
  onContinue: () => void
  onRestart: () => void
}

// SessionDraftActions
type Props = {
  syncStatus: 'idle' | 'syncing' | 'ok' | 'error'
  syncError?: string | null
  onPause: () => void
  onSync: () => void
}
```

- [ ] **Step 1: Implement `SessionResumeDialog`**

Full-screen centered card matching calc violet glass style (same tokens as `SessionPrepScreen`):

- Title: `继续练习？`
- Subtitle: `{progressLabel}`
- Primary button: `继续上次` → `onContinue`
- Secondary button: `重新开始` → `onRestart`

Use existing patterns from `SessionPrepScreen.tsx` for colors/borders (read that file and mirror).

- [ ] **Step 2: Implement `SessionDraftActions`**

Horizontal peer buttons under / beside status bar area:

- `暂停` → `onPause`
- `同步` → `onSync` (disabled when `syncStatus === 'syncing'`)
- Status text:
  - idle: nothing
  - syncing: `同步中…`
  - ok: `已同步，可换设备继续`
  - error: `同步失败，请重试` (+ optional `syncError` truncated)

Style: compact text buttons, violet border like header chip — not cards in the hero sense; this is an interaction chrome strip.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @rosie/calc typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/calc/src/components/SessionResumeDialog.tsx packages/calc/src/components/SessionDraftActions.tsx
git commit -m "$(cat <<'EOF'
feat(calc): add resume dialog and draft pause/sync actions

EOF
)"
```

---

### Task 4: Wire `session.tsx` (persist, resume, clear)

**Files:**
- Modify: `packages/calc/src/pages/session.tsx`

**Interfaces:**
- Consumes: all helpers from Tasks 1–3
- Behavior contracts below

#### 4a — Extract AttemptStat

- Delete local `interface AttemptStat` in `session.tsx`
- Import `CalcDraftAttemptStat as AttemptStat` from `../utils/calc-session-draft`

#### 4b — Daily draft gate state

Add state (daily only):

```ts
type DraftGate = 'loading' | 'choose' | 'fresh' | 'resume'
const [draftGate, setDraftGate] = useState<DraftGate>(() =>
  needsPrep ? 'loading' : 'fresh',
)
const [pendingDraft, setPendingDraft] = useState<CalcDailySessionDraft | null>(null)
const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')
const [syncError, setSyncError] = useState<string | null>(null)
const hydratedFromDraftRef = useRef(false)
```

`needsPrep` stays `mode === 'daily' && !drillParams`.

On mount when `needsPrep && user`:

```ts
useEffect(() => {
  if (!needsPrep || !user) return
  if (draftGate !== 'loading') return
  let cancelled = false
  void (async () => {
    const draft = await resolveDailyDraft(user.id)
    if (cancelled) return
    if (draft) {
      setPendingDraft(draft)
      setDraftGate('choose')
    } else {
      setDraftGate('fresh')
    }
  })()
  return () => { cancelled = true }
}, [needsPrep, user, draftGate])
```

Show `SessionResumeDialog` when `draftGate === 'choose' && pendingDraft`:

- `progressLabel`: `已到 ${pendingDraft.idx + 1} / ${pendingDraft.plannedCount}`
- `onContinue`: hydrate (4c), `setPrepConfirmed(true)`, `setDraftGate('resume')`, clear `pendingDraft`
- `onRestart`: `clearLocalDailyDraft(user.id)`; `void deleteRemoteDailyDraft(user.id)`; `setPendingDraft(null)`; `setDraftGate('fresh')`

When `draftGate === 'loading'`, show existing「准备题目中…」shell (or a short「检查进度…」).

Existing prep screen only when `needsPrep && !prepConfirmed && draftGate === 'fresh'`.

#### 4c — Hydrate from draft

```ts
function hydrateFromDraft(d: CalcDailySessionDraft) {
  hydratedFromDraftRef.current = true
  sessionTimingModeRef.current = d.timingMode
  sessionBonusSecRef.current = d.bonusSec
  setQuestions(d.questions)
  setIdx(d.idx)
  plannedCountRef.current = d.plannedCount
  setPlannedCount(d.plannedCount)
  wrongQueueRef.current = d.wrongQueue
  maxRetryRef.current = d.maxRetry
  attemptsLogRef.current = d.attemptsLog
  questionTimesRef.current = d.questionTimesMs
  questionLogRef.current = d.questionLog
  setStreak(d.streak)
  maxStreakRef.current = d.maxStreak
  setMaxStreak(d.maxStreak)
  coinsTotalRef.current = d.coinsTotal
  setCoinsTotal(d.coinsTotal)
  setStartedAtIso(d.startedAt)
  // Preserve accumulated wall time across pauses
  setStartedTsMs(Date.now() - d.elapsedSec * 1000)
  setInput('')
  setAttemptsForCurrent(0)
  setFeedback(null)
  setRevealAnswer(null)
  initRef.current = true // prevent buildSession init
}
```

#### 4d — Skip `buildSession` when resumed

In the existing init `useEffect`, first lines after guards:

```ts
if (hydratedFromDraftRef.current) return
```

Also: do not run init while `draftGate === 'loading' || draftGate === 'choose'`.

When `draftGate === 'resume'`, init is skipped via `initRef` + hydrate flag; still run `problemState.loadAll` / mistakes ensureLoaded in background if needed for settle — **minimum**: on continue, `void problemState.loadAll()` and `void calcMistakesStore.ensureLoaded(user.id)` without rebuilding questions.

#### 4e — Persist helper

```ts
const persistDraft = useCallback(() => {
  if (!user || mode !== 'daily' || drillParams || !questions || done) return
  const elapsedSec = Math.max(0, Math.floor((Date.now() - startedTsMs) / 1000))
  const draft = buildDailyDraft({
    userId: user.id,
    startedAt: startedAtIso,
    elapsedSec,
    timingMode: sessionTimingModeRef.current,
    bonusSec: sessionBonusSecRef.current,
    questions,
    idx,
    plannedCount: plannedCountRef.current,
    wrongQueue: wrongQueueRef.current,
    maxRetry: maxRetryRef.current,
    attemptsLog: attemptsLogRef.current,
    questionTimesMs: questionTimesRef.current,
    questionLog: questionLogRef.current,
    streak,
    maxStreak: maxStreakRef.current,
    coinsTotal: coinsTotalRef.current,
  })
  writeLocalDailyDraft(draft)
}, [user, mode, drillParams, questions, done, startedTsMs, startedAtIso, idx, streak])
```

Call `persistDraft()`:

1. In a `useEffect` when `questions` becomes non-null for daily (after build or hydrate) — debounce not required; once on ready is enough if deps include questions length + startedAtIso
2. At end of `settleQuestion` paths after pushing to `attemptsLogRef` (both correct and final-wrong), before `goNext` schedules advance — also call after `goNext` updates idx: simplest approach is `useEffect(() => { persistDraft() }, [idx, questions, coinsTotal, streak, done])` guarded by `!done && questions` for daily only. That covers settle-driven idx changes and initial build.

Prefer **one effect**:

```ts
useEffect(() => {
  if (mode !== 'daily' || drillParams || !questions || done || !user) return
  if (!startedAtIso || !startedTsMs) return
  persistDraft()
}, [mode, drillParams, questions, idx, streak, coinsTotal, done, user, startedAtIso, startedTsMs, persistDraft])
```

#### 4f — Pause + Sync + header

- Render `SessionDraftActions` above/below `CalcSessionStatusBar` when daily in-progress (`questions && !done && mode==='daily' && !drillParams`).
- `onPause`: `persistDraft()` then `router.push('/calc')`
- `onSync`: `persistDraft()`; build same draft (or `readLocalDailyDraft`); `setSyncStatus('syncing')`; `upsertRemoteDailyDraft`; set ok/error
- `CalcAppHeader` for in-progress daily: `backLabel="暂停"`, `backHref="/calc"` (Link navigates away — ensure persist runs on click). Prefer replacing `Link` usage for this screen with button that pauses, **or** `useEffect` cleanup that `persistDraft()` on unmount for daily in-progress (cleanup covers header Link, browser back, pause button). **Required:** unmount cleanup persist for daily.

```ts
useEffect(() => {
  return () => {
    // unmount flush — call a ref-held latest persist to avoid stale closure
    persistDraftRef.current?.()
  }
}, [])
```

Keep `persistDraftRef.current = persistDraft` each render.

#### 4g — Clear on finish / restart

At end of successful `finishSession` after `wallet.recordSession`:

```ts
if (mode === 'daily' && !drillParams && user) {
  clearLocalDailyDraft(user.id)
  void deleteRemoteDailyDraft(user.id)
}
```

#### 4h — Typecheck

```bash
pnpm --filter @rosie/calc typecheck
pnpm --filter web exec vitest run tests/calc-session-draft.test.ts
```

#### 4i — Manual smoke checklist (implementer)

1. Start daily → answer 2 → 暂停 → re-enter → dialog shows 已到 3/N → 继续 → same questions
2. 重新开始 → prep → new paper; old draft gone
3. 同步 on device A → device B same user → enter → continue from A
4. mistakes / drill session → no draft key written
5. Finish session → local + remote cleared

- [ ] **Step 1: Implement 4a–4g in `session.tsx`**
- [ ] **Step 2: Typecheck + unit tests**
- [ ] **Step 3: Commit**

```bash
git add packages/calc/src/pages/session.tsx
git commit -m "$(cat <<'EOF'
feat(calc): pause and resume daily sessions via draft

EOF
)"
```

---

### Task 5: Docs + FAQ

**Files:**
- Modify: `packages/calc/FAQ.md`
- Modify: `packages/calc/src/pages/faq.tsx` (one short Q/A)
- Modify: `packages/calc/CLAUDE.md`

- [ ] **Step 1: FAQ** — add under practice flow:

> 练到一半可以点「暂停」回家；再进会问要不要继续。本机进度会自动记住。换手机/电脑前请先点「同步」。

- [ ] **Step 2: CLAUDE.md** — under Session prep bullet, add:

> **Pause/resume (daily):** local draft `calc:daily-draft:{userId}` + optional `calc_session_drafts` row (manual sync). Resume dialog before prep. Helpers: `calc-session-draft.ts`, `calc-session-draft-sync.ts`.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @rosie/calc typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/calc/FAQ.md packages/calc/src/pages/faq.tsx packages/calc/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(calc): document daily session pause and sync

EOF
)"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Local draft key + version | T1 |
| Write on build + after settle | T4e |
| Clear on finish / restart | T4b, T4g |
| Cloud table + RLS | T2 |
| Manual sync only | T3, T4f |
| Pause = leave home | T3, T4f |
| Resume dialog continue/restart | T3, T4b |
| Merge by updatedAt | T1, T2 |
| daily only | T4 guards |
| Clock restart / no input restore | T4c |
| Side effects unchanged | T4 (no re-settle) |
| FAQ / agent docs | T5 |

## Self-review notes

- No vitest for supabase I/O — intentional; merge/validate covered in T1.
- `docs/sql/` is gitignored — still create the file for operators; tracked copy lives under `packages/calc/sql/`.
- Header `Link` cannot easily call async sync; unmount `persistDraftRef` covers local flush when navigating via「暂停」label / back.
- `elapsedSec` via `startedTsMs = Date.now() - elapsedSec*1000` keeps `finishSession` total time coherent across pauses.
- Soft-retry queue and makeup tail are part of `questions` growth + `wrongQueue` — both persisted.
- Operator must run SQL before cross-device sync works.
