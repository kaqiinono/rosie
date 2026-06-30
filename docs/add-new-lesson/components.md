# 组件目录（必读）

新建目录：`packages/math/src/components/lesson{N}/`

所有讲次共享 `packages/math/src/components/shared/` 中的基础组件，每个讲次只需创建轻量 wrapper。共 8 个文件，其中 6 个是极简 wrapper（含 `FilterPanel` 使用 `createFilterPanel` 工厂），`ProblemDetail` 与 `HomePage` 有实质内容。

> 最省事的做法：复制一个**结构相近的已有讲次**（如纯文字题参考 lesson41，有交互组件参考 lesson47），
> 然后按本文件替换颜色/文案/标识符。下面给出每个文件的模板。

---

## HomePage 内容提取（原第二步）

首页由两个地方的内容拼合：**数据文件**（题型定义）+ **HomePage 组件**（文案和模块描述）。
从题目文件中提取以下 6 类信息：

### 1. 讲次基本信息 → `HomePage.tsx` Hero 区域

| 字段 | 示例（lesson35） | 说明 |
|------|-----------------|------|
| 讲次主题 | `归一问题` | 这一讲的核心知识点名称 |
| 讲次标题行 | `第35讲 · 一年级目标班` | 讲次编号 + 班级 |
| 一句话描述 | `学会用倍比图解决归一问题！` | 学完能做什么 |
| 配套 emoji | `🎯` | 主题对应的 emoji |

### 2. 核心公式/本质 → `HomePage.tsx` 题型说明区域

```
核心本质：[用一句话描述这类题的数量关系]
公式：[关键公式，如 总量 = 份数 × 每份数]
```

### 3. 万能口诀 → `HomePage.tsx` 底部提示框

```
万能口诀：[解题步骤的记忆口诀，如 先归一（÷份数）→ 找每份量 → 再求多（×份数）]
```

### 4. 题型列表 → 数据文件 `PROBLEM_TYPES` + `TYPE_STYLE` + `TAG_STYLE`

对每一种题型，从文件中提取：

| 字段 | 说明 | 示例 |
|------|------|------|
| `tag` | 代码标识，按顺序编号 | `type1`、`type2` |
| `color` | 主色调名称（Tailwind 颜色） | `blue`、`green`、`orange`、`purple`、`red`、`pink` |
| `label` | 显示名称 | `题型1 · 直接归一` |
| `desc` | 题型特征一句话描述 | `明确要求先求1份，÷份数→×目标份数。` |
| `example` | 典型例子（简短） | `例：2分钟6只→1分钟→5分钟` |

`TYPE_STYLE` 和 `TAG_STYLE` 根据 `color` 字段自动对应 Tailwind 色系。

### 5. 各模块题目数量 → `HomePage.tsx` 的 `MODULES` 描述

| 模块 | 首页卡片 | 描述模板 / 说明 |
|------|---------|----------------|
| 课堂讲解 | ✅ 需填写 | `例题1-N · [主要题型列表]` |
| 课后巩固 | ✅ 需填写 | `巩固1-N · 强化练习` |
| 练习册 | ✅ 需填写 | `闯关1-N · 综合挑战` |
| 课前测 | ✅ 需填写 | `N道摸底题 · 检验起始水平` |
| 补充题 | ✅ 有则填写 | `N道速算 · [主题描述]`（无补充题则不添加此模块卡片） |
| 综合题库 | 无需填写 | 首页有独立宽卡片，文案固定，总题数自动从 PROBLEMS 汇总 |
| 错题本 | ❌ 不在首页 | 仅出现在侧边栏和底部导航 |

### 数据文件题型定义代码位置

```typescript
export const PROBLEM_TYPES = [
  { tag: 'type1', color: 'blue', label: '题型1 · [名称]', desc: '[题型特征描述]', example: '例：[典型例子]' },
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
}
```

---

## `Lesson{N}Provider.tsx`（5 行）

```typescript
'use client'

import { createLessonProvider } from '@rosie/math/components/shared/createLessonProvider'

const { Provider, useLessonContext } = createLessonProvider('Lesson{N}')

export default Provider
export { useLessonContext as useLesson{N} }
```

## `AppHeader.tsx`

```typescript
'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
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

## `Sidebar.tsx`

```typescript
'use client'

import LessonSidebar from '@rosie/math/components/shared/LessonSidebar'
import type { ProblemSet } from '@rosie/core'
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

## `BottomNav.tsx`

```typescript
'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson{N} } from './Lesson{N}Provider'

const CONFIG = {
  basePath: '/math/ny/{N}',
  activeColor: 'text-sky-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson{N}} />
}
```

## `ProblemList.tsx`

共享 `LessonProblemList` 已内置 **收藏 ❤️** 与 **练习次数徽章**（`FavoriteHeart` / `PracticeCountBadge`），新讲次 `ProblemList` wrapper 无需额外改动。

```typescript
'use client'

import LessonProblemList from '@rosie/math/components/shared/LessonProblemList'
import type { Problem } from '@rosie/core'
import { TAG_STYLE } from '@rosie/math/utils/lesson{N}-data'

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

## `ProblemDetail.tsx`

每讲独立。**不要从零写大段模板**——复制 **lesson41**（数字答案 + `NumericAnswerPanel` + `useProblemAnswer`）或 **lesson47**（交互组件 + `injectFigureGridCallbacks`），只改主题色与题型 UI。

### 必须接入的共享组件（`mode === 'full'` 时）

| 组件 | 作用 |
|------|------|
| `LessonProblemDetailHeader` | 返回、标题、**练习次数徽章**、**收藏 ❤️**、掌握度 |
| `LessonProblemNavBar` | **上一题 / 下一题**（同 section 内翻页）+ `N / 总数` |

`ProblemDetailProps` **必须**包含导航 props（由路由壳注入，inline 模式不传）：

```typescript
interface ProblemDetailProps {
  problem: Problem
  mode?: 'full' | 'inline'
  tip?: string                    // 部分讲次有口诀
  defaultSolutionOpen?: boolean
  prevHref?: string | null
  nextHref?: string | null
  positionLabel?: string
}
```

`return` 骨架（与 lesson41 一致）：

```tsx
return (
  <div>
    {mode === 'full' && (
      <LessonProblemDetailHeader
        problemId={problem.id}
        title={problem.title}
        masteryLevel={level}
        practiceCount={count}
      />
    )}
    <QuestionLayout question={question} solution={solution} answer={answerDom} defaultSolutionOpen={defaultSolutionOpen} />
    {mode === 'full' && positionLabel && (
      <LessonProblemNavBar prevHref={prevHref} nextHref={nextHref} positionLabel={positionLabel} />
    )}
  </div>
)
```

> **主题色**：每讲替换为对应的 Tailwind 颜色名，与 AppHeader / Sidebar 保持一致。
> **交互组件题（无数字答案）**：见 `figures.md`「交互式组件题」；参考 lesson47 的 `ProblemDetail`。
> **题解配图**：`problem.analysisImg` + `AnalysisImage`（lesson41/42 已接入）。

## `HomePage.tsx`

```tsx
'use client'

import Link from 'next/link'
import type { ProblemSet, Problem } from '@rosie/core'
import { PROBLEM_TYPES, TYPE_STYLE } from '@rosie/math/utils/lesson{N}-data'

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

## `FilterPanel.tsx`

使用共享工厂 `createFilterPanel`，只需传入配置和 `ProblemDetail` 组件：

```tsx
'use client'

import { createFilterPanel } from '@rosie/math/components/shared/FilterPanel'
import ProblemDetail from './ProblemDetail'

export type { Filters, MasteryFilter, PracticeFilter, FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'

export default createFilterPanel({
  base: '/math/ny/N',
  title: '🎯 综合题库 · 第N讲',
  theme: {
    btnOn:              'border-sky-600 bg-sky-600 text-white',       // ✏️ 替换为讲次主题色
    btnOff:             'border-sky-300 bg-[#f0f9ff] text-sky-700',
    containerBorder:    'border-sky-200',
    containerGradient:  'bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe]',
    titleColor:         'text-sky-800',
    labelColor:         'text-sky-700',
    toggleColor:        'text-sky-500 hover:text-sky-700',
    progressTrack:      'bg-sky-100',
    progressAttempted:  'bg-sky-200',
    progressMastered:   'bg-sky-500',
    dotColor:           'text-sky-300',
    strongColor:        'text-sky-800',
    srcBadge:           'bg-[#e0f2fe] text-[#0369a1]',
    accentClass:        'text-sky-700',
  },
  // ✏️ 按实际讲次调整（包含 supplement 时加上）
  sourceBtns: [
    { key: 'pretest',    label: '📝 课前测' },
    { key: 'lesson',     label: '📖 课堂' },
    { key: 'homework',   label: '✏️ 课后' },
    { key: 'workbook',   label: '📚 拓展' },
    // { key: 'supplement', label: '📒 附加' },
  ],
  // ✏️ 按实际讲次题型调整（tag/label 与 PROBLEM_TYPES 对应）
  typeBtns: [
    { key: 'type1', label: '题型1·XXX' },
    { key: 'type2', label: '题型2·XXX' },
  ],
  // ✏️ 与 PROBLEM_TYPES 的 color 字段对应
  tagColors: {
    type1: 'bg-blue-100 text-blue-800',
    type2: 'bg-green-100 text-green-800',
  },
}, ProblemDetail)
```

共享工厂 `createFilterPanel`（`packages/math/src/components/shared/FilterPanel.tsx`）内置了来源/题型/难度/**练习（未练习/练过）**/掌握度筛选、⭐只看收藏、题解自动展开、展开/收起详情卡片等全部功能。新讲次无需编写任何 JSX。

`theme` 颜色参考（已有讲次）：

| 讲次 | 主色 | btnOn 前缀 |
|------|------|-----------|
| 34 | amber | `border-amber-500 bg-amber-500` |
| 35 | purple | `border-purple-500 bg-purple-500` |
| 36-39 | purple (hex) | `border-[#a855f7] bg-[#a855f7]` |
| 40 | green | `border-green-600 bg-green-600` |
| 41 | sky | `border-sky-600 bg-sky-600` |
| 42 | rose | `border-rose-600 bg-rose-600` |
| 43 | cyan | `border-cyan-600 bg-cyan-600` |
