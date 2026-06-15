# 口算 — 按题型的题量 / 限时 / 统计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 题量 a global auto/manual toggle, attach a per-题型 confirm-only 限时 (soft per-question countdown + speed star), and record per-题型 答题数量+用时 (`question_log`) to drive a slimmed, tier-based 报告 (进步/退步 + 离下一档).

**Architecture:** 题型 (block / mixed-op) is the atomic unit — each source inlines `{count, seconds}`; `seconds` is tri-state (`null` 未确认 / `0` 不限 / `>0` 限时). A new `TIME_TARGETS` table (transcribed from `docs/calc-per-type-time-targets.md`) is suggestion-only (never auto-fills). The session writes a tagged per-question `question_log`; the report aggregates it at read time into 题/分钟 + 四档档位.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict, no `any`), Tailwind v4 (CSS vars), Supabase (jsonb columns). No test runner — verification is `pnpm lint` + manual browser checks.

**Reference spec:** `docs/superpowers/specs/2026-06-15-calc-per-type-count-time-design.md`

---

## Conventions for every task

- **Verify** = run `pnpm lint` and expect **no new errors** in the touched files. UI tasks add a manual browser check.
- **Commit** after each task with the shown message. Branch is `feature/calc-fusion`.
- No `any`. Shared types in `src/utils/type.ts`. Tailwind utilities only.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/utils/calc-time-targets.ts` | **NEW** — `TIME_TARGETS` four-tier table, `Tier`, `suggestedTiers`, `missingTargetIds`, `tierOf`, `nextTierGap`, `tierLabel` |
| `src/utils/calc-report-stats.ts` | **NEW** — pure aggregation of sessions' `questionLog` → per-source throughput + rolling-20 tier/进退 |
| `src/utils/type.ts` | `BlockSel`, `MixedOp(+count,+seconds)`, `CalcSettings`, `CalcSession.questionLog`, `QuestionLogEntry` |
| `src/hooks/useCalcSettings.ts` | default + row⇄settings upconvert; drop time fields; add `countMode` |
| `src/utils/calc-helpers.ts` | `buildSession` auto/manual; remove `calcTimeBonus`/`timeLimitBonusPreview`; keep `allocate` |
| `src/components/calc/CalcConfigBar.tsx` | slim to count-only chips |
| `src/components/calc/PerTypeTimeChips.tsx` | **NEW** — shared 限时 chip row (不限/1/3/5/10/自定义 + 待确认 + 四档建议) |
| `src/components/calc/BlockPicker.tsx` | selected rows expand to 题量(manual)+限时 |
| `src/components/calc/MixedOpList.tsx` | per-op 题量+限时 rows |
| `src/components/calc/MixedOpComposer.tsx` | seed `count`/`seconds` on save |
| `src/components/calc/TimeLimitsSection.tsx` | **DELETE** |
| `src/app/calc/settings/page.tsx` | countMode switch, global total (auto), 共N题, remove old sections |
| `src/app/calc/page.tsx` | remove time; show 共N题 / auto quick total; `handleStart` no time param |
| `src/app/calc/session/page.tsx` | per-question soft countdown, speed star, `withinLimit` from source, `question_log` capture, remove global timer/timeBonus |
| `src/hooks/useCalcWallet.ts` | read/write `question_log` |
| `src/utils/calc-time-limits.ts` | remove bucket-override usage (keep file minimal or delete) |
| `src/components/calc/SessionSummary.tsx` | per-题型 题/分钟 + 秒/题(vs 目标档) |
| `src/app/calc/report/page.tsx` | 4-block slim report |
| `docs/sql/calc-per-type-stats-migration.sql` | **NEW** — `question_log` column |

---

# Phase 0 — Targets table + types foundation

## Task 0.1: Create `calc-time-targets.ts`

**Files:**
- Create: `src/utils/calc-time-targets.ts`

- [ ] **Step 1: Write the module** (values transcribed from `docs/calc-per-type-time-targets.md`; single-value bands encoded `[n,n]`)

```ts
// src/utils/calc-time-targets.ts
// 四档建议耗时（秒/题），转录自 docs/calc-per-type-time-targets.md。
// 仅作「建议」用于家长确认与报告档位判定，绝不自动写入设置。

import { BLOCKS } from './calc-blocks'
import { SKELETONS } from './calc-mixed'

export type Band = [number, number] // [lo, hi] 秒
export interface TimeTarget {
  entry: Band   // 入门
  stable: Band  // 进阶
  fluent: Band  // 高级 ⭐（推荐目标）
  auto: Band    // 超高级
}
export type Tier = 'entry' | 'stable' | 'fluent' | 'auto'

export const TIER_LABEL: Record<Tier, string> = {
  entry: '入门',
  stable: '进阶',
  fluent: '高级',
  auto: '超高级',
}
/** 从慢到快的顺序（entry 最慢 / auto 最快）。 */
export const TIER_ORDER: Tier[] = ['entry', 'stable', 'fluent', 'auto']

export const TIME_TARGETS: Record<string, TimeTarget> = {
  // 加法
  'add:10': { entry: [8, 10], stable: [5, 6], fluent: [3, 4], auto: [1, 2] },
  'add:20a': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  'add:20b': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  'add:100a': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'add:100b': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'add:1000': { entry: [15, 20], stable: [12, 15], fluent: [8, 12], auto: [6, 8] },
  'add:10000': { entry: [15, 20], stable: [12, 15], fluent: [8, 12], auto: [6, 8] },
  // 减法
  'sub:10': { entry: [8, 10], stable: [5, 6], fluent: [3, 4], auto: [1, 2] },
  'sub:20a': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  'sub:20b': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  'sub:100a': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'sub:100b': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'sub:1000': { entry: [15, 20], stable: [12, 15], fluent: [8, 12], auto: [6, 8] },
  'sub:10000': { entry: [15, 20], stable: [12, 15], fluent: [8, 12], auto: [6, 8] },
  // 乘法
  'mul:25': { entry: [8, 10], stable: [5, 6], fluent: [3, 4], auto: [2, 2] },
  'mul:34': { entry: [8, 10], stable: [5, 6], fluent: [3, 4], auto: [2, 2] },
  'mul:67': { entry: [10, 12], stable: [6, 7], fluent: [4, 5], auto: [2, 3] },
  'mul:89': { entry: [10, 12], stable: [6, 7], fluent: [4, 5], auto: [2, 3] },
  'mul:29': { entry: [10, 12], stable: [6, 7], fluent: [4, 5], auto: [2, 3] },
  'mul:1012': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'mul:1319': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'mul:219': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'mul:2d1d': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'mul:2d': { entry: [20, 25], stable: [15, 18], fluent: [12, 15], auto: [8, 10] },
  // 除法
  'div:25': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  'div:34': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  'div:69': { entry: [12, 15], stable: [8, 10], fluent: [5, 6], auto: [3, 4] },
  'div:29': { entry: [12, 15], stable: [8, 10], fluent: [5, 6], auto: [3, 4] },
  'div:1012': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'div:1319': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'div:219': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'div:multi': { entry: [18, 22], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  'div:rem': { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  // 小数
  'dec:add1': { entry: [12, 15], stable: [10, 12], fluent: [8, 10], auto: [6, 8] },
  'dec:add2': { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 10] },
  'dec:mulInt': { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  'dec:divInt': { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  // 分数
  'frac:add-same': { entry: [15, 20], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  'frac:add-diff': { entry: [25, 30], stable: [20, 25], fluent: [15, 20], auto: [12, 15] },
  'frac:mul-int': { entry: [15, 20], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  'frac:mul-frac': { entry: [25, 30], stable: [20, 25], fluent: [15, 20], auto: [12, 15] },
  'frac:div-int': { entry: [20, 25], stable: [15, 18], fluent: [12, 15], auto: [10, 10] },
  'frac:div-frac': { entry: [25, 30], stable: [20, 25], fluent: [15, 20], auto: [12, 15] },
  // 混合骨架
  as: { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  md: { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  asm: { entry: [20, 25], stable: [15, 18], fluent: [12, 15], auto: [10, 10] },
  asmd: { entry: [25, 30], stable: [20, 25], fluent: [15, 18], auto: [12, 15] },
  as_m_paren: { entry: [25, 33], stable: [20, 26], fluent: [17, 23], auto: [15, 18] },
  md_paren: { entry: [20, 26], stable: [17, 23], fluent: [15, 20], auto: [12, 16] },
  asmd_paren: { entry: [30, 38], stable: [25, 33], fluent: [20, 26], auto: [17, 23] },
}

/** 建议四档；缺失返回 null（调用方据此显示「暂无建议」）。 */
export function suggestedTiers(id: string): TimeTarget | null {
  return TIME_TARGETS[id] ?? null
}

/** 所有 BLOCKS + SKELETONS 中缺 TIME_TARGETS 条目的 id（覆盖审计用）。 */
export function missingTargetIds(): string[] {
  const ids = [...BLOCKS.map((b) => b.id), ...SKELETONS.map((s) => s.id)]
  return ids.filter((id) => !(id in TIME_TARGETS))
}

/**
 * 由平均秒/题 + 首答正确率判定档位。
 * - 无 target → null（未知）
 * - 正确率 < 0.8 → 'entry'（稳定性优先，doc §2/§5）
 * - 否则取最快的、满足 avg ≤ band.hi 的档（auto→fluent→stable→entry）
 */
export function tierOf(avgSec: number, accuracy: number, target: TimeTarget | null): Tier | null {
  if (!target) return null
  if (accuracy < 0.8) return 'entry'
  if (avgSec <= target.auto[1]) return 'auto'
  if (avgSec <= target.fluent[1]) return 'fluent'
  if (avgSec <= target.stable[1]) return 'stable'
  return 'entry'
}

/** 距离下一更快档的差值（秒，>0）。已是 auto 或无 target → 0。 */
export function nextTierGap(avgSec: number, current: Tier | null, target: TimeTarget | null): number {
  if (!target || current === null || current === 'auto') return 0
  const nextIdx = TIER_ORDER.indexOf(current) + 1
  const next = TIER_ORDER[nextIdx] as Exclude<Tier, never>
  return Math.max(0, +(avgSec - target[next][1]).toFixed(1))
}
```

- [ ] **Step 2: Verify** — `pnpm lint`. Expected: no errors. Open a scratch check is unnecessary; the table is data.

- [ ] **Step 3: Commit**

```bash
git add src/utils/calc-time-targets.ts
git commit -m "feat(calc): add TIME_TARGETS four-tier table + tier helpers"
```

## Task 0.2: Extend shared types

**Files:**
- Modify: `src/utils/type.ts:372-392` (MixedOp, CalcSettings) and `:488-511` (CalcSession)

- [ ] **Step 1: Add `BlockSel`, `QuestionLogEntry`; extend `MixedOp`, `CalcSettings`, `CalcSession`**

Replace the `MixedOp` + `CalcSettings` block (lines 372-392) with:

```ts
export interface MixedOp {
  id: string            // uuid
  skeleton: CalcSkeletonId
  blockIds: string[]    // 选中的积木块 ID
  enabled: boolean
  label?: string
  count: number         // 精准模式下的题量
  seconds: number | null // 每题目标秒数；null=未确认 · 0=不限 · >0=限时
}

/** 单运算选择项：题型内联自己的题量与目标秒数。 */
export interface BlockSel {
  id: string
  count: number
  seconds: number | null // null=未确认 · 0=不限 · >0=限时
}

export type CalcCountMode = 'auto' | 'manual'

export interface CalcSettings {
  countMode: CalcCountMode   // 'auto' 全局总量加权 / 'manual' 按题型
  selectedBlocks: BlockSel[] // 单运算练习选中的积木块（内联 count/seconds）
  mixedOps: MixedOp[]        // 编排出的混合运算
  soundEnabled: boolean
  includeInverse: boolean
  verticalForBigNumbers: boolean
  lastCount: number          // auto 模式的全局总题量 (10/20/30/50/100)
  sessionCounter: number     // 每次 session 完成自增
}
```

Then add near `CalcSession` (after line 510 `questionTimesMs?`):

```ts
  /** Per-question tagged log: source key, first-attempt ms, first-try correctness. */
  questionLog?: QuestionLogEntry[]
```

And add this interface right above `export interface CalcSession`:

```ts
/** One question's atomic record. key = "block:<id>" | "mixed:<id>". */
export interface QuestionLogEntry {
  key: string
  ms: number
  ok: boolean
}
```

- [ ] **Step 2: Verify** — `pnpm lint`. Expected: errors ONLY in files that consume the changed types (settings hook, helpers, pages) — those are fixed in later tasks. Confirm `type.ts` itself has no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/type.ts
git commit -m "feat(calc): per-type count/seconds + questionLog types"
```

---

# Phase 1 — Settings model & hook

## Task 1.1: Rewrite `useCalcSettings` for the new shape

**Files:**
- Modify: `src/hooks/useCalcSettings.ts` (whole file)

- [ ] **Step 1: Replace the file** with backward-compatible upconversion (legacy `string[]` → `BlockSel[]` with `seconds:null`; drop `lastTimeLimit`/`timeLimitOverrides`; add `countMode`)

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { BlockSel, CalcSettings, MixedOp } from '@/utils/type'

const DEFAULT_BLOCK: BlockSel = { id: 'add:10', count: 20, seconds: null }

const DEFAULT_SETTINGS: CalcSettings = {
  countMode: 'auto',
  selectedBlocks: [DEFAULT_BLOCK],
  mixedOps: [],
  soundEnabled: true,
  includeInverse: false,
  verticalForBigNumbers: true,
  lastCount: 20,
  sessionCounter: 0,
}

interface RawRow {
  count_mode: 'auto' | 'manual' | null
  selected_blocks: (string | BlockSel)[] | null
  mixed_ops: Partial<MixedOp>[] | null
  sound_enabled: boolean
  include_inverse: boolean | null
  vertical_for_big_numbers: boolean | null
  last_count: number
  session_counter: number | null
}

/** Accept both legacy string ids and the new object shape. */
function toBlockSel(v: string | BlockSel): BlockSel {
  if (typeof v === 'string') return { id: v, count: 20, seconds: null }
  return { id: v.id, count: v.count ?? 20, seconds: v.seconds ?? null }
}

function toMixedOp(v: Partial<MixedOp>): MixedOp {
  return {
    id: v.id ?? crypto.randomUUID(),
    skeleton: v.skeleton!,
    blockIds: v.blockIds ?? [],
    enabled: v.enabled ?? true,
    label: v.label,
    count: v.count ?? 20,
    seconds: v.seconds ?? null,
  }
}

function rowToSettings(row: RawRow): CalcSettings {
  return {
    countMode: row.count_mode ?? 'auto',
    selectedBlocks: (row.selected_blocks ?? ['add:10']).map(toBlockSel),
    mixedOps: (row.mixed_ops ?? []).map(toMixedOp),
    soundEnabled: row.sound_enabled,
    includeInverse: row.include_inverse ?? false,
    verticalForBigNumbers: row.vertical_for_big_numbers ?? true,
    lastCount: row.last_count,
    sessionCounter: row.session_counter ?? 0,
  }
}

function settingsToRow(s: CalcSettings, userId: string) {
  return {
    user_id: userId,
    count_mode: s.countMode,
    selected_blocks: s.selectedBlocks,
    mixed_ops: s.mixedOps,
    sound_enabled: s.soundEnabled,
    include_inverse: s.includeInverse,
    vertical_for_big_numbers: s.verticalForBigNumbers,
    last_count: s.lastCount,
    session_counter: s.sessionCounter,
    updated_at: new Date().toISOString(),
  }
}

export function useCalcSettings(user: User | null) {
  const [settings, setSettings] = useState<CalcSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const init = async () => {
      const { data } = await supabase
        .from('calc_settings')
        .select(
          'count_mode,selected_blocks,mixed_ops,sound_enabled,last_count,session_counter,include_inverse,vertical_for_big_numbers',
        )
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (data) setSettings(rowToSettings(data as RawRow))
      setIsLoading(false)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [user])

  const persist = useCallback(
    async (next: CalcSettings) => {
      setSettings(next)
      if (!user) return
      try {
        await supabase
          .from('calc_settings')
          .upsert(settingsToRow(next, user.id), { onConflict: 'user_id' })
      } catch {
        /* ignore */
      }
    },
    [user],
  )

  const update = useCallback(
    (patch: Partial<CalcSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        if (user) {
          void supabase
            .from('calc_settings')
            .upsert(settingsToRow(next, user.id), { onConflict: 'user_id' })
            .then(() => {})
        }
        return next
      })
    },
    [user],
  )

  return { settings, setSettings: persist, update, isLoading }
}
```

- [ ] **Step 2: Add the SQL migration** for `count_mode` (the rest reuse existing jsonb columns). Create `docs/sql/calc-per-type-stats-migration.sql`:

```sql
-- 口算 per-type 重构：新增列。手动在 Supabase SQL editor 执行。
-- selected_blocks / mixed_ops 仍是 jsonb，形状由客户端升级，无需 DDL。
alter table public.calc_settings
  add column if not exists count_mode text not null default 'auto';

alter table public.calc_sessions
  add column if not exists question_log jsonb not null default '[]'::jsonb;

-- last_time_limit / time_limit_overrides 列保留但停用（不再读写）。
```

- [ ] **Step 3: Verify** — `pnpm lint`. Expected: `useCalcSettings.ts` clean; remaining errors are downstream consumers (fixed later).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCalcSettings.ts docs/sql/calc-per-type-stats-migration.sql
git commit -m "feat(calc): settings hook for countMode + per-type blocks; migration"
```

---

# Phase 2 — buildSession (auto / manual)

## Task 2.1: Rework `buildSession` + drop time-bonus helpers

**Files:**
- Modify: `src/utils/calc-helpers.ts:47-143` (buildSession), `:55-58` (sources loop), `:205-224` (remove calcTimeBonus/timeLimitBonusPreview)

- [ ] **Step 1: Change the sources loop** to read `BlockSel.id`. Replace lines 55-58:

```ts
  for (const sel of settings.selectedBlocks) {
    const block = blockById(sel.id)
    if (block) sources.push({ kind: 'block', block })
  }
```

- [ ] **Step 2: Add per-source manual counts.** Replace the `buildSession` signature + steps 3-4 region. Change the function signature (line 47) and the count derivation. New `buildSession`:

Replace lines 47-93 with:

```ts
export function buildSession(
  settings: CalcSettings,
  ctx: BuildCtx,
  carried: CalcMistake[] = [],
): CalcQuestion[] {
  // 1. Sources (blocks first, then enabled+valid mixed ops)
  const sources: Source[] = []
  for (const sel of settings.selectedBlocks) {
    const block = blockById(sel.id)
    if (block) sources.push({ kind: 'block', block })
  }
  for (const op of settings.mixedOps) {
    if (op.enabled && isMixedOpValid(op)) sources.push({ kind: 'mixed', op })
  }
  if (sources.length === 0) sources.push({ kind: 'block', block: BLOCKS[0] }) // 兜底 add:10

  const states = [...ctx.problemStates.values()]

  // 2. Allocate counts per source.
  //    auto  → weakness-weighted allocate() of the global lastCount (原逻辑)
  //    manual→ each source's own configured count
  let alloc: number[]
  if (settings.countMode === 'manual') {
    alloc = sources.map((src) =>
      src.kind === 'block'
        ? settings.selectedBlocks.find((b) => b.id === src.block.id)?.count ?? 0
        : src.op.count,
    )
  } else {
    const weights = sources.map((src) => {
      const matching = src.kind === 'block'
        ? states.filter((s) => s.blockId === src.block.id)
        : states.filter((s) => s.mixedOpId === src.op.id)
      const p = matching.length > 0
        ? matching.reduce((acc, s) => acc + s.proficiency, 0) / matching.length
        : 0
      return Math.max(0.05, 1 - p / 5)
    })
    alloc = allocate(settings.lastCount, weights)
  }
  const count = alloc.reduce((a, b) => a + b, 0)

  // 3. Generate per source
  const out: CalcQuestion[] = []
  sources.forEach((src, i) => {
    const n = alloc[i]
    if (n <= 0) return
    if (src.kind === 'block') {
      out.push(...generateBlock(src.block, n, states))
    } else {
      for (let k = 0; k < n; k++) {
        const q = assembleMixed(src.op)
        out.push({ ...q, sourceMixedOpId: src.op.id })
      }
    }
  })
```

> The rest of `buildSession` (the `verticalForBigNumbers` tagging at old line 96, `includeInverse`, carried make-up using `count`, and the Fisher-Yates shuffle) stays **unchanged** — `count` is now the local sum computed above, so `carried.slice(0, count)` still works.

- [ ] **Step 3: Remove the dead time-bonus helpers.** Delete `calcTimeBonus` (lines ~213-220) and `timeLimitBonusPreview` (lines ~222-224) entirely.

- [ ] **Step 4: Verify** — `pnpm lint`. Expected: errors now in `session/page.tsx` (calls `buildSession(settings, requestedCount, …)` + imports `calcTimeBonus`) and `CalcConfigBar.tsx` (imports `timeLimitBonusPreview`) — fixed in their tasks.

- [ ] **Step 5: Commit**

```bash
git add src/utils/calc-helpers.ts
git commit -m "feat(calc): buildSession auto/manual allocation; drop time-bonus helpers"
```

---

# Phase 3 — Settings UI

## Task 3.1: Create shared `PerTypeTimeChips`

**Files:**
- Create: `src/components/calc/PerTypeTimeChips.tsx`

- [ ] **Step 1: Write the component** — chips 不限/1/3/5/10/自定义, 待确认 state (`value === null`), and four-tier suggestion / missing badge.

```tsx
'use client'

import { useState } from 'react'
import { suggestedTiers, TIER_LABEL } from '@/utils/calc-time-targets'

interface Props {
  /** 题型 id（block id 或 skeleton id），用于查四档建议。 */
  targetId: string
  /** null=未确认 · 0=不限 · >0=秒数 */
  value: number | null
  onChange: (v: number | null) => void
}

const PRESETS = [0, 1, 3, 5, 10] // 0 = 不限
const PRESET_LABEL = (v: number) => (v === 0 ? '不限' : `${v}秒`)

export default function PerTypeTimeChips({ targetId, value, onChange }: Props) {
  const tiers = suggestedTiers(targetId)
  const isCustom = value !== null && !PRESETS.includes(value)
  const [customOpen, setCustomOpen] = useState(isCustom)

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {value === null && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
            style={{ background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }}
          >
            待确认
          </span>
        )}
        {PRESETS.map((p) => {
          const on = value === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => { onChange(p); setCustomOpen(false) }}
              className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all active:scale-95"
              style={{
                background: on ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${on ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                color: on ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
              }}
            >
              {PRESET_LABEL(p)}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => { setCustomOpen(true); if (!isCustom) onChange(8) }}
          className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all active:scale-95"
          style={{
            background: isCustom ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isCustom ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
            color: isCustom ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
          }}
        >
          自定义
        </button>
        {customOpen && (
          <span className="inline-flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={120}
              value={isCustom ? value! : ''}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v) && v >= 1) onChange(v)
              }}
              className="w-14 rounded-md px-2 py-1 text-right text-[12px] font-extrabold tabular-nums"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd', outline: 'none' }}
            />
            <span className="text-[10px]" style={{ color: 'rgba(245,243,255,0.4)' }}>秒</span>
          </span>
        )}
      </div>
      {tiers ? (
        <div className="text-[10px]" style={{ color: 'rgba(196,181,253,0.42)' }}>
          建议 {TIER_LABEL.entry} {tiers.entry[0]}–{tiers.entry[1]} · {TIER_LABEL.stable} {tiers.stable[0]}–{tiers.stable[1]} · {TIER_LABEL.fluent}⭐ {tiers.fluent[0]}–{tiers.fluent[1]} · {TIER_LABEL.auto} {tiers.auto[0]}–{tiers.auto[1]} 秒
        </div>
      ) : (
        <div className="text-[10px]" style={{ color: '#fbbf24' }}>⚠️ 暂无建议耗时，请手动设置</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm lint`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/calc/PerTypeTimeChips.tsx
git commit -m "feat(calc): PerTypeTimeChips (confirm-only 限时 with tier hints)"
```

## Task 3.2: Slim `CalcConfigBar` to count-only

**Files:**
- Modify: `src/components/calc/CalcConfigBar.tsx` (whole file)

- [ ] **Step 1: Replace the file** — remove the time row + `timeLimitBonusPreview` import; keep count chips only.

```tsx
'use client'

const COUNT_OPTIONS = [10, 20, 30, 50, 100]

interface Props {
  count: number
  onChange: (count: number) => void
}

export default function CalcConfigBar({ count, onChange }: Props) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.12)' }}
    >
      <div
        className="mb-2 text-[10px] font-extrabold tracking-widest uppercase"
        style={{ color: 'rgba(196,181,253,0.5)' }}
      >
        总题量
      </div>
      <div className="flex flex-wrap gap-1.5">
        {COUNT_OPTIONS.map((n) => {
          const on = count === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-[13px] font-extrabold tabular-nums transition-all duration-200"
              style={
                on
                  ? { background: 'rgba(139,92,246,0.22)', border: '1.5px solid rgba(139,92,246,0.6)', color: '#c4b5fd' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)', color: 'rgba(196,181,253,0.5)' }
              }
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm lint`. Expected: errors now in `settings/page.tsx` + `page.tsx` (old `timeLimit`/`onChange` props) — fixed next.

- [ ] **Step 3: Commit**

```bash
git add src/components/calc/CalcConfigBar.tsx
git commit -m "refactor(calc): CalcConfigBar count-only"
```

## Task 3.3: Per-type rows in `BlockPicker`

**Files:**
- Modify: `src/components/calc/BlockPicker.tsx` (whole file)

- [ ] **Step 1: Replace the file** — take `BlockSel[]` selection, render an expanded config strip (题量 chips when manual + `PerTypeTimeChips`) under each selected block.

```tsx
'use client'

import { BLOCK_GROUPS, blocksByGroup, type CalcBlock } from '@/utils/calc-blocks'
import PerTypeTimeChips from './PerTypeTimeChips'
import type { BlockSel } from '@/utils/type'

interface Props {
  selected: BlockSel[]
  countMode: 'auto' | 'manual'
  onToggle: (id: string) => void
  onToggleGroup: (group: CalcBlock['group'], on: boolean) => void
  onPatch: (id: string, patch: Partial<BlockSel>) => void
}

const GROUP_ICONS: Record<CalcBlock['group'], string> = {
  add: '➕', sub: '➖', mul: '✖️', div: '➗', decimal: '🔢', fraction: '½',
}
const COUNT_OPTIONS = [10, 20, 30, 50, 100]

export default function BlockPicker({ selected, countMode, onToggle, onToggleGroup, onPatch }: Props) {
  const byId = new Map(selected.map((s) => [s.id, s]))

  return (
    <div className="space-y-3">
      {BLOCK_GROUPS.map(({ group, label }) => {
        const blocks = blocksByGroup(group)
        const allOn = blocks.length > 0 && blocks.every((b) => byId.has(b.id))
        return (
          <div key={group}>
            <div className="mb-1.5 flex items-center justify-between">
              <span
                className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                <span aria-hidden className="text-[12px] leading-none">{GROUP_ICONS[group]}</span>
                {label}
              </span>
              <button
                type="button"
                onClick={() => onToggleGroup(group, !allOn)}
                className="rounded-md px-2.5 py-1 text-[10px] font-extrabold transition-all active:scale-95"
                style={{
                  background: allOn ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.15)',
                  border: `1px solid ${allOn ? 'rgba(255,255,255,0.1)' : 'rgba(139,92,246,0.3)'}`,
                  color: allOn ? 'rgba(245,243,255,0.55)' : '#c4b5fd',
                }}
              >
                {allOn ? '取消' : '全选'}
              </button>
            </div>
            <div className="space-y-1.5">
              {blocks.map((b) => {
                const sel = byId.get(b.id)
                const on = !!sel
                return (
                  <div key={b.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(b.id)}
                      aria-pressed={on}
                      className="w-full rounded-lg px-3 py-2 text-left text-[12px] font-extrabold leading-tight transition-all active:scale-[0.99]"
                      style={{
                        background: on ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${on ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        color: on ? '#c4b5fd' : 'rgba(245,243,255,0.5)',
                      }}
                    >
                      {b.label}
                    </button>
                    {on && sel && (
                      <div
                        className="mt-1 space-y-2 rounded-lg px-3 py-2"
                        style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
                      >
                        {countMode === 'manual' && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="mr-1 text-[10px] font-extrabold uppercase" style={{ color: 'rgba(196,181,253,0.5)' }}>题量</span>
                            {COUNT_OPTIONS.map((n) => {
                              const co = sel.count === n
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => onPatch(b.id, { count: n })}
                                  className="rounded-md px-2 py-0.5 text-[11px] font-extrabold tabular-nums transition-all active:scale-95"
                                  style={{
                                    background: co ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${co ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                                    color: co ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
                                  }}
                                >
                                  {n}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        <PerTypeTimeChips
                          targetId={b.id}
                          value={sel.seconds}
                          onChange={(v) => onPatch(b.id, { seconds: v })}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm lint`. Expected: errors in `settings/page.tsx` (old `BlockPicker` props) — fixed next.

- [ ] **Step 3: Commit**

```bash
git add src/components/calc/BlockPicker.tsx
git commit -m "feat(calc): BlockPicker per-type count/seconds rows"
```

## Task 3.4: Per-op count/seconds in `MixedOpList` + composer seeding

**Files:**
- Modify: `src/components/calc/MixedOpList.tsx` (add config strip + `countMode` prop)
- Modify: `src/components/calc/MixedOpComposer.tsx:71-80` (seed count/seconds on save)

- [ ] **Step 1: `MixedOpComposer` — seed defaults on save.** Replace the `onSave({...})` object (lines 73-79) with:

```ts
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      skeleton,
      blockIds,
      enabled: initial?.enabled ?? true,
      label: buildLabel(),
      count: initial?.count ?? 20,
      seconds: initial?.seconds ?? null,
    })
```

- [ ] **Step 2: `MixedOpList` — add `countMode` prop + config strip.** Change `Props` (lines 8-11) to:

```ts
interface Props {
  mixedOps: MixedOp[]
  countMode: 'auto' | 'manual'
  onChange: (next: MixedOp[]) => void
}
```

Change the component signature (line 13) to `export default function MixedOpList({ mixedOps, countMode, onChange }: Props) {`, add a `patch` helper after `toggleEnabled` (after line 18):

```ts
  const patch = (id: string, p: Partial<MixedOp>) => {
    onChange(mixedOps.map((op) => (op.id === id ? { ...op, ...p } : op)))
  }
  const COUNT_OPTIONS = [10, 20, 30, 50, 100]
```

Then, inside the `.map((op) => {...})` row, immediately AFTER the closing `</div>` of the enable-toggle button group but BEFORE the row's outer closing `</div>` (i.e. wrap: keep the existing flex row, then append a config strip). Concretely, change the row's outer container to a column and nest the existing flex content. Replace the row's opening container (lines 50-57) with:

```tsx
          <div
            key={op.id}
            className="rounded-xl px-3 py-2.5"
            style={{
              background: op.enabled ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${op.enabled ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <div className="flex items-center gap-2">
```

and add a matching `</div>` plus the config strip right before the existing row's final `</div>` (the one closing the row at line 126). Insert:

```tsx
            </div>
            {op.enabled && (
              <div className="mt-2 space-y-2">
                {countMode === 'manual' && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[10px] font-extrabold uppercase" style={{ color: 'rgba(196,181,253,0.5)' }}>题量</span>
                    {COUNT_OPTIONS.map((n) => {
                      const co = op.count === n
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => patch(op.id, { count: n })}
                          className="rounded-md px-2 py-0.5 text-[11px] font-extrabold tabular-nums transition-all active:scale-95"
                          style={{
                            background: co ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${co ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                            color: co ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
                          }}
                        >
                          {n}
                        </button>
                      )
                    })}
                  </div>
                )}
                <PerTypeTimeChips
                  targetId={op.skeleton}
                  value={op.seconds}
                  onChange={(v) => patch(op.id, { seconds: v })}
                />
              </div>
            )}
```

Add the import at top of `MixedOpList.tsx`:

```ts
import PerTypeTimeChips from './PerTypeTimeChips'
```

- [ ] **Step 3: Verify** — `pnpm lint`. Expected: errors in `settings/page.tsx` (MixedOpList now needs `countMode`) — fixed next. Confirm the row JSX nesting is balanced (lint will catch unbalanced tags).

- [ ] **Step 4: Commit**

```bash
git add src/components/calc/MixedOpList.tsx src/components/calc/MixedOpComposer.tsx
git commit -m "feat(calc): per-op count/seconds in MixedOpList"
```

## Task 3.5: Rewire the settings page

**Files:**
- Modify: `src/app/calc/settings/page.tsx`

- [ ] **Step 1: Update imports** — remove `TimeLimitsSection`; add nothing new (CalcConfigBar stays). Delete line 12 (`import TimeLimitsSection`).

- [ ] **Step 2: Replace `toggleBlock`/`toggleGroup` + add `patchBlock`** (lines 100-113) with `BlockSel`-aware versions:

```ts
  const toggleBlock = (id: string) => {
    const exists = settings.selectedBlocks.some((b) => b.id === id)
    update({
      selectedBlocks: exists
        ? settings.selectedBlocks.filter((b) => b.id !== id)
        : [...settings.selectedBlocks, { id, count: 20, seconds: null }],
    })
  }

  const toggleGroup = (group: CalcBlock['group'], on: boolean) => {
    const ids = blocksByGroup(group).map((b) => b.id)
    const have = new Map(settings.selectedBlocks.map((b) => [b.id, b]))
    if (on) ids.forEach((i) => { if (!have.has(i)) have.set(i, { id: i, count: 20, seconds: null }) })
    else ids.forEach((i) => have.delete(i))
    update({ selectedBlocks: [...have.values()] })
  }

  const patchBlock = (id: string, patch: Partial<typeof settings.selectedBlocks[number]>) => {
    update({ selectedBlocks: settings.selectedBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
  }
```

- [ ] **Step 3: Replace `handleStart`** (lines 90-98) — drop the `time` param:

```ts
  const handleStart = () => {
    playSfx('coin', settings.soundEnabled)
    router.push('/calc/session?mode=daily')
  }
```

- [ ] **Step 4: Compute the total** — after `const blockCount = settings.selectedBlocks.length` (line 136) add:

```ts
  const manualTotal =
    settings.selectedBlocks.reduce((s, b) => s + b.count, 0) +
    settings.mixedOps.filter((m) => m.enabled).reduce((s, m) => s + m.count, 0)
  const totalQuestions = settings.countMode === 'manual' ? manualTotal : settings.lastCount
```

- [ ] **Step 5: Update the `BlockPicker` usage** (lines 162-166):

```tsx
          <BlockPicker
            selected={settings.selectedBlocks}
            countMode={settings.countMode}
            onToggle={toggleBlock}
            onToggleGroup={toggleGroup}
            onPatch={patchBlock}
          />
```

- [ ] **Step 6: Update the `MixedOpList` usage** (lines 172-175):

```tsx
          <MixedOpList
            mixedOps={settings.mixedOps}
            countMode={settings.countMode}
            onChange={(next) => update({ mixedOps: next })}
          />
```

- [ ] **Step 7: Replace the 「题量 / 限时」section** (lines 197-211) with the countMode switch + conditional global total + total line:

```tsx
        {/* 题量模式 */}
        <section>
          <SectionHeading
            suffix={
              <span className="ml-2 normal-case tracking-normal" style={{ color: 'rgba(196,181,253,0.3)' }}>
                · 共 {totalQuestions} 题
              </span>
            }
          >
            题量
          </SectionHeading>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(['auto', 'manual'] as const).map((m) => {
              const on = settings.countMode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => update({ countMode: m })}
                  className="rounded-xl px-3 py-2.5 text-[12px] font-extrabold transition-all active:scale-[0.98]"
                  style={{
                    background: on ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${on ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    color: on ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
                  }}
                >
                  {m === 'auto' ? '自动分配（往难处倾斜）' : '精准设置（按题型）'}
                </button>
              )
            })}
          </div>
          {settings.countMode === 'auto' && (
            <CalcConfigBar count={settings.lastCount} onChange={(count) => update({ lastCount: count })} />
          )}
          {settings.countMode === 'manual' && (
            <div className="text-[11px]" style={{ color: 'rgba(196,181,253,0.45)' }}>
              每个题型在上方各自设置题量；总题量 = 各题型之和。
            </div>
          )}
        </section>
```

- [ ] **Step 8: Delete the `TimeLimitsSection` usage** (lines 224-228).

- [ ] **Step 9: Verify** — `pnpm lint` clean. Manual: `/calc/settings` — toggle a block shows 限时 chips + 待确认 + 四档建议; switch to 精准设置 shows 题量 chips; switch to 自动分配 shows global 总题量; 共N题 updates.

- [ ] **Step 10: Commit**

```bash
git add src/app/calc/settings/page.tsx
git commit -m "feat(calc): settings page countMode switch + per-type config"
```

## Task 3.6: Delete `TimeLimitsSection`

**Files:**
- Delete: `src/components/calc/TimeLimitsSection.tsx`

- [ ] **Step 1: Confirm no other importers**

Run: `grep -rn "TimeLimitsSection" src/`
Expected: no matches (only the now-removed settings import).

- [ ] **Step 2: Delete + commit**

```bash
git rm src/components/calc/TimeLimitsSection.tsx
git commit -m "chore(calc): remove TimeLimitsSection (subsumed by per-type 限时)"
```

---

# Phase 4 — Session runtime

## Task 4.1: Per-question soft countdown + speed star + question_log

**Files:**
- Modify: `src/app/calc/session/page.tsx`

- [ ] **Step 1: Fix imports.** Line 18 → `import { buildSession, coinReward } from '@/utils/calc-helpers'`. Delete line 23 (`import { timeLimitFromSettings } …`). Add after line 21:

```ts
import { suggestedTiers } from '@/utils/calc-time-targets'
import type { QuestionLogEntry } from '@/utils/type'
```

- [ ] **Step 2: Drop URL count/time; derive from settings.** Replace `requestedCount` + `requestedTimeLimit` (lines 64-72) with nothing — buildSession now owns the count. Remove both `useMemo`s. (Keep `mode`.)

- [ ] **Step 3: Add a per-source seconds lookup.** After `problemState` (line 62) add:

```ts
  // Per-question target seconds for the current question's source (null/0 → no countdown).
  const secondsForQuestion = useCallback(
    (q: CalcQuestion): number | null => {
      if (q.sourceBlockId) return settings.selectedBlocks.find((b) => b.id === q.sourceBlockId)?.seconds ?? null
      if (q.sourceMixedOpId) return settings.mixedOps.find((m) => m.id === q.sourceMixedOpId)?.seconds ?? null
      return null
    },
    [settings.selectedBlocks, settings.mixedOps],
  )
```

- [ ] **Step 4: Add the question-log ref + speed-star state.** After `questionTimesRef` (line 107) add:

```ts
  // Tagged per-question first-attempt log (atomic per-题型 records).
  const questionLogRef = useRef<QuestionLogEntry[]>([])
```

- [ ] **Step 5: Update `buildSession` call** (lines 152-159):

```ts
      const session = buildSession(settings, { problemStates: loadedStates }, carried)
```

Also remove `requestedCount` from the init effect's dependency array (it was at line 170) — it no longer exists after Step 2. The remaining deps are `settings, settingsLoading, mode, user, sessionKey, problemState, lastSessionUnresolved`.

- [ ] **Step 6a: Add a question-start wall clock state.** After `const [now, setNow]` (line 112) add:

```ts
  const [questionStartWall, setQuestionStartWall] = useState<number>(0)
```

Set it in the idx-change effect (lines 180-186) alongside `questionStartRef.current`:

```ts
  useEffect(() => {
    if (questions && idx < questions.length) {
      questionStartRef.current = performance.now()
      setQuestionStartWall(Date.now())
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReduceHint(false)
    }
  }, [idx, questions])
```

- [ ] **Step 6b: Replace the global countdown (lines 207-208) with a per-question one.** While `feedback` is showing (the post-answer pause) we freeze the display at the full target so it doesn't tick during the banner:

```ts
  const currentSeconds = questions && idx < questions.length ? secondsForQuestion(questions[idx]) : null
  const remainingSec =
    currentSeconds && currentSeconds > 0
      ? feedback || questionStartWall === 0
        ? currentSeconds
        : Math.max(0, currentSeconds - Math.floor((now - questionStartWall) / 1000))
      : null
```

- [ ] **Step 7: Remove the global auto-end effect** (lines 388-394, the `remainingSec <= 0 → finishSession` block) — delete it entirely. The countdown is now soft (no auto-advance).

- [ ] **Step 8: Remove timeBonus from finishSession.** In `finishSession`: delete lines 221-222 (`const timeBonus = calcTimeBonus(...)` + `setTimeBonusEarned`). In the `recordSession` call (lines 348-363) change `coinsEarned: coinsTotalRef.current + timeBonus` → `coinsEarned: coinsTotalRef.current`, and add `questionLog: questionLogRef.current,` next to `questionTimesMs`. Remove the now-unused `requestedTimeLimit` from the dep array (line 383) and the `timeBonusEarned` state usage in the summary (Task 6.2 handles the summary props). Also remove `setTimeBonusEarned`/`timeBonusEarned` state (lines 114) if no longer referenced after Task 6.2 — defer deletion to 6.2 to avoid churn; for now set `setTimeBonusEarned(0)`.

> Concrete: replace lines 221-222 with `setTimeBonusEarned(0)`.

- [ ] **Step 9: Compute `withinLimit` from source seconds + record the log.** In `settleSelfGraded` (lines 508-511) replace:

```ts
      const elapsedMs = Math.round(performance.now() - questionStartRef.current)
      const sec = secondsForQuestion(q)
      const withinLimit = sec && sec > 0 ? elapsedMs <= sec * 1000 : true
      if (attemptsForCurrent === 0) {
        questionTimesRef.current.push(elapsedMs)
        questionLogRef.current.push({ key: sourceKeyForLog(q), ms: elapsedMs, ok: isCorrect })
      }
```

In `handleSubmit` (lines 575-578) replace the same way:

```ts
    const elapsedMs = Math.round(performance.now() - questionStartRef.current)
    const sec = secondsForQuestion(q)
    const withinLimit = sec && sec > 0 ? elapsedMs <= sec * 1000 : true
    if (attemptsForCurrent === 0) {
      questionTimesRef.current.push(elapsedMs)
      questionLogRef.current.push({ key: sourceKeyForLog(q), ms: elapsedMs, ok: isCorrect })
    }
```

Add the `sourceKeyForLog` helper near `secondsForQuestion`:

```ts
  const sourceKeyForLog = (q: CalcQuestion): string =>
    q.sourceBlockId ? `block:${q.sourceBlockId}` : q.sourceMixedOpId ? `mixed:${q.sourceMixedOpId}` : 'unknown'
```

Update both `settleSelfGraded`/`handleSubmit` dep arrays to include `secondsForQuestion` and remove `settings` where it was only for `timeLimitFromSettings` (keep `settings.soundEnabled`/`settings.sessionCounter` references intact — safest is to keep `settings`).

- [ ] **Step 10: Add the speed star.** In `settleQuestion`'s correct branch (lines 432-435), after computing `reward`, add a speed bonus when first-try within limit:

```ts
        const sec = secondsForQuestion(q)
        const speedBonus = isFirstTry && sec && sec > 0 && withinLimit ? 1 : 0
        const reward = (isFirstTry ? coinReward(q, streak) : 0) + speedBonus
```

(Replace the existing `const reward = isFirstTry ? coinReward(q, streak) : 0` line.) Add `secondsForQuestion` to the `settleQuestion` dep array.

- [ ] **Step 11: Reset the log on replay.** Find where a new session resets refs (the `onAgain`/`sessionKey` path). In the init effect (around line 144) add `questionLogRef.current = []` next to existing ref resets, OR add it where `questionTimesRef` is reset. Add inside `init`:

```ts
      questionTimesRef.current = []
      questionLogRef.current = []
      attemptsLogRef.current = []
```

- [ ] **Step 12: Pass per-question `remainingSec`** — the `CalcSessionStatusBar` usage (line 655) already passes `remainingSec`; no change. (Its semantics are now per-question.)

- [ ] **Step 13: Verify** — `pnpm lint` clean. Manual (after running the SQL migration): `/calc/session` with a block whose 限时 is set to 3秒 → header counts 3→0 per question, does NOT auto-advance at 0; first-try within 3s shows `+stars` incl. speed star; 不限/未确认 block → no countdown.

- [ ] **Step 14: Commit**

```bash
git add src/app/calc/session/page.tsx
git commit -m "feat(calc): per-question soft countdown, speed star, question_log capture"
```

---

# Phase 5 — Persistence

## Task 5.1: Read/write `question_log` in the wallet

**Files:**
- Modify: `src/hooks/useCalcWallet.ts`

- [ ] **Step 1: Extend `SessionRow` + select.** Add to `SessionRow` (after line 31): `question_log: { key: string; ms: number; ok: boolean }[] | null`. Add `question_log` to the `.select(...)` string (line 70) — append `,question_log`.

- [ ] **Step 2: Map it in `rowToSession`.** After line 50 (`questionTimesMs: …`) add:

```ts
    questionLog: r.question_log ?? [],
```

- [ ] **Step 3: Write it in `recordSession`.** In `sessionRow` (after line 236 `question_times_ms`) add:

```ts
        question_log: session.questionLog ?? [],
```

- [ ] **Step 4: Verify** — `pnpm lint` clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCalcWallet.ts
git commit -m "feat(calc): persist + load question_log on sessions"
```

---

# Phase 6 — Report + summary

## Task 6.1: Create `calc-report-stats.ts` (pure aggregation)

**Files:**
- Create: `src/utils/calc-report-stats.ts`

- [ ] **Step 1: Write the aggregation module** — rolling-20 per source key → avg秒/题, accuracy, 题/分钟, tier, gap, 进退 vs the prior 20.

```ts
// src/utils/calc-report-stats.ts
import type { CalcSession } from './type'
import { blockById } from './calc-blocks'
import { skeletonMeta } from './calc-mixed'
import { suggestedTiers, tierOf, nextTierGap, type Tier } from './calc-time-targets'

const WINDOW = 20

export interface SourceStat {
  key: string            // "block:<id>" | "mixed:<id>"
  label: string
  targetId: string       // block id or skeleton id (for TIME_TARGETS lookup)
  count: number          // first-attempt questions in the recent window
  avgSec: number
  accuracy: number       // 0..1
  perMinute: number      // 题/分钟
  tier: Tier | null
  gapSec: number         // 离下一档还差
  /** +ve = faster than the prior window (进步); null if no prior window. */
  deltaSec: number | null
}

interface Entry { ms: number; ok: boolean }

function labelFor(key: string, sessions: CalcSession[]): { label: string; targetId: string } {
  const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
  if (kind === 'block') return { label: blockById(id)?.label ?? id, targetId: id }
  // mixed: find the op label from any session is unavailable here; caller passes mixed labels.
  return { label: id, targetId: id }
}

/**
 * Aggregate per-source stats from sessions (newest-first).
 * `mixedLabels`/`mixedSkeletons` map mixed op id → display label / skeleton id.
 */
export function sourceStats(
  sessions: CalcSession[],
  mixedLabels: Map<string, string>,
  mixedSkeletons: Map<string, string>,
): SourceStat[] {
  // Flatten log entries per key, newest-first (sessions already newest-first).
  const byKey = new Map<string, Entry[]>()
  for (const s of sessions) {
    for (const e of s.questionLog ?? []) {
      const arr = byKey.get(e.key) ?? []
      arr.push({ ms: e.ms, ok: e.ok })
      byKey.set(e.key, arr)
    }
  }

  const out: SourceStat[] = []
  for (const [key, entries] of byKey) {
    if (key === 'unknown') continue
    const recent = entries.slice(0, WINDOW)
    if (recent.length === 0) continue
    const prior = entries.slice(WINDOW, WINDOW * 2)

    const avgSec = recent.reduce((a, e) => a + e.ms, 0) / recent.length / 1000
    const accuracy = recent.filter((e) => e.ok).length / recent.length
    const totalMin = recent.reduce((a, e) => a + e.ms, 0) / 60000
    const perMinute = totalMin > 0 ? +(recent.length / totalMin).toFixed(1) : 0

    const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
    const targetId = kind === 'block' ? id : (mixedSkeletons.get(id) ?? id)
    const label =
      kind === 'block'
        ? blockById(id)?.label ?? id
        : mixedLabels.get(id) ?? (mixedSkeletons.has(id) ? skeletonMeta(mixedSkeletons.get(id)! as never).label : id)

    const target = suggestedTiers(targetId)
    const tier = tierOf(avgSec, accuracy, target)
    const gapSec = nextTierGap(avgSec, tier, target)

    let deltaSec: number | null = null
    if (prior.length >= 5) {
      const priorAvg = prior.reduce((a, e) => a + e.ms, 0) / prior.length / 1000
      deltaSec = +(priorAvg - avgSec).toFixed(1) // +ve = faster now
    }

    out.push({ key, label, targetId, count: recent.length, avgSec: +avgSec.toFixed(1), accuracy, perMinute, tier, gapSec, deltaSec })
  }
  return out
}

export interface SessionVerdict {
  /** 'up' | 'down' | 'flat' | null(no prior) */
  trend: 'up' | 'down' | 'flat' | null
  deltaSec: number | null   // overall avg秒/题 delta (+ve faster)
  perMinute: number          // this session
  improved: number           // # sources faster
  regressed: number          // # sources slower
}

/** This-session verdict: latest session vs the one before it. */
export function sessionVerdict(sessions: CalcSession[]): SessionVerdict {
  const cur = sessions[0]
  if (!cur || (cur.questionLog ?? []).length === 0) {
    return { trend: null, deltaSec: null, perMinute: 0, improved: 0, regressed: 0 }
  }
  const curLog = cur.questionLog ?? []
  const curMs = curLog.reduce((a, e) => a + e.ms, 0)
  const perMinute = curMs > 0 ? +(curLog.length / (curMs / 60000)).toFixed(1) : 0
  const curAvg = curLog.length > 0 ? curMs / curLog.length / 1000 : 0

  const prev = sessions[1]
  const prevLog = prev?.questionLog ?? []
  if (prevLog.length === 0) {
    return { trend: null, deltaSec: null, perMinute, improved: 0, regressed: 0 }
  }
  const prevAvg = prevLog.reduce((a, e) => a + e.ms, 0) / prevLog.length / 1000
  const deltaSec = +(prevAvg - curAvg).toFixed(1)

  // per-source improved/regressed across the two sessions
  const avgByKey = (log: { key: string; ms: number }[]) => {
    const m = new Map<string, { sum: number; n: number }>()
    for (const e of log) {
      const a = m.get(e.key) ?? { sum: 0, n: 0 }
      a.sum += e.ms; a.n += 1; m.set(e.key, a)
    }
    return m
  }
  const curBy = avgByKey(curLog)
  const prevBy = avgByKey(prevLog)
  let improved = 0, regressed = 0
  for (const [key, c] of curBy) {
    const p = prevBy.get(key)
    if (!p) continue
    const cAvg = c.sum / c.n, pAvg = p.sum / p.n
    if (cAvg < pAvg - 100) improved++
    else if (cAvg > pAvg + 100) regressed++
  }

  const trend = Math.abs(deltaSec) < 0.1 ? 'flat' : deltaSec > 0 ? 'up' : 'down'
  return { trend, deltaSec, perMinute, improved, regressed }
}
```

> `labelFor` is unused by the public API (kept private mapping inline); remove it if lint flags it. The mixed label/skeleton maps are built by the report page from `settings.mixedOps`.

- [ ] **Step 2: Verify** — `pnpm lint`. If `labelFor` is flagged unused, delete it. Expected: otherwise clean.

- [ ] **Step 3: Commit**

```bash
git add src/utils/calc-report-stats.ts
git commit -m "feat(calc): per-source throughput + tier aggregation"
```

## Task 6.2: Slim the report page to 4 blocks

**Files:**
- Modify: `src/app/calc/report/page.tsx`

- [ ] **Step 1: Add imports** (after line 11):

```ts
import { sourceStats, sessionVerdict, type SourceStat } from '@/utils/calc-report-stats'
import { TIER_LABEL } from '@/utils/calc-time-targets'
```

- [ ] **Step 2: Build the stats** — after `const recentSessions = wallet.sessions.slice(0, 5)` (line 153) add:

```ts
  const mixedLabels = useMemo(
    () => new Map(settings.mixedOps.map((m) => [m.id, m.label ?? ''] as const)),
    [settings.mixedOps],
  )
  const mixedSkeletons = useMemo(
    () => new Map(settings.mixedOps.map((m) => [m.id, m.skeleton] as const)),
    [settings.mixedOps],
  )
  const stats = useMemo(
    () => sourceStats(wallet.sessions, mixedLabels, mixedSkeletons).sort((a, b) => a.accuracy - b.accuracy || a.avgSec - b.avgSec),
    [wallet.sessions, mixedLabels, mixedSkeletons],
  )
  const verdict = useMemo(() => sessionVerdict(wallet.sessions), [wallet.sessions])
  const needWork = useMemo(() => {
    const rank = { entry: 0, stable: 1, fluent: 2, auto: 3 } as const
    return [...stats]
      .sort((a, b) => (rank[a.tier ?? 'entry'] - rank[b.tier ?? 'entry']) || (a.deltaSec ?? 0) - (b.deltaSec ?? 0))
      .slice(0, 3)
  }, [stats])
```

- [ ] **Step 3: Replace report sections 1-3** (the `掌握度总览` tree at lines 190-297, `混合运算` at 299-344, `最弱 10 题` at 346-383) with the new 本次速览 + 各题型一行 + 需加强 blocks. Insert this in place of those three `<section>`s:

```tsx
            {/* 1. 本次速览 */}
            <section>
              <h2 className="mb-2 text-[11px] font-extrabold tracking-widest uppercase" style={{ color: 'rgba(196,181,253,0.45)' }}>
                本次速览
              </h2>
              <div className="rounded-2xl px-4 py-4" style={{ background: 'rgba(125,211,252,0.07)', border: '1px solid rgba(125,211,252,0.2)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-fredoka text-[22px] font-black leading-none" style={{ color: '#7dd3fc' }}>
                      {verdict.perMinute}<span className="ml-1 text-[12px] font-bold" style={{ color: 'rgba(125,211,252,0.6)' }}>题/分钟</span>
                    </div>
                    {verdict.trend === 'up' && <div className="mt-1 text-[12px] font-extrabold" style={{ color: '#4ade80' }}>📈 本次进步！平均每题快 {Math.abs(verdict.deltaSec ?? 0)}秒 · {verdict.improved} 个题型变快</div>}
                    {verdict.trend === 'down' && <div className="mt-1 text-[12px] font-extrabold" style={{ color: '#fbbf24' }}>📉 略有退步 · 平均每题慢 {Math.abs(verdict.deltaSec ?? 0)}秒</div>}
                    {verdict.trend === 'flat' && <div className="mt-1 text-[12px] font-bold" style={{ color: 'rgba(125,211,252,0.6)' }}>≈ 与上次持平</div>}
                    {verdict.trend === null && <div className="mt-1 text-[12px] font-bold" style={{ color: 'rgba(125,211,252,0.5)' }}>首场基准，继续加油～</div>}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. 各题型一行 */}
            {stats.length > 0 && (
              <section>
                <h2 className="mb-2 text-[11px] font-extrabold tracking-widest uppercase" style={{ color: 'rgba(196,181,253,0.45)' }}>
                  各题型速度
                </h2>
                <div className="space-y-1.5">
                  {stats.map((s) => <SourceRow key={s.key} s={s} />)}
                </div>
              </section>
            )}

            {/* 3. 需加强 Top 3 */}
            {needWork.length > 0 && (
              <section>
                <h2 className="mb-2 text-[11px] font-extrabold tracking-widest uppercase" style={{ color: 'rgba(196,181,253,0.45)' }}>
                  需加强
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {needWork.map((s) => (
                    <span key={s.key} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                      🎯 {s.label} · {s.tier ? TIER_LABEL[s.tier] : '未设目标'}
                    </span>
                  ))}
                </div>
              </section>
            )}
```

- [ ] **Step 4: Add the `SourceRow` component** at the bottom of the file (before the default export or after it as a module-level function). Place it above `export default function CalcReportPage`:

```tsx
function tierColor(tier: SourceStat['tier']): string {
  if (tier === 'auto') return '#22d3ee'
  if (tier === 'fluent') return '#4ade80'
  if (tier === 'stable') return '#fbbf24'
  if (tier === 'entry') return '#f87171'
  return 'rgba(196,181,253,0.4)'
}

function SourceRow({ s }: { s: SourceStat }) {
  const color = tierColor(s.tier)
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-bold" style={{ color: '#e9d5ff' }}>{s.label}</div>
        <div className="text-[10px]" style={{ color: 'rgba(245,243,255,0.4)' }}>
          {s.avgSec}s/题 · 正确率 {Math.round(s.accuracy * 100)}%
          {s.deltaSec !== null && s.deltaSec !== 0 && (
            <span style={{ color: s.deltaSec > 0 ? '#4ade80' : '#fbbf24' }}> · {s.deltaSec > 0 ? '↑快' : '↓慢'}{Math.abs(s.deltaSec)}s</span>
          )}
          {s.tier && s.tier !== 'auto' && s.gapSec > 0 && (
            <span style={{ color: 'rgba(196,181,253,0.5)' }}> · 再快{s.gapSec}s升档</span>
          )}
        </div>
      </div>
      <div className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ color, background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}55` }}>
        {s.tier ? TIER_LABEL[s.tier] : '未设目标'}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Clean up now-unused report code.** Remove the now-dead helpers/state used only by the deleted sections: `masteryOf`, `masteryColor`, `statusLabel`, `sortWeakest`, `prettySignature`, `rowsByBlock`, `rowsByMixedOp`, `weakest`, `expandedBlock`, `problemStates` fetch (lines 84-151 region) IF they're no longer referenced by the kept sections (错误分布 + 最近练习 use `errorCounts`/`recentSessions` only). Keep `errorCounts` fetch + `recentSessions`. The `掌握度` data is replaced by `stats`.

> Verify with `grep -n "masteryOf\|rowsByBlock\|weakest\|expandedBlock\|prettySignature\|problemStates" src/app/calc/report/page.tsx` and delete each definition with no remaining usage. `hasData` should become `stats.length > 0 || wallet.sessions.length > 0`.

- [ ] **Step 6: Verify** — `pnpm lint` clean. Manual: `/calc/report` shows 本次速览 (题/分钟 + 进步/退步), per-题型 rows with 档位 + Δ + 离下一档, 需加强 Top3, then 错误分布 + 最近练习. 未练题型不出现。

- [ ] **Step 7: Commit**

```bash
git add src/app/calc/report/page.tsx
git commit -m "feat(calc): slim tier-based report (verdict + per-type rows + needWork)"
```

## Task 6.3: Update `SessionSummary` per-题型 throughput

**Files:**
- Modify: `src/components/calc/SessionSummary.tsx`
- Modify: `src/app/calc/session/page.tsx` (compute `bySource` with time; drop timeBonus props)

- [ ] **Step 1: Extend the `bySource` prop type** in `SessionSummary` (line 25) to include time + tier:

```ts
  bySource?: { label: string; total: number; firstTryCorrect: number; perMinute: number; avgSec: number; targetSec: number | null }[]
```

- [ ] **Step 2: Render time in the bySource block.** Replace the 熟练 pill region (lines 360-377) so each row shows 题/分钟 + 秒/题(vs 目标):

```tsx
              {bySource.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 truncate text-[12px] font-bold" style={{ color: '#e9d5ff' }}>
                    {s.label}
                  </div>
                  <div className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: 'rgba(245,243,255,0.5)' }}>
                    {s.firstTryCorrect}/{s.total} 对
                  </div>
                  <div className="shrink-0 text-[11px] font-extrabold tabular-nums" style={{ color: '#7dd3fc' }}>
                    {s.perMinute} 题/分
                  </div>
                  <div className="shrink-0 text-[10px] tabular-nums" style={{ color: 'rgba(245,243,255,0.45)' }}>
                    {s.avgSec}s{s.targetSec ? `/目标${s.targetSec}s` : ''}
                  </div>
                </div>
              ))}
```

- [ ] **Step 3: Remove timeBonus props from `SessionSummary`.** Delete `timeBonusEarned` from `Props` (line 11), from the destructure (line 65), from `totalCoins` (line 82 → `const totalCoins = coinsEarned`), the conditional label (line 211), the basis line (216-220), and the entire 限时挑战 celebration card (lines 281-335). Update the 星星 card to just show `+{coinsEarned} ⭐`.

- [ ] **Step 4: Update the session page's `bySource` computation.** In `finishSession` (lines 298-315) replace the `bySource` map to include time, using `questionLogRef` grouped by key and `secondsForQuestion`:

```ts
    const logByKey = new Map<string, { sumMs: number; n: number; ok: number }>()
    for (const e of questionLogRef.current) {
      const a = logByKey.get(e.key) ?? { sumMs: 0, n: 0, ok: 0 }
      a.sumMs += e.ms; a.n += 1; if (e.ok) a.ok += 1
      logByKey.set(e.key, a)
    }
    const bySource = Array.from(sourceGroups.entries()).map(([key, attempts]) => {
      const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
      const logKey = `${kind}:${id}`
      const agg = logByKey.get(logKey)
      const avgSec = agg && agg.n > 0 ? +(agg.sumMs / agg.n / 1000).toFixed(1) : 0
      const perMinute = agg && agg.sumMs > 0 ? +(agg.n / (agg.sumMs / 60000)).toFixed(1) : 0
      const targetSec =
        kind === 'block'
          ? settings.selectedBlocks.find((b) => b.id === id)?.seconds ?? null
          : settings.mixedOps.find((m) => m.id === id)?.seconds ?? null
      return {
        label: sourceLabelOf(key),
        total: attempts.length,
        firstTryCorrect: attempts.filter((a) => a.firstTryCorrect).length,
        perMinute,
        avgSec,
        targetSec: targetSec && targetSec > 0 ? targetSec : null,
      }
    })
```

Update the `finalStats.bySource` type (lines 126-127) accordingly:

```ts
    bySource: { label: string; total: number; firstTryCorrect: number; perMinute: number; avgSec: number; targetSec: number | null }[]
```

And the `SessionSummary` usage (lines 689-700+): remove `timeBonusEarned={timeBonusEarned}`. Remove the `timeBonusEarned` state (line 114) and `setTimeBonusEarned` calls (now only `setTimeBonusEarned(0)` from Task 4.1 step 8 — delete that line too). Remove `nextFocus`/`bySource`/`newWeak` proficiency references that no longer compile — keep `newWeak`/`nextFocus` (they don't depend on proficiency time). Confirm `bySource` no longer reads `proficiency` (the new shape omits it) — the `nextFocus` sort at lines 328-331 used `s.proficiency`; change it to sort by `perMinute` ascending OR drop nextFocus. Simplest: change nextFocus to weakest by accuracy:

```ts
    const nextFocus = [...bySource]
      .sort((a, b) => a.firstTryCorrect / Math.max(1, a.total) - b.firstTryCorrect / Math.max(1, b.total))
      .slice(0, 5)
      .map((s) => s.label)
```

- [ ] **Step 5: Verify** — `pnpm lint` clean. Manual: finish a `/calc/session` → summary shows per-题型 题/分 + 秒/目标; no 限时挑战 card.

- [ ] **Step 6: Commit**

```bash
git add src/components/calc/SessionSummary.tsx src/app/calc/session/page.tsx
git commit -m "feat(calc): session summary per-type throughput; drop time-bonus card"
```

---

# Phase 7 — Home page + cleanup

## Task 7.1: Home page (remove time, show 共N题)

**Files:**
- Modify: `src/app/calc/page.tsx`

- [ ] **Step 1: Fix the blockCount/mixedCount + total.** Replace lines 61-62:

```ts
  const blockCount = settings.selectedBlocks.length
  const mixedCount = settings.mixedOps.filter((m) => m.enabled).length
  const manualTotal =
    settings.selectedBlocks.reduce((s, b) => s + b.count, 0) +
    settings.mixedOps.filter((m) => m.enabled).reduce((s, m) => s + m.count, 0)
  const totalQuestions = settings.countMode === 'manual' ? manualTotal : settings.lastCount
```

- [ ] **Step 2: `todayTarget`** (lines 27-30) — drop the URL `count` reliance; use `totalQuestions`:

```ts
  const todayTarget = totalQuestions
```

(Delete the `useMemo` + its `searchParams` use if `searchParams` becomes unused; also remove the `useSearchParams` import if unused.)

- [ ] **Step 3: `handleStart`** (lines 36-44) — no count/time params:

```ts
  const handleStart = () => {
    playSfx('coin', settings.soundEnabled)
    router.push('/calc/session?mode=daily')
  }
```

- [ ] **Step 4: Replace the 选择练习 `CalcConfigBar` section** (lines 194-215) — in auto mode show the count-only bar; in manual mode show 共N题:

```tsx
        {/* Config */}
        <section>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-widest uppercase" style={{ color: 'rgba(196,181,253,0.5)' }}>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px]" style={{ background: 'rgba(139,92,246,0.25)' }}>📐</span>
            练习题量 · 共 {totalQuestions} 题
          </div>
          {settings.countMode === 'auto' ? (
            <CalcConfigBar count={settings.lastCount} onChange={(count) => update({ lastCount: count })} />
          ) : (
            <Link href="/calc/settings" className="block rounded-2xl px-4 py-3 text-[12px] font-bold no-underline" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.12)', color: 'rgba(196,181,253,0.6)' }}>
              精准模式：各题型题量在设置里调整 →
            </Link>
          )}
        </section>
```

- [ ] **Step 5: Verify** — `pnpm lint` clean. Manual: `/calc` shows 共N题; auto shows count chips; 开始口算 launches session.

- [ ] **Step 6: Commit**

```bash
git add src/app/calc/page.tsx
git commit -m "feat(calc): home page total-only config; drop session time param"
```

## Task 7.2: Decommission `calc-time-limits.ts`

**Files:**
- Modify/Delete: `src/utils/calc-time-limits.ts`

- [ ] **Step 1: Check importers**

Run: `grep -rn "calc-time-limits" src/`
Expected: no matches after Task 4.1 removed the session import. If any remain, fix them first.

- [ ] **Step 2: Delete the file**

```bash
git rm src/utils/calc-time-limits.ts
git commit -m "chore(calc): remove unused per-bucket time-limit module"
```

> If `bucketFor`/`timeLimitMs` turn out to be referenced elsewhere (e.g. report or word-audit), keep the file and only delete `timeLimitFromSettings` + `DEFAULT_LIMIT_MS` usage. The grep in Step 1 decides.

---

## Final self-review checklist (run after all tasks)

- [ ] `grep -rn "lastTimeLimit\|timeLimitOverrides\|calcTimeBonus\|timeLimitBonusPreview\|timeLimitFromSettings\|TimeLimitsSection" src/` → **no matches**.
- [ ] `grep -rn "settings.selectedBlocks" src/` → every use treats it as `BlockSel[]` (`.id`/`.count`/`.seconds`), none as `string[]`.
- [ ] `pnpm lint` clean; `pnpm build` succeeds.
- [ ] SQL migration `docs/sql/calc-per-type-stats-migration.sql` run in Supabase **before** testing session save.
- [ ] Manual smoke: settings (both modes) → session (countdown soft, speed star) → summary (per-type 题/分) → report (verdict + tiers). Demo pages `/calc/demo`, `/calc/demo/[key]` still render (they pass `remainingSec={null}`).
