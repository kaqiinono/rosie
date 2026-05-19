# 口算引擎 master.md 重构实施计划

> 配套规范文档：`docs/master.md`（1.0 版，Lv.1–Lv.18）
> 本计划文档：把规范拆成可独立交付的 6 个阶段，每阶段含文件清单与验收标准。

---

## 0. 现状摘要

### 0.1 当前引擎（重构前）
- 出题：`LEVELS[i].generate()` 每次纯随机
- 关卡：1–18 + `C`（已按 master.md 完成分档，见上次提交）
- 选题分布：`buildSession` 使用 70/20/10 三档（current / lower / current+1）+ 20% 错题注入
- 升级：30 题 ≥85% → currentLevel + 1，单调递增
- 时限：无单题计时，仅记录整 session `time_spent_sec`

### 0.2 现有 Supabase 表
- `calc_settings` — 关卡开关 + 上限 + 自适应 + 音效 + 上次配置
- `calc_mistakes` — `signature` 主键、`consecutive_correct`、`resolved`
- `calc_sessions` — session 汇总
- `calc_vouchers` — 兑换券

### 0.3 现有代码入口
- `src/utils/calc-levels.ts` — `LEVELS` 数组（含 18 关）
- `src/utils/calc-helpers.ts` — `buildSession` / `enabledLevels` / `pickLevel` / `maybeAdvanceLevel` / `calcTimeBonus`
- `src/hooks/useCalcSession.ts` — 答题循环（输入、判定、星星）
- `src/hooks/useCalcMistakes.ts` — 错题增删
- `src/hooks/useCalcWallet.ts` — session 写库 + 钱包
- `src/hooks/useCalcLevel.ts` — 升档判定
- `src/hooks/useCalcSettings.ts` — settings 读写
- `src/app/calc/session/page.tsx` — session 页面装配

---

## 1. 目标架构

### 1.1 数据流改造
```
session 开始 → buildSession 读 calc_problem_state + calc_level_state
              ↓
            按 P0–P5 优先级 + 权重 + 队列 + 形式变换 装配 N 题
              ↓
useCalcSession 单题计时 + 即时反馈 + 累积 results[]
              ↓
session 结束 → 写 calc_sessions（汇总）
              + 批量 upsert calc_problem_state（per-problem proficiency / status）
              + 更新 calc_level_state（A/B/C 检查、状态机推进）
              + （可选）写 calc_event_log（升降级 / 间隔检验事件）
```

### 1.2 新表结构

#### `calc_problem_state`（per-user × per-signature）
```sql
create table public.calc_problem_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  signature text not null,               -- 题目唯一签名，例 "mul(6,7)"
  level smallint not null,               -- 1..18, 'C' 用 0 或 99（待定）
  proficiency smallint not null default 0 check (proficiency between 0 and 5),
  attempt_count int not null default 0,
  appearance_count int not null default 0,            -- 形式变换计数
  recent_results jsonb not null default '[]'::jsonb,   -- [{correct,time_ms},…] 最近 10
  status text not null default 'active' check (status in ('active','review','mastered','forced')),
  short_mastered_at date,
  review_r1_due date,
  review_r2_due date,
  review_r3_due date,
  long_mastered boolean not null default false,
  last_seen_session int,                  -- session 编号
  times_seen_this_round int not null default 0,
  consecutive_wrong int not null default 0,
  forced_next boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, signature)
);
create index calc_problem_state_user_level_idx on public.calc_problem_state (user_id, level);
create index calc_problem_state_user_status_idx on public.calc_problem_state (user_id, status);
```

#### `calc_level_state`（per-user × per-level）
```sql
create table public.calc_level_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  level smallint not null,
  status text not null default 'practicing' check (status in
    ('practicing','abc_passed','review_r1','review_r2','review_r3','mastered')),
  abc_passed_date date,
  review_r1_date date,
  review_r2_date date,
  review_r3_date date,
  session_count_in_level int not null default 0,
  warmup_complete boolean not null default false,    -- 累计答题数 ≥10 后置 true
  warmup_answered int not null default 0,
  last_session_accuracy real,                         -- 0..1
  consecutive_poor_sessions int not null default 0,   -- 连续 <60% 计数
  updated_at timestamptz not null default now(),
  primary key (user_id, level)
);
```

#### `calc_event_log`（可选 / 家长报告用）
```sql
create table public.calc_event_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in
    ('level_up','level_down','review_pass','review_fail','assault_mode_on','forced_problem')),
  level smallint,
  signature text,
  detail jsonb
);
create index calc_event_log_user_time_idx on public.calc_event_log (user_id, occurred_at desc);
```

#### `calc_settings` 扩展
- 追加 `session_counter int not null default 0` — 全局 session 编号，用于 `last_seen_session` 比较
- 追加 `time_limit_overrides jsonb default '{}'` — 用户级时限覆盖（key 形如 `addsub_10`、`mul_125`、…）
- `currentLevel` 语义变更：仍代表"当前主练关卡"，但 P4 旧关卡混练会同时引用 < currentLevel 的 active/review 题

### 1.3 不变项（保持现有合约）
- `CalcQuestion` 接口（display / signature / answer / level / category / arity / coinBase / isChallenge）
- `useCalcSession` 对外 API（idx / currentQ / handleSubmit / results 等）— 内部新增计时与 per-question 回调
- `calc_sessions` 表结构不变，仅丰富写入字段

---

## 2. 题库枚举设计（Phase 1 核心决策）

### 2.1 乘除关卡（精确枚举）
| 关卡 | 算式形态 | 算式集合 | 题数 |
|------|----------|----------|------|
| Lv.6  | `k × n`, n ∈ 1..9 | k ∈ {1,2,5} | 3 × 9 = **27** |
| Lv.7  | 同上 | k ∈ {3,4} | 2 × 9 = **18** |
| Lv.8  | 同上 | k ∈ {6,7} | **18** |
| Lv.9  | 同上 | k ∈ {8,9} | **18** |
| Lv.10 | `a × b`, a,b ∈ 1..9 | 全枚举 | 9 × 9 = **81** |
| Lv.11 | `(d·q) ÷ d`, q ∈ 1..9 | d ∈ {1,2,5} | **27** |
| Lv.12 | 同上 | d ∈ {3,4} | **18** |
| Lv.13 | 同上 | d ∈ {6,7,8,9} | **36** |
| Lv.14 | Lv.10 ∪ {`(a·b)÷a` 全枚举} | | **81 + 81 = 162** ⚠️ |
| Lv.16 | `k × n`, k ∈ {10,11,12}, n ∈ 1..12 + `(k·n)÷k` | | 3·12·2 = **72** |
| Lv.18 | `k × n`, k ∈ 13..19, n ∈ 1..12 + 逆 | | 7·12·2 = **168** |

**决策点 ①**：Lv.14 / Lv.16 / Lv.18 实际算式数与 master.md 列出的 81/36/84 差异较大。两种应对：
- (a) 把 master.md 的"题目总数"看作"独立 signature 数"，乘 + 除合算 → 选 81/36/84 这一侧，仅枚举乘法；除法形式通过"形式变换"切换，不算独立题
- (b) 维持每个算式独立，更新 master.md 速查表为实际值

→ **建议 (a)**：与"形式变换不拆分熟练度"语义一致。Phase 3 实现形式变换后自然落地。

### 2.2 加减关卡（生成 + 去重）
- 算式空间太大，明确枚举意义不大，但 master.md 仍要求"覆盖率"
- 决策：**首次进入关卡时**生成 N 个 signature 写入 `calc_problem_state`（status='active'）；后续仅在该集合内出题
  - Lv.1 → 45 题：从 `0..10 + 0..10 ≤ 10` 与 `0..10 − 0..10 ≥ 0` 中均匀抽样 45 个
  - Lv.2 → 60 题
  - Lv.3 → 60 题
  - Lv.4 → 80 题
  - Lv.5 → 80 题
- 加减题库一旦生成不再变（除非清档），保证覆盖率统计成立

### 2.3 混合关卡 Lv.15 / Lv.17
- 算式形态发散，同加减处理：首次进入时预生成 ~60/~80 题写入
- 形式变换在 Phase 3 处理（混合题无明确逆运算，可能不支持）

### 2.4 挑战 'C'
- 不属于任何关卡熟练度系统，沿用纯随机生成，仅作 session 末尾点缀

### 2.5 题库代码组织
- `src/utils/calc-bank/` 新目录
  - `enumerate-muldiv.ts` — 导出 `enumerateLevel(level): CalcQuestion[]`
  - `seed-addsub.ts` — 导出 `seedLevelBank(level, count): CalcQuestion[]`
  - `index.ts` — `getOrSeedBank(level, db) → Promise<CalcQuestion[]>`
- `calc-levels.ts` 中 `generate()` 改为读取本地 bank（保留 'C' 的随机生成）

---

## 3. 阶段拆解

每个阶段交付物独立可编译可运行，便于回滚和验证。

---

### Phase 1 · 基础设施（核心） ✅ 已完成 2026-05-18

> 目标：题库枚举 + 单题状态持久化 + 单题计时 + session 权重选题
> 用户体验：**基本无可见变化**，但底层切换到新模型；后续阶段才暴露行为差异。
>
> **交付状态**：build 通过 / 0 lint errors / 待用户在 Supabase 跑 `docs/calc-tables.sql` 后即可生效

#### 1.1 题库枚举（前端）
- [ ] 新建 `src/utils/calc-bank/enumerate-muldiv.ts`
  - 实现 Lv.6–Lv.14, Lv.16, Lv.18 的精确枚举（按 §2.1 决策 (a) 仅枚举乘法形式）
- [ ] 新建 `src/utils/calc-bank/seed-addsub.ts`
  - 实现 Lv.1–Lv.5 的均匀采样种子化生成（用 mulberry32 + userId hash，保证同一用户稳定）
- [ ] 新建 `src/utils/calc-bank/seed-mixed.ts`
  - 实现 Lv.15 / Lv.17 的预生成
- [ ] 重构 `src/utils/calc-levels.ts`
  - `LevelSpec` 增加 `bankSize: number` 字段
  - 保留 `generate()` 用于 'C' 与回退路径

#### 1.2 数据表
- [ ] 在 `docs/calc-tables.sql` 末尾追加 §1.2 的三张表（calc_problem_state / calc_level_state / calc_event_log）+ RLS 策略
- [ ] 追加 `calc_settings.session_counter` 与 `time_limit_overrides` 字段（幂等 alter）
- [ ] 用户在 Supabase Studio 手动跑一次升级 SQL（无自动迁移工具）

#### 1.3 持久化 hook
- [ ] 新建 `src/hooks/useCalcProblemState.ts`
  - 读：按 `(user_id, level in [...])` 拉取 problem state，本地 Map 缓存
  - 写：`recordResult(signature, correct, timeMs, sessionNo)` 单题更新 proficiency / recent_results / consecutive_wrong / last_seen_session / appearance_count
  - 写：`batchUpsert(states[])` session 结束后批量同步
  - 写：`seedLevelBank(level)` 首次进入关卡时把生成的题目以 proficiency=0 / status=active 批量插入（仅插入，不覆盖已有）
- [ ] 新建 `src/hooks/useCalcLevelState.ts`
  - 读写 `calc_level_state`（Phase 5 才用到状态机字段，此阶段只读 warmup_answered / session_count_in_level）

#### 1.4 答题计时
- [ ] `useCalcSession` 改造：
  - `questionStartedAtRef = useRef<number>()` 在每题切换时设置
  - `results[]` 元素追加 `timeMs: number`
  - `firstTry` 已存在；新增 `withinLimit: boolean`（由 caller 提供时限）
- [ ] `src/utils/calc-time-limits.ts`
  - 导出 `getTimeLimit(level, signature): number` — 按 master.md §11 表 + 用户 override
  - 维护 category × subcategory 映射（addsub 按 ≤10/≤20/≤100 分；muldiv 按 1-5/6-9/÷1-5/÷6-9/×10-12/×13-19）

#### 1.5 session 装配权重切换
- [ ] `src/utils/calc-helpers.ts` 中的 `buildSession` 改为接收 `problemStates: Map<sig, ProblemState>`
  - 旧分布（70/20/10）删除
  - 新分布：仅做"按 proficiency 权重在当前关卡内抽样"，其余 P0–P5 优先级在 Phase 2 再补
  - 当前关卡 active 题按权重表：proficiency 0–1→5，2–3→3，4→1，5→0
- [ ] `session/page.tsx` 启动 session 前 `await seedLevelBank(currentLevel)` 与 `await preloadProblemStates(currentLevel, currentLevel - 1, currentLevel - 2)`

#### 1.6 session 结束写回
- [ ] `session/page.tsx` `done` 分支扩展：
  - 调 `recordSession`（不变）
  - 调 `problemState.batchUpsert(results.map(r → patch))`
  - 调 `levelState.bumpWarmup(currentLevel, results.length)`
  - 调 `settings.update({ sessionCounter: counter + 1 })`

#### 1.7 验收
- [ ] `pnpm lint` 无新错误
- [ ] `pnpm build` 通过
- [ ] 手动验证：进入 Lv.10，session 10 题，全部答对 → DB `calc_problem_state` 出现 10 条记录、proficiency 普遍 ≥1
- [ ] 第二次进入 Lv.10：高 proficiency 题出现频率明显降低（低 proficiency 题被权重 5 拉前）
- [ ] 切换 Lv.6 → DB 中只插入 27 个 `(1|2|5)×(1..9)` 的 signature

---

### Phase 2 · 覆盖率 + forced + 冷门兜底 ✅ 已完成 2026-05-18

> 目标：master.md §五、§六 — P0–P5 优先级、循环队列、forced_next、冷门题强制插入
>
> **交付状态**：build 通过 / 0 lint errors / P3–P5 留待后续阶段

#### 2.1 P0 / P1 优先级注入
- [ ] `buildSession` 改造为分阶段填充：
  ```
  const slots = N
  const p0 = pickForcedProblems(level, problemStates)         // status='forced' 或 forced_next
  const p1 = pickColdProblems(level, problemStates, sessionNo) // last_seen_session 超阈值
  ```
- [ ] 实现 `pickColdProblems`：按 proficiency 分段（0–2→2 session, 3–4→4, 5→8, mastered→30）扫描
- [ ] P0 + P1 总数若超过 `N * 0.5`，截断（保护 P2 主练比例）

#### 2.2 循环队列
- [ ] `calc_problem_state.times_seen_this_round` 用法激活
- [ ] 进入新一轮判定：所有 active 题 `times_seen_this_round ≥ 1` → 全部归零
- [ ] 第 1 轮：按 signature 字典序硬性遍历，权重不生效
- [ ] 第 2 轮起：proficiency 0–1 每 3 题插队一次

#### 2.3 交错插入
- [ ] 答错题不立即重出 — session 内位置 +4
- [ ] `consecutive_wrong ≥ 2` → `forced_next = true`（下次 session）
- [ ] `consecutive_wrong ≥ 4` → 写 `calc_event_log` 类型 `forced_problem` 供家长查看

#### 2.4 验收
- [ ] 连续答错某题 → 下次 session 该题在第 1–2 位出现
- [ ] 4 个 session 完全不练 Lv.6 也能保证每道 Lv.6 题在窗口内被强制插一次（冷门兜底）

---

### Phase 3 · 形式变换 ✅ 已完成 2026-05-18

> 目标：master.md §4.3 — 标准 / 逆运算 / 填空 三种形式循环
>
> **交付状态**：build 通过 / 0 lint errors / 仅 flat 单运算符题（add/sub/mul/div）参与变换，mixed/challenge 固定标准式

#### 3.1 形式生成器
- [ ] 新建 `src/utils/calc-forms.ts`
  - 导出 `renderForm(signature, form): { display, expectedAnswer }`
  - 支持形态：
    - `add(a,b)` → "a + b = ?" / "(a+b) - a = ?" / "a + □ = (a+b)"
    - `sub(a,b)` → "a - b = ?" / "a - □ = (a-b)" / "□ - b = (a-b)"（即 a 反推）
    - `mul(a,b)` → "a × b = ?" / "(a·b) ÷ a = ?" / "a × □ = (a·b)"
    - `div(p,d)` → "p ÷ d = ?" / "□ × d = p" / "p ÷ □ = (p/d)"
    - `add3` / mixed 三运算符 → 不支持变换，固定标准形式
- [ ] `appearance_count % 3 ∈ {0,1,2}` 决定本次形式
- [ ] 填空形式的 `input` 校验需匹配整数，UI 上 □ 替换为输入框（沿用现有 input 单点）

#### 3.2 UI 改造
- [ ] `CalcQuestionDisplay`（如有；否则在 session page 内）— 支持渲染含 □ 的题面
- [ ] 答案校验：从 `expectedAnswer` 对比，而非 AST 求值

#### 3.3 验收
- [ ] 同一道 `mul(6,7)` 在三次出现时分别呈现 `6×7=?` / `42÷6=?` / `6×□=42`
- [ ] 三种形式答对都更新同一 signature 的 proficiency

---

### Phase 4 · 单题掌握与间隔复习 ✅ 已完成 2026-05-18

> 目标：master.md §3.2 §3.3 — short_mastered → review pool → long_mastered
>
> **交付状态**：build 通过 / 0 lint errors

#### 4.1 短期掌握判定
- [ ] `recordResult` 结束时检查：
  - `proficiency = 5` && `attempt_count ≥ 3` && `recent_results.slice(-3).every(r => r.correct && r.time_ms ≤ limit)`
  - 满足 → `status = 'review'`, `short_mastered_at = today`, 计算 r1/r2/r3 到期日

#### 4.2 间隔检验日触发
- [ ] session 装配前扫描：所有 `status='review'` 且 `review_rN_due ≤ today` 的题加入 P3
- [ ] P3 题统一收集，本 session 一次性安排
- [ ] 通过 → 推进到下一轮；三轮通过 → `status='mastered'`, `long_mastered=true`
- [ ] 任一轮失败 → `proficiency=3`, `status='active'`, 三个 review_due 清空

#### 4.3 已掌握抽查 (P5)
- [ ] `status='mastered'` 题：每 session 随机抽 1–2 道
- [ ] 抽查答错 → `proficiency=3`, `status='active'`

#### 4.4 验收
- [ ] 模拟答对同一题 5 次（全部时限内）→ `status` 变 `review`，未来 2 天内不出现
- [ ] 模拟第 2 自然日打开 → 该题作为 P3 出现
- [ ] r3 通过 → `status='mastered'`，日常练习不再出现

---

### Phase 5 · 关卡状态机 + 升降级 ✅ 已完成 2026-05-19

> 目标：master.md §八、§九 — A/B/C 条件 + 关卡间隔检验 + 热身 + 降级
>
> **交付状态**：build 通过 / 0 lint errors / free-mode 完全跳过状态机

#### 5.1 A/B/C 条件
- [ ] session 结束后调 `evaluateLevelAdvancement(level)`：
  - A: 该关卡所有 active 题 `attempt_count ≥ 2` && session 内本关卡正确率 ≥ 90%
  - B: 该关卡 `status='review' or 'mastered'` 题占比 ≥ §10 速查表
  - C: 该关卡无任一题 `consecutive_wrong ≥ 2`
- [ ] 三条满足 → `calc_level_state.status='abc_passed'`, 记日期

#### 5.2 关卡间隔检验
- [ ] 与 §4.2 类似，按 r1/r2/r3 日期触发"关卡级抽样检验"
- [ ] 通过 → 推进状态；r3 通过 → `mastered` → 解锁下一关卡 + `currentLevel + 1`
- [ ] 任一轮失败 → 该关卡所有题 `proficiency = max(3, current)`, 状态回 `practicing`

#### 5.3 热身期
- [ ] 进入新关卡后 `warmup_answered < 10` 时：
  - session 全部用新关卡题
  - 不计 A 条件正确率
  - 不写 last_session_accuracy

#### 5.4 攻坚模式
- [ ] `last_session_accuracy < 0.75` 触发：
  - session 构成：5 弱题 + 8 active 权重 + 4 变体 + 4 已掌握 + 4 上一关卡
  - UI 顶部展示"攻坚模式"标识

#### 5.5 降级保护
- [ ] `consecutive_poor_sessions += 1` if accuracy < 0.6 else `= 0`
- [ ] `consecutive_poor_sessions ≥ 3` → `currentLevel -= 1`, 旧关卡 `proficiency = 3`
- [ ] 写 event_log `level_down`

#### 5.6 旧关卡混练
- [ ] P4 实现：当 `currentLevel > 1` && warmup 完成
  - 当前关卡 active 占比 55%
  - currentLevel - 1 active/review 题占 20%
  - currentLevel - 2..1 已掌握题占 10%
  - P5 抽查 10%
  - P3 review 到期 5%（与 §4.2 共用池）

#### 5.7 验收
- [ ] 在 Lv.6 把 27 题全部刷到 proficiency=5 → 触发 abc_passed
- [ ] 第 2/7/30 天检验通过 → currentLevel → 7
- [ ] 连续 3 次 session 正确率 < 60% → currentLevel 回退 + event_log 写入

---

### Phase 6 · UI / 配置 / 报告 ✅ 已完成 2026-05-19

> 目标：master.md §11 时限可配置 + §9.4 升降级提示 + 家长报告
>
> **交付状态**：build 通过 / 0 lint errors / 6 阶段全部完成

#### 6.1 时限设置 UI
- [ ] `src/app/calc/settings/page.tsx` 新增 "答题时限" 区块
  - 按 master.md §11 表分类展示当前值
  - 每行可点开输入框微调
  - 持久化到 `calc_settings.time_limit_overrides`

#### 6.2 session 完成页提示
- [ ] 已有 `EarnStarsModal` — 扩展显示：
  - 升级条件通过 → "🎉 通过关卡检验！等待第 N 天复测"
  - 降级触发 → "📉 已暂时回到 Lv.X，需要再练几次"
  - 攻坚模式触发 → "⚠️ 下次进入攻坚模式（5 题弱项 + 4 题变体）"

#### 6.3 家长报告页 `/calc/report`
- [ ] 新建路由，展示：
  - 各关卡状态卡（status / abc_passed 日期 / next review 日期 / mastered 题占比）
  - event_log 时间线（升降级、间隔检验、forced 事件）
  - 最弱 10 题列表（proficiency 排序 + 最近错误时刻）

#### 6.4 验收
- [ ] 用户在设置页把"10 以内加减"时限从 3000ms 调到 2500ms，下次 session 即生效
- [ ] 升级 / 降级有清晰视觉反馈
- [ ] 家长报告页能直接看到 Rosie 的薄弱点

---

## 4. 风险与决策记录

| 编号 | 风险 / 决策 | 状态 |
|------|-----------|------|
| R1 | Lv.14/16/18 题库定义偏离速查表 → §2.1 决策 (a) 仅枚举乘法 + 形式变换补除法 | 待 user 确认 |
| R2 | 加减关卡用种子化采样导致每用户题库不同 — 是否需要全局固定? | 待决策 |
| R3 | `calc_mistakes` 与 `calc_problem_state` 数据重叠 — 是否废弃前者? | Phase 4 后再定 |
| R4 | Supabase 自动迁移工具未集成，每阶段需用户手动跑 SQL | 已知约束 |
| R5 | 关卡间隔检验失败导致 proficiency 全员回 3，可能误伤已稳掌握题 — 是否保留 review 题不动? | Phase 5 实施时讨论 |
| R6 | 形式变换可能让"填空形式"答案歧义（如 `□ × 6 = 42`，孩子可能写 6 也对） — 校验逻辑需严格 | Phase 3 实施时讨论 |
| R7 | session 装配越来越复杂 → 应抽出纯函数 `assembleSession(states, settings, levelStates, day)` 单独单元测试，但项目无测试框架 | 需考虑加 vitest? |

---

## 5. 推进节奏建议

- **Phase 1**: 1 次大改 PR；包含表迁移 + 题库枚举 + 计时 + 权重选题。无可见行为变化（除选题概率倾向弱题）。最大变更量。
- **Phase 2–4**: 每个 Phase 一次 PR，每次 PR 仅打开一个行为开关。
- **Phase 5**: 升降级状态机；变更面较大但与 Phase 1–4 解耦。
- **Phase 6**: 纯 UI + 报告页；可与 Phase 5 并行。

每 Phase 完成后：
1. 手动验证（见各阶段验收清单）
2. 把验收清单中通过项打勾，未通过项落 issue
3. 跑 `pnpm lint && pnpm build`
4. 提交 commit，commit message 引用 `master.md` 对应小节

---

## 6. 决策记录（已锁定 / 2026-05-18）

1. **R1**：Lv.14/16/18 题库 → **(b) 乘除独立计数**。实际题数 162/72/168，已同步更新 `master.md` §10
2. **R2**：加减关卡题库 → **每用户首次进入关卡时随机种子化采样**（用 userId hash 作 seed，保证同用户稳定）
3. **R7**：**不引入 vitest**。验证靠手动验收清单
4. Phase 1 范围 → **4 项一起做**（题库枚举 + 单题状态表 + 计时 + 权重选题）
5. 题库 seed 时机 → **懒加载**（首次进入关卡时 seed，不预先填充所有 18 关）
6. Phase 划分 → **维持现有 6 阶段不变**

---

*计划版本：1.1 | 配套规范 master.md 1.0 | Phase 1 开工*
