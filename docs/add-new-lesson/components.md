# 第二步：组件 wrapper（8 个）

目录：`packages/math/src/components/lessonN/`（`N` = legacyId）。

**不要**遍历历史讲次目录找模板。优先**复制同年级上一讲**（如 `lesson55` → `lesson56`），批量替换 `BASE` / `lessonKey` / 色系 / Provider 名。

---

## 全局占位符

| 占位 | 示例 |
|------|------|
| legacyId `N` | `56` |
| lessonKey | `2-7` |
| `BASE` | `/math/ny/2/7` |
| Provider 名 | `Lesson56Provider` / `useLesson56` |

---

## 1. LessonNProvider.tsx

```tsx
'use client'
import { createLessonProvider } from '@rosie/math/components/shared/createLessonProvider'
const { Provider, useLessonContext } = createLessonProvider('Lesson56')
export default Provider
export { useLessonContext as useLesson56 }
```

## 2. AppHeader.tsx

```tsx
'use client'
import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson56 } from './Lesson56Provider'

const CONFIG = {
  basePath: '/math/ny/2/7',
  emoji: '📐',
  titleShort: '讲次简称',
  titleFull: '探险',
  titleColor: 'text-sky-700',
  navActiveColor: 'text-sky-700',
  navActiveBorderColor: '#0369a1',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson56} />
}
```

顶栏由共享 `LessonAppHeader` 实现：课程列表 → `/math`、同年级讲次横滑/「更多」、用户区。

## 3–8. Sidebar / BottomNav / HomePage / FilterPanel / ProblemList / ProblemDetail

参考同年级最近一讲（二年级：`lesson56`）对应文件结构。

### 仅部分模块时

| 文件 | 调整 |
|------|------|
| `HomePage.tsx` | `MODULES` 只含有题模块；`desc` 写实际题号范围 |
| `Sidebar.tsx` | `sections` 去掉 homework/workbook 等空模块 |
| `FilterPanel.tsx` | `sourceBtns` 与 `typeBtns` 对齐实际题型 tag |
| `ProblemList.tsx` | `lessonId="{lessonKey}"`（如 `2-7`） |

### ProblemDetail

- **模板 A（数字答案）：** `QuestionLayout` + `LessonProblemDetailHeader` + `LessonProblemNavBar`
- **模板 B（交互谜题）：** 无数字 `finalAns` + [`figures.md`](figures.md)

### HomePage

- `MODULES` / 题型卡片链接前缀 = `BASE`
- `LessonSummary lessonId={lessonKey}`（如 `lessonKeyFromHref(BASE)!`）

---

## 主题色

AppHeader、Sidebar `activeClass`、BottomNav `activeColor`、FilterPanel `theme`、ProblemDetail 强调色 — **同一色系**。
