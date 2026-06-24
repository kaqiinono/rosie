# 新增讲次操作指引（索引）

> 适用场景：在 `apps/web/src/app/math/ny/` 下新增一个讲次（如第46讲、第47讲），复用已有页面结构、只替换题目内容。
>
> **本文件是索引。详细模板已按「何时需要」拆分到 `docs/add-new-lesson/` 子目录，按需读取——
> 不要一次性把所有详情文件读进上下文。**

---

## 概览

每新增一个讲次，需要：
- **新建** 数据文件 + 8 个组件 wrapper + 12~14 个路由页面
- **修改** 7 处入口注册清单（数学入口 / 题海 / 每日计划×2 / 组卷×3）

`constant.ts` **无需改动**：所有讲次共享 3 个通用本地缓存 key。

---

## ⚠️ 两条贯穿始终的铁律

1. **ID 前缀防碰撞**：所有讲次共享 `math-solved` / `math-wrong` 状态键。新讲次每题 ID **必须**加讲次前缀
   （`46-L1` / `46-H1` / `46-W1` / `46-P1` / `46-S1`），否则跨讲次 ID 碰撞。
2. **green build ≠ 渲染正常**：类型检查/构建通过不代表页面正常。Tailwind 类缺失、CSS 变量未定义都不会报错。
   新增/改动 UI 后用 `pnpm dev` **真机看一眼**（详见 `docs/bug-report.md`）。

---

## 读取题目文件流程

题目内容**按讲次拆分**在 `docs/math/lessons/N.md`（结构见 `docs/math/new-lesson-template.md`，
索引见 `docs/math/new-lesson.md`）。处理单讲时**只读 `docs/math/lessons/N.md` 这一个文件**。

1. **先通读目标讲次的全部章节**，逐题列出标题/关键数字
2. 明确写出该讲总题数（例：「第46讲 共 X 题：课前测 a + 课堂(例题 b + 练一练 c) + 课后 d + 拓展 e + 附加 f」）
3. 确认无误后再逐题录入

> **绝对不允许只读开头就开始录入**——这是题目遗漏的根本原因。
> 缺失/为空的模块设为 `[]`（如 `pretest: []`），不影响页面生成。

---

## 按需阅读：详情文件

按生成顺序逐个执行，**每步只读对应详情文件**：

| 步骤 | 详情文件 | 何时读 |
|------|----------|--------|
| 第一步 数据文件 | [`docs/add-new-lesson/data.md`](add-new-lesson/data.md) | 总是（题目结构、难度、补充题） |
| 第二+三步 组件 | [`docs/add-new-lesson/components.md`](add-new-lesson/components.md) | 总是（首页文案提取 + 8 个组件模板） |
| 第三步 路由 | [`docs/add-new-lesson/routes.md`](add-new-lesson/routes.md) | 总是（layout/page/section/alltest/mistakes 模板） |
| 图表/图形/配图 | [`docs/add-new-lesson/figures.md`](add-new-lesson/figures.md) | **仅当**有图表插槽、SVG、交互组件或题解配图时 |
| 第四~七步 注册 | [`docs/add-new-lesson/registration.md`](add-new-lesson/registration.md) | 总是（最易遗漏，必核对） |

> **省 token 的关键**：纯文字题可完全跳过 `figures.md`；复制结构相近的已有讲次
> （纯文字参考 lesson41，交互谜题参考 lesson47）再按详情文件改色/改文案，比从零写更快更稳。

---

## 文件清单（快速检查）

```
packages/math/src/utils/
  [ ] lessonN-data.ts(.tsx)              — 数据文件（ID 加 N- 前缀；每题含 difficulty 1–5）
  [ ] sea-data.ts                        — SEA_LESSONS 末尾注册（第五步）

packages/math/src/components/lessonN/
  [ ] LessonNProvider.tsx
  [ ] AppHeader.tsx
  [ ] Sidebar.tsx
  [ ] BottomNav.tsx
  [ ] HomePage.tsx
  [ ] FilterPanel.tsx                    — createFilterPanel 工厂
  [ ] ProblemList.tsx
  [ ] ProblemDetail.tsx
  [ ] Figure/ 或 <子目录>/               — 仅有图形/交互题时

apps/web/src/app/math/ny/N/
  [ ] layout.tsx   page.tsx
  [ ] lesson/page.tsx       lesson/[id]/page.tsx
  [ ] homework/page.tsx     homework/[id]/page.tsx
  [ ] workbook/page.tsx     workbook/[id]/page.tsx
  [ ] pretest/page.tsx      pretest/[id]/page.tsx
  [ ] alltest/page.tsx      mistakes/page.tsx
  [ ] supplement/page.tsx   supplement/[id]/page.tsx   — 仅有补充题时

入口注册（最易遗漏，逐项核对 registration.md）：
  [ ] apps/web/src/app/math/page.tsx                      — courses 数组最前面（第四步）
  [ ] packages/math/src/utils/sea-data.ts                 — SEA_LESSONS（第五步）
  [ ] apps/web/src/app/math/ny/plan/page.tsx              — PROBLEM_SETS（第六步 A）
  [ ] packages/math/src/components/MathWeeklyPractice.tsx — LESSONS 数组（第六步 B）
  [ ] apps/web/src/app/math/ny/quiz/page.tsx              — LESSON_META（第七步 A）
  [ ] apps/web/src/app/math/ny/quiz/[id]/page.tsx         — LESSON_DATA + LESSON_NAMES（第七步 B）
  [ ] apps/web/src/app/math/ny/quiz/[id]/print/page.tsx   — LESSON_DATA（第七步 C）
```

---

## 验证

```bash
pnpm --filter @rosie/math typecheck   # 数学包独立类型检查（快）
pnpm build                            # 整体构建
```
