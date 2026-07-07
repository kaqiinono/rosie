# 新增讲次操作指引（索引）

> 适用场景：新增一个数学讲次（legacyId = N，如第 52 讲），录入题目并注册到平台。
>
> **路由已统一为动态页** `apps/web/src/app/math/ny/[grade]/[seq]/`，新增讲次**不需要**再建 `apps/web/src/app/math/ny/N/` 目录。

---

## 概览

每新增一个讲次需要：

- **新建** `lesson-registry` 登记 + `lesson-module-registry` 模块 + 数据文件 + 8 个组件 wrapper
- **修改** 题海 / 每日计划 / 组卷等入口（仍用 legacyId 字符串的部分见 `registration.md`）
- **不必新建** App Router 路由 shell（动态路由已覆盖）

导航由共享组件承担（`LessonAppHeader` / `LessonSidebar` / `LessonBottomNav`），新讲次只需在各 wrapper 里配置 **canonical `basePath`**。详见 [`navigation.md`](add-new-lesson/navigation.md)。

`constant.ts` **无需改动**。

---

## ID 与路由（重构后）

| 字段 | 示例（legacy 52 = 二年级第 4 讲） |
|------|-----------------------------------|
| legacyId | `52`（`/add-lesson 52` 的 N，目录 `lesson52`） |
| grade | `2` |
| seq | `4`（二年级内第 4 讲） |
| lessonKey | `2-4` |
| canonical href | `/math/ny/2/4` |
| 题目 ID | `2-4-L1`、`2-4-H3`、`2-4-P1`… |

**注册表：** `packages/math/src/utils/lesson-registry.ts` 的 `LESSON_ENTRIES` 追加一行即可；`lesson-grade.ts` 自动派生年级映射。

---

## ⚠️ 铁律

1. **题目 ID 用 lessonKey 前缀**（`2-4-L1`），禁止裸 `L1` 或仅 legacyId（`52-L1`）——否则跨讲次碰撞。
2. **href / basePath 用 canonical 路由** `/math/ny/{grade}/{seq}`，禁止 `/math/ny/52`、`/math/ny/g2/4`。
3. **green build ≠ 渲染正常**：改 UI 后 `pnpm dev` 真机看一眼（`docs/bug-report.md`）。

---

## 读取题目

题目源：`docs/math/lessons/N.md`（`N` = legacyId）。单讲**只读这一个文件**。

1. 通读全部章节，逐题列出
2. 确认 `grade`、`seq`、推导出 `lessonKey` 与 `basePath`
3. 写出总题数，确认后再录入

---

## 按需阅读

| 步骤 | 文件 | 何时 |
|------|------|------|
| 数据 | [`data.md`](add-new-lesson/data.md) | 总是 |
| 组件 | [`components.md`](add-new-lesson/components.md) | 总是 |
| 导航 | [`navigation.md`](add-new-lesson/navigation.md) | 总是（basePath、侧栏/顶栏/底栏） |
| 注册 | [`registration.md`](add-new-lesson/registration.md) | 总是（最易漏） |
| 路由 | [`routes.md`](add-new-lesson/routes.md) | 了解动态路由即可，通常无需改文件 |
| 图形 | [`figures.md`](add-new-lesson/figures.md) | 仅有图表/交互题时 |

---

## 文件清单

```
packages/math/src/utils/
  [ ] lesson-registry.ts                 — LESSON_ENTRIES 追加一行（最先做）
  [ ] lesson-module-registry.ts          — 导入 + LESSON_MODULES.lessonN
  [ ] lessonN-data.ts(.tsx)
  [ ] sea-data.ts                        — SEA_LESSONS

packages/math/src/components/lessonN/
  [ ] LessonNProvider.tsx
  [ ] AppHeader.tsx / Sidebar.tsx / BottomNav.tsx
  [ ] HomePage.tsx / FilterPanel.tsx
  [ ] ProblemList.tsx / ProblemDetail.tsx
  [ ] Figure/ …                          — 可选

apps/web — 通常无需新增：
  (已有) math/ny/[grade]/page.tsx        — 年级讲次列表
  (已有) math/ny/[grade]/[seq]/**        — 动态讲次页（home/lesson/…/notes/drafts）

入口注册（见 registration.md）：
  [ ] courses-data.ts
  [ ] sea-data.ts
  [ ] plan/page.tsx、MathWeeklyPractice.tsx
  [ ] quiz/page.tsx、quiz/[id]/page.tsx、quiz/[id]/print/page.tsx
```

---

## 验证

```bash
pnpm --filter @rosie/math typecheck
pnpm build
```

访问 `/math/ny/{grade}/{seq}` 与顶栏讲次切换、侧栏各模块。
