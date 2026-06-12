# Rosie — 待办 / AI 续接指南

> 给换机或新会话用的 handoff 文档。AI 请 **先读本文**，再按链接里的完整 plan 逐步执行。
>
> 最后更新：2026-06-12

---

## Calc Fusion 总路线图

```
Phase 1  大整数 + 逆运算挖空     ✅ 已完成
Phase 2  竖式                    ✅ 已完成
Phase 3  答案模型 + 余数 + 小数  ✅ 已完成
Phase 4  分数                    ✅ 已完成
Phase 5  错误诊断 + 报告         ⏳ 进行中（Task 4–6）
Phase 6  下线 /calculate         📋 待做（仅有 spec，无逐步 plan）
```

**Phase 6 做完 = calc-fusion 设计 spec 里的 6 个阶段全部结束。** 见文末「Phase 6 之后还有什么」。

设计 spec：`docs/superpowers/specs/2026-06-12-calc-calculate-fusion-design.md`

---

## 快速续接（复制给 AI）

```text
请阅读 docs/TODO.md，从「当前优先级最高」的未完成项开始执行。
Phase 5 细节：docs/superpowers/plans/2026-06-12-calc-fusion-phase5-error-report.md
Phase 6 细节：docs/superpowers/specs/2026-06-12-calc-calculate-fusion-design.md § Phase 6
分支 feature/calc-fusion。每完成一个 Task 运行 pnpm lint；涉及 UI/删路由时 pnpm build。
```

---

## 环境前提

| 项 | 值 |
|---|---|
| 分支 | `feature/calc-fusion`（已 push 到 origin） |
| 包管理 | `pnpm install` |
| 环境变量 | `.env.local` 需含 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 验证命令 | `pnpm lint`（逻辑改动后）；UI/报告改动后加 `pnpm build` |

---

## 🔴 优先级 0 — 分支当前 build 失败（应先修）

**问题：** `src/components/admin/words/WordManagerPage.tsx` 引用了 `./WordPreviewModal`，但该文件 **未纳入 git**（commit `37b66ea` 只提交了预览按钮，没提交组件文件）。`pnpm build` 会报 `Can't resolve './WordPreviewModal'`。

**任选其一修复（与 Phase 5 无关，但会阻塞 build）：**

- [ ] **A. 补全组件** — 新建 `src/components/admin/words/WordPreviewModal.tsx`（词库表格「预览」弹窗，复用 `FlashCard` + `PhonicsLegend`），单独 commit。
- [ ] **B. 回滚引用** — 从 `WordManagerPage.tsx` 去掉 `WordPreviewModal` 相关 import / state / JSX，恢复可 build 状态。

> commit `37b66ea` 的 message 写的是 Phase 5，实际内容是词库/onboarding 改动，与 Phase 5 无关；修完后可考虑 amend 或另开 commit 澄清。

---

## 🟠 优先级 1 — Calc Fusion Phase 5（口算 `/calc`）

**目标：** 答错时自动诊断错误类型，写入 `calc_mistakes`，在 `/calc/report` 展示「错误类型分布」。

**完整 plan（逐步代码片段）：**

`docs/superpowers/plans/2026-06-12-calc-fusion-phase5-error-report.md`

**注意：** plan 里 checkbox 全是 `[ ]`，**不要**只看 checkbox。以下「已完成 / 待做」以 git 与代码为准。

### 已完成 ✅

| Task | 内容 | Commit |
|------|------|--------|
| 1 | `ErrorTag` + `src/utils/calc-diagnose.ts` | `9358ed0` |
| 2 | 迁移 SQL 文件 `docs/sql/calc-phase5-error-tags-migration.sql` | `f4edf77` |
| 3 | `useCalcMistakes` 支持 `userAnswer` + `errorTag` | `1d5ea3f` |

**Task 2 用户步骤（Supabase，手动）：** 在 SQL Editor 执行：

```sql
-- 见 docs/sql/calc-phase5-error-tags-migration.sql
alter table calc_mistakes
  add column if not exists user_answer text,
  add column if not exists error_tag text;
```

换机后若用**同一 Supabase 项目**且已执行过，可跳过。

### 待做 ❌

#### Task 4 — 会话写入诊断结果

**文件：** `src/app/calc/session/page.tsx`（仅此文件）

- [ ] import `{ diagnose } from '@/utils/calc-diagnose'`
- [ ] `settleQuestion` 增加最后一个参数 `userAnswer: string`
- [ ] final-wrong 分支：`diagnose(q, userAnswer)` → `addMistake(q, sessionNo, userAnswer, errorTag)`
- [ ] 所有 caller 传入 `userAnswer`：
  - `handleSubmit` → `input`
  - `handleVerticalSubmit` → `''`
  - `handleRemainderSubmit` → `combined`
  - `handleFractionSubmit` → `combined`
- [ ] `pnpm lint`
- [ ] commit: `feat(calc): diagnose + store the user's wrong answer per mistake`

**验收：** 故意答错几题，Supabase `calc_mistakes` 新行应有 `user_answer`、`error_tag`（可为 null）。

#### Task 5 — 报告页「错误类型分布」

**文件：** `src/app/calc/report/page.tsx`（仅此文件）

- [ ] 查询未 resolved 且 `error_tag` 非空的 `calc_mistakes`，聚合计数
- [ ] 在「最弱 10 题」与「最近练习」之间渲染 **错误类型分布**（样式与现有 section 一致）
- [ ] 使用 `ERROR_TAG_LABELS`（`@/utils/calc-diagnose`）
- [ ] `pnpm lint` + `pnpm build`
- [ ] commit: `feat(calc): add 错误类型分布 section to the report`

**验收：** 制造可诊断错题后打开 `/calc/report`，应看到分布条；掌握度 / 最弱题 / 最近练习不受影响。

#### Task 6 — 端到端验证（用户 + AI 协助）

- [ ] `pnpm build` 通过
- [ ] 手动 case（plan 原文）：
  - `48+57` 答 `95` → 进位遗漏
  - `3+4×2` 答 `14` → 运算顺序混淆
  - 答案差 ×10 → 数位理解偏差
  - `2/5+1/5` 答 `3/10` → 分子分母混淆
  - off-by-1 → 粗心
- [ ] Phase 1–4 口算功能仍正常（竖式、余数、小数、分数等）

### Phase 5 明确不在范围（留作可选 follow-up）

- 按 block 的错误 breakdown（spec 验收标准提到，但 Phase 5 plan 刻意 defer）
- `calc_sessions.error_summary`（每场 session 错误汇总 JSON）
- 旧模块 `/calculate`（留给 Phase 6 删）

---

## 🟢 优先级 3 — Calc Fusion Phase 6（下线 `/calculate`）

**前置：** Phase 5 Task 6 全部通过；`/calc` 已能替代旧模块的核心能力。

**设计 spec：** `docs/superpowers/specs/2026-06-12-calc-calculate-fusion-design.md` → § Phase 6

**尚无**像 Phase 1–5 那样的逐步 plan 文件；按下面 checklist 执行即可。

### 待做 ❌

#### 1. 删应用代码

- [ ] 删除 `src/app/calculate/**`（含 onboarding / session / report / mistakes / tree / level / settings）
- [ ] 删除 `src/utils/calculate-*.ts`（9 个文件：`calculate-types`、`calculate-trees`、`calculate-generator` 等）
- [ ] 删除 `src/hooks/useCalculateSettings.ts`、`useCalculateLevelState.ts`
- [ ] 删除仅被 `/calculate` 使用的 `src/components/calculate/**`（**不要**删已港到 `components/calc/` 的竖式/分数等组件）
- [ ] 全库搜索并清理残留引用：
  ```bash
  rg '/calculate|calculate_|from.*calculate-' src
  ```
  首页已只链 `/calc`；确认无外链、manifest、文档仍指向 `/calculate`

#### 2. 更新文档

- [ ] 更新 `CLAUDE.md`：移除 `/calculate` 模块说明，口算只保留 `/calc`
- [ ] 在 `docs/TODO.md` 或 plan 里标记 Phase 6 完成

#### 3. 删数据库（用户手动，不可逆）

- [ ] **先备份** Supabase
- [ ] 确认 `grep -rE "calculate_[a-z_]+" src` 无结果
- [ ] 在 Supabase SQL Editor 执行 `docs/sql/calculate-decommission.sql`

#### 4. 验证

- [ ] `pnpm lint` + `pnpm build` 通过
- [ ] 手动：首页 → `/calc` 全流程可用；访问 `/calculate` 应 404
- [ ] commit 建议：`chore(calc): decommission legacy /calculate module`

### Phase 6 明确不在范围

- 不改 `/calc` 功能（除非删 calculate 时暴露的 dead import 需修）
- 不自动迁移 `calculate_*` 表里的历史数据到 `calc_*`（旧数据随表 drop）

---

## Phase 6 之后还有什么？

| 类别 | 说明 |
|------|------|
| **calc-fusion 主线** | **Phase 1–6 全部完成即 spec 定义的融合项目结束** |
| **spec 里提过、但未单独成 Phase 的可选项** | 报告「每 block top 错误」、`calc_sessions.error_summary` — 需要可另开 small PR，不算 Phase 7 |
| **与本项目无关的 backlog** | 见下文「优先级 2」：词库预览 build 修复、第 42 讲图解、PDF 整理等 |

---

## 🟡 优先级 2 — 其他已知未完成（可选）

与 Phase 5 独立，换机续接 Phase 5 时可忽略。

### 第 42 讲 · 计时与量水题解图 wiring

图片已在 `public/img/math/`（`42-H4.png`、`42-H5.png`、`42-W5.png`、`42-W6.png`），但 `src/utils/lesson42-data.ts` 里对应题目 **缺少 `analysisImg` 字段**（L9–L12 已挂，H4/H5/W5/W6 未挂）。W6 解析文案也可能需与 6 步图解对齐。

### PDF → md 整理（`docs/files/`）

部分扫描件 PDF 仍为占位或仅提取算式；见历史会话中对第 3/5/8/23 讲练习册、课后巩固的说明。非 blocking。

---

## 换机 checklist

1. `git clone` → `git checkout feature/calc-fusion` → `git pull`
2. `pnpm install`，复制 `.env.local`
3. 确认 Supabase 已跑 Phase 5 迁移 SQL
4. 把本文 **Quick 续接** 段落发给 AI
5. 先修 **优先级 0**（否则 build 红）
6. Phase 5：Task 4 → 5 → 6
7. Phase 6：删 `/calculate` → 跑 decommission SQL → 更新 CLAUDE.md

---

## 相关文件索引

| 用途 | 路径 |
|------|------|
| 融合设计 spec（Phase 1–6 总览） | `docs/superpowers/specs/2026-06-12-calc-calculate-fusion-design.md` |
| Phase 5 详细 plan | `docs/superpowers/plans/2026-06-12-calc-fusion-phase5-error-report.md` |
| Phase 5 DB 迁移 | `docs/sql/calc-phase5-error-tags-migration.sql` |
| Phase 6 DB 删表 | `docs/sql/calculate-decommission.sql` |
| 诊断引擎 | `src/utils/calc-diagnose.ts` |
| 错题 hook | `src/hooks/useCalcMistakes.ts` |
| 待改：会话 | `src/app/calc/session/page.tsx` |
| 待改：报告 | `src/app/calc/report/page.tsx` |
| 待删：旧口算 | `src/app/calculate/**`、`src/utils/calculate-*.ts` |
| 项目约定 | `CLAUDE.md` |
