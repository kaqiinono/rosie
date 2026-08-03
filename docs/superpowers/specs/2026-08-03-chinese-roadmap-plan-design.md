# 语文路线图计划（计划中心）

日期：2026-08-03  
范围：`packages/chinese`（计划数据 / hook / 管理 UI / 今日整合）、`apps/web/src/app/admin/plans/**`  
状态：已与用户确认方案 1 + §1–§4（含「创建后不可换教材」）

## 目标

1. 在 `/admin/plans` 增加语文计划管理：列表、新建、编辑、暂停、恢复。
2. 计划控制**题目范围**（路线图关卡）与**题型**；不预生成日历天，随时可练，做完进下一关。
3. 同一用户最多一个 `active` 计划；每份计划有独立路线图进度。
4. 有 active 计划时，与现有「今日语文」整合：入口不变，题型与题目由计划决定。
5. 每个关卡有练习记录，可在管理页 / 今日记录 / 计划路线图中查看结果。

## 非目标

- 不改造英语 / 数学计划中心结构（只加语文入口）。
- 不做日历周计划，不预生成 `days[]`。
- 不做 Leitner / 自适应盒复习调度。
- 不迁移或删除 `chinese_weekly_plans`（可读残留；今日主路径不再依赖）。
- 不支持逐日手改字表；不做英语式结课长报告。
- **计划创建后不允许更换教材**；若要练另一册，新建计划。
- 古诗 / 日积月累**不**进入计划题型多选（仍非 `quiz_types`）；见 §3「园地 / 古诗 / 日积月累」。

## 背景

- 已有 `chinese_weekly_plans` + `useChineseWeeklyPlan`（周四起算、每日认读/会写字数、7 天切片），但无管理 UI，`generatePlan` 无调用方。
- `/today` 与语文首页主路径已是掌握度路线图（`useChineseRoadmapProgress`）；练习会话题型由 URL `types` / 筛选栏控制，与周计划脱节。
- 计划中心仅有数学、英语。

## 方案

新建 `chinese_roadmap_plans`（行为近似英语自适应：指针 + 设置；入口近似数学：`/admin/plans/chinese`）。不扩展旧周计划表。

---

## §1 数据与生命周期

### 表 `chinese_roadmap_plans`

| 字段 | 含义 |
|------|------|
| `id` | UUID |
| `user_id` | 用户 |
| `title` | 显示名（可默认「二年级上册计划」） |
| `book_slug` | `g1b` \| `g2a` \| `g2b`；**创建后不可改** |
| `start_lesson_key` | 创建时起始关 |
| `current_lesson_key` | 本计划路线图指针 |
| `lessons_per_batch` | K，默认 1：当前批次关数 |
| `quiz_types` | `text[]`：`recognize` / `stroke` / `phrase` / `passage` / `pinyin-write` |
| `status` | `active` \| `paused` \| `completed` \| `archived` |
| `completed_lesson_keys` | `text[]`：本计划已通关课 |
| `created_at` / `updated_at` / `archived_at` | 时间戳 |

RLS：仅本人读写。建议部分唯一索引：同一 `user_id` 至多一行 `status = 'active'`（若 DB 不便强制，则 hook 层保证并在激活时 pause 其它）。

### 表 `chinese_roadmap_plan_lesson_runs`

每次练习结算时，对涉及的每一关各写一条 run：

| 字段 | 含义 |
|------|------|
| `id` | UUID |
| `plan_id` | 所属计划 |
| `user_id` | 用户 |
| `lesson_key` | 关卡 |
| `started_at` / `finished_at` | 时间 |
| `completed` | 本关计划勾选题型是否全部完成 |
| `total` / `correct` / `accuracy` | 汇总 |
| `by_type` | JSON：各题型对错/得分明细 |
| `quiz_types` | 本次实际练习的题型快照 |

### 规则

- 同一用户最多 **1 个 `active`**。新建时若已有 active → 新计划为 `paused`，或创建流程提供「激活并暂停旧计划」。
- 暂停 / 恢复 / 修改（题型、K、当前关、标题）在管理页；恢复时若已有其它 active，先 pause 对方。
- **计划级路线图**：完成态、当前关、锁定关相对该计划的 `completed_lesson_keys` + `current_lesson_key`，计划之间不共用指针。
- 全局 `chinese_char_mastery` 与错题本仍共享；练习照常 `recordBatch`。
- 不卡自然日；未做完可随时继续。
- **`book_slug` 创建后只读**；编辑器不提供换册控件。

### 旧表

`chinese_weekly_plans` 本阶段不迁、不删；今日主路径改读新表。

---

## §2 管理页与编辑器

### 路由

| 路径 | 用途 |
|------|------|
| `/admin/plans` | 增加「语文计划」卡片 |
| `/admin/plans/chinese` | 列表 |
| `/admin/plans/chinese/new` | 新建 |
| `/admin/plans/chinese/[planId]` | 编辑 + 关卡记录入口 |

### 列表

- 展示全部计划：教材、当前关、题型摘要、状态（active / paused / completed）。
- 操作：激活、暂停、编辑；（可选）归档。
- 激活 B：自动将原 active 设为 `paused`（可确认）。
- 空状态引导创建。

### 编辑器

**新建**

- 选教材（此后锁定）
- 起始关（写入 `start_lesson_key` 与初始 `current_lesson_key`）
- K（默认 1）
- 题型多选（计划级，整份统一）
- 标题（可选）
- 是否创建后立即激活

**编辑（已有计划）**

- 教材：**只读展示**，不可改
- 可改：标题、当前关（跳关）、K、题型、状态（暂停/恢复）
- 计划内路线图只读预览 + 已练关可查看记录
- 保存后回列表；不在此页开练

### UI 归属

组件与 hook 放在 `@rosie/chinese`；`apps/web` 仅薄路由壳。数据走 `createUserSessionStore`。

---

## §3 今日整合 · 完成推进 · 练习记录

### 今日整合

有 `active` 计划时：

- `/today` 语文卡、语文首页「今日任务」入口保持；
- 题目 = 从 `current_lesson_key` 起共 K 关（本册路线图顺序）；
- 题型 = 计划 `quiz_types`；
- 练习链到现有 `/chinese/chars/practice`（`lessons` + `types`），并带 `planId` 以便回写 runs / 推进；
- 活动册以计划 `book_slug` 为准。

无 active（或皆 paused）：回退现有掌握度路线图行为。

### 完成推进

- 当前批次内，各关「应付内容」均完成 → 对应关写入 `completed_lesson_keys`，`current_lesson_key` 移到下一未完成关。
- 本册全部完成后：`status = completed`；今日卡显示通关。
- 中途改题型 / 跳关：以保存后设置为准；进行中 session 对齐现有 snapshot 规则（结束或丢弃，不伪造完成）。

### 园地 / 古诗 / 日积月累

维持现有 practice session 行为（方案 A）：

- **古诗词 / 日积月累不在计划题型开关里**。会话仍按阶段自动带出：所选课若匹配到诗，或所选单元有日积月累，则进入 `poems` / `accumulation` 阶段（与今日筛选栏一致）。
- **普通课文**：推进条件 = 计划 `quiz_types` 中、本关实际有题的类型都做完；某题型本关无内容则跳过、不挡推进。
- **语文园地等特殊关**：若计划题型对应内容为空，不以空题型判完成；以本关**实际出现的内容**为准——有古诗则古诗做完，有日积月累则积累做完，另有生字/词语等则一并完成。全部应付阶段完成后才写入 `completed_lesson_keys` 并推进。
- 练习记录 `by_type` / 阶段明细可含 `poems`、`accumulation`（即便不在 `quiz_types` 里），便于管理页与今日记录展示。

### 练习记录可见性

1. 管理页计划详情：按关列出 runs（时间、正确率、分题型、是否完成）。
2. `/today` 练习记录区语文块：展示当前关 / 最近一次结果（不再依赖旧周计划 `progress`）。
3. 计划内路线图：已练关可点开该关历史结果。

结算时写 run；崩溃未结算不记完成、不推进指针。

---

## §4 迁移与风险

### 迁移

- 增量 SQL：权威脚本放 `packages/chinese/sql/chinese-roadmap-plans.sql`（可按需镜像到 `docs/sql/`）；建两表 + RLS；禁止 TRUNCATE / 清旧表。
- 无 active 新计划时，孩子端行为与现在一致。

### 风险约定

| 风险 | 约定 |
|------|------|
| 多计划进度混淆 | 每计划独立 `completed_lesson_keys` / `current_lesson_key` |
| 双 active | 激活时 pause 其它；尽量 DB 约束 + hook 双保险 |
| 换册 | **禁止**；另建计划 |
| 改题型导致「未完成」定义变化 | 推进看当前 `quiz_types` + 本关实际内容（园地含古诗/积累）；历史 run 保留当时快照 |
| 园地关空题型误推进 | 空计划题型不判完成；以实际 poems/accumulation 等阶段完成为准 |
| 旧周计划残留 | 不删；UI 不再引导生成周计划 |

---

## 实现清单（高层）

1. SQL：`chinese_roadmap_plans` + `chinese_roadmap_plan_lesson_runs`。
2. Hook / store：`useChineseRoadmapPlan`（list、create、save、pause、activate、advance、appendRun）。
3. 管理：`ChineseRoadmapPlanManage` + `ChineseRoadmapPlanEditor` + 路由挂载。
4. 练习会话：识别 `planId`，结算写 run，批次完成则 advance。
5. 今日 / 首页：active 计划驱动 lessons/types；记录区读 runs。
6. 计划内路线图组件（相对计划进度，非全局掌握度指针）。
7. `pnpm --filter @rosie/chinese typecheck`；手动验唯一 active、暂停恢复、记录可见。

## 验收

- 计划中心可创建 / 编辑 / 暂停 / 恢复语文计划；创建后无法改教材。
- 同时仅一个 active；激活另一份时旧份变 paused。
- 两份计划进度互不影响。
- 有 active 时今日语文练计划指定关 + 题型；做完进下一关，不限日历日。
- 园地关：自动含古诗/日积月累；空计划题型不误推进；做完实际阶段才进下一关。
- 每关结算后可在管理页与今日记录看到结果（含古诗/积累明细）。
- 无 active 时今日语文行为与现网一致。
