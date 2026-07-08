# 新增讲次操作指引（索引）

> 适用场景：新增一个数学讲次，录入题目并注册到平台。
>
> **讲次 ID：** 全程只用 **lessonKey**（`{grade}-{seq}`，如 `2-8`）— registry、md 文件名、组件路径、数据路径均由此派生。
>
> **路由：** 动态页 `apps/web/src/app/math/ny/[grade]/[seq]/`，勿建 `ny/N/` 静态目录。

---

## 路径对照（一表通）

以 **lessonKey `2-8`**（二年级第 8 讲）为例：

| 用途 | 路径 |
|------|------|
| 本地题目源 | `docs/math/lessons/2-8.md` |
| 数据 | `packages/math/src/utils/g2/lesson8-data.ts(x)` |
| 组件 | `packages/math/src/components/lesson/g2/lesson8/` |
| registry | `{ lessonKey: '2-8', grade: 2, seq: 8 }` |
| href | `/math/ny/2/8` |
| 题目 ID | `2-8-L1` |

**规则：** `g{grade}/lesson{seq}` — 其中 `seq` 来自 registry（一年级=教材号，二年级起=年级内序号）。

---

## 概览

每新增一个讲次需要：

- **新建** registry 一行 + module-registry 模块 + 数据 + 8 个组件 wrapper
- **修改** courses-data、sea-data、plan、quiz、source-btns（**键 = lessonKey**）
- **不必**新建 App Router 路由 shell

导航：`LessonAppHeader` / `LessonSidebar` / `LessonBottomNav`，wrapper 里设 canonical `basePath`。见 [`navigation.md`](add-new-lesson/navigation.md)。

**连续练习：** 注册后各学习模块「开始练习」、综合题库筛选练习、错题「一键练习」由共享 `PracticeQueue` 自动提供，**无需每讲额外代码**。见 [`practice-queue.md`](add-new-lesson/practice-queue.md)。

---

## ⚠️ 铁律

1. 题目 ID：`{lessonKey}-L1`，禁止 legacy 前缀或裸 `L1`。
2. href / basePath：`/math/ny/{grade}/{seq}`。
3. md 文件名 = lessonKey（`2-8.md`，不是 `57.md`）。
4. 组件在 `lesson/g{grade}/lesson{seq}/`，不是根目录 `lesson57/`。
5. green build ≠ 渲染正常 — 改 UI 后真机看一眼。
6. **答题区自定义组件**（竖式谜、宫格）必须走 `custom-answer-widget.md` 统一逻辑；禁止题面 `<pre>` 竖式、禁止 per-lesson 草稿答题 UI。

---

## 读取题目

`docs/math/lessons/{lessonKey}.md`。单讲只读这一个文件。

仅照片 → 转 PNG、写 md、再录入代码。

---

## 按需阅读

| 步骤 | 文件 |
|------|------|
| 数据 | [`data.md`](add-new-lesson/data.md) |
| 组件 | [`components.md`](add-new-lesson/components.md) |
| 导航 | [`navigation.md`](add-new-lesson/navigation.md) |
| 注册 | [`registration.md`](add-new-lesson/registration.md) |
| 路由 | [`routes.md`](add-new-lesson/routes.md) |
| 图形 | [`figures.md`](add-new-lesson/figures.md) |
| **答题区自定义组件** | [`custom-answer-widget.md`](add-new-lesson/custom-answer-widget.md) |
| **连续练习** | [`practice-queue.md`](add-new-lesson/practice-queue.md) — 只读，新讲次无需实现 |

---

## 文件清单

```
[ ] docs/math/lessons/{lessonKey}.md
[ ] utils/g{grade}/lesson{seq}-data.ts(x)
[ ] components/lesson/g{grade}/lesson{seq}/*   (8 wrappers)
[ ] lesson-registry.ts
[ ] lesson-module-registry.ts                  — 键 = lessonKey
[ ] courses-data.ts
[ ] sea-data.ts                                — id = lessonKey
[ ] lesson-source-btns.ts
[ ] plan/page.tsx、MathWeeklyPractice.tsx
[ ] quiz/page.tsx、quiz/[id]/*、print/*
```

---

## 验证

```bash
pnpm --filter @rosie/math typecheck
pnpm build
```

访问 `/math/ny/{grade}/{seq}`；可选 `/admin/math-lesson-id-audit`。

**连续练习：** 各模块页（pretest / lesson / homework 等）顶栏「开始练习」、综合题库「开始练习」、错题「一键练习」；顶栏显示进度，答对自动下一题。详见 [`practice-queue.md`](add-new-lesson/practice-queue.md)。
