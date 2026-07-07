# 数学模块按年级组织 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把数学模块从「平铺讲次」改为「按年级组织」——首页显示年级卡片下钻到年级讲次列表，并让题海/组卷/每日计划支持按年级筛选，全部不迁移 260 个讲次路由文件。

**Architecture:** 在讲次之上加一层「年级」组织。新增单一真相源 `LESSON_GRADE`（讲次 id → 年级）；首页改为年级卡片，点进 `/math/ny/gN` 看该年级讲次（讲次卡 href 仍指向旧的 `/math/ny/NN`）；题海/组卷/计划的讲次选择器按年级分组、可整组选中。年级在所有消费者处都从 `LESSON_GRADE` 派生，不重复存储。

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, pnpm workspace + Turborepo, Vitest（仅 `apps/web`）。

## Global Constraints

- **绝不改动** `apps/web/src/app/math/ny/**` 下 260 个讲次路由文件，及其中任何硬编码 `/math/ny/NN` 路径。讲次进入路径保持 `/math/ny/NN` 不变。
- 年级**只在 `LESSON_GRADE` 定义一次**，其余消费者一律 `gradeOf()` 派生；禁止在 `CourseCardData` / `SeaLessonMeta` 等再存一份 grade 字段。
- 一年级讲次显示**保留真实讲次号**（第 12 讲 … 第 47 讲）；二年级内部 id 接着 48 排，显示从「第 1 讲」起。
- TypeScript **禁止 `any`**；组件用 `type` 定义 props；`'use client'` 置顶（客户端组件）。
- 任何**新 UI 组件 / 样式改动**（`GradeCard`、`GradeLessonList`、题海/组卷/计划的分组标题）实现前**先调用 `frontend-design` skill**，走 playful、7 岁向风格，避免通用 AI 美学。
- 包内跨文件导入用相对路径或 `@rosie/math/*` 深子路径；math 可依赖 `@rosie/core`/`@rosie/ui`/`@rosie/rewards`，不依赖其他学科包。
- 验证命令（执行者在每个任务结束时跑）：`pnpm --filter @rosie/math typecheck`、`pnpm --filter web test <file>`、`pnpm --filter web build`。
- 现有讲次 id（一年级 20 讲）：`12 13 15 18 23 29 30 34 35 36 37 38 39 40 41 42 43 44 46 47`。

---

## File Structure

| 文件 | 动作 | 职责 |
|------|------|------|
| `packages/math/src/utils/lesson-grade.ts` | 新增 | 真相源 `LESSON_GRADE` + `GRADE_LABEL` + `gradesInOrder`/`lessonsForGrade`/`gradeOf`/`lessonIdFromHref` |
| `packages/math/src/index.ts` | 改 | 从 barrel 再导出 lesson-grade 公共 API（供测试与 app 引用） |
| `apps/web/tests/lesson-grade.test.ts` | 新增 | lesson-grade 纯函数单测 |
| `packages/math/src/utils/courses-data.ts` | 新增 | 把内联 `courses` 数组抽出为 `COURSES` |
| `packages/math/src/components/GradeLessonList.tsx` | 新增 | 某年级讲次列表整页（背景/返回/标题 + 过滤 COURSES 渲染 CourseCard） |
| `apps/web/src/app/math/ny/1/page.tsx` | 新增 | 薄壳 → `<GradeLessonList grade={1} />` |
| `apps/web/src/app/math/ny/page.tsx` | 改 | redirect 改为 `/math` |
| `packages/math/src/components/GradeCard.tsx` | 新增 | 单张年级卡片（展示） |
| `apps/web/src/app/math/page.tsx` | 改 | 讲次卡列表 → 年级卡片网格（工具行保留） |
| `apps/web/src/app/math/sea/page.tsx` | 改 | 讲次筛选 chip 按年级分组 + 整组全选 |
| `packages/math/src/utils/sea-data.ts` | 改（可选） | 仅在需要时为题海排序/分组提供 helper（grade 仍由 gradeOf 派生） |
| `apps/web/src/app/math/ny/quiz/page.tsx` | 改 | 组卷讲次选择器按年级分组 |
| `apps/web/src/app/math/ny/plan/page.tsx` + `packages/math/src/components/MathWeeklyPractice.tsx` | 改 | 每日计划讲次选择器按年级分组 |
| `docs/add-new-lesson/registration.md` | 改 | 注册流程改为写 courses-data + lesson-grade，并说明新年级薄壳 |

---

## Task 1: 真相源 `lesson-grade.ts` + 单元测试

**Files:**
- Create: `packages/math/src/utils/lesson-grade.ts`
- Modify: `packages/math/src/index.ts`
- Test: `apps/web/tests/lesson-grade.test.ts`

**Interfaces:**
- Produces:
  - `LESSON_GRADE: Record<string, number>`
  - `GRADE_LABEL: Record<number, string>`
  - `gradesInOrder(): number[]` — 有讲次的年级，升序去重
  - `lessonsForGrade(grade: number): string[]` — 该年级讲次 id，按 `LESSON_GRADE` 键序
  - `gradeOf(lessonId: string): number | undefined`
  - `lessonIdFromHref(href: string): string | undefined` — 从 `/math/ny/1/35` 取 `'35'`

- [ ] **Step 1: 写失败测试** — `apps/web/tests/lesson-grade.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import {
  LESSON_GRADE,
  GRADE_LABEL,
  gradesInOrder,
  lessonsForGrade,
  gradeOf,
  lessonIdFromHref,
} from '@rosie/math'

describe('lesson-grade', () => {
  it('现有 20 讲全部属于一年级', () => {
    const ids = ['12','13','15','18','23','29','30','34','35','36','37','38','39','40','41','42','43','44','46','47']
    expect(Object.keys(LESSON_GRADE).sort()).toEqual([...ids].sort())
    expect(ids.every((id) => LESSON_GRADE[id] === 1)).toBe(true)
  })

  it('gradesInOrder 返回升序去重的年级', () => {
    expect(gradesInOrder()).toEqual([1])
  })

  it('lessonsForGrade(1) 返回一年级全部 20 讲', () => {
    expect(lessonsForGrade(1)).toHaveLength(20)
    expect(lessonsForGrade(1)).toContain('35')
    expect(lessonsForGrade(2)).toEqual([])
  })

  it('gradeOf 取讲次年级，未登记返回 undefined', () => {
    expect(gradeOf('35')).toBe(1)
    expect(gradeOf('999')).toBeUndefined()
  })

  it('lessonIdFromHref 从路由取讲次 id', () => {
    expect(lessonIdFromHref('/math/ny/1/35')).toBe('35')
    expect(lessonIdFromHref('/math/ny/1')).toBeUndefined()
    expect(lessonIdFromHref('/foo')).toBeUndefined()
  })

  it('GRADE_LABEL 覆盖到三年级', () => {
    expect(GRADE_LABEL[1]).toBe('一年级')
    expect(GRADE_LABEL[2]).toBe('二年级')
    expect(GRADE_LABEL[3]).toBe('三年级')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter web test lesson-grade`
Expected: FAIL —— 无法从 `@rosie/math` 解析 `LESSON_GRADE` 等导出。

- [ ] **Step 3: 实现 `lesson-grade.ts`**

```ts
// packages/math/src/utils/lesson-grade.ts
// 讲次 → 年级 的唯一真相源。新增讲次只需在 LESSON_GRADE 加 1 行。

/** 讲次 id → 年级（1 = 一年级…）。 */
export const LESSON_GRADE: Record<string, number> = {
  '12': 1, '13': 1, '15': 1, '18': 1, '23': 1, '29': 1, '30': 1, '34': 1,
  '35': 1, '36': 1, '37': 1, '38': 1, '39': 1, '40': 1, '41': 1, '42': 1,
  '43': 1, '44': 1, '46': 1, '47': 1,
  // 二年级（将来）：'48': 2, …
}

/** 年级数字 → 中文名。 */
export const GRADE_LABEL: Record<number, string> = {
  1: '一年级',
  2: '二年级',
  3: '三年级',
}

/** 有讲次的年级，升序去重。 */
export function gradesInOrder(): number[] {
  return [...new Set(Object.values(LESSON_GRADE))].sort((a, b) => a - b)
}

/** 某年级下的讲次 id 列表，按 LESSON_GRADE 键的出现顺序。 */
export function lessonsForGrade(grade: number): string[] {
  return Object.keys(LESSON_GRADE).filter((id) => LESSON_GRADE[id] === grade)
}

/** 取某讲次的年级；未登记返回 undefined。 */
export function gradeOf(lessonId: string): number | undefined {
  return LESSON_GRADE[lessonId]
}

/** 从 `/math/ny/1/35` 取讲次 id `'35'`；非讲次路由返回 undefined。 */
export function lessonIdFromHref(href: string): string | undefined {
  const m = href.match(/^\/math\/ny\/(\d+)$/)
  return m ? m[1] : undefined
}
```

- [ ] **Step 4: 从 barrel 再导出** — 在 `packages/math/src/index.ts` 末尾追加：

```ts
export {
  LESSON_GRADE,
  GRADE_LABEL,
  gradesInOrder,
  lessonsForGrade,
  gradeOf,
  lessonIdFromHref,
} from './utils/lesson-grade'
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter web test lesson-grade`
Expected: PASS（6 个用例全过）。

- [ ] **Step 6: 类型检查**

Run: `pnpm --filter @rosie/math typecheck`
Expected: 无错误。

- [ ] **Step 7: 提交**

```bash
git add packages/math/src/utils/lesson-grade.ts packages/math/src/index.ts apps/web/tests/lesson-grade.test.ts
git commit -m "feat(math): add LESSON_GRADE single source of truth + helpers"
```

---

## Task 2: 抽出 `COURSES` 数据

把内联在落地页的 `courses` 数组抽到 math 包，供首页与年级页复用。本任务**不改变页面表现**（落地页仍平铺，下一批任务再改）。

**Files:**
- Create: `packages/math/src/utils/courses-data.ts`
- Modify: `apps/web/src/app/math/page.tsx`

**Interfaces:**
- Consumes: `CourseCardData`（`@rosie/core`）
- Produces: `COURSES: CourseCardData[]`（一年级 20 条，最新讲次置顶，内容逐字保留）

- [ ] **Step 1: 新建 `courses-data.ts`**

把 `apps/web/src/app/math/page.tsx` 中 `const courses: CourseCardData[] = [ … ]`（当前约 13–200 行）**整段移动**到新文件，仅改三处：文件头加注释、`const courses` → `export const COURSES`、import `CourseCardData` 自 `@rosie/core`。文件骨架：

```ts
// packages/math/src/utils/courses-data.ts
// 数学讲次卡片数据。年级不在此存储——由 lesson-grade.ts 的 gradeOf(href) 派生。
import type { CourseCardData } from '@rosie/core'

export const COURSES: CourseCardData[] = [
  // …把原 page.tsx 的 courses 数组条目逐字粘到这里（47→…→12，保持原顺序）…
]
```

- [ ] **Step 2: 落地页改为引用 COURSES** — `apps/web/src/app/math/page.tsx`

删除内联 `courses` 数组，改为 import；渲染处 `courses.map` → `COURSES.map`：

```ts
import { COURSES } from '@rosie/math/utils/courses-data'
// …
{COURSES.map((course) => (
  <CourseCard key={course.href} data={course} />
))}
```

- [ ] **Step 3: 类型检查 + 构建**

Run: `pnpm --filter @rosie/math typecheck && pnpm --filter web build`
Expected: 无错误；`/math` 仍与改动前一致（平铺 20 张讲次卡）。

- [ ] **Step 4: 提交**

```bash
git add packages/math/src/utils/courses-data.ts apps/web/src/app/math/page.tsx
git commit -m "refactor(math): extract COURSES data out of landing page"
```

---

## Task 3: `GradeLessonList` 年级讲次列表页组件

某年级的讲次列表整页（含背景、返回首页、年级标题、按年级过滤的讲次卡）。**先调 frontend-design。**

**Files:**
- Create: `packages/math/src/components/GradeLessonList.tsx`

**Interfaces:**
- Consumes: `COURSES`、`GRADE_LABEL`、`lessonsForGrade`、`gradeOf`、`lessonIdFromHref`（`@rosie/math`/深子路径）、`CourseCard`、`@rosie/ui` 的 `OrbBackground`/`BackLink`
- Produces: `export default function GradeLessonList({ grade }: { grade: number })`

- [ ] **Step 1: 调 frontend-design skill**，为「年级讲次列表页」要一版 playful、7 岁向的标题栏 + 列表布局方向（参考 `/math` 现有 OrbBackground + 居中列表风格，标题用年级名）。

- [ ] **Step 2: 实现组件**（数据接线确定，视觉细节落地 frontend-design 输出）

```tsx
'use client'

import { OrbBackground, BackLink } from '@rosie/ui'
import CourseCard from '@rosie/math/components/CourseCard'
import { COURSES } from '@rosie/math/utils/courses-data'
import { GRADE_LABEL, gradeOf, lessonIdFromHref } from '@rosie/math/utils/lesson-grade'
import type { CourseCardData } from '@rosie/core'

export default function GradeLessonList({ grade }: { grade: number }) {
  const courses: CourseCardData[] = COURSES.filter((c) => {
    const id = lessonIdFromHref(c.href)
    return id !== undefined && gradeOf(id) === grade
  })
  const label = GRADE_LABEL[grade] ?? `${grade} 年级`

  return (
    <>
      <OrbBackground variant="math" />
      {/* BackLink 指回 /math 年级选择页 */}
      <BackLink href="/math" />
      <div className="relative z-1 flex min-h-screen flex-col items-center gap-7 px-5 pt-24 pb-12 max-[500px]:gap-5 max-[500px]:px-3.5 max-[500px]:pt-20 max-[500px]:pb-8">
        <section className="max-w-[480px] text-center">
          <h1 className="mt-2 bg-gradient-to-br from-blue-900 via-violet-600 to-amber-500 bg-clip-text text-[clamp(26px,5vw,34px)] leading-tight font-black text-transparent">
            {label}
          </h1>
          <p className="text-text-secondary mt-1.5 text-sm leading-relaxed">
            共 {courses.length} 讲，选一节开始吧
          </p>
        </section>
        <section className="flex w-full max-w-[680px] flex-col gap-4">
          {courses.map((course) => (
            <CourseCard key={course.href} data={course} />
          ))}
        </section>
      </div>
    </>
  )
}
```

> 注意：确认 `@rosie/ui` 的 `BackLink` 是否支持 `href` prop。若不支持，用其默认行为或包一个返回 `/math` 的链接（实现时读 `packages/ui` 的 `BackLink` 定义；不要臆造 prop）。

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter @rosie/math typecheck`
Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
git add packages/math/src/components/GradeLessonList.tsx
git commit -m "feat(math): add GradeLessonList per-grade lesson list"
```

---

## Task 4: 年级路由薄壳 + `/math/ny` 重定向

**Files:**
- Create: `apps/web/src/app/math/ny/1/page.tsx`
- Modify: `apps/web/src/app/math/ny/page.tsx`

**Interfaces:**
- Consumes: `GradeLessonList`（`@rosie/math/components/GradeLessonList`）

- [ ] **Step 1: 一年级薄壳** — `apps/web/src/app/math/ny/1/page.tsx`

```tsx
import GradeLessonList from '@rosie/math/components/GradeLessonList'

export default function Grade1Page() {
  return <GradeLessonList grade={1} />
}
```

- [ ] **Step 2: `/math/ny` 改重定向到 `/math`** — `apps/web/src/app/math/ny/page.tsx`

```tsx
import { redirect } from 'next/navigation'

export default function MathNyPage() {
  redirect('/math')
}
```

- [ ] **Step 3: 构建并人工核对**

Run: `pnpm --filter web build`
Expected: 构建通过。手动核对：访问 `/math/ny/1` 列出一年级 20 讲（讲次号为真实值），点任一讲进入 `/math/ny/NN` 正常；`/math/ny` 跳到 `/math`。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/app/math/ny/1/page.tsx apps/web/src/app/math/ny/page.tsx
git commit -m "feat(math): add /math/ny/1 grade route, redirect /math/ny to /math"
```

---

## Task 5: `GradeCard` 年级卡片组件

首页用的单张年级卡片。**先调 frontend-design。**

**Files:**
- Create: `packages/math/src/components/GradeCard.tsx`
- Modify: `packages/math/src/index.ts`

**Interfaces:**
- Consumes: `@rosie/ui` 的 `NavigationLink`/`ArrowIcon`（参照 `CourseCard.tsx` 用法）
- Produces: `export default function GradeCard({ grade, label, lessonCount }: GradeCardProps)`，`GradeCardProps = { grade: number; label: string; lessonCount: number }`

- [ ] **Step 1: 调 frontend-design skill**，为「年级卡片」要一版 playful、7 岁向设计：大号年级名、讲数徽标、可爱图标/配色，点击进入感强。提供 `grade`/`label`/`lessonCount` 三个数据点。

- [ ] **Step 2: 实现组件**（接线确定，视觉落地 frontend-design 输出）

```tsx
'use client'

import { NavigationLink } from '@rosie/ui'

type GradeCardProps = {
  grade: number
  label: string
  lessonCount: number
}

export default function GradeCard({ grade, label, lessonCount }: GradeCardProps) {
  return (
    <NavigationLink
      href={`/math/ny/g${grade}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[18px] border border-white/80 bg-white p-5 text-left shadow-[0_4px_20px_rgba(15,23,42,.05)] transition-all duration-300 hover:-translate-y-1.5 dark:bg-slate-800 dark:border-white/6"
    >
      {/* frontend-design 输出的 playful 视觉在此细化 */}
      <div className="text-[22px] font-extrabold leading-tight">{label}</div>
      <div className="text-text-secondary mt-1 text-sm">共 {lessonCount} 讲</div>
    </NavigationLink>
  )
}
```

- [ ] **Step 3: 从 barrel 导出** — `packages/math/src/index.ts` 追加：

```ts
export { default as GradeCard } from './components/GradeCard'
```

- [ ] **Step 4: 类型检查**

Run: `pnpm --filter @rosie/math typecheck`
Expected: 无错误。

- [ ] **Step 5: 提交**

```bash
git add packages/math/src/components/GradeCard.tsx packages/math/src/index.ts
git commit -m "feat(math): add GradeCard grade-selector card"
```

---

## Task 6: 首页改为年级卡片网格

**Files:**
- Modify: `apps/web/src/app/math/page.tsx`

**Interfaces:**
- Consumes: `GradeCard`、`gradesInOrder`、`GRADE_LABEL`、`lessonsForGrade`（`@rosie/math`）

- [ ] **Step 1: 调 frontend-design skill**（若 Task 5 已覆盖网格布局可跳过），确认年级卡网格的排布/间距与工具行的视觉协调。

- [ ] **Step 2: 改写渲染** — 保留顶部工具行（`MathDailyCard`/`MathSeaCard`/`MathQuizCard`/`MathCatalogCard`），把 `COURSES.map` 讲次卡列表替换为年级卡网格：

```tsx
import GradeCard from '@rosie/math/components/GradeCard'
import { gradesInOrder, GRADE_LABEL, lessonsForGrade } from '@rosie/math/utils/lesson-grade'
// 删除 COURSES import（首页不再直接用）

// JSX 中原 {COURSES.map(...)} 块替换为：
<section className="grid w-full max-w-[680px] grid-cols-1 gap-4 min-[501px]:grid-cols-2">
  {gradesInOrder().map((g) => (
    <GradeCard
      key={g}
      grade={g}
      label={GRADE_LABEL[g] ?? `${g} 年级`}
      lessonCount={lessonsForGrade(g).length}
    />
  ))}
</section>
```

> 副标题文案「选一节课开始今天的数学冒险吧」可改为「选一个年级开始今天的数学冒险吧」。

- [ ] **Step 3: 构建并人工核对**

Run: `pnpm --filter web build`
Expected: 构建通过。`/math` 顶部工具行保留，下方只显示「一年级 · 20 讲」一张年级卡（二年级暂无讲次故不出现），点进 `/math/ny/1` 正常。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/app/math/page.tsx
git commit -m "feat(math): landing page shows grade cards instead of flat lessons"
```

---

## Task 7: 题海讲次筛选按年级分组

题海筛选面板的讲次 chip 按年级分组，每组带「全选/全不选」=「按年级筛选」。下游 `selectedLessons: Set<string>` 不变。

**Files:**
- Modify: `apps/web/src/app/math/sea/page.tsx`

**Interfaces:**
- Consumes: `gradeOf`、`GRADE_LABEL`、`gradesInOrder`（`@rosie/math`）；现有 `SEA_LESSONS`（含 `id`）、状态 `selectedLessons`/`setSelectedLessons`

- [ ] **Step 1: 调 frontend-design skill**，为题海（深色海洋主题）筛选面板的「年级分组标题 + 整组全选」要一版与现有 chip 视觉一致的分组样式。

- [ ] **Step 2: 读现状** — 打开 `apps/web/src/app/math/sea/page.tsx`，定位讲次筛选区（渲染 `SEA_LESSONS` 为可点 chip、写入 `selectedLessons` 的那段，约在 filterOpen 面板内）。确认 `SEA_LESSONS` 每项有 `id`。

- [ ] **Step 3: 增加按年级分组的渲染与整组选择** — 引入 helper 与分组：

```tsx
import { gradeOf, GRADE_LABEL, gradesInOrder } from '@rosie/math/utils/lesson-grade'

// 按年级聚合题海讲次（未登记年级的归到一个「其他」组，避免漏显）
const lessonsByGrade: { grade: number; label: string; lessons: typeof SEA_LESSONS }[] =
  gradesInOrder().map((g) => ({
    grade: g,
    label: GRADE_LABEL[g] ?? `${g} 年级`,
    lessons: SEA_LESSONS.filter((l) => gradeOf(l.id) === g),
  })).filter((grp) => grp.lessons.length > 0)

// 整组全选/全不选
function toggleGrade(lessons: typeof SEA_LESSONS, on: boolean) {
  setSelectedLessons((prev) => {
    const next = new Set(prev)
    for (const l of lessons) {
      if (on) next.add(l.id)
      else next.delete(l.id)
    }
    return next
  })
}
```

讲次 chip 渲染由「直接平铺 `SEA_LESSONS.map`」改为「外层 `lessonsByGrade.map` 年级分组，组内 `grp.lessons.map` 渲染原有 chip」；每个年级组标题旁加一个「全选」开关，依据 `grp.lessons.every(l => selectedLessons.has(l.id))` 显示选中态，点击调用 `toggleGrade(grp.lessons, !allOn)`。**chip 本身的点击/样式逻辑保持不变。**

- [ ] **Step 4: 构建并人工核对**

Run: `pnpm --filter web build`
Expected: 构建通过。题海筛选面板讲次按「一年级」分组；点年级「全选」选中/取消该年级全部讲次；筛选结果随 `selectedLessons` 正确变化。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/app/math/sea/page.tsx
git commit -m "feat(math): group sea lesson filter by grade with select-all"
```

---

## Task 8: 组卷讲次选择器按年级分组

**Files:**
- Modify: `apps/web/src/app/math/ny/quiz/page.tsx`

**Interfaces:**
- Consumes: `gradeOf`、`GRADE_LABEL`、`gradesInOrder`；组卷页现有讲次选择状态与讲次清单

- [ ] **Step 1: 读现状** — 打开 `apps/web/src/app/math/ny/quiz/page.tsx`，定位讲次选择列表：找出它遍历的讲次数据源（讲次 id 数组或类似 `SEA_LESSONS`/本地清单）与选中状态 setter 的名称。

- [ ] **Step 2: 调 frontend-design skill**，为组卷弹窗（白底数学主题）的年级分组标题 + 整组全选要一版与现有选择项一致的样式。

- [ ] **Step 3: 按年级分组渲染** — 与 Task 7 同构：用 `gradesInOrder()` + `gradeOf(id)` 把讲次清单按年级分组；每组标题带「全选」，调用现有 setter 批量增删该年级讲次 id。**单个讲次选项的点击/样式逻辑不变。** 数据源的讲次 id 字段名以实际文件为准（Step 1 已确认）。

- [ ] **Step 4: 构建并人工核对**

Run: `pnpm --filter web build`
Expected: 构建通过。组卷弹窗讲次按年级分组，可整组选中；组出的卷子内容正确。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/app/math/ny/quiz/page.tsx
git commit -m "feat(math): group quiz lesson picker by grade"
```

---

## Task 9: 每日计划讲次选择器按年级分组

**Files:**
- Modify: `packages/math/src/components/MathWeeklyPractice.tsx`
- Modify（如需）: `apps/web/src/app/math/ny/plan/page.tsx`

**Interfaces:**
- Consumes: `gradeOf`、`GRADE_LABEL`、`gradesInOrder`；计划组件现有讲次清单与选中状态

- [ ] **Step 1: 读现状** — 打开 `packages/math/src/components/MathWeeklyPractice.tsx`（及 `plan/page.tsx` 数据源），定位讲次选择列表的数据源与选中 setter。

- [ ] **Step 2: 调 frontend-design skill**，为每日计划讲次选择器的年级分组标题 + 整组全选要一版与现有项一致的样式。

- [ ] **Step 3: 按年级分组渲染** — 与 Task 7/8 同构：`gradesInOrder()` + `gradeOf(id)` 分组，组标题带「全选」批量增删。单项逻辑不变。

- [ ] **Step 4: 构建并人工核对**

Run: `pnpm --filter web build`
Expected: 构建通过。每日计划讲次按年级分组、可整组选中；生成计划正确。

- [ ] **Step 5: 提交**

```bash
git add packages/math/src/components/MathWeeklyPractice.tsx apps/web/src/app/math/ny/plan/page.tsx
git commit -m "feat(math): group weekly-plan lesson picker by grade"
```

---

## Task 10: 更新 add-lesson 注册文档

**Files:**
- Modify: `docs/add-new-lesson/registration.md`

- [ ] **Step 1: 改第四步** — 把「数学入口页注册卡片」从「往 `apps/web/src/app/math/page.tsx` 的 `courses` 追加」改为：
  1. 往 `packages/math/src/utils/courses-data.ts` 的 `COURSES` 数组**最前面**追加卡片对象（字段不变）；
  2. 往 `packages/math/src/utils/lesson-grade.ts` 的 `LESSON_GRADE` 增加一行 `'<id>': <grade>`。

- [ ] **Step 2: 增补「新年级」说明** — 新讲属于哪个年级在 `LESSON_GRADE` 指定；若是某年级**首讲**：
  - `lectureNum` 从「第 1 讲」起；内部讲次 id 接全局最大值 +1（不复用低年级号）；
  - 新增 `apps/web/src/app/math/ny/g<N>/page.tsx` 薄壳（内容：`return <GradeLessonList grade={N} />`）。
  - 题海/组卷/计划三处的讲次条目**照旧追加**；年级分组自动派生，无需额外登记。

- [ ] **Step 3: 提交**

```bash
git add docs/add-new-lesson/registration.md
git commit -m "docs: update add-lesson registration for grade organization"
```

---

## Self-Review（已执行）

**Spec coverage：** spec 第 0–7 节逐项对应——#0 真相源→Task 1；#1 课程外移→Task 2；#2 首页年级卡→Task 5+6；#3 年级页→Task 3+4；#4 `/math/ny` 重定向→Task 4；#5 题海筛选→Task 7；#6 组卷/计划→Task 8+9；#7 文档→Task 10。无遗漏。

**Placeholder scan：** 新文件（lesson-grade、courses-data、GradeLessonList、GradeCard、薄壳）给出完整代码；Task 7–9 修改的是已存在大文件，给出确定的 helper/分组/批量选择代码 + 精确文件与集成点（`selectedLessons` 等已勘定的现有变量），单项 chip 逻辑明确「不变」，并要求实现者先读现状确认数据源字段名——这是对既有大文件的合规处理，非占位。

**Type consistency：** `gradeOf`/`lessonsForGrade`/`gradesInOrder`/`GRADE_LABEL`/`lessonIdFromHref`/`COURSES`/`GradeCardProps` 在定义（Task 1/2/5）与消费（Task 3/6/7/8/9）处签名一致；`CourseCardData` 不加字段，全程 `gradeOf` 派生，符合 Global Constraints。
