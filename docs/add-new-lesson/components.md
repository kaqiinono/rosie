# 第二步：组件 wrapper（8 个）

目录：`packages/math/src/components/lesson/g{grade}/lesson{seq}/`

| lessonKey | 目录 |
|-----------|------|
| `2-7` | `lesson/g2/lesson7/` |
| `2-8` | `lesson/g2/lesson8/` |
| `1-46` | `lesson/g1/lesson46/` |

复制**同年级上一讲**目录，改 `BASE`、`lessonKey`、色系、Provider 名。

---

## 占位符（`2-8`）

| 项 | 值 |
|----|-----|
| lessonKey | `2-8` |
| BASE | `/math/ny/2/8` |
| 数据 import | `@rosie/math/utils/g2/lesson8-data` |
| Provider 文件 | `G2Lesson8Provider.tsx` |
| hook | `useG2Lesson8` |

> 旧讲次可能仍用 `Lesson56Provider` 等历史文件名；**新讲次**用 `G{grade}Lesson{seq}Provider`。

---

## 1. G2Lesson8Provider.tsx

```tsx
'use client'
import { createLessonProvider } from '@rosie/math/components/shared/createLessonProvider'
const { Provider, useLessonContext } = createLessonProvider('G2Lesson8')
export default Provider
export { useLessonContext as useG2Lesson8 }
```

## 2. AppHeader.tsx

```tsx
const CONFIG = {
  basePath: '/math/ny/2/8',
  // …
} as const
// useLessonContext = useG2Lesson8
```

## 3–8. Sidebar / BottomNav / HomePage / FilterPanel / ProblemList / ProblemDetail

- `ProblemList`：`lessonId="2-8"`（wrapper 仍需要；**分模块列表页的「开始练习」由 `SectionListPage` + 共享 `LessonProblemList` 提供**，不必在 wrapper 里实现）
- `HomePage`：`LessonSummary lessonId="2-8"`
- 仅部分模块时：HomePage `MODULES`、Sidebar `sections`、FilterPanel `sourceBtns` 对齐实际模块
- `FilterPanel`：`createFilterPanel` 已含综合题库「开始练习」，走 `PracticeQueue`（见 [`practice-queue.md`](practice-queue.md)）

五处组件**同一色系**。

### ProblemDetail — 按题型选模板

| 题型 | 参考讲次 | 说明 |
|------|----------|------|
| 宫格 / `figureNode` | `g1/lesson47/ProblemDetail.tsx` | `injectFigureGridCallbacks` + `InteractiveAnswerFeedback` |
| 竖式谜 / `verticalPuzzle` | `g2/lesson7/ProblemDetail.tsx` | 题面区 `VerticalDigitPuzzlePanel embedded` + `InteractiveAnswerFeedback` |
| 纯数值 | 同年级无交互讲次 | `NumericAnswerPanel` |

草稿纸、组卷对 custom-widget 的渲染由共享层自动处理，见 [`custom-answer-widget.md`](custom-answer-widget.md)。
