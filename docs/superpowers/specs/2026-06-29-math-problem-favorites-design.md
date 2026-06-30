# 数学题目收藏 + 练习次数显示 — 设计文档

日期：2026-06-29
模块：`@rosie/math` + `apps/web/src/app/math/**`

## 背景与目标

家长（用户）希望在数学模块里：

1. **每一道题都能收藏**，方便把「好题」挑出来反复练习。
2. **每张题卡都显示练习次数**，一眼看出哪些题**没练过**（需要重点关注）。
3. 收藏的题可以**成套连刷**（一题接一题做），优先刷没练过的。

关键现状（已勘察）：

- 练习次数数据**已存在**：`math_solved.solve_count`，通过 `useMathSolved` 加载为
  `solveCount: Record<problemId, number>`。当前题卡只把它换算成掌握度图标（`MASTERY_ICON`），
  **没有显示具体数字**。本设计只是把数字显示出来，不新建数据。
- 收藏功能**不存在**。最贴近的先例是 `math_wrong`（错题）：独立表，键 `(user_id, problem_id)`，
  配 `useMathWrong` hook。收藏照此对称实现。
- 题目标识：`problem.id`。`math_solved.problem_id` / `problem_mastery.problem_key` 都用它。
  新旧课程 id 风格不一（旧课 `P1`，新课 `36-L1`），但收藏**沿用同一个 `problem.id`**，
  天然与练习次数一致，不引入新 key 空间。
- `sea-data.ts` 的 **`SEA_POOL` 是全量题目注册表**：每题带 `{ id, lessonId, section, href, problem, ... }`。
  收藏页据此把任一收藏 id 解析为题目内容 + 跳转路由。
- 海域页 `sea/page.tsx` 内的 **`PracticeOverlay` 就是现成的连刷引擎**：传入 `pool: SeaProblem[]`，
  一题一题渲染（`QuestionLayout` + `useProblemAnswer`），内置「未练过优先」选题逻辑。

## 已确认的范围决策

- 收藏入口：**独立「我的收藏」页 + 课内筛选**两者都要。
- 次数显示：**「练习 N 次」文字徽章**，`N=0` 时切换成醒目的「未练习」高亮。保留现有掌握度图标。
- 显示表面：**所有题卡表面**（不只主列表）。
- 连刷：**需要**，且**抽取海域连刷引擎为共享组件**，海域与收藏页共用。
- 掌握度表格（`ProblemMasteryPanel`，每周练习页内的子面板）：**v1 跳过**，保持现状。

## 架构

分为 5 个相互隔离的单元，依赖单向、各自可独立测试：

### 单元 1 — 数据层（对称于 `math_wrong`）

- **新表 `math_favorites`**
  - 列：`user_id uuid`、`problem_id text`、`created_at timestamptz default now()`
  - 唯一约束 / 主键：`(user_id, problem_id)`
  - RLS 策略对齐 `math_wrong`（用户只能读写自己的行）
  - 交付物：`docs/math-favorites-table.sql`（建表 + RLS），手动在 Supabase 执行。
- **新 hook `packages/math/src/hooks/useMathFavorites.ts`**
  - 签名：`useMathFavorites(user: User | null)` →
    `{ favorites: Set<string>, isFavorite(id): boolean, toggleFavorite(id): void }`
  - 实现照搬 `useMathWrong`：初始 `select` 加载，`toggleFavorite` 乐观更新本地 `Set` +
    `upsert`（加）/ `delete`（取消），`user` 为 null 时 no-op。
  - 「收藏」与「取消收藏」是同一动作的两态，由 `toggleFavorite` 统一处理。

### 单元 2 — 共享展示小组件（`packages/math/src/components/shared/`）

- **`FavoriteHeart.tsx`** — props `{ isFavorite: boolean; onToggle: () => void }`。
  ❤️/🤍 切换按钮，`onClick` 内 `e.preventDefault()` + `e.stopPropagation()`（题卡本身是
  跳转 `<Link>`）。点按有弹跳/缩放反馈，尺寸偏大、适配 7 岁儿童触控。
- **`PracticeCountBadge.tsx`** — props `{ count: number }`。
  `count > 0` → 「练习 {count} 次」常规徽章；`count === 0` → 醒目「未练习」高亮样式（颜色/标签
  区别明显）。

> 实现这两个组件（及所有样式）前，**先调用 `frontend-design` skill**（用户既定要求：任何
> 组件/样式改动前先做设计方向），确保符合 playful 儿童审美，避免通用 AI 默认样式。

### 单元 3 — 把收藏 + 次数落到所有题卡表面

每个表面本就有 `solveCount` 与题目 id，改动是局部的：调用一次 `useMathFavorites(user)`，
在卡片里塞入 `<FavoriteHeart>` 和 `<PracticeCountBadge count={solveCount[id] ?? 0} />`。

需改的表面（均为「逐题渲染、每题有 `problem.id` 和 `solveCount`」的卡片）：

1. `components/shared/LessonProblemList.tsx` — 主列表，覆盖全部 20 节课。
2. `components/shared/FilterPanel.tsx` — alltest 按题型筛选列表。
3. `apps/web/src/app/math/sea/page.tsx` — 海域列表卡。
4. `apps/web/src/app/math/mistakes/page.tsx` — 错题列表卡。
5. `packages/math/src/components/MathWeeklyPractice.tsx` — 每周练习中的题卡。

> **不改 `priority/page.tsx`**：经勘察它是静态的「知识点优先级清单 + 5~7 天复习计划表」，
> 列的是知识点/讲次（topic / lecture 级），没有单题 `problem.id`、也没有 `solveCount`，
> 不是题卡表面，无法挂收藏/次数。

注：`LessonProblemList` / `FilterPanel` 是纯展示组件，需新增 props
（`favorites: Set<string>`、`onToggleFavorite: (id) => void`），由各自的上层（lesson Provider /
页面）注入，保持组件无副作用、可独立测试。

### 单元 4 — 连刷引擎抽取为共享组件

- 把 `sea/page.tsx` 中的 **`PracticeOverlay`**（含单题渲染块 + `pickNext` 选题逻辑）抽成
  `packages/math/src/components/shared/ProblemPracticeSession.tsx`。
  - props：`{ pool: SeaProblem[]; solveCount; solvedAt; onSolve; onEnd; theme?: 'sea' | 'math' }`
  - 选题逻辑（未练过优先 → 部分练过 → 全部）原样保留。
  - 皮肤通过 `theme` 参数切换：海域=深色海洋，收藏=浅色数学。
- **海域页改为调用共享组件**，行为保持完全不变（先抽取、再替换、逐步验证）。
- 收藏页传入收藏题池（浅色皮肤）。

### 单元 5 — 全局「我的收藏」页 + 入口

- **新路由 `apps/web/src/app/math/favorites/page.tsx`**
  - 数据：`useMathFavorites` + `useMathSolved`；用 `SEA_POOL` 把收藏 id 解析为 `SeaProblem[]`。
  - 顶部「▶ 开始连刷」按钮 → 打开 `ProblemPracticeSession`（pool = 收藏题，浅色皮肤）。
  - 主体：按课分组的收藏卡片，每张显示 `<PracticeCountBadge>` + `<FavoriteHeart>`（可取消收藏），
    点击跳转该题 `href`（查看原题）。
  - 儿童友好的空状态（还没有收藏时的引导文案 + 插画/emoji）。
- **新入口卡 `packages/math/src/components/MathFavoritesCard.tsx`**，经 `index.ts` 暴露，
  加到数学首页 `apps/web/src/app/math/page.tsx`。

### 单元 6 — 课内「⭐ 只看收藏」筛选

- 在 `FilterPanel` 的筛选区加「⭐ 只看收藏」开关，开启后列表只显示 `favorites` 内的题。
- 与现有 mastery / source / difficulty 筛选并存。

## 数据流

```
Supabase math_favorites ──select/upsert/delete──> useMathFavorites
                                                      │ favorites:Set, toggleFavorite
                                                      ▼
       各题卡表面 (lesson/alltest/sea/mistakes/weekly)
            ├─ <FavoriteHeart isFavorite={favorites.has(id)} onToggle={()=>toggleFavorite(id)} />
            └─ <PracticeCountBadge count={solveCount[id] ?? 0} />   （solveCount 来自 useMathSolved，已存在）

       /math/favorites
            ├─ favorites + SEA_POOL  ──>  收藏题 SeaProblem[]  ──>  分组卡片 + ❤️取消
            └─ 「开始连刷」 ──>  <ProblemPracticeSession pool=收藏题 theme="math" />
```

## 错误处理

- 所有 Supabase 写入失败：`console.error` + 本地状态回滚（对齐 `useMathWrong` / `useMathSolved`
  的乐观更新模式）。
- `user` 为 null：所有 hook no-op，组件不渲染收藏控件（与现有 hook 一致）。
- 收藏了但 `SEA_POOL` 找不到对应题（理论上不会发生，除非题被删）：收藏页静默跳过该 id。

## 测试

- 无强制测试 gate（与仓库一致）。改动后跑 `pnpm --filter @rosie/math typecheck` 与
  `pnpm --filter web build`（由用户手动执行；助手只在需要时提醒，不主动跑）。
- 重点人工验证：
  - 收藏/取消在多个表面间状态一致（同一题在 lesson 列表和海域里收藏状态同步）。
  - `N=0` 高亮正确，练习后数字递增。
  - 海域连刷抽取后行为零回归。
  - 收藏连刷「未练过优先」生效。

## 明确不做（YAGNI）

- 收藏分组 / 文件夹 / 标签。
- 掌握度表格（`ProblemMasteryPanel`）加收藏列。
- 收藏次数排序、收藏时间线等附加视图。

## 实现注意事项

- 新 `packages/math/src` 含 JSX 的文件：确认 `apps/web/src/app/globals.css` 的 `@source` 已覆盖
  `packages/math/src`（已覆盖，新文件在该目录下即可）。
- 全程儿童向 UI：每个组件/样式改动前先调 `frontend-design` skill。
- `math` 不得依赖其他 subject 模块；新代码只用 `@rosie/core` / `@rosie/ui` / `@rosie/rewards`。