# 注册清单（最易遗漏）

先确定 `lessonKey`（如 `2-8`），再派生 `grade`、`seq` 及全部路径。

---

## 0. lesson-registry.ts（最先）

```ts
{ lessonKey: '2-8', grade: 2, seq: 8 },
```

- 仅三字段，无 legacyId / slug
- 一年级：`seq` = 教材讲次号
- 二年级起：`seq` 年级内递增
- `lesson-grade.ts` 自动派生，无需手改

新年级：补 `GRADE_LABEL`（`lesson-grade.ts`）。

---

## 1. lesson-module-registry.ts

```ts
import { PROBLEMS as P2_8, TAG_STYLE as TS2_8 } from '@rosie/math/utils/g2/lesson8-data'
import Provider28, { useG2Lesson8 } from '@rosie/math/components/lesson/g2/lesson8/G2Lesson8Provider'
import HomePage28 from '@rosie/math/components/lesson/g2/lesson8/HomePage'
// … AppHeader / Sidebar / BottomNav / FilterPanel / ProblemList / ProblemDetail

'2-8': {
  PROBLEMS: P2_8,
  TAG_STYLE: TS2_8,
  Provider: Provider28,
  useLesson: useG2Lesson8,
  HomePage: HomePage28,
  // … 其余组件
  layoutBgClass: 'bg-[#f0f9ff]',
},
```

- **键 = lessonKey**（`'2-8'`）
- import 路径：`lesson/g{grade}/lesson{seq}/`、`g{grade}/lesson{seq}-data`
- import 别名自定；漏 `'2-8'` 条目 → `/math/ny/2/8` 404
- 注册完成后，分模块「开始练习」、综合题库练习、错题练习由共享 `PracticeQueue` 自动启用，**无需在此文件额外配置**（见 [`practice-queue.md`](practice-queue.md)）

---

## 2. courses-data.ts

```ts
{
  href: '/math/ny/2/8',
  title: '…',
  lectureNum: '第 8 讲',  // 年级内序号，不是 lessonKey 里的 8 以外的数字
  // …
},
```

---

## 3. sea-data.ts

```ts
import { PROBLEMS as PROBLEMS_2_8, PROBLEM_TYPES as PT2_8, TAG_STYLE as TS2_8 } from './g2/lesson8-data'

{
  id: '2-8',           // 必须 = lessonKey
  title: '第8讲·…',
  shortTitle: '8·…',
  types: PT2_8.map(...),
  problems: PROBLEMS_2_8,
  // …
},
```

- `types` 与题目 `tag` 一致，否则 admin 筛选为空
- 查讲次：`findSeaLesson('2-8')`

---

## 4. 每日计划

**plan/page.tsx** — `PROBLEM_SETS`：

```ts
'2-8': PROBLEMS_2_8,
```

**MathWeeklyPractice.tsx** — `LESSONS`：

```ts
{ id: '2-8', label: '第8讲 · …', /* … */ },
```

---

## 5. 组卷（quiz）

三处键均为 lessonKey：

```ts
// quiz/page.tsx LESSON_META
{ id: '2-8', name: '…', data: P2_8, types: PT2_8 },

// quiz/[id]/page.tsx & print — LESSON_DATA / LESSON_NAMES
'2-8': P2_8,
'2-8': '…',
```

---

## 6. lesson-source-btns.ts

```ts
'2-8': [
  { key: 'lesson', label: '📖 课堂' },
  { key: 'supplement', label: '📒 附加' },
],
```

---

## 核对表

```
[ ] docs/math/lessons/2-8.md
[ ] utils/g2/lesson8-data.ts(x)
[ ] components/lesson/g2/lesson8/*
[ ] lesson-registry.ts
[ ] lesson-module-registry.ts       — 键 '2-8'
[ ] courses-data.ts
[ ] sea-data.ts                     — id '2-8'
[ ] lesson-source-btns.ts
[ ] plan/page.tsx
[ ] MathWeeklyPractice.tsx
[ ] quiz/page.tsx
[ ] quiz/[id]/page.tsx
[ ] quiz/[id]/print/page.tsx
[ ] 连续练习：pretest / alltest / mistakes 页「开始练习」正常（见 practice-queue.md）
```
