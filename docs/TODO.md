# Rosie — 待办 / AI 续接指南

> 给换机或新会话用的 handoff 文档。AI 请 **先读本文**，再按链接里的完整 plan 逐步执行。
>
> 最后更新：2026-06-12

---

## 快速续接（复制给 AI）

```text
请阅读 docs/TODO.md，从「当前优先级最高」的未完成项开始执行。
详细步骤见 docs/superpowers/plans/2026-06-12-calc-fusion-phase5-error-report.md（Phase 5）。
分支 feature/calc-fusion，不要改 Scope 外的文件。每完成一个 Task 运行 pnpm lint，Task 4/5 后再 pnpm build。
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

### Phase 5 明确不在范围

- 按 block 的错误 breakdown
- `calc_sessions.error_summary`
- 旧模块 `/calculate`（只改 `/calc`）

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
6. 再按 plan 做 Task 4 → 5 → 6

---

## 相关文件索引

| 用途 | 路径 |
|------|------|
| Phase 5 详细 plan | `docs/superpowers/plans/2026-06-12-calc-fusion-phase5-error-report.md` |
| Phase 5 DB 迁移 | `docs/sql/calc-phase5-error-tags-migration.sql` |
| 诊断引擎 | `src/utils/calc-diagnose.ts` |
| 错题 hook | `src/hooks/useCalcMistakes.ts` |
| 待改：会话 | `src/app/calc/session/page.tsx` |
| 待改：报告 | `src/app/calc/report/page.tsx` |
| 项目约定 | `CLAUDE.md` |
