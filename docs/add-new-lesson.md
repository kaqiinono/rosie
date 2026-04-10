# 新增讲次操作指引

> 适用场景：在 `src/app/math/ny/` 下新增一个讲次（如第36讲、第37讲），复用第35讲的完整页面结构，只替换题目内容。

---

## 概览

每新增一个讲次，需要：
- **新建** 2 类文件（数据文件 + 路由文件）
- **复制并改动** 6 个组件文件
- **完全复用** 6 个组件（零改动）
- **在数学入口页注册卡片**（1 行数据）

`constant.ts` **无需改动**：本地缓存使用 3 个通用 key，所有讲次共享。

---

## 读取 PDF 的正确流程

**在录入任何题目之前，必须先通读全部 PDF 页面，确认题目总数。**

1. 读完所有页，列出每道题的标题/关键数字
2. 确认总题数（例："共 12 道：例题1-6 + 练一练1-6"）
3. 确认后再逐题录入，避免因未读完而遗漏后续模块

> 反例：只读到模块1就开始录入，结果模块2的8道题全部遗漏。

---

## 关于不完整 PDF

**可以分批提供内容，不影响页面生成。**

- 如果某个模块（如课前测）暂无题目，在数据文件中设置 `pretest: []`，该页面会显示空列表
- 后续补充题目时，只需往对应数组追加对象，页面自动更新
- 路由文件全部正常生成，无需等待所有内容齐全

---

## 关于图表定制（拆解图 / 倍比图 / 流程图 / 其他）

**图表是完全可定制的，每个讲次可以有独立的图表组件，互不干扰。**

`ProblemDetail` 支持两个图表插槽（props）：

| prop | 位置 | 说明 |
|------|------|------|
| `leftDiagram` | 左列（题目下方） | 传入时替换默认拆解图；传 `null` 则不显示任何内容 |
| `rightDiagram` | 右列（答题框上方） | 传入时替换默认倍比图；传 `null` 则不显示任何内容 |

两个 prop 都不传时，回退到 `type` 字段驱动的默认渲染（lesson35 现有行为）。

**lesson35（倍比图 + 拆解图）**：无需传这两个 prop，默认渲染。

**新讲次有流程图**（示例）：
```tsx
// src/app/math/ny/36/lesson/[id]/page.tsx
import Lesson36Flowchart from '@/components/math/lesson36/Lesson36Flowchart'

return (
  <ProblemDetail
    problem={problem}
    tip={LESSON_TIP}
    rightDiagram={<Lesson36Flowchart problem={problem} />}
    leftDiagram={null}   // 明确不显示左列图表
  />
)
```

**新讲次无任何图表**：
```tsx
return (
  <ProblemDetail
    problem={problem}
    leftDiagram={null}
    rightDiagram={null}
  />
)
```

**新建图表组件的规范**：在 `src/components/math/lessonN/` 下新建 `LessonNXxxDiagram.tsx`，接收 `problem: Problem` 作为 prop，返回图表 JSX。图表组件内部不依赖任何特定 Provider，只读取 `problem` 数据。

**口诀提示框**通过 `tip` prop 控制：
- 每个讲次在数据文件中导出 `export const LESSON_TIP = '...'`
- 不需要口诀的讲次不导出该常量，路由页面不传 `tip` prop 即可

---

## 本地缓存说明

所有讲次共享以下 3 个 localStorage key（已在代码中固定，无需新增）：

| key | 存储内容 |
|-----|----------|
| `math-solved` | 所有题目的做题次数 `Record<problemId, count>` |
| `math-wrong` | 所有题目的错题 ID 集合 |
| `math-sidebar-collapsed` | 侧边栏折叠状态（所有讲次共用） |

> **重要：** 为避免不同讲次的题目 ID 碰撞，新讲次的所有题目 ID 必须加讲次前缀。
> 例如第36讲使用 `36-L1`、`36-H1`、`36-W1`、`36-P1`，第35讲保持原有 `L1`、`H1` 不变。
> 补充题使用 `N-S1`、`N-S2` 等（S = Supplement）。

---

## 关于补充题模块（supplement）

**补充题是可选模块**，用于提供额外的专项训练题目（如速算 100 题）。**默认讲次不包含补充题，只在有大量练习需求时添加。**

### 什么时候添加补充题

- 某道核心技巧需要大量重复练习（如分配律速算）
- PDF 中提供了额外的专项题目（通常是 50-100 道同类型题）
- 新讲次的题目总数明显不足，需要补充练习量

### 补充题数据结构

`ProblemSet` 中 `supplement` 字段是可选的（`supplement?: Problem[]`），不提供时不显示该模块：

```typescript
export const PROBLEMS: ProblemSet = {
  pretest: [...],
  lesson: [...],
  homework: [...],
  workbook: [...],
  supplement: [...],  // 可选，不写则不显示补充题入口
}
```

### 补充题 ID 命名规范

补充题 ID 使用 `N-S1` ... `N-S100` 格式（S = Supplement）：

```typescript
{ id: '34-S1', title: '补充题1', tag: 'type2', tagLabel: '分配律', ... }
```

### 批量生成补充题的 makeSupp 辅助函数

对于同类型的大量题目（如 100 道分配律速算），可用辅助函数批量生成：

```typescript
function makeSupp(n: number, text: string, factorN: number, inner: number, ans: number, isSubtract = false): Problem {
  const op = isSubtract ? '−' : '+'
  const coeff = ans / factorN
  const label = coeff === 100 ? '100' : coeff === 1000 ? '1000' : `${coeff}`
  return {
    id: `34-S${n}`, title: `补充题${n}`, tag: 'type2', tagLabel: '分配律', text,
    analysis: [`提取公因数${factorN}`, `= ${factorN}×(${inner})`, `= ${factorN}×${label}`, `= ${ans}`],
    type: 'none', finalQ: '计算结果是多少？', finalUnit: '', finalAns: ans,
  }
}

const S1 = makeSupp(1, '3×45 + 3×55 = ？', 3, '45+55', 300)
const S2 = makeSupp(2, '7×38 − 7×28 = ？', 7, '38−28', 70, true)
```

### 补充题模块需要的额外改动

相比标准讲次，添加补充题模块需要额外：

**1. Sidebar.tsx** 增加 supplement 条目：
```typescript
const SECTIONS = [
  { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', label: '课堂讲解' },
  { key: 'homework', path: `${BASE}/homework`, icon: '✏️', label: '课后巩固' },
  { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', label: '拓展练习' },
  { key: 'supplement', path: `${BASE}/supplement`, icon: '📒', label: '补充题' },  // 新增
  { key: 'alltest', path: `${BASE}/alltest`, icon: '🎯', label: '综合题库' },
  { key: 'pretest', path: `${BASE}/pretest`, icon: '📝', label: '课前测' },
  { key: 'mistakes', path: `${BASE}/mistakes`, icon: '📕', label: '错题本' },
]
```

**2. layout.tsx** 的 `SECTION_COUNTS` 增加 supplement：
```typescript
const SECTION_COUNTS: Record<string, number> = {
  lesson: PROBLEMS.lesson.length,
  homework: PROBLEMS.homework.length,
  workbook: PROBLEMS.workbook.length,
  pretest: PROBLEMS.pretest.length,
  supplement: PROBLEMS.supplement?.length ?? 0,  // 新增
}
```

**3. FilterPanel.tsx** 的 `SOURCE_BTNS` 增加 supplement：
```typescript
const SOURCE_BTNS = [
  { key: 'lesson', label: '📖 课堂' },
  { key: 'homework', label: '✏️ 课后' },
  { key: 'workbook', label: '📚 拓展' },
  { key: 'supplement', label: '📒 补充题' },  // 新增
  { key: 'pretest', label: '📝 课前测' },
]
```

**4. alltest/page.tsx** 的 source 初始 Set 增加 supplement：
```typescript
source: new Set(['lesson', 'homework', 'workbook', 'supplement', 'pretest']),
```

**5. HomePage.tsx** 的 `MODULES` 数组增加 supplement 模块卡片：
```typescript
{ key: 'supplement', path: `${BASE}/supplement`, icon: '📒', bg: 'bg-amber-50', title: '补充题', desc: 'N道速算 · [主题描述]' },
```

**6. 新增路由页面**：
- `src/app/math/ny/N/supplement/page.tsx`（列表页，同 homework/page.tsx 结构）
- `src/app/math/ny/N/supplement/[id]/page.tsx`（详情页，同 homework/[id]/page.tsx 结构）

---

## 关于自定义图形组件（figureNode）

**当题目需要配套 SVG 图形时，使用 `figureNode` 字段。**

- `figureNode?: ReactNode` — 题目中的图形插图（SVG React 组件），显示在题目卡片内
- 图形组件放在 `src/components/math/lessonN/Figure/` 目录，每个组件对应一道题的图
- 命名规范：`LessonFigN.tsx`、`HomeworkFigN.tsx`、`WorkbookFigN.tsx`、`PretestFigN.tsx` 等

**⚠️ 重要：** 若数据文件中任何题目使用了 `figureNode: <SomeComponent />`（JSX 语法），数据文件**必须使用 `.tsx` 扩展名**，而非 `.ts`。例：
- 有 figureNode → `src/utils/lesson38-data.tsx`（JSX 扩展名必须）
- 无 figureNode → `src/utils/lesson36-data.ts`（普通 TypeScript 文件）

典型的图形组件结构（以一笔画 SVG 图为例）：
```tsx
// src/components/math/lesson38/Figure/LessonFig2.tsx
const stroke = '#0891b2'
export default function LessonFig2() {
  return (
    <svg viewBox="0 0 260 200" className="h-full w-full">
      {/* SVG 图形内容 */}
    </svg>
  )
}
```

---

## 第一步：新建数据文件

> **分工说明：你只需提供 PDF，Claude 从 PDF 中读取所有题目内容并生成该文件，不需要你手动填写。**

**新建文件：** `src/utils/lesson36-data.ts`（若有 figureNode 则用 `.tsx`）

完整复制 `src/utils/lesson35-data.ts`，然后：

1. 把题目内容全部替换为新讲次的内容
2. 如有新题型，修改 `PROBLEM_TYPES` / `TYPE_STYLE` / `TAG_STYLE`
3. 如有图形题目，创建 `Figure/` 目录并在数据文件中 import（文件须改为 `.tsx`）

数据文件导出结构保持不变：

```typescript
export const PROBLEMS: ProblemSet = {
  pretest: [...],   // 课前测题目
  lesson: [...],    // 课堂讲解题目
  homework: [...],  // 课后巩固题目
  workbook: [...],  // 练习册题目
  // supplement: [...],  // 可选：补充题（有大量专项练习时添加）
}
export const PROBLEM_TYPES = [...]
export const TYPE_STYLE = {...}
export const TAG_STYLE = {...}
```

### 每道题的数据结构

```typescript
{
  id: '36-L1',         // ⚠️ 必须加讲次前缀：36-L1 / 36-H1 / 36-W1 / 36-P1 / 36-S1
  title: '课1 · 标题',
  tag: 'type1',        // 题型分类 tag（对应 PROBLEM_TYPES 中的 tag）
  tagLabel: '标签文字',
  text: '题目正文，可用 <strong>加粗</strong> 关键数字',
  analysis: [
    '第一步：说明',
    '第二步：说明',
    '⚠️ 注意事项',
  ],
  type: 'ratio3',      // 单变量用 'ratio3'，双变量用 'ratio3b'，无图表用 'none'
  rows: [              // 比例图左列（字符串=标签，对象=输入框）
    '已知条件',
    { id: 'rA1', ans: 3, unit: '分钟' },
    '目标条件',
    { id: 'rA2', ans: 8, unit: '分钟' },
  ],
  rcols: [             // 比例图右列
    '个数',
    { id: 'r1', ans: 180 },
    { id: 'r2', ans: 480 },
  ],
  ops: [               // 运算符圆圈
    { id: 'ot1', ans: '÷3' },
    { id: 'ob1', ans: '×8' },
    { id: 'oc1', ans: '÷3' },
    { id: 'oc2', ans: '×8' },
  ],
  hasBlocks: false,    // 是否显示方块图
  blockScene: {...},   // 单变量方块图配置（hasBlocks=true 时填）
  dualSc: {...},       // 双变量方块图配置（type='ratio3b' 时填）
  finalQ: '8分钟能打多少个',
  finalUnit: '个',
  finalAns: 480,
}
```

---

## 第二步：从 PDF 解析首页内容

> **分工说明：你只需提供 PDF，Claude 负责提取内容并生成所有代码，不需要你手动填写任何字段。**

首页由两个地方的内容拼合而成：**数据文件**（题型定义）+ **HomePage 组件**（文案和模块描述）。
以下是 Claude 从 PDF 中提取的 6 类信息及其对应代码位置：

---

### 2-A 提取清单（告诉 Claude 从 PDF 里找这些）

#### 1. 讲次基本信息 → 填入 `HomePage.tsx` Hero 区域

| 字段 | 示例（lesson35） | 说明 |
|------|-----------------|------|
| 讲次主题 | `归一问题` | 这一讲的核心知识点名称 |
| 讲次标题行 | `第35讲 · 一年级目标班` | 讲次编号 + 班级 |
| 一句话描述 | `学会用倍比图解决归一问题！` | 学完能做什么 |
| 配套 emoji | `🎯` | 主题对应的 emoji |

#### 2. 核心公式/本质 → 填入 `HomePage.tsx` 题型说明区域

```
核心本质：[用一句话描述这类题的数量关系]
公式：[关键公式，如 总量 = 份数 × 每份数]
```

#### 3. 万能口诀 → 填入 `HomePage.tsx` 底部提示框

```
万能口诀：[解题步骤的记忆口诀，如 先归一（÷份数）→ 找每份量 → 再求多（×份数）]
```

#### 4. 题型列表 → 填入数据文件 `PROBLEM_TYPES` + `TYPE_STYLE` + `TAG_STYLE`

对每一种题型，从 PDF 提取：

| 字段 | 说明 | 示例 |
|------|------|------|
| `tag` | 代码标识，按顺序编号 | `type1`、`type2` |
| `color` | 主色调名称（Tailwind 颜色） | `blue`、`green`、`orange`、`purple`、`red`、`pink` |
| `label` | 显示名称 | `题型1 · 直接归一` |
| `desc` | 题型特征一句话描述 | `明确要求先求1份，÷份数→×目标份数。` |
| `example` | 典型例子（简短） | `例：2分钟6只→1分钟→5分钟` |

`TYPE_STYLE` 和 `TAG_STYLE` 根据 `color` 字段自动对应 Tailwind 色系，无需单独提取。

#### 5. 各模块题目数量 → 填入 `HomePage.tsx` 的 `MODULES` 描述

从 PDF 数题目数量（共 7 个导航模块，各自说明如下）：

| 模块 | 首页卡片 | 描述模板 / 说明 |
|------|---------|----------------|
| 课堂讲解 | ✅ 需填写 | `例题1-N · [主要题型列表]` |
| 课后巩固 | ✅ 需填写 | `巩固1-N · 强化练习` |
| 练习册 | ✅ 需填写 | `闯关1-N · 综合挑战` |
| 课前测 | ✅ 需填写 | `N道摸底题 · 检验起始水平` |
| 补充题 | ✅ 有则填写 | `N道速算 · [主题描述]`（无补充题则不添加此模块卡片） |
| 综合题库 | ✅ 无需填写 | 首页有独立宽卡片，文案固定为"全部题目 · 按题型/来源筛选 · 综合训练"，总题数自动从 PROBLEMS 汇总，无需手动指定 |
| 错题本 | ❌ 不在首页 | 仅出现在侧边栏和底部导航，错题数量由用户行为动态生成，无需在首页配置 |
| 首页 | — | 即 `page.tsx` 本身，其内容即 Hero + 题型总结 + 上述模块卡片 |

---

### 2-B 生成代码的对应位置

提取完信息后，写入以下位置：

**`src/utils/lesson36-data.ts`**（题型定义部分）：

```typescript
export const PROBLEM_TYPES = [
  {
    tag: 'type1',
    color: 'blue',             // 决定 TYPE_STYLE 和 TAG_STYLE 的颜色
    label: '题型1 · [名称]',
    desc: '[题型特征描述]',
    example: '例：[典型例子]',
  },
  // ... 其余题型
]

export const TYPE_STYLE: Record<string, ...> = {
  type1: { bg: 'bg-blue-50', border: 'border-l-blue-500', titleColor: 'text-blue-800', textColor: 'text-blue-900' },
  type2: { bg: 'bg-green-50', border: 'border-l-green-500', titleColor: 'text-green-800', textColor: 'text-green-900' },
  // 颜色按序选择：blue → green → orange → purple → red → pink → teal
}

export const TAG_STYLE: Record<string, string> = {
  type1: 'bg-app-blue-light text-app-blue-dark',
  type2: 'bg-app-green-light text-app-green-dark',
  // 同色系对应
}
```

**`src/components/math/lesson36/HomePage.tsx`**（文案部分）：

```tsx
// Hero 区域（第56-64行区域）
<h1 className="mb-1.5 text-2xl font-extrabold text-[#78350f]">[主题] [emoji]</h1>
<p className="text-[13px] leading-relaxed text-[#92400e]">
  第36讲 · [班级]<br />
  [一句话描述]
</p>

// 题型说明区域（第68-71行区域）
<div className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold">🧠 [主题] · N大题型</div>
<div className="mb-3 text-[13px] leading-relaxed text-text-secondary">
  <strong className="text-text-primary">核心本质：</strong>[核心关系描述]
  <code className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">[公式]</code>
</div>

// 万能口诀（第94-98行区域）
<span className="text-xs leading-relaxed text-app-purple-dark">
  万能口诀：<strong>[口诀内容]</strong>
</span>

// MODULES 描述（第29-33行区域）
{ key: 'lesson', ..., desc: '例题1-N · [题型概述]' },
{ key: 'homework', ..., desc: '巩固1-N · 强化练习' },
{ key: 'workbook', ..., desc: '闯关1-N · 综合挑战' },
{ key: 'pretest', ..., desc: 'N道摸底题 · 检验起始水平' },
// { key: 'supplement', ..., desc: 'N道速算 · [描述]' },  // 可选
```

---

## 第三步：新建组件目录，复制并修改 6 个文件

新建目录：`src/components/math/lesson36/`

| 源文件 | 目标文件 | 改动内容 |
|--------|----------|----------|
| `lesson35/Lesson35Provider.tsx` | `lesson36/Lesson36Provider.tsx` | 全局替换 `Lesson35` → `Lesson36`（storage key 无需改，已通用） |
| `lesson35/AppHeader.tsx` | `lesson36/AppHeader.tsx` | `BASE = '/math/ny/36'`；import `useLesson36`；Logo 文字改为第36讲内容（注意：用户登录区域由全局 `AccountBar` 统一管理，AppHeader 不包含登录/退出 UI） |
| `lesson35/Sidebar.tsx` | `lesson36/Sidebar.tsx` | `BASE = '/math/ny/36'`；import `useLesson36`；有补充题时在 SECTIONS 增加 supplement 条目 |
| `lesson35/BottomNav.tsx` | `lesson36/BottomNav.tsx` | `BASE = '/math/ny/36'`；import `useLesson36` |
| `lesson35/HomePage.tsx` | `lesson36/HomePage.tsx` | `BASE = '/math/ny/36'`；import 改为 `lesson36-data`；Hero 区域改为第36讲标题和描述；有补充题时在 MODULES 增加 supplement 卡片 |
| `lesson35/FilterPanel.tsx` | `lesson36/FilterPanel.tsx` | `BASE = '/math/ny/36'`；有补充题时在 SOURCE_BTNS 增加 supplement 按钮 |

### 可直接复用的组件（从 lesson35 import，无需复制）

- `ProblemDetail`
- `RatioDiagram`
- `BlockDiagram`
- `DualBlockDiagram`
- `CongratsModal`
- `Toast`
- `LoginModal`

> **注意：** `ProblemList` 内部 import 了 `TAG_STYLE from '@/utils/lesson35-data'`。如果新讲次的题型 tag 颜色不同，需在 `lesson36/` 目录也复制一份 `ProblemList.tsx`，只改这一行 import 为 `lesson36-data`。

---

## 第三步：新建路由目录（12-14 个页面文件）

新建目录：`src/app/math/ny/36/`

### `layout.tsx`

复制 `src/app/math/ny/35/layout.tsx`，替换：
- `lesson35-data` → `lesson36-data`
- `Lesson35Provider` / `useLesson35` → `Lesson36Provider` / `useLesson36`
- `lesson35/` (import 路径) → `lesson36/`
- 有补充题时，在 `SECTION_COUNTS` 增加：`supplement: PROBLEMS.supplement?.length ?? 0`

### `page.tsx`

复制，替换所有 `lesson35` → `lesson36` 引用。

### `lesson/page.tsx`、`homework/page.tsx`、`workbook/page.tsx`、`pretest/page.tsx`

复制对应文件，替换：
- `lesson35-data` → `lesson36-data`
- `useLesson35` → `useLesson36`
- `lesson35/ProblemList` → `lesson36/ProblemList`（如已复制）
- `basePath="/math/ny/35/lesson"` → `basePath="/math/ny/36/lesson"`（各自对应）
- 页面描述文字（如"6道例题"）按实际修改

### `lesson/[id]/page.tsx`、`homework/[id]/page.tsx`、`workbook/[id]/page.tsx`、`pretest/[id]/page.tsx`

复制，替换：
- `lesson35-data` → `lesson36-data`（同时更新 `LESSON_TIP` 的 import，如不需要口诀则删除）
- `lesson35/ProblemDetail` → `lesson35/ProblemDetail`（可直接复用，路径不变）
- `<ProblemDetail problem={problem} tip={LESSON_TIP} />` → 如无口诀改为 `<ProblemDetail problem={problem} />`

### `supplement/page.tsx`（有补充题时新增）

参考 `homework/page.tsx` 结构，主要区别：
- `const list = PROBLEMS.supplement ?? []`
- 页面头部用 amber 色系，强调训练主题
- basePath 为 `/math/ny/N/supplement`

```tsx
export default function SupplementPage() {
  const { solveCount } = useLesson34()
  const list = PROBLEMS.supplement ?? []
  // ...同 homework/page.tsx，替换标题文案
  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-amber-200 bg-gradient-to-br from-amber-50 to-[#fef3c7] p-4">
        <div className="mb-1 text-sm font-extrabold text-amber-900">📒 补充题 · 第N讲</div>
        <div className="mb-2 text-xs text-amber-700">N道速算训练 · [主题描述]</div>
        {/* 进度条 */}
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/N/supplement" />
    </div>
  )
}
```

### `supplement/[id]/page.tsx`（有补充题时新增）

参考 `homework/[id]/page.tsx`，主要区别：
- `const list = PROBLEMS.supplement ?? []`
- `const problem = list[index]`

### `alltest/page.tsx`

完整模板（直接复制，替换 `N` 为讲次编号、`lessonN` 为对应标识符）：

```tsx
'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PROBLEMS } from '@/utils/lessonN-data'
import { useLessonN } from '@/components/math/lessonN/LessonNProvider'
import FilterPanel from '@/components/math/lessonN/FilterPanel'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'

function AlltestContent() {
  const { solveCount } = useLessonN()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState(() => ({
    // source: 列出所有实际存在的 section key（pretest/lesson/homework/workbook/supplement）
    source: new Set(['pretest', 'lesson', 'homework', 'workbook']),
    // type: 列出数据文件中所有 PROBLEM_TYPES 的 tag（type1, type2, ...）
    type: typeParam ? new Set([typeParam]) : new Set(['type1', 'type2', 'type3', 'type4', 'type5', 'type6']),
    mastery: 'all' as MasteryFilter,
  }))

  const toggleFilter = (axis: 'source' | 'type', value: string) => {
    setFilters(f => {
      const next = new Set(f[axis])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...f, [axis]: next }
    })
  }

  const setMastery = (value: MasteryFilter) => {
    setFilters(f => ({ ...f, mastery: value }))
  }

  return (
    <FilterPanel
      problems={PROBLEMS}
      solveCount={solveCount}
      filters={filters}
      onToggleFilter={toggleFilter}
      onSetMastery={setMastery}
    />
  )
}

export default function AlltestPage() {
  return (
    <Suspense>
      <AlltestContent />
    </Suspense>
  )
}
```

### `mistakes/page.tsx`

完整模板（直接复制，替换 `N` 为讲次编号、`lessonN` 为对应标识符）：

```tsx
'use client'

import Link from 'next/link'
import { useLessonN } from '@/components/math/lessonN/LessonNProvider'
import { PROBLEMS, TAG_STYLE } from '@/utils/lessonN-data'
import { SOURCE_LABELS } from '@/utils/constant'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@/utils/masteryUtils'
import type { Problem } from '@/utils/type'

const ALL_PROBLEMS = new Map<string, { p: Problem; setName: string; idx: number }>()
;(Object.entries(PROBLEMS) as [string, Problem[]][]).forEach(([setName, list]) => {
  list.forEach((p, i) => ALL_PROBLEMS.set(p.id, { p, setName, idx: i }))
})

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLessonN()

  const wrongList = [...wrongIds]
    .map(id => ALL_PROBLEMS.get(id))
    .filter(Boolean) as { p: Problem; setName: string; idx: number }[]

  const masteredCount = wrongList.filter(({ p }) => (solveCount[p.id] ?? 0) >= 3).length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-[#fecaca] bg-gradient-to-br from-[#fff5f5] to-[#fee2e2] p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-extrabold text-[#991b1b]">
          📕 错题本
          {wrongList.length > 0 && (
            <span className="rounded-full bg-[#fca5a5] px-2 py-0.5 text-[11px] font-bold text-[#7f1d1d]">
              {wrongList.length} 题
            </span>
          )}
        </div>
        <div className="mb-2 text-xs text-[#b91c1c]">答错的题目会自动收录 · 答对后自动移除</div>
        {wrongList.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-[#fecaca]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#f87171] transition-[width] duration-500"
                style={{ width: `${Math.round((masteredCount / wrongList.length) * 100)}%` }}
              />
            </div>
            <div className="shrink-0 text-[11px] font-bold text-[#991b1b]">
              已改正 {masteredCount}/{wrongList.length}
            </div>
          </div>
        )}
      </div>

      {wrongList.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="text-5xl">🎉</div>
          <div className="text-[15px] font-bold text-text-primary">错题本是空的！</div>
          <div className="text-[13px] text-text-muted">答错的题目会自动出现在这里</div>
          <Link
            href="/math/ny/N"
            className="mt-2 rounded-full bg-app-blue px-5 py-2 text-[13px] font-semibold text-white no-underline shadow-[0_3px_10px_rgba(59,130,246,0.3)]"
          >
            去做题 →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {wrongList.map(({ p, setName, idx }) => {
            const count = solveCount[p.id] ?? 0
            const level = getMasteryLevel(count)
            const isMastered = count >= 3
            const srcLabel = SOURCE_LABELS[setName] || setName
            const href = `/math/ny/N/${setName}/${idx + 1}`

            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-[12px] border-[1.5px] bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
                  isMastered ? 'border-app-green opacity-70' : `border-[#fca5a5] ${MASTERY_BORDER[level]}`
                }`}
              >
                <div className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-sm ${MASTERY_BADGE_BG[level]}`}>
                  {MASTERY_ICON[level]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${TAG_STYLE[p.tag] || 'bg-gray-100 text-gray-600'}`}>
                      {p.tagLabel}
                    </span>
                    <span className="rounded-full bg-[#f3e8ff] px-2 py-px text-[10px] font-semibold text-[#7e22ce]">
                      {srcLabel}
                    </span>
                    {count > 0 && (
                      <span className="rounded-full bg-gray-100 px-2 py-px text-[10px] text-text-muted">
                        已练 {count} 次
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link
                    href={href}
                    className="rounded-full bg-app-blue px-3 py-1.5 text-[11px] font-semibold text-white no-underline"
                  >
                    {isMastered ? '再练' : '去练'}
                  </Link>
                  <button
                    onClick={() => removeWrong(p.id)}
                    className="rounded-full border border-[#fca5a5] px-2 py-1.5 text-[11px] text-[#dc2626] transition-colors hover:bg-[#fee2e2]"
                    title="从错题本移除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

### `FilterPanel.tsx`（`src/components/math/lessonN/FilterPanel.tsx`）

完整模板（替换 `N`；SOURCE_BTNS 和 TYPE_BTNS 按实际讲次调整）：

```tsx
'use client'

import { memo, useCallback, useState } from 'react'
import Link from 'next/link'
import type { Problem, ProblemSet } from '@/utils/type'
import { SOURCE_LABELS } from '@/utils/constant'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@/utils/masteryUtils'
import ProblemDetail from './ProblemDetail'

const BASE = '/math/ny/N'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'

interface Filters {
  source: Set<string>
  type: Set<string>
  mastery: MasteryFilter
}

interface FilterPanelProps {
  problems: ProblemSet
  solveCount: Record<string, number>
  filters: Filters
  onToggleFilter: (axis: 'source' | 'type', value: string) => void
  onSetMastery: (value: MasteryFilter) => void
}

// ✏️ 按实际讲次调整（包含 supplement 时加上）
const SOURCE_BTNS = [
  { key: 'pretest',    label: '📝 课前测' },
  { key: 'lesson',     label: '📖 课堂' },
  { key: 'homework',   label: '✏️ 课后' },
  { key: 'workbook',   label: '📚 拓展' },
  // { key: 'supplement', label: '📒 附加' },
]

// ✏️ 按实际讲次题型调整（tag/label 与 PROBLEM_TYPES 对应）
const TYPE_BTNS = [
  { key: 'type1', label: '题型1·XXX' },
  { key: 'type2', label: '题型2·XXX' },
  // ...
]

const MASTERY_BTNS: { key: MasteryFilter; label: string }[] = [
  { key: 'all',       label: '全部' },
  { key: 'unstarted', label: '📚 未做' },
  { key: 'reinforce', label: '🌱 需巩固' },
  { key: 'mastered',  label: '✅ 已掌握' },
]

// ✏️ 与 PROBLEM_TYPES 的 color 字段对应
const TAG_COLORS: Record<string, string> = {
  type1: 'bg-blue-100 text-blue-800',
  type2: 'bg-green-100 text-green-800',
  // ...
}

function getProblemHref(setName: string, indexInSet: number): string {
  return `${BASE}/${setName}/${indexInSet + 1}`
}

function matchesMastery(count: number, mastery: MasteryFilter): boolean {
  if (mastery === 'all') return true
  if (mastery === 'unstarted') return count === 0
  if (mastery === 'reinforce') return count >= 1 && count < 3
  if (mastery === 'mastered') return count >= 3
  return true
}

const ExpandedCard = memo(function ExpandedCard({
  p, setName, idx, solveCount, isOpen, cardId, onToggle,
}: {
  p: Problem; setName: string; idx: number; solveCount: Record<string, number>
  isOpen: boolean; cardId: string; onToggle: (id: string) => void
}) {
  const count = solveCount[p.id] ?? 0
  const level = getMasteryLevel(count)
  const srcLabel = SOURCE_LABELS[setName] || setName
  return (
    <div className={`rounded-[12px] border-[1.5px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${MASTERY_BORDER[level]}`}>
      <button onClick={() => onToggle(cardId)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] p-3 text-left">
        <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${MASTERY_BADGE_BG[level]}`}>
          {idx + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${TAG_COLORS[p.tag] || 'bg-gray-100 text-gray-600'}`}>{p.tagLabel}</span>
            <span className="rounded-full bg-[#f3e8ff] px-2 py-px text-[10px] font-semibold text-[#7e22ce]">{srcLabel}</span>
          </div>
        </div>
        <span className="shrink-0 text-base">{MASTERY_ICON[level]}</span>
        <span className={`shrink-0 text-[13px] font-bold text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && (
        <div className="border-t border-border-light px-4 pb-5 pt-3">
          <ProblemDetail problem={p} mode="inline" />
        </div>
      )}
    </div>
  )
})

export default function FilterPanel({ problems, solveCount, filters, onToggleFilter, onSetMastery }: FilterPanelProps) {
  const [showDetail, setShowDetail] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const all: { p: Problem; setName: string; idx: number }[] = []
  ;(Object.entries(problems) as [string, Problem[]][]).forEach(([setName, list]) => {
    list.forEach((p, i) => all.push({ p, setName, idx: i }))
  })

  const filtered = all.filter(
    ({ p, setName }) =>
      filters.source.has(setName) &&
      filters.type.has(p.tag) &&
      matchesMastery(solveCount[p.id] ?? 0, filters.mastery),
  )
  const total = filtered.length
  const mastered = filtered.filter(({ p }) => (solveCount[p.id] ?? 0) >= 3).length
  const attempted = filtered.filter(({ p }) => (solveCount[p.id] ?? 0) >= 1).length
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0

  const toggleDetailMode = useCallback(() => { setShowDetail(v => !v); setCollapsedIds(new Set()) }, [])
  const toggleCard = useCallback((id: string) => {
    setCollapsedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }, [])

  const btnBase = 'cursor-pointer rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95'
  const btnOn  = 'border-[#a855f7] bg-[#a855f7] text-white'
  const btnOff = 'border-[#d8b4fe] bg-[#fdf4ff] text-[#7e22ce]'

  return (
    <div>
      <div className="mb-3 rounded-[14px] border border-[#e879f9] bg-gradient-to-br from-[#fdf4ff] to-[#f3e8ff] p-4">
        <div className="mb-1.5 text-[15px] font-extrabold text-[#7e22ce]">🎯 综合题库 · 第N讲</div>
        <div className="mb-2.5 text-xs text-[#6b21a8]">全部{total}道题 · 多选筛选 · 按题型/来源练习</div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-[#6b21a8]">📂 来源筛选（可多选）</div>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_BTNS.map(b => (
              <button key={b.key} onClick={() => onToggleFilter('source', b.key)}
                className={`${btnBase} ${filters.source.has(b.key) ? btnOn : btnOff}`}>{b.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-[#6b21a8]">🏷️ 题型筛选（可多选）</div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_BTNS.map(b => (
              <button key={b.key} onClick={() => onToggleFilter('type', b.key)}
                className={`${btnBase} ${filters.type.has(b.key) ? btnOn : btnOff}`}>{b.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-[#6b21a8]">🎯 掌握度筛选</div>
          <div className="flex flex-wrap gap-1.5">
            {MASTERY_BTNS.map(b => (
              <button key={b.key} onClick={() => onSetMastery(b.key)}
                className={`${btnBase} ${filters.mastery === b.key ? btnOn : btnOff}`}>{b.label}</button>
            ))}
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[#6b21a8]">
            <span>练过 <strong className="text-[#7e22ce]">{attempted}</strong> 道</span>
            <span className="text-[#c4b5fd]">·</span>
            <span>🦋 掌握 <strong className="text-[#7e22ce]">{mastered}</strong> 道</span>
            <span className="text-[#c4b5fd]">·</span>
            <span>共 {total} 题</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-[#e9d5ff]">
              <div className="absolute inset-y-0 left-0 rounded-full bg-[#c4b5fd] transition-[width] duration-400"
                style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-[#a855f7] transition-[width] duration-400"
                style={{ width: `${pct}%` }} />
            </div>
            <button onClick={toggleDetailMode}
              className={`shrink-0 ${btnBase} ${showDetail ? btnOn : `${btnOff} bg-white`}`}>
              {showDetail ? '收起 ↑' : '展开 ↓'}
            </button>
          </div>
        </div>
      </div>

      {showDetail ? (
        <div className="flex flex-col gap-2">
          {filtered.map(({ p, setName, idx }) => (
            <ExpandedCard key={p.id} p={p} setName={setName} idx={idx} solveCount={solveCount}
              isOpen={!collapsedIds.has(p.id)} cardId={p.id} onToggle={toggleCard} />
          ))}
          {filtered.length === 0 && <div className="py-6 text-center text-[13px] text-text-muted">没有符合筛选条件的题目</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ p, setName, idx }) => {
            const count = solveCount[p.id] ?? 0
            const level = getMasteryLevel(count)
            return (
              <Link key={p.id} href={getProblemHref(setName, idx)}
                className={`flex items-center gap-2.5 rounded-[10px] border-[1.5px] bg-white p-3 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all ${MASTERY_BORDER[level]}`}>
                <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${MASTERY_BADGE_BG[level]}`}>
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${TAG_COLORS[p.tag] || 'bg-gray-100 text-gray-600'}`}>{p.tagLabel}</span>
                    <span className="rounded-full bg-[#f3e8ff] px-2 py-px text-[10px] font-semibold text-[#7e22ce]">{SOURCE_LABELS[setName] || setName}</span>
                  </div>
                </div>
                <div className="shrink-0 text-base">{MASTERY_ICON[level]}</div>
              </Link>
            )
          })}
          {filtered.length === 0 && <div className="col-span-full py-6 text-center text-[13px] text-text-muted">没有符合筛选条件的题目</div>}
        </div>
      )}
    </div>
  )
}
```

---

## 第四步：在数学入口页注册卡片

**文件：** `src/app/math/page.tsx`

在 `courses` 数组中**最前面**追加一个新讲次的卡片对象：

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
>
> **`variant` 颜色选择：** 依次轮换，避免相邻两张卡片同色。已用的颜色：35讲=`blue`，36讲=`amber`，34讲=`violet`。

---

## 快速检查清单

添加第 N 讲时，逐项确认：

```
src/utils/
  [ ] lessonN-data.ts                    — 数据文件（题目内容，ID 必须加 N- 前缀）

src/components/math/lessonN/
  [ ] LessonNProvider.tsx
  [ ] AppHeader.tsx
  [ ] Sidebar.tsx
  [ ] BottomNav.tsx
  [ ] HomePage.tsx
  [ ] FilterPanel.tsx
  [ ] ProblemList.tsx                    — 仅当新讲次 TAG_STYLE 与 35 不同时需要复制

src/app/math/ny/N/
  [ ] layout.tsx
  [ ] page.tsx
  [ ] lesson/page.tsx
  [ ] lesson/[id]/page.tsx
  [ ] homework/page.tsx
  [ ] homework/[id]/page.tsx
  [ ] workbook/page.tsx
  [ ] workbook/[id]/page.tsx
  [ ] pretest/page.tsx
  [ ] pretest/[id]/page.tsx              — 若无课前测题目，页面可显示空提示
  [ ] supplement/page.tsx                — 仅有补充题时需要
  [ ] supplement/[id]/page.tsx           — 仅有补充题时需要
  [ ] alltest/page.tsx
  [ ] mistakes/page.tsx

src/app/math/
  [ ] page.tsx                             — 在 courses 数组最前面追加新讲次卡片（第四步）
```

---

## 使用方式

下次告诉 Claude：

> "按照 `docs/add-new-lesson.md` 的指引，帮我添加第36讲，题目内容如下：（PDF 内容）"

Claude 会按照本指引直接生成所有文件。
