# 口算系统重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/calc` 口算从 Lv.1–20 线性阶梯重构为「纯单运算积木块 + 7 骨架混合编排」的可组合出题模型,带轻量薄弱点加权与跨次错题补练,并改造练习报告。

**Architecture:** 出题源 = 选中积木块 ∪ 启用混合条;按薄弱度加权分配题量,单运算复现薄弱+新生、混合现场组装(保证非负整除);答错追加末尾重做,未解决错题叠加进下一场。复用 `calc_problem_state` 记熟练度(砍掉间隔复习/自适应),报告与出题加权同源。

**Tech Stack:** Next.js 15 App Router、TypeScript、Supabase、Tailwind v4。Vitest 已配置(`tests/**/*.test.ts`),但**本计划核心阶段不写测试**,测试用例集中在末尾「测试用例计划」后续补充。

**Spec:** `docs/superpowers/specs/2026-06-11-calc-redesign-design.md`

**约定:**
- 每个 Task 末尾用 `pnpm lint` 验证类型;触及 UI 的 Task 额外 `pnpm build`。
- 频繁提交,分支 `feat/audio-system`(用户指定,不另开)。
- 不读其它无关模块;严格按本文件与 spec 实施。

---

## 文件结构总览

**新建:**
- `src/utils/calc-ast.ts` — 从 `calc-levels.ts` 抽出的 AST 原语(共享给 blocks/mixed)
- `src/utils/calc-blocks.ts` — 积木库目录 + 单运算生成 + 组合采样
- `src/utils/calc-mixed.ts` — 7 骨架定义 + 混合组装器
- `src/components/calc/BlockPicker.tsx` — 积木多选网格
- `src/components/calc/MixedOpComposer.tsx` — 混合编排弹层
- `src/components/calc/MixedOpList.tsx` — 已编排混合条列表
- `docs/sql/calc-redesign-migration.sql` — DB 迁移

**修改:**
- `src/utils/type.ts` — `CalcSettings` 改字段;新增 `CalcBlock`/`CalcSkeletonId`/`MixedOp`
- `src/hooks/useCalcSettings.ts` — 行映射新列
- `src/hooks/useCalcProblemState.ts` — 简化 `applyAttempt`(去 R1/R2/R3),加 `blockId`/`mixedOpId`
- `src/hooks/useCalcMistakes.ts` — 跨次错题(`sessionNo` + 上场遗留查询)
- `src/utils/calc-helpers.ts` — 重写 `buildSession`(策略 9.1)
- `src/app/calc/settings/page.tsx` — 新布局(积木多选 + 混合编排 + 题量)
- `src/app/calc/session/page.tsx` — 接新 buildSession、答错追加末尾、count+M、删状态机
- `src/app/calc/page.tsx` — 删自由练习/关卡进度展示
- `src/components/calc/SessionSummary.tsx` — 按出题源分解 + 下次预告
- `src/app/calc/report/page.tsx` — 改为积木块 + 混合条维度

**删除/停用(Phase 8):** `src/utils/calc-bank/*`、`src/utils/calc-level-eval.ts`、`src/hooks/useCalcLevel.ts`、`src/hooks/useCalcLevelState.ts`、`src/components/calc/CalcLevelProgressBar.tsx`、`src/components/calc/AssaultBanner.tsx`、`calc-session-builder.ts` 的 `interleaveWrong`。

---

## Phase 0 — 基础:AST 抽取 + 类型 + 设置 Schema

### Task 0.1: 抽出共享 AST 原语到 `calc-ast.ts`

**Files:**
- Create: `src/utils/calc-ast.ts`
- Modify: `src/utils/calc-levels.ts`(改为从 calc-ast 导入,删除本地重复)

- [ ] **Step 1: 新建 `src/utils/calc-ast.ts`**,把以下原语从 `calc-levels.ts` 原样搬过来并 `export`:

```ts
import type { CalcCategory, CalcLevel, CalcQuestion } from './type'

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export type CalcOp = 'add' | 'sub' | 'mul' | 'div'

export const OP_SYMBOL: Record<CalcOp, string> = {
  add: '+', sub: '−', mul: '×', div: '÷',
}

export type AstNode = number | { op: CalcOp; left: AstNode; right: AstNode }

export function evalAst(n: AstNode): number {
  if (typeof n === 'number') return n
  const l = evalAst(n.left), r = evalAst(n.right)
  switch (n.op) {
    case 'add': return l + r
    case 'sub': return l - r
    case 'mul': return l * r
    case 'div': return l / r
  }
}

export function signatureOf(n: AstNode): string {
  if (typeof n === 'number') return String(n)
  return `${n.op}(${signatureOf(n.left)},${signatureOf(n.right)})`
}

export function precedence(op: CalcOp): number {
  return op === 'add' || op === 'sub' ? 1 : 2
}

export function renderAst(n: AstNode, parentPrec = 0): string {
  if (typeof n === 'number') return String(n)
  const p = precedence(n.op)
  const left = renderAst(n.left, p)
  const right = renderAst(n.right, p + 1)
  const inner = `${left} ${OP_SYMBOL[n.op]} ${right}`
  return p < parentPrec ? `(${inner})` : inner
}

export function arityOf(n: AstNode): number {
  if (typeof n === 'number') return 0
  return 1 + arityOf(n.left) + arityOf(n.right)
}

export function makeQuestion(
  ast: AstNode,
  level: CalcLevel,
  category: CalcCategory,
  coinBase: number,
  isChallenge = false,
): CalcQuestion {
  const display = `${renderAst(ast)} = ?`
  const signature = signatureOf(ast)
  const answer = evalAst(ast)
  const arity = arityOf(ast) as 1 | 2 | 3
  return { display, signature, arity, level, answer, isChallenge, category, coinBase }
}
```

注:`CalcOp` 现也从 `type.ts` 导出(见 Task 0.2),`calc-ast.ts` re-export 一份以便内部使用;若 TS 报重复定义,改为 `import type { CalcOp } from './type'` 后 `export type { CalcOp }`。

- [ ] **Step 2: 改 `calc-levels.ts`** 顶部,删掉本地的 `randInt/pickOp/OP_SYMBOL/AstNode/evalAst/signatureOf/precedence/renderAst/arityOf/makeQuestion` 定义,改为:

```ts
import {
  AstNode, CalcOp, evalAst, signatureOf, precedence, renderAst, arityOf,
  makeQuestion, randInt, pickOne as pickOp, OP_SYMBOL,
} from './calc-ast'
```

保留 `genMulWithKey`/`genDivWithKey`/`genL*`/`LEVELS`/`levelSpec`/`formatLevel` 等不动(本阶段仍被旧代码引用,Phase 8 再清理)。

- [ ] **Step 3: 验证** `pnpm lint`,期望无类型错误(`calc-levels.ts` 仍编译通过)。

- [ ] **Step 4: 提交**
```bash
git add src/utils/calc-ast.ts src/utils/calc-levels.ts
git commit -m "refactor(calc): extract shared AST primitives into calc-ast.ts"
```

### Task 0.2: 类型变更 — `CalcSettings`、`MixedOp`、`CalcBlock`

**Files:**
- Modify: `src/utils/type.ts`(`CalcOp`、`CalcSettings` 区块)

- [ ] **Step 1:** `type.ts` 里把 `export type CalcOp = ...` 保持不变(已存在)。新增骨架与混合条类型(放在 `CalcSettings` 定义之前):

```ts
export type CalcSkeletonId =
  | 'as'          // 加减混合
  | 'md'          // 乘除混合
  | 'asm'         // 加减与乘法
  | 'asmd'        // 加减乘除全混合
  | 'as_m_paren'  // 加减与乘法·带括号
  | 'md_paren'    // 乘除·带括号
  | 'asmd_paren'  // 加减乘除·带括号

export interface MixedOp {
  id: string            // uuid
  skeleton: CalcSkeletonId
  blockIds: string[]    // 选中的积木块 ID
  enabled: boolean
  label?: string
}
```

- [ ] **Step 2:** 改 `CalcSettings`:**删除** `enableAddSub`/`enableMulDiv`/`enableMixed`/`currentLevel`/`adaptive`/`freeMode`/`freeModeLevels`;**新增** `selectedBlocks`/`mixedOps`。最终:

```ts
export interface CalcSettings {
  selectedBlocks: string[]   // 单运算练习选中的积木块 ID
  mixedOps: MixedOp[]        // 编排出的混合运算
  soundEnabled: boolean
  lastCount: number
  lastTimeLimit: number
  sessionCounter: number
  timeLimitOverrides: Record<string, number>
}
```

- [ ] **Step 3:** 新增 `CalcBlock` 接口(供 calc-blocks 实现):

```ts
import type { AstNode, CalcOp as _Op } from './calc-ast' // 若循环依赖,改在 calc-blocks.ts 内定义

export interface CalcBlock {
  id: string
  op: CalcOp                 // add|sub|mul|div
  label: string
  /** 单运算练习直接出题 */
  generateSingle(): CalcQuestion
  /** 混合组装时取一个该运算的子项:加减→数字叶子;乘除→乘/除子树 */
  sampleTerm(): { ast: AstNode; value: number }
}
```

> 注:`AstNode` 在 `calc-ast.ts`。若 `type.ts` 引入 `calc-ast` 造成循环(calc-ast 引 type),把 `CalcBlock` 接口**移到 `calc-blocks.ts`** 定义并导出,`type.ts` 不放。实施时优先后者(更干净)。

- [ ] **Step 4: 验证** `pnpm lint` —— 预期会因为 `useCalcSettings.ts`/`settings/page.tsx`/`session/page.tsx` 等仍引用旧字段而**报错**。这是预期的,下一 Task 起逐个修复。先确认错误集中在"旧字段不存在",不是本次类型写错。

- [ ] **Step 5: 提交**
```bash
git add src/utils/type.ts
git commit -m "feat(calc): new CalcSettings/MixedOp/CalcBlock types (breaking)"
```

### Task 0.3: `useCalcSettings` 适配新 Schema

**Files:**
- Modify: `src/hooks/useCalcSettings.ts`

- [ ] **Step 1:** 改 `DEFAULT_SETTINGS`:
```ts
const DEFAULT_SETTINGS: CalcSettings = {
  selectedBlocks: ['add:10'],
  mixedOps: [],
  soundEnabled: true,
  lastCount: 20,
  lastTimeLimit: 0,
  sessionCounter: 0,
  timeLimitOverrides: {},
}
```

- [ ] **Step 2:** 改 `RawRow`/`rowToSettings`/`settingsToRow`,读写新列 `selected_blocks`(jsonb)、`mixed_ops`(jsonb),保留 `sound_enabled/last_count/last_time_limit/session_counter/time_limit_overrides`,**不再读写** `enable_*`/`current_level`/`adaptive`/`free_mode*`:
```ts
interface RawRow {
  selected_blocks: string[] | null
  mixed_ops: MixedOp[] | null
  sound_enabled: boolean
  last_count: number
  last_time_limit: number
  session_counter: number | null
  time_limit_overrides: Record<string, number> | null
}
function rowToSettings(row: RawRow): CalcSettings {
  return {
    selectedBlocks: row.selected_blocks ?? ['add:10'],
    mixedOps: row.mixed_ops ?? [],
    soundEnabled: row.sound_enabled,
    lastCount: row.last_count,
    lastTimeLimit: row.last_time_limit,
    sessionCounter: row.session_counter ?? 0,
    timeLimitOverrides: row.time_limit_overrides ?? {},
  }
}
function settingsToRow(s: CalcSettings, userId: string) {
  return {
    user_id: userId,
    selected_blocks: s.selectedBlocks,
    mixed_ops: s.mixedOps,
    sound_enabled: s.soundEnabled,
    last_count: s.lastCount,
    last_time_limit: s.lastTimeLimit,
    session_counter: s.sessionCounter,
    time_limit_overrides: s.timeLimitOverrides,
    updated_at: new Date().toISOString(),
  }
}
```
并把 `.select('…')` 字段串改为 `'selected_blocks,mixed_ops,sound_enabled,last_count,last_time_limit,session_counter,time_limit_overrides'`。`import type { CalcSettings, MixedOp } from '@/utils/type'`。

- [ ] **Step 3: 验证** `pnpm lint` —— `useCalcSettings.ts` 应无错误(其它文件仍报错,继续后续 Task)。

- [ ] **Step 4: 提交**
```bash
git add src/hooks/useCalcSettings.ts
git commit -m "feat(calc): persist selectedBlocks/mixedOps in calc_settings"
```

---

## Phase 1 — 积木库与单运算生成

### Task 1.1: 积木库目录 `calc-blocks.ts`

**Files:**
- Create: `src/utils/calc-blocks.ts`

- [ ] **Step 1:** 实现积木库。每块用 `calc-ast` 工具生成。`generateSingle` 走 `makeQuestion(ast, 0, category, coinBase)`(level 字段不再用,填 0;category 用旧 `CalcCategory` 兼容 `CalcQuestion`)。`sampleTerm`:加/减块返回数字叶子,乘/除块返回子树。

```ts
import type { CalcBlock } from './calc-blocks' // 见 Task 0.2 Step3 注:接口就地定义
import {
  AstNode, CalcOp, makeQuestion, randInt, pickOne, evalAst,
} from './calc-ast'
import type { CalcQuestion } from './type'

export interface CalcBlock {
  id: string
  op: CalcOp
  label: string
  group: 'add' | 'sub' | 'mul' | 'div'
  generateSingle(): CalcQuestion
  sampleTerm(): { ast: AstNode; value: number }
}

// ── 加法块:返回 {ast:a+b} ──
function addBlock(id: string, label: string, gen: () => [number, number]): CalcBlock {
  return {
    id, op: 'add', label, group: 'add',
    generateSingle() {
      const [a, b] = gen()
      return makeQuestion({ op: 'add', left: a, right: b }, 0, 'addsub', 1)
    },
    // 混合里加法贡献一个操作数叶子(上限由该块决定)
    sampleTerm() { const [a] = gen(); return { ast: a, value: a } },
  }
}
function subBlock(id: string, label: string, gen: () => [number, number]): CalcBlock {
  return {
    id, op: 'sub', label, group: 'sub',
    generateSingle() {
      const [a, b] = gen()
      return makeQuestion({ op: 'sub', left: a, right: b }, 0, 'addsub', 1)
    },
    sampleTerm() { const [a] = gen(); return { ast: a, value: a } },
  }
}
function mulBlock(id: string, label: string, gen: () => [number, number]): CalcBlock {
  return {
    id, op: 'mul', label, group: 'mul',
    generateSingle() {
      const [a, b] = gen()
      return makeQuestion({ op: 'mul', left: a, right: b }, 0, 'muldiv', 2)
    },
    sampleTerm() {
      const [a, b] = gen()
      return { ast: { op: 'mul', left: a, right: b }, value: a * b }
    },
  }
}
function divBlock(id: string, label: string, gen: () => [number, number]): CalcBlock {
  // gen 返回 [dividend, divisor],保证整除
  return {
    id, op: 'div', label, group: 'div',
    generateSingle() {
      const [a, b] = gen()
      return makeQuestion({ op: 'div', left: a, right: b }, 0, 'muldiv', 2)
    },
    sampleTerm() {
      const [a, b] = gen()
      return { ast: { op: 'div', left: a, right: b }, value: a / b }
    },
  }
}

// ── 数字范围生成器 ──
const addGen = {
  r10: (): [number, number] => { const a = randInt(0, 10); return [a, randInt(0, 10 - a)] },
  r20a: (): [number, number] => { const a = randInt(10, 19); return [a, randInt(0, 9 - (a % 10))] },
  r20b: (): [number, number] => { const a = randInt(2, 9); return [a, randInt(Math.max(2, 11 - a), 9)] },
  r100a: (): [number, number] => {
    const aT = randInt(1, 8) * 10, aO = randInt(0, 9)
    const bT = randInt(0, 9 - aT / 10) * 10, bO = randInt(0, 9 - aO)
    return [aT + aO, bT + bO]
  },
  r100b: (): [number, number] => {
    let a: number, b: number, t = 0
    do { a = randInt(10, 89); b = randInt(10, 99 - a); t++ } while ((a % 10) + (b % 10) < 10 && t < 6)
    return [a, b]
  },
}
const subGen = {
  r10: (): [number, number] => { const a = randInt(0, 10); return [a, randInt(0, a)] },
  r20a: (): [number, number] => { const a = randInt(10, 20); return [a, randInt(0, a % 10)] },
  r20b: (): [number, number] => { const a = randInt(11, 19); return [a, randInt((a % 10) + 1, 9)] },
  r100a: (): [number, number] => {
    const aT = randInt(2, 9) * 10, aO = randInt(0, 9)
    const bT = randInt(0, aT / 10 - 1) * 10, bO = randInt(0, aO)
    return [aT + aO, bT + bO]
  },
  r100b: (): [number, number] => {
    let a: number, b: number, t = 0
    do { a = randInt(21, 100); b = randInt(11, a - 1); t++ } while ((a % 10) >= (b % 10) && t < 6)
    return [a, b]
  },
}
function mulKey(keys: readonly number[], otherMin: number, otherMax: number) {
  return (): [number, number] => {
    const k = pickOne(keys), o = randInt(otherMin, otherMax)
    return Math.random() < 0.5 ? [k, o] : [o, k]
  }
}
function mulBoth(min: number, max: number) {
  return (): [number, number] => [randInt(min, max), randInt(min, max)]
}
function divKey(divisors: readonly number[], qMin: number, qMax: number) {
  return (): [number, number] => { const d = pickOne(divisors), q = randInt(qMin, qMax); return [d * q, d] }
}
function divRange(dMin: number, dMax: number, qMin: number, qMax: number) {
  return (): [number, number] => { const d = randInt(dMin, dMax), q = randInt(qMin, qMax); return [d * q, d] }
}

export const BLOCKS: CalcBlock[] = [
  addBlock('add:10', '10 以内', addGen.r10),
  addBlock('add:20a', '20 以内不进位', addGen.r20a),
  addBlock('add:20b', '20 以内进位', addGen.r20b),
  addBlock('add:100a', '100 以内不进位', addGen.r100a),
  addBlock('add:100b', '100 以内进位', addGen.r100b),
  subBlock('sub:10', '10 以内', subGen.r10),
  subBlock('sub:20a', '20 以内不退位', subGen.r20a),
  subBlock('sub:20b', '20 以内退位', subGen.r20b),
  subBlock('sub:100a', '100 以内不退位', subGen.r100a),
  subBlock('sub:100b', '100 以内退位', subGen.r100b),
  mulBlock('mul:25', '×2、5', mulKey([2, 5], 2, 9)),
  mulBlock('mul:34', '×3、4', mulKey([3, 4], 2, 9)),
  mulBlock('mul:67', '×6、7', mulKey([6, 7], 2, 9)),
  mulBlock('mul:89', '×8、9', mulKey([8, 9], 2, 9)),
  mulBlock('mul:29', '2-9 综合', mulBoth(2, 9)),
  mulBlock('mul:1012', '×10-12', mulKey([10, 11, 12], 2, 12)),
  mulBlock('mul:1319', '×13-19', mulKey([13, 14, 15, 16, 17, 18, 19], 2, 19)),
  mulBlock('mul:219', '2-19 综合', mulBoth(2, 19)),
  divBlock('div:25', '÷2、5', divKey([2, 5], 2, 9)),
  divBlock('div:34', '÷3、4', divKey([3, 4], 2, 9)),
  divBlock('div:69', '÷6-9', divKey([6, 7, 8, 9], 2, 9)),
  divBlock('div:29', '÷2-9 综合', divRange(2, 9, 2, 9)),
  divBlock('div:1012', '÷10-12', divKey([10, 11, 12], 2, 12)),
  divBlock('div:1319', '÷13-19', divKey([13, 14, 15, 16, 17, 18, 19], 2, 19)),
  divBlock('div:219', '÷2-19 综合', divRange(2, 19, 2, 19)),
]

const BLOCK_MAP = new Map(BLOCKS.map((b) => [b.id, b]))
export function blockById(id: string): CalcBlock | undefined { return BLOCK_MAP.get(id) }
export function blocksByGroup(group: CalcBlock['group']): CalcBlock[] {
  return BLOCKS.filter((b) => b.group === group)
}
export const BLOCK_GROUPS: { group: CalcBlock['group']; label: string }[] = [
  { group: 'add', label: '加法' },
  { group: 'sub', label: '减法' },
  { group: 'mul', label: '乘法' },
  { group: 'div', label: '除法' },
]
```

> 删除 Task 0.2 里若放进 `type.ts` 的 `CalcBlock`,改用这里的定义(避免 AstNode 循环依赖)。其它文件 `import type { CalcBlock } from '@/utils/calc-blocks'`。

- [ ] **Step 2: 验证** `pnpm lint`(本文件应通过)。

- [ ] **Step 3: 提交**
```bash
git add src/utils/calc-blocks.ts
git commit -m "feat(calc): building-block catalog (pure-op blocks)"
```

---

## Phase 2 — 单运算设置 UI + 跑通单运算练习

### Task 2.1: `BlockPicker` 组件

**Files:**
- Create: `src/components/calc/BlockPicker.tsx`

- [ ] **Step 1:** 实现按组分块的多选网格。沿用设置页既有紫色深色调(参考 `settings/page.tsx` 的 `LevelChip` 样式)。

```tsx
'use client'
import { BLOCKS, BLOCK_GROUPS, blocksByGroup } from '@/utils/calc-blocks'

interface Props {
  selected: string[]
  onToggle: (id: string) => void
  onToggleGroup: (group: 'add' | 'sub' | 'mul' | 'div', on: boolean) => void
}

export default function BlockPicker({ selected, onToggle, onToggleGroup }: Props) {
  const set = new Set(selected)
  return (
    <div className="space-y-3">
      {BLOCK_GROUPS.map(({ group, label }) => {
        const blocks = blocksByGroup(group)
        const allOn = blocks.every((b) => set.has(b.id))
        return (
          <div key={group}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'rgba(196,181,253,0.4)' }}>{label}</span>
              <button type="button" onClick={() => onToggleGroup(group, !allOn)}
                className="rounded-md px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
                {allOn ? '取消' : '全选'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {blocks.map((b) => {
                const on = set.has(b.id)
                return (
                  <button key={b.id} type="button" onClick={() => onToggle(b.id)}
                    className="rounded-lg px-2.5 py-2 text-left text-[11px] font-extrabold transition-all"
                    style={{
                      background: on ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${on ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      color: on ? '#c4b5fd' : 'rgba(245,243,255,0.5)',
                    }}>
                    {b.label}
                  </button>
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

- [ ] **Step 2: 验证** `pnpm lint`。
- [ ] **Step 3: 提交** `git add src/components/calc/BlockPicker.tsx && git commit -m "feat(calc): BlockPicker single-op multi-select grid"`

### Task 2.2: 临时简化 `buildSession`(只跑单运算,后续 Phase 5 升级)

**Files:**
- Modify: `src/utils/calc-helpers.ts`

- [ ] **Step 1:** 把 `buildSession` 改成读 `selectedBlocks` 的最小可用版(暂不含加权/混合/错题,Phase 5/6 补全)。删除对 `bankFor`/`assembleLevelPicks`/`enabledLevels`/free 分支的依赖,改为:

```ts
import { BLOCKS, blockById } from './calc-blocks'
import type { CalcQuestion, CalcSettings, CalcMistake } from './type'

export function buildSession(
  settings: CalcSettings,
  count: number,
  _mistakes: CalcMistake[],
): CalcQuestion[] {
  const sources = settings.selectedBlocks.map(blockById).filter((b): b is NonNullable<typeof b> => !!b)
  const pool = sources.length > 0 ? sources : [BLOCKS[0]] // 兜底 add:10
  const out: CalcQuestion[] = []
  for (let i = 0; i < count; i++) {
    const blk = pool[i % pool.length]
    out.push(blk.generateSingle())
  }
  // 打乱
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
```
保留 `coinReward`/`calcTimeBonus`/`timeLimitBonusPreview`/`levelKey`/`parseLevelKey` 等其它导出。**删除** `enabledLevels`/`generateChallenge`/`buildFreeModeSession`/`pickFromBank`/`withForm`/`maybeAdvanceLevel`/`categoryLabel`(确认无人引用;若有引用先留,Phase 8 清)。

- [ ] **Step 2: 验证** `pnpm lint` —— `session/page.tsx`、`page.tsx`、`report/page.tsx` 仍会报错(下面 Task 修)。确认 `calc-helpers.ts` 本身无错。
- [ ] **Step 3: 提交** `git add src/utils/calc-helpers.ts && git commit -m "feat(calc): buildSession single-op MVP (weighting/mixed/mistakes later)"`

### Task 2.3: 重写设置页(单运算 + 题量,先不含混合编排)

**Files:**
- Modify: `src/app/calc/settings/page.tsx`

- [ ] **Step 1:** 重写 `CalcSettingsPage`:
  - 删除 `LEVELS`/`levelSpec`/`enabledLevels`/`CATEGORY_LABELS`/freeMode/currentLevel/adaptive 相关全部逻辑与 JSX。
  - 区块顺序:① 单运算 `<BlockPicker>` ② 混合运算(占位:Phase 4 接 `MixedOpList`,本步先放一个"即将开放"占位或直接留空 section)③ 题量/限时 `<CalcConfigBar count={settings.lastCount} timeLimit={settings.lastTimeLimit} onChange=… />` ④ 音效 `ToggleRow` ⑤ 限时细则 `<TimeLimitsSection>` ⑥ 底部"练一练" `QuickPracticeModal`。
  - `toggleBlock`/`toggleGroup` 写回 `update({ selectedBlocks })`。

关键片段:
```tsx
const toggleBlock = (id: string) => {
  const next = new Set(settings.selectedBlocks)
  next.has(id) ? next.delete(id) : next.add(id)
  update({ selectedBlocks: [...next] })
}
const toggleGroup = (group: 'add'|'sub'|'mul'|'div', on: boolean) => {
  const ids = blocksByGroup(group).map((b) => b.id)
  const next = new Set(settings.selectedBlocks)
  on ? ids.forEach((i) => next.add(i)) : ids.forEach((i) => next.delete(i))
  update({ selectedBlocks: [...next] })
}
```
`QuickPracticeModal` 的 `subtitle` 改为 `已选 ${settings.selectedBlocks.length} 种单运算 · ${settings.mixedOps.filter(m=>m.enabled).length} 种混合`。

> UI 改动前按项目规范先 `Skill frontend-design`(口算紫色深色调、7 岁活泼风)。

- [ ] **Step 2: 验证** `pnpm lint && pnpm build`。
- [ ] **Step 3: 手动验证(dev):** `/calc/settings` 能勾选积木块、刷新后保留(写库)。
- [ ] **Step 4: 提交** `git add src/app/calc/settings/page.tsx && git commit -m "feat(calc): rebuild settings page with block picker + count"`

### Task 2.4: 精简首页 `/calc` + 接通单运算 session

**Files:**
- Modify: `src/app/calc/page.tsx`、`src/app/calc/session/page.tsx`

- [ ] **Step 1（首页）:** `page.tsx` 删除 `useCalcLevelState`/`useCalcProblemState`(进度展示)、`CalcLevelProgressBar`、`settings.freeMode`/`currentLevel`/`levelSpec` 相关 JSX。难度卡片改为显示"已选 N 种单运算 · M 种混合"。`handleStart` 不变(`count/time/mode=daily`)。
- [ ] **Step 2（session,最小接通）:** `session/page.tsx` 暂时:
  - `buildSession(settings, requestedCount, mistakes)`(去掉 ctx/mode 参数)。
  - 删除 `problemState.seedBank`、`levelState.loadForLevels`、`isAssaultMode`、`evaluateABC`、`applyLevelSessionResult`、升降档/复测里程碑/攻坚 整段(`finishSession` 里 Phase 5 区块)。**保留** session 记录(`wallet.recordSession`)、`sessionCounter` 自增、错题 `addMistake`/`recordCorrect`、计时统计。
  - 暂时保留 `problemState.upsertStates`?——本步先**注释/删除** per-problem 状态写入(Phase 5 用简化版重接)。
  - `interleaveWrong` 暂时保留不影响功能(Phase 6 改"追加末尾");本步可先保留旧 +4 行为。
- [ ] **Step 3: 验证** `pnpm lint && pnpm build`。
- [ ] **Step 4: 手动验证(dev):** 选几个单运算块 → 开始口算 → 能出对应纯运算题、答题、结算、星星入账。
- [ ] **Step 5: 提交** `git add src/app/calc/page.tsx src/app/calc/session/page.tsx && git commit -m "feat(calc): wire single-op practice end-to-end"`

---

## Phase 3 — 混合组装引擎 `calc-mixed.ts`

### Task 3.1: 7 骨架定义 + 组装器

**Files:**
- Create: `src/utils/calc-mixed.ts`

- [ ] **Step 1:** 实现骨架元数据 + `assembleMixed`。组装规则:按 `MixedOp.blockIds` 取块,分成 加减块(`group add|sub`)与 乘除块(`group mul|div`);各槽位从对应组随机取块 `sampleTerm()`;运算符方向/操作数顺序保证**非负整数**;失败重采(上限 ~12 次)兜底。

```ts
import type { CalcSkeletonId, MixedOp, CalcQuestion } from './type'
import { AstNode, evalAst, makeQuestion, pickOne, randInt } from './calc-ast'
import { blockById, type CalcBlock } from './calc-blocks'

export interface SkeletonMeta {
  id: CalcSkeletonId
  label: string
  /** 需要哪些维度的积木(用于编排筛选与校验) */
  needs: ('add' | 'sub' | 'mul' | 'div')[]
  paren: boolean
  coinBase: number
}

export const SKELETONS: SkeletonMeta[] = [
  { id: 'as',         label: '加减混合',         needs: ['add', 'sub'], paren: false, coinBase: 2 },
  { id: 'md',         label: '乘除混合',         needs: ['mul', 'div'], paren: false, coinBase: 2 },
  { id: 'asm',        label: '加减与乘法',       needs: ['add', 'sub', 'mul'], paren: false, coinBase: 3 },
  { id: 'asmd',       label: '加减乘除全混合',   needs: ['add', 'sub', 'mul', 'div'], paren: false, coinBase: 3 },
  { id: 'as_m_paren', label: '加减与乘法·带括号', needs: ['add', 'sub', 'mul'], paren: true, coinBase: 4 },
  { id: 'md_paren',   label: '乘除·带括号',       needs: ['mul', 'div'], paren: true, coinBase: 4 },
  { id: 'asmd_paren', label: '加减乘除·带括号',   needs: ['add', 'sub', 'mul', 'div'], paren: true, coinBase: 4 },
]
export const skeletonMeta = (id: CalcSkeletonId) => SKELETONS.find((s) => s.id === id)!

// 工具:取一个加/减操作数(叶子)与运算符
function additive(blocks: CalcBlock[]): { value: number; op: 'add' | 'sub' } {
  const blk = pickOne(blocks)
  return { value: blk.sampleTerm().value, op: blk.op as 'add' | 'sub' }
}
function multiplicative(blocks: CalcBlock[]): { ast: AstNode; value: number; op: 'mul' | 'div' } {
  const blk = pickOne(blocks)
  const t = blk.sampleTerm()
  return { ast: t.ast, value: t.value, op: blk.op as 'mul' | 'div' }
}

/** 组装一道混合题;非负整数失败则返回 null(由调用方重试) */
function tryAssemble(skeleton: CalcSkeletonId, add: CalcBlock[], sub: CalcBlock[], mul: CalcBlock[], div: CalcBlock[]): AstNode | null {
  const addsub = [...add, ...sub]
  const muldiv = [...mul, ...div]
  const leaf = (v: number): AstNode => v

  switch (skeleton) {
    case 'as': {
      // t1 ± t2 (± t3),从左到右,保证中间与结果 ≥0
      const terms = addsub.length && Math.random() < 0.5 ? 3 : 2
      let acc = additive(addsub).value
      let ast: AstNode = leaf(acc)
      for (let i = 1; i < terms; i++) {
        const t = additive(addsub)
        if (t.op === 'sub') { if (acc - t.value < 0) return null; acc -= t.value; ast = { op: 'sub', left: ast, right: leaf(t.value) } }
        else { acc += t.value; ast = { op: 'add', left: ast, right: leaf(t.value) } }
      }
      return ast
    }
    case 'md': {
      // mt1 (×÷) mt2,保证整除
      const a = multiplicative(muldiv), b = multiplicative(muldiv)
      if (b.op === 'div') { /* a ÷ b 需整除:改成已知整除子树相连较难,简化为乘后除 */ }
      // 简化:t1 × t2 或 (t1) ÷ k(k 为能整除的因子)——直接复用两个乘除子树相乘
      const ast: AstNode = { op: 'mul', left: a.ast, right: b.ast }
      return ast
    }
    case 'asm': case 'as_m_paren': {
      const m = multiplicative(mul.length ? mul : muldiv) // 乘
      const s = additive(addsub)
      if (skeleton === 'as_m_paren') {
        // (a ± b) × c:把加减放进括号,再 × 一个小因子
        const a = additive(addsub).value, bt = additive(addsub)
        let inner = a, innerAst: AstNode = leaf(a)
        if (bt.op === 'sub') { if (a - bt.value < 0) return null; inner = a - bt.value; innerAst = { op: 'sub', left: leaf(a), right: leaf(bt.value) } }
        else { inner = a + bt.value; innerAst = { op: 'add', left: leaf(a), right: leaf(bt.value) } }
        const c = randInt(2, 9)
        return { op: 'mul', left: innerAst, right: leaf(c) }
      }
      // a ± (b×c);减法时保证 a ≥ b×c → 必要时换序为 (b×c) ± a 或 a 取大
      if (s.op === 'sub') {
        if (m.value > s.value) return { op: 'sub', left: m.ast, right: leaf(s.value) } // b×c − a
        return { op: 'sub', left: leaf(s.value), right: m.ast }
      }
      return { op: 'add', left: leaf(s.value), right: m.ast }
    }
    case 'md_paren': {
      // (a ÷ b) × c 或 a ÷ (b × c):用乘除块的整除子树
      const d = multiplicative(div.length ? div : muldiv)   // 除子树 a÷b
      const c = randInt(2, 9)
      return { op: 'mul', left: d.ast, right: leaf(c) }
    }
    case 'asmd': case 'asmd_paren': {
      const m = multiplicative(mul.length ? mul : muldiv)
      const dv = multiplicative(div.length ? div : muldiv)
      const s = additive(addsub)
      // a + (b×c) − (d÷e),保证 ≥0
      const plus = m.value, minus = dv.value, base = s.value
      const total = base + plus - minus
      if (total < 0) return null
      let ast: AstNode = { op: 'sub', left: { op: 'add', left: leaf(base), right: m.ast }, right: dv.ast }
      if (skeleton === 'asmd_paren') {
        ast = { op: 'mul', left: { op: 'add', left: leaf(base), right: leaf(randInt(1, 5)) }, right: leaf(randInt(2, 5)) }
        // (a+b)×c — 简化的带括号全混合;实施时可细化
      }
      return ast
    }
  }
  return null
}

export function assembleMixed(op: MixedOp): CalcQuestion {
  const blocks = op.blockIds.map(blockById).filter((b): b is CalcBlock => !!b)
  const add = blocks.filter((b) => b.group === 'add')
  const sub = blocks.filter((b) => b.group === 'sub')
  const mul = blocks.filter((b) => b.group === 'mul')
  const div = blocks.filter((b) => b.group === 'div')
  const meta = skeletonMeta(op.skeleton)
  for (let i = 0; i < 12; i++) {
    const ast = tryAssemble(op.skeleton, add, sub, mul, div)
    if (ast) {
      const v = evalAst(ast)
      if (Number.isInteger(v) && v >= 0) return makeQuestion(ast, 'C', 'mixed', meta.coinBase)
    }
  }
  // 兜底:简单 a+b×c
  return makeQuestion({ op: 'add', left: 1, right: { op: 'mul', left: 2, right: 3 } }, 'C', 'mixed', meta.coinBase)
}

/** 校验混合条是否可出题:每个 needs 维度至少一块(加减维度满足 add 或 sub 即可) */
export function isMixedOpValid(op: MixedOp): boolean {
  const groups = new Set(op.blockIds.map((id) => blockById(id)?.group).filter(Boolean))
  const meta = skeletonMeta(op.skeleton)
  const needAddsub = meta.needs.includes('add') || meta.needs.includes('sub')
  const needMul = meta.needs.includes('mul')
  const needDiv = meta.needs.includes('div')
  if (needAddsub && !(groups.has('add') || groups.has('sub'))) return false
  if (needMul && !groups.has('mul')) return false
  if (needDiv && !groups.has('div')) return false
  return true
}
```

> ⚠️ `md`/`asmd_paren` 的组装在本稿是简化实现(保证能出非负整除题)。实施时按 spec §3.3 例子细化(`8÷(2×2)`、`(2+4)×3÷2` 等真正分组),但**先保证可运行、结果合法**,细化作为该 Task 的后续打磨。

- [ ] **Step 2: 验证** `pnpm lint`。
- [ ] **Step 3: 手动验证:** 临时在任意页 `console.log(assembleMixed({id:'x',skeleton:'asm',blockIds:['sub:20b','mul:67'],enabled:true}))` 跑几次,确认输出非负整数、形如 `… − 6×7`。验证后删除临时 log。
- [ ] **Step 4: 提交** `git add src/utils/calc-mixed.ts && git commit -m "feat(calc): mixed-op skeletons + assembler"`

---

## Phase 4 — 混合编排 UI

### Task 4.1: `MixedOpComposer`(骨架选择 + 积木多选弹层)

**Files:**
- Create: `src/components/calc/MixedOpComposer.tsx`

- [ ] **Step 1:** 弹层:先选骨架(`SKELETONS`),再按 `meta.needs` 用 `blocksByGroup` 列出可选块多选;底部"保存"。保存时生成 `MixedOp`(`id=crypto.randomUUID()`,`enabled:true`),校验 `isMixedOpValid` 不过则禁用保存并提示。`label` 自动拼:`${meta.label} · ${选中块label join '+'}`。

接口:
```tsx
interface Props {
  initial?: MixedOp            // 编辑已有;缺省=新增
  onSave: (op: MixedOp) => void
  onClose: () => void
}
```
样式沿用深色紫调;骨架用大按钮带例子(取 spec 表中"形状"列)。

- [ ] **Step 2: 验证** `pnpm lint`。
- [ ] **Step 3: 提交** `git add src/components/calc/MixedOpComposer.tsx && git commit -m "feat(calc): MixedOpComposer modal"`

### Task 4.2: `MixedOpList` + 接入设置页

**Files:**
- Create: `src/components/calc/MixedOpList.tsx`
- Modify: `src/app/calc/settings/page.tsx`

- [ ] **Step 1（List）:** 渲染 `settings.mixedOps`,每条:启用开关、`label`、编辑、删除;底部「+ 添加混合运算」按钮触发 `MixedOpComposer`。
- [ ] **Step 2（接入）:** 设置页"混合运算"section 用 `<MixedOpList>`,增删改写回 `update({ mixedOps })`。
- [ ] **Step 3: 验证** `pnpm lint && pnpm build`;手动:能添加/编辑/删除/启停混合条并持久化。
- [ ] **Step 4: 提交** `git add src/components/calc/MixedOpList.tsx src/app/calc/settings/page.tsx && git commit -m "feat(calc): mixed-op composition in settings"`

---

## Phase 5 — 薄弱加权 + 简化熟练度 + 完整 buildSession

### Task 5.1: 简化 `useCalcProblemState`(去间隔复习,加归属字段)

**Files:**
- Modify: `src/hooks/useCalcProblemState.ts`、`src/utils/type.ts`(`CalcProblemState`)

- [ ] **Step 1（类型）:** `CalcProblemState` 增 `blockId?: string`、`mixedOpId?: string`;保留 `signature/proficiency/attemptCount/consecutiveWrong/recentResults/status/updatedAt`。**删除** `shortMasteredAt/reviewR1Due/reviewR2Due/reviewR3Due/longMastered/lastSeenSession/timesSeenThisRound/forcedNext`(或保留列但不再使用——为减小迁移面,保留 DB 列、TS 标 optional 不读)。
- [ ] **Step 2（applyAttempt 简化）:** 重写为纯 0–5 熟练度:首答对且 withinLimit→+1(cap5);对但慢/重试→+0(或+0.5 取整保守);错→−2 floor0、`consecutiveWrong+1`;对则 `consecutiveWrong=0`。`status`:`attemptCount===0`→'active'(未练用 'active' 占位);proficiency≥4 且 attemptCount≥3→'mastered';否则 'active'。去掉所有 review/forced 分支与 `justReviewPassed` 等导出(或保留空实现避免 import 报错——优先删除并清引用)。
- [ ] **Step 3:** `upsertStates` 持久化 `block_id/mixed_op_id`。
- [ ] **Step 4: 验证** `pnpm lint`(session 页引用的 `justReviewPassed` 等若删要同步清——见 Task 5.3)。
- [ ] **Step 5: 提交** `git add src/hooks/useCalcProblemState.ts src/utils/type.ts && git commit -m "refactor(calc): lightweight proficiency, drop spaced-repetition"`

### Task 5.2: `buildSession` 完整策略(加权 + 复现 + 混合)

**Files:**
- Modify: `src/utils/calc-helpers.ts`

- [ ] **Step 1:** 用 spec §9.1 ①②③④⑤ 重写 `buildSession`(错题 ⓪ 在 Phase 6 接)。签名:
```ts
export interface BuildCtx {
  problemStates: Map<string, CalcProblemState>
  // 历史薄弱 signature(按归属分组),供复现
}
export function buildSession(settings: CalcSettings, count: number, ctx: BuildCtx): CalcQuestion[]
```
实现要点(完整代码):
  - 源 = 选中块(每块一源)+ 启用且 `isMixedOpValid` 的混合条(每条一源);空→`[BLOCKS[0]]`。
  - 每源聚合熟练度 `p`:块→该 blockId 下 states 的均值(乘/除可用覆盖率,先统一用均值,覆盖率留报告);混合→该 mixedOpId 下 states 均值;无数据→`p=0`。
  - 权重 `w=1−p/5`;`count≥源数`→每源 1 + 余量按 w 最大余数法;否则取最弱 count 源各 1。
  - 块源生成:35% 名额复现该 blockId 下 `proficiency` 最低且未 mastered 的 signature(从 ctx.problemStates 过滤,按 proficiency 升序+consecutiveWrong 降序取),复现题用其 signature 重建 display(从 signature 解析 AST 或保存 display——简化:复现用 `blk.generateSingle()` 直到命中目标 signature 上限 N 次,否则普通新生);其余 `blk.generateSingle()`。
  - 混合源生成:全部 `assembleMixed(op)`。
  - 汇总 Fisher-Yates 打乱。
- [ ] **Step 2:** `signature` 已由 makeQuestion 生成,块/混合归属在 session 结算时回填(Task 5.3)。
- [ ] **Step 3: 验证** `pnpm lint`。
- [ ] **Step 4: 提交** `git add src/utils/calc-helpers.ts && git commit -m "feat(calc): weakness-weighted buildSession with mixed sources"`

### Task 5.3: session 页接简化熟练度 + 归属回填

**Files:**
- Modify: `src/app/calc/session/page.tsx`

- [ ] **Step 1:** `buildSession(settings, requestedCount, { problemStates: problemState.states })`。每道题携带其来源(块 id 或 mixedOp id):在 `AttemptStat` 加 `blockId?`/`mixedOpId?`,出题时把来源标在 `CalcQuestion`(给 `CalcQuestion` 加可选 `sourceBlockId?`/`sourceMixedOpId?`,在 `buildSession` 写入)。
- [ ] **Step 2:** `finishSession` 用简化 `applyAttempt` 写 `calc_problem_state`(带 blockId/mixedOpId),删掉所有 level-eval / 升降档 / 复测 / 攻坚 / 事件日志调用。
- [ ] **Step 3: 验证** `pnpm lint && pnpm build`;手动:答题后 `/calc/report`(旧版可能崩,先忽略)或直接查 DB 确认 proficiency 更新、block_id 落库。
- [ ] **Step 4: 提交** `git add src/app/calc/session/page.tsx src/utils/type.ts && git commit -m "feat(calc): record lightweight proficiency with source attribution"`

---

## Phase 6 — 错题:本场追加末尾 + 跨次叠加

### Task 6.1: 本场答错追加到末尾(替代 interleaveWrong)

**Files:**
- Modify: `src/app/calc/session/page.tsx`

- [ ] **Step 1:** 去掉 `interleaveWrong` 调用。改为:维护 `wrongQueueRef: CalcQuestion[]`;当某题最终答错(`feedback==='wrong'` 分支)把该题 push 进 `wrongQueueRef`。原计划题(`idx` 走到 `questions.length`)结束后,若 `wrongQueueRef` 非空,把它接到 `questions` 末尾(`setQuestions(prev => [...prev, ...drained])`)并继续;补做段里再错继续入队,直到队空 → `finishSession`。
- [ ] **Step 2:** 进度条:分母用"原计划题数"(`plannedCountRef`),补做段显示"错题补做 x/y"提示,不回退进度条(参考 spec §9.1 ⑤ 注)。
- [ ] **Step 3: 验证** `pnpm lint && pnpm build`;手动:故意答错 → 计划题做完后这些题在末尾重现,答对后才结束。
- [ ] **Step 4: 提交** `git add src/app/calc/session/page.tsx && git commit -m "feat(calc): re-practice wrong questions at session tail"`

### Task 6.2: 跨次错题叠加(count + M)

**Files:**
- Modify: `src/hooks/useCalcMistakes.ts`、`src/app/calc/session/page.tsx`、`src/utils/calc-helpers.ts`

- [ ] **Step 1（mistakes 标记 session）:** `CalcMistake` 增 `sessionNo?: number`;`addMistake` 写入当前 `settings.sessionCounter+1`。新增查询/派生 `lastSessionUnresolved(prevSessionNo)`:返回归属上一场且未 resolved 的错题。
- [ ] **Step 2（buildSession ⓪）:** `buildSession` 增参 `carriedMistakes: CalcMistake[]`;先把这些以原 display/signature 造题(`coinBase:1`)放入结果,**总题量 = count + carried.length**(carried 截断到 ≤count);其余 count 走 ①②③;一起打乱。
- [ ] **Step 3（session 接线）:** init 时 `const carried = mistakesHook.lastSessionUnresolved(settings.sessionCounter)`;`buildSession(settings, requestedCount, ctx, carried)`。`plannedCountRef = requestedCount + carried.length`。
- [ ] **Step 4: 验证** `pnpm lint && pnpm build`;手动:第一场错 3 题 → 下一场题量 = 配置 + 3,且那 3 题作为补练出现;连对 3 次后不再带入。
- [ ] **Step 5: 提交** `git add -A && git commit -m "feat(calc): carry unresolved mistakes into next session (count + M)"`

---

## Phase 7 — 报告

### Task 7.1: `SessionSummary` 扩展(按出题源分解 + 下次预告)

**Files:**
- Modify: `src/components/calc/SessionSummary.tsx`、`src/app/calc/session/page.tsx`

- [ ] **Step 1:** `SessionSummary` 增 props:`bySource: { label: string; total: number; firstTryCorrect: number; profDelta: number }[]`、`newWeak: string[]`(本次新错算式)、`nextFocus: { label: string }[]`(下次会多出的最弱 3–5)。渲染三个小区块。
- [ ] **Step 2:** session 页 `finishSession` 里按 `attemptsLog` 的 blockId/mixedOpId 聚合出 `bySource`;`newWeak` = 本场最终答错的 display;`nextFocus` = 更新后各源 proficiency 升序取前 5 的 label。
- [ ] **Step 3: 验证** `pnpm lint && pnpm build`;手动看结算页。
- [ ] **Step 4: 提交** `git add -A && git commit -m "feat(calc): per-source session report + next-focus preview"`

### Task 7.2: 改造 `/calc/report`(积木块 + 混合条维度)

**Files:**
- Modify: `src/app/calc/report/page.tsx`

- [ ] **Step 1:** 删除 `calc_level_state`/`calc_event_log` 读取、`bankFor`/`expectedBankSize`/`LEVELS`/关卡状态/事件时间线 JSX。
- [ ] **Step 2:** 改为读 `calc_problem_state`(含 block_id/mixed_op_id)+ `calc_sessions`。渲染:
  - 掌握度总览:按 `BLOCK_GROUPS` 分组,每块一行:熟练度(乘/除=覆盖率口径=已 mastered 口诀数/该块全口诀数;加减/混合=已答均值)、作答数、状态条;展开看该块下最弱算式。
  - 混合条:遍历 `settings.mixedOps`,按 mixed_op_id 聚合均值熟练度、作答数。
  - 最弱 10 题:复用现有 weakest 逻辑(proficiency 升序 + consecutive_wrong 降序)。
  - 最近练习:`wallet.sessions.slice(0,5)`。
  - 乘/除覆盖率全集:在 `calc-blocks.ts` 给乘/除块加 `enumerate?(): string[]`(返回该块全部 signature),报告用其长度做分母。**本 Task 顺带在 calc-blocks 实现 `enumerate`**(mul:67 → `mul(6,2)..mul(7,9)` 等;div 同理)。
- [ ] **Step 3: 验证** `pnpm lint && pnpm build`;手动:报告显示各块熟练度、展开看最弱算式、混合条聚合、最近练习。
- [ ] **Step 4: 提交** `git add -A && git commit -m "feat(calc): rework report to blocks + mixed-ops dimensions"`

---

## Phase 8 — 清理 + 迁移 SQL

### Task 8.1: 删除旧机制

**Files (删除):**
- `src/utils/calc-bank/`(整目录)
- `src/utils/calc-level-eval.ts`
- `src/hooks/useCalcLevel.ts`、`src/hooks/useCalcLevelState.ts`
- `src/components/calc/CalcLevelProgressBar.tsx`、`src/components/calc/AssaultBanner.tsx`

- [ ] **Step 1:** 全局搜索这些模块的 import,逐个清除引用(应已在 Phase 2/5 大部分清掉)。`grep -rn "calc-bank\|calc-level-eval\|useCalcLevel\|CalcLevelProgressBar\|AssaultBanner\|interleaveWrong" src`。
- [ ] **Step 2:** 删文件;`calc-session-builder.ts` 若仅剩 `interleaveWrong` 则整删,否则只删该导出。`calc-levels.ts` 若已无人引用(report 已改)则删;`calc-event-log.ts` 停用(确认无写入)。
- [ ] **Step 3:** `calc-helpers.ts` 清掉遗留死导出(`enabledLevels` 等若仍在)。
- [ ] **Step 4: 验证** `pnpm lint && pnpm build`(必须全绿)。
- [ ] **Step 5: 提交** `git add -A && git commit -m "chore(calc): remove bank/level-state/adaptive machinery"`

### Task 8.2: 迁移 SQL

**Files:**
- Create: `docs/sql/calc-redesign-migration.sql`

- [ ] **Step 1:** 写迁移(手动在 Supabase 执行,不自动跑):
```sql
-- calc_settings: 新列
alter table calc_settings add column if not exists selected_blocks jsonb default '["add:10"]'::jsonb;
alter table calc_settings add column if not exists mixed_ops jsonb default '[]'::jsonb;
-- 旧列保留以便回滚:enable_addsub/enable_muldiv/enable_mixed/current_level/adaptive/free_mode/free_mode_levels

-- calc_problem_state: 归属
alter table calc_problem_state add column if not exists block_id text;
alter table calc_problem_state add column if not exists mixed_op_id text;

-- calc_mistakes: 跨次错题
alter table calc_mistakes add column if not exists session_no integer;

-- calc_level_state / calc_event_log: 停写不删(无需 SQL)
```
- [ ] **Step 2:** 文件顶部加注释说明手动执行、CLAUDE.md 风格。
- [ ] **Step 3: 提交** `git add docs/sql/calc-redesign-migration.sql && git commit -m "chore(calc): redesign DB migration (manual)"`

### Task 8.3: 更新 CLAUDE.md 口算段

**Files:**
- Modify: `CLAUDE.md`(若有口算/calc 架构描述)

- [ ] **Step 1:** 若 CLAUDE.md 描述了旧 Lv/bank/自适应,更新为新"积木块 + 7 骨架混合编排 + 薄弱加权 + 跨次错题"模型。无相关段落则跳过。
- [ ] **Step 2: 提交** `git add CLAUDE.md && git commit -m "docs: update CLAUDE.md for calc redesign"`

---

## 测试用例计划(核心功能完成后补充)

> 全部放 `tests/calc/`,`vitest run`。核心阶段**不写**,此处仅列清单,后续按此补。

### `tests/calc/calc-blocks.test.ts`
- 每个块 `generateSingle()` 跑 200 次:`answer` 与 `display` 自洽(`evalAst(parse)===answer`);运算符与 `op` 一致(纯单运算)。
- 数字范围断言:`add:10` 两操作数与和 ≤10;`add:20a` 不进位(个位和<10);`add:20b` 进位;`sub:*` 不出负;`mul:67` 含因子 6 或 7;`div:*` 整除且除数≥2、商≥2。
- `sampleTerm()`:加减块返回数字叶子;乘除块返回对应子树且 `value` 正确。
- `blockById`/`blocksByGroup`/`BLOCK_GROUPS` 覆盖全 25 块。

### `tests/calc/calc-mixed.test.ts`
- 7 骨架各 `assembleMixed` 跑 200 次:结果**非负整数**;`display` 渲染与 `answer` 一致;含括号骨架渲染出 `(`。
- `asm` + {`sub:20b`,`mul:67`}:能产生 `b×c − a` 形态且不为负。
- `md_paren`/`asmd_paren` 括号确实改变分组(对比无括号求值不同的样本存在)。
- `isMixedOpValid`:缺乘块的 `asm` 判 false;齐全判 true。

### `tests/calc/build-session.test.ts`
- 仅单运算:`count=20`、选 2 块 → 返回 20 题且两块都出现。
- 加权:给一块全 mastered(高 proficiency)、一块全新 → 新块题数显著多。
- 保底:选 5 块、`count=3` → 取最弱 3 块各 1 题。
- 混合源混入:选 1 块 + 1 启用混合条 → 两类都出现。
- 错题叠加 ⓪:`carried=3`、`count=20` → 返回 23 题,含 3 道 carried 原题。
- 兜底:空选 → 返回 `add:10` 题。

### `tests/calc/proficiency.test.ts`
- `applyAttempt`:首答对 withinLimit → proficiency+1(cap5);答错 → −2 floor0、consecutiveWrong+1;连对清零;status 在 proficiency≥4 且 attempt≥3 →'mastered'。
- 无 R1/R2/R3 字段被读取。

### `tests/calc/mistakes-carry.test.ts`
- 上场未解决错题被 `lastSessionUnresolved` 取出;resolved(连对3)后不再返回;`session_no` 正确标记。

### 组件测试(可选,`@testing-library/react`)
- `BlockPicker`:点击切换选中、组全选/取消。
- `MixedOpComposer`:选骨架后只显示对应维度积木;缺维度时保存禁用。

---

## Self-Review 记录

- **Spec 覆盖:** §3 积木/骨架→Phase1/3/4;§4 薄弱加权→Phase5;§5 报告→Phase7;§6 题量→Phase2(CalcConfigBar);§7 类型/迁移→Phase0/8;§9 策略→Phase5/6;§10 删除→Phase8;§11 边界(空选兜底/混合校验/块拆分/金币)→各 Task 内。错题双层→Phase6。✅
- **占位:** `md`/`asmd_paren` 组装标注为"先可运行后细化",非 TBD,有兜底实现。
- **类型一致:** `CalcBlock` 统一在 `calc-blocks.ts` 定义;`buildSession` 签名跨 Task 一致(Phase2 MVP→Phase5 加 ctx→Phase6 加 carried,每次显式给出新签名)。
