---
name: add-lesson
description: Add a new math lesson to the Rosie platform. Scans docs/files/ for PDFs, markdown, and text files, confirms problem counts before entering data, and generates all required files following docs/add-new-lesson.md.
version: 1.1.0
trigger: /add-lesson
---

# /add-lesson — 新增讲次

用法：`/add-lesson <N>`，例如 `/add-lesson 40`

---

## 仓库结构（pnpm/Turborepo monorepo — 2026-06 迁移后）

数学模块已抽成 `@rosie/math` 包。新增讲次时文件落点：
- **数据/组件 → `packages/math/src/`**：`packages/math/src/utils/lessonN-data.ts`、`packages/math/src/components/lessonN/...`。
- **路由 → 仍在 `apps/web/src/app/math/ny/N/...`**（App Router 路由必须留在 app）。
- **import 写法**：路由/组件引数据用深子路径 `@rosie/math/utils/lessonN-data`、`@rosie/math/components/lessonN/X`；共享类型从 `@rosie/core`（`Problem`/`ProblemSet`）。包内同模块互引也用 `@rosie/math/...`（已配 tsconfig paths）。
- 完成后验证：`pnpm --filter @rosie/math typecheck` + `pnpm build`。

---

## 第零步：读取规范文档（必须最先执行）

**在做任何事之前，先完整读取 `docs/add-new-lesson.md`。**
该文件是本 skill 的权威规范，所有文件结构、组件写法、数据格式、命名规则均以它为准。
本 skill 只定义流程骨架，具体实现细节全部依赖该文档。

> **关于读取已有课程代码：** 默认按规范文档的模板直接生成，不需要读取其他 lessonN 的代码。只有在规范文档无法覆盖的特殊情况下（如遇到文档未描述的新组件用法），才去读取已有课程代码作为参考。

---

## 第一步：扫描题目文件

扫描 `docs/files/` 目录，查找以下文件（N 为讲次编号）。
**支持所有格式：PDF (.pdf)、Markdown (.md)、文本 (.txt)。**
文件名可能带讲次前缀（如 `43课堂讲解.pdf`），也可能不带前缀（如 `课堂讲解.md`）。两种命名都要扫描。

| 关键词 | 对应模块 | 缺失时处理 |
|--------|----------|------------|
| `课堂讲解` 或 `课堂巩固` | lesson（课堂讲解） | 设 `lesson: []` |
| `课前测` | pretest（课前测） | 设 `pretest: []` |
| `课后巩固` | homework（课后巩固） | 设 `homework: []` |
| `拓展练习` | workbook（拓展练习） | 设 `workbook: []` |
| `附加题` 或 `supplement` | supplement（附加题） | 不创建该模块 |
| `summary` 或 `知识点` | 知识点摘要（仅供参考） | 从全部题目内容综合分析提取最佳首页文案 |

列出扫描结果：
- ✅ 已找到：列出文件名
- ❌ 未找到：列出缺失文件名

> 如有缺失文件，告知用户可以放入 `docs/files/` 后回复"继续"，或直接回复"继续"将对应模块设为空列表。

等待用户回复"继续"后，执行后续步骤。

---

## 第二步：通读所有文件，确认题目总数

**在录入任何题目之前**，对每个找到的文件执行以下操作：

1. 读取文件**全部内容**（不得只读前几页）
2. 列出每道题的编号/标题/关键数字（例：`例题1: 等差数列 2,5,8,11,… 求第12个数`）
3. 明确写出：「共 X 道题：例题1-N + 练一练1-M」
4. 经用户确认（或自行确认无误）后，再开始录入

**绝对不允许**只读前几页就开始录入——这是导致题目遗漏的根本原因。

---

## 第三步：生成所有文件

按照 `docs/add-new-lesson.md` 中的完整规范生成文件。以下是需要创建/修改的文件清单：

### 新建文件

- `packages/math/src/utils/lesson{N}-data.ts`（或 `.tsx`，若有 figureNode）
- `apps/web/src/app/math/ny/{N}/layout.tsx`
- `apps/web/src/app/math/ny/{N}/page.tsx`
- `apps/web/src/app/math/ny/{N}/lesson/page.tsx`
- `apps/web/src/app/math/ny/{N}/lesson/[id]/page.tsx`
- `apps/web/src/app/math/ny/{N}/homework/page.tsx`
- `apps/web/src/app/math/ny/{N}/homework/[id]/page.tsx`
- `apps/web/src/app/math/ny/{N}/workbook/page.tsx`
- `apps/web/src/app/math/ny/{N}/workbook/[id]/page.tsx`
- `apps/web/src/app/math/ny/{N}/pretest/page.tsx`
- `apps/web/src/app/math/ny/{N}/pretest/[id]/page.tsx`
- `apps/web/src/app/math/ny/{N}/alltest/page.tsx`
- `apps/web/src/app/math/ny/{N}/mistakes/page.tsx`
- `packages/math/src/components/lesson{N}/Lesson{N}Provider.tsx`
- `packages/math/src/components/lesson{N}/AppHeader.tsx`
- `packages/math/src/components/lesson{N}/BottomNav.tsx`
- `packages/math/src/components/lesson{N}/Sidebar.tsx`
- `packages/math/src/components/lesson{N}/ProblemList.tsx`
- `packages/math/src/components/lesson{N}/ProblemDetail.tsx`
- `packages/math/src/components/lesson{N}/FilterPanel.tsx`
- `packages/math/src/components/lesson{N}/HomePage.tsx`
- `packages/math/src/components/lesson{N}/Figure/`（如有图形题）

如有附加题，额外新建：
- `apps/web/src/app/math/ny/{N}/supplement/page.tsx`
- `apps/web/src/app/math/ny/{N}/supplement/[id]/page.tsx`

### 修改文件

- `apps/web/src/app/math/page.tsx` — 添加第 N 讲卡片（第四步）
- `packages/math/src/utils/sea-data.ts` — 注册新讲次到题海（第五步）
- `apps/web/src/app/math/ny/plan/page.tsx` — 添加 import + 在 `PROBLEM_SETS` 中注册（第六步 6-A）
- `packages/math/src/components/MathWeeklyPractice.tsx` — 在 `LESSONS` 数组末尾追加新讲次配置（第六步 6-B）
- `apps/web/src/app/math/ny/quiz/page.tsx` — 添加 import (含 `PROBLEM_TYPES`) + 在 `LESSON_META` 末尾追加（第七步 7-A）
- `apps/web/src/app/math/ny/quiz/[id]/page.tsx` — 添加 import + 更新 `LESSON_DATA` 和 `LESSON_NAMES`（第七步 7-B）
- `apps/web/src/app/math/ny/quiz/[id]/print/page.tsx` — 添加 import + 更新 `LESSON_DATA`（第七步 7-C）

所有细节（字段结构、组件 props、图表插槽、补充题的额外改动点等）参照 `docs/add-new-lesson.md`。

---

## 第五步：在题海中注册新讲次

**文件：** `packages/math/src/utils/sea-data.ts`

在文件顶部添加 import，在 `SEA_LESSONS` 数组末尾追加新讲次条目。
具体格式和 `badgeClass` 颜色选取规则参照 `docs/add-new-lesson.md` 第五步。

---

## 第六步：在每日计划页注册新讲次（两个文件必须同步更新）

**文件 A：** `apps/web/src/app/math/ny/plan/page.tsx`
- 添加 `import { PROBLEMS as PROBLEMSN } from '@rosie/math/utils/lessonN-data'`
- 在 `PROBLEM_SETS` 对象中追加 `'N': PROBLEMSN`

**文件 B：** `packages/math/src/components/MathWeeklyPractice.tsx`
- 在文件顶部 `LESSONS` 数组**末尾**追加新讲次对象（id / label / short / emoji / color / bg / border / desc）
- 颜色 RGB 与已有讲次区分，参考 `docs/add-new-lesson.md` 第六步颜色表

> **遗漏后果：** 任一文件未更新，新讲次都不会出现在 `/math/ny/plan` 的每日一练中。这是除题海注册之外最容易遗漏的步骤。

---

## 第七步：在综合组卷页注册新讲次（三个文件必须同步更新）

**文件 A：** `apps/web/src/app/math/ny/quiz/page.tsx`
- 添加 `import { PROBLEMS as PN, PROBLEM_TYPES as PTN } from '@rosie/math/utils/lessonN-data'`（**必须含 `PROBLEM_TYPES`**）
- 在 `LESSON_META` 数组末尾追加 `{ id: 'N', name: '[主题]', data: PN, types: PTN }`

**文件 B：** `apps/web/src/app/math/ny/quiz/[id]/page.tsx`
- 添加 `import { PROBLEMS as PN } from '@rosie/math/utils/lessonN-data'`
- 在 `LESSON_DATA` 与 `LESSON_NAMES` 两个映射中各加一项

**文件 C：** `apps/web/src/app/math/ny/quiz/[id]/print/page.tsx`
- 添加 `import { PROBLEMS as PN } from '@rosie/math/utils/lessonN-data'`
- 在 `LESSON_DATA` 映射中加一项（该文件没有 `LESSON_NAMES`）

> **遗漏后果：** 文件 A 漏 → 弹窗里看不到新讲次；文件 B/C 漏 → 已保存的试卷如包含新讲次题目会渲染为空。三处必须同时更新。

---

## 第八步：完成后执行

```bash
pnpm lint
```

如有报错，修复后再告知用户完成。