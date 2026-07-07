# 注册清单（最易遗漏）

按顺序执行。`N` = legacyId（如 52），先确定 `grade`、`seq`、`lessonKey`、`slug`。

---

## 0. lesson-registry.ts（最先）

`packages/math/src/utils/lesson-registry.ts` → `LESSON_ENTRIES` 追加：

```ts
{ lessonKey: '2-7', grade: 2, seq: 7, legacyId: '56', slug: 'lesson56' },
```

规则：

- **一年级**：`seq` = 教材讲次号（可与 legacyId 相同，如 `1-46`）
- **二年级起**：`seq` 在该年级内从 1 递增
- `lesson-grade.ts` 的 `LESSON_GRADE` **自动**从本表生成，无需手改

新年级：在 `GRADE_LABEL`（`lesson-grade.ts`）补 `{ 3: '三年级' }` 等。

---

## 1. lesson-module-registry.ts

1. 顶部 import：`PROBLEMS`、`TAG_STYLE`、Provider、8 个组件（与现有 lesson52 块相同模式）
2. `LESSON_MODULES` 追加 `lesson56: { slug, legacyId, PROBLEMS, … layoutBgClass }`

`resolveLessonRoute(grade, seq)` 靠 `entry.slug` 查此表；漏注册会导致 `/math/ny/2/7` 404。

---

## 2. courses-data.ts

`COURSES` **最前面**追加卡片（高年级/新讲次靠前）：

```ts
{
  href: '/math/ny/2/7',
  lectureNum: '第 7 讲',
  title: '…探险',
  icon: '📐',
  // …
}
```

`href` 必须是 canonical 路径。`lectureNum`：一年级可用教材号；二年级起用年级内序号。

---

## 3. sea-data.ts

`SEA_LESSONS` 追加一项。`id` 字段目前仍用 **legacyId 字符串**（如 `'56'`），与题海/组卷筛选一致：

```ts
{
  id: '56',
  title: '第56讲·…',
  shortTitle: '56·…',
  icon: '📐',
  badgeClass: '…',
  tagStyle: TS56,
  types: PT56.map(...),
  problems: PROBLEMS56,
},
```

并添加对应 `import { PROBLEMS as PROBLEMS56, … } from './lesson56-data'`。

---

## 4. 每日计划

### A. `apps/web/src/app/math/ny/plan/page.tsx`

`PROBLEM_SETS`（或等价结构）追加 legacyId → `PROBLEMS` 映射。

### B. `packages/math/src/components/MathWeeklyPractice.tsx`

`LESSONS` 数组追加 legacyId 字符串。

---

## 5. 组卷（quiz）

### A. `apps/web/src/app/math/ny/quiz/page.tsx` — `LESSON_META`

```ts
{ id: '56', name: '…', data: P56, types: PT56 },
```

### B. `apps/web/src/app/math/ny/quiz/[id]/page.tsx` — `LESSON_DATA` / `LESSON_NAMES`

### C. `apps/web/src/app/math/ny/quiz/[id]/print/page.tsx` — `LESSON_DATA`

组卷侧 `id` 暂仍为 **legacyId**；题目 ID 在数据层已用 lessonKey 前缀即可。

---

## 6. 不必再做的旧步骤

- ~~`lesson-grade.ts` 手改 `LESSON_GRADE[N]`~~（自动派生）
- ~~新建 `apps/web/src/app/math/ny/gN/page.tsx`~~（已有 `[grade]/page.tsx`）
- ~~新建 `apps/web/src/app/math/ny/N/**` 路由树~~

---

## 核对表

```
[ ] lesson-registry.ts
[ ] lesson-module-registry.ts
[ ] lessonN-data.ts(x)
[ ] components/lessonN/*（含 navigation 中的 basePath）
[ ] courses-data.ts
[ ] sea-data.ts
[ ] plan/page.tsx
[ ] MathWeeklyPractice.tsx
[ ] quiz/page.tsx
[ ] quiz/[id]/page.tsx
[ ] quiz/[id]/print/page.tsx
```
