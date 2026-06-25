# Robot Module — Sub-project A: Foundation + Task CRUD Page (Design)

**Date:** 2026-06-25
**Status:** Approved (design); ready for implementation plan
**Source contract:** [`docs/robot/dify.md`](../../robot/dify.md) — 果果的 AI 魔法学习顾问 Dify Chatflow

---

## 1. Context

We are adding an **intelligent-robot module** (`@rosie/robot`) to the Rosie monorepo. The robot
is orchestrated in Dify (see `docs/robot/dify.md`): a Python state machine + LLM that talks to a
7-year-old ("果果"), reads her current task list, drives a stage machine (`IDLE / READY /
LEARNING / BREAK`), and settles 金币 rewards. Vercel (this app) owns persistence; Dify owns
language + business logic.

The **full feature** is three+ subsystems. To keep each spec implementable, the work is
decomposed and built in dependency order. **This document specifies Sub-project A only.**

| | Sub-project | Scope | Depends on |
|---|---|---|---|
| **A** | **Foundation + Task CRUD page** | `@rosie/robot` package, `robot_tasks` table, `useRobotTasks` hook, `/admin/robot` 增删改查 UI, hub card, wiring | — |
| B | Dify 对话 API + stage 状态机 | `/api/robot` Route Handler; snapshot maps derived status → Dify enum; persists stage/tasks | A |
| C | 对话 UI（果果端） | Kid-facing voice/chat page under `/robot`; mic → API B → TTS speech_text | B |
| D | 打卡页完成集成 | quick_link 打卡页完成 → `completeTask` + 奖励入账 `source:'robot'` into `star_sessions` | A |

---

## 2. Goals / Non-goals (Sub-project A)

**Goals**
- Stand up the `@rosie/robot` package following the established package pattern (mirrors `@rosie/calc`).
- Persist robot tasks in Supabase (`robot_tasks`), per-user, matching the Dify `current_tasks` schema.
- Provide a parent-facing CRUD management page at `/admin/robot` (create / read / update / delete).
- Status is **fully automatic / derived** — never a manual control.

**Non-goals (explicitly deferred)**
- Calling the Dify API / parsing `final_json` / the stage machine → **B**.
- Kid-facing voice/chat UI → **C**.
- The actual completion *trigger* from the 打卡页 and the coin write into `star_sessions`
  (`source:'robot'`) + the robot star color/shape decision → **D**.

---

## 3. Status model (key design decision)

The Dify doc's status enum is **command-driven** (`READY → LEARNING` on "开始",
`LEARNING → COMPLETED` on "完成"). We intentionally **diverge**: status is **time-derived**,
which fits a schedule-based kid app better. Three of the four states are a pure function of time
and are **not stored**. Only completion is persisted (`completed_at`).

```
deriveStatus(task, now):
  if task.completed_at        → 'COMPLETED'    已完成 ✅
  elif now <  start_time      → 'NOT_STARTED'  未开始
  elif now <= end_time        → 'IN_PROGRESS'  进行中 🔥
  else (now > end_time)       → 'EXPIRED'      已过期 ⏰
```

- `start_time` / `end_time` are `HH:MM` (same-day window).
- The only event that flips a task to `COMPLETED` is an explicit completion of the **quick_link
  打卡页** (wired in **D**). Sub-project A only creates the `completed_at` column and the
  `completeTask(id)` primitive that sets it.

**Divergence boundary (for B, noted here so it isn't lost):** at the Dify snapshot boundary, B
maps derived status → Dify enum: `NOT_STARTED → READY`, `IN_PROGRESS → LEARNING`,
`COMPLETED → COMPLETED`. How `EXPIRED` is presented to Dify (omit / send as `READY`) is decided
in B. A does not depend on this.

---

## 4. Data model — `robot_tasks` (Supabase)

Per-user table (every data hook is keyed off `user`, like the rest of the app). Delivered as
`docs/robot/robot-tasks.sql` (table + indexes + RLS), following how other tables are set up.

| column | type | notes |
|---|---|---|
| `id` | `text` PK | Dify task id, generated `task_<n>` style (e.g. `task_001`); stable for Dify matching |
| `user_id` | `uuid` not null | owner; FK to `auth.users`; RLS scopes all access to `auth.uid()` |
| `title` | `text` not null | 任务标题, e.g. 写口算题卡 |
| `content` | `text` not null default `''` | 具体要求/描述 |
| `start_time` | `text` not null | 建议开始时间, `HH:MM` |
| `end_time` | `text` not null | 预期结束时间, `HH:MM` |
| `reward_coins` | `integer` not null default `10` | 完成奖励金币数 |
| `quick_link` | `text` not null default `''` | 打卡页相对路径 (plain text) |
| `completed_at` | `timestamptz` null | null = 未完成; set by D |
| `sort_order` | `integer` not null default `0` | manual ordering in the list |
| `created_at` | `timestamptz` not null default `now()` | |
| `updated_at` | `timestamptz` not null default `now()` | bumped on update |

- **RLS:** enable; policies for select/insert/update/delete `using (auth.uid() = user_id)`.
- **Index:** `(user_id, sort_order)` for ordered fetch.
- Note vs Dify schema: Dify's `status` field is NOT stored (derived). Dify's required fields
  (`id, title, content, start_time, end_time, status, reward_coins, quick_link`) are all
  reproducible — B reconstructs `status` from `deriveStatus` when building the snapshot.

---

## 5. Package: `@rosie/robot`

Structure mirrors `@rosie/calc`:

```
packages/robot/
  package.json        # name @rosie/robot, main/types ./src/index.ts, barrel exports
  tsconfig.json
  CLAUDE.md           # module guide
  src/
    index.ts          # barrel: types, helpers, hook, RobotTaskManager
    robot-types.ts     # RobotTask, RobotTaskStatus, RobotTasksSnapshot
    robot-status.ts    # deriveStatus(task, now), STATUS_LABELS, STATUS color tokens
    useRobotTasks.ts   # Supabase-direct CRUD hook
    RobotTaskManager.tsx  # the /admin/robot page body
    (RobotTaskForm.tsx / RobotTaskRow.tsx as the UI is broken down)
    robot.css         # only if module-specific CSS is needed (imported once from index)
```

- **Deps:** `@rosie/core` (supabase, AuthContext types, `todayStr`/time utils, shared types),
  `@rosie/ui` (shared buttons/chrome). `@supabase/supabase-js`. Peer: next/react/react-dom.
- **DAG:** `robot → core, ui` (and `→ rewards` added later in D). No cycles; robot is a leaf
  subject module, imported only by route shells in `apps/web`.

### Types (`robot-types.ts`)
```ts
export type RobotTaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'EXPIRED' | 'COMPLETED'

export interface RobotTask {
  id: string
  title: string
  content: string
  startTime: string      // HH:MM   (start_time)
  endTime: string        // HH:MM   (end_time)
  rewardCoins: number    // reward_coins
  quickLink: string      // quick_link
  completedAt: string | null
  sortOrder: number
}

// Shape B sends to Dify: { tasks: RobotTask[] } (status reconstructed at the boundary)
export interface RobotTasksSnapshot { tasks: RobotTask[] }
```
(camelCase in TS; `rowToTask` / `taskToRow` map to snake_case columns, mirroring `useCalcWallet`'s
`rowToSession`.)

### Helper (`robot-status.ts`)
- `deriveStatus(task: RobotTask, now?: Date): RobotTaskStatus` — pure, time-based per §3.
- `STATUS_LABELS: Record<RobotTaskStatus, string>` — 未开始 / 进行中 / 已过期 / 已完成.
- Status chip color tokens (kept in-package, not in globals.css unless promoted).

### Hook (`useRobotTasks.ts`)
`useRobotTasks(user: User | null)` returns:
```
{ tasks: RobotTask[], loading: boolean,
  addTask(input), updateTask(id, patch), deleteTask(id),
  reorderTasks(orderedIds), completeTask(id), refresh() }
```
- No-ops entirely when `user` is null (consistent with all hooks).
- Reads `robot_tasks` ordered by `sort_order`; writes via **per-row** mutations (insert / update /
  delete), never a destructive bulk upsert (per the project's word-CRUD convention).
- `addTask` generates the `task_<n>` id (next sequential / collision-safe) and `sort_order`.
- `updateTask` bumps `updated_at`.
- `completeTask(id)` sets `completed_at = now()` (the coin write into `star_sessions` is **D**).
- Optional lightweight local cache is out of scope for A (task counts are small).

---

## 6. UI — `/admin/robot`

- **Route shell** `apps/web/src/app/admin/robot/page.tsx` (thin, `'use client'`):
  reads `user` from `useAuth()`, renders `<RobotTaskManager user={user} />`. Mirrors
  `apps/web/src/app/admin/words/page.tsx`.
- **`RobotTaskManager`** (in package):
  - Header consistent with other `/admin/*` pages: back-to-home button + light gradient
    (`linear-gradient(160deg,#fffbeb,#fff1f2,#eff6ff)`), `请先登录` guard when `!user`.
  - **List**: one card/row per task showing title, `HH:MM–HH:MM` window, **derived-status chip**
    (auto, read-only: 未开始 / 进行中🔥 / 已过期⏰ / 已完成✅), reward_coins, quick_link.
    Ordered by `sort_order`.
  - **Add task** button → `RobotTaskForm` (modal): title, content, start_time, end_time,
    reward_coins, quick_link. No status field.
  - Per-row **Edit** → same form prefilled. Per-row **Delete** → confirm.
  - **No** status control and **no** reset button (status is fully automatic).
  - Empty state: friendly prompt to add the first task.
- **Design:** run the `frontend-design` skill before building `RobotTaskManager` (per project
  preference). The page is parent-facing admin, so it should match the existing `/admin/*`
  aesthetic rather than the kid-playful tone (which belongs to C).

---

## 7. Wiring (the migration checklist gotchas)

1. `apps/web/next.config.ts` — add `'@rosie/robot'` to `transpilePackages`.
2. `apps/web/src/app/globals.css` — add `@source "../../../../packages/robot/src";`
   (**required** or the package's Tailwind classes won't be generated — the silent styling break
   from `docs/bug-report.md`).
3. `apps/web/src/app/admin/page.tsx` — add a `🤖 机器人任务` tool card linking to `/admin/robot`.
4. `packages/robot/CLAUDE.md` — module guide (DAG position, schema, status model, deferred B/C/D).
5. `pnpm-workspace.yaml` already globs `packages/*` — no change.
6. Root `CLAUDE.md` monorepo layout + module table — add the `@rosie/robot` row in the same change.

---

## 8. Testing / verification

- `pnpm --filter @rosie/robot typecheck` and `pnpm --filter web build` are green.
- Manual: `/admin/robot` lists, adds, edits, deletes tasks; derived-status chip shows correct
  state for tasks whose window is before/within/after now, and 已完成 when `completed_at` is set
  (can be verified by setting `completed_at` directly in Supabase until D exists).
- `robot-tasks.sql` applies cleanly; RLS confirmed (a user sees only their own rows).
- Per project convention, the user runs lint/build manually; the implementation will flag when
  it's time to run them rather than running verification commands unprompted.

---

## 9. Open items carried to later sub-projects (not blocking A)

- **B:** derived→Dify enum mapping at snapshot; `EXPIRED` presentation to Dify; `robot_state`
  table for stage (`IDLE/READY/LEARNING/BREAK`); env vars `DIFY_API_ENDPOINT` / `DIFY_API_KEY`;
  coin read from `star_sessions`.
- **D:** how the quick_link 打卡页 identifies the active robot task (route match / id param);
  `completeTask` extended to write `star_sessions` (`source:'robot'`, `coins_earned=reward_coins`,
  `ref_id=task.id`); the `'robot'` star color/shape decision (reward-icons currently
  yellow=calc / red=english / blue=math) and its handling in `useCalcWallet` + `StarHud`.
