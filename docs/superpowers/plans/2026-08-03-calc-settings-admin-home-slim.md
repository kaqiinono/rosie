# Calc settings → admin + slim home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 口算 settings to `/admin/calc`, make the child `/calc` home practice-only (no settings/sound/count UI), slim the voucher card to a quick link, and lazy-load「最近练习」sessions on first expand only.

**Architecture:** Reuse existing `packages/calc/src/pages/settings.tsx` behind a new admin route + dark layout; delete the child `/calc/settings` shell (no redirect). Home derives today progress from `calcSessionSummariesStore` (via extended `useCalcPracticeStats`) and gates `useCalcWallet(..., { loadSessions })` behind a `sessionsRequested` flag flipped on first accordion expand. Session prep keeps per-run timing overrides but drops「设为默认」write-back.

**Tech Stack:** Next.js App Router, `@rosie/calc`, `@rosie/rewards` (`useCalcWallet` lazy sessions), `@rosie/core` session stores, Vitest under `apps/web/tests`.

**Spec:** [`docs/superpowers/specs/2026-08-03-calc-settings-admin-home-slim-design.md`](../specs/2026-08-03-calc-settings-admin-home-slim-design.md)

## Global Constraints

- Child surface: **no settings UI**, **no sound toggle**, **no homepage count editor**
- Admin owns **all** `calc_settings` fields including `soundEnabled`
- Session prep: per-run override OK; **no「设为默认」** / no write-back of timing defaults
- `/calc/settings` **deleted** — **no redirect** to admin
- Voucher card: quick link only — **no star balance**
- Drop homepage「本周星星」; keep week/month/year **problem** counts
- Recent sessions: collapsed by default; fetch on first expand; no refetch until full page refresh (`sessionsReady` short-circuit)
- Prefer `patchSessionData` / existing store short-circuits; do **not** `invalidateSessionStore()` broadly
- No SQL / schema changes
- Before done: `pnpm --filter @rosie/calc typecheck` (+ `pnpm --filter @rosie/rewards typecheck` if rewards touched)

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/calc/src/hooks/useCalcPracticeStats.ts` | Modify | Add today problem/correct from summary rows |
| `packages/calc/src/utils/calc-today-from-summaries.ts` | Create | Pure helper for today totals (unit-tested) |
| `apps/web/tests/calc-today-from-summaries.test.ts` | Create | Unit tests for today helper |
| `apps/web/src/app/admin/calc/page.tsx` | Create | Thin shell → `@rosie/calc/pages/settings` |
| `apps/web/src/app/admin/calc/layout.tsx` | Create | Same dark chrome as `apps/web/src/app/calc/layout.tsx` |
| `apps/web/src/app/admin/page.tsx` | Modify | Hub card「口算设置」 |
| `packages/calc/src/pages/settings.tsx` | Modify | `backHref="/admin"`, drop unused wallet if only for header balance |
| `apps/web/src/app/calc/settings/page.tsx` | Delete | Remove child settings route |
| `packages/calc/src/pages/home.tsx` | Modify | Slim UI + lazy sessions + today from practice stats |
| `packages/calc/src/components/SessionPrepScreen.tsx` | Modify | Remove「设为默认」 |
| `packages/calc/src/pages/session.tsx` | Modify | Drop `onSaveDefault` wiring; drop sound toggle props |
| `packages/calc/src/components/CalcAppHeader.tsx` | Modify | Drop unused required sound/balance props |
| `packages/calc/src/pages/mistakes.tsx`, `faq.tsx`, `report.tsx` | Modify | Drop sound toggle / settings links |
| `packages/calc/FAQ.md`, `CLAUDE.md` | Modify | Parent/agent docs: settings live under `/admin/calc` |

---

### Task 1: Today progress helper + extend practice stats

**Files:**
- Create: `packages/calc/src/utils/calc-today-from-summaries.ts`
- Create: `apps/web/tests/calc-today-from-summaries.test.ts`
- Modify: `packages/calc/src/hooks/useCalcPracticeStats.ts`
- Modify: `packages/calc/src/index.ts` (export helper for tests if needed)

**Interfaces:**
- Produces:

```ts
import type { CalcSessionSummaryRow } from '../hooks/useCalcDaily'

export function todayProgressFromSummaries(
  sessions: CalcSessionSummaryRow[],
  today: string,
): { todayProblems: number; todayCorrect: number }
```

- Consumes: `CalcSessionSummaryRow` from `useCalcDaily.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/calc-today-from-summaries.test.ts
import { describe, expect, it } from 'vitest'
import { todayProgressFromSummaries } from '@rosie/calc'

describe('todayProgressFromSummaries', () => {
  it('sums only rows matching today', () => {
    const r = todayProgressFromSummaries(
      [
        { date: '2026-08-03', correct_count: 8, retry_count: 1, wrong_count: 1 },
        { date: '2026-08-02', correct_count: 20, retry_count: 0, wrong_count: 0 },
      ],
      '2026-08-03',
    )
    expect(r.todayProblems).toBe(10)
    expect(r.todayCorrect).toBe(9)
  })

  it('returns zeros when no today rows', () => {
    expect(todayProgressFromSummaries([], '2026-08-03')).toEqual({
      todayProblems: 0,
      todayCorrect: 0,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run tests/calc-today-from-summaries.test.ts`  
Expected: FAIL (module/export missing)

- [ ] **Step 3: Implement helper + wire practice stats**

```ts
// packages/calc/src/utils/calc-today-from-summaries.ts
import type { CalcSessionSummaryRow } from '../hooks/useCalcDaily'

export function todayProgressFromSummaries(
  sessions: CalcSessionSummaryRow[],
  today: string,
): { todayProblems: number; todayCorrect: number } {
  let todayProblems = 0
  let todayCorrect = 0
  for (const s of sessions) {
    if (s.date !== today) continue
    todayProblems += (s.correct_count ?? 0) + (s.retry_count ?? 0) + (s.wrong_count ?? 0)
    todayCorrect += (s.correct_count ?? 0) + (s.retry_count ?? 0)
  }
  return { todayProblems, todayCorrect }
}
```

In `useCalcPracticeStats.ts`, import `todayStr` from `@rosie/core` and the helper; in the existing `useMemo`, also compute and return `todayProblems` / `todayCorrect`.

Export from `packages/calc/src/index.ts`:

```ts
export { todayProgressFromSummaries } from './utils/calc-today-from-summaries'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run tests/calc-today-from-summaries.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/utils/calc-today-from-summaries.ts \
  packages/calc/src/hooks/useCalcPracticeStats.ts \
  packages/calc/src/index.ts \
  apps/web/tests/calc-today-from-summaries.test.ts
git commit -m "$(cat <<'EOF'
feat(calc): derive today progress from session summaries

EOF
)"
```

---

### Task 2: Admin `/admin/calc` + hub card + retarget settings back + delete child route

**Files:**
- Create: `apps/web/src/app/admin/calc/page.tsx`
- Create: `apps/web/src/app/admin/calc/layout.tsx`
- Modify: `apps/web/src/app/admin/page.tsx`
- Modify: `packages/calc/src/pages/settings.tsx`
- Delete: `apps/web/src/app/calc/settings/page.tsx`

**Interfaces:**
- Consumes: existing `@rosie/calc/pages/settings` default export
- Produces: route `/admin/calc` with dark chrome; hub entry; settings `backHref="/admin"`

- [ ] **Step 1: Add admin calc page shell**

```tsx
// apps/web/src/app/admin/calc/page.tsx
export { default } from '@rosie/calc/pages/settings'
```

- [ ] **Step 2: Add admin calc layout (copy chrome from calc layout)**

Copy `apps/web/src/app/calc/layout.tsx` body into `apps/web/src/app/admin/calc/layout.tsx` unchanged (same dark gradient + ambient orbs). Do not share via package unless already trivial — YAGNI.

- [ ] **Step 3: Add hub card on admin home**

In `apps/web/src/app/admin/page.tsx` `TOOLS` array, insert (near awards/plans is fine):

```ts
{
  href: '/admin/calc',
  emoji: '🧮',
  title: '口算设置',
  description: '选择题型与题量、计时模式、音效与答题偏好。孩子端只练习，不在此改设置。',
  from: 'rgba(139,92,246,0.14)',
  to: 'rgba(236,72,153,0.10)',
  ring: 'rgba(139,92,246,0.28)',
},
```

- [ ] **Step 4: Retarget settings header back link; drop wallet-only-for-balance**

In `packages/calc/src/pages/settings.tsx`:

- Change both `CalcAppHeader` instances: `backHref="/admin"`, `backLabel="管理"`
- Remove `useCalcWallet` import/usage if `wallet` is only used for `balance={wallet.balance}`
- Pass no balance / sound toggle once Task 5 cleans header props; until then keep compiling (temporary `balance={0}`, keep sound toggle **on settings page only** via existing Toggle for `soundEnabled` in the form body — header toggle can stay as no-op props or be removed in Task 5 together)

Keep the in-page sound `Toggle` in settings form (admin still configures sound).

- [ ] **Step 5: Delete child settings route**

Delete `apps/web/src/app/calc/settings/page.tsx`. Do **not** add a redirect.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @rosie/calc typecheck`  
Expected: PASS (home/faq may still link to deleted route — fix those strings in Tasks 3–5; if typecheck doesn't catch Link hrefs, continue)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/admin/calc/page.tsx \
  apps/web/src/app/admin/calc/layout.tsx \
  apps/web/src/app/admin/page.tsx \
  packages/calc/src/pages/settings.tsx
git add -u apps/web/src/app/calc/settings/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): host calc settings at /admin/calc

EOF
)"
```

---

### Task 3: Slim calc home (no settings UI, lazy recent sessions, voucher quick link)

**Files:**
- Modify: `packages/calc/src/pages/home.tsx`

**Interfaces:**
- Consumes: `useCalcPracticeStats` → `todayProblems`, `todayCorrect`, week/month/year/total; `useCalcSettings` (read-only display + `soundEnabled` for SFX only); `useCalcWallet(user, { loadSessions: sessionsRequested })`; `useCalcMistakes`
- Produces: practice-only home UI

- [ ] **Step 1: Replace data wiring at top of `CalcHomePage`**

```tsx
const { user } = useAuth()
const router = useRouter()
const { settings, isLoading: settingsLoading } = useCalcSettings(user)
const {
  totalProblems,
  practiceDays,
  weekProblems,
  monthProblems,
  yearProblems,
  todayProblems,
  todayCorrect,
  isLoading: practiceStatsLoading,
} = useCalcPracticeStats(user)
const { unresolved: unresolvedMistakes } = useCalcMistakes(user)

const [recentOpen, setRecentOpen] = useState(false)
const [sessionsRequested, setSessionsRequested] = useState(false)
const wallet = useCalcWallet(user, { loadSessions: sessionsRequested })

const handleToggleRecent = () => {
  setRecentOpen((o) => !o)
  setSessionsRequested(true) // sticky for page lifetime
}
```

Remove `update` from settings on this page (no writes). Remove `getWeekStart` / `weeklyCoins` usage.

Gate loading spinner on `settingsLoading || practiceStatsLoading` only — **not** `wallet.isLoading`.

- [ ] **Step 2: Remove settings / count editor UI**

Delete:

- 「⚙ 设置」`Link`
- Entire「练习题量」section (`CalcConfigBar` + manual-mode settings link)
- Unused imports: `CalcConfigBar`, `Link` only if still needed for other cards

Keep read-only practice content chips + start CTA.

- [ ] **Step 3: Wire today stats from practice stats**

```tsx
const todayTarget = totalQuestions // existing from settings counts
const todayProgressPct =
  todayTarget > 0 ? Math.min(100, Math.round((todayProblems / todayTarget) * 100)) : 0
const todayAccuracy =
  todayProblems > 0 ? Math.round((todayCorrect / todayProblems) * 100) : 0
```

Replace `wallet.todayQuestionsDone` / `wallet.todayCorrect` in the 今日 card. Remove「本周星星」line under 本周 (keep `weekProblems` only).

- [ ] **Step 4: Voucher card → quick link only**

```tsx
<Link href="/vouchers" /* same styles */>
  <span className="text-xl">🎁</span>
  <div className="min-w-0 flex-1">
    <div className="text-[12px] font-extrabold" style={{ color: '#f9a8d4' }}>我的奖券</div>
    <div className="text-[11px] truncate" style={{ color: 'rgba(249,168,212,0.55)' }}>
      去兑换
    </div>
  </div>
  <span style={{ color: 'rgba(249,168,212,0.5)' }}>→</span>
</Link>
```

- [ ] **Step 5: Recent sessions accordion**

Replace always-on list with:

```tsx
<section>
  <button
    type="button"
    onClick={handleToggleRecent}
    className="mb-2 flex w-full items-center justify-between text-left text-[11px] font-extrabold tracking-widest uppercase"
    style={{ color: 'rgba(196,181,253,0.4)' }}
  >
    <span>最近练习</span>
    <span aria-hidden>{recentOpen ? '▾' : '▸'}</span>
  </button>
  {recentOpen && (
    <div className="space-y-1.5">
      {sessionsRequested && !wallet.sessionsReady && !wallet.sessionsFailed && (
        <div className="px-3 py-2 text-[12px]" style={{ color: 'rgba(196,181,253,0.45)' }}>
          加载中…
        </div>
      )}
      {wallet.sessionsFailed && (
        <div className="px-3 py-2 text-[12px]" style={{ color: 'rgba(251,191,36,0.7)' }}>
          加载失败，刷新页面后重试
        </div>
      )}
      {wallet.sessionsReady && wallet.sessions.length === 0 && (
        <div className="px-3 py-2 text-[12px]" style={{ color: 'rgba(196,181,253,0.45)' }}>
          暂无练习记录
        </div>
      )}
      {wallet.sessionsReady &&
        wallet.sessions.slice(0, 5).map((s) => (
          /* existing row markup */
        ))}
    </div>
  )}
</section>
```

Always render the section (even with zero sessions) so users can expand once.

Header: stop passing sound toggle / balance once Task 5 simplifies props; interim keep compiling.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @rosie/calc typecheck`  
Expected: PASS for home changes (or only remaining header prop noise)

- [ ] **Step 7: Commit**

```bash
git add packages/calc/src/pages/home.tsx
git commit -m "$(cat <<'EOF'
feat(calc): slim home to practice-only with lazy recent sessions

EOF
)"
```

---

### Task 4: Session prep — remove「设为默认」

**Files:**
- Modify: `packages/calc/src/components/SessionPrepScreen.tsx`
- Modify: `packages/calc/src/pages/session.tsx` (prep props only in this task)

**Interfaces:**
- Produces: `SessionPrepScreen` props without `onSaveDefault`

- [ ] **Step 1: Update `SessionPrepScreen` props and UI**

Remove from `Props`: `onSaveDefault`.  
Remove `saved` state, `handleSaveDefault`, and the middle「设为默认」button.  
Keep ← 返回 + 🚀 开始练习. Adjust flex so start button still dominant (`flex-[2]` or full-width next to back).

- [ ] **Step 2: Update `session.tsx` prep call site**

Remove:

```tsx
onSaveDefault={() => update({ timingMode: prepTimingMode, bonusSec: clampBonusSec(prepBonusSec) })}
```

Keep `prepTimingMode` / `prepBonusSec` overrides for the run only. Do not call `update` for timing from prep.

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @rosie/calc typecheck`  
Expected: PASS

```bash
git add packages/calc/src/components/SessionPrepScreen.tsx packages/calc/src/pages/session.tsx
git commit -m "$(cat <<'EOF'
feat(calc): drop set-as-default from session prep

EOF
)"
```

---

### Task 5: Header cleanup + strip child sound toggles + FAQ/docs

**Files:**
- Modify: `packages/calc/src/components/CalcAppHeader.tsx`
- Modify: `packages/calc/src/pages/session.tsx`, `mistakes.tsx`, `faq.tsx`, `report.tsx`, `settings.tsx`, `home.tsx` (call sites)
- Modify: `packages/calc/FAQ.md`
- Modify: `packages/calc/CLAUDE.md`

**Interfaces:**
- Produces:

```ts
interface Props {
  title?: string
  backHref?: string
  backLabel?: string
  onBack?: () => void
  rightExtra?: React.ReactNode
}
```

- [ ] **Step 1: Slim `CalcAppHeader` props**

Delete `balance`, `soundEnabled`, `onToggleSound` from the interface and remove commented sound button markup. Keep title / back / `rightExtra`.

- [ ] **Step 2: Fix all call sites**

Remove `balance=…`, `soundEnabled=…`, `onToggleSound=…` from every `CalcAppHeader` usage in calc pages.  
Keep `playSfx(..., settings.soundEnabled)` wherever SFX already runs — children still **hear** admin-configured sound, they just cannot toggle it.

On `faq.tsx`: replace「去设置」link with either remove it or:

```tsx
<Link href="/admin/calc" …>家长设置</Link>
```

(Prefer linking `/admin/calc` for parents who open FAQ.)

- [ ] **Step 3: Update FAQ.md + CLAUDE.md**

`FAQ.md` section「开始前：先选练什么」: change「打开 口算 → 设置」to「打开 **管理后台 → 口算设置**（`/admin/calc`）」; note child home has no settings.

`CLAUDE.md`: note settings UI is admin-hosted at `/admin/calc`; child `/calc/settings` removed; home lazy-loads wallet sessions for recent list.

- [ ] **Step 4: Typecheck both packages**

Run:

```bash
pnpm --filter @rosie/calc typecheck
pnpm --filter web typecheck
```

Expected: PASS

- [ ] **Step 5: Manual verification checklist (do in browser)**

1. `/admin` shows「口算设置」→ `/admin/calc` edits persist  
2. `/calc` has no settings / count bar / sound control; voucher shows「去兑换」without stars  
3. Network: opening `/calc` does not hit full `calc_sessions` select until「最近练习」expanded  
4. Expand twice → only one sessions fetch (second expand uses cache)  
5. Prep: can change timing; no「设为默认」; reload settings in admin → defaults unchanged after prep-only edit  
6. `/calc/settings` → 404  

- [ ] **Step 6: Commit**

```bash
git add packages/calc/src/components/CalcAppHeader.tsx \
  packages/calc/src/pages/session.tsx \
  packages/calc/src/pages/mistakes.tsx \
  packages/calc/src/pages/faq.tsx \
  packages/calc/src/pages/report.tsx \
  packages/calc/src/pages/settings.tsx \
  packages/calc/src/pages/home.tsx \
  packages/calc/FAQ.md \
  packages/calc/CLAUDE.md
git commit -m "$(cat <<'EOF'
refactor(calc): remove child sound toggles; document admin settings

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| All settings incl. sound → admin | 2, 5 |
| `/admin/calc` + hub card | 2 |
| Delete `/calc/settings`, no redirect | 2 |
| Child no settings/sound/count UI | 3, 5 |
| Prep override, no 设为默认 | 4 |
| Voucher quick link, no stars | 3 |
| Drop 本周星星 | 3 |
| Today progress without eager sessions | 1, 3 |
| Recent sessions accordion + lazy + no refetch | 3 |
| FAQ / CLAUDE updates | 5 |
| No schema / no broad invalidate | all |

No placeholders left. Types: `todayProblems` / `todayCorrect` from Task 1 used in Task 3; `sessionsRequested` sticky flag matches store `sessionsReady` short-circuit in `useCalcWallet`.
