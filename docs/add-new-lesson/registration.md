# 注册到入口页（必读 · 最易遗漏）

> 第四~七步只是往若干硬编码清单里追加条目。**任何一处遗漏都不会报错**，
> 但新讲次会在对应入口「静默消失」。完成后逐项核对本文件。

涉及文件总览：

| 步骤 | 文件 | 作用 | 遗漏后果 |
|------|------|------|----------|
| 四 | `apps/web/src/app/math/page.tsx` | 数学入口卡片 | 入口页看不到该讲 |
| 五 | `packages/math/src/utils/sea-data.ts` | 题海汇总 | 题海搜索/筛选/随机练无该讲 |
| 六-A | `apps/web/src/app/math/ny/plan/page.tsx` | 每日计划数据源 | 每日一练无该讲 |
| 六-B | `packages/math/src/components/MathWeeklyPractice.tsx` | 每日计划选项 | 每日一练选不到该讲 |
| 七-A | `apps/web/src/app/math/ny/quiz/page.tsx` | 组卷弹窗 | 弹窗里看不到该讲 |
| 七-B | `apps/web/src/app/math/ny/quiz/[id]/page.tsx` | 组卷详情 | 含该讲的试卷渲染为空 |
| 七-C | `apps/web/src/app/math/ny/quiz/[id]/print/page.tsx` | 组卷打印 | 含该讲的打印页为空 |

---

## 第四步：数学入口页注册卡片

**文件：** `apps/web/src/app/math/page.tsx`

在 `courses` 数组**最前面**追加一个新讲次卡片对象：

```typescript
{
  href: '/math/ny/36',
  title: '星期几问题探险',       // 讲次主题 + "探险"
  description: '一句话描述：覆盖哪些题型，学完能做什么。',
  icon: '📅',                    // 与 Hero 区域相同的 emoji
  lectureNum: '第 36 讲',
  tags: ['核心知识点', '题型关键词', 'N 道互动题'],
  variant: 'blue',               // 颜色主题：'blue' | 'amber' | 'violet'
},
```

> **排列规则：** 新讲次放在数组**最前面**，保持最新讲次置顶。
> **`variant` 颜色选择：** 依次轮换，避免相邻两张卡片同色（35讲=`blue`，36讲=`amber`，34讲=`violet`）。

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
  title: '第N讲·[主题名称]',
  shortTitle: 'N·[主题简称]',
  icon: '[emoji]',                                       // 与首页卡片相同
  badgeClass: 'bg-[color]-100 text-[color]-700',        // 选一个区分其他讲次的颜色
  tagStyle: TSN,
  types: PTN.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
  problems: PROBLEMSN,
},
```

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
  label: '第N讲 · [主题名称]',
  short: '[主题简称]',           // 用于卡片标题
  emoji: '[emoji]',              // 与首页卡片相同
  color: 'rgba(R,G,B,1)',        // 主色，与下方 bg/border 同色
  bg: 'rgba(R,G,B,.08)',         // 背景填充
  border: 'rgba(R,G,B,.3)',      // 边框
  desc: '一句话描述题型重点',     // 卡片副标题
},
```

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
| `apps/web/src/app/math/page.tsx` | 入口卡片 `tags` 里的总题数（如 `'31 道互动题'`）改成新的合计 |

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
