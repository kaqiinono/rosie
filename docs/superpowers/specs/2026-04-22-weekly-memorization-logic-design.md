# 周计划记忆逻辑重构设计

**日期**: 2026-04-22
**状态**: Design approved, awaiting user spec review
**范围**: 英语单词模块 —— 周计划 session 的单词筛选、题型生成、达标判定、旧词池衔接

---

## 1. 问题陈述

当前"周复习"（`getReviewWordsForDay` → `weekReview`）对用户的真实目标 —— **"本周内让所有选中的必记词都被稳住"** —— 无法提供可靠保证。具体问题：

1. **9 词硬上限**（`.slice(0, 9)`）会让一周中引入较多的词被永久挤出复习池，周末甚至不会再出现
2. **排序仅按 `correct` 升序**，忽略 `incorrect` 和近因，导致"真难词"被误判为"已掌握"
3. **不区分"必记"和"预习"两类词**。用户真实心智是：本周 plan 里除最后一课外都是**必记**（上周已预习过，本周要稳住），最后一课是**预习**（下周才硬碰）。现有代码将它们一视同仁
4. **周 session 里混入 `oldReview`（跨周老词）**，和页面已有的"📚 旧词复习"按钮数据重复，并稀释本周专注度
5. **SRS `nextReviewDate` 没有抖动**，同一天、同 stage 升级的一批词会被同步分配到未来同一天，在旧词池造成"批量爆炸日"

---

## 2. 用户目标

> 本周 plan 里所有**必记词**，在本周结束前必须达到 "不会很快忘记" 的状态；**预习词**本周只负责首次接触、打基础，下周再正式攻克。跨周老词通过独立的"旧词复习"入口按艾宾浩斯曲线维持。

**硬性标准**：必记词本周结束时 `masteryInfo.stage >= 2`。

---

## 3. 新设计

### 3.1 分类规则（Classification）

输入：当前周 `plan`、词表 `vocab`
输出：每个词被标记为 `'consolidate' | 'preview'`

算法：

1. 收集 `plan.days[0..6].newWordKeys` 的并集
2. 对这些词取它们所属的 `(unit, lesson)` 集合
3. 在 `getOrderedLessons(vocab)`（词表中 `(unit, lesson)` 的权威顺序）中找**最靠后**的那一节
4. 这一节的词 → `preview`；其他词 → `consolidate`

**边界情况**：

- plan 只涉及 1 课 → 全部判为 `consolidate`（集中突破周）
- plan 涉及 ≥ 2 课 → 最靠后的课是 `preview`，其余 `consolidate`

**实现**：新函数 `classifyPlanWords(plan, vocab): Map<wordKey, 'consolidate' | 'preview'>`，放 `src/utils/english-helpers.ts`，纯函数、易单测。

### 3.2 每日词单组成（Daily Session Words）

给定当前周 plan 的第 `dayIndex` 天（用户点击"开始练习"时）：

```
今日词单 = plan.days[0..dayIndex].newWordKeys 的并集
        （即本周至今所有已引入过的词）
```

- **无 9 词上限**，全部列出
- **不混入 `oldReview`**（跨周老词由独立的"📚 旧词复习"按钮处理，见 3.6）
- 已在 `masteryMap` 里标记为 graduated 的词**仍然保留**在这个列表里（用户可手动增强记忆），但在排序中排最后

**排序**：
1. 未达标必记词（按 `stage asc, correct asc, incorrect desc`）
2. 已达标必记词
3. 预习词（按 plan 中原始顺序）

**实现**：替换 `WeeklyPlanSession.tsx` 中的 `buildSessionWords`。删除旧的 `getReviewWordsForDay`，改用新的 `getDailySessionWords(plan, vocab, masteryMap, dayIndex)` 返回带分类标签的词数组。

### 3.3 题型生成（Question Types）

题型由用户**手动勾选**，分两组独立配置：

- `consolidateTypes: Set<'A' | 'B' | 'C'>` —— 应用于所有必记词
- `previewTypes: Set<'A' | 'B' | 'C'>` —— 应用于所有预习词

**默认值**：

- `consolidateTypes` 默认 `{'A', 'C'}`（释义→选单词 + 释义→默写，覆盖"认"和"写"两个关键能力）
- `previewTypes` 默认 `{'A', 'B'}`（释义→选单词 + 单词→选释义，两种选择题建立初步认知，不强求拼写）

**不再有基于掌握度的自动题型调整**。

**Quiz 展开**：

```ts
words.forEach((w) => {
  const types = w.kind === 'consolidate' ? consolidateTypes : previewTypes
  types.forEach((t) => qs.push({ key, type: t, kind: w.kind }))
})
```

### 3.4 达标判定（Pass Criteria）

必记词达标条件：**`masteryInfo.stage >= 2`**

- 单条件，不引入日期分布要求
- 不需要扩展数据结构（沿用现有 `stage` 字段）
- 过渡期也无需特殊兜底

达标状态**不影响练习行为**（词仍然天天出现，题型由用户勾选决定）。它仅用于：

1. UI 进度展示（"本周必记 K/N 达标"）
2. 周末结转时的归档判断（见 3.7）

### 3.5 UI 改动清单

#### 3.5.1 题型选择 UI —— 双行布局

位置：`WeeklyPlanSession.tsx` 当前第 497-535 行的题型选择块。

改造后：

```
必记词题型：[A] [B] [C]
预习词题型：[A] [B] [C]
```

每行三个切换按钮，独立管理两个 `Set`。样式沿用当前的 `border-[rgba(167,139,250,.5)]` 紫色选中态。

**特殊情况**：
- 当前 plan 无必记词（1 课全是预习词的情况不会发生；≥ 2 课时恒有必记词）→ 不用处理
- 当前 plan 无预习词（1 课情况）→ 隐藏"预习词题型"那一行

#### 3.5.2 日卡片副标签

`WeeklyPlanSession.tsx` 第 390-396 行：

```diff
- {isDone ? '✓ 完成' : isToday ? '今天' : `${newCount}+${reviewCount}`}
+ {isDone ? '✓ 完成' : isToday ? '今天' : `必记 ${consolidateCount} · 预习 ${previewCount}`}
```

其中 `consolidateCount/previewCount` 从 `classifyPlanWords` 派生。

#### 3.5.3 周视图顶部进度条

在周卡片头部（`WeeklyPlanSession.tsx` 约第 291 行）加一行：

```
本周必记  ██████████░░░░  12 / 20 达标
```

数据：`已达标必记词数 = count(consolidate words with masteryMap[k].stage >= 2)`

#### 3.5.4 周日兜底提示

如果"今天是 plan 最后一天"且"仍有未达标必记词 > 0"，在日卡片上方显示红色 banner：

```
⚠️ 今日兜底：还有 5 个必记词未达标，今天务必攻克
```

**实现**：检查 `plan.days[plan.days.length - 1].date === today` 且 `未达标必记词数 > 0`。

#### 3.5.5 选中某天的"必记/预习"分组显示

`WeeklyPlanSession.tsx` 第 440-487 行目前分"今日新词"和"本周复习"两块。改成按分类显示：

```
必记（M 个，已达标 K）
   [apple] [banana] [cat] ...
预习（N 个）
   [dog] [elephant] ...
```

### 3.6 旧词池（保留现状 + 边界修正）

**现状**：`WeeklyPractice.tsx` 第 599-609 行已有"📚 旧词复习"按钮，调用 `getOldReviewWords(vocab, masteryMap)`，按 `nextReviewDate <= today` 拉到期词，跑独立 old-review session。**此功能保留，不新增入口**。

**本次改动**：

1. **从 `getReviewWordsForDay` 移除 `oldReview` 字段**。`buildSessionWords`（周 session 入口）不再混入跨周老词
2. **`getOldReviewWords` 加过滤器**：排除当前 plan 和**下一周 plan**（如果已存在）里的词，避免"周计划里有的词同时出现在旧词池"。签名改为：
   ```ts
   getOldReviewWords(
     vocab: WordEntry[],
     masteryMap: WordMasteryMap,
     excludeWeekPlans: WeeklyPlan[],  // 通常传 [当前周, 下周]
   ): WordEntry[]
   ```
   `WeeklyPractice.tsx` 里传入 `[weeklyPlan, nextWeekPlan ?? null].filter(Boolean)`

3. **session 流程**：复用现有 `WeeklyPlanSession` 的 study + quiz 两阶段（不改动）

4. **触发方式**：被动式（每次进入 `/english/words/daily` 时，根据 `masteryMap.nextReviewDate` 实时计算 `getOldReviewWords`，不推送）

### 3.7 周切换 & 未达标结转（Week Boundary Rollover）

当用户创建**新一周**的 plan 时（`WeeklyPractice.tsx` 的 "+创建周计划" 流程）：

1. 定位"上一周" plan（`weekStart = newWeekStart - 7 天`）
2. 计算上周该 plan 的所有必记词（用 3.1 的分类规则识别）
3. 从中筛出 `masteryInfo.stage < 2` 的词（未达标）
4. 进入 `step === 'arrange'` 阶段时，把这些未达标词自动追加到 `unassignedKeys` 池（左侧"待分配"列表），并在词 chip 上打 `↻ 结转` 标签
5. 用户可在右侧日列表里按需拖放这些结转词到具体天；如果不拖，它们保留在 unassigned 池里不进入本周（给用户完全控制权）
6. 在 arrange 页顶部显示一次性提示："上周有 N 个必记词未达标，已加入待分配池，请安排到合适日子"

**达标的词**无需特殊处理 —— 它们的 `masteryInfo.nextReviewDate` 已在 quiz 里被 `advanceStage` 正常设置，自动通过 SRS 调度出现在旧词池。

**实现位置**：`WeeklyPractice.tsx` 现有的 `handleGoToArrange` 附近（约第 155 行），在 `buildWeeklyPlan` 产出 `unassigned` 之后，把"上周未达标词"合并进去。

### 3.8 `recordBatch` 按词聚合（每日最多一次 stage 变化）

**当前 bug**：`useWordMastery.ts` 的 `recordBatch` 对每道题独立调 `advanceStage`。一个词如果用 A+B+C 三题型且全对，`advanceStage` 会被连续调 3 次，stage 从 0 跳到 3，`nextReviewDate` 直接推到 14 天后；如果 A 对 B 错，还会出现 advance / regress 来回震荡。这和艾宾浩斯"多日分布复习"的前提冲突。

**修正规则**：一次 `recordBatch`（一次 session）内，同一个词最多产生 **一次** stage 变化：

```ts
// 按 wordKey 聚合
const byKey = new Map<string, { entry, corrects: number, total: number }>()
for (const r of results) {
  const k = wordKey(r.entry)
  const g = byKey.get(k) ?? { entry: r.entry, corrects: 0, total: 0 }
  g.corrects += r.correct ? 1 : 0
  g.total += 1
  byKey.set(k, g)
}

// 每个词做一次判定
for (const [key, g] of byKey) {
  const cur = next[key] ?? { ... }
  const allCorrect = g.corrects === g.total
  const majorityCorrect = g.corrects > g.total / 2
  const updated = allCorrect
    ? advanceStage(cur, today, key)          // 全对才晋级
    : !majorityCorrect
      ? regressStage(cur, today)             // 多数错才回退
      : cur                                  // 半对半错：保持原 stage，仅累计 correct/incorrect
  next[key] = {
    ...updated,
    correct: cur.correct + g.corrects,
    incorrect: cur.incorrect + (g.total - g.corrects),
    lastSeen: today,
    reviewHistory: [...(cur.reviewHistory ?? []), ...results.map(...)]
  }
}
```

**同日去重守卫**：在 `advanceStage` 前再加一层检查：

```ts
// 同一日（lastSeen === today）不再继续 advance，避免"重做 session"连续刷 stage
const shouldAdvance = allCorrect && cur.lastSeen !== today
const updated = shouldAdvance
  ? advanceStage(cur, today, key)
  : !majorityCorrect && cur.lastSeen !== today
    ? regressStage(cur, today)
    : cur  // 同日重复 session：只累加 correct/incorrect 和 reviewHistory，stage/nextReviewDate 不变
```

**语义**：

- 单次 session 对一个词，stage 要么 +1，要么 -N，要么不动
- 同一自然日（按 `lastSeen`）对同一个词的第二次/第三次 session，stage 不再变化（只累积答题记录）
- `correct / incorrect` 累积仍按逐题算（保留历史信息）
- `reviewHistory` 也逐题记录

**影响面**：

- 本次 spec 所有"达标需要多天复习"的假设依赖此修正
- `OldReviewSession.tsx` 和 `useProblemMastery.ts` 里都有相同问题，需同步修正
- 旧 masteryMap 数据中过去已被"多题型连跳"提前达标的词，**不回滚**（sunk cost），仅保证新数据走对路径

### 3.9 SRS 去同步化（Hash-based Jitter）

**问题**：`advanceStage` 的 `nextReviewDate = today + intervals[stage]`，同一天同 stage 升级的 N 个词会分配到同一 `nextReviewDate`，造成未来旧词池单日爆炸。

**解决方案**：在 `nextReviewDate` 上加一个基于 `wordKey` 的稳定哈希偏移（0/1/2 天）。

**算法**：

```ts
function hashOffset(key: string, mod: number = 3): number {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0
  }
  return Math.abs(h) % mod
}

// src/utils/masteryUtils.ts advanceStage 改造：
nextReviewDate: newStage >= maxStage
  ? undefined
  : addDays(today, (intervals[newStage] ?? 90) + hashOffset(wordKey, 3))
```

**需要 `advanceStage` 接受 `wordKey` 入参**（当前未传入，需要修改调用处）。

**性质**：
- 确定性（同词、同 stage、同日的升级 → 同 nextReviewDate，可预测）
- 将原本同步到期的 N 个词均匀分散到 3 个连续日
- 对艾宾浩斯间隔的相对扰动 < 30%（+2 对最短的 7 天间隔是 28%，对 30 天是 7%，影响可忽略）

**不做 Layer 2（daily cap + defer）**和 **Layer 3（温和爬坡）**：Layer 1 打散一次后，即便稳态依然按 NORMAL_INTERVALS 行走，下次到期是 `last + intervals[stage] + offset`，其中 offset 对同一个词保持一致 → 后续到期日也保持分散。不需要额外机制。

---

## 4. 数据模型影响

**无 Supabase schema 变更**。

- `masteryInfo` 结构不变：已有 `stage / correct / incorrect / lastSeen / nextReviewDate / isHard` 够用
- `WeeklyPlan` 结构不变
- `WeeklyPlanDay.newWordKeys` 结构不变

所有"必记 / 预习"分类在运行时通过 `classifyPlanWords` 派生，不入库。

---

## 5. 模块改动清单

| 文件 | 改动 |
|---|---|
| `src/utils/english-helpers.ts` | 新增 `classifyPlanWords`；新增 `getDailySessionWords` 替代 `getReviewWordsForDay`；`getOldReviewWords` 加 `excludeWeekPlans` 参数；删除 weekReview 的 9 词上限相关排序 |
| `src/utils/masteryUtils.ts` | `advanceStage` 签名加 `wordKey` 参数；引入 `hashOffset` 辅助函数 |
| `src/hooks/useWordMastery.ts` | `recordBatch` 改为按词聚合后单次 stage 更新（3.8） |
| `src/hooks/useProblemMastery.ts` | 同样的聚合修正（数学模块也走同一路径） |
| `src/components/english/words/WeeklyPlanSession.tsx` | 双行题型选择 UI；`enabledTypes` 拆成 `consolidateTypes / previewTypes`；`buildSessionWords` 改用新算法；日卡片 / 进度条 / 周日兜底 UI；分类展示区 |
| `src/components/english/words/WeeklyPractice.tsx` | `getOldReviewWords` 调用加 `excludeWeekPlans` 参数；"+创建周计划" 流程加"上周未达标结转"预填充 |
| `src/components/english/words/OldReviewSession.tsx` | 确认使用修正后的 `recordBatch`（若内部有自己的聚合逻辑需同步） |

---

## 6. 迁移 & 向后兼容

- **旧 `masteryInfo` 数据**：沿用现有字段，无迁移
- **旧 plan 数据**：`classifyPlanWords` 直接在读取时应用到老 plan，立即生效
- **`nextReviewDate` 历史数据**：已设置过的词不重算 —— 它们仍用旧同步日期到期一次，下次 `advanceStage` 时才拿到抖动。此"过渡同步"只影响数据上线的首个到期日，之后自然打散
- **session 中途兼容**：正在进行的周 session（sessionStorage 里的 `SessionSnapshot`）按旧结构解析 ok，因为 `words / quizQs` 结构未变

---

## 7. 单元测试计划

必须覆盖的纯函数：

- `classifyPlanWords`：1 课、2 课、3 课、空 plan 四种边界
- `getDailySessionWords`：dayIndex = 0 / 中间 / 最后一天 三种；已达标词参与排序的位置
- `hashOffset`：同 key 稳定；不同 key 分布均匀（抽样 100 个）
- `advanceStage`：带 key 抖动后 `nextReviewDate` 落在预期窗口内
- `getOldReviewWords` with `excludeWeekPlans`：当前周 / 下周里的词被正确排除

---

## 8. 不在本次 scope

- **旧词池的温和爬坡起步间隔**（原 Layer 3：刚毕业的词用更短间隔）—— 暂不做。先观察 3.9 哈希抖动 + 正常 NORMAL_INTERVALS 的实际效果，必要时再加
- **旧词复习的"轻量刷题模式"**（跳过 study 阶段，直接 quiz）—— 沿用现有 WeeklyPlanSession 两阶段流程
- **困难词（`isHard`）的特殊加码题型**—— 保持现状（全题型强制，当前逻辑已在 `masteryUtils.ts` 里）

---

## 9. 对 Rosie（目标用户）的价值

1. **本周必记词绝不被 9 词上限挤掉**，周末一定完整复习
2. **必记词和预习词区别对待**，精力花在刀刃上（必记用全题型，预习轻量曝光）
3. **进度条告诉她"还差几个"**，目标感强
4. **周日兜底红 banner** 防止漏网之鱼
5. **旧词池不会某天突然炸出 20 个词**，日常可持续
6. **未达标词自动滚入下周**，不需要 Rosie 或家长手动追踪

---

## 10. 已知风险

1. "未达标结转"的默认预填充可能让用户忘记调整 plan 容量 → 新周过载。**缓解**：UI 上明确显示"上周结转 N 个"提示；结转词加入 `unassignedKeys` 池而不是自动分配到某一天，用户必须主动拖到某一天才会生效，过载控制权在用户手上。
2. 3.8 的修正是行为变化（不仅是功能新增），以前一次 session 能拿到的 stage 跳跃现在不行了，可能和用户的历史体感不同。**缓解**：旧数据不回滚（过去达标的词保持达标），只规范新数据；上线后观察一周，若 Rosie 觉得"怎么这周没以前快达标"，这是预期行为，不是 bug。
3. 3.9 哈希抖动对 stage 0→1 的 1 天间隔影响相对最大（最多 +2 → 变成 3 天）。**缓解**：stage 0→1 是初次复习，延迟 2 天仍在艾宾浩斯窗口内（50% 记忆衰减约发生在 24 小时后），可接受。
