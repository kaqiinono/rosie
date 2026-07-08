---
name: add-lesson
description: Add new math lessons to the Rosie platform. Reads one per-lesson source file docs/math/lessons/{lessonKey}.md (template docs/math/new-lesson-template.md) — creating it from image sources when only photos are provided — confirms problem counts and grade before entering data, and generates package files + registry entries following docs/add-new-lesson/. Must complete full registration (not just the md file) or the grade homepage card will not appear.
version: 5.3.0
trigger: /add-lesson
---

# /add-lesson — 新增讲次

用法：`/add-lesson <lessonKey>` —— 只处理该讲（如 `2-8`），读取 `docs/math/lessons/2-8.md`。
不带参数的 `/add-lesson` —— 处理 `docs/math/lessons/` 下**全部** `.md` 文件。

> **省 token：** 单讲只读 `docs/math/lessons/{lessonKey}.md`；先读索引 `docs/add-new-lesson.md`，再按阶段读 `docs/add-new-lesson/*.md` 单个详情文件。

---

## ⚠️ 常见失误

**只写 md 不够** —— 首页卡片与讲次页均来自代码注册，必须走完「第二步」全部产出。

| 现象 | 原因 |
|------|------|
| 年级首页无卡片 | 缺 `courses-data.ts` **或** `lesson-registry.ts` 未登记 |
| `/math/ny/2/8` 404 | 缺 `lesson-module-registry.ts` 的 `'2-8'` 键或组件目录 |
| 点进去空/报错 | 缺 `g2/lesson8-data.ts` 或 Provider/组件 wrapper |
| `/admin/math` 题型筛选为空 | 缺 `sea-data.ts` 项，或 `PROBLEM_TYPES[].tag` 与题目 `tag` 不一致 |
| 计划/组卷选不到讲 | plan / quiz / MathWeeklyPractice 键不是 **lessonKey** |
| 草稿纸答题区空白 / 无竖式 | 自定义答题组件未按 [`custom-answer-widget.md`](../../../docs/add-new-lesson/custom-answer-widget.md) 挂 `verticalPuzzle` 或 `figureNode` + `checkAnswer` |
| 分模块无「开始练习」 | 缺 `lesson-module-registry` 注册或 `PROBLEMS` 键与 Sidebar 不一致；分模块连刷由 `SectionListPage` 自动提供，见 [`practice-queue.md`](../../../docs/add-new-lesson/practice-queue.md) |

**年级列表数据流：** `courses-data.ts` → `lessonKeyFromHref(href)`（依赖 registry）→ `gradeOf(lessonKey)`。**registry + courses-data 都要改。**

`docs/` 在 `.gitignore` 中 —— 本地 md **不会**驱动线上页面。

---

## 架构速览（lessonKey 统一命名）

**一个讲次、一个 ID：** `lessonKey` = `{grade}-{seq}`（如 `2-8`），用于 registry、路由、题目 ID、题海、计划、组卷、本地 md 文件名。

| 层 | 路径 / 值（以 `2-8` 为例） |
|----|---------------------------|
| lessonKey | `2-8` |
| registry | `{ lessonKey: '2-8', grade: 2, seq: 8 }` |
| href / basePath | `/math/ny/2/8` |
| 题目 ID | `2-8-L1` |
| 本地题目源 | `docs/math/lessons/2-8.md` |
| 数据文件 | `packages/math/src/utils/g2/lesson8-data.ts(x)` |
| 组件目录 | `packages/math/src/components/lesson/g2/lesson8/` |
| module-registry 键 | `'2-8'` |

**seq 规则：** 一年级 = 教材讲次号（`1-12` → seq 12）；二年级起 = 年级内从 1 递增（`2-8` → seq 8）。

`lesson-grade.ts` 的 `LESSON_GRADE` 由注册表自动生成。

**已有讲次示例（二年级第 7 讲）：**

| 层 | 值 |
|----|-----|
| lessonKey | `2-7` |
| md | `docs/math/lessons/2-7.md` |
| 数据 | `utils/g2/lesson7-data.ts` |
| 组件 | `components/lesson/g2/lesson7/` |

| Provider | `G2Lesson8Provider` / `useG2Lesson8`（与路径一致） |

---

## 仓库结构

```
packages/math/src/
  utils/g{grade}/lesson{seq}-data.ts(x)     # 题目数据
  components/lesson/g{grade}/lesson{seq}/   # 8 个 wrapper + Figure/
apps/web/src/app/math/ny/[grade]/[seq]/     # 动态路由（勿新建 ny/N/）
```

import 示例：

```ts
import { PROBLEMS } from '@rosie/math/utils/g2/lesson8-data'
import HomePage from '@rosie/math/components/lesson/g2/lesson8/HomePage'
```

---

## 第零步：读索引

读 `docs/add-new-lesson.md`。

---

## 第一步：读题目并确认元数据

### 题目源 A：`docs/math/lessons/{lessonKey}.md`

无则按 `docs/math/new-lesson-template.md` 创建（文件名 = lessonKey，如 `2-8.md`）。

### 题目源 B：仅图片

1. HEIC → PNG（`sips`）
2. 抄题写入 `docs/math/lessons/{lessonKey}.md`
3. 多小题拆成 `L1`、`L2`…

**确认（录入前必做）：**

1. 通读全部章节，逐题列出
2. **grade**；未写则 `gradeForNewLesson()`
3. **seq**（见上表规则）
4. **lessonKey** = `{grade}-{seq}`；**basePath** = `/math/ny/{grade}/{seq}`
5. 数据路径 `g{grade}/lesson{seq}-data`；组件路径 `lesson/g{grade}/lesson{seq}/`
6. 本次录入哪些模块
7. 总题数清单

有交互组件或竖式数字谜时读 [`figures.md`](../../../docs/add-new-lesson/figures.md) 与 [`custom-answer-widget.md`](../../../docs/add-new-lesson/custom-answer-widget.md)。

---

## 第二步：按序生成

| 顺序 | 详情 | 产出 |
|------|------|------|
| 1 | [`data.md`](../../../docs/add-new-lesson/data.md) | `g{grade}/lesson{seq}-data.ts(x)` |
| 2 | [`components.md`](../../../docs/add-new-lesson/components.md) | `lesson/g{grade}/lesson{seq}/` 共 8 个 wrapper |
| 3 | [`registration.md`](../../../docs/add-new-lesson/registration.md) | registry + module-registry + 全部入口 |
| 4 | [`figures.md`](../../../docs/add-new-lesson/figures.md) | 宫格 / 图形组件目录 |
| 5 | [`custom-answer-widget.md`](../../../docs/add-new-lesson/custom-answer-widget.md) | **答题区自定义组件**（竖式谜、宫格）数据 + ProblemDetail + 草稿纸 |
| — | [`practice-queue.md`](../../../docs/add-new-lesson/practice-queue.md) | **只读** — 连续练习已由共享层提供，新讲次无需额外代码 |

**不再执行：** `apps/web/src/app/math/ny/N/**` 静态路由。见 [`routes.md`](../../../docs/add-new-lesson/routes.md)。

### 连续练习（无需每讲实现）

注册 `lesson-module-registry` 后自动具备：

- **课前测 / 课堂 / 课后 / 练习册 / 附加题** — `SectionListPage` 顶栏「开始练习」+ 卡片点击进入，范围仅限本模块
- **综合题库** — 各讲 `FilterPanel`（`createFilterPanel`）筛选后「开始练习」
- **错题本** — `LessonMistakesPage`「一键练习」

统一走 `PracticeQueueProvider` + `MathPracticePortal`。**禁止**在新讲次接入 `ProblemPracticeSession`。详见 [`practice-queue.md`](../../../docs/add-new-lesson/practice-queue.md)。

### 组件模板

复制**同年级上一讲**目录，改 `BASE` / `lessonKey` / 色系 / Provider 名。

**含答题区自定义组件时：** `ProblemDetail` 必须跟题型对齐（宫格 → 模板 A `1-47`；竖式谜 → 模板 B `2-7`）。草稿纸由 `ScratchPadCustomAnswerWidget` 自动接入，**勿**在讲次目录里再写草稿专用答题 UI。见 [`custom-answer-widget.md`](../../../docs/add-new-lesson/custom-answer-widget.md)。

### 仅部分模块时

`PROBLEMS`、HomePage `MODULES`、Sidebar、FilterPanel、lesson-source-btns 同步去掉空模块。

### 禁止事项

- **禁止** legacy 题目 ID（`56-L1`、`52-L1`）—— 一律 `{lessonKey}-L1`
- **禁止** href `/math/ny/56` 或 `/math/ny/g2/8`
- **禁止** registry / module / SEA / plan / quiz 使用 legacyId 或 `lessonNN` 根目录
- **禁止** md 文件名用全局编号（`57.md`）—— 必须用 `2-8.md`
- **禁止** `SEA_LESSONS.id` 非 lessonKey；查讲次用 `findSeaLesson(lessonKey)`
- **禁止** `PROBLEM_TYPES` 与题目 `tag` 不一致

---

## 第三步：验证

```bash
pnpm --filter @rosie/math typecheck
pnpm build
```

- `/math/ny/{grade}/{seq}` 全流程
- `/admin/math` 题型/来源筛选
- 分模块 **开始练习**、综合题库 **开始练习**、错题 **一键练习**（顶栏进度 + 答对自动下一题）
- 可选：`/admin/math-lesson-id-audit` 源码脏数据为 0
- **有 custom-widget 题：** 详情页作答 + 草稿纸浮层答题区与「加入画布」（见 `custom-answer-widget.md`）

---

## 用户提供的补充信息

$ARGUMENTS
