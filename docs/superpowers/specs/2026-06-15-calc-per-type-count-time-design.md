# 口算 — 按题型的题量 / 限时 / 统计 重构设计

**Date:** 2026-06-15
**Branch:** feature/calc-fusion
**Status:** Design (awaiting review)

## 1. 背景与目标

当前 `/calc` 的「题量·限时」是**全局**配置：

- `lastCount` — 整个 session 的总题量（chips 10/20/30/50/100）。
- `lastTimeLimit` — 整个 session 的**总倒计时**（不限/1分/3分/5分/10分），到 0 自动结束 session；结束时按 `calcTimeBonus` 一次性发放速度加成星。
- `timeLimitOverrides` — 另一套**按 12 个关卡 bucket（毫秒）**的「答题时限」，折叠在底部、对孩子不可见，仅通过 `withinLimit` 静默影响熟练度。

存在两套互相重叠的时间模型（schema 不对称），且题量/限时与「题型」脱钩。本设计将**题量、限时、统计三者统一到「题型」这一粒度**。

### 核心原则

> **题型（source）是统计的原子单位。** 每道题在生成时即被打上题型标签；每次练习按题型记录「答题数量 + 用时 + 对错」，且持久化保留**逐题三元粒度**（题型, 时间, 对错），而非预先汇总。任何统计视图（单题型 / 分组 / 汇总）都只是同一批原子记录的不同 roll-up。

「单位时间答题量（题/分钟）」是判断练习效果最直观、最核心的指标，必须按题型记录并进入报告。

## 2. 数据模型

题型有两类 source：单运算 block 与 混合运算 mixed op。两者各自**内联持有**自己的 `count` 与 `seconds`（对称，不用平行 map）。

```ts
// 单运算选择项（原来仅是 string id）
export interface BlockSel {
  id: string
  count: number      // 精准模式下使用
  seconds: number    // 每题目标秒数；0 = 不限
}

export interface MixedOp {
  id: string
  skeleton: CalcSkeletonId
  blockIds: string[]
  enabled: boolean
  label?: string
  count: number      // 新增
  seconds: number    // 新增；0 = 不限
}

export interface CalcSettings {
  countMode: 'auto' | 'manual'   // 新增：题量分配模式
  lastCount: number              // 保留：auto 模式的全局总题量
  selectedBlocks: BlockSel[]     // 由 string[] 改为对象数组
  mixedOps: MixedOp[]
  soundEnabled: boolean
  includeInverse: boolean
  verticalForBigNumbers: boolean
  sessionCounter: number
  // 移除：lastTimeLimit, timeLimitOverrides
}
```

`selected_blocks` 列已是 **jsonb**（`default '["add:10"]'`），可直接存对象数组，无需新增列。

## 3. 题量模式（全局开关 auto ⇄ manual）

- **自动分配（默认，保留现状行为）**：一个全局**总题量** chips `10·20·30·50·100`（`lastCount`）。`buildSession` 走**原 `allocate()`**，把总量按弱项/难度加权分配到各选中题型，叠加题型内部的弱点重现。**不显示**逐题型题量输入。
- **精准设置**：每个选中题型显示自己的**题量** chips；总题量 = 各题型之和。题型内部弱点重现照常。**不显示**全局总题量。

> 弱项加权（用户要求保留）：跨题型加权 = `allocate()` 的 weights（仅 auto 模式生效）；题型内部弱点重现 = `generateBlock` 的 ~35% 最弱 signature 重现（两种模式都生效）。选单一题型时，两种模式表现一致。

**限时与题量模式无关**：每个选中题型**始终**有自己的 `seconds`，因为倒计时/速度窗口是题型固有属性，与如何分配题量无关。

## 4. 设置页 UI

每个**选中**的 block / **启用**的 mixed op 展开为：

- **题量**（仅 manual 模式）：现有 chips `10·20·30·50·100`。
- **限时**（始终）：chips `不限 · 1秒 · 3秒 · 5秒 · 10秒 · 自定义`；选「自定义」展开秒数数字输入框；非预设值自动选中「自定义」并回填。

页面级：

- 顶部题量模式开关 `自动分配 ⇄ 精准设置`。
- auto 模式：题型列表上方一个全局**总题量** chips；列表行只显示限时。
- manual 模式：列表行显示题量 + 限时；显示 **共 N 题** 合计行。
- 删除全局 `CalcConfigBar` 的限时行与 `TimeLimitsSection`（被取代）。
- `CalcConfigBar` 收敛为**仅题量 chips** 的组件，用于 auto 模式的全局总题量（首页同样复用）。

## 5. 答题（session）行为

### 5.1 每题倒计时（软性）

- header 显示**按题**倒计时，初值取当前题 source 的 `seconds`（每题重置）。`seconds === 0`（不限）→ 不显示倒计时。
- **软性**：到 0 **不**自动跳题、**不**判错——只是关闭「速度窗口」，并切换为温和提示（如 `⏰ 慢慢来～`，非红色告警），孩子按自己节奏完成。
- `CalcSessionStatusBar` 已接收 `remainingSec`，改为喂入按题剩余值；demo 仍传 `null`。

### 5.2 奖励（星星 + 熟练度 都要）

- 首次作答 **在该题型 `seconds` 内答对** → **+1 ⭐ 速度星**（叠加在基础 `coinReward` 上），且 `withinLimit = true` 计入熟练度。
- 超时但答对 → 答对、基础星，**无**速度星、**不**计入「限时熟练」。
- `seconds === 0`（不限）→ 无倒计时、无速度星；答对照常按 `withinLimit = true` 计入熟练度。
- `withinLimit` 的计算由 `timeLimitFromSettings(level)` 改为 `elapsedMs ≤ source.seconds * 1000`（`seconds>0` 时）。

### 5.3 移除

全局 session 倒计时：`lastTimeLimit`、header 的整局 `remainingSec`、**到 0 自动结束**、`calcTimeBonus` / `timeLimitBonusPreview`、`time` URL 参数、`TimeLimitsSection`、`timeLimitOverrides` bucket 系统（列保留但不再读写）。`bucketFor`/`timeLimitMs` 不再使用。

## 6. 统计：按题型记录 + 报告

### 6.1 打标与持久化（逐题三元粒度）

- 每道题已带 `sourceBlockId` / `sourceMixedOpId`（`buildSession` 中标注），attempt log 也带 `timeMs`。
- 新增 session 字段 **`question_log: [{ key, ms, ok }]`**：每题一条，`key = "block:<id>" | "mixed:<id>"`，`ms` = 首次作答用时，`ok` = 首次是否答对。
- `question_times_ms`（旧的扁平无类型 `number[]`）**仅保留供旧行回退读取**，新行不再写入（避免平行重复，遵守 schema 对称）。

### 6.2 读时聚合

- **单题型**：按 `key` 过滤 log（跨 session）→ `count`、`totalMs` → **题/分钟** = `count / (totalMs/60000)`、**平均每题秒** = `totalMs/count/1000`。
- **分组 / 汇总**：按 group 或全部 求和。
- `calc_problem_state`（含 `block_id`/`mixed_op_id`、proficiency）继续承载**按 signature 的掌握度**（更细的钻取）；session log 承载**按题型的时间+数量**（吞吐趋势）。两者各司其职，不重复。

### 6.3 展示

- **报告页**新增「答题速度」区：按题型显示 **题/分钟**（标题指标）+ **平均每题 X 秒（目标 Y 秒）**，并提供 单题型 / 分组 / 汇总 三种粒度；目标值取该题型 `seconds`。
- **SessionSummary**：本次每题型的 题/分钟 与 平均秒/题（vs 目标），替换原先无时间的 `bySource` 仅计数展示。

## 7. 默认值与迁移

- 新选中题型默认：`count: 20`、`seconds:` 按类型默认（10以内 3s · 20以内 3s · 100以内 5s · 乘 3s · 除 5s · 混合 10s）。提供 `defaultSecondsForBlock(blockId)`（替代 bucket 默认）。
- `countMode` 默认 `'auto'`。
- `rowToSettings` 向后兼容：旧 `selected_blocks: ["add:10"]` → `[{ id:"add:10", count:20, seconds:3 }]`；旧 `mixed_ops` 缺 `count/seconds` 时补默认。
- **SQL 迁移**（手动执行）：`docs/sql/calc-per-type-stats-migration.sql`
  - `alter table calc_sessions add column if not exists question_log jsonb not null default '[]'::jsonb;`
  - `selected_blocks` 形状变更走 jsonb，无 DDL；`last_time_limit` / `time_limit_overrides` 列保留但停用（不读写）。

## 8. 受影响文件

| 文件 | 改动 |
| --- | --- |
| `src/utils/type.ts` | `BlockSel`、`MixedOp(+count,+seconds)`、`CalcSettings(countMode/selectedBlocks 改型/移除字段)`、`CalcSession.questionLog` |
| `src/hooks/useCalcSettings.ts` | `DEFAULT_SETTINGS`、`rowToSettings/settingsToRow` 升级与回退、移除 time 字段 |
| `src/utils/calc-time-limits.ts` | 移除 bucket override 系统；新增 `defaultSecondsForBlock` |
| `src/utils/calc-helpers.ts` | `buildSession` 支持 auto/manual；保留 `allocate`；移除 `calcTimeBonus`/`timeLimitBonusPreview` |
| `src/components/calc/CalcConfigBar.tsx` | 收敛为仅题量 chips（用于 auto 全局总题量 / 首页） |
| `src/components/calc/BlockPicker.tsx` | 选中行内联 题量(manual)+限时 chips |
| `src/components/calc/MixedOpList.tsx` / `MixedOpComposer.tsx` | 每个 mixed op 加 题量+限时 |
| `src/components/calc/TimeLimitsSection.tsx` | **删除** |
| `src/app/calc/settings/page.tsx` | 题量模式开关、删除旧两节、共 N 题合计 |
| `src/app/calc/page.tsx` | 移除限时；显示共 N 题 / auto 快速总题量；`handleStart` 去掉 time 参数 |
| `src/app/calc/session/page.tsx` | 按题倒计时(软性)、速度星、`withinLimit` 改源、移除全局倒计时/自动结束/timeBonus、写 `question_log`、按题型采集 |
| `src/hooks/useCalcWallet.ts` | `recordSession` 写 `question_log`；`CalcSession` 映射 |
| `src/app/calc/report/page.tsx` | 新增「答题速度」区（题/分钟、秒/题 vs 目标、单/分组/汇总） |
| `src/components/calc/SessionSummary.tsx` | 每题型 题/分钟 + 秒/题(vs 目标) |
| `docs/sql/calc-per-type-stats-migration.sql` | **新增** 迁移（question_log 列） |

## 9. 非目标 / 不做

- 不做硬性倒计时（到点强制跳题/判错）——与「软性、对 7 岁孩子友好」原则冲突。
- 不引入按 signature 的逐题计时持久化（掌握度已由 `calc_problem_state` 承载；吞吐只需题型粒度）。
- 不重构错题/熟练度算法本身。
- `last_time_limit` / `time_limit_overrides` 列不删除（仅停用），避免破坏旧数据与额外 DDL 风险。

## 10. 已确认决策

- 题量：保留跨题型弱项加权，做成 `auto/manual` 全局开关（auto 走原 `allocate`）。
- 限时：`不限/1秒/3秒/5秒/10秒/自定义`，单位秒，按题型。
- 倒计时：保留，但改为**按题、软性**。
- 奖励：速度星 + 熟练度 都要。
- 统计：题型为原子单位，逐题打标，`question_log` 三元粒度，读时聚合；吞吐单位 = 题/分钟（辅以 平均秒/题 vs 目标）。
