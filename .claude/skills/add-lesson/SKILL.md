---
name: add-lesson
description: Add new math lessons to the Rosie platform. Reads one per-lesson source file docs/math/lessons/N.md (template docs/math/new-lesson-template.md) — creating it from image sources (e.g. docs/math/img/*.HEIC) when only photos are provided — confirms problem counts and grade before entering data, and generates all required files following the on-demand specs under docs/add-new-lesson/.
version: 3.3.0
trigger: /add-lesson
---

# /add-lesson — 新增讲次

用法：`/add-lesson <N>` —— 只处理第 N 讲，读取 `docs/math/lessons/N.md`（例 `/add-lesson 46`）。
不带编号的 `/add-lesson` —— 处理 `docs/math/lessons/` 下**全部**讲次文件（编号 = 文件名）。

> **省 token 原则（重要）：** 题目源已**按讲次拆分**为 `docs/math/lessons/N.md`；规范已拆分为
> 「索引 + 按需详情」。**不要一次性读完所有文件。**
> - 处理单讲：**只读 `docs/math/lessons/N.md` 这一个文件**（不要读其他讲、不要读 new-lesson.md 索引）。
> - 先读索引 `docs/add-new-lesson.md`，再在对应阶段按需读 `docs/add-new-lesson/` 下的单个详情文件。
> - 纯文字题**跳过** `figures.md`。

---

## 仓库结构（pnpm/Turborepo monorepo）

数学模块已抽成 `@rosie/math` 包：
- **数据/组件 → `packages/math/src/`**（`utils/lessonN-data.ts`、`components/lessonN/...`）
- **路由 → 仍在 `apps/web/src/app/math/ny/N/...`**（App Router 路由必须留在 app）
- **import**：引数据/组件用深子路径 `@rosie/math/utils/lessonN-data`、`@rosie/math/components/lessonN/X`；
  共享类型从 `@rosie/core`（`Problem`/`ProblemSet`）。包内互引也用 `@rosie/math/...`（已配 tsconfig paths）。

---

## 第零步：读取索引

读取 `docs/add-new-lesson.md`（索引，约 130 行）。它给出概览、两条铁律、按需阅读表与文件清单。
**不要**在此步把详情文件全部读入——它们在各自阶段才读。

---

## 第一步：读取题目并确认总数

读取要处理讲次的 `docs/math/lessons/N.md`（单讲只读这一个文件；不带编号时遍历 `docs/math/lessons/` 全部文件）。

> **题目源不是 markdown，或目录不存在时（常见）：**
> - **源是图片**（HEIC/JPG/PNG，常放在 `docs/math/img/`）：先转码再读，HEIC 用
>   `sips -s format jpeg X.HEIC --out /tmp/X.jpg`，然后用 Read 逐张读图提取题目（图片可能旋转，
>   照常识别）。把提取到的题目**先写成 `docs/math/lessons/N.md`**（结构见 `new-lesson-template.md`），
>   再继续后续步骤——保证有一份可复核的文字源。
> - **`docs/math/lessons/` 目录不存在**：直接创建。该目录的历史文件可能被清理过，
>   `docs/math/new-lesson.md` 索引里登记的 46/47.md 不一定还在——这正常，按需新建 `N.md` 即可，
>   并在 `new-lesson.md` 索引表追加一行登记本讲。
> - **某讲分多次补题**（如先给课堂、后给课后/summary）：见「增量补题」——`registration.md` 末尾。

章节 → 数据模块映射：

| 章节 | 模块 | 缺失/为空时 |
|------|------|------------|
| `## summary` | 首页文案（非题目模块） | 从全讲题目提炼 |
| `## 课前测` | pretest | `pretest: []` |
| `## 课堂讲解` | lesson（含「### 模块」/例题/练一练） | `lesson: []` |
| `## 课后巩固` | homework | `homework: []` |
| `## 拓展练习` | workbook | `workbook: []` |
| `## supplement` / `## 附加题` | supplement（可选） | 不创建该模块 |

**确认总数（在录入任何题目之前，对每个讲次）：**
1. 通读该讲**全部章节**（不得只读开头——这是题目遗漏的根本原因）
2. **确认年级**：读 `lessons/N.md` 标题下的 `年级：` 说明；**未写则 `gradeForNewLesson()`（= 当前最高年级 `highestGrade()`）**。据此决定 `LESSON_GRADE['N']`、
   `lectureNum` 用真实讲次号还是年级内「第 1 讲」起（规则见 `registration.md` 年级登记表）
3. 逐题列出编号/关键数字
4. 写出：「第N讲（X年级）共 Y 题：课前测 a + 课堂(例题 b + 练一练 c) + 课后 d + 拓展 e + 附加 f」
5. 确认无误后再录入

> 题目正文若内联了图形/交互组件 tsx（`<ShulianGrid .../>`、`<ChuangkouSudokuGrid .../>` 等），
> 按需读 `docs/add-new-lesson/figures.md` 处理（数据文件改 `.tsx`；交互题无数字答案、要补 CSS）。

---

## 第二步：逐讲生成文件（按需读详情）

> **多讲次：对每个讲次各执行一遍。** 修改类文件（courses-data / lesson-grade / 题海 / 每日计划 / 组卷）每讲都要追加条目。

按顺序生成，每步**只读对应详情文件**：

1. **数据文件** → 读 [`docs/add-new-lesson/data.md`](../../../docs/add-new-lesson/data.md)
   生成 `packages/math/src/utils/lessonN-data.ts`（有内联 JSX 则 `.tsx`）。
2. **组件** → 读 [`docs/add-new-lesson/components.md`](../../../docs/add-new-lesson/components.md)
   生成 `packages/math/src/components/lessonN/` 下 8 个文件（含首页文案提取）。
3. **路由** → 读 [`docs/add-new-lesson/routes.md`](../../../docs/add-new-lesson/routes.md)
   生成 `apps/web/src/app/math/ny/N/` 下 12~14 个页面。
4. **图表/图形/配图** → **仅当需要**时读 [`docs/add-new-lesson/figures.md`](../../../docs/add-new-lesson/figures.md)。
5. **注册到入口** → 读 [`docs/add-new-lesson/registration.md`](../../../docs/add-new-lesson/registration.md)
   更新 **8 处**硬编码清单（**courses-data + lesson-grade**〔新年级另加 gN 薄壳〕/ 题海 / 每日计划×2 / 组卷×3）。**最易遗漏，必逐项核对。**

### 操作指引（勿读历史讲次）

**禁止**为找模板而去读 `packages/math/src/components/lesson*/`（组件有完整内嵌模板，见 `components.md`）。
题目内容**只**来自 `docs/math/lessons/N.md`；代码结构**只**来自 `docs/add-new-lesson/` 详情文件。

**唯一例外 — 允许复制的骨架：**

| 场景 | 复制什么 | 注意 |
|------|----------|------|
| 数据文件 | `lesson35-data.ts` 一个文件 | 只替换题目，不抄 lesson35 的题（见 `data.md`） |
| 方格/数独类交互题 | `lesson47/gong/` 整目录 | 复制后**重命名**为你的 `<子目录>/`（如 `grids/`），CSS 前缀一并替换；`ProblemDetail` 用模板 B |

其它组件/路由：**不要**读历史讲次目录，用 `components.md` / `routes.md` 内嵌模板。

| 步骤 | 生成什么 | 只改什么（详见对应 md） |
|------|----------|------------------------|
| 1 数据 | `utils/lessonN-data.ts(x)` | **复制 lesson35-data.ts** → 替换题目、PROBLEM_TYPES、TAG_STYLE；有 JSX 则 `.tsx` |
| 2 组件 ×8 | `components/lessonN/*` | 全局替换 `{N}`、`/math/ny/{N}`、`useLesson{N}`；CONFIG 改 emoji/文案/**主题色** |
| 2 重点 | `ProblemDetail.tsx` | 数字答案 → `components.md` **模板 A**；交互谜题 → **模板 B** + `figures.md` |
| 3 路由 | `apps/web/.../ny/N/**` | 按 `routes.md` 替换 `{N}`；`[id]` 页一律 `LessonProblemRoutePage` |
| 3 重点 | `alltest/page.tsx` | `filters` 含 `practice`；`FilterPanel` 传 `onSetPractice` |
| 4 图形 | 仅 N.md 有 tsx 时 | 按 `figures.md` 建 `<子目录>/`；方格谜题可复制 `lesson47/gong/` 后重命名 |
| 5 注册 | 8 处硬编码 | 按 `registration.md` 逐项追加 `{N}` 条目（含 courses-data + lesson-grade） |

**主题色**：在 AppHeader / Sidebar / BottomNav / ProblemDetail / FilterPanel.theme 五处用**同一套** Tailwind 色系（如 `sky`、`amber`、`fuchsia`）。

**收藏 / 练习次数 / 上一题下一题**：已由共享组件自动提供（`LessonProblemList`、`LessonProblemDetailHeader`、`LessonProblemNavBar`、`LessonProblemRoutePage`），新讲次无需额外实现。

---

## 第三步：验证

```bash
pnpm --filter @rosie/math typecheck   # 数学包独立类型检查（快）
pnpm build                            # 整体构建
```

有报错先修复。新增/改动 UI 后用 `pnpm dev` **真机打开** `/math` 与新讲次页面看一眼
（green build ≠ 样式正常，见 `docs/bug-report.md`）。完成后对照索引的「文件清单」逐项确认无遗漏。

---

## 用户提供的补充信息

$ARGUMENTS
