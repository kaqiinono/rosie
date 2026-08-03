# Calc settings → admin + slim home — design

**Date:** 2026-08-03  
**Package:** `@rosie/calc`, `apps/web` (admin hub), `@rosie/rewards` (lazy sessions only)  
**Status:** Approved for planning  
**Related:** Session timing modes `2026-07-09-calc-session-timing-modes-design.md`; session-store data fetch (`.cursor/rules/session-store-data-fetch.mdc`)

## Goal

1. Move all 口算 configuration to the admin hub so the child only practices — no settings UI on the child calc surface.
2. Make the home「我的奖券」card a quick link only (no star balance).
3. Cut unnecessary homepage network work: no eager `calc_sessions` detail fetch; load recent sessions only when the user expands that section, and reuse the in-session cache until a full page refresh.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| What moves to admin | **Everything** in today’s settings (blocks, mixed ops, counts, timing, toggles, **including sound**) |
| Child surface | Practice only — no settings entry, no sound toggle, no homepage count editor |
| Session prep | Keep per-run timing override; **remove「设为默认」** (no write-back to `calc_settings`) |
| Admin route | New `/admin/calc`; card on `/admin` hub |
| Old `/calc/settings` | **Delete** the child route (no redirect to admin) |
| FAQ / in-app links | Drop or reword child「去设置」links; parent path is `/admin/calc` |
| Homepage stats | Keep practice summary + today progress + week/month/year counts; **drop「本周星星」** |
| Recent sessions | Keep list; **collapsed by default**; fetch on first expand; no refetch on later expands in the same page lifetime |
| Voucher card | Quick link only — no `wallet.balance` / star count |

## Approach

**Relocate existing settings page body to admin; slim calc home + lazy sessions (recommended).**

- Reuse `packages/calc/src/pages/settings.tsx` (or a thin rename/export) behind `apps/web/src/app/admin/calc/page.tsx`.
- Add an admin hub tool card pointing at `/admin/calc`.
- Remove `apps/web/src/app/calc/settings/` (no redirect).
- Strip child home of settings/count/sound controls; derive today progress from `calcSessionSummariesStore` (already used by `useCalcPracticeStats`) instead of `wallet.sessions`.
- Home calls `useCalcWallet(user)` **without** `loadSessions: true`; expand「最近练习」triggers `loadWalletSessions` once (`sessionsReady` / store patch already short-circuits repeats).

Rejected:

- Rebuild settings UI in admin cream theme in the same change (skin-only; defer).
- Keep `/calc/settings` and only hide the link (child can still deep-link and edit).
- Redirect `/calc/settings` → `/admin/calc` (explicitly out of scope).

## §1 Admin settings

### Route & hub

- `apps/web/src/app/admin/calc/page.tsx` — thin shell re-exporting the calc settings page body (same pattern as other admin subject tools).
- `apps/web/src/app/admin/page.tsx` — add tool card, e.g. title「口算设置」, href `/admin/calc`, description about题型 / 题量 / 计时 / 音效.

### Data

- Unchanged table: `calc_settings` (per logged-in `user_id`).
- Same hook: `useCalcSettings` / `calcSettingsStore` — admin edits the current user’s row (single-child app).

### Chrome

- Prefer keeping the existing calc-dark settings UI for v1 (minimal diff). Optional later: admin light chrome wrapper with back link to `/admin`.
- Settings page back target should go to `/admin` (not `/calc`).

## §2 Child calc surface

### Home (`packages/calc/src/pages/home.tsx`)

Remove:

- 「⚙ 设置」link
- 「练习题量」`CalcConfigBar` / manual-mode link to settings
- Sound toggle wiring (header already largely unused for sound/balance; stop passing update handlers for settings writes from home where possible)
- 「本周星星」line under 本周 stats
- Star balance under「我的奖券」

Keep / adjust:

- Read-only practice content chips (from settings)
- Today progress: compute from `useCalcPracticeStats` / `calcSessionSummariesStore` today rows (same fields as `useCalcDaily`), **not** from `wallet.sessions`
- Week / month / year / cumulative from `useCalcPracticeStats`
- CTA「开始口算」
- 错题本 / 我的奖券（快链）/ 练习报告 / 口算说明
- 「最近练习」as a **collapsed** disclosure:
  - Collapsed: no `loadSessions`
  - First expand: call wallet session loader (export/use existing `loadWalletSessions` path via `useCalcWallet(..., { loadSessions: true })` toggled on expand, or an explicit `ensureSessionsLoaded()` helper)
  - After `sessionsReady` (or failed settle): further collapse/expand must not refetch until full page remount / refresh (session store already holds data; do not `invalidate`)

Voucher card copy example: title「我的奖券」, subtitle「去兑换」or「查看奖券」— no stars.

### Session prep (`SessionPrepScreen` + `session.tsx`)

- Keep timing mode / bonus override for this run only.
- Remove「设为默认」button and `onSaveDefault` → `update({ timingMode, bonusSec })`.
- Defaults still preload from `calc_settings`.

### Other child pages

- `mistakes` / `faq` / `report` / `session`: remove sound-toggle UI if still exposed; SFX still honor `settings.soundEnabled` from store (admin-set).
- FAQ: remove or reword links to `/calc/settings`; mention parent configures at `/admin/calc` if needed.
- Delete route shell `apps/web/src/app/calc/settings/page.tsx`.

### Header (`CalcAppHeader`)

- Stop requiring `soundEnabled` / `onToggleSound` / `balance` for child flows once call sites are cleaned (optional prop cleanup in same change if low-risk).

## §3 Requests / caching

| On `/calc` mount | Source |
|------------------|--------|
| Settings (read) | `calcSettingsStore` |
| Practice aggregates + today counts | `calcSessionSummariesStore` via `useCalcPracticeStats` (and small today helper if needed) |
| Mistakes badge | `useCalcMistakes` / existing store |
| Wallet light (optional) | Only if still needed for something else on home; **not** for voucher stars. Prefer **not** mounting wallet on home if unused after slim. |
| Session detail rows | **Lazy** on first「最近练习」expand |

Do **not** call `invalidateSessionStore()` broadly. Prefer `patchSessionData` / existing `sessionsReady` short-circuit.

StarHud elsewhere may already load light wallet — home must not force sessions.

## §4 Out of scope

- RLS / multi-user admin editing another child’s `user_id`
- Redesigning settings into admin cream theme
- Changing voucher redeem page behavior
- Schema migrations (no new columns)

## §5 Verification

- Admin hub shows「口算设置」; `/admin/calc` can change blocks/count/sound and those values apply on next child session.
- `/calc` has no settings / sound / count editor; voucher card shows no star count.
- Network: opening `/calc` does not request full `calc_sessions` detail until「最近练习」is expanded; second expand does not re-request.
- Session prep still allows timing override; no「设为默认」; settings row unchanged after prep-only edits.
- `/calc/settings` 404 (route removed); no redirect.
- `pnpm --filter @rosie/calc typecheck` and app typecheck/lint clean for touched packages.
