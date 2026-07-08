---
name: add-lesson
description: Add new math lessons to the Rosie platform. Reads one per-lesson source file docs/math/lessons/N.md (template docs/math/new-lesson-template.md) — creating it from image sources when only photos are provided — confirms problem counts and grade before entering data, and generates package files + registry entries following docs/add-new-lesson/. Must complete full registration (not just N.md) or the grade homepage card will not appear.
version: 4.2.0
trigger: /add-lesson
---

# /add-lesson — 新增讲次

用法：`/add-lesson <N>` —— 只处理第 N 讲（**legacyId**，如 56），读取 `docs/math/lessons/N.md`。
不带编号的 `/add-lesson` —— 处理 `docs/math/lessons/` 下**全部**讲次文件。

> **省 token：** 单讲只读 `docs/math/lessons/N.md`；先读索引 `docs/add-new-lesson.md`，再按阶段读 `docs/add-new-lesson/*.md` 单个详情文件。

---

## ⚠️ 常见失误（lesson56 教训）

**只写 `docs/math/lessons/N.md` 不够** —— 首页卡片与讲次页均来自代码注册，必须走完下方「第二步」全部产出。

| 现象 | 原因 |
|------|------|
| 二年级首页没有「第 7 讲」卡片 | 缺 `courses-data.ts` 卡片 **或** `lesson-registry.ts` 未登记 |
| `/math/ny/2/7` 404 | 缺 `lesson-module-registry.ts` 或组件目录 |
| 卡片有了但点进去空/报错 | 缺 `lessonN-data.ts` 或 Provider/组件 wrapper |
| `/admin/math` 筛选器不显示「题型」、列表查询为空 | 缺 `sea-data.ts` 的 `SEA_LESSONS` 项，**或** `PROBLEM_TYPES[].tag` 与题目 `problem.tag` 对不上 |

**年级讲次列表数据流：** `GradeLessonList` 读 `courses-data.ts` 的 `COURSES` → 用 `lessonIdFromHref(href)` 解析（依赖 **registry**）→ 按 `gradeOf(id)` 过滤。**两处都要改。**

`docs/` 在 `.gitignore` 中 —— `docs/math/lessons/N.md` 是本地题目源，**不会**驱动线上页面。

---

## 架构速览（2026 路由 / ID 重构后）

| 概念 | 说明 |
|------|------|
| **lessonKey** | 全局主键 `{grade}-{seq}`，如 `2-7` |
| **legacyId** | 迁移前编号 `N`（`/add-lesson N` 的 N），对应源码目录 `lessonN` |
| **canonical 路由** | `/math/ny/{grade}/{seq}`，例 `/math/ny/2/7` |
| **年级列表** | `/math/ny/{grade}`，例 `/math/ny/2` |
| **数学首页** | `/math` |
| **注册表** | `packages/math/src/utils/lesson-registry.ts` — **唯一真相源** |
| **动态路由** | `apps/web/src/app/math/ny/[grade]/[seq]/` — **所有讲次共用，勿再建 `ny/N/` 静态目录** |
| **模块注册** | `packages/math/src/utils/lesson-module-registry.ts` — 绑定 slug → 组件集 |

年级 / 路由 / 题目 ID 的映射**只**在 `lesson-registry.ts` 追加一行；`lesson-grade.ts` 的 `LESSON_GRADE` 由注册表自动生成。

**最新示例（二年级第 7 讲）：** legacyId `56` → lessonKey `2-7` → slug `lesson56` → href `/math/ny/2/7`。

---

## 仓库结构（pnpm monorepo）

- **数据 / 组件** → `packages/math/src/`（`utils/lessonN-data.ts`、`components/lessonN/`）
- **路由** → `apps/web/src/app/math/ny/[grade]/[seq]/`（已存在，**新增讲次不必改路由文件**）
- **import** → `@rosie/math/utils/lessonN-data`、`@rosie/math/components/lessonN/...`（深子路径）

---

## 第零步：读索引

读 `docs/add-new-lesson.md`。不要一次性读完全部详情。

---

## 第一步：读题目并确认元数据

### 题目源 A：`docs/math/lessons/N.md`

无则按 `docs/math/new-lesson-template.md` 创建。

### 题目源 B：仅图片（如 `docs/files/lesson/*.HEIC`）

1. HEIC → PNG：`sips -s format png …`（macOS；需写 workspace 内路径）
2. 若横拍/倒拍：`sips -r 90 …` 转正后再读
3. 逐张抄题 → 写成 `docs/math/lessons/N.md`（按模板分 **课堂讲解 / 课后巩固 / 附加题** 等章节）
4. **多小题**（如例题 1 的（1）（2）（3））在 md 里分开写，录入时拆成 `L1`、`L2`…

**确认（录入前必做）：**
1. 通读**全部章节**，逐题列出编号与题量
2. **年级** `grade`：N.md 标题下写明；未写则 `gradeForNewLesson()`（= `highestGrade()`）
3. **年级内序号** `seq`：一年级 = 教材讲次号；二年级起 = 该年级已有讲次 `seq` 最大值 + 1
4. **legacyId** `N` = 全局新讲次编号（`lesson-registry` 中 legacyId 最大值 +1，可与 seq 不同，如 seq=7、legacyId=56）
5. **lessonKey** = `{grade}-{seq}`；**slug** = `lesson{N}`；**basePath** = `/math/ny/{grade}/{seq}`
6. 写明**本次录入哪些模块**（可只做课堂+附加，其余 `[]`）
7. 写出总题数清单，确认后再录入

有内联 JSX / 交互组件时，按需读 `docs/add-new-lesson/figures.md`。

---

## 第二步：按序生成（按需读详情）

| 顺序 | 详情 | 产出 |
|------|------|------|
| 1 | [`data.md`](../../../docs/add-new-lesson/data.md) | `lessonN-data.ts(x)`，题目 ID 用 **lessonKey 前缀** |
| 2 | [`components.md`](../../../docs/add-new-lesson/components.md) | `components/lessonN/` 共 8 个 wrapper |
| 3 | [`registration.md`](../../../docs/add-new-lesson/registration.md) | registry + module-registry + **全部**入口（含 `courses-data.ts`） |
| 4 | `figures.md` | 仅有图形/交互题时 |

**不再执行：** 为每个讲次生成 `apps/web/src/app/math/ny/N/**`（已由动态路由覆盖）。详见 [`routes.md`](../../../docs/add-new-lesson/routes.md)。

### 组件模板选取

- **同年级上一讲**（如 `lesson55` → `lesson56`）复制改 `BASE` / `lessonKey` / 色系最快
- 禁止为找模板遍历全部 `lesson*/` 目录

### 仅部分模块时（例：课堂讲解 + 附加题）

- `PROBLEMS`：`pretest/homework/workbook` 用 `[]`，`lesson` + `supplement` 有题
- `HomePage` 的 `MODULES`：只列有题的模块（不要挂空课后巩固）
- `Sidebar.sections`、`FilterPanel.sourceBtns`、`lesson-source-btns.ts`：同步去掉无题模块

### 竖式 / 数字谜

纯文本竖式用 `data.md` 中的 `<pre>` 辅助函数嵌入 `text`；复杂交互见 `figures.md`。

### 禁止事项

- **禁止**题目 ID 仅用 legacyId 前缀（`56-L1`）——新题一律 `2-7-L1` 格式
- **禁止** `basePath` 写成 `/math/ny/56` 或 `/math/ny/g2/7`
- **禁止**只写 `N.md` 就结束 —— 必须完成 registration 核对表
- **禁止**用 `SEA_LESSONS.find(l => l.id === lessonKey)` 查讲次 —— SEA `id` 是 legacyId，用 `findSeaLesson(id)`（内部经注册表归一，lessonKey/legacyId 均可）
- **禁止**让 `PROBLEM_TYPES` 有题目里不存在的 tag，或题目 tag 不在 `PROBLEM_TYPES` 里 —— 否则 `/admin/math` 题型筛选失效

### 主题色

AppHeader / Sidebar / BottomNav / ProblemDetail / FilterPanel.theme **五处同一色系**。

共享能力已内置，新讲次无需重复实现：顶栏讲次切换（`LessonGradeNav`）、收藏、练习次数、上下题导航、notes/drafts/mistakes 子页。

---

## 第三步：验证

```bash
pnpm --filter @rosie/math typecheck
pnpm build
```

真机检查：
- `/math` → 年级卡片 → `/math/ny/{grade}` → **讲次卡片出现** → `/math/ny/{grade}/{seq}`
- 顶栏：课程列表回 `/math`、同年级讲次菜单、「更多」下拉、用户区
- 侧栏模块链接（与录入模块一致）、综合题库、错题本
- `/admin/math`：选中新讲次后**「题型」「来源」筛选按钮出现且题目列表非空**（验证 `sea-data.ts` + `PROBLEM_TYPES` tag 对应正确）

---

## 用户提供的补充信息

$ARGUMENTS
