# 数学模块按年级组织 —— 设计稿

- 日期：2026-06-29
- 方案：Approach 1（显示/导航层组织，不迁移讲次路由）
- 状态：待实现

## 背景与问题

数学模块当前把所有讲次（12、13、15、18、23、29、30、34、35、36、37、38、39、40、
41、42、43、44、46、47，共 20 讲）在落地页 `apps/web/src/app/math/page.tsx` 里**平铺**，
仅按讲次排序，**没有按年级分类**。这些讲次目前全部属于**一年级**，**二年级**的讲次即将开始增加。

诉求：
1. 首页不再直接平铺讲次卡片，而是显示**年级卡片**；点进某个年级后再看到该年级的讲次。
2. 做题筛选（题海 / 组卷 / 每日计划）时能**按年级筛选**。
3. 一年级讲次显示**保留真实教材讲次号**（第 12 讲 … 第 47 讲，含空缺），不重排。

## 关键约束（低风险红线）

`apps/web/src/app/math/ny/**` 下有 **260 个讲次路由文件**（每讲约 12 个：`page`/`layout`/
`pretest`/`homework`/`lesson`/`workbook`/`mistakes`/`alltest` 及其 `[id]` 变体），且每讲的
`layout.tsx`/`page.tsx`/`basePath` 中**硬编码**了绝对路径 `/math/ny/1/35/...`（如 `getNextHref`、
`basePath="/math/ny/1/35/lesson"`）。讲次内部 ID 已**全局唯一**（12–47）。

因此本设计**绝不迁移、不改动这 260 个文件，也不改动任何 `/math/ny/NN` 硬编码路径**。
二年级新讲内部 ID **接着 48 往后排**（与 12–47 同样全局唯一，零冲突），仅在**显示层**呈现
为「二年级 第 1 讲」起的年级内编号。`href`（路由）与 `lectureNum`（显示串）本就是自由值，
无需新增字段即可实现「内部 ID 连续 / 显示从 1 数」。

## 总体架构

在讲次之上引入「年级」组织层，分三块：

1. **单一真相源** `LESSON_GRADE`：讲次 id → 年级，所有消费者引用它（杜绝多处各记一份）。
2. **导航重构**：首页 → 年级卡片 → 年级讲次列表页 → 进入讲次（旧路径不变）。
3. **年级作为筛选维度**：题海 / 组卷 / 每日计划的讲次选择器按年级分组、可整组选中。

数据流：`LESSON_GRADE` 与 `COURSES`（讲次卡片数据）位于 `@rosie/math`，被
`/math` 首页、`/math/ny/gN` 年级页、`/math/sea` 题海、组卷与计划选择器复用。

---

## 详细设计

### 0. 单一真相源：`packages/math/src/utils/lesson-grade.ts`（新增）

```ts
/** 讲次 id → 年级。新增讲次只需在此加 1 行。 */
export const LESSON_GRADE: Record<string, number> = {
  '12': 1, '13': 1, '15': 1, '18': 1, '23': 1, '29': 1, '30': 1, '34': 1,
  '35': 1, '36': 1, '37': 1, '38': 1, '39': 1, '40': 1, '41': 1, '42': 1,
  '43': 1, '44': 1, '46': 1, '47': 1,
  // 二年级（将来）：'48': 2, …
}

/** 年级数字 → 中文名。 */
export const GRADE_LABEL: Record<number, string> = { 1: '一年级', 2: '二年级', 3: '三年级' }

/** 有讲次的年级，升序。 */
export function gradesInOrder(): number[]

/** 某年级下的讲次 id 列表（按 LESSON_GRADE 出现顺序）。 */
export function lessonsForGrade(grade: number): string[]

/** 取某讲次的年级；未登记时返回 undefined。 */
export function gradeOf(lessonId: string): number | undefined
```

- **年级只在此定义一次**，符合项目「schema 对称性」原则。
- 派生工具 `gradesInOrder` / `lessonsForGrade` / `gradeOf` 供各消费者使用。

### 1. 课程数据外移：`packages/math/src/utils/courses-data.ts`（新增）

- 把当前内联在 `apps/web/src/app/math/page.tsx` 的 `courses: CourseCardData[]` 数组，
  原样抽到此文件导出为 `COURSES: CourseCardData[]`。
- **`CourseCardData` 不新增 `grade` 字段**：年级由 `LESSON_GRADE` 按 `href` 中的讲次 id 派生
  （`/math/ny/1/35` → `'35'` → `gradeOf('35')`），避免重复存储。
- 一年级各讲的 `lectureNum` **保持现状不变**（第 12 讲 … 第 47 讲）。

### 2. 首页改为年级卡片：`apps/web/src/app/math/page.tsx`（改）

- 顶部工具行（**每日一练 / 题海 / 组卷 / 课程地图** = `MathDailyCard` / `MathSeaCard` /
  `MathQuizCard` / `MathCatalogCard`）**保留**——它们是跨年级工具。
- 原讲次卡片列表 → 替换为**年级卡片网格**：`gradesInOrder()` 生成「一年级」「二年级」…
  每张 `GradeCard` 显示：年级名（`GRADE_LABEL`）、该年级讲数（`lessonsForGrade(g).length`，
  如「20 讲」）、playful 图标。
- 只渲染**有讲次的年级**：二年级暂无课 → 现在只显示「一年级」一张卡；加课后自动出现。
- 点击年级卡 → `href = '/math/ny/1'`（grade 2 → `/math/ny/2`）。

新组件 **`GradeCard`**（`packages/math/src/components/GradeCard.tsx`）：实现前先调用
`frontend-design` skill，走 playful、7 岁向风格；从 `index.ts` 暴露。

### 3. 年级讲次列表页：`apps/web/src/app/math/ny/1/page.tsx` 等（新增 · 薄壳）

- 为每个年级建**静态文件夹**：`apps/web/src/app/math/ny/1/page.tsx`、`/g2/page.tsx`…
  （用静态段，**不用动态 `[grade]`**，避免与现有讲次静态文件夹的静态/动态优先级纠缠）。
- 每个 page 是 3 行薄壳，渲染共享组件 `GradeLessonList grade={1}`。
- **`GradeLessonList`**（`packages/math/src/components/GradeLessonList.tsx`）：
  从 `COURSES` 按 `gradeOf(href 中的讲次 id) === grade` 过滤出本年级讲次，渲染**现有
  `CourseCard`**（顺序保持现状：最新讲次置顶）；带返回首页的入口与年级标题。
- 讲次卡 `href` 仍是 `/math/ny/1/35` —— **进入讲次的旧路径完全不变**。

### 4. `/math/ny` 重定向（改）

- `apps/web/src/app/math/ny/page.tsx` 当前 `redirect('/math/ny/1/35')` → 改为
  `redirect('/math')`（年级选择页），因为无年级地进入 `ny` 已无明确目标。

### 5. 题海按年级筛选：`apps/web/src/app/math/sea/page.tsx` + `sea-data.ts`（改）

- `SeaLessonMeta` 的年级取自 `LESSON_GRADE`（`gradeOf(id)`，不另存字段）。
- 题海筛选面板中，讲次 chip **按年级分组**：每组一个小标题「一年级」「二年级」，附该组
  「全选 / 全不选」切换。**点年级 = 选中该年级全部讲次** —— 即「按年级筛选」。
- 下游筛选/随机练逻辑（`selectedLessons: Set<string>`）**零改动**：分组只改变 chip 的
  组织与批量选中行为，仍写入同一个 `selectedLessons` 集合。

### 6. 组卷 / 每日计划按年级分组（改）

- **组卷弹窗** `apps/web/src/app/math/ny/quiz/page.tsx`：讲次选择器按 `LESSON_GRADE` 分组，
  每组带「全选」。
- **每日计划选项** `packages/math/src/components/MathWeeklyPractice.tsx`（及数据源
  `apps/web/src/app/math/ny/plan/page.tsx`）：讲次选择器同样按年级分组。
- 与题海一致：仅改选择器的组织与批量选中，所选讲次 id 的下游消费不变。

### 7. `add-lesson` 文档更新：`docs/add-new-lesson/registration.md`（改）

- 第四步从「改 `math/page.tsx`」改为：
  - 往 `packages/math/src/utils/courses-data.ts` 的 `COURSES` 数组最前面追加卡片对象；
  - 往 `packages/math/src/utils/lesson-grade.ts` 的 `LESSON_GRADE` 加 1 行 `'<id>': <grade>`。
- 增补约定说明：新讲属于哪个年级 → 在 `LESSON_GRADE` 设年级；若是新年级首讲，`lectureNum`
  从「第 1 讲」起，内部讲次 id 接着全局最大值 +1，并为该年级新增 `apps/web/src/app/math/ny/gN/page.tsx` 薄壳。
- 题海/组卷/计划三处注册点的**讲次条目仍照旧追加**；年级分组是自动派生的，无需额外登记。

---

## 不改动的部分（低风险来源）

- `apps/web/src/app/math/ny/**` 下 260 个讲次路由文件与其内部硬编码 `/math/ny/NN` 路径。
- 讲次内部逻辑、`sea-data` 的题目聚合、组卷/计划的下游消费逻辑。
- `CourseCardData` 类型形状（不加字段）。

## 组件/模块边界

| 单元 | 职责 | 依赖 |
|------|------|------|
| `lesson-grade.ts` | 讲次→年级真相源 + 派生工具 | 无 |
| `courses-data.ts` | 讲次卡片数据 `COURSES` | `@rosie/core` 类型 |
| `GradeCard` | 单张年级卡片（展示） | core 类型、ui |
| `GradeLessonList` | 某年级讲次列表（按 grade 过滤 COURSES，复用 CourseCard） | `courses-data`、`lesson-grade`、`CourseCard` |
| `/math` page | 工具行 + 年级卡网格 | `lesson-grade`、`GradeCard`、tool cards |
| `/math/ny/gN` page | 薄壳 → `GradeLessonList grade={N}` | `GradeLessonList` |
| 题海/组卷/计划筛选 | 讲次选择器按年级分组 | `lesson-grade` |

## 验收标准

- `/math` 显示年级卡片（当前仅「一年级 · 20 讲」），工具行保留；不再平铺讲次卡。
- 点「一年级」→ `/math/ny/1` 显示一年级 20 讲（讲次号保留真实值），点讲次进入 `/math/ny/NN` 正常。
- 题海筛选面板讲次按年级分组，可整组选中；筛选结果正确。
- 组卷弹窗、每日计划讲次选择器按年级分组。
- 新增一条 grade=2 的测试讲次时，「二年级」卡片自动出现且 `/math/ny/2` 正常列出。
- `pnpm --filter @rosie/math typecheck`、`pnpm --filter web build` 通过。

## 实现注意

- 任何新 UI 组件（`GradeCard`、`GradeLessonList`、各分组标题）实现前先调 `frontend-design`
  skill，保持 playful、7 岁向风格，避免通用 AI 美学。
- 新 `packages/math/src` 若产生新 JSX 文件目录，确认 `globals.css` 的 `@source` 已覆盖
  `packages/math/src`（既有覆盖即可，无需新增）。