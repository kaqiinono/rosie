# 英语单词练习"去挫败感"交互 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把英语单词练习里所有"答错"反馈改造成"温和 retry → 怪兽吃单词 → 阶梯拯救补练"三阶段保护壳，去除 ❌/红框/"回答错误"等让 7 岁孩子崩溃的硬反馈。

**Architecture:** 题目层引入 `attempt` 状态机（first→retry→done）；session 层引入 `useRescueQueue` 管理"半对/被吃"清单 + 阶梯补练队列 + localStorage 临时持久化；视觉层新增 4 个 UI 组件（MonsterEatScene / RescueListBadge / FlashRecallCard / RescueCompletionView）。阅读模块走轻量 retry，不接队列。

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4（CSS variables in `src/app/globals.css`，**无** `tailwind.config.js`），Supabase（不动 schema），pnpm。

**Reference spec:** `docs/superpowers/specs/2026-06-08-de-frustration-design.md` (commit `fbb5d52`)

**项目约束（来自 CLAUDE.md / memory）**

- **没有测试套件**——本 plan 用"看现状 → 改 → pnpm lint → 用户手动验证 → commit"代替 TDD。
- **不要在 plan 步骤里跑 `pnpm lint` / `pnpm build`**——每个阶段末尾**提示用户跑**，由用户决定。
- **UI 改动前 invoke skill `frontend-design`**——每个 UI 任务的第一步固定提示。
- `localStorage` 仅 `MATH_SIDEBAR_COLLAPSED` 一个 key；本期新增 `rescue_queue_v1` 是显式例外（spec §11.6）。
- 7 岁孩子风格：playful/俏皮/活泼，禁红、禁刺耳音、禁直球"错"字。

---

## File Structure

### 新增

| 文件 | 责任 |
|---|---|
| `src/hooks/useRescueQueue.ts` | 拯救队列状态 + localStorage + 补练拼装入口 |
| `src/components/english/words/MonsterEatScene.tsx` | 怪兽吃单词弹层（4 只 SVG + 飞字 + 文案 + OK 按钮） |
| `src/components/english/words/RescueListBadge.tsx` | 题面顶端横向小条 |
| `src/components/english/words/FlashRecallCard.tsx` | 1.5s 闪现卡（拯救阶梯第 1 梯） |
| `src/components/english/words/RescueCompletionView.tsx` | 完成页"拯救成果"区块 |
| `src/components/english/words/monsters.ts` | 4 只怪兽 SVG body 字符串 + 名字 + 嘴坐标，从 demo 抽出 |

### 修改

| 文件 | 责任 |
|---|---|
| `src/utils/type.ts` | 扩展 `QuizQuestion`、新增 `RescueQueueItem`/`RescueSeverity`/`ReinforcementPhase` |
| `src/utils/constant.ts` | `STORAGE_KEYS.RESCUE_QUEUE`、文案池常量 |
| `src/utils/english-helpers.ts` | `buildReinforcementQuestions` 新签名 |
| `src/app/globals.css` | 4 个 token：`--rescue-half/--rescue-eaten/--rescue-saved/--monster-veil` |
| `src/components/english/words/useQuizRunner.ts` | attempt 状态机 + retry 通道 |
| `src/components/english/words/QuizQuestionBody.tsx` | retry 文案 + 错选项淡出（去除 line 178-181 的红色判错样式） |
| `src/components/english/words/SpellTiles.tsx` | retry 通道 + revealedHalf prop + 去除 line 320 `✗ 错误...` |
| `src/components/english/words/WeeklyPlanSession.tsx` | 接 useRescueQueue + handleAnswer 改造 + 补练拼装 + 完成页 |
| `src/components/english/reading/RecallQuizStack.tsx` | line 108 retry 化、轻文案 |
| `src/components/english/reading/ParagraphRecallQuiz.tsx` | 同上 |

---

## Task 0 — 预检查与 worktree

**Files:** 仅 git 操作

- [ ] **Step 1: 验证当前分支与 spec commit**

Run: `git log --oneline -3`
Expected: 看到 `fbb5d52 docs: add de-frustration design spec ...`（或更新的 commit）。

- [ ] **Step 2: 决定是否新开 worktree**

如果用户希望在隔离的 worktree 工作，**invoke skill** `superpowers:using-git-worktrees`。否则直接在 `feature/4b` 上做。

---

## Task 1 — 类型扩展

**Files:**
- Modify: `src/utils/type.ts`
- Modify: `src/components/english/words/useQuizRunner.ts`（仅 import 类型转移）

- [ ] **Step 1: 阅读现状**

Read `src/utils/type.ts` 末尾，找到现有 `WordEntry` / `WordMasteryInfo` 等类型的导出风格（`type` vs `interface`）。

Read `src/components/english/words/useQuizRunner.ts:7-10`，确认 `QuizQuestion` 当前定义为：

```ts
export interface QuizQuestion {
  word: WordEntry
  type: QuizType
}
```

- [ ] **Step 2: 把 `QuizQuestion` 迁移到 `src/utils/type.ts` 并扩展**

在 `src/utils/type.ts` 末尾追加：

```ts
import type { QuizType } from '@/utils/english-helpers'

export type RescueSeverity = 'half' | 'eaten'

export type ReinforcementPhase = false | 'half-only' | 'eaten-only' | 'both'

export type RescueRole =
  | 'flashcard'
  | 'reinforce-step1'   // 被吃阶梯：A 类识别桥
  | 'reinforce-step2'   // 被吃阶梯：原题型再考
  | 'reinforce-half'    // 半对补练（同题型）

export interface QuizQuestion {
  word: WordEntry
  type: QuizType
  /** C 类补练时露出多少字母（半字母露出），undefined = 全 mask */
  revealedHalf?: number
  /** 标记此题来自补练队列；undefined = 主轮原题 */
  rescueRole?: RescueRole
}

export type RescueStage =
  | 'pending'
  | 'flashcard_done'
  | 'reinforce1_done'
  | 'consolidated'
  | 'still_half'
  | 'saved'
  | 'lost'

export interface RescueQueueItem {
  wordKey: string
  entry: WordEntry
  severity: RescueSeverity
  originalType: QuizType
  stage: RescueStage
  monsterIdx?: number
  enqueuedAt: number      // ms timestamp，用于排序
}
```

- [ ] **Step 3: 把 useQuizRunner 改成从 type.ts import**

在 `src/components/english/words/useQuizRunner.ts:1-10`，删除本地 `QuizQuestion` 定义，改成：

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuizQuestion } from '@/utils/type'
```

并把 `export interface QuizQuestion` 那个块删掉。

- [ ] **Step 4: 全局搜索 QuizQuestion import 路径并修正**

Run: `grep -rn "from '@/components/english/words/useQuizRunner'" src --include='*.tsx' --include='*.ts' | grep QuizQuestion`

如果有文件还在从 useQuizRunner import `QuizQuestion`，把它们改成 `from '@/utils/type'`。`buildReinforcementQuestions` 等返回 `QuizQuestion[]` 的也跟着改。

- [ ] **Step 5: 提示用户跑 lint**

> ⚠ 请用户跑 `pnpm lint`，确认 TypeScript 无类型错误后告诉我，再进入下一 Task。

- [ ] **Step 6: Commit**

```bash
git add src/utils/type.ts src/components/english/words/useQuizRunner.ts
# 如有其他 import 路径修改也加进来
git commit -m "refactor: extend QuizQuestion + add RescueQueueItem types"
```

---

## Task 2 — 常量与 STORAGE_KEYS

**Files:**
- Modify: `src/utils/constant.ts`

- [ ] **Step 1: 阅读现状**

Read `src/utils/constant.ts:22-29`，看到 `STORAGE_KEYS` 当前结构。

- [ ] **Step 2: 新增 STORAGE_KEYS key**

把 `STORAGE_KEYS` 改成：

```ts
export const STORAGE_KEYS = {
  MATH_SIDEBAR_COLLAPSED: 'math-sidebar-collapsed',
  ENGLISH_SEL_STAGE: 'english-sel-stage',
  ENGLISH_SEL_UNITS: 'english-sel-units',
  ENGLISH_SEL_LESSONS: 'english-sel-lessons',
  WEEKLY_PLAN_LAST_LESSONS: 'weekly-plan-last-lessons',
  /** Session 中间态：拯救队列。仅当前 session 有效，phase=done 时清除。spec §11.6 例外 */
  RESCUE_QUEUE: 'rescue_queue_v1',
} as const
```

- [ ] **Step 3: 追加文案常量**

在 `src/utils/constant.ts` 末尾追加：

```ts
// ── 去挫败感文案池（spec §10） ────────────────────────────────
export const RETRY_MC_MESSAGES = [
  '💡 差一点点就对啦，再看看？',
  '🔮 这个宝箱没打开，再点一个试试！',
  '✨ 嗯——再瞅一眼，你已经很接近啦！',
] as const

export const RETRY_SPELL_MESSAGES = [
  '💡 差几个字母~ 黄色的字母飞回去了，再拖一次！',
  '🌟 绿色的对啦！再调整一下其他几个？',
  '🧩 拼图差一点点就完整啦，再试一次！',
] as const

export const EATEN_TITLE_MESSAGES = [
  '😱 {word} 被遗忘小怪兽 {name} 吃掉啦！',
  '🙀 哎呀！{word} 跑到 {name} 肚子里啦！',
  '😵 噢呜~ {name} 把 {word} 偷走啦！',
] as const

export const EATEN_SUB_MESSAGES = [
  '加入拯救清单，等会儿一起救它回来！🧡',
  '别担心，我们会在闯关结束前救回它的！⚔️',
  '记住它的样子，等会儿要靠你拯救！🦸',
] as const

export const RESCUE_SAVED_MESSAGES = [
  '🎉 太棒了！你把 {word} 从 {name} 嘴里救回来了！',
  '✨ {word} 自由啦！{name} 灰溜溜地走了~',
  '💪 拯救成功！{word} 回到了你的词汇宝箱里！',
] as const

export const RESCUE_LOST_MESSAGES = [
  '🌙 这次没救回来也没关系，小怪兽答应等你晚点再来挑战~',
  '🌟 别气馁，明天再来打它一顿！',
  '💤 {name} 今天比较强，明天再练练就能打过它！',
] as const

export const READING_RETRY_MESSAGE = '🔮 这个不对，看看别的？'
export const READING_SECOND_WRONG_PREFIX = '🌟 这个是 '
export const READING_SECOND_WRONG_SUFFIX = '！记一下~'

/** 从文案池随机选一句，做 {word}/{name} 替换 */
export function pickMessage(
  pool: readonly string[],
  vars: { word?: string; name?: string } = {},
): string {
  const tpl = pool[Math.floor(Math.random() * pool.length)]
  return tpl
    .replace('{word}', vars.word ?? '')
    .replace('{name}', vars.name ?? '')
}
```

- [ ] **Step 4: 提示用户跑 lint**

> ⚠ 请用户跑 `pnpm lint` 确认无问题。

- [ ] **Step 5: Commit**

```bash
git add src/utils/constant.ts
git commit -m "refactor: add rescue STORAGE_KEYS and gentle message pools"
```

---

## Task 3 — CSS Tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 阅读现状 + frontend-design**

Read `src/app/globals.css` 找到 `:root` 块，确认现有 token 命名规范（如 `--color-xxx`、`--wm-xxx`）。

**Invoke skill** `frontend-design` 一次：请它检查现有英语模块（"WordsContext"主题）的 CSS variable 命名风格，建议新增 4 个 token 的具体值是否与现有主题协调。

- [ ] **Step 2: 在 `:root` 块追加 token**

```css
:root {
  /* ... 原有变量 ... */

  /* 去挫败感配色 (spec §9.1) */
  --rescue-half: #60A5FA;
  --rescue-eaten: #FB923C;
  --rescue-saved: #34D399;
  --rescue-flash-warn: #FBBF24;
  --monster-veil: rgba(20, 12, 50, 0.78);
}
```

- [ ] **Step 3: 用户验证**

> ⚠ 请用户在浏览器打开任意英语单词页（如 `/english/words/weekly/...`），开发者工具确认 `getComputedStyle(document.documentElement).getPropertyValue('--rescue-half')` 返回 `#60A5FA`。

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "refactor: add rescue UI color tokens"
```

---

## Task 4 — 怪兽资源数据

**Files:**
- Create: `src/components/english/words/monsters.ts`

- [ ] **Step 1: 从 demo 抽出 4 只怪兽数据**

Read `docs/demo/word_quiz_monster_eat.html` line 146-280（`MONSTERS` 数组）和 line 333-338（`MOUTH_CENTER`）。

- [ ] **Step 2: 创建 monsters.ts**

```ts
export interface MonsterDef {
  /** SVG `<g>` 内部内容字符串，含 mouth-closed / mouth-open 两组 */
  body: string
  color: string
  name: string
  /** 嘴中心在 viewBox 200x200 内的坐标，用于飞字定位 */
  mouth: { x: number; y: number }
}

export const MONSTERS: MonsterDef[] = [
  {
    name: '毛毛',
    color: '#AFA9EC',
    mouth: { x: 100, y: 158 },
    body: `<!-- 把 demo line 149-181 的 SVG paths 原样粘贴进来 -->`,
  },
  {
    name: '刺刺',
    color: '#97C459',
    mouth: { x: 100, y: 162 },
    body: `<!-- demo line 187-217 -->`,
  },
  {
    name: '橙橙',
    color: '#EF9F27',
    mouth: { x: 100, y: 156 },
    body: `<!-- demo line 220-250 -->`,
  },
  {
    name: '粉粉',
    color: '#ED93B1',
    mouth: { x: 100, y: 162 },
    body: `<!-- demo line 253-278 -->`,
  },
]
```

> ⚠ 注意：把 demo 里的 SVG path 字符串原样复制进 ` `` ` 反引号字符串。HTML 中的 `display="none"` 等属性都保留。

- [ ] **Step 3: 提示用户跑 lint**

> ⚠ `pnpm lint` 确认无问题。

- [ ] **Step 4: Commit**

```bash
git add src/components/english/words/monsters.ts
git commit -m "feat: extract monster SVG defs from demo into shared module"
```

---

## Task 5 — useRescueQueue hook（无 localStorage）

**Files:**
- Create: `src/hooks/useRescueQueue.ts`

> 本 task 先实现 in-memory 版本；localStorage 持久化在 Task 14 加进来，便于隔离调试。

- [ ] **Step 1: 创建 hook 文件**

```ts
'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  QuizQuestion,
  RescueQueueItem,
  RescueSeverity,
  WordEntry,
} from '@/utils/type'
import type { QuizType } from '@/utils/english-helpers'
import { interleaveOrderedQuizSlots } from '@/utils/english-helpers'
import { MONSTERS } from '@/components/english/words/monsters'

export interface RescueBatches {
  /** 主轮中段穿插：半对词同题型补练 1 次 */
  halfBatch: QuizQuestion[]
  /** 主轮末尾追加：被吃词阶梯补练 = flashcard + A + 原题型 */
  eatenBatch: QuizQuestion[]
}

export interface UseRescueQueueApi {
  retryList: RescueQueueItem[]
  eatenList: RescueQueueItem[]
  enqueueHalf(entry: WordEntry, type: QuizType, wordKey: string): void
  enqueueEaten(entry: WordEntry, type: QuizType, wordKey: string): { monsterIdx: number }
  advance(wordKey: string, outcome: 'correct' | 'wrong'): void
  isInQueue(wordKey: string): boolean
  buildBatches(seed: number): RescueBatches
  clear(): void
}

export function useRescueQueue(): UseRescueQueueApi {
  const [items, setItems] = useState<RescueQueueItem[]>([])
  const seqRef = useRef(0)

  const enqueueHalf = useCallback((entry: WordEntry, type: QuizType, wordKey: string) => {
    setItems((prev) => {
      if (prev.some((i) => i.wordKey === wordKey)) return prev
      return [...prev, {
        wordKey, entry, severity: 'half',
        originalType: type, stage: 'pending',
        enqueuedAt: ++seqRef.current,
      }]
    })
  }, [])

  const enqueueEaten = useCallback((entry: WordEntry, type: QuizType, wordKey: string) => {
    const monsterIdx = Math.floor(Math.random() * MONSTERS.length)
    setItems((prev) => {
      if (prev.some((i) => i.wordKey === wordKey && i.severity === 'eaten')) return prev
      // 同 wordKey 已是 half 时升级为 eaten
      const without = prev.filter((i) => i.wordKey !== wordKey)
      return [...without, {
        wordKey, entry, severity: 'eaten',
        originalType: type, stage: 'pending', monsterIdx,
        enqueuedAt: ++seqRef.current,
      }]
    })
    return { monsterIdx }
  }, [])

  const advance = useCallback((wordKey: string, outcome: 'correct' | 'wrong') => {
    setItems((prev) => prev.map((it) => {
      if (it.wordKey !== wordKey) return it
      // 按状态机推进
      if (it.severity === 'half') {
        // half: pending → consolidated (correct) | still_half (wrong)
        return { ...it, stage: outcome === 'correct' ? 'consolidated' : 'still_half' }
      }
      // eaten: pending → flashcard_done → reinforce1_done → saved/lost
      if (it.stage === 'pending') return { ...it, stage: 'flashcard_done' }
      if (it.stage === 'flashcard_done') {
        return { ...it, stage: outcome === 'correct' ? 'reinforce1_done' : 'lost' }
      }
      if (it.stage === 'reinforce1_done') {
        return { ...it, stage: outcome === 'correct' ? 'saved' : 'lost' }
      }
      return it
    }))
  }, [])

  const isInQueue = useCallback((wordKey: string) =>
    items.some((i) => i.wordKey === wordKey), [items])

  const clear = useCallback(() => setItems([]), [])

  const retryList = useMemo(() =>
    items.filter((i) => i.severity === 'half'), [items])
  const eatenList = useMemo(() =>
    items.filter((i) => i.severity === 'eaten'), [items])

  const buildBatches = useCallback((seed: number): RescueBatches => {
    // halfBatch：每个 still-active half 词 1 题，同题型；spec §3 + §7
    const halfActive = items.filter((i) =>
      i.severity === 'half' && i.stage === 'pending')
    const halfGroups: QuizQuestion[][] = halfActive.map((i) => [{
      word: i.entry,
      type: i.originalType,
      revealedHalf: i.originalType === 'C' ? Math.ceil(i.entry.word.length / 2) : undefined,
      rescueRole: 'reinforce-half',
    }])
    const halfBatch = halfGroups.length
      ? interleaveOrderedQuizSlots(halfGroups, seed, 3)
      : []

    // eatenBatch：按 enqueuedAt 顺序，每词 3 步 = flashcard + A + 原题型
    const eatenActive = items
      .filter((i) => i.severity === 'eaten' && i.stage === 'pending')
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt)
    const eatenBatch: QuizQuestion[] = []
    for (const it of eatenActive) {
      eatenBatch.push({ word: it.entry, type: 'A', rescueRole: 'flashcard' })
      eatenBatch.push({ word: it.entry, type: 'A', rescueRole: 'reinforce-step1' })
      eatenBatch.push({
        word: it.entry,
        type: it.originalType,
        rescueRole: 'reinforce-step2',
      })
    }

    return { halfBatch, eatenBatch }
  }, [items])

  return {
    retryList, eatenList,
    enqueueHalf, enqueueEaten, advance,
    isInQueue, buildBatches, clear,
  }
}
```

- [ ] **Step 2: 提示用户跑 lint**

> ⚠ `pnpm lint` 确认无问题。

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRescueQueue.ts
git commit -m "feat: add useRescueQueue hook (in-memory)"
```

---

## Task 6 — buildReinforcementQuestions 扩展

**Files:**
- Modify: `src/utils/english-helpers.ts`

- [ ] **Step 1: 阅读现状**

Read `src/utils/english-helpers.ts:271-289`，确认当前签名是 `(helpClicks, vocab, keyOf, seed, minGap)`。

- [ ] **Step 2: 添加新函数（保留旧函数）**

在旧函数下方追加新函数（旧函数保留以防其他调用方未迁完）：

```ts
import type { RescueQueueItem } from '@/utils/type'

/**
 * Build half-correct batch: 1 question per half-correct word, same type as original.
 * Used for mid-main-round interleaving (spec §3).
 */
export function buildHalfReinforcementBatch(
  rescueItems: RescueQueueItem[],
  seed: number,
  minGap = 3,
): QuizQuestion[] {
  const halfActive = rescueItems.filter(
    (i) => i.severity === 'half' && i.stage === 'pending',
  )
  if (!halfActive.length) return []
  const groups: QuizQuestion[][] = halfActive.map((i) => [{
    word: i.entry,
    type: i.originalType,
    revealedHalf: i.originalType === 'C'
      ? Math.ceil(i.entry.word.length / 2)
      : undefined,
    rescueRole: 'reinforce-half',
  }])
  return interleaveOrderedQuizSlots(groups, seed, minGap)
}

/**
 * Build eaten ladder batch: 3 questions per eaten word, in order.
 * flashcard (A) -> reinforce-step1 (A) -> reinforce-step2 (originalType).
 * Used at the tail of main round (spec §3 §7).
 */
export function buildEatenLadderBatch(
  rescueItems: RescueQueueItem[],
): QuizQuestion[] {
  const eatenActive = rescueItems
    .filter((i) => i.severity === 'eaten' && i.stage === 'pending')
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt)
  const out: QuizQuestion[] = []
  for (const it of eatenActive) {
    out.push({ word: it.entry, type: 'A', rescueRole: 'flashcard' })
    out.push({ word: it.entry, type: 'A', rescueRole: 'reinforce-step1' })
    out.push({ word: it.entry, type: it.originalType, rescueRole: 'reinforce-step2' })
  }
  return out
}
```

> 注：`useRescueQueue.buildBatches` 与上面两函数逻辑一致；保留两份是为了让 session 可直接调用工具函数（无需 hook），方便测试。后续若确定只走 hook 通路，可删掉 hook 内部实现，统一调这两个工具函数。

- [ ] **Step 3: 验证 useRescueQueue 改用工具函数（可选简化）**

如果走简化路线，把 `src/hooks/useRescueQueue.ts` 中 `buildBatches` 实现替换为：

```ts
import {
  buildHalfReinforcementBatch,
  buildEatenLadderBatch,
} from '@/utils/english-helpers'

const buildBatches = useCallback((seed: number): RescueBatches => ({
  halfBatch: buildHalfReinforcementBatch(items, seed),
  eatenBatch: buildEatenLadderBatch(items),
}), [items])
```

- [ ] **Step 4: 提示用户跑 lint**

- [ ] **Step 5: Commit**

```bash
git add src/utils/english-helpers.ts src/hooks/useRescueQueue.ts
git commit -m "feat: add buildHalfReinforcementBatch + buildEatenLadderBatch"
```

---

## Task 7 — MonsterEatScene 组件

**Files:**
- Create: `src/components/english/words/MonsterEatScene.tsx`

- [ ] **Step 1: frontend-design 检阅**

**Invoke skill** `frontend-design`：传入 `docs/demo/word_quiz_monster_eat.html` 第 22-135 行（怪兽弹层 CSS + 结构）、第 340-468 行（动画逻辑）；让其评审"如何把 demo 的 vanilla DOM 动画转成 React 19 受控组件、动画时序如何用 CSS class + requestAnimationFrame 干净落地、prefers-reduced-motion 怎么接"。

- [ ] **Step 2: 创建组件骨架**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { MONSTERS } from './monsters'
import {
  EATEN_TITLE_MESSAGES,
  EATEN_SUB_MESSAGES,
  pickMessage,
} from '@/utils/constant'

interface Props {
  /** 不为 null 时显示弹层；null = 隐藏 */
  word: string | null
  monsterIdx: number
  /** 同 session 内第二次起，缩短动画到 1.2s */
  isAbbreviated: boolean
  onDismiss: () => void
}

export default function MonsterEatScene({
  word, monsterIdx, isAbbreviated, onDismiss,
}: Props) {
  const monster = MONSTERS[monsterIdx]
  const [phase, setPhase] = useState<'enter' | 'flying' | 'eaten' | 'done'>('enter')
  const [title, setTitle] = useState('')
  const [sub, setSub] = useState('')
  const flyingRef = useRef<HTMLDivElement>(null)
  const monsterRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!word) return
    setTitle(pickMessage(EATEN_TITLE_MESSAGES, { word, name: monster.name }))
    setSub(pickMessage(EATEN_SUB_MESSAGES, { word, name: monster.name }))

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dur = reducedMotion ? 'short' : isAbbreviated ? 'mid' : 'full'

    setPhase('enter')
    // 时序：enter → flying → eaten → done
    const t1 = setTimeout(() => setPhase('flying'),
      dur === 'short' ? 100 : dur === 'mid' ? 250 : 450)
    const t2 = setTimeout(() => setPhase('eaten'),
      dur === 'short' ? 400 : dur === 'mid' ? 850 : 1500)
    const t3 = setTimeout(() => setPhase('done'),
      dur === 'short' ? 600 : dur === 'mid' ? 1200 : 2100)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [word, monster.name, isAbbreviated])

  if (!word) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{ background: 'var(--monster-veil)', backdropFilter: 'blur(8px)' }}
    >
      <div className="w-[300px] rounded-3xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
        <div className="relative mx-auto flex h-[280px] w-[280px] items-center justify-center">
          {/* flying word */}
          {(phase === 'enter' || phase === 'flying') && (
            <div
              ref={flyingRef}
              className={`absolute left-1/2 z-10 rounded-xl px-5 py-2 text-[22px] font-extrabold text-white shadow-[0_4px_18px_rgba(127,119,221,.45)] ${
                phase === 'enter' ? 'top-[10px] -translate-x-1/2' : ''
              }`}
              style={{
                background: 'linear-gradient(135deg,#7F77DD,#5DCAA5)',
                transition: phase === 'flying'
                  ? 'top .55s cubic-bezier(.55,0,.6,1), transform .55s cubic-bezier(.55,0,.6,1), opacity .45s ease .15s'
                  : 'none',
                top: phase === 'flying' ? `${30 + monster.mouth.y * 1.1 - 18}px` : undefined,
                left: phase === 'flying' ? `${30 + monster.mouth.x * 1.1}px` : '50%',
                transform: phase === 'flying'
                  ? 'translateX(-50%) scale(0.15) rotate(8deg)'
                  : 'translateX(-50%)',
                opacity: phase === 'flying' ? 0 : 1,
              }}
            >
              {word}
            </div>
          )}
          {/* monster body */}
          <svg
            ref={monsterRef}
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2"
            style={{
              transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)',
              transform: phase === 'enter'
                ? 'translate(-50%,-50%) scale(.7)'
                : 'translate(-50%,-50%) scale(1)',
            }}
            dangerouslySetInnerHTML={{
              __html: monster.body
                .replace(
                  /<g id="mouth-(closed|open)"[^>]*>/g,
                  (_, m) => `<g id="mouth-${m}" display="${
                    (phase === 'flying' && m === 'open') || (phase !== 'flying' && m === 'closed')
                      ? '' : 'none'
                  }">`,
                ),
            }}
          />
        </div>
        {phase === 'done' && (
          <>
            <div className="px-1 pb-2 text-center text-sm font-bold leading-relaxed text-[#3C3489] animate-[fadeUp_.3s_ease]">
              <div dangerouslySetInnerHTML={{ __html: title.replace(/\{word\}/g, `<b style="color:#D85A30">${word}</b>`) }} />
              <div className="mt-1 font-bold text-[#854F0B]">{sub}</div>
            </div>
            <button
              onClick={onDismiss}
              className="mt-2.5 w-full rounded-xl bg-[#534AB7] py-2.5 px-8 text-[15px] font-extrabold text-white transition hover:bg-[#3C3489]"
            >
              ⚔️ 知道啦，继续闯关！
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

> ⚠ 上面 inline 计算嘴坐标用了 `30 + mouth.x * 1.1` 等魔数（与 demo 第 414-418 行一致）。代码块里硬编码 OK，加注释指 demo。

- [ ] **Step 3: 添加 keyframe fadeUp 到 globals.css**

在 `src/app/globals.css` 任意位置添加：

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 4: 用户验证**

> ⚠ 请用户在浏览器创建一个临时测试页（或在 dev tools 临时 mount）确认弹层显示、动画 2.4s 流畅、按钮点击关闭。spec §9.3。本步等用户确认 OK 后才进入下一 task。

- [ ] **Step 5: Commit**

```bash
git add src/components/english/words/MonsterEatScene.tsx src/app/globals.css
git commit -m "feat: add MonsterEatScene component"
```

---

## Task 8 — RescueListBadge 组件

**Files:**
- Create: `src/components/english/words/RescueListBadge.tsx`

- [ ] **Step 1: frontend-design 检阅**

**Invoke skill** `frontend-design`：让其设计"题面顶端的横向滚动小条，包含三种颜色 chip（蓝=半对、橙=被吃、绿=已救/已巩固），空时整条隐藏，要 playful 但不抢主题"。把 spec §9.3 的 ASCII 布局贴过去做参考。

- [ ] **Step 2: 创建组件**

```tsx
'use client'

import type { RescueQueueItem } from '@/utils/type'

interface Props {
  items: RescueQueueItem[]
}

export default function RescueListBadge({ items }: Props) {
  if (items.length === 0) return null

  const visible = items.slice(0, 5)
  const more = items.length - visible.length

  return (
    <div className="mb-3 rounded-2xl border border-white/10 bg-white/[.04] px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between text-[.7rem] font-extrabold tracking-wider text-white/60">
        <span>🧡 拯救清单</span>
        <span>{items.length} 个待救</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
        {visible.map((it) => {
          const cfg = chipConfig(it)
          return (
            <span
              key={it.wordKey}
              className="shrink-0 rounded-full border-[1.5px] px-2.5 py-0.5 text-[.75rem] font-extrabold transition-colors duration-250"
              style={{
                background: cfg.bg,
                borderColor: cfg.border,
                color: cfg.color,
              }}
              title={`${cfg.tag} · ${it.entry.explanation ?? ''}`}
            >
              {cfg.icon} {it.entry.word}
            </span>
          )
        })}
        {more > 0 && (
          <span className="shrink-0 self-center text-[.7rem] font-bold text-white/40">
            … +{more}
          </span>
        )}
      </div>
    </div>
  )
}

function chipConfig(it: RescueQueueItem) {
  if (it.stage === 'saved' || it.stage === 'consolidated') {
    return {
      icon: '💚', tag: '已救回',
      bg: 'rgba(52,211,153,.15)',
      border: 'var(--rescue-saved)',
      color: 'var(--rescue-saved)',
    }
  }
  if (it.stage === 'lost' || it.stage === 'still_half') {
    return {
      icon: '🌙', tag: '下次再战',
      bg: 'rgba(255,255,255,.06)',
      border: 'rgba(255,255,255,.18)',
      color: 'rgba(255,255,255,.55)',
    }
  }
  if (it.severity === 'eaten') {
    return {
      icon: '🧡', tag: '待拯救',
      bg: 'rgba(251,146,60,.15)',
      border: 'var(--rescue-eaten)',
      color: 'var(--rescue-eaten)',
    }
  }
  return {
    icon: '🧪', tag: '待巩固',
    bg: 'rgba(96,165,250,.15)',
    border: 'var(--rescue-half)',
    color: 'var(--rescue-half)',
  }
}
```

- [ ] **Step 3: 提示用户跑 lint**

- [ ] **Step 4: Commit**

```bash
git add src/components/english/words/RescueListBadge.tsx
git commit -m "feat: add RescueListBadge component"
```

---

## Task 9 — FlashRecallCard 组件

**Files:**
- Create: `src/components/english/words/FlashRecallCard.tsx`

- [ ] **Step 1: frontend-design 检阅**

**Invoke skill** `frontend-design`：让其设计"1.5s 闪现卡，60px 大字 word + IPA + 中文释义 + 自动发音 + 进度点 `● ○ ○`，1.5s 后自动 fadeOut → 调 onDone；点击可提前到 0.5s"。spec §9.3。

- [ ] **Step 2: 创建组件**

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { WordEntry } from '@/utils/type'

interface Props {
  word: WordEntry
  /** 当前在阶梯的第几步（0-based），用于进度点显示 */
  step: 0 | 1 | 2
  totalSteps: number
  onDone: () => void
}

export default function FlashRecallCard({ word, step, totalSteps, onDone }: Props) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // 自动播报单词
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(word.word)
      u.lang = 'en-US'
      u.rate = 0.85
      window.speechSynthesis.speak(u)
    }
    const t1 = setTimeout(() => setLeaving(true), 1200)
    const t2 = setTimeout(() => onDone(), 1500)
    return () => {
      clearTimeout(t1); clearTimeout(t2)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [word, onDone])

  const handleSkip = () => {
    setLeaving(true)
    setTimeout(onDone, 200)
  }

  return (
    <div
      onClick={handleSkip}
      className={`flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-[rgba(96,165,250,.08)] to-[rgba(167,139,250,.06)] p-8 transition-opacity duration-300 ${
        leaving ? 'opacity-0' : 'opacity-100 animate-[fadeUp_.3s_ease]'
      }`}
    >
      <div className="mb-6 text-center text-[.9rem] font-bold text-white/70">
        🌟 看一眼，记一记 🌟
      </div>
      <div className="mb-2 text-[60px] font-black leading-tight text-white">
        {word.word}
      </div>
      {word.ipa && (
        <div className="mb-2 text-[1.1rem] font-bold text-[#a78bfa]">
          {word.ipa}
        </div>
      )}
      <div className="mb-8 text-center text-[1rem] font-bold text-white/90">
        {word.explanation}
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${
              i <= step ? 'bg-[var(--rescue-half)]' : 'bg-white/15'
            }`}
          />
        ))}
      </div>
      <div className="mt-3 text-[.7rem] text-white/40">拯救进度 {step + 1}/{totalSteps}</div>
    </div>
  )
}
```

- [ ] **Step 3: 提示用户跑 lint**

- [ ] **Step 4: Commit**

```bash
git add src/components/english/words/FlashRecallCard.tsx
git commit -m "feat: add FlashRecallCard component"
```

---

## Task 10 — RescueCompletionView 组件

**Files:**
- Create: `src/components/english/words/RescueCompletionView.tsx`

- [ ] **Step 1: frontend-design 检阅**

**Invoke skill** `frontend-design`：spec §9.3 完成页"拯救成果"区块。让其设计"接在原完成统计下方，仅当本 session 有被吃词时显示；3 种文案分支（全救/部分救/全没救）+ 单词列表（💚 救回 / 🧡 未救回）"。

- [ ] **Step 2: 创建组件**

```tsx
'use client'

import type { RescueQueueItem } from '@/utils/type'

interface Props {
  eatenList: RescueQueueItem[]
}

export default function RescueCompletionView({ eatenList }: Props) {
  if (eatenList.length === 0) return null

  const saved = eatenList.filter((i) => i.stage === 'saved')
  const lost = eatenList.filter((i) => i.stage === 'lost')

  let headline = ''
  if (lost.length === 0) {
    headline = '🏆 太强啦！这一关被吃掉的单词全部救回来！'
  } else if (saved.length > 0) {
    headline = `⚔️ 救回 ${saved.length} 个单词！还有 ${lost.length} 个等你下次去打怪兽~`
  } else {
    headline = '🌟 这关怪兽有点厉害，没关系，下次还有机会！'
  }

  return (
    <div className="mt-5 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-50/[.08] to-orange-50/[.04] p-4">
      <div className="mb-2 text-[.78rem] font-extrabold tracking-wider text-amber-300">
        ⚔️ 拯救成果
      </div>
      <div className="mb-3 text-[.95rem] font-bold text-white/90">{headline}</div>
      <div className="flex flex-wrap gap-2">
        {saved.map((i) => (
          <span
            key={i.wordKey}
            className="rounded-full border border-[var(--rescue-saved)]/50 bg-[rgba(52,211,153,.12)] px-3 py-1 text-[.82rem] font-extrabold text-[var(--rescue-saved)]"
          >
            💚 {i.entry.word}
          </span>
        ))}
        {lost.map((i) => (
          <span
            key={i.wordKey}
            className="rounded-full border border-white/15 bg-white/[.04] px-3 py-1 text-[.82rem] font-bold text-white/55"
            title="明天再战"
          >
            🧡 {i.entry.word}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 提示用户跑 lint**

- [ ] **Step 4: Commit**

```bash
git add src/components/english/words/RescueCompletionView.tsx
git commit -m "feat: add RescueCompletionView component"
```

---

## Task 11 — useQuizRunner attempt 状态机

**Files:**
- Modify: `src/components/english/words/useQuizRunner.ts`

- [ ] **Step 1: 阅读现状**

Read 已读过的 useQuizRunner.ts，确认现有 state：`answered / selected / spellOk / wasCorrect`。

- [ ] **Step 2: 添加 attempt 状态 + onCommit 扩签名**

把 `useQuizRunner.ts` 整体改造：

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuizQuestion } from '@/utils/type'

export type QuizAttempt = 'first' | 'retry' | 'done'

export interface QuizCommitInfo {
  finalCorrect: boolean
  usedRetry: boolean
}

export interface QuizRunnerOptions {
  question: QuizQuestion | null
  /** 单次最终结论（含 retry/补练）回传给 session */
  onCommit: (info: QuizCommitInfo) => void
  /** 用户按"下一题"或自动 advance 时调用 */
  onAdvance: () => void
  /** 答对自动 advance 间隔 */
  autoAdvanceMs?: number
  /** 此题是否允许 retry（默认 true；闪现卡等 rescueRole 应传 false） */
  allowRetry?: boolean
}

export interface QuizRunnerState {
  attempt: QuizAttempt
  answered: boolean
  selected: string | null
  spellOk: boolean | null
  wasCorrect: boolean | null
  /** 用户已尝试过的错选项集合，用于在 UI 上置灰 */
  wrongChoices: Set<string>
  showPassageHint: boolean
  openPassageHint: () => void
  closePassageHint: () => void
  showHelp: boolean
  openHelp: () => void
  closeHelp: () => void
  handleMCAnswer: (chosen: string) => void
  handleSpellSubmit: (val: string) => void
  /** SpellTiles 调；reset 输入区给第二次拼 */
  acknowledgeSpellRetry: () => void
  requestAdvance: () => void
}

export function useQuizRunner({
  question,
  onCommit,
  onAdvance,
  autoAdvanceMs = 600,
  allowRetry = true,
}: QuizRunnerOptions): QuizRunnerState {
  const [attempt, setAttempt] = useState<QuizAttempt>('first')
  const [selected, setSelected] = useState<string | null>(null)
  const [spellOk, setSpellOk] = useState<boolean | null>(null)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [wrongChoices, setWrongChoices] = useState<Set<string>>(new Set())
  const [showPassageHint, setShowPassageHint] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const [prevQuestion, setPrevQuestion] = useState(question)
  if (prevQuestion !== question) {
    setPrevQuestion(question)
    setAttempt('first')
    setSelected(null)
    setSpellOk(null)
    setWasCorrect(null)
    setWrongChoices(new Set())
    setShowPassageHint(false)
    setShowHelp(false)
  }

  const onCommitRef = useRef(onCommit)
  const onAdvanceRef = useRef(onAdvance)
  useEffect(() => { onCommitRef.current = onCommit }, [onCommit])
  useEffect(() => { onAdvanceRef.current = onAdvance }, [onAdvance])

  const answered = attempt === 'done'

  useEffect(() => {
    if (answered && wasCorrect === true) {
      const t = setTimeout(() => onAdvanceRef.current(), autoAdvanceMs)
      return () => clearTimeout(t)
    }
  }, [answered, wasCorrect, autoAdvanceMs])

  const finish = useCallback((finalCorrect: boolean, usedRetry: boolean) => {
    setAttempt('done')
    setWasCorrect(finalCorrect)
    onCommitRef.current({ finalCorrect, usedRetry })
  }, [])

  const handleMCAnswer = useCallback(
    (chosen: string) => {
      if (!question || attempt === 'done') return
      const correct = chosen === question.word.word
      setSelected(chosen)
      if (correct) {
        finish(true, attempt === 'retry')
        return
      }
      // first wrong
      if (attempt === 'first' && allowRetry) {
        setWrongChoices((s) => new Set(s).add(chosen))
        setAttempt('retry')
        return
      }
      // second wrong (or retry disabled)
      setWrongChoices((s) => new Set(s).add(chosen))
      finish(false, attempt === 'retry' || !allowRetry)
    },
    [attempt, question, allowRetry, finish],
  )

  const handleSpellSubmit = useCallback(
    (val: string) => {
      if (!question || attempt === 'done') return
      const correct = val.trim().toLowerCase() === question.word.word.toLowerCase()
      setSpellOk(correct)
      if (correct) {
        finish(true, attempt === 'retry')
        return
      }
      if (attempt === 'first' && allowRetry) {
        setAttempt('retry')
        // SpellTiles 内部需要看到 attempt === 'retry' 重置输入区
        return
      }
      finish(false, attempt === 'retry' || !allowRetry)
    },
    [attempt, question, allowRetry, finish],
  )

  const acknowledgeSpellRetry = useCallback(() => {
    setSpellOk(null)
  }, [])

  const requestAdvance = useCallback(() => {
    onAdvanceRef.current()
  }, [])

  const openPassageHint = useCallback(() => setShowPassageHint(true), [])
  const closePassageHint = useCallback(() => setShowPassageHint(false), [])
  const openHelp = useCallback(() => setShowHelp(true), [])
  const closeHelp = useCallback(() => setShowHelp(false), [])

  return {
    attempt, answered, selected, spellOk, wasCorrect, wrongChoices,
    showPassageHint, openPassageHint, closePassageHint,
    showHelp, openHelp, closeHelp,
    handleMCAnswer, handleSpellSubmit, acknowledgeSpellRetry, requestAdvance,
  }
}
```

- [ ] **Step 3: 全局搜索 onCommit 调用方**

Run: `grep -rn "useQuizRunner" src --include='*.tsx' --include='*.ts'`

至少 `QuizQuestionBody.tsx` / `WeeklyPlanSession.tsx` 在用。它们传的 `onCommit: (correct: boolean) => void` 签名已变。下一 task（11+12）改 `QuizQuestionBody.tsx`，更外层（`WeeklyPlanSession.tsx`）的 `handleAnswer` 在 Task 13 处理。**先用 TS 错误兜底确认改全。**

- [ ] **Step 4: 提示用户跑 lint**

> ⚠ 此时 `pnpm lint` 大概率报错（QuizQuestionBody 还在传旧 onCommit），属预期。先 commit 这个隔离的状态机改动。

- [ ] **Step 5: Commit**

```bash
git add src/components/english/words/useQuizRunner.ts
git commit -m "refactor: add attempt state machine to useQuizRunner"
```

---

## Task 12 — QuizQuestionBody 接入 attempt 状态

**Files:**
- Modify: `src/components/english/words/QuizQuestionBody.tsx`

- [ ] **Step 1: frontend-design 检阅**

**Invoke skill** `frontend-design`：现 QuizQuestionBody 选择题答错时显示 `#f87171` 红色（line 178-181）。让其设计 retry 通道："错选项 220ms 淡出至 opacity-40 + 灰边 + 置灰禁用 + 平行显示「💡 差一点点就对啦~」温和提示条"，遵守"禁红、禁 ❌、playful"。

- [ ] **Step 2: 修改选项渲染逻辑（line 169-202）**

把 `options.map` 内部的判错块替换为：

```tsx
{options.map((o, optIdx) => {
  const isCorrect = o.word === question.word.word
  const isSel = runner.selected === o.word
  const isWrongAttempted = runner.wrongChoices.has(o.word)
  let cls = 'bg-white/[.04] border-white/[.09] text-[#f0f0ff]'
  let labelCls = 'text-[#a78bfa]/60'
  if (runner.answered && isCorrect) {
    // 终态显示正确项绿色
    cls = 'border-[#4ade80] bg-[rgba(74,222,128,.12)] text-[#4ade80]'
    labelCls = 'text-[#4ade80]/70'
  } else if (isWrongAttempted) {
    // 错过的选项：温和淡出 + 灰边 + 不可点
    cls = 'bg-white/[.02] border-white/10 text-white/40 opacity-50 transition-opacity duration-200'
    labelCls = 'text-white/30'
  }
  const label = ['A', 'B', 'C', 'D'][optIdx] ?? String(optIdx + 1)
  return (
    <button
      key={o.word}
      disabled={runner.answered || isWrongAttempted}
      onClick={() => runner.handleMCAnswer(o.word)}
      className={`font-nunito flex cursor-pointer items-start gap-[clamp(.4rem,1.2cqi,.6rem)] rounded-xl border-2 px-[clamp(.6rem,2cqi,.9rem)] py-[clamp(.7rem,2.5cqi,1rem)] text-left text-[clamp(1.2rem,2.2cqi,1rem)] leading-snug font-bold break-words transition-all disabled:cursor-default ${cls} ${
        !runner.answered && !isWrongAttempted
          ? 'hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.1)]'
          : ''
      }`}
    >
      <span className={`shrink-0 font-extrabold tabular-nums ${labelCls}`}>{label}.</span>
      <span>{isA || isD ? o.word : o.explanation}</span>
    </button>
  )
})}
```

- [ ] **Step 3: 在选项块下方添加 retry 文案条**

在 `</div>` 关闭 `choices-grid` 之后、`{isC && ...}` 之前插入：

```tsx
{runner.attempt === 'retry' && (
  <div
    role="status"
    aria-live="polite"
    className="rounded-2xl border border-[var(--rescue-half)]/40 bg-[rgba(96,165,250,.08)] px-4 py-3 text-center text-[.9rem] font-bold text-[#93c5fd] animate-[fadeUp_.2s_ease]"
  >
    {/* 题目 mount 时随机选 1 条；这里直接调 pickMessage 避免每渲染换一句 */}
    {retryHintMC}
  </div>
)}
```

在组件顶端用 `useMemo` 锁定文案：

```tsx
import { pickMessage, RETRY_MC_MESSAGES, RETRY_SPELL_MESSAGES } from '@/utils/constant'
// ...
const retryHintMC = useMemo(
  () => pickMessage(RETRY_MC_MESSAGES),
  [questionKey],
)
```

- [ ] **Step 4: 删除 line 216-225 的"下一题"按钮的错答状态**

当前 line 216 `runner.wasCorrect === false` 时才出现"下一题"按钮。新机制下 retry 阶段不该出现"下一题"（会绕过 retry）。改成：

```tsx
{runner.attempt === 'done' && runner.wasCorrect === false && (
  // 下一题按钮保留（终态被吃后 MonsterEatScene 关闭后回到此处）
  <div className="flex flex-wrap justify-center gap-2">
    <button
      onClick={runner.requestAdvance}
      className="..."
    >
      下一题 →
    </button>
  </div>
)}
```

- [ ] **Step 5: 调整 useQuizRunner 调用 onCommit 签名**

Read line ~85（`useQuizRunner` 调用处）；这个 hook 调用在 `WeeklyPlanSession.tsx` 中。本 task 暂时让 QuizQuestionBody 只把 `runner.attempt`/`runner.wrongChoices` 渲染到位，签名变更**留到 Task 13** 在 session 层一起改。

- [ ] **Step 6: 提示用户跑 lint**

- [ ] **Step 7: Commit**

```bash
git add src/components/english/words/QuizQuestionBody.tsx
git commit -m "refactor: gentle retry UI for multiple-choice quiz"
```

---

## Task 13 — SpellTiles retry + revealedHalf

**Files:**
- Modify: `src/components/english/words/SpellTiles.tsx`

- [ ] **Step 1: frontend-design 检阅**

**Invoke skill** `frontend-design`：spec §9 拼写 retry。让其设计"放对的字母绿色高亮+固定不可拖、放错的字母 0.3s 软抖 + 黄(#FBBF24)闪烁 → 飞回备选区；提交按钮在 retry 态变 secondary 色不强调"。**禁掉 line 320 的 `✗ 错误，正确答案：word`**。

- [ ] **Step 2: 阅读现状全量**

Read `src/components/english/words/SpellTiles.tsx` 全文（约 327 行），定位：
- 字母拖入区 / 备选池布局位置
- `handleConfirm` 函数
- `isCorrect` 状态判定 line 308-324

- [ ] **Step 3: 扩展 props + retry 通道**

在 `SpellTilesProps` 加：

```ts
interface SpellTilesProps {
  word: string
  onSubmit: (val: string) => void
  answered: boolean
  isCorrect: boolean | null
  /** 来自 useQuizRunner：'first' | 'retry' | 'done' */
  attempt: 'first' | 'retry' | 'done'
  /** retry 态时上游调用清空 isCorrect，让本组件重置 confirm 按钮 */
  onRetryAcknowledged?: () => void
  /** 露出多少字母作为补练提示（C 类半字母露出） */
  revealedHalf?: number
  buttonStyle?: SpellButtonStyle
}
```

- [ ] **Step 4: 替换 line 308-324 的反馈块**

```tsx
{/* 仅在 done 且对时显示成功提示；错时不立即喊错，由 retry 通道处理 */}
{attempt === 'done' && isCorrect === true && (
  <div className="rounded-[10px] bg-[rgba(74,222,128,.12)] p-2.5 text-center text-[.86rem] font-bold text-[#4ade80]">
    ✓ 正确！🎉
  </div>
)}
{attempt === 'retry' && (
  <div
    role="status"
    aria-live="polite"
    className="rounded-2xl border border-[var(--rescue-flash-warn)]/40 bg-[rgba(251,191,36,.08)] px-4 py-3 text-center text-[.88rem] font-bold text-[#fbbf24] animate-[fadeUp_.2s_ease]"
  >
    {retryHintSpell}
  </div>
)}
```

- [ ] **Step 5: 在 retry 态把"放错位置的字母"飞回备选区**

定位 `handleConfirm` 函数（提交后判错的位置）：拼错时，**不要**进入"答案展示"模式，而是触发本地 state：

```tsx
const [retryFeedback, setRetryFeedback] = useState<{
  correctIndices: Set<number>
  wrongIndices: Set<number>
} | null>(null)

const handleConfirm = useCallback(() => {
  const submitted = /* 当前已拖入字母数组拼成的字符串 */
  // 总是先调 onSubmit 让 useQuizRunner 判错
  onSubmit(submitted)
  // 如果 useQuizRunner 转入 retry 态（外层 attempt prop 变成 'retry'）
  // 计算对/错位置，触发动画 + 重置错位置字母
}, [/* deps */])

useEffect(() => {
  if (attempt === 'retry') {
    // 比对 word 和当前 slot 内容，标记 correct/wrong indices
    const correctSet = new Set<number>()
    const wrongSet = new Set<number>()
    word.split('').forEach((ch, i) => {
      const slot = /* 取 slot[i] 内容 */
      if (slot && slot.toLowerCase() === ch.toLowerCase()) correctSet.add(i)
      else if (slot) wrongSet.add(i)
    })
    setRetryFeedback({ correctIndices: correctSet, wrongIndices: wrongSet })
    // 300ms 后把 wrong slot 清空让字母飞回备选
    const t = setTimeout(() => {
      // 调内部 setter 清空 wrongSet 中的 slots
      onRetryAcknowledged?.()
    }, 700)
    return () => clearTimeout(t)
  } else if (attempt === 'first') {
    setRetryFeedback(null)
  }
}, [attempt, word, onRetryAcknowledged])
```

> ⚠ 上面"取 slot[i] 内容"和"清空 wrong slots"等占位**必须根据 SpellTiles 现有 state 命名补齐**。执行此 task 时先把 line 92-220 范围完整读一遍，搞清字母 slot 当前用什么 state（`filled`/`slots`/`tiles` 等），再把上面的占位代码替换成真实命名。

- [ ] **Step 6: 在 slot UI 上根据 retryFeedback 添加视觉**

```tsx
// 渲染每个字母 slot 时
const isWrong = retryFeedback?.wrongIndices.has(slotIdx)
const isCorrectSlot = retryFeedback?.correctIndices.has(slotIdx)

<div className={cn(
  'base-slot-classes',
  isCorrectSlot && 'border-[#4ade80] bg-[rgba(74,222,128,.18)] text-[#4ade80]',
  isWrong && 'animate-[shakeReturn_.3s_ease] border-[var(--rescue-flash-warn)] text-[var(--rescue-flash-warn)]',
)}>
  {/* slot 内容 */}
</div>
```

在 `src/app/globals.css` 添加：

```css
@keyframes shakeReturn {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
}
```

- [ ] **Step 7: revealedHalf 支持**

当 `revealedHalf` > 0 时，初始化字母 slot 时把前 N 个字母（按 word 顺序）预填入并设为不可拖动。复用 `letterCount`/`maskWord` 的思路。

- [ ] **Step 8: 提示用户跑 lint + 浏览器手动验证**

> ⚠ 用户跑 `pnpm dev`，打开任一英语 quiz 页面，故意拼错单词，确认：错字母飞回备选 / 对字母绿色固定 / 不再显示"✗ 错误，正确答案：word" / 第二次拼对显示"✓ 正确！🎉"。

- [ ] **Step 9: Commit**

```bash
git add src/components/english/words/SpellTiles.tsx src/app/globals.css
git commit -m "refactor: gentle retry + revealedHalf for SpellTiles"
```

---

## Task 14 — WeeklyPlanSession 接入 useRescueQueue + localStorage

**Files:**
- Modify: `src/components/english/words/WeeklyPlanSession.tsx`
- Modify: `src/hooks/useRescueQueue.ts`（加 localStorage）

- [ ] **Step 1: 给 useRescueQueue 加 localStorage 持久化**

修改 `src/hooks/useRescueQueue.ts`：

```ts
import { STORAGE_KEYS } from '@/utils/constant'

interface PersistedState {
  planId: string
  dateKey: string
  items: RescueQueueItem[]
}

export interface UseRescueQueueArgs {
  planId: string
  dateKey: string
}

export function useRescueQueue({ planId, dateKey }: UseRescueQueueArgs): UseRescueQueueApi {
  const [items, setItems] = useState<RescueQueueItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RESCUE_QUEUE)
      if (!raw) return []
      const parsed = JSON.parse(raw) as PersistedState
      if (parsed.planId !== planId || parsed.dateKey !== dateKey) return []
      return parsed.items
    } catch { return [] }
  })

  // debounce 200ms 写
  const writeTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current)
    writeTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEYS.RESCUE_QUEUE,
          JSON.stringify({ planId, dateKey, items } satisfies PersistedState),
        )
      } catch {}
    }, 200)
    return () => {
      if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current)
    }
  }, [items, planId, dateKey])

  // 切换 planId/dateKey 时清
  useEffect(() => {
    setItems([])
  }, [planId, dateKey])

  // clear 同时清 localStorage
  const clear = useCallback(() => {
    setItems([])
    try { localStorage.removeItem(STORAGE_KEYS.RESCUE_QUEUE) } catch {}
  }, [])

  // 其余实现同 Task 5
  // ...
}
```

- [ ] **Step 2: WeeklyPlanSession 引入 hook**

Read `WeeklyPlanSession.tsx` 找到 `quizResultBuffer` / `reinforcementAppended` / `handleAnswer` / `nextQ` 定义处。

在 mount 处（hooks 区）：

```tsx
import { useRescueQueue } from '@/hooks/useRescueQueue'
import { wordKey } from '@/utils/english-helpers'

const rescue = useRescueQueue({
  planId: plan.id,
  dateKey: selectedDate ?? 'none',
})

const [eatenScene, setEatenScene] = useState<{
  word: string
  monsterIdx: number
  isAbbreviated: boolean
} | null>(null)
const eatenShownCountRef = useRef(0)
```

- [ ] **Step 3: 改造 handleAnswer 签名**

```tsx
const handleAnswer = useCallback(
  (info: { finalCorrect: boolean; usedRetry: boolean }) => {
    const q = quizQs[curQ]
    if (!q) return

    const k = wordKey(q.word)

    if (info.finalCorrect) setScore((s) => s + 1)

    // 主轮原题：根据 retry/eaten 入队
    if (!q.rescueRole) {
      if (info.finalCorrect && info.usedRetry) {
        rescue.enqueueHalf(q.word, q.type, k)
      } else if (!info.finalCorrect) {
        const { monsterIdx } = rescue.enqueueEaten(q.word, q.type, k)
        const isAbbreviated = eatenShownCountRef.current > 0
        eatenShownCountRef.current += 1
        setEatenScene({ word: q.word.word, monsterIdx, isAbbreviated })
      }
    } else {
      // 补练题：推进队列状态
      rescue.advance(k, info.finalCorrect ? 'correct' : 'wrong')
    }

    // 写 quizResultBuffer
    quizResultBuffer.current.push({
      entry: q.word,
      correct: info.finalCorrect,
      usedRetry: info.usedRetry,
      eaten: !info.finalCorrect && !q.rescueRole,
      rescued: null,            // 终局在 session 结束时回填
      originalType: q.rescueRole ? q.type : q.type,
    })

    if (info.finalCorrect) {
      const amount = q.type === 'C' || q.type === 'D' ? 2 : 1
      void awardStars('red', amount)
    }
  },
  [quizQs, curQ, awardStars, rescue],
)
```

> ⚠ `quizResultBuffer.current.push` 的类型现在和 spec §6.2 一致，需把 `useRef<{ entry: WordEntry; correct: boolean }[]>` 改成对应 6 字段类型。

- [ ] **Step 4: MonsterEatScene 接入**

在 JSX 树底部添加：

```tsx
<MonsterEatScene
  word={eatenScene?.word ?? null}
  monsterIdx={eatenScene?.monsterIdx ?? 0}
  isAbbreviated={eatenScene?.isAbbreviated ?? false}
  onDismiss={() => {
    setEatenScene(null)
    // 怪兽弹层关闭后才 advance 到下一题
    nextQ()
  }}
/>
```

注意：`useQuizRunner` 在终态自动 advance 仅当 `wasCorrect === true`。错的时候不会自动 advance，因此 `MonsterEatScene` 关闭后由 `onDismiss` 触发 `nextQ()`。这要求 `useQuizRunner` 的"下一题"按钮不在被吃流程显示——由 Task 11 的逻辑已处理（`runner.attempt === 'done' && runner.wasCorrect === false` 才显示"下一题"，但被吃情况下我们想让弹层接管。**新增**：在 QuizQuestionBody 渲染"下一题"按钮的条件改成：

```tsx
{runner.attempt === 'done' && runner.wasCorrect === false && !eatenSceneActive && ( ... )}
```

`eatenSceneActive` 通过新 prop 传入。让 `WeeklyPlanSession` 把 `eatenScene !== null` 作为 prop 传给 `QuizQuestionBody`。

- [ ] **Step 5: 渲染 RescueListBadge**

在 quiz phase 的 JSX 顶部、`question-box` 之前插入：

```tsx
<RescueListBadge items={[...rescue.retryList, ...rescue.eatenList]} />
```

- [ ] **Step 6: 提示用户跑 lint + 浏览器手动验证**

> ⚠ 用户跑 `pnpm dev`，做一次完整 quiz session：故意答错第一题 + retry 救回（半对，蓝标）、第二题错两次（被吃，怪兽弹层 + 橙标）、第三题直接对。确认清单条和怪兽弹层均按设计工作。

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useRescueQueue.ts src/components/english/words/WeeklyPlanSession.tsx src/components/english/words/QuizQuestionBody.tsx
git commit -m "feat: wire useRescueQueue + MonsterEatScene into session"
```

---

## Task 15 — 补练队列拼装（主轮中段 + 末尾）

**Files:**
- Modify: `src/components/english/words/WeeklyPlanSession.tsx`

- [ ] **Step 1: 设计触发时机**

阅读 line 340-423 `nextQ` 函数。当前逻辑只在主轮末尾根据 `helpClicks` 追加 reinforcement。新逻辑：

```
nextQ() 调用时：
  next = curQ + 1
  if (next < quizQs.length): setCurQ(next); return

  // 主轮已结束。先追加 eatenBatch（被吃阶梯）
  if (!reinforcementPhase) {
    const { halfBatch, eatenBatch } = rescue.buildBatches(Date.now())
    const extras: QuizQuestion[] = []

    // 还要保留旧的 helpClicks 补练（不破坏现有行为）
    const helpExtras = buildReinforcementQuestions(
      helpClicks, vocab, wordKey, Date.now() + 1,
    )

    extras.push(...halfBatch, ...eatenBatch, ...helpExtras)

    if (extras.length > 0) {
      const mainScore = quizResultBuffer.current.filter((r) => r.correct).length
      setMainPassSnapshot({ score: mainScore, total: quizQs.length })
      const kindByKey = /* 现有 line 358-360 逻辑 */
      const newKeys = extras.map((q) => ({
        key: wordKey(q.word),
        type: q.type,
        kind: kindByKey.get(wordKey(q.word)) ?? 'consolidate',
        revealedHalf: q.revealedHalf,
        rescueRole: q.rescueRole,
      }))
      setQuizQKeys((prev) => [...prev, ...newKeys])
      setReinforcementPhase(
        halfBatch.length && eatenBatch.length ? 'both'
          : halfBatch.length ? 'half-only'
          : eatenBatch.length ? 'eaten-only'
          : false,
      )
      setCurQ(next)
      return
    }
  }

  // 真的结束 → 写 mastery
  // ...（保持现有 line 372-422 逻辑，但 recordBatch 改用扩展后的 buffer）
```

- [ ] **Step 2: quizQKeys 数据结构需扩展**

当前 `quizQKeys` 是 `{ key; type; kind }`，扩展为带 `revealedHalf` 和 `rescueRole`。`quizQs` 派生时也透传这些字段。

- [ ] **Step 3: 半对穿插（主轮中段）**

> 简化决策：本期**不做"主轮中段穿插"**，所有补练（半对+被吃）都追加到主轮末尾。理由：
> - 主轮中段穿插需要"修改正在进行的题目序列"，复杂度高
> - 主轮末尾追加已经能达到"本轮内复习一次"的目标
> - 实现风险可控，先上线观察效果

spec §3 的"半对中段穿插" 仍是设计意图，但实现上**统一改到主轮末尾**。如果用户希望严格按 spec，重开一个 task。

- [ ] **Step 4: FlashRecallCard 渲染分支**

在 QuizQuestionBody 的渲染选择处（在 quiz phase 渲染前），如果当前 `quizQs[curQ].rescueRole === 'flashcard'`，跳过 QuizQuestionBody，渲染 `<FlashRecallCard>`：

```tsx
{curQ < quizQs.length && quizQs[curQ].rescueRole === 'flashcard' ? (
  <FlashRecallCard
    word={quizQs[curQ].word}
    step={0}
    totalSteps={3}
    onDone={() => {
      // 推进队列状态 + 进下一题
      rescue.advance(wordKey(quizQs[curQ].word), 'correct')
      nextQ()
    }}
  />
) : (
  <QuizQuestionBody {...standardProps} />
)}
```

- [ ] **Step 5: 提示用户跑 lint + 浏览器手动验证**

> ⚠ 用户跑 `pnpm dev`，制造"主轮答错两次→怪兽吃→进入补练阶梯"完整链路，确认：
> 1. 闪现卡 1.5s 自动过
> 2. A 类补练对了 → 进下一梯
> 3. 原题型补练对了 → 拯救清单条变绿
> 4. 中途错 → 跳过剩余阶梯，清单条变灰

- [ ] **Step 6: Commit**

```bash
git add src/components/english/words/WeeklyPlanSession.tsx
git commit -m "feat: append rescue ladder batch at end of main round"
```

---

## Task 16 — 完成页 RescueCompletionView 接入 + 写 mastery

**Files:**
- Modify: `src/components/english/words/WeeklyPlanSession.tsx`

- [ ] **Step 1: 接入 RescueCompletionView**

定位 `phase === 'done'` 的渲染分支（搜 `phase === 'done'` 或 line 1021 附近）。在原有完成统计 JSX 后追加：

```tsx
<RescueCompletionView eatenList={rescue.eatenList} />
```

- [ ] **Step 2: 调整 recordBatch 写法**

在 `nextQ` 函数中"真的结束"那段（现 line 412 `recordBatch(quizResultBuffer.current)`），改用 spec §8 表格：

```tsx
// 把扩展后的 buffer 转成 useWordMastery.recordBatch 期望的 { entry, correct }[]
// 每个词可能产生多条 record（spec §8）
const batch: { entry: WordEntry; correct: boolean }[] = []
for (const r of quizResultBuffer.current) {
  const k = wordKey(r.entry)
  const queueItem = [...rescue.retryList, ...rescue.eatenList].find((i) => i.wordKey === k)

  if (queueItem) {
    if (queueItem.stage === 'consolidated' || queueItem.stage === 'saved') {
      batch.push({ entry: r.entry, correct: true })
      batch.push({ entry: r.entry, correct: false })
    } else if (queueItem.stage === 'still_half') {
      batch.push({ entry: r.entry, correct: false })
    } else if (queueItem.stage === 'lost') {
      batch.push({ entry: r.entry, correct: false })
      batch.push({ entry: r.entry, correct: false })
    }
  } else if (!r.rescueRole) {
    // 没进过队列的主轮原题，按 finalCorrect 写一次
    batch.push({ entry: r.entry, correct: r.correct })
  }
  // rescueRole 类（补练题、闪现卡）不单独写 mastery，已合并入对应词的 batch
}

recordBatch(batch)
```

- [ ] **Step 3: phase=done 离开时清队列**

在"再来一次"按钮或返回首页等离开 done phase 的入口添加 `rescue.clear()`：

```tsx
<button onClick={() => { rescue.clear(); /* 现有逻辑 */ }} ...>
```

- [ ] **Step 4: 提示用户跑 lint + 浏览器手动验证**

> ⚠ 用户完整跑一次 session 到完成页，确认：
> 1. 拯救成果区块显示 X 个救回、Y 个未救
> 2. 单词 chip 颜色正确（💚 / 🧡）
> 3. 离开完成页后 localStorage 中 `rescue_queue_v1` 已清除
> 4. mastery 写入符合 spec §8

- [ ] **Step 5: Commit**

```bash
git add src/components/english/words/WeeklyPlanSession.tsx
git commit -m "feat: wire RescueCompletionView + mastery write rules"
```

---

## Task 17 — RecallQuizStack 轻量 retry

**Files:**
- Modify: `src/components/english/reading/RecallQuizStack.tsx`

- [ ] **Step 1: frontend-design 检阅**

**Invoke skill** `frontend-design`：line 108 现在显示 `✗ 答对了 / ✗ 再看看`。让其设计"阅读 quiz 的轻 retry：首次错只显示『🔮 这个不对，看看别的？』+ 选项淡出；第二次错才小卡片显示正确答案，不要怪兽不要清单条"。

- [ ] **Step 2: 改造 onSelect 逻辑**

Read line 60-110 找 `setResults` / `onAnswer` 区域。把现有"一次性判错"逻辑改成 attempt 状态：

```tsx
const [attempts, setAttempts] = useState<Record<string, 'first' | 'retry' | 'done'>>({})
const [wrongPicks, setWrongPicks] = useState<Record<string, Set<string>>>({})

const handlePick = (k: string, target: Target, option: Option) => {
  const isCorrect = option.word === target.word
  const cur = attempts[k] ?? 'first'

  if (isCorrect) {
    setResults((prev) => ({ ...prev, [k]: { selected: option, correct: true } }))
    setAttempts((prev) => ({ ...prev, [k]: 'done' }))
    onAnswer(target, true)
    return
  }
  if (cur === 'first') {
    setAttempts((prev) => ({ ...prev, [k]: 'retry' }))
    setWrongPicks((prev) => ({
      ...prev,
      [k]: new Set([...(prev[k] ?? []), option.word]),
    }))
    return
  }
  // 第二次还错
  setResults((prev) => ({ ...prev, [k]: { selected: option, correct: false } }))
  setAttempts((prev) => ({ ...prev, [k]: 'done' }))
  onAnswer(target, false)
}
```

- [ ] **Step 3: 改 line 108 反馈区**

替换 `{result.correct ? '✓ 答对了' : '✗ 再看看'}`：

```tsx
{result?.correct && <span className="text-green-500 font-bold">✓ 答对了</span>}
{attempts[k] === 'retry' && (
  <span className="text-[var(--rescue-half)] font-bold">{READING_RETRY_MESSAGE}</span>
)}
{result && !result.correct && (
  <span className="text-amber-500 font-bold">
    {READING_SECOND_WRONG_PREFIX}<b>{target.word}</b>{READING_SECOND_WRONG_SUFFIX}
  </span>
)}
```

加 import：

```tsx
import {
  READING_RETRY_MESSAGE,
  READING_SECOND_WRONG_PREFIX,
  READING_SECOND_WRONG_SUFFIX,
} from '@/utils/constant'
```

- [ ] **Step 4: 选项渲染加 wrongPicks 灰禁**

定位 options 渲染 map；为 `wrongPicks[k]?.has(option.word)` 的选项加 `opacity-40 + disabled`，与 QuizQuestionBody 风格一致（但不引入怪兽）。

- [ ] **Step 5: 提示用户跑 lint + 浏览器手动验证**

> ⚠ 用户跑 dev，进入阅读模块的 recall quiz，故意错一次确认显示"🔮 这个不对，看看别的？"，再错一次显示"🌟 这个是 X！记一下~"，全程无 ❌ 无红色。

- [ ] **Step 6: Commit**

```bash
git add src/components/english/reading/RecallQuizStack.tsx
git commit -m "refactor: gentle retry for RecallQuizStack"
```

---

## Task 18 — ParagraphRecallQuiz 轻量 retry

**Files:**
- Modify: `src/components/english/reading/ParagraphRecallQuiz.tsx`

- [ ] **Step 1: 重复 Task 17 的模式**

Read `src/components/english/reading/ParagraphRecallQuiz.tsx` 全文。

按相同方式：
1. 加 `attempts`/`wrongPicks` state
2. 改 `setCorrect` / `onAnswer` 调用路径，第一次错只 setAttempt 不上报
3. 第二次错时 setCorrect(false) + onAnswer(target, false) + 显示小卡片
4. 选项渲染加灰禁

> 由于 ParagraphRecallQuiz 单题模式（不像 RecallQuizStack 多题 stack），state shape 更简单：

```tsx
const [attempt, setAttempt] = useState<'first' | 'retry' | 'done'>('first')
const [wrongPicks, setWrongPicks] = useState<Set<string>>(new Set())

useEffect(() => {
  // 题目切换时重置
  setAttempt('first')
  setWrongPicks(new Set())
}, [target.entry.word])

const handlePick = (option: Option) => {
  if (attempt === 'done') return
  const isCorrect = option.word === target.entry.word
  if (isCorrect) {
    setCorrect(true)
    setAttempt('done')
    onAnswer(target.entry, true)
    return
  }
  if (attempt === 'first') {
    setAttempt('retry')
    setWrongPicks((s) => new Set(s).add(option.word))
    return
  }
  setCorrect(false)
  setAttempt('done')
  setWrongPicks((s) => new Set(s).add(option.word))
  onAnswer(target.entry, false)
}
```

- [ ] **Step 2: 调整 line 119 附近的"wrong"卡片**

Read line 130-180 区域；当前 `// - wrong: two-row card. Top = word + IPA + 🔊, bottom = English meaning` 是显示卡。这个卡片改为：仅当 `attempt === 'done' && correct === false` 时显示。加 `attempt === 'retry'` 显示一行轻文案：

```tsx
{attempt === 'retry' && (
  <div className="text-[var(--rescue-half)] font-bold text-sm">
    {READING_RETRY_MESSAGE}
  </div>
)}
```

- [ ] **Step 3: 提示用户跑 lint + 浏览器手动验证**

> ⚠ 同 Task 17 验证。

- [ ] **Step 4: Commit**

```bash
git add src/components/english/reading/ParagraphRecallQuiz.tsx
git commit -m "refactor: gentle retry for ParagraphRecallQuiz"
```

---

## Task 19 — 手动验证清单（最终）

**Files:** 无；纯验证

- [ ] **Step 1: 提示用户做端到端验证**

请用户执行以下场景，**全部通过才算完成**：

1. **基本三阶段**
   - 主轮答错→retry 文案弹出（蓝）→ retry 答对 → 蓝标加入清单
   - retry 也错 → 怪兽弹层完整 2.4s 播放 → 关闭 → 橙标加入清单
   - 同 session 第二次被吃 → 怪兽弹层缩到 1.2s
2. **阶梯补练**
   - 主轮结束 → 闪现卡 1.5s（带语音）→ A 类补考 → 原题型补考
   - 全对 → 清单条变绿 💚 + 完成页"拯救成果"显示救回
   - 中途错 → 跳过剩余阶梯，清单灰 🌙，完成页显示未救
3. **SpellTiles retry**
   - 故意拼错 → 错字母飞回备选 + 对字母绿色固定 + 黄色文案"差几个字母~"
   - 第二次拼对 → 半对（蓝标）
4. **阅读模块**
   - RecallQuizStack 错一次→"🔮 这个不对"，错两次→"🌟 这个是 X"
   - ParagraphRecallQuiz 同上
   - 阅读模块**无**怪兽、**无**清单条
5. **localStorage**
   - 主轮中段刷新页面 → 清单条恢复显示
   - 完成页"返回"后 localStorage 中 `rescue_queue_v1` 已清空
   - 切换 selectedDate → 队列清空
6. **去红化**
   - 整个 session 无 ❌、无 ✗、无红色边框、无刺耳错误音
   - mastery 写入与 spec §8 表格一致（看 supabase `word_mastery` 表）
7. **prefers-reduced-motion**
   - 系统设置开启"减少动效" → 怪兽弹层缩到 0.6s 简化版

- [ ] **Step 2: 用户反馈**

如有问题逐条修复；无问题则进入 finishing-a-development-branch skill 决定合并/PR/cleanup。

---

## 后续：不在本期范围

参见 spec §14：
- 数学模块去红化
- calc 模块
- 打怪兽独立小游戏
- 跨设备同步拯救队列
- 怪兽角色拓展

---

## 自检小结

**Spec 覆盖**：

| Spec 章节 | 实现 Task |
|---|---|
| §1 目标 | (整体目标) |
| §2 三阶段机制 | T11, T12, T13, T14 |
| §3 补练题型规则 | T5, T6 |
| §4 题目状态机 | T11 |
| §5 词状态机 | T5 |
| §6 数据结构 | T1 |
| §7 补练队列拼装 | T6, T15 |
| §8 mastery 写入 | T16 |
| §9 视觉与动效 | T3, T7, T8, T9, T10, T12, T13 |
| §10 文案池 | T2 |
| §11 localStorage | T14 |
| §12 阅读模块 | T17, T18 |
| §13 触点矩阵 | 全部 task 覆盖 |
| §14 不在本期 | (说明) |
| §15 待审决策点 | 已在 spec 中标注 |

**已知简化**：
- Task 15 §3 显式跳过"主轮中段穿插"，改为全部追加到主轮末尾。spec §3 节奏图不完全等价，但实现风险更低。如严格按 spec 需重开一个 task。

**类型签名一致性**：
- `QuizQuestion` 单一源在 `src/utils/type.ts`（T1）
- `useQuizRunner.onCommit` 签名变化在 T11，调用方在 T14 同步
- `useRescueQueue` 在 T5 in-memory、T14 加 localStorage

**已知风险**：
- Task 13 SpellTiles 修改最重，依赖现有 `tiles` state 命名，执行时需先 Read 全文再替换占位。
- Task 14 `quizResultBuffer` 类型扩展可能波及 `WeeklyPlanSession.tsx` 内若干派生计算（如 `starsFromThisRun`），执行时需逐处核对。
