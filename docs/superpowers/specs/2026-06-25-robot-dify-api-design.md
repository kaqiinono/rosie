# Robot Module — Sub-project B: Dify 对话 API (Design)

**Date:** 2026-06-25
**Status:** Approved (design); pending spec review → implementation plan
**Depends on:** Sub-project A (`@rosie/robot` package, `robot_tasks`, `useRobotTasks`, `deriveStatus`)
**Source contract:** [`docs/robot/dify.md`](../../robot/dify.md)

---

## 1. Context & the A-divergence

A built the task foundation with **time-derived status** + **打卡页-driven completion**. The Dify
doc, by contrast, is **conversation-driven** (says "开始" → LEARNING, "完成" → COMPLETED + 金币结算,
persists `updated_tasks` + increments coins server-side). Those two models conflict.

**Decision (locked in brainstorming):** the robot is a **read-only companion**. It reads a snapshot
and talks (encourage / announce / guide / comfort). It does **not** mutate task status and does
**not** settle coins. All state transitions and coin earning come from time + the 打卡页 (Sub-project
D). The Dify flow's persistence side-effects (`updated_tasks`, `reward_coins_delta`, `next_stage`)
are **ignored** on our side; we consume only `speech_text` (+ `hardware_cmd` passthrough).

## 2. Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Conversation role | **Read-only companion** — no status mutation, no coin settlement |
| API architecture | **Stateless proxy** — mirrors `api/word-enrich`; client sends snapshot, server adds the Dify key and proxies. No server-side Supabase, no service-role key. |
| `stage` storage | **Not persisted.** Derived: `LEARNING` if any task is in-progress, else `IDLE`. No `robot_state` table. |
| Snapshot contents | **Only currently in-progress tasks** (`deriveStatus === 'IN_PROGRESS'` → Dify `LEARNING`). NOT_STARTED / COMPLETED / EXPIRED omitted. |
| `current_coins` | **Grand total** = sum of all `star_sessions.coins_earned` for the user (yellow+red+blue). |
| `hardware_cmd` | Web app, no physical device. Passed through in the response for a possible future device; the web UI (C) does not act on it. |
| Auth on the route | Same exposure model as `word-enrich` (no per-user auth). Rate-limiting noted as future. |

**Recorded for Sub-project D (not built here):** coin earning has **no `robot` source/color**. When a
task completes via its 打卡页, the settlement logic reads the completed task's `quick_link` to decide
the module (e.g. `/calc`→yellow `calc`, `/math`→blue `math`, `/english`→red `english`) and credits
that module's existing `star_sessions` source with `reward_coins`.

## 3. Goals / Non-goals (B)

**Goals**
- A stateless `POST /api/robot` Route Handler that proxies the Dify Chatflow, keeping `DIFY_API_KEY`
  server-side.
- A snapshot-mapping helper (`toDifySnapshot`) that converts `RobotTask[]` → the Dify `current_tasks`
  shape, in-progress-only.
- A client hook (`useRobotChat`) that gathers the snapshot, calls the route, and returns the reply.
  No persistence.
- API contract types shared in `@rosie/robot`.

**Non-goals (deferred)**
- The `/robot` page UI, mic input, TTS playback of `speechText` → **Sub-project C**.
- 打卡页完成 + 金币入账 (the quick_link→color settlement) → **Sub-project D**.
- Editing the Dify Chatflow itself (it lives in Dify, owned by the user). B calls it as-is and uses
  only `speech_text` + `hardware_cmd`.

## 4. Architecture & data flow

```
[C: /robot UI]
   │  query (果果说的话)
   ▼
useRobotChat(user)            ── gathers snapshot ──────────────┐
   │  { query, currentCoins, currentStage, currentTasks }      │ currentTasks = toDifySnapshot(tasks)
   ▼                                                            │ currentCoins = Σ star_sessions
POST /api/robot  (stateless proxy, runtime=nodejs)             │ currentStage = derived
   │  + DIFY_API_KEY (server-only)                              │
   ▼
Dify Chatflow (blocking)  →  answer = JSON { speech_text, action }
   │
   ▼  read-only: keep speech_text + action.hardware_cmd; ignore the rest
{ speechText, hardwareCmd }  ──▶ useRobotChat ──▶ [C plays / shows]
```

No database writes anywhere in B.

## 5. Components

### 5.1 Route Handler — `apps/web/src/app/api/robot/route.ts`
- `export const runtime = 'nodejs'`.
- Reads `process.env.DIFY_API_ENDPOINT` and `DIFY_API_KEY`. If either is missing → **503**
  `{ error: 'no_dify_config' }` (client degrades gracefully, mirroring `word-enrich`'s 503).
- Parses body `RobotChatRequest`:
  `{ query: string, currentCoins: number, currentStage: string, currentTasks: { tasks: DifyTask[] } }`.
  Missing/empty `query` → 400.
- Calls Dify:
  ```ts
  fetch(DIFY_API_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: { current_coins, current_stage, current_tasks },
      query, response_mode: 'blocking', user,   // user: a stable string id, e.g. 'rosie'
    }),
  })
  ```
- Parses `difyRaw.answer` as JSON → `{ speech_text, action }`. The doc's "JSON 序列化安全阀" node
  guarantees `answer` is valid JSON; still wrap in try/catch.
- **Returns `RobotChatResponse`:** `{ speechText: string, hardwareCmd: string }`.
  Read-only ⇒ `action.updated_tasks`, `action.reward_coins_delta`, `action.next_stage` are **ignored**.
- On Dify fetch failure or unparseable `answer` → 502 `{ error: 'dify_failed' }` plus a safe fallback
  `speechText`（"大姐姐刚刚走神了一下，果果再说一遍好吗？"）so the UI always has something to say.

### 5.2 Snapshot mapping — `@rosie/robot` `toDifySnapshot(tasks, now?)`
- Input: `RobotTask[]` (+ optional `now`). Output: `{ tasks: DifyTask[] }`.
- Filters to `deriveStatus(t, now) === 'IN_PROGRESS'` only; each emitted `DifyTask` carries
  `status: 'LEARNING'` and all 8 doc-required fields:
  `{ id, title, content, start_time, end_time, status, reward_coins, quick_link }`
  (camelCase RobotTask → snake_case Dify fields).
- `deriveCurrentStage(tasks, now?)`: returns `'LEARNING'` if any task is in-progress, else `'IDLE'`.

### 5.3 Client hook — `@rosie/robot` `useRobotChat(user)`
- Internally uses `useRobotTasks(user)` for tasks and a **light** coins read:
  `select coins_earned from star_sessions where user_id = …` then sum (a small dedicated query —
  does NOT pull the heavy calc wallet).
- Returns `{ send, sending, lastReply, error }` where
  `send(query: string) => Promise<RobotChatResponse | null>`:
  builds `{ query, currentCoins, currentStage: deriveCurrentStage(tasks), currentTasks: toDifySnapshot(tasks) }`,
  POSTs to `/api/robot`, sets `lastReply`/`error`/`sending`. **No DB writes.**
- No-ops (returns null) when `user` is null.

### 5.4 Types — `@rosie/robot` (`robot-types.ts` or a new `robot-api.ts`)
```ts
export interface DifyTask {
  id: string; title: string; content: string
  start_time: string; end_time: string
  status: 'READY' | 'LEARNING' | 'COMPLETED'
  reward_coins: number; quick_link: string
}
export interface RobotChatRequest {
  query: string
  currentCoins: number
  currentStage: string
  currentTasks: { tasks: DifyTask[] }
}
export interface RobotChatResponse {
  speechText: string
  hardwareCmd: string
}
```

## 6. Wiring / docs
- Env: document `DIFY_API_ENDPOINT` + `DIFY_API_KEY` in root `CLAUDE.md` (Environment Variables) and
  `packages/robot/CLAUDE.md`; add to `apps/web/.env.local` locally + Vercel for prod. When unset the
  route returns 503 and the UI shows a friendly "robot 还没接通" state (C handles the UX).
- `packages/robot/CLAUDE.md`: move B from "待办" to "当前范围"; note the read-only model and that
  Dify persistence side-effects are intentionally ignored.

## 7. Testing / verification
- Unit (vitest, import helpers directly to avoid the Supabase-barrel crash — see A's test):
  - `toDifySnapshot`: only in-progress tasks emitted; correct snake_case mapping; `status:'LEARNING'`;
    empty when none active.
  - `deriveCurrentStage`: `LEARNING` when an active task exists, else `IDLE`.
- Route handler: manual / lightweight — 503 when env unset; 400 on empty query; happy path returns
  `{ speechText, hardwareCmd }` from a mocked Dify `answer`; 502 + fallback on bad `answer`.
- `pnpm --filter @rosie/robot typecheck` + `pnpm --filter web build` green. (Human runs final build.)

## 8. Open items carried to later sub-projects
- **C:** `/robot` page; mic (Web Speech API) + text input; TTS playback of `speechText`
  (`speechSynthesis`); playful 7-yo design; "robot 未接通" (503) state.
- **D:** 打卡页完成 → mark `completed_at` + settlement: read completed task's `quick_link` → module →
  credit that color's `star_sessions` source with `reward_coins` (no `robot` source).
- **Future:** rate-limiting / auth on `/api/robot`; optional hardware client consuming `hardwareCmd`.
