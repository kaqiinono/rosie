---
name: add-lesson
description: Add new math lessons to the Rosie platform. Reads one per-lesson source file docs/math/lessons/N.md (template docs/math/new-lesson-template.md) — creating it from image sources when only photos are provided — confirms problem counts and grade before entering data, and generates package files + registry entries following docs/add-new-lesson/.
version: 4.0.0
trigger: /add-lesson
---

# /add-lesson — 新增讲次

用法：`/add-lesson <N>` —— 只处理第 N 讲（**legacyId**，如 52），读取 `docs/math/lessons/N.md`。
不带编号的 `/add-lesson` —— 处理 `docs/math/lessons/` 下**全部**讲次文件。

> **省 token：** 单讲只读 `docs/math/lessons/N.md`；先读索引 `docs/add-new-lesson.md`，再按阶段读 `docs/add-new-lesson/*.md` 单个详情文件。

---

## 架构速览（2026 路由 / ID 重构后）

| 概念 | 说明 |
|------|------|
| **lessonKey** | 全局主键 `{grade}-{seq}`，如 `2-4` |
| **legacyId** | 迁移前编号 `N`（`/add-lesson N` 的 N），对应源码目录 `lessonN` |
| **canonical 路由** | `/math/ny/{grade}/{seq}`，例 `/math/ny/2/4` |
| **年级列表** | `/math/ny/{grade}`，例 `/math/ny/2` |
| **数学首页** | `/math` |
| **注册表** | `packages/math/src/utils/lesson-registry.ts` — **唯一真相源** |
| **动态路由** | `apps/web/src/app/math/ny/[grade]/[seq]/` — **所有讲次共用，勿再建 `ny/N/` 静态目录** |
| **模块注册** | `packages/math/src/utils/lesson-module-registry.ts` — 绑定 slug → 组件集 |

年级 / 路由 / 题目 ID 的映射**只**在 `lesson-registry.ts` 追加一行；`lesson-grade.ts` 的 `LESSON_GRADE` 由注册表自动生成。

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

读 `docs/math/lessons/N.md`（无则按 `new-lesson-template.md` 从图片创建）。

**确认（录入前必做）：**
1. 通读**全部章节**，逐题列出编号
2. **年级** `grade`：N.md 标题下写明；未写则 `gradeForNewLesson()`（= `highestGrade()`）
3. **年级内序号** `seq`：一年级 = 教材讲次号；二年级起 = 该年级已有讲次 `seq` 最大值 + 1
4. **lessonKey** = `{grade}-{seq}`；**slug** = `lesson{N}`；**basePath** = `/math/ny/{grade}/{seq}`
5. 写出总题数清单，确认后再录入

有内联 JSX / 交互组件时，按需读 `docs/add-new-lesson/figures.md`。

---

## 第二步：按序生成（按需读详情）

| 顺序 | 详情 | 产出 |
|------|------|------|
| 1 | [`data.md`](../../../docs/add-new-lesson/data.md) | `lessonN-data.ts(x)`，题目 ID 用 **lessonKey 前缀** |
| 2 | [`components.md`](../../../docs/add-new-lesson/components.md) | `components/lessonN/` 共 8 个 wrapper |
| 3 | [`navigation.md`](../../../docs/add-new-lesson/navigation.md) | 各组件 `basePath`、侧栏/底栏/顶栏配置 |
| 4 | [`registration.md`](../../../docs/add-new-lesson/registration.md) | registry + module-registry + 入口清单 |
| 5 | `figures.md` | 仅有图形/交互题时 |

**不再执行：** 为每个讲次生成 `apps/web/src/app/math/ny/N/**`（已由动态路由覆盖）。详见 [`routes.md`](../../../docs/add-new-lesson/routes.md)。

### 禁止事项

- **禁止**为找模板遍历 `lesson*/` 目录（除数据骨架 `lesson35-data.ts`、方格题复制 `lesson47/gong/`）
- **禁止**题目 ID 仅用 legacyId 前缀（`52-L1`）——新题一律 `2-4-L1` 格式
- **禁止** `basePath` 写成 `/math/ny/52` 或 `/math/ny/g2/4`

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
- `/math` → 年级卡片 → `/math/ny/{grade}` → 讲次卡片 → `/math/ny/{grade}/{seq}`
- 顶栏：课程列表回 `/math`、同年级讲次菜单、「更多」下拉、用户区
- 侧栏模块链接、综合题库、错题本

---

## 用户提供的补充信息

$ARGUMENTS
