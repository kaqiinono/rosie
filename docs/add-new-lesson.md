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

## 读取题目文件的正确流程

题目文件可以是 **PDF、TXT、MD** 中的任意一种或多种，处理方式相同。

**在录入任何题目之前，必须先通读全部内容，确认题目总数。**

1. 读完所有内容，列出每道题的标题/关键数字
2. 确认总题数（例："共 12 道：例题1-6 + 练一练1-6"）
3. 确认后再逐题录入，避免因未读完而遗漏后续模块

> 反例：只读到模块1就开始录入，结果模块2的8道题全部遗漏。

---

## 关于不完整的题目文件

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

> **分工说明：你只需提供题目文件（PDF / TXT / MD 均可），Claude 从文件中读取所有题目内容并生成该文件，不需要你手动填写。**

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

> **分工说明：你只需提供题目文件（PDF / TXT / MD 均可），Claude 负责提取内容并生成所有代码，不需要你手动填写任何字段。**

首页由两个地方的内容拼合而成：**数据文件**（题型定义）+ **HomePage 组件**（文案和模块描述）。
以下是 Claude 从文件中提取的 6 类信息及其对应代码位置：

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

对每一种题型，从文件中提取：

| 字段 | 说明 | 示例 |
|------|------|------|
| `tag` | 代码标识，按顺序编号 | `type1`、`type2` |
| `color` | 主色调名称（Tailwind 颜色） | `blue`、`green`、`orange`、`purple`、`red`、`pink` |
| `label` | 显示名称 | `题型1 · 直接归一` |
| `desc` | 题型特征一句话描述 | `明确要求先求1份，÷份数→×目标份数。` |
| `example` | 典型例子（简短） | `例：2分钟6只→1分钟→5分钟` |

`TYPE_STYLE` 和 `TAG_STYLE` 根据 `color` 字段自动对应 Tailwind 色系，无需单独提取。

#### 5. 各模块题目数量 → 填入 `HomePage.tsx` 的 `MODULES` 描述

从文件中统计题目数量（共 7 个导航模块，各自说明如下）：

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

## 第三步：新建组件目录

新建目录：`src/components/math/lesson{N}/`

所有讲次共享 `src/components/math/shared/` 中的基础组件，每个讲次只需创建轻量 wrapper。共 6 个文件，其中 4 个是极简 wrapper，2 个（`ProblemDetail`、`FilterPanel`、`HomePage`）有实质内容。

### `Lesson{N}Provider.tsx`（5 行）

```typescript
'use client'

import { createLessonProvider } from '@/components/math/shared/createLessonProvider'

const { Provider, useLessonContext } = createLessonProvider('Lesson{N}')

export default Provider
export { useLessonContext as useLesson{N} }
```

### `AppHeader.tsx`

```typescript
'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@/utils/type'
import { useLesson{N} } from './Lesson{N}Provider'

const CONFIG = {
  basePath: '/math/ny/{N}',
  emoji: '✂️',               // 讲次主题 emoji
  titleShort: '间隔',        // 2-3个字的主题简称
  titleFull: '探险',
  titleColor: 'text-sky-700',
  navActiveColor: 'text-sky-700',
  navActiveBorderColor: '#0369a1',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson{N}} />
}
```

### `Sidebar.tsx`

```typescript
'use client'

import LessonSidebar from '@/components/math/shared/LessonSidebar'
import type { ProblemSet } from '@/utils/type'
import { useLesson{N} } from './Lesson{N}Provider'

const BASE = '/math/ny/{N}'

const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-sky-50 font-bold text-sky-700',
  sections: [
    { key: 'pretest',  path: `${BASE}/pretest`,  icon: '📝', label: '课前测' },
    { key: 'lesson',   path: `${BASE}/lesson`,   icon: '📖', label: '课堂讲解' },
    { key: 'homework', path: `${BASE}/homework`, icon: '✏️', label: '课后巩固' },
    { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', label: '拓展练习' },
    // { key: 'supplement', path: `${BASE}/supplement`, icon: '📒', label: '附加题' },
    { key: 'alltest',  path: `${BASE}/alltest`,  icon: '🎯', label: '综合题库' },
  ],
  extraLinks: [],
} as const

export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useLesson{N}} />
}
```

> **补充题时**：在 sections 中 workbook 后面加入 `{ key: 'supplement', ... }` 条目。

### `BottomNav.tsx`

```typescript
'use client'

import LessonBottomNav from '@/components/math/shared/LessonBottomNav'
import { useLesson{N} } from './Lesson{N}Provider'

const CONFIG = {
  basePath: '/math/ny/{N}',
  activeColor: 'text-sky-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson{N}} />
}
```

### `ProblemList.tsx`

```typescript
'use client'

import LessonProblemList from '@/components/math/shared/LessonProblemList'
import type { Problem } from '@/utils/type'
import { TAG_STYLE } from '@/utils/lesson{N}-data'

type Props = {
  problems: Problem[]
  solveCount: Record<string, number>
  basePath: string
  showSource?: boolean
  sourceLabel?: string
}

export default function ProblemList({ problems, solveCount, basePath, showSource, sourceLabel }: Props) {
  return (
    <LessonProblemList
      problems={problems}
      solveCount={solveCount}
      basePath={basePath}
      lessonId="{N}"
      tagStyles={TAG_STYLE}
      showSource={showSource}
      sourceLabel={sourceLabel}
    />
  )
}
```

### `ProblemDetail.tsx`

每讲独立，使用共享的 `QuestionLayout` 组件。结构模板：

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Problem } from '@/utils/type'
import { TAG_STYLE } from '@/utils/lesson{N}-data'
import { useLesson{N} } from './Lesson{N}Provider'
import { getMasteryLevel, MASTERY_ICON, MASTERY_BADGE_BG } from '@/utils/masteryUtils'
import QuestionLayout from '@/components/math/shared/QuestionLayout'

interface ProblemDetailProps {
  problem: Problem
  mode?: 'full' | 'inline'
}

export default function ProblemDetail({ problem, mode = 'full' }: ProblemDetailProps) {
  const router = useRouter()
  const { solveCount, handleSolve, addWrong } = useLesson{N}()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    setAnswer('')
    setFeedback(null)
  }, [problem.id])

  function checkAnswer() {
    if (!answer) return
    const v = Number(answer)
    if (v === problem.finalAns) {
      setFeedback({ text: '🎉 完全正确！你真棒！', ok: true })
      handleSolve(problem.id)
    } else {
      setFeedback({ text: `❌ 不对哦，再想想？提示：答案是 ${problem.finalAns} 以内的数。`, ok: false })
      addWrong(problem.id)
    }
  }

  const solution = (
    <div className="mb-3.5 rounded-lg border border-[#fde68a] bg-gradient-to-br from-[#fffbeb] to-yellow-light p-3.5">
      <div className="mb-1.5 flex items-center gap-1 text-xs font-bold text-yellow-dark">🔍 题型分析</div>
      <ul className="flex flex-col gap-1.5">
        {problem.analysis.map((a, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-[#92400e]">
            <span className="shrink-0">💡</span>{a}
          </li>
        ))}
      </ul>
    </div>
  )

  const question = (
    <div className="flex flex-col gap-1.5">
      <div className="min-w-0 flex-1">
        <span className={`mb-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] ?? 'bg-gray-100 text-gray-600'}`}>
          {problem.tagLabel}
        </span>
        <div
          className="mb-3.5 rounded-lg border-l-3 border-[主题色]-300 bg-[主题色]-50 px-3.5 py-3 text-sm leading-relaxed text-text-secondary [&>strong]:font-bold [&>strong]:text-text-primary"
          dangerouslySetInnerHTML={{ __html: problem.text }}
        />
      </div>
      <div>{problem.figureNode}</div>
    </div>
  )

  const answerDom = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-border-light" />
        <div className="whitespace-nowrap text-xs font-semibold text-text-muted">✏️ 写出答案</div>
        <div className="h-px flex-1 bg-border-light" />
      </div>
      <div className="mb-3 rounded-lg border border-dashed border-border-light bg-[#f9fafb] p-3.5">
        <div className="text-[13px] text-text-secondary">{problem.finalQ}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <input type="number"
            className="w-[72px] rounded-lg border border-border-light px-2 py-1.5 text-center text-sm"
            placeholder="？" value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkAnswer()} />
          <span>{problem.finalUnit}</span>
          <button onClick={checkAnswer}
            className="cursor-pointer rounded-full bg-[主题色]-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[...] transition-all active:translate-y-px">
            检查答案
          </button>
        </div>
        {feedback && (
          <div className={`mt-2 text-[13px] ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'}`}>
            {feedback.text}
          </div>
        )}
      </div>
    </>
  )

  return (
    <div>
      {mode === 'full' && (
        <div className="mb-4 flex items-center gap-2.5 border-b border-border-light pb-3.5">
          <button onClick={() => router.back()}
            className="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-gray-100 text-lg transition-colors hover:bg-gray-200">
            ‹
          </button>
          <div className="flex-1 text-[17px] font-bold">{problem.title}</div>
          <div className={`flex h-[30px] min-w-[30px] items-center justify-center rounded-full px-1.5 text-sm font-bold ${MASTERY_BADGE_BG[level]}`}>
            {MASTERY_ICON[level]}
          </div>
        </div>
      )}
      <QuestionLayout question={question} solution={solution} answer={answerDom} />
    </div>
  )
}
```

> **主题色**：每讲替换为对应的 Tailwind 颜色名（如 `amber`、`sky`、`green`），与 AppHeader / Sidebar 的颜色保持一致。

### `HomePage.tsx`

```tsx
'use client'

import Link from 'next/link'
import type { ProblemSet, Problem } from '@/utils/type'
import { PROBLEM_TYPES, TYPE_STYLE } from '@/utils/lesson{N}-data'

const BASE = '/math/ny/{N}'

interface HomePageProps {
  problems: ProblemSet
  solveCount: Record<string, number>
}

// ✏️ 按实际模块调整（无补充题则删掉 supplement 行）
const MODULES = [
  { key: 'pretest',  path: `${BASE}/pretest`,  icon: '📝', bg: 'bg-[#fef9c3]',       title: '课前测',   desc: 'N道摸底题 · 检验起始水平' },
  { key: 'lesson',   path: `${BASE}/lesson`,   icon: '📖', bg: 'bg-app-blue-light',   title: '课堂讲解', desc: '例题1-N · [题型描述]' },
  { key: 'homework', path: `${BASE}/homework`, icon: '✏️', bg: 'bg-app-green-light',  title: '课后巩固', desc: '巩固1-N · 强化练习' },
  { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', bg: 'bg-app-purple-light', title: '拓展练习', desc: '闯关1-N · 综合挑战' },
  // { key: 'supplement', path: `${BASE}/supplement`, icon: '📒', bg: 'bg-amber-50', title: '附加题', desc: 'N道附加题 · 深度提升' },
]

export default function HomePage({ problems, solveCount }: HomePageProps) {
  const totalAll = Object.values(problems).reduce((s, l) => s + l.length, 0)
  const allProblemIds = new Set((Object.values(problems) as Problem[][]).flatMap(list => list.map(p => p.id)))
  const masteredAll = Object.entries(solveCount).filter(([id, c]) => allProblemIds.has(id) && c >= 3).length
  const attemptedAll = Object.entries(solveCount).filter(([id, c]) => allProblemIds.has(id) && c >= 1).length

  function getProgress(key: string) {
    const list = problems[key as keyof ProblemSet]
    if (!list) return { mastered: 0, attempted: 0, total: 0 }
    return {
      mastered: list.filter(p => (solveCount[p.id] ?? 0) >= 3).length,
      attempted: list.filter(p => (solveCount[p.id] ?? 0) >= 1).length,
      total: list.length,
    }
  }

  return (
    <div>
      {/* Hero — ✏️ 替换主题色和文案 */}
      <div className="relative mb-5 overflow-hidden rounded-[14px] bg-gradient-to-br from-[主题色]-50 via-[主题色浅] to-[主题色亮] p-6">
        <div className="pointer-events-none absolute -right-2.5 -top-2.5 text-[90px] opacity-[0.12] rotate-[15deg]">
          [emoji]
        </div>
        <h1 className="mb-1.5 text-2xl font-extrabold text-[主题色]-900">[主题名] [emoji]</h1>
        <p className="text-[13px] leading-relaxed text-[主题色]-800">
          第{N}讲 · 一年级目标班<br />[一句话描述]
        </p>
      </div>

      {/* Problem Types */}
      <div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold">🧠 [主题名] · N大题型</div>
        <div className="mb-3 text-[13px] leading-relaxed text-text-secondary">
          <strong className="text-text-primary">核心公式：</strong>
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">[公式]</code>
          [核心原理一句话描述]
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEM_TYPES.map(t => {
            const style = TYPE_STYLE[t.tag]
            return (
              <Link
                key={t.tag}
                href={`${BASE}/alltest?type=${t.tag}`}
                className={`rounded-r-lg border-l-3 p-3 no-underline ${style.bg} ${style.border} transition-all hover:shadow-md`}
              >
                <div className={`mb-1 flex items-center justify-between text-xs font-bold ${style.titleColor}`}>
                  {t.label}
                  <span className="text-[10px] opacity-60">点击查看题目→</span>
                </div>
                <div className={`text-xs leading-relaxed ${style.textColor}`}>
                  {t.desc}
                  <em className="mt-0.5 block opacity-80">{t.example}</em>
                </div>
              </Link>
            )
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-[主题色]-50 p-3">
          <span className="shrink-0 text-base">⭐</span>
          <span className="text-xs leading-relaxed text-[主题色]-800">
            万能口诀：<strong>[口诀内容]</strong>
          </span>
        </div>
      </div>

      {/* Module Cards */}
      <div className="mb-2.5 text-[13px] font-bold text-text-secondary">📂 学习模块</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map(m => {
          const prog = getProgress(m.key)
          const masteredPct = prog.total > 0 ? Math.round((prog.mastered / prog.total) * 100) : 0
          const attemptedPct = prog.total > 0 ? Math.round((prog.attempted / prog.total) * 100) : 0
          return (
            <Link
              key={m.key}
              href={m.path}
              className="flex items-center gap-3 rounded-[14px] border-2 border-transparent bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] active:scale-[0.98]"
            >
              <div className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl text-[22px] ${m.bg}`}>
                {m.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-text-primary">{m.title}</div>
                <div className="mb-1 text-xs text-text-muted">{m.desc}</div>
                <div className="flex items-center gap-1.5">
                  <div className="relative h-1 flex-1 overflow-hidden rounded-sm bg-gray-100">
                    <div className="absolute inset-y-0 left-0 rounded-sm bg-gray-300 transition-[width] duration-500"
                      style={{ width: `${attemptedPct}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-sm bg-app-green transition-[width] duration-500"
                      style={{ width: `${masteredPct}%` }} />
                  </div>
                  <div className="whitespace-nowrap text-[11px] text-text-muted">
                    ✅ {prog.mastered}/{prog.total}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-xl text-text-muted">›</div>
            </Link>
          )
        })}

        {/* All-test card — ✏️ 替换主题色 */}
        <Link
          href={`${BASE}/alltest`}
          className="flex items-center gap-3 rounded-[14px] border-2 border-[主题色]-300 bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] active:scale-[0.98]"
        >
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-[主题浅背景] text-[22px]">
            🎯
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[主题色]-700">综合题库</div>
            <div className="mb-1 text-xs text-text-muted">全部题目 · 按题型/来源筛选 · 综合训练</div>
            <div className="flex items-center gap-1.5">
              <div className="relative h-1 flex-1 overflow-hidden rounded-sm bg-gray-100">
                <div className="absolute inset-y-0 left-0 rounded-sm bg-[主题色]-200 transition-[width] duration-500"
                  style={{ width: `${totalAll > 0 ? Math.round((attemptedAll / totalAll) * 100) : 0}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-sm bg-[主题色]-500 transition-[width] duration-500"
                  style={{ width: `${totalAll > 0 ? Math.round((masteredAll / totalAll) * 100) : 0}%` }} />
              </div>
              <div className="whitespace-nowrap text-[11px] text-text-muted">
                ✅ {masteredAll}/{totalAll}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-xl text-[主题色]-500">›</div>
        </Link>
      </div>
    </div>
  )
}
```

---

## 第三步（路由）：新建路由目录（12-14 个页面文件）

新建目录：`src/app/math/ny/36/`

### `layout.tsx`

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson{N}-data'
import Lesson{N}Provider, { useLesson{N} } from '@/components/math/lesson{N}/Lesson{N}Provider'
import AppHeader from '@/components/math/lesson{N}/AppHeader'
import Sidebar from '@/components/math/lesson{N}/Sidebar'
import BottomNav from '@/components/math/lesson{N}/BottomNav'
import CongratsModal from '@/components/math/lesson35/CongratsModal'
import Toast from '@/components/math/lesson35/Toast'

const SECTION_COUNTS: Record<string, number> = {
  pretest: PROBLEMS.pretest.length,
  lesson: PROBLEMS.lesson.length,
  homework: PROBLEMS.homework.length,
  workbook: PROBLEMS.workbook.length,
  // supplement: PROBLEMS.supplement?.length ?? 0,  // 有补充题时取消注释
}

function getNextHref(pathname: string): string | undefined {
  const parts = pathname.split('/')
  const section = parts[4]
  const index = parseInt(parts[5])
  if (!section || isNaN(index)) return undefined
  const total = SECTION_COUNTS[section]
  if (!total || index >= total) return undefined
  return `/math/ny/{N}/${section}/${index + 1}`
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { toast, setToast, showCongrats, setShowCongrats } = useLesson{N}()
  const pathname = usePathname()
  const nextHref = getNextHref(pathname)

  return (
    <div
      className="flex min-h-screen flex-col bg-[主题背景色] text-[15px] text-text-primary"
      style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }}
    >
      <AppHeader problems={PROBLEMS} />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 pb-[60px] md:pb-0">
        <Sidebar problems={PROBLEMS} />
        <div className="min-w-0 flex-1 overflow-y-auto p-5 md:px-8 md:py-6">
          {children}
        </div>
      </div>
      <BottomNav />
      <CongratsModal visible={showCongrats} onClose={() => setShowCongrats(false)} nextHref={nextHref} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default function Lesson{N}Layout({ children }: { children: React.ReactNode }) {
  return (
    <Lesson{N}Provider>
      <InnerLayout>{children}</InnerLayout>
    </Lesson{N}Provider>
  )
}
```

> **主题背景色** 颜色参考（与 AppHeader `titleColor` 同色系的极浅色）：
> - sky 主题 → `bg-[#f0f9ff]`；amber 主题 → `bg-[#fffbeb]`；green 主题 → `bg-[#f0fdf4]`

### `page.tsx`（讲次首页 hub）

```tsx
'use client'

import { PROBLEMS } from '@/utils/lesson{N}-data'
import { useLesson{N} } from '@/components/math/lesson{N}/Lesson{N}Provider'
import HomePage from '@/components/math/lesson{N}/HomePage'

export default function Lesson{N}Page() {
  const { solveCount } = useLesson{N}()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
```

### `lesson/page.tsx`、`homework/page.tsx`、`workbook/page.tsx`、`pretest/page.tsx`

各页面结构完全相同，只替换颜色和文案。以 `lesson/page.tsx` 为完整模板：

```tsx
'use client'

import { PROBLEMS } from '@/utils/lesson{N}-data'
import { useLesson{N} } from '@/components/math/lesson{N}/Lesson{N}Provider'
import ProblemList from '@/components/math/lesson{N}/ProblemList'

export default function LessonPage() {
  const { solveCount } = useLesson{N}()
  const list = PROBLEMS.lesson        // ✏️ homework/workbook/pretest 时改为对应字段
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-blue-200 bg-gradient-to-br from-blue-50 to-[#dbeafe] p-4">
        {/* ✏️ 各模块色系：lesson=blue, homework=green, workbook=purple, pretest=yellow */}
        <div className="mb-1 text-sm font-extrabold text-blue-900">📖 课堂讲解 · 第{N}讲</div>
        <div className="mb-2 text-xs text-blue-700">{total}道例题 · [题型描述]</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-blue-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-blue-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-blue-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/{N}/lesson" />
      {/* ✏️ basePath 末尾改为对应 section 名 */}
    </div>
  )
}
```

| 模块 | `PROBLEMS.xxx` | 图标+标题 | 色系 |
|------|---------------|-----------|------|
| `lesson/page.tsx` | `.lesson` | `📖 课堂讲解` | `blue` |
| `homework/page.tsx` | `.homework` | `✏️ 课后巩固` | `green` |
| `workbook/page.tsx` | `.workbook` | `📚 拓展练习` | `purple` |
| `pretest/page.tsx` | `.pretest` | `📝 课前测` | `yellow` |

### `lesson/[id]/page.tsx`、`homework/[id]/page.tsx`、`workbook/[id]/page.tsx`、`pretest/[id]/page.tsx`

所有详情页结构完全相同，只替换 section 名：

```tsx
'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson{N}-data'
import ProblemDetail from '@/components/math/lesson{N}/ProblemDetail'

export default function LessonProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const index = parseInt(id) - 1
  const list = PROBLEMS.lesson   // ✏️ 改为对应 section：lesson/homework/workbook/pretest
  const problem = list[index]
  if (!problem) notFound()
  return <ProblemDetail problem={problem} />
}
```

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
            {/* ✏️ 来源标签背景/文字改为讲次主题色 */}
            <span className="rounded-full bg-[主题浅背景] px-2 py-px text-[10px] font-semibold text-[主题色]-700">{srcLabel}</span>
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

  // ✏️ btnOn/btnOff 和筛选面板颜色使用讲次主题色（下方以 sky 为例，替换为实际颜色）
  const btnBase = 'cursor-pointer rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95'
  const btnOn  = 'border-[主题色]-600 bg-[主题色]-600 text-white'
  const btnOff = 'border-[主题色]-300 bg-[主题浅背景] text-[主题色]-700'

  return (
    <div>
      {/* ✏️ border/bg/text 替换为讲次主题色 */}
      <div className="mb-3 rounded-[14px] border border-[主题色]-200 bg-gradient-to-br from-[主题浅背景] to-[主题色]-100 p-4">
        <div className="mb-1.5 text-[15px] font-extrabold text-[主题色]-800">🎯 综合题库 · 第N讲</div>
        <div className="mb-2.5 text-xs text-[主题色]-700">全部{total}道题 · 多选筛选 · 按题型/来源练习</div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-[主题色]-700">📂 来源筛选</div>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_BTNS.map(b => (
              <button key={b.key} onClick={() => onToggleFilter('source', b.key)}
                className={`${btnBase} ${filters.source.has(b.key) ? btnOn : btnOff}`}>{b.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-[主题色]-700">🏷️ 题型筛选</div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_BTNS.map(b => (
              <button key={b.key} onClick={() => onToggleFilter('type', b.key)}
                className={`${btnBase} ${filters.type.has(b.key) ? btnOn : btnOff}`}>{b.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-[主题色]-700">🎯 掌握度</div>
          <div className="flex flex-wrap gap-1.5">
            {MASTERY_BTNS.map(b => (
              <button key={b.key} onClick={() => onSetMastery(b.key)}
                className={`${btnBase} ${filters.mastery === b.key ? btnOn : btnOff}`}>{b.label}</button>
            ))}
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[主题色]-700">
            <span>练过 <strong className="text-[主题色]-800">{attempted}</strong> 道</span>
            <span className="text-[主题色]-300">·</span>
            <span>🦋 掌握 <strong className="text-[主题色]-800">{mastered}</strong> 道</span>
            <span className="text-[主题色]-300">·</span>
            <span>共 {total} 题</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-[主题色]-100">
              <div className="absolute inset-y-0 left-0 rounded-full bg-[主题色]-200 transition-[width] duration-400"
                style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-[主题色]-500 transition-[width] duration-400"
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

## 第五步：在题海中注册新讲次

**文件：** `src/utils/sea-data.ts`

`/math/sea` 是跨讲次综合题库页面，所有课程的题目汇总来自 `SEA_LESSONS` 数组。每新增一讲，**必须**在此文件中手动注册，否则该讲次的题目不会出现在题海搜索、筛选和随机练中。

### 5-A 添加 import

在文件顶部已有 import 行之后仿照格式添加：

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

### `badgeClass` 颜色参考

| 讲次 | badgeClass |
|------|------------|
| 34 | `bg-violet-100 text-violet-700` |
| 35 | `bg-blue-100 text-blue-700` |
| 36 | `bg-amber-100 text-amber-700` |
| 37 | `bg-orange-100 text-orange-700` |
| 38 | `bg-purple-100 text-purple-700` |
| 39 | `bg-teal-100 text-teal-700` |

新讲次选一个未使用的颜色，如 `rose`、`green`、`cyan`、`sky` 等。

> **注意：** `SEA_POOL` 由 `buildPool()` 在模块加载时自动构建，无需手动更新。`MathSeaCard` 首页卡片显示的总题数也会自动更新。

---

## 第六步：在每日计划页注册新讲次

`/math/ny/plan` 是按周安排的"数学每日一练"页面。该页面的可选讲次列表是**两份硬编码清单**，每新增一讲必须**同时**更新两个文件，否则用户在每日一练里看不到新讲次的题目。

### 6-A 在 `src/app/math/ny/plan/page.tsx` 中注册数据源

在文件顶部已有 import 行之后追加：

```typescript
import { PROBLEMS as PROBLEMSN } from '@/utils/lessonN-data'
```

并在 `PROBLEM_SETS` 对象中追加一项：

```typescript
const PROBLEM_SETS: Record<string, ProblemSet> = {
  // ...已有讲次
  'N': PROBLEMSN,
}
```

### 6-B 在 `src/components/math/MathWeeklyPractice.tsx` 中追加讲次选项

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

### 颜色参考

| 讲次 | RGB |
|------|-----|
| 34 乘法分配律 | `rgba(159,130,246,*)` 紫 |
| 35 归一问题 | `#3b82f6` 蓝 |
| 36 星期几问题 | `rgba(245,158,11,*)` 琥珀 |
| 37 鸡兔同笼 | `rgba(133,200,11,*)` 黄绿 |
| 38 一笔画 | `rgba(236,72,153,*)` 玫红 |
| 39 盈亏问题 | `rgba(16,185,129,*)` 翠绿 |
| 40 周长问题 | `rgba(99,102,241,*)` 靛蓝 |
| 41 间隔趣题 | `rgba(249,115,22,*)` 橙 |

新讲次选一个未使用的颜色，如 `rgba(14,165,233,*)`（天蓝）、`rgba(168,85,247,*)`（紫罗兰）等。

> **注意：** `MathWeeklyPractice` 组件内部仅依赖 `lesson` / `homework` / `workbook` / `pretest` 四个 section 来生成每日计划，`supplement` 不计入。无需为没有 supplement 的讲次做任何特殊处理。

---

## 快速检查清单

添加第 N 讲时，逐项确认：

```
src/utils/
  [ ] lessonN-data.ts                    — 数据文件（题目内容，ID 必须加 N- 前缀）
  [ ] sea-data.ts                        — 在 SEA_LESSONS 末尾注册新讲次（第五步）

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

每日计划页（第六步，两个文件必须同步更新）：
  [ ] src/app/math/ny/plan/page.tsx              — 添加 import 并在 PROBLEM_SETS 中注册新讲次
  [ ] src/components/math/MathWeeklyPractice.tsx — 在 LESSONS 数组末尾追加新讲次配置
```

---

## 使用方式

下次告诉 Claude：

> "按照 `docs/add-new-lesson.md` 的指引，帮我添加第36讲，题目内容如下：（附上 PDF / TXT / MD 文件）"

Claude 会按照本指引直接生成所有文件。
