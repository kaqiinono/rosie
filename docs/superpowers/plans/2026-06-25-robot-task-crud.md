# Robot Task CRUD (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `@rosie/robot` package with a Supabase-backed task model and a parent-facing `/admin/robot` 增删改查 page, with fully time-derived task status.

**Architecture:** New leaf subject package `@rosie/robot` (mirrors `@rosie/calc`). A `robot_tasks` Supabase table (per-user, composite PK `(user_id, id)`) stores configurable fields only — status is derived in code from `start_time`/`end_time`/`completed_at`. A `useRobotTasks(user)` hook does Supabase-direct per-row CRUD; a thin route shell at `apps/web/src/app/admin/robot/page.tsx` renders the in-package `RobotTaskManager`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, Supabase JS, Vitest (for the pure status helper).

**Spec:** `docs/superpowers/specs/2026-06-25-robot-task-crud-design.md`

**Project conventions that override default plan habits:**
- No per-package test runner exists; only `apps/web` has Vitest. TDD applies to the **pure `deriveStatus` helper** (Task 2). The hook/UI are verified via `pnpm --filter @rosie/robot typecheck` + `pnpm --filter web build`.
- Per project preference, the human runs final `pnpm lint`/`build` manually; the executor runs scoped `typecheck`/`test`/`build` to confirm each task.
- `'use client'` at top of every client component. No `any`. `type` for component props, `interface` for DB/response shapes.

---

## File Structure

**Created:**
- `packages/robot/package.json` — package manifest (`@rosie/robot`, barrel)
- `packages/robot/tsconfig.json` — extends base
- `packages/robot/src/index.ts` — barrel
- `packages/robot/src/robot-types.ts` — `RobotTask`, `RobotTaskStatus`, `RobotTaskInput`, `RobotTasksSnapshot`
- `packages/robot/src/robot-status.ts` — `deriveStatus`, `STATUS_LABELS`
- `packages/robot/src/useRobotTasks.ts` — Supabase CRUD hook
- `packages/robot/src/RobotTaskForm.tsx` — add/edit modal form
- `packages/robot/src/RobotTaskManager.tsx` — page body
- `packages/robot/CLAUDE.md` — module guide
- `apps/web/src/app/admin/robot/page.tsx` — route shell
- `apps/web/tests/robot-status.test.ts` — unit test for `deriveStatus`
- `docs/robot/robot-tasks.sql` — table + RLS

**Modified:**
- `apps/web/next.config.ts` — add `'@rosie/robot'` to `transpilePackages`
- `apps/web/src/app/globals.css` — add `@source` line for the package
- `apps/web/src/app/admin/page.tsx` — add `🤖 机器人任务` card
- `CLAUDE.md` (root) — add `@rosie/robot` to layout + module table

---

## Task 1: Scaffold `@rosie/robot` package + wiring

**Files:**
- Create: `packages/robot/package.json`, `packages/robot/tsconfig.json`, `packages/robot/src/index.ts`
- Modify: `apps/web/next.config.ts`, `apps/web/src/app/globals.css`

- [ ] **Step 1: Create `packages/robot/package.json`**

```json
{
  "name": "@rosie/robot",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@rosie/core": "workspace:*",
    "@rosie/ui": "workspace:*",
    "@supabase/supabase-js": "^2.99.2"
  },
  "peerDependencies": {
    "next": "^15.2.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.12",
    "@types/react-dom": "^19.0.4",
    "next": "^15.2.4",
    "react": "^19.0.0",
    "typescript": "^5.8.2"
  }
}
```

- [ ] **Step 2: Create `packages/robot/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: Create a temporary `packages/robot/src/index.ts`** (filled in later tasks)

```ts
// @rosie/robot — robot module: task data + admin CRUD page.
export {}
```

- [ ] **Step 4: Add `@rosie/robot` to `transpilePackages` in `apps/web/next.config.ts`**

Find the `transpilePackages` array (line ~6) and append `'@rosie/robot'`:

```ts
  transpilePackages: ['@rosie/core', '@rosie/rewards', '@rosie/player', '@rosie/ui', '@rosie/calc', '@rosie/math', '@rosie/english', '@rosie/flipbook', '@rosie/audio', '@rosie/robot'],
```

- [ ] **Step 5: Add the `@source` line in `apps/web/src/app/globals.css`**

After the existing `@source "../../../../packages/audio/src";` line (line ~15), add:

```css
@source "../../../../packages/robot/src";
```

> ⚠️ This is mandatory — without it the package's Tailwind utility classes are NOT generated and the build won't catch it (see `docs/bug-report.md`).

- [ ] **Step 6: Install so the workspace links the new package**

Run: `pnpm install`
Expected: completes without error; `@rosie/robot` appears in the workspace.

- [ ] **Step 7: Commit**

```bash
git add packages/robot apps/web/next.config.ts apps/web/src/app/globals.css pnpm-lock.yaml
git commit -m "feat(robot): scaffold @rosie/robot package + wiring"
```

---

## Task 2: Types + `deriveStatus` helper (TDD)

**Files:**
- Create: `packages/robot/src/robot-types.ts`, `packages/robot/src/robot-status.ts`
- Test: `apps/web/tests/robot-status.test.ts`
- Modify: `packages/robot/src/index.ts`

- [ ] **Step 1: Create `packages/robot/src/robot-types.ts`**

```ts
export type RobotTaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'EXPIRED' | 'COMPLETED'

/** A robot task as used in the app (camelCase). Maps to the robot_tasks row. */
export interface RobotTask {
  id: string
  title: string
  content: string
  startTime: string // HH:MM (start_time)
  endTime: string // HH:MM (end_time)
  rewardCoins: number // reward_coins
  quickLink: string // quick_link
  completedAt: string | null // completed_at; null = not completed
  sortOrder: number // sort_order
}

/** Fields a parent can configure via the CRUD form (status is never an input). */
export interface RobotTaskInput {
  title: string
  content: string
  startTime: string
  endTime: string
  rewardCoins: number
  quickLink: string
}

/** Shape Sub-project B sends to Dify (status reconstructed at the boundary). */
export interface RobotTasksSnapshot {
  tasks: RobotTask[]
}
```

- [ ] **Step 2: Update `packages/robot/src/index.ts` so the test can import**

```ts
// @rosie/robot — robot module: task data + admin CRUD page.
export * from './robot-types'
export * from './robot-status'
```

- [ ] **Step 3: Write the failing test `apps/web/tests/robot-status.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { deriveStatus } from '@rosie/robot'
import type { RobotTask } from '@rosie/robot'

const task = (o: Partial<RobotTask> = {}): RobotTask => ({
  id: 'task_001',
  title: 't',
  content: '',
  startTime: '09:00',
  endTime: '10:00',
  rewardCoins: 10,
  quickLink: '',
  completedAt: null,
  sortOrder: 0,
  ...o,
})
const at = (h: number, m: number) => new Date(2026, 5, 25, h, m)

describe('deriveStatus', () => {
  it('COMPLETED when completedAt set, regardless of time', () => {
    expect(deriveStatus(task({ completedAt: '2026-06-25T00:00:00Z' }), at(9, 30))).toBe('COMPLETED')
  })
  it('NOT_STARTED before the window', () => {
    expect(deriveStatus(task(), at(8, 59))).toBe('NOT_STARTED')
  })
  it('IN_PROGRESS within the window (inclusive of both ends)', () => {
    expect(deriveStatus(task(), at(9, 0))).toBe('IN_PROGRESS')
    expect(deriveStatus(task(), at(9, 30))).toBe('IN_PROGRESS')
    expect(deriveStatus(task(), at(10, 0))).toBe('IN_PROGRESS')
  })
  it('EXPIRED after the window', () => {
    expect(deriveStatus(task(), at(10, 1))).toBe('EXPIRED')
  })
  it('NOT_STARTED when times are malformed', () => {
    expect(deriveStatus(task({ startTime: '', endTime: '' }), at(12, 0))).toBe('NOT_STARTED')
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run tests/robot-status.test.ts`
Expected: FAIL — `deriveStatus` is not exported / not a function.

- [ ] **Step 5: Create `packages/robot/src/robot-status.ts`**

```ts
import type { RobotTask, RobotTaskStatus } from './robot-types'

export const STATUS_LABELS: Record<RobotTaskStatus, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  EXPIRED: '已过期',
  COMPLETED: '已完成',
}

/** Parse "HH:MM" to minutes since midnight; returns NaN on malformed input. */
function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Time-derived status. Completion is the only persisted state (completedAt);
 * the other three are a pure function of the clock vs the HH:MM window.
 * Window is inclusive of both start and end. Malformed times → NOT_STARTED.
 */
export function deriveStatus(task: RobotTask, now: Date = new Date()): RobotTaskStatus {
  if (task.completedAt) return 'COMPLETED'
  const start = toMinutes(task.startTime)
  const end = toMinutes(task.endTime)
  if (Number.isNaN(start) || Number.isNaN(end)) return 'NOT_STARTED'
  const cur = now.getHours() * 60 + now.getMinutes()
  if (cur < start) return 'NOT_STARTED'
  if (cur <= end) return 'IN_PROGRESS'
  return 'EXPIRED'
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run tests/robot-status.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/robot/src apps/web/tests/robot-status.test.ts
git commit -m "feat(robot): RobotTask types + time-derived status helper"
```

---

## Task 3: `robot_tasks` SQL (table + RLS)

**Files:**
- Create: `docs/robot/robot-tasks.sql`

- [ ] **Step 1: Create `docs/robot/robot-tasks.sql`**

```sql
-- ============================================================
-- robot_tasks: 机器人任务（果果的 AI 魔法学习顾问）
--   status 不入库：由 start_time/end_time/completed_at 派生
--   （见 docs/superpowers/specs/2026-06-25-robot-task-crud-design.md §3）
--   完成（completed_at）由 sub-project D（打卡页完成）写入。
-- ============================================================
create table if not exists robot_tasks (
  id           text not null,                    -- Dify task id, e.g. task_001 (unique per user)
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  content      text not null default '',
  start_time   text not null,                    -- HH:MM
  end_time     text not null,                    -- HH:MM
  reward_coins integer not null default 10,
  quick_link   text not null default '',
  completed_at timestamptz,                       -- null = 未完成
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists robot_tasks_user_id_sort_idx on robot_tasks(user_id, sort_order);

alter table robot_tasks enable row level security;
create policy "users read own robot_tasks"
  on robot_tasks for select using (auth.uid() = user_id);
create policy "users insert own robot_tasks"
  on robot_tasks for insert with check (auth.uid() = user_id);
create policy "users update own robot_tasks"
  on robot_tasks for update using (auth.uid() = user_id);
create policy "users delete own robot_tasks"
  on robot_tasks for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit** (the human applies this SQL in the Supabase SQL editor; no automated run)

```bash
git add docs/robot/robot-tasks.sql
git commit -m "feat(robot): robot_tasks table + RLS sql"
```

---

## Task 4: `useRobotTasks` hook

**Files:**
- Create: `packages/robot/src/useRobotTasks.ts`
- Modify: `packages/robot/src/index.ts`

- [ ] **Step 1: Create `packages/robot/src/useRobotTasks.ts`**

```ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type { RobotTask, RobotTaskInput } from './robot-types'

const TABLE = 'robot_tasks'
const SELECT_COLS =
  'id, title, content, start_time, end_time, reward_coins, quick_link, completed_at, sort_order'

interface RobotTaskRow {
  id: string
  title: string
  content: string
  start_time: string
  end_time: string
  reward_coins: number
  quick_link: string
  completed_at: string | null
  sort_order: number
}

function rowToTask(r: RobotTaskRow): RobotTask {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    startTime: r.start_time,
    endTime: r.end_time,
    rewardCoins: r.reward_coins,
    quickLink: r.quick_link,
    completedAt: r.completed_at,
    sortOrder: r.sort_order,
  }
}

/** Next per-user sequential id: max existing task_<n> + 1, zero-padded to 3. */
function nextTaskId(tasks: RobotTask[]): string {
  let max = 0
  for (const t of tasks) {
    const m = /^task_(\d+)$/.exec(t.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `task_${String(max + 1).padStart(3, '0')}`
}

export function useRobotTasks(user: User | null) {
  const [tasks, setTasks] = useState<RobotTask[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setTasks([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT_COLS)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
    if (error) console.error('[robot] fetch failed', error)
    else setTasks((data as RobotTaskRow[]).map(rowToTask))
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addTask = useCallback(
    async (input: RobotTaskInput) => {
      if (!user) return
      const id = nextTaskId(tasks)
      const sortOrder = tasks.reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1
      const { error } = await supabase.from(TABLE).insert({
        id,
        user_id: user.id,
        title: input.title,
        content: input.content,
        start_time: input.startTime,
        end_time: input.endTime,
        reward_coins: input.rewardCoins,
        quick_link: input.quickLink,
        sort_order: sortOrder,
      })
      if (error) {
        console.error('[robot] add failed', error)
        return
      }
      await refresh()
    },
    [user, tasks, refresh],
  )

  const updateTask = useCallback(
    async (id: string, patch: Partial<RobotTaskInput>) => {
      if (!user) return
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.title !== undefined) row.title = patch.title
      if (patch.content !== undefined) row.content = patch.content
      if (patch.startTime !== undefined) row.start_time = patch.startTime
      if (patch.endTime !== undefined) row.end_time = patch.endTime
      if (patch.rewardCoins !== undefined) row.reward_coins = patch.rewardCoins
      if (patch.quickLink !== undefined) row.quick_link = patch.quickLink
      const { error } = await supabase
        .from(TABLE)
        .update(row)
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) {
        console.error('[robot] update failed', error)
        return
      }
      await refresh()
    },
    [user, refresh],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      if (!user) return
      const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', user.id)
      if (error) {
        console.error('[robot] delete failed', error)
        return
      }
      await refresh()
    },
    [user, refresh],
  )

  const reorderTasks = useCallback(
    async (orderedIds: string[]) => {
      if (!user) return
      await Promise.all(
        orderedIds.map((id, i) =>
          supabase.from(TABLE).update({ sort_order: i }).eq('id', id).eq('user_id', user.id),
        ),
      )
      await refresh()
    },
    [user, refresh],
  )

  // completed_at is set here as a primitive; the coin write into star_sessions
  // (source:'robot') is layered in sub-project D.
  const completeTask = useCallback(
    async (id: string) => {
      if (!user) return
      const { error } = await supabase
        .from(TABLE)
        .update({ completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) {
        console.error('[robot] complete failed', error)
        return
      }
      await refresh()
    },
    [user, refresh],
  )

  return { tasks, loading, addTask, updateTask, deleteTask, reorderTasks, completeTask, refresh }
}
```

- [ ] **Step 2: Export the hook from `packages/robot/src/index.ts`**

```ts
// @rosie/robot — robot module: task data + admin CRUD page.
export * from './robot-types'
export * from './robot-status'
export { useRobotTasks } from './useRobotTasks'
```

- [ ] **Step 3: Verify it type-checks**

Run: `pnpm --filter @rosie/robot typecheck`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add packages/robot/src
git commit -m "feat(robot): useRobotTasks Supabase CRUD hook"
```

---

## Task 5: CRUD UI — `RobotTaskForm` + `RobotTaskManager`

> **Before writing the UI, invoke the `frontend-design` skill** (project rule: every component/modal/style change starts with frontend-design). Target user note: this is a **parent-facing admin** page — match the existing `/admin/*` aesthetic (light amber→rose→blue gradient, rounded cards), not the kid-playful tone. The code below is a complete, working baseline; refine visuals within these constraints, but keep the props, exports, and behavior intact.

**Files:**
- Create: `packages/robot/src/RobotTaskForm.tsx`, `packages/robot/src/RobotTaskManager.tsx`
- Modify: `packages/robot/src/index.ts`

- [ ] **Step 1: Invoke `frontend-design`** to guide the visual layer of the two components below.

- [ ] **Step 2: Create `packages/robot/src/RobotTaskForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { RobotTask, RobotTaskInput } from './robot-types'

type RobotTaskFormProps = {
  /** when set, the form is in edit mode and prefilled */
  initial?: RobotTask
  onSubmit: (input: RobotTaskInput) => void | Promise<void>
  onCancel: () => void
}

const EMPTY: RobotTaskInput = {
  title: '',
  content: '',
  startTime: '09:00',
  endTime: '09:30',
  rewardCoins: 10,
  quickLink: '',
}

export default function RobotTaskForm({ initial, onSubmit, onCancel }: RobotTaskFormProps) {
  const [form, setForm] = useState<RobotTaskInput>(
    initial
      ? {
          title: initial.title,
          content: initial.content,
          startTime: initial.startTime,
          endTime: initial.endTime,
          rewardCoins: initial.rewardCoins,
          quickLink: initial.quickLink,
        }
      : EMPTY,
  )
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof RobotTaskInput>(k: K, v: RobotTaskInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const valid = form.title.trim() !== '' && form.startTime !== '' && form.endTime !== ''

  const handleSubmit = async () => {
    if (!valid || saving) return
    setSaving(true)
    await onSubmit({ ...form, title: form.title.trim() })
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-slate-800">
          {initial ? '编辑任务' : '新增任务'}
        </h2>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">任务标题</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="例如：写口算题卡"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">任务内容</span>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={2}
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="具体要求或描述"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium text-slate-600">开始时间</span>
              <input
                type="time"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium text-slate-600">结束时间</span>
              <input
                type="time"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">奖励金币</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.rewardCoins}
              onChange={(e) => set('rewardCoins', Math.max(0, Number(e.target.value) || 0))}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">打卡页路径</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.quickLink}
              onChange={(e) => set('quickLink', e.target.value)}
              placeholder="例如：/calc"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!valid || saving}
            onClick={handleSubmit}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `packages/robot/src/RobotTaskManager.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { useRobotTasks } from './useRobotTasks'
import { deriveStatus, STATUS_LABELS } from './robot-status'
import type { RobotTask, RobotTaskInput, RobotTaskStatus } from './robot-types'
import RobotTaskForm from './RobotTaskForm'

type RobotTaskManagerProps = {
  user: User | null
}

const STATUS_CHIP: Record<RobotTaskStatus, { bg: string; fg: string; emoji: string }> = {
  NOT_STARTED: { bg: 'rgba(100,116,139,0.12)', fg: '#475569', emoji: '🕒' },
  IN_PROGRESS: { bg: 'rgba(245,158,11,0.16)', fg: '#b45309', emoji: '🔥' },
  EXPIRED: { bg: 'rgba(244,63,94,0.12)', fg: '#be123c', emoji: '⏰' },
  COMPLETED: { bg: 'rgba(16,185,129,0.14)', fg: '#047857', emoji: '✅' },
}

export default function RobotTaskManager({ user }: RobotTaskManagerProps) {
  const { tasks, loading, addTask, updateTask, deleteTask } = useRobotTasks(user)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RobotTask | null>(null)

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        请先登录
      </div>
    )
  }

  const openAdd = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (t: RobotTask) => {
    setEditing(t)
    setShowForm(true)
  }
  const handleSubmit = async (input: RobotTaskInput) => {
    if (editing) await updateTask(editing.id, input)
    else await addTask(input)
    setShowForm(false)
    setEditing(null)
  }
  const handleDelete = async (t: RobotTask) => {
    if (confirm(`删除任务「${t.title}」？`)) await deleteTask(t.id)
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg,#fffbeb 0%,#fff1f2 45%,#eff6ff 100%)' }}
    >
      <header
        className="sticky top-0 z-30 border-b border-amber-200/40 backdrop-blur"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        <div className="mx-auto flex h-14 max-w-[860px] items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700 transition hover:scale-110"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1.5px solid rgba(245,158,11,0.30)' }}
          >
            ←
          </Link>
          <h1 className="text-base font-bold text-slate-800">🤖 机器人任务</h1>
          <button
            className="ml-auto rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white"
            onClick={openAdd}
          >
            ＋ 新增任务
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-4 py-5">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">加载中…</p>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-500">还没有任务，点击右上角「新增任务」开始吧。</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map((t) => {
              const status = deriveStatus(t)
              const chip = STATUS_CHIP[status]
              return (
                <li
                  key={t.id}
                  className="rounded-2xl border border-amber-200/50 bg-white/90 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-slate-800">{t.title}</h3>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: chip.bg, color: chip.fg }}
                        >
                          {chip.emoji} {STATUS_LABELS[status]}
                        </span>
                      </div>
                      {t.content && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.content}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>🕐 {t.startTime}–{t.endTime}</span>
                        <span>🪙 {t.rewardCoins} 金币</span>
                        {t.quickLink && <span>🔗 {t.quickLink}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        onClick={() => openEdit(t)}
                      >
                        编辑
                      </button>
                      <button
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        onClick={() => handleDelete(t)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {showForm && (
        <RobotTaskForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Export `RobotTaskManager` from `packages/robot/src/index.ts`**

```ts
// @rosie/robot — robot module: task data + admin CRUD page.
export * from './robot-types'
export * from './robot-status'
export { useRobotTasks } from './useRobotTasks'
export { default as RobotTaskManager } from './RobotTaskManager'
```

- [ ] **Step 5: Verify it type-checks**

Run: `pnpm --filter @rosie/robot typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/robot/src
git commit -m "feat(robot): task CRUD UI (RobotTaskManager + RobotTaskForm)"
```

---

## Task 6: Route shell + admin hub card

**Files:**
- Create: `apps/web/src/app/admin/robot/page.tsx`
- Modify: `apps/web/src/app/admin/page.tsx`

- [ ] **Step 1: Create the route shell `apps/web/src/app/admin/robot/page.tsx`**

```tsx
'use client'

import { useAuth } from '@rosie/core'
import { RobotTaskManager } from '@rosie/robot'

export default function AdminRobotPage() {
  const { user } = useAuth()
  return <RobotTaskManager user={user} />
}
```

- [ ] **Step 2: Add a `🤖 机器人任务` card to `apps/web/src/app/admin/page.tsx`**

In the `TOOLS` array, append a new entry after the existing `/admin/word-audit` entry:

```ts
  {
    href: '/admin/robot',
    emoji: '🤖',
    title: '机器人任务',
    description: '管理果果的机器人学习任务：按时间段自动判定状态，配置标题、时段、奖励金币与打卡页路径。',
    from: 'rgba(99,102,241,0.14)',
    to: 'rgba(168,85,247,0.10)',
    ring: 'rgba(99,102,241,0.28)',
  },
```

- [ ] **Step 3: Verify the app builds**

Run: `pnpm --filter web build`
Expected: build succeeds; `/admin/robot` is in the route list.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin
git commit -m "feat(robot): /admin/robot route shell + admin hub card"
```

---

## Task 7: Docs — package CLAUDE.md + root CLAUDE.md

**Files:**
- Create: `packages/robot/CLAUDE.md`
- Modify: `CLAUDE.md` (root)

- [ ] **Step 1: Create `packages/robot/CLAUDE.md`**

```markdown
# @rosie/robot

机器人模块：果果的 AI 魔法学习顾问。Dify 编排的对话机器人（见 `docs/robot/dify.md`），
本仓库负责持久化与管理界面。

## DAG 位置
`robot → core, ui`（后续 sub-project D 再加 `→ rewards`）。robot 是叶子学科模块，
只被 `apps/web` 的 route shell 引用，绝不被 core/ui/rewards 反向依赖。

## 当前范围（Sub-project A）
- `robot_tasks` 表（`docs/robot/robot-tasks.sql`），按用户隔离，复合主键 `(user_id, id)`。
- `useRobotTasks(user)`：Supabase 直连的 per-row CRUD（add/update/delete/reorder/complete/refresh）。
- `/admin/robot` 管理页（`RobotTaskManager`）：增删改查，状态只读派生。

## 状态模型（关键）
状态**不入库**，由 `deriveStatus(task, now)` 派生：
`completed_at` → 已完成；`now < start` → 未开始；`start ≤ now ≤ end` → 进行中；否则已过期。
完成（写 `completed_at`）只由打卡页触发（sub-project D）。这是对 Dify 文档中
命令驱动状态机（READY/LEARNING/COMPLETED）的有意改造。

## 待办（后续 sub-project）
- B：`/api/robot` 调 Dify + stage 状态机；快照边界把派生状态映射回 Dify 枚举。
- C：果果端语音/对话 UI（`/robot`）。
- D：打卡页完成 → `completeTask` + 金币入账 `star_sessions`（`source:'robot'`）。
```

- [ ] **Step 2: Update root `CLAUDE.md` monorepo layout**

In the layout code block under "Monorepo layout", add this line after the `audio/` line:

```
  robot/     @rosie/robot   — 机器人任务（Dify 对话机器人）+ /admin/robot 管理页
```

- [ ] **Step 3: Update root `CLAUDE.md` module table**

In the "Subject modules" table, add a row after the 音频 row:

```
| 机器人 | `@rosie/robot` | `apps/web/src/app/admin/robot/**` | `packages/robot/CLAUDE.md` |
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md packages/robot/CLAUDE.md
git commit -m "docs(robot): package CLAUDE.md + root layout/module table"
```

---

## Task 8: Final verification

- [ ] **Step 1: Type-check the package**

Run: `pnpm --filter @rosie/robot typecheck`
Expected: PASS.

- [ ] **Step 2: Run the status helper test**

Run: `pnpm --filter web exec vitest run tests/robot-status.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Build the app**

Run: `pnpm --filter web build`
Expected: build succeeds, no TypeScript errors, `/admin/robot` present.

- [ ] **Step 4: Manual smoke test** (human, after applying `docs/robot/robot-tasks.sql` in Supabase)

  - Visit `/admin` → the `🤖 机器人任务` card appears and links to `/admin/robot`.
  - Add a task with a window around the current time → chip shows 进行中🔥.
  - Add a task with a future window → 未开始; a past window → 已过期⏰.
  - Edit a task; values persist after reload. Delete a task; it disappears.
  - In Supabase, set a row's `completed_at` → chip shows 已完成✅.

---

## Self-Review Notes

- **Spec coverage:** §3 status model → Task 2 (`deriveStatus` + test). §4 table → Task 3 (with composite PK refinement). §5 package/types/hook → Tasks 1,2,4. §6 UI → Task 5. §7 wiring → Tasks 1,6. Docs → Task 7. §8 verification → Task 8. Deferred §9 items are explicitly out of scope.
- **Refinement vs spec:** `id` is `(user_id, id)` composite PK instead of bare text PK (prevents cross-user collision). Reflected in SQL + the hook's per-user `nextTaskId`. The `reorderTasks`/`completeTask` hook methods exist per spec but the A-stage UI does not surface reorder (no drag UI in baseline) — left as hook API for D/B; not a gap since spec lists them as hook methods, not required UI.
- **Type consistency:** `RobotTask`, `RobotTaskInput`, `RobotTaskStatus`, `deriveStatus`, `STATUS_LABELS`, `useRobotTasks` names are identical across all tasks and the barrel.
- **No placeholders:** every code/SQL/command step contains real content.
