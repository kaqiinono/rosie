---
name: add-lesson
description: Add new math lessons to the Rosie platform. Reads docs/math/new-lesson.md — a single file holding one or more lessons in the docs/math/new-lesson-template.md format — confirms problem counts before entering data, and generates all required files following docs/add-new-lesson.md.
version: 2.0.0
trigger: /add-lesson
---

# /add-lesson — 新增讲次

用法：`/add-lesson` —— 读取 `docs/math/new-lesson.md`，处理其中的**全部讲次**（讲次编号取自每个 `# 第N讲` 标题）。
也可 `/add-lesson <N>` 只处理文件里的第 N 讲，例如 `/add-lesson 46`。

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

## 第一步：读取题目文件

**完整读取 `docs/math/new-lesson.md`。** 不再扫描 `docs/files/`——所有题目内容都在这一个文件里。

该文件包含**一个或多个讲次**，每个讲次以 `# 第N讲 <标题>` 开头，章节结构遵循
`docs/math/new-lesson-template.md`（可先读模板确认结构）。讲次之间以 `---` 分隔。
每个讲次的章节 → 数据模块映射：

| 章节 | 对应模块 | 缺失 / 为空 / 标注"（未找到对应文件）"时 |
|------|----------|------------------------------------------|
| `## summary` | 知识点摘要（首页文案，非题目模块） | 从该讲全部题目综合提炼首页文案 |
| `## 课前测` | pretest（课前测） | 设 `pretest: []` |
| `## 课堂讲解` | lesson（课堂讲解，含「### 模块」/例题/练一练） | 设 `lesson: []` |
| `## 课后巩固` | homework（课后巩固） | 设 `homework: []` |
| `## 拓展练习` | workbook（拓展练习） | 设 `workbook: []` |
| `## supplement` / `## 附加题` | supplement（附加题） | 不创建该模块 |

> **图形题：** 题目正文里可能直接内联图形组件的 tsx（如 `<ShulianGrid rows={...} cells={...}/>`、
> `<ChuangkouSudokuGrid .../>` 等）。按 `docs/add-new-lesson.md` 的图形题规则处理为 `figureNode`，
> 此时数据文件用 `.tsx` 后缀。

列出读取结果：文件中找到的**全部讲次**（编号 + 标题），以及每讲各章节是否有内容。
若用户用 `/add-lesson <N>` 指定了编号，只处理第 N 讲；否则处理文件里的全部讲次。

---

## 第二步：逐讲通读，确认题目总数

**在录入任何题目之前**，对要处理的**每个讲次**执行：

1. 读取该讲**全部章节内容**（不得只读开头）
2. 逐题列出编号 / 关键数字（例：`例题1: 把10个苹果放进9个抽屉，至少有一个抽屉≥几个`）
3. 明确写出：「第N讲 共 X 道题：课前测 a 题 + 课堂讲解（例题 b + 练一练 c）+ 课后巩固 d + 拓展 e + 附加 f」
4. 经用户确认（或自行确认无误）后，再开始录入该讲

**绝对不允许**只读开头就开始录入——这是导致题目遗漏的根本原因。多个讲次时，逐讲确认、逐讲生成。

---

## 第三步：生成所有文件

> **多讲次：第三~七步对每个讲次各执行一遍**（用该讲的 N）。修改类文件（math hub / 题海 /
> 每日计划 / 综合组卷）每讲都要追加对应条目，不要漏掉任何一讲。

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

## 第八步：完成后验证

全部讲次生成完后，在仓库根目录执行（monorepo）：

```bash
pnpm --filter @rosie/math typecheck   # 数学包独立类型检查（快）
pnpm build                            # 确认整体构建通过
```

如有报错，修复后再告知用户完成。新增/改动页面建议 `pnpm dev` 打开 `/math` 与新讲次页面**实际看一眼**渲染（green build ≠ 样式正常，见 `docs/bug-report.md`）。