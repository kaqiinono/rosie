# 数学题目收藏 + 练习次数显示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让数学模块每道题都能收藏、每张题卡都显示练习次数（0 次醒目高亮），并提供「我的收藏」页和收藏题成套连刷。

**Architecture:** 数据层新增 `math_favorites` 表 + `useMathFavorites` hook（对称于现有 `math_wrong`）。一个 `MathFavoritesProvider` context 挂在新建的 `apps/web/src/app/math/layout.tsx`，整个 `/math/**` 共享一份收藏状态。叶子组件 `FavoriteHeart`（消费 context，只需 `problemId`）+ `PracticeCountBadge`（接收 `count`）插入所有题卡表面，无需在 20+ 个 wrapper 间穿 props。海域页的 `PracticeOverlay` 连刷引擎抽成共享 `ProblemPracticeSession`（皮肤参数化），海域与收藏页共用。

**Tech Stack:** Next.js 15 App Router (client components), React hooks + Context, Supabase JS, Tailwind v4, TypeScript（无 `any`），Vitest（仅纯逻辑）。

## Global Constraints

- 收藏 key 一律用 `Problem.id`（与 `math_solved.problem_id`、`problem_mastery.problem_key`、`MathPlanProblem.problemId` 同一套）。不引入新 key 空间；继承既有的 id 唯一性（与练习次数完全一致）。
- 包依赖 DAG：`@rosie/math` 只可 import `@rosie/core`/`@rosie/ui`/`@rosie/rewards` + npm，**不得** import 其他 subject 模块。
- 包内跨文件 import 用深子路径 `@rosie/math/...`（自引用），同目录用相对路径。
- TypeScript 严格：所有 props/state 显式类型，禁 `any`。组件用 `type` 描述 props。
- 所有 client 组件首行 `'use client'`。
- Tailwind v4，无 `tailwind.config.js`；新 `packages/math/src` 文件用 Tailwind 工具类即可（`globals.css` 的 `@source` 已覆盖 `packages/math/src`）。
- 命名：组件 `PascalCase.tsx`，hook/util `camelCase.ts`。
- **儿童向 UI（7 岁，playful）**：任何**新组件 / 样式 / modal**（Task 4、Task 12、Task 13）实现前，**先调用 `frontend-design` skill** 取设计方向，避免通用 AI 默认审美。
- 验证按项目惯例：用户手动跑 `pnpm --filter @rosie/math typecheck` / `pnpm --filter web build`。每个 Task 末尾列出应跑的 typecheck 命令作为完成判据；助手不主动跑、只在需要时提醒。无强制测试 gate；仅对纯函数加 Vitest 单测。

---

## 文件结构

**新建：**
- `docs/math-favorites-table.sql` — 建表 + RLS（用户在 Supabase 手动执行）
- `packages/math/src/hooks/useMathFavorites.ts` — 收藏数据 hook
- `packages/math/src/components/MathFavoritesProvider.tsx` — context + provider + `useMathFavoritesContext`
- `packages/math/src/components/shared/FavoriteHeart.tsx` — ❤️/🤍 按钮（消费 context）
- `packages/math/src/components/shared/PracticeCountBadge.tsx` — 「练习 N 次」/「未练习」徽章
- `packages/math/src/utils/favorites-helpers.ts` — 收藏 id → `SeaProblem[]` 解析 + 按课分组（纯函数）
- `apps/web/tests/favorites-helpers.test.ts` — 上述纯函数单测
- `packages/math/src/components/shared/ProblemPracticeSession.tsx` — 从海域抽出的连刷引擎（皮肤参数化）
- `apps/web/src/app/math/layout.tsx` — 挂 `MathFavoritesProvider`
- `apps/web/src/app/math/favorites/page.tsx` — 我的收藏页
- `packages/math/src/components/MathFavoritesCard.tsx` — 数学首页入口卡

**修改：**
- `packages/math/src/index.ts` — 导出 `MathFavoritesCard`、`MathFavoritesProvider`
- `packages/math/src/components/shared/LessonProblemList.tsx` — 加 heart + count badge
- `packages/math/src/components/shared/FilterPanel.tsx` — 两种卡片模式加 heart + count badge + 「只看收藏」本地开关
- `apps/web/src/app/math/sea/page.tsx` — 卡片加 heart；连刷改用 `ProblemPracticeSession`
- `apps/web/src/app/math/mistakes/page.tsx` — 卡片加 heart，次数改用 `PracticeCountBadge`
- `packages/math/src/components/MathWeeklyPractice.tsx` — 内部 `ProblemCard` 加 heart
- `apps/web/src/app/math/page.tsx` — 加 `MathFavoritesCard`

---

### Task 1: 数据库表 `math_favorites`

**Files:**
- Create: `docs/math-favorites-table.sql`

**Interfaces:**
- Produces: Supabase 表 `math_favorites(user_id uuid, problem_id text, created_at timestamptz)`，主键 `(user_id, problem_id)`，RLS 仅本人可读写。后续 Task 2 的 hook 依赖此表存在。

- [ ] **Step 1: 写 SQL（对称于 `math_wrong`）**

```sql
-- docs/math-favorites-table.sql
-- 数学题目收藏：每行 = 用户收藏了某道题。键对齐 math_solved.problem_id / Problem.id。
create table if not exists public.math_favorites (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  problem_id text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, problem_id)
);

alter table public.math_favorites enable row level security;

create policy "math_favorites_select_own" on public.math_favorites
  for select using (auth.uid() = user_id);
create policy "math_favorites_insert_own" on public.math_favorites
  for insert with check (auth.uid() = user_id);
create policy "math_favorites_delete_own" on public.math_favorites
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: 提醒用户在 Supabase SQL editor 执行该脚本**（不依赖自动迁移，与仓库其他 `docs/*.sql` 一致）。

- [ ] **Step 3: Commit**

```bash
git add docs/math-favorites-table.sql
git commit -m "feat(math): add math_favorites table SQL"
```

---

### Task 2: `useMathFavorites` hook + `MathFavoritesProvider` context

**Files:**
- Create: `packages/math/src/hooks/useMathFavorites.ts`
- Create: `packages/math/src/components/MathFavoritesProvider.tsx`

**Interfaces:**
- Consumes: Supabase 表 `math_favorites`（Task 1）；`useAuth` from `@rosie/core`。
- Produces:
  - `useMathFavorites(user: User | null): { favorites: Set<string>; isFavorite: (id: string) => boolean; toggleFavorite: (id: string) => void }`
  - `MathFavoritesProvider({ children }: { children: ReactNode }): ReactNode`
  - `useMathFavoritesContext(): { favorites: Set<string>; isFavorite: (id: string) => boolean; toggleFavorite: (id: string) => void }`（无 provider 时返回安全默认：空集合 + no-op）

- [ ] **Step 1: 写 hook**（乐观更新 + upsert/delete，照搬 `useMathWrong` 模式）

```ts
// packages/math/src/hooks/useMathFavorites.ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'

export function useMathFavorites(user: User | null) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    supabase
      .from('math_favorites')
      .select('problem_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setFavorites(new Set(data.map(r => r.problem_id)))
      })
  }, [user])

  const isFavorite = useCallback(
    (problemId: string) => favorites.has(problemId),
    [favorites],
  )

  const toggleFavorite = useCallback(
    (problemId: string) => {
      if (!user) return
      const willAdd = !favorites.has(problemId)
      // optimistic
      setFavorites(prev => {
        const next = new Set(prev)
        if (willAdd) next.add(problemId)
        else next.delete(problemId)
        return next
      })
      if (willAdd) {
        supabase
          .from('math_favorites')
          .upsert(
            { user_id: user.id, problem_id: problemId },
            { onConflict: 'user_id,problem_id' },
          )
          .then(({ error }) => {
            if (error) {
              console.error('[math_favorites] insert error:', error)
              setFavorites(prev => { const n = new Set(prev); n.delete(problemId); return n })
            }
          })
      } else {
        supabase
          .from('math_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('problem_id', problemId)
          .then(({ error }) => {
            if (error) {
              console.error('[math_favorites] delete error:', error)
              setFavorites(prev => { const n = new Set(prev); n.add(problemId); return n })
            }
          })
      }
    },
    [user, favorites],
  )

  return { favorites, isFavorite, toggleFavorite }
}
```

- [ ] **Step 2: 写 context + provider**

```tsx
// packages/math/src/components/MathFavoritesProvider.tsx
'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '@rosie/core'
import { useMathFavorites } from '@rosie/math/hooks/useMathFavorites'

export interface MathFavoritesContextValue {
  favorites: Set<string>
  isFavorite: (problemId: string) => boolean
  toggleFavorite: (problemId: string) => void
}

const MathFavoritesContext = createContext<MathFavoritesContextValue>({
  favorites: new Set(),
  isFavorite: () => false,
  toggleFavorite: () => {},
})

export function MathFavoritesProvider({ children }: { children: ReactNode }): ReactNode {
  const { user } = useAuth()
  const value = useMathFavorites(user)
  return <MathFavoritesContext.Provider value={value}>{children}</MathFavoritesContext.Provider>
}

export function useMathFavoritesContext(): MathFavoritesContextValue {
  return useContext(MathFavoritesContext)
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @rosie/math typecheck`
Expected: PASS（无类型错误）

- [ ] **Step 4: Commit**

```bash
git add packages/math/src/hooks/useMathFavorites.ts packages/math/src/components/MathFavoritesProvider.tsx
git commit -m "feat(math): useMathFavorites hook + MathFavoritesProvider context"
```

---

### Task 3: 挂载 provider（math/layout.tsx）+ index 导出

**Files:**
- Create: `apps/web/src/app/math/layout.tsx`
- Modify: `packages/math/src/index.ts`

**Interfaces:**
- Consumes: `MathFavoritesProvider`（Task 2）。
- Produces: 整个 `/math/**` 树内 `useMathFavoritesContext()` 可用。`@rosie/math` barrel 导出 `MathFavoritesProvider`。

- [ ] **Step 1: 新建顶层 math 布局挂 provider**

```tsx
// apps/web/src/app/math/layout.tsx
'use client'

import { MathFavoritesProvider } from '@rosie/math'

export default function MathLayout({ children }: { children: React.ReactNode }) {
  return <MathFavoritesProvider>{children}</MathFavoritesProvider>
}
```

- [ ] **Step 2: 在 `packages/math/src/index.ts` 追加导出**

在文件末尾加：

```ts
export { MathFavoritesProvider } from '@rosie/math/components/MathFavoritesProvider'
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/math/layout.tsx packages/math/src/index.ts
git commit -m "feat(math): mount MathFavoritesProvider in /math layout"
```

---

### Task 4: `FavoriteHeart` + `PracticeCountBadge` 展示组件

> **先调用 `frontend-design` skill**，为这两个儿童向小组件确定视觉方向（颜色、尺寸、点按反馈/弹跳动画），再落地下面的基线实现并按设计微调。

**Files:**
- Create: `packages/math/src/components/shared/FavoriteHeart.tsx`
- Create: `packages/math/src/components/shared/PracticeCountBadge.tsx`

**Interfaces:**
- Consumes: `useMathFavoritesContext`（Task 2）。
- Produces:
  - `FavoriteHeart` — props `type FavoriteHeartProps = { problemId: string; size?: 'sm' | 'md' }`，默认 `'md'`。
  - `PracticeCountBadge` — props `type PracticeCountBadgeProps = { count: number }`。

- [ ] **Step 1: 调用 frontend-design skill** 取设计方向（记录采用的配色/动效）。

- [ ] **Step 2: 写 `FavoriteHeart`**（按钮，阻止冒泡，因卡片本体是 `<Link>`）

```tsx
// packages/math/src/components/shared/FavoriteHeart.tsx
'use client'

import { useMathFavoritesContext } from '@rosie/math/components/MathFavoritesProvider'

type FavoriteHeartProps = {
  problemId: string
  size?: 'sm' | 'md'
}

export default function FavoriteHeart({ problemId, size = 'md' }: FavoriteHeartProps) {
  const { isFavorite, toggleFavorite } = useMathFavoritesContext()
  const fav = isFavorite(problemId)
  const dim = size === 'sm' ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-lg'

  return (
    <button
      type="button"
      aria-label={fav ? '取消收藏' : '收藏'}
      title={fav ? '取消收藏' : '收藏这道题'}
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(problemId)
      }}
      className={`flex ${dim} shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent leading-none transition-transform duration-150 hover:scale-110 active:scale-90`}
    >
      <span className={fav ? 'inline-block animate-[pop_0.25s_ease]' : 'opacity-70'}>
        {fav ? '❤️' : '🤍'}
      </span>
    </button>
  )
}
```

> 若 frontend-design 建议自定义关键帧 `pop`，按「Styling ownership」放到 `packages/math` 内的某个已被 import 的 `.css`（如 `gong.css` 同类），或退化为 Tailwind 内置 `active:scale` 反馈，不要在 `globals.css` 加模块专属动画。

- [ ] **Step 3: 写 `PracticeCountBadge`**（0 次醒目高亮）

```tsx
// packages/math/src/components/shared/PracticeCountBadge.tsx
type PracticeCountBadgeProps = {
  count: number
}

export default function PracticeCountBadge({ count }: PracticeCountBadgeProps) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-px text-[10px] font-bold text-amber-700 ring-1 ring-amber-300">
        ✨ 未练习
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-px text-[10px] font-semibold text-text-muted">
      练习 {count} 次
    </span>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @rosie/math typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/math/src/components/shared/FavoriteHeart.tsx packages/math/src/components/shared/PracticeCountBadge.tsx
git commit -m "feat(math): FavoriteHeart + PracticeCountBadge components"
```

---

### Task 5: 收藏解析纯函数 + 单测

**Files:**
- Create: `packages/math/src/utils/favorites-helpers.ts`
- Test: `apps/web/tests/favorites-helpers.test.ts`

**Interfaces:**
- Consumes: `SeaProblem` 类型（`@rosie/math/utils/sea-data`，字段 `{ problem: Problem; lessonId; section; href }`）；`SEA_POOL`、`SEA_LESSONS`。
- Produces:
  - `resolveFavoriteProblems(favorites: Set<string>, pool?: SeaProblem[]): SeaProblem[]` — 返回 pool 中 `problem.id ∈ favorites` 的条目（按 SEA_LESSONS 既有顺序，与 pool 一致）。
  - `type FavoriteLessonGroup = { lessonId: string; title: string; items: SeaProblem[] }`
  - `groupFavoritesByLesson(items: SeaProblem[]): FavoriteLessonGroup[]` — 按 `lessonId` 分组，组顺序遵循 `SEA_LESSONS`，`title` 取自 `SEA_LESSON_MAP[lessonId].shortTitle`。

- [ ] **Step 1: 写失败测试**

```ts
// apps/web/tests/favorites-helpers.test.ts
import { describe, it, expect } from 'vitest'
import {
  resolveFavoriteProblems,
  groupFavoritesByLesson,
} from '@rosie/math/utils/favorites-helpers'
import { SEA_POOL } from '@rosie/math/utils/sea-data'

describe('resolveFavoriteProblems', () => {
  it('空收藏返回空数组', () => {
    expect(resolveFavoriteProblems(new Set())).toEqual([])
  })

  it('只返回 problem.id 命中的题，且保持 pool 顺序', () => {
    const ids = SEA_POOL.slice(0, 3).map(sp => sp.problem.id)
    const res = resolveFavoriteProblems(new Set(ids))
    expect(res.length).toBe(3)
    expect(res.every(sp => ids.includes(sp.problem.id))).toBe(true)
    const idxInPool = res.map(sp => SEA_POOL.indexOf(sp))
    expect(idxInPool).toEqual([...idxInPool].sort((a, b) => a - b))
  })
})

describe('groupFavoritesByLesson', () => {
  it('按课分组，组顺序遵循 SEA_LESSONS', () => {
    const sample = [SEA_POOL[0], SEA_POOL[SEA_POOL.length - 1]]
    const groups = groupFavoritesByLesson(sample)
    expect(groups.length).toBeGreaterThanOrEqual(1)
    expect(groups.every(g => g.items.length > 0 && g.title.length > 0)).toBe(true)
    const lessonIds = groups.map(g => g.lessonId)
    expect(lessonIds).toEqual([...new Set(lessonIds)]) // 无重复组
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter web test -- favorites-helpers`
Expected: FAIL（模块/导出不存在）

- [ ] **Step 3: 写实现**

```ts
// packages/math/src/utils/favorites-helpers.ts
import { SEA_POOL, SEA_LESSONS, SEA_LESSON_MAP, type SeaProblem } from './sea-data'

export function resolveFavoriteProblems(
  favorites: Set<string>,
  pool: SeaProblem[] = SEA_POOL,
): SeaProblem[] {
  if (favorites.size === 0) return []
  return pool.filter(sp => favorites.has(sp.problem.id))
}

export type FavoriteLessonGroup = {
  lessonId: string
  title: string
  items: SeaProblem[]
}

export function groupFavoritesByLesson(items: SeaProblem[]): FavoriteLessonGroup[] {
  const byLesson = new Map<string, SeaProblem[]>()
  for (const sp of items) {
    const arr = byLesson.get(sp.lessonId)
    if (arr) arr.push(sp)
    else byLesson.set(sp.lessonId, [sp])
  }
  // 组顺序遵循 SEA_LESSONS
  return SEA_LESSONS
    .filter(l => byLesson.has(l.id))
    .map(l => ({
      lessonId: l.id,
      title: SEA_LESSON_MAP[l.id]?.shortTitle ?? l.id,
      items: byLesson.get(l.id)!,
    }))
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter web test -- favorites-helpers`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/math/src/utils/favorites-helpers.ts apps/web/tests/favorites-helpers.test.ts
git commit -m "feat(math): favorites-helpers (resolve + group) with tests"
```

---

### Task 6: 接入 `LessonProblemList`（主列表，覆盖 20 课）

**Files:**
- Modify: `packages/math/src/components/shared/LessonProblemList.tsx`

**Interfaces:**
- Consumes: `FavoriteHeart`、`PracticeCountBadge`（Task 4）。`count` 已存在（`solveCount[p.id] ?? 0`）。
- Produces: 主列表每张卡显示次数徽章 + 收藏 ❤️。

- [ ] **Step 1: 加 import**

在现有 import 区加：

```tsx
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
```

- [ ] **Step 2: 标签行加次数徽章**

在 `<DifficultyStars level={p.difficulty} />` 之后、`showSource` 块之前插入：

```tsx
<PracticeCountBadge count={count} />
```

- [ ] **Step 3: 右侧加收藏 ❤️**

把结尾的掌握度图标块：

```tsx
<div className={`shrink-0 text-xl ${level === 0 ? 'text-text-muted' : ''}`}>
  {MASTERY_ICON[level]}
</div>
```

替换为：

```tsx
<div className="flex shrink-0 items-center gap-1">
  <div className={`text-xl ${level === 0 ? 'text-text-muted' : ''}`}>
    {MASTERY_ICON[level]}
  </div>
  <FavoriteHeart problemId={p.id} size="sm" />
</div>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @rosie/math typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/math/src/components/shared/LessonProblemList.tsx
git commit -m "feat(math): favorites + practice count on lesson problem list"
```

---

### Task 7: 接入 `FilterPanel`（alltest 两种卡片模式 + 「只看收藏」开关）

**Files:**
- Modify: `packages/math/src/components/shared/FilterPanel.tsx`

**Interfaces:**
- Consumes: `FavoriteHeart`、`PracticeCountBadge`（Task 4）；`useMathFavoritesContext`（Task 2）。
- Produces: 折叠/展开两种卡片均带次数徽章 + ❤️；筛选区多一个「⭐ 只看收藏」本地开关（不改 `Filters` 类型、不改 20 个 alltest 页）。

- [ ] **Step 1: 加 import**

```tsx
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
import { useMathFavoritesContext } from '@rosie/math/components/MathFavoritesProvider'
```

- [ ] **Step 2: `ExpandedCard` 内加次数 + ❤️**

`createExpandedCard` 的 `ExpandedCard` 中，把标签行（`<span ...>{srcLabel}</span>` 之后）补一个 `<PracticeCountBadge count={count} />`；并把 `<span className="shrink-0 text-base">{MASTERY_ICON[level]}</span>` 后追加：

```tsx
<FavoriteHeart problemId={p.id} size="sm" />
```

（`count` 在 `ExpandedCard` 内已有：`const count = solveCount[p.id] ?? 0`。）

- [ ] **Step 3: FilterPanel 主体读取收藏 + 本地开关 state**

在 `return function FilterPanel(...)` 顶部、`useState` 们附近加：

```tsx
const { favorites } = useMathFavoritesContext()
const [favOnly, setFavOnly] = useState(false)
```

- [ ] **Step 4: 把「只看收藏」纳入过滤**

把：

```tsx
const filtered = all.filter(
  ({ p, setName }) =>
    filters.source.has(setName) &&
    filters.type.has(p.tag) &&
    filters.difficulty.has(p.difficulty) &&
    matchesMastery(solveCount[p.id] ?? 0, filters.mastery),
)
```

改为：

```tsx
const filtered = all.filter(
  ({ p, setName }) =>
    filters.source.has(setName) &&
    filters.type.has(p.tag) &&
    filters.difficulty.has(p.difficulty) &&
    matchesMastery(solveCount[p.id] ?? 0, filters.mastery) &&
    (!favOnly || favorites.has(p.id)),
)
```

- [ ] **Step 5: 在掌握度按钮组后加「只看收藏」开关**

在 `🎯 掌握度` 那个 `<div className="mb-2">...</div>` 之后插入：

```tsx
<div className="mb-2">
  <div className={`mb-1.5 text-[11px] font-bold ${theme.labelColor}`}>⭐ 收藏</div>
  <div className="flex flex-wrap gap-1.5">
    <button onClick={() => setFavOnly(v => !v)}
      className={`${btnBase} ${favOnly ? btnOn : btnOff}`}>
      {favOnly ? '❤️ 只看收藏' : '🤍 只看收藏'}
    </button>
  </div>
</div>
```

- [ ] **Step 6: 折叠模式 grid 卡片加次数 + ❤️**

在折叠模式的 `<Link ...>` 卡片里，标签行（`{SOURCE_LABELS[setName] || setName}` 的 `<span>` 之后）加 `<PracticeCountBadge count={count} />`；把 `<div className="shrink-0 text-base">{MASTERY_ICON[level]}</div>` 替换为：

```tsx
<div className="flex shrink-0 items-center gap-1">
  <div className="text-base">{MASTERY_ICON[level]}</div>
  <FavoriteHeart problemId={p.id} size="sm" />
</div>
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @rosie/math typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/math/src/components/shared/FilterPanel.tsx
git commit -m "feat(math): favorites + count + 只看收藏 filter in FilterPanel"
```

---

### Task 8: 接入海域卡片（`sea/page.tsx`）

**Files:**
- Modify: `apps/web/src/app/math/sea/page.tsx`

**Interfaces:**
- Consumes: `FavoriteHeart`（Task 4）。海域已有 `count`、`problem.id`。
- Produces: 海域每张题卡右侧多一个 ❤️。

- [ ] **Step 1: 加 import**

```tsx
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
```

- [ ] **Step 2: 卡片加 ❤️**

在海域卡片 `<Link>`（render 块约 271 行）末尾的 `→` 箭头 `<span>` 之前插入：

```tsx
<div className="shrink-0 self-start" onClick={e => e.preventDefault()}>
  <FavoriteHeart problemId={problem.id} size="sm" />
</div>
```

（`FavoriteHeart` 内部已 `stopPropagation`/`preventDefault`；外层 `onClick preventDefault` 仅作双保险，避免触发卡片跳转。）

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/math/sea/page.tsx
git commit -m "feat(math): favorite heart on sea cards"
```

---

### Task 9: 接入错题页（`mistakes/page.tsx`）

**Files:**
- Modify: `apps/web/src/app/math/mistakes/page.tsx`

**Interfaces:**
- Consumes: `FavoriteHeart`、`PracticeCountBadge`（Task 4）。已有 `count`、`problem.id`。
- Produces: 错题卡用 `PracticeCountBadge` 显示次数（含 0 次高亮），动作区加 ❤️。

- [ ] **Step 1: 加 import**

```tsx
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
```

- [ ] **Step 2: 次数徽章替换**

把卡片标签行里的：

```tsx
{count > 0 && (
  <span className="rounded-full bg-gray-100 px-2 py-px text-[10px] text-text-muted">
    已练 {count} 次
  </span>
)}
```

替换为：

```tsx
<PracticeCountBadge count={count} />
```

- [ ] **Step 3: 动作区加 ❤️**

在动作区 `<div className="flex shrink-0 items-center gap-1.5">` 内、「去练/再练」`<Link>` 之前插入：

```tsx
<FavoriteHeart problemId={problem.id} size="sm" />
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/math/mistakes/page.tsx
git commit -m "feat(math): favorite heart + count badge on mistakes cards"
```

---

### Task 10: 接入每周练习卡片（`MathWeeklyPractice.tsx` 的 `ProblemCard`）

**Files:**
- Modify: `packages/math/src/components/MathWeeklyPractice.tsx`

**Interfaces:**
- Consumes: `FavoriteHeart`（Task 4）。每周练习的题对象是 `MathPlanProblem`，收藏键用 `prob.problemId`（= `Problem.id`，与全局一致）。
- Produces: 每周练习每张 `ProblemCard` 加 ❤️。

- [ ] **Step 1: 加 import**（与现有 import 同区）

```tsx
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
```

- [ ] **Step 2: 在内部 `ProblemCard` 组件里加 ❤️**

定位文件内的 `function ProblemCard(` 定义（接收 `prob: MathPlanProblem` 等 props）。在其卡片根节点的标题/操作区合适位置（与现有 done/check 控件同一行的右侧）插入：

```tsx
<FavoriteHeart problemId={prob.problemId} size="sm" />
```

放置原则：与卡片现有右侧控件并排、`shrink-0`；不要包在任何会拦截点击的容器里（`FavoriteHeart` 自身已 `stopPropagation`）。

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @rosie/math typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/math/src/components/MathWeeklyPractice.tsx
git commit -m "feat(math): favorite heart on weekly practice cards"
```

---

### Task 11: 抽取连刷引擎 `ProblemPracticeSession`（海域行为零回归）

**Files:**
- Create: `packages/math/src/components/shared/ProblemPracticeSession.tsx`
- Modify: `apps/web/src/app/math/sea/page.tsx`

**Interfaces:**
- Consumes: `SeaProblem`；`QuestionLayout`、`injectFigureGridCallbacks`、`useProblemAnswer`、`isInteractiveProblem`、`useStarHud`（均为海域当前已用的依赖）；`FavoriteHeart`（Task 4）。
- Produces:
  - `type PracticeSkin = { overlayBg: string; panel: string; titleColor: string; bodyColor: string; primaryBtn: string; secondaryBtn: string; linkColor: string; badgeStyle: (count: number) => CSSProperties; masteryLabel: (count: number) => string }`
  - `export const SEA_SKIN: PracticeSkin`（沿用海域当前的深色取值）、`export const MATH_SKIN: PracticeSkin`（浅色数学皮肤）。
  - `ProblemPracticeSession(props: { pool: SeaProblem[]; solveCount: Record<string, number>; solvedAt: Record<string, string>; onSolve: (id: string) => Promise<number>; onEnd: () => void; skin: PracticeSkin }): ReactNode`
  - 内部保留海域既有「未练过优先」选题逻辑（`pickNext`）原样不动。

- [ ] **Step 1: 新建文件，移动 `PracticeOverlay` + 其单题渲染块进来**

把 `sea/page.tsx` 中的单题渲染组件（约 430–548 行，渲染 `question`/`solution`/`answerDom` 并 `<QuestionLayout .../>` 的那段）与 `PracticeOverlay`（约 553 行起）整体移入新文件，重命名 `PracticeOverlay` → `ProblemPracticeSession`，并新增 `skin: PracticeSkin` prop。所有**硬编码的海洋配色 / 内联 style / 类名**替换为 `skin.*` 对应字段（overlay 背景、面板、按钮、文字、「查看原题」链接色、`getBadgeStyle`→`skin.badgeStyle`、`getMasteryLabel`→`skin.masteryLabel`）。`pickNext`、`current`/`nextProblem` 状态机、`useProblemAnswer`/图形交互注入逻辑保持不变。

- [ ] **Step 2: 单题答案区加 ❤️**

在单题 `answerDom` 的「查看原题 →」`<Link>` 同一行加 `<FavoriteHeart problemId={problem.id} size="sm" />`（让连刷中也能收藏当前题）。

- [ ] **Step 3: 定义两套皮肤**

`SEA_SKIN` 用海域当前的取值（从被替换的硬编码 style 原样搬入，保证海域视觉不变）；`MATH_SKIN` 用浅色：`overlayBg` 半透明白/浅灰、`panel` 白底圆角阴影、`primaryBtn` 用 app 蓝、文字用 `text-text-primary/secondary`，与数学模块其余页面一致。

- [ ] **Step 4: 海域页改为调用共享组件**

`sea/page.tsx` 删除已移走的本地 `PracticeOverlay` 定义，import：

```tsx
import ProblemPracticeSession, { SEA_SKIN } from '@rosie/math/components/shared/ProblemPracticeSession'
```

把启动处（约 953 行）：

```tsx
<PracticeOverlay pool={filtered} solveCount={solveCount} solvedAt={solvedAt} onSolve={handleSolve} onEnd={() => setPracticeMode(false)} />
```

改为：

```tsx
<ProblemPracticeSession pool={filtered} solveCount={solveCount} solvedAt={solvedAt} onSolve={handleSolve} onEnd={() => setPracticeMode(false)} skin={SEA_SKIN} />
```

- [ ] **Step 5: Typecheck + 海域回归手测**

Run: `pnpm --filter web typecheck`
Expected: PASS
手测：打开 `/math/sea` → 开始练习 → 确认连刷外观与行为（选题顺序、答题、下一题、查看原题、收尾）与改动前一致。

- [ ] **Step 6: Commit**

```bash
git add packages/math/src/components/shared/ProblemPracticeSession.tsx apps/web/src/app/math/sea/page.tsx
git commit -m "refactor(math): extract ProblemPracticeSession from sea (skin-parameterized)"
```

---

### Task 12: 「我的收藏」页 `/math/favorites`

> 涉及新页面布局/空状态等视觉，**先调用 `frontend-design` skill** 取方向，再落地。

**Files:**
- Create: `apps/web/src/app/math/favorites/page.tsx`

**Interfaces:**
- Consumes: `useMathFavoritesContext`（Task 2）；`useMathSolved`；`resolveFavoriteProblems` + `groupFavoritesByLesson`（Task 5）；`FavoriteHeart`、`PracticeCountBadge`（Task 4）；`ProblemPracticeSession` + `MATH_SKIN`（Task 11）；`SEA_LESSON_MAP`、`type SeaProblem`。
- Produces: `/math/favorites` 路由页。

- [ ] **Step 1: 写页面**

```tsx
// apps/web/src/app/math/favorites/page.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth, getMasteryLevel, MASTERY_ICON } from '@rosie/core'
import { BackLink } from '@rosie/ui'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useMathFavoritesContext } from '@rosie/math/components/MathFavoritesProvider'
import {
  resolveFavoriteProblems,
  groupFavoritesByLesson,
} from '@rosie/math/utils/favorites-helpers'
import { SEA_LESSON_MAP } from '@rosie/math/utils/sea-data'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
import ProblemPracticeSession, { MATH_SKIN } from '@rosie/math/components/shared/ProblemPracticeSession'

export default function MathFavoritesPage() {
  const { user } = useAuth()
  const { solveCount, solvedAt, handleSolve } = useMathSolved(user)
  const { favorites } = useMathFavoritesContext()
  const [practiceMode, setPracticeMode] = useState(false)

  const favItems = useMemo(() => resolveFavoriteProblems(favorites), [favorites])
  const groups = useMemo(() => groupFavoritesByLesson(favItems), [favItems])

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <BackLink href="/math" label="返回数学" />

      <div className="mb-5 mt-2 rounded-[14px] bg-gradient-to-br from-rose-50 to-pink-100 p-6">
        <h1 className="mb-1 text-2xl font-extrabold text-rose-700">我的收藏 ❤️</h1>
        <p className="text-[13px] text-rose-600/80">
          收藏了 <strong>{favItems.length}</strong> 道好题，挑出来反复练吧！
        </p>
        {favItems.length > 0 && (
          <button
            onClick={() => setPracticeMode(true)}
            className="mt-3 cursor-pointer rounded-full bg-rose-500 px-5 py-2 text-sm font-bold text-white shadow-md transition-transform active:scale-95"
          >
            ▶ 开始连刷
          </button>
        )}
      </div>

      {favItems.length === 0 ? (
        <div className="rounded-[14px] bg-white p-10 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="mb-3 text-5xl">🌟</div>
          <div className="text-base font-bold text-text-primary">还没有收藏的题目</div>
          <div className="mt-1 text-[13px] text-text-muted">
            在任意题目卡片点 🤍 就能把好题收藏到这里
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.lessonId}>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-text-secondary">
                {SEA_LESSON_MAP[group.lessonId]?.icon} {group.title}
                <span className="text-text-muted">· {group.items.length} 题</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map((sp) => {
                  const count = solveCount[sp.problem.id] ?? 0
                  const level = getMasteryLevel(count)
                  return (
                    <Link
                      key={`${sp.lessonId}-${sp.section}-${sp.problem.id}`}
                      href={sp.href}
                      className="flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-border-light bg-white p-3 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-text-primary">{sp.problem.title}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <PracticeCountBadge count={count} />
                        </div>
                      </div>
                      <div className="text-xl">{MASTERY_ICON[level]}</div>
                      <FavoriteHeart problemId={sp.problem.id} size="sm" />
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {practiceMode && (
        <ProblemPracticeSession
          pool={favItems}
          solveCount={solveCount}
          solvedAt={solvedAt}
          onSolve={handleSolve}
          onEnd={() => setPracticeMode(false)}
          skin={MATH_SKIN}
        />
      )}
    </div>
  )
}
```

> 若 `BackLink` 的 props 名与此不符，按 `@rosie/ui` 实际签名调整（其他 math 页面已用 `BackLink`，参照 `math/page.tsx`）。

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

- [ ] **Step 3: 手测**：收藏几道题 → 打开 `/math/favorites` → 看到分组卡片 + 次数 → 点「开始连刷」走一遍 → 点 ❤️ 取消后该题从列表消失。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/math/favorites/page.tsx
git commit -m "feat(math): /math/favorites page with grouped list + 连刷"
```

---

### Task 13: 数学首页入口卡 `MathFavoritesCard`

> 卡片视觉，**先调用 `frontend-design` skill**（可与 Task 4 的方向一致），再落地。

**Files:**
- Create: `packages/math/src/components/MathFavoritesCard.tsx`
- Modify: `packages/math/src/index.ts`
- Modify: `apps/web/src/app/math/page.tsx`

**Interfaces:**
- Consumes: `useMathFavoritesContext`（Task 2，用于显示收藏数）。
- Produces: `@rosie/math` barrel 导出 `MathFavoritesCard`；数学首页出现「我的收藏」入口卡。

- [ ] **Step 1: 写卡片**（仿 `MathSeaCard` 结构）

```tsx
// packages/math/src/components/MathFavoritesCard.tsx
'use client'

import Link from 'next/link'
import { useMathFavoritesContext } from '@rosie/math/components/MathFavoritesProvider'

export default function MathFavoritesCard() {
  const { favorites } = useMathFavoritesContext()
  const total = favorites.size

  return (
    <Link
      href="/math/favorites"
      className="group relative block h-full w-full overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(244,63,94,.25)]"
      style={{
        background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 50%, #fce7f3 100%)',
        border: '2px solid rgba(244,63,94,.3)',
        boxShadow: '0 4px 20px rgba(244,63,94,.12)',
      }}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-rose-300/20 blur-2xl" />
      <div className="relative px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">❤️</span>
            <span className="text-[14px] font-extrabold tracking-tight text-rose-700">我的收藏</span>
          </div>
          <span className="text-[12px] font-bold text-rose-500 transition-transform group-hover:translate-x-0.5">→</span>
        </div>
        <div className="text-[11px] font-medium leading-relaxed text-rose-700/80">
          已收藏 <strong className="text-rose-800">{total}</strong> 道好题<br />
          挑出来反复练
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: barrel 导出**

在 `packages/math/src/index.ts` 加：

```ts
export { default as MathFavoritesCard } from '@rosie/math/components/MathFavoritesCard'
```

> 与 `index.ts` 既有入口卡导出风格保持一致（确认其他卡是 `export { default as ... }` 还是直接 re-export，照抄同款）。

- [ ] **Step 3: 数学首页加卡片**

在 `apps/web/src/app/math/page.tsx` 的 import 区加：

```tsx
import { MathFavoritesCard } from '@rosie/math'
```

在卡片网格中（与 `MathSeaCard`/`MathQuizCard` 等并列处）放入 `<MathFavoritesCard />`。具体插入点参照该文件现有卡片网格的 JSX。

- [ ] **Step 4: Typecheck + build**

Run: `pnpm --filter @rosie/math typecheck && pnpm --filter web build`
Expected: PASS（build 无 TS 错误）

- [ ] **Step 5: Commit**

```bash
git add packages/math/src/components/MathFavoritesCard.tsx packages/math/src/index.ts apps/web/src/app/math/page.tsx
git commit -m "feat(math): MathFavoritesCard entry on math home"
```

---

## 最终验证（全部 Task 完成后）

- [ ] 在 Supabase 已执行 `docs/math-favorites-table.sql`。
- [ ] `pnpm --filter web build` 通过。
- [ ] 手测一致性：同一道题在 lesson 列表收藏后，海域 / alltest / 错题 / 每周练习 / 收藏页里的 ❤️ 状态同步；练习后次数递增、0 次显示「未练习」高亮。
- [ ] 海域连刷零回归；收藏连刷「未练过优先」生效。
- [ ] `/math/favorites` 空状态正常；取消收藏即时移出。

## Self-Review 记录

- **Spec 覆盖**：数据层(T1-2)、共享组件(T4)、所有题卡表面 lesson/alltest/sea/mistakes/weekly(T6-10)、连刷抽取(T11)、收藏页(T12)、入口卡(T13)、课内只看收藏(T7) —— 均有对应 Task。`priority` 已在 spec 中确认排除。掌握度表格 `ProblemMasteryPanel` 按 YAGNI 跳过。
- **Key 一致性**：全程 `Problem.id`；weekly 用 `MathPlanProblem.problemId`（= `Problem.id`，已核实），与 `solveCount` 同键。
- **类型一致性**：`useMathFavorites` 返回 `{ favorites, isFavorite, toggleFavorite }` 与 context value 一致；`FavoriteHeart` 只需 `problemId`；`PracticeCountBadge` 只需 `count`；`ProblemPracticeSession` props 与海域原 `PracticeOverlay` 入参一致 + 新增 `skin`。
- **无占位符**：新文件均给出完整代码；编辑类步骤给出精确 old→new 片段；T10/T11 因属「移动 + 参数化」给出精确定位与替换规则。