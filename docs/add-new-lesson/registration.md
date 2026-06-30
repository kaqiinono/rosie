# 注册到入口页（必读 · 最易遗漏）

> 第四~七步只是往若干硬编码清单里追加条目。**任何一处遗漏都不会报错**，
> 但新讲次会在对应入口「静默消失」。完成后逐项核对本文件。

---

## 年级登记（第四步 · 必先确认）

每新增一讲须写入 `lesson-grade.ts` 登记年级（首页年级卡、年级页、题海/组卷/计划分组、进度统计均由此派生）。

### 默认年级

`lessons/N.md` **未写明年级**时 → 使用 `gradeForNewLesson()`，即 **`highestGrade()`**（`LESSON_GRADE` 中已有讲次的最高年级；无讲次时为 `1`）。  
例：当前已有一年级 + 二年级讲次时，新讲默认归入**二年级**。

### 决策规则

| 情况 | 内部 id | `LESSON_GRADE` | `lectureNum`（courses-data） | 题海 shortTitle | 每日计划 label |
|------|---------|----------------|------------------------------|-----------------|----------------|
| 继续一年级 | 沿用教材讲次号（如 50 若教材有） | `'50': 1` | `第 50 讲` | `50·简称` | `第50讲 · 主题` |
| 升入二年级等新年级 | **全局最大值 +1**（如 49→50） | `'50': 2` | `第 2 讲`（年级内序号） | `2·简称` | `第2讲 · 主题` |
| 同年级后续讲 | 全局 +1 | `'51': 2` | `第 3 讲` | `3·简称` | `第3讲 · 主题` |

**铁律：**
- 内部 id（路由 `/math/ny/N`）**全局唯一**，不复用低年级号。
- 年级**只**在 `LESSON_GRADE` 定义一次；`CourseCardData` **不加** `grade` 字段。
- 一年级保留真实教材讲次号；**二年级起**用户可见编号从「第 1 讲」起（用 `lessonDisplayLabel()` 辅助组卷等 UI）。
- 题目源 `docs/math/lessons/N.md` 标题下**建议**写 `年级：N`；未写则默认最高年级（见上）

### 自动派生（登记后无需手改）

| 功能 | 数据来源 |
|------|----------|
| 首页年级卡片 / 讲数 | `gradesForLanding()` + `lessonsForGrade()` |
| 年级卡课程简介 | `gradeCourseSummary()` ← `COURSES` |
| 年级卡 已练/总题数 | `gradeProblemStats()` ← `SEA_POOL` + `math_solved` |
| 题海/组卷/计划年级分组 | `gradesInOrder()` + `gradeOf(id)` |

### 新年级首讲额外一步

若 `LESSON_GRADE` 中该年级**尚无**其他讲次 → 新建 `apps/web/src/app/math/ny/g<N>/page.tsx` 薄壳（见第四步 C）。

---

涉及文件总览：

| 步骤 | 文件 | 作用 | 遗漏后果 |
|------|------|------|----------|
| 四-A | `packages/math/src/utils/courses-data.ts` | 数学讲次卡片数据 | 年级页看不到该讲 |
| 四-B | `packages/math/src/utils/lesson-grade.ts` | 讲次 → 年级映射 | 讲次归错年级 / 年级卡不出现 |
| 五 | `packages/math/src/utils/sea-data.ts` | 题海汇总 | 题海搜索/筛选/随机练无该讲 |
| 六-A | `apps/web/src/app/math/ny/plan/page.tsx` | 每日计划数据源 | 每日一练无该讲 |
| 六-B | `packages/math/src/components/MathWeeklyPractice.tsx` | 每日计划选项 | 每日一练选不到该讲 |
| 七-A | `apps/web/src/app/math/ny/quiz/page.tsx` | 组卷弹窗 | 弹窗里看不到该讲 |
| 七-B | `apps/web/src/app/math/ny/quiz/[id]/page.tsx` | 组卷详情 | 含该讲的试卷渲染为空 |
| 七-C | `apps/web/src/app/math/ny/quiz/[id]/print/page.tsx` | 组卷打印 | 含该讲的打印页为空 |

---

## 第四步：数学入口注册（卡片 + 年级）

数学首页 `/math` 显示**年级卡片**；讲次卡片在 `/math/ny/gN` 年级页列出。新增讲次需改两处：

### 4-A `packages/math/src/utils/courses-data.ts`

在 `COURSES` 数组**最前面**追加一个新讲次卡片对象：

```typescript
{
  href: '/math/ny/36',
  title: '星期几问题探险',       // 讲次主题 + "探险"
  description: '一句话描述：覆盖哪些题型，学完能做什么。',
  icon: '📅',                    // 与 Hero 区域相同的 emoji
  lectureNum: '第 36 讲',        // 一年级：真实教材讲次号；二年级起：年级内从「第 1 讲」计
  tags: ['核心知识点', '题型关键词', 'N 道互动题'],
  variant: 'blue',               // 颜色主题：'blue' | 'amber' | 'violet'
},
```

> **排列规则：** 新讲次放在数组**最前面**，保持最新讲次置顶。
> **`variant` 颜色选择：** 依次轮换，避免相邻两张卡片同色。

### 4-B `packages/math/src/utils/lesson-grade.ts`

在 `LESSON_GRADE` 增加一行，指定该讲属于哪个年级（未在题目源说明时用 `highestGrade()`）：

```typescript
'36': 1,   // 一年级
// 或
'50': gradeForNewLesson(),   // 未说明时 = 当前最高年级（现为 2）
```

### 4-C 新年级首讲（可选）

若该讲是某年级的**第一讲**（如二年级首讲 id=49）：

1. `lectureNum` 用「第 1 讲」起（不是全局 id）；
2. 新增薄壳 `apps/web/src/app/math/ny/g<N>/page.tsx`：

```tsx
import GradeLessonList from '@rosie/math/components/GradeLessonList'

export default function GradeNPage() {
  return <GradeLessonList grade={N} />
}
```

首页会自动出现该年级卡片；题海/组卷/计划的年级分组自动派生，无需额外登记。

---

## 第五步：题海注册

**文件：** `packages/math/src/utils/sea-data.ts`

`/math/sea` 是跨讲次综合题库，题目来自 `SEA_LESSONS` 数组。每新增一讲**必须**注册。

### 5-A 添加 import

```typescript
import { PROBLEMS as PROBLEMSN, PROBLEM_TYPES as PTN, TAG_STYLE as TSN } from './lessonN-data'
```

### 5-B 在 SEA_LESSONS 数组末尾追加

```typescript
{
  id: 'N',
  title: '第N讲·[主题名称]',      // 一年级：N = 内部 id；二年级起：N = 年级内讲次号
  shortTitle: 'N·[主题简称]',   // 同上
  icon: '[emoji]',                                       // 与首页卡片相同
  badgeClass: 'bg-[color]-100 text-[color]-700',        // 选一个区分其他讲次的颜色
  tagStyle: TSN,
  types: PTN.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
  problems: PROBLEMSN,
},
```

**二年级示例（内部 id=50，年级内第 2 讲）：** `title: '第2讲·…'`，`shortTitle: '2·…'`（不是 `50·…`）。

`badgeClass` 颜色参考：34=violet, 35=blue, 36=amber, 37=orange, 38=purple, 39=teal。新讲次选未用的（rose/green/cyan/sky）。

> `SEA_POOL` 由 `buildPool()` 自动构建，`MathSeaCard` 总题数自动更新，无需手动改。

---

## 第六步：每日计划注册（两个文件必须同步）

### 6-A `apps/web/src/app/math/ny/plan/page.tsx`

```typescript
import { PROBLEMS as PROBLEMSN } from '@rosie/math/utils/lessonN-data'

const PROBLEM_SETS: Record<string, ProblemSet> = {
  // ...已有讲次
  'N': PROBLEMSN,
}
```

### 6-B `packages/math/src/components/MathWeeklyPractice.tsx`

在文件顶部的 `LESSONS` 数组**末尾**追加：

```typescript
{
  id: 'N',
  label: '第N讲 · [主题名称]',   // 一年级：N = 内部 id；二年级起：年级内讲次号
  short: '[主题简称]',           // 用于卡片标题
  emoji: '[emoji]',              // 与首页卡片相同
  color: 'rgba(R,G,B,1)',        // 主色，与下方 bg/border 同色
  bg: 'rgba(R,G,B,.08)',         // 背景填充
  border: 'rgba(R,G,B,.3)',      // 边框
  desc: '一句话描述题型重点',     // 卡片副标题
},
```

**二年级示例：** `id: '50'`，`label: '第2讲 · 主题'`（不是 `第50讲`）。组件内已按 `gradeOf(id)` 分组显示。

颜色参考：34 紫 `159,130,246`；35 蓝 `#3b82f6`；36 琥珀 `245,158,11`；37 黄绿 `133,200,11`；
38 玫红 `236,72,153`；39 翠绿 `16,185,129`；40 靛蓝 `99,102,241`；41 橙 `249,115,22`。
新讲次选未用的，如天蓝 `14,165,233`、紫罗兰 `168,85,247`。

> `MathWeeklyPractice` 仅依赖 `lesson`/`homework`/`workbook`/`pretest` 四个 section，`supplement` 不计入。

---

## 第七步：综合组卷注册（三个文件必须同步）

### 7-A `apps/web/src/app/math/ny/quiz/page.tsx`

```typescript
import { PROBLEMS as PN, PROBLEM_TYPES as PTN } from '@rosie/math/utils/lessonN-data'  // 必须含 PROBLEM_TYPES

// 在 LESSON_META 数组末尾：
{ id: 'N', name: '[主题名称]', data: PN, types: PTN },
```

### 7-B `apps/web/src/app/math/ny/quiz/[id]/page.tsx`

```typescript
import { PROBLEMS as PN } from '@rosie/math/utils/lessonN-data'

const LESSON_DATA: Record<string, ProblemSet> = { /* ...已有 */ 'N': PN }
const LESSON_NAMES: Record<string, string> = { /* ...已有 */ 'N': '[主题名称]' }
```

### 7-C `apps/web/src/app/math/ny/quiz/[id]/print/page.tsx`

```typescript
import { PROBLEMS as PN } from '@rosie/math/utils/lessonN-data'

const LESSON_DATA: Record<string, ProblemSet> = { /* ...已有 */ 'N': PN }  // 此文件无 LESSON_NAMES
```

> 三处必须保持一致。7-A 漏 → 弹窗看不到；7-B/7-C 漏 → 含该讲的试卷渲染/打印为空。

---

## 增量补题：给已生成的讲次补一个原本为空的模块

某讲常分多次录入（先给课堂题，后补课后/拓展，再补 summary）。当一个**原本 `[]` 的模块后来有了内容**，
除了在数据文件里把该模块从 `[]` 换成真正的数组，还要回头更新这些**展示面**（漏了不会报错，
但模块会在界面「静默消失」）：

| 文件 | 改动 |
|------|------|
| `packages/math/src/utils/lessonN-data.ts` | 新增该模块数组，`PROBLEMS.<mod>` 指向它 |
| `components/lessonN/Sidebar.tsx` | `sections` 加入该模块条目 |
| `components/lessonN/HomePage.tsx` | `MODULES` 加入该模块卡片 |
| `components/lessonN/FilterPanel.tsx` | `sourceBtns` 加入该模块来源按钮 |
| `apps/web/src/app/math/ny/N/alltest/page.tsx` | `source` 初始 `Set` 加入该 section key |
| `packages/math/src/utils/courses-data.ts` | 入口卡片 `tags` 里的总题数（如 `'31 道互动题'`）改成新的合计 |

> 该模块的路由文件（`<mod>/page.tsx` + `<mod>/[id]/page.tsx`）若按「空模块照样生成路由」已存在，
> 就**不用新建**，它们读 `PROBLEMS.<mod>` 自动显示新题。题海/每日计划/组卷（第五~七步）读的是整个
> `PROBLEMS`，也会自动包含新题，无需再改。
> **summary 是非题目模块**：改 summary 时更新 `docs/math/lessons/N.md` 的 `## summary` 和 HomePage 文案
> （及可选的 `LESSON_TIP`）即可，不涉及上表。

---

## 第八步：验证

```bash
pnpm --filter @rosie/math typecheck   # 数学包独立类型检查（快）
pnpm build                            # 确认整体构建通过
```

新增/改动页面建议 `pnpm dev` 打开 `/math` 与新讲次页面**实际看一眼**渲染
（green build ≠ 样式正常，见 `docs/bug-report.md`）。
