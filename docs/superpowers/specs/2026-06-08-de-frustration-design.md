# 英语单词练习"去挫败感"交互设计

> 受众：7 岁儿童 · 模块：英语单词练习 (WeeklyPlanSession) + 阅读模块 (Recall 系列)
> 设计来源：`docs/plan/error.md` 三套方案 + `docs/demo/word_quiz_monster_eat.html` 怪兽吃单词 demo
> 不在此次范围内：数学模块、calc 模块

---

## 1. 目标与原则

7 岁孩子在单词练习里看到 ❌、红框、"回答错误"、刺耳错误音会触发崩溃。本设计去惩罚化、游戏化包装所有"答错"反馈。

**核心原则**

- 永不直接喊"错"。任何首次答错都进入温和 retry 通道，给孩子第二次机会。
- 第二次仍错才升级为"怪兽吃单词"演出（demo 风），把负面信号转化为后续可拯救的游戏任务。
- 任何"错过"的词（含半对）都在本轮内追加补练，错哪补哪，难度受控。
- 视觉/听觉去红化：禁用 ❌ ✗ × 红色边框 刺耳警报音；改用温和淡出、💡 🔮 ✨ 暖色高亮、软"咕噜"音。

**作用域**

- 改：`WeeklyPlanSession`、`QuizQuestionBody`、`SpellTiles`、`useQuizRunner`、`english-helpers.ts` 的 `buildReinforcementQuestions`
- 改：`RecallQuizStack`、`ParagraphRecallQuiz`（仅做 retry + 轻文案，不引入怪兽/拯救清单）
- 新增：`MonsterEatScene`、`RescueListBadge`、`FlashRecallCard`、`RescueCompletionView`、`useRescueQueue`
- 不动：数学模块、calc 模块、`useWordMastery`/`useWordData` 等数据层、数据库 schema

---

## 2. 整体机制：三阶段保护壳

每道单词题在用户答错时按下表分流。

| 答题路径 | 进清单 | 怪兽演出 | 本轮补练 | session 结算 mastery |
|---|---|---|---|---|
| 直接答对 | ✗ | ✗ | ✗ | `correct` ×1（可升级） |
| 错 → retry → 对（**半对**） | 蓝标"待巩固" | ✗ | 同题型 ×1，主轮中段穿插 | `correct` ×1 + `incorrect` ×1（持平） |
| 错 → retry → 错（**被吃**） | 橙标"待拯救" | ✓ MonsterEatScene | 闪现卡 → A 类 → 原题型，主轮末尾顺序 | 拯救成功=持平；未拯救=`incorrect` ×2（降级） |

**节奏举例（10 题主轮）**

```
Q1 ✓     Q2 ✓     Q3 错→retry✓(半对·blue) Q4 ✓
Q5 错→retry❌(eaten·orange) → 怪兽弹层 → 闪现卡
Q6 ✓     Q7 ✓
Q8 [A 类补练 Q3 半对词]   ← 间隔 ≥3
Q9 ✓
Q10 ✓
─── 主轮结束 ───
[A 类补练 Q5 被吃词] → [C 类补练 Q5 被吃词]   ← 阶梯 step2/3
─── 完成页（"拯救成果"区块） ───
```

---

## 3. 补练题型规则：错哪补哪 + 阶梯

| 主轮原题型 | 半对补练（轻） | 被吃补练（阶梯） |
|---|---|---|
| A 释义选词 | A（新干扰项）×1 | 闪现卡 → A → A（同题不同干扰） |
| B IPA 选词 | B（新干扰项）×1 | 闪现卡 → A → B |
| C 拼写 | C（半字母露出）×1 | 闪现卡 → A → C |
| D 课文情境 | D（同题面新干扰）×1 | 闪现卡 → A → D |

- 半对补练 = 同题型重出，干扰项重摇 / 字母露出，避免"只记选项位置"。
- 被吃补练 = 「闪现卡（识别）→ A 类（识别桥）→ 原题型（生产/还原）」三步阶梯。第一步永远闪现卡，第二步永远 A 类做识别打底，第三步回到孩子栽倒的原题型证明真的会了。
- 原题型本身是 A 时，被吃阶梯第三步用 A 但句式/干扰项与第一次完全不同。
- 拯救阶段错了 **不再二次惩罚**：剩余阶梯跳过、不重播怪兽演出、不再追、仅清单条标灰。

---

## 4. 题目级状态机（QuizQuestionBody / SpellTiles 共享）

```
                  ┌──────────────┐
                  │   IDLE        │ 显示题目+选项
                  └──────┬───────┘
                         │ onSelect / onCommit
                         ▼
                  ┌──────────────┐
              ┌──→│  EVALUATING   │ 判断对错
              │   └──────┬───────┘
              │          │
              │   ┌──────┴───────┐
              │   ▼              ▼
              │ CORRECT_FIRST  WRONG_FIRST
              │   │              │ (错选项淡出+置灰；retry 文案)
              │   ▼              ▼
              │   done       ┌────────────┐
              │              │   RETRY     │ 等用户第二次选
              │              └─────┬──────┘
              │                    │ onSelect
              │                    ▼
              │              ┌────────────┐
              │              │  EVALUATING2 │
              │              └─────┬──────┘
              │                    │
              │         ┌──────────┴─────────┐
              │         ▼                    ▼
              └─ CORRECT_AFTER_RETRY     EATEN
                 ("半对·blue")            ("被吃·orange" → MonsterEatScene)
```

- `attempt` 状态：`'first' | 'retry' | 'done'`，每题最多触发一次 retry。
- 拼写题 retry 时机：用户按"提交"判错时；放对的字母绿色高亮固定不再可拖动，放错的字母 0.3s 软抖 + 黄 `#FBBF24` 闪 → 飞回备选区，用户继续拖剩余字母。
- 选择题 retry 时机：用户点错选项时；错选项 220ms 淡出至 `opacity-40` + 灰边 + 置灰禁用，与"差一点点就对啦~"文案并行显示，用户继续点剩余选项。
- 提交：题目"完成"时调 `onCommit({ wordKey, type, finalCorrect, usedRetry })` 上报给 session。

---

## 5. 词级状态机（useRescueQueue 内部）

```
fresh ──answer correct──→ done
fresh ──first wrong──→ retrying
retrying ──retry correct──→ half_correct
           half_correct ──reinforce A1 correct──→ consolidated
                        ──reinforce A1 wrong──→ still_half
retrying ──retry wrong──→ eaten
           eaten ──flashcard──→ rescue_step1
           rescue_step1 ──A reinforce correct──→ rescue_step2
                        ──A reinforce wrong──→ lost
           rescue_step2 ──original-type reinforce correct──→ saved
                        ──original-type reinforce wrong──→ lost
```

终态：`done` / `consolidated` / `still_half` / `saved` / `lost`，全部用于 session 结算 mastery。

---

## 6. 数据结构

### 6.1 QuizQuestion 扩展

`src/utils/type.ts`：

```ts
export type RescueSeverity = 'half' | 'eaten'

export type QuizQuestion = {
  word: WordEntry
  type: 'A' | 'B' | 'C' | 'D'
  revealedHalf?: number          // 仅 C 类补练时使用：露出多少字母
  rescueRole?: 'flashcard' | 'reinforce-step1' | 'reinforce-step2' | 'reinforce-half'
}

export interface RescueQueueItem {
  wordKey: string
  entry: WordEntry
  severity: RescueSeverity
  originalType: 'A' | 'B' | 'C' | 'D'
  stage: 'pending' | 'flashcard_done' | 'reinforce1_done' | 'consolidated' | 'still_half' | 'saved' | 'lost'
  monsterIdx?: number            // 0-3，被吃时固定，吐词动画沿用
}
```

### 6.2 quizResultBuffer 扩展

`WeeklyPlanSession.tsx` 当前为 `{ entry, correct }[]`，扩展为：

```ts
{
  entry: WordEntry
  correct: boolean               // 最终是否对（含 retry/补练后的结论）
  usedRetry: boolean
  eaten: boolean
  rescued: boolean | null        // 被吃后是否救回；null=未被吃
  originalType: 'A' | 'B' | 'C' | 'D'
}[]
```

### 6.3 useRescueQueue 接口

新文件 `src/hooks/useRescueQueue.ts`：

```ts
interface UseRescueQueue {
  retryList: RescueQueueItem[]      // severity='half'
  eatenList: RescueQueueItem[]      // severity='eaten'
  enqueueHalf(entry: WordEntry, type: 'A'|'B'|'C'|'D'): void
  enqueueEaten(entry: WordEntry, type: 'A'|'B'|'C'|'D'): { monsterIdx: number }
  advance(wordKey: string, outcome: 'correct' | 'wrong'): void
  isInQueue(wordKey: string): boolean
  buildReinforcementQuestions(seed: number): QuizQuestion[]
  clear(): void
}
```

`enqueueEaten` 同步把 `monsterIdx`（0-3 随机）返回给 `MonsterEatScene`，并保存到 `RescueQueueItem.monsterIdx`，确保吐词反播时仍是同一只怪兽。

---

## 7. 补练队列拼装

主轮 `quizQs` 不变。补练通过两个时机注入：

1. **主轮中段穿插**：半对词产生后，使用 `interleaveOrderedQuizSlots`（与现有 reinforcement 相同的工具）以 `minGap=3` 在主轮剩余题里穿插**同题型**补练（标 `rescueRole='reinforce-half'`）。
2. **主轮末尾追加**：被吃词按"加入顺序"依次走 3 步阶梯：`flashcard → A 类 → 原题型`（标 `rescueRole`）。中途 wrong → 跳过剩余阶梯，标 `lost`。

`reinforcementAppended` 状态从 `boolean` 扩成：

```ts
type ReinforcementPhase = false | 'half-only' | 'eaten-only' | 'both'
```

`buildReinforcementQuestions(helpClicks, ...)` 当前只针对 helpClicks + Type C。改造为：

```ts
buildReinforcementQuestions(args: {
  helpClicks: Record<string, number>
  rescueItems: RescueQueueItem[]
  vocab: WordEntry[]
  keyOf: (w: WordEntry) => string
  seed: number
}): { halfBatch: QuizQuestion[]; eatenBatch: QuizQuestion[] }
```

- `halfBatch`：穿插用，按 `rescueRole='reinforce-half'`
- `eatenBatch`：末尾追加用，每被吃词产生 3 题（flashcard + A + originalType）

---

## 8. Session 结算（写 mastery）

| 词最终状态 | recordBatch 写法 | mastery 净效果 |
|---|---|---|
| 直接对 | `{ correct: true }` ×1 | 可升级 |
| 半对 → consolidated | `{ correct: true }` ×1 + `{ correct: false }` ×1 | 持平 |
| 半对 → still_half | `{ correct: false }` ×1 | 略降 |
| 被吃 → saved | `{ correct: true }` ×1 + `{ correct: false }` ×1 | 持平 |
| 被吃 → lost | `{ correct: false }` ×2 | 较强降级 |

`recordBatch` 接口不变。`useWordMastery.ts` 不动。

---

## 9. 视觉与动效

### 9.1 配色（去红化）

| 状态 | token | 值 |
|---|---|---|
| 错误选项淡出 | （沿用 surface + opacity）  | `bg-white/[.04]` + `opacity-40` + 灰边 `border-white/10` |
| 拼写错字母回弹闪烁 | `--rescue-flash-warn` | `#FBBF24` |
| 半对小标 | `--rescue-half` | `#60A5FA` |
| 被吃小标 | `--rescue-eaten` | `#FB923C` |
| 已拯救/已巩固 | `--rescue-saved` | `#34D399` |
| 怪兽弹层底色 | `--monster-veil` | `rgba(20,12,50,.78)` + backdrop-blur(8px) |

加入 `src/app/globals.css` 的 `:root`，遵循 Tailwind v4 CSS-variable 体系。

### 9.2 动效预算（防堆积）

| 场景 | 时长 | 可跳过 |
|---|---|---|
| 选错→选项淡出 + retry 文案弹出（并行） | 220ms + 200ms | ✗ |
| 拼写错→字母抖 + 飞回备选 | 0.3s + 0.4s | ✗ |
| 怪兽弹层首次完整播 | 2.4s | ✓ 点按钮立即跳过 |
| 怪兽弹层同 session 第二次起 | 1.2s 缩减版 | ✓ |
| 闪现卡 | 1.5s（点屏 → 提早 0.5s 进） | ✓ |
| 拯救成功（怪兽吐词反播） | 1.6s | ✓ |
| 拯救清单条状态变化（蓝→绿渐变） | 250ms | ✗ |

全局规则：任意时刻最多 1 个怪兽弹层；多次被吃事件入播放队列依次播。`@media (prefers-reduced-motion: reduce)` 下怪兽弹层全部压到 0.6s 简化版（仅卡片 + 文案，无飞字）。

### 9.3 关键布局

**怪兽弹层**

```
┌─────────────────────────────────┐
│   半透明深紫遮罩 (blur 8px)         │
│   ┌─────────────────────────┐   │
│   │  [拯救清单条 X/Y]          │   │
│   ├─────────────────────────┤   │
│   │   [飞字 word]              │   │
│   │       ↓                   │   │
│   │   [怪兽 220x220]            │   │
│   ├─────────────────────────┤   │
│   │ 😱 [word] 被 [name] 吃啦！   │   │
│   │ 加入拯救清单，等会儿救它！🧡    │   │
│   ├─────────────────────────┤   │
│   │  [⚔️ 知道啦，继续闯关！]      │   │
│   └─────────────────────────┘   │
└─────────────────────────────────┘
```

**拯救清单条**（题面顶端）：空时整条隐藏。chip 横向滚动，超过 5 个显示 `… +N`。状态变化时 chip 颜色 250ms 过渡 + 一次轻 bounce。

**闪现卡**：60px 大字 word + IPA + 中文释义 + 🔊 自动播报 + 进度点 `● ○ ○`。1.5s 自动进下一题。

**完成页"拯救成果"区块**：接在原完成统计下方，仅当本 session 有被吃词时显示。形如：

```
⚔️ 拯救成果
救回 3 个，还有 1 个等你下次来！

💚 star    💚 dog    💚 apple
🧡 moon  ← 灰色，旁注"明天再战"
```

### 9.4 音效

复用 calc 模块 `playSfx` 模式，扩展事件名：

- `monster-eat`：软"咕噜"音，<300ms
- `rescue-saved`：上升小铃铛
- retry 提示：**无声**

全部受 `settings.soundEnabled` 控制。

---

## 10. 文案池（每场景 3 条变体随机）

### 10.1 选择题 retry

> 💡 差一点点就对啦，再看看？
> 🔮 这个宝箱没打开，再点一个试试！
> ✨ 嗯——再瞅一眼，你已经很接近啦！

### 10.2 拼写题 retry

> 💡 差几个字母~ 红色的字母飞回去了，再拖一次！
> 🌟 绿色的对啦！再调整一下其他几个？
> 🧩 拼图差一点点就完整啦，再试一次！

### 10.3 被吃（怪兽弹层主文案）

> 😱 **[word]** 被遗忘小怪兽 **[name]** 吃掉啦！
> 🙀 哎呀！**[word]** 跑到 **[name]** 肚子里啦！
> 😵 噢呜~ **[name]** 把 **[word]** 偷走啦！

副文案：

> 加入拯救清单，等会儿一起救它回来！🧡
> 别担心，我们会在闯关结束前救回它的！⚔️
> 记住它的样子，等会儿要靠你拯救！🦸

按钮：`⚔️ 知道啦，继续闯关！`

### 10.4 闪现卡标题

> 🌟 看一眼，记一记，[word] 长这样 ↓

### 10.5 拯救成功

> 🎉 太棒了！你把 **[word]** 从 **[name]** 嘴里救回来了！
> ✨ **[word]** 自由啦！**[name]** 灰溜溜地走了~
> 💪 拯救成功！**[word]** 回到了你的词汇宝箱里！

### 10.6 拯救失败（不弹怪兽，仅清单标灰 + 小卡片）

> 🌙 这次没救回来也没关系，小怪兽答应等你晚点再来挑战~
> 🌟 别气馁，明天再来打它一顿！
> 💤 [name] 今天比较强，明天再练练就能打过它！

### 10.7 完成页"拯救成果"

- 全救回：`🏆 太强啦！这一关被吃掉的单词全部救回来！`
- 部分救回：`⚔️ 救回 X 个单词！还有 Y 个等你下次去打怪兽~`
- 全没救回：`🌟 这关怪兽有点厉害，没关系，下次还有机会！`

### 10.8 阅读模块（RecallQuizStack / ParagraphRecallQuiz）

- 第一次错：`🔮 这个不对，看看别的？`
- 第二次错（小卡片，无怪兽）：`🌟 这个是 **[word]**！记一下~`

### 10.9 全局禁用词

| 禁用 | 替代 |
|---|---|
| 错误 / 错了 / 答错了 | 差一点点 / 没打开 / 跑掉了 |
| 正确答案是 | 这个是 / 长这样 |
| 失败 | 没救回来 / 下次再来 |
| ❌ ✗ ✘ × | 💡 ✨ 🔮 🌟 |
| 红色边框 / 红色高亮 | 温和淡出 / 灰色 / 蓝色"待巩固"小标 |
| 警报音 / 短促"咚"声 | 软"咕噜"音 / 无声 |

---

## 11. localStorage 持久化

### 11.1 Key 与结构

`src/utils/constant.ts` 新增：

```ts
STORAGE_KEYS.RESCUE_QUEUE = 'rescue_queue_v1'
```

数据结构：

```ts
{
  planId: string
  dateKey: string             // selectedDate 的 ISO
  items: RescueQueueItem[]
  reinforcementPhase: ReinforcementPhase
}
```

### 11.2 写入时机

`enqueueHalf` / `enqueueEaten` / `advance` 后 debounce 200ms 写入。

### 11.3 读取时机

`WeeklyPlanSession` mount 时；若 `planId` 或 `dateKey` 与当前不匹配 → 视为脏数据，直接清空。

### 11.4 清除时机

- session 进入 `phase = 'done'` 并展示完成页 → 用户离开完成页时 `clear()`
- 用户切换 `selectedDate` 时 `clear()`
- 跨周（`plan.id` 变化）时 `clear()`

### 11.5 Session 中断恢复

刷新 / 关页 / 切回：从 localStorage 恢复 `retryList` + `eatenList` 与 `reinforcementPhase`；**已播过的怪兽弹层不重播**（仅展示清单条 + 接着补练队列继续）。

### 11.6 与 CLAUDE.md 的关系

CLAUDE.md 写过"localStorage 仅用于 UI 偏好，不存用户数据"，目前唯一 key 是 `MATH_SIDEBAR_COLLAPSED`。`rescue_queue_v1` 是第二个例外。

**例外理由**：纯 session 中间态，完成即清，不属"用户掌握度/配置"等持久数据。若审阅时希望避免破例，可改为：

- 备选 A：`useRef`/`useState` in-memory，刷新即丢（最简，但孩子误关页面后状态丢失）
- 备选 B：新增 Supabase 表 `rescue_queue` 跨设备同步（最完整，但本期不动 schema 的约束被破坏）

推荐方案：localStorage 例外。审阅时若否决，回落到备选 A。

---

## 12. 阅读模块改造（轻量）

`RecallQuizStack.tsx` 与 `ParagraphRecallQuiz.tsx`：

- 当前 `✗ 再看看` 文案行直接删除，改为：组件内 `attempt: 'first' | 'retry' | 'done'` 状态，首次错只把错卡淡出 + 弹"🔮 这个不对，看看别的？"；
- 第二次仍错才把正确卡用小卡片秒出（无怪兽、无清单、无 localStorage）；
- `mastery` 写入仍走 `recordRecallAttempt`，逻辑不变；
- 不依赖 `useRescueQueue`。

阅读场景重在读懂上下文，不应被怪兽弹层打断节奏。一致性差但对模块边界更尊重。

---

## 13. 触点矩阵

### 13.1 必改

| 文件 | 改造要点 |
|---|---|
| `src/components/english/words/WeeklyPlanSession.tsx` | 引入 `useRescueQueue`；`handleAnswer` 改路径；扩展 `quizResultBuffer` 字段；扩展 `reinforcementAppended` 为 phase；完成页接入 `RescueCompletionView` |
| `src/components/english/words/QuizQuestionBody.tsx` | 引入 attempt 状态机；首次错触发 retry 而非直接 commit；commit 时回传 `{ usedRetry, finalCorrect }` |
| `src/components/english/words/SpellTiles.tsx` | 删除 line 320 的 `✗ 错误，正确答案：word`；放对字母绿高亮固定 + 放错字母飞回备选；新增 `revealedHalf` prop 用于半字母露出补练 |
| `src/components/english/words/useQuizRunner.ts`（或同等文件） | 配合 attempt 状态机调整 `answered`/`spellOk` |
| `src/utils/english-helpers.ts` | `buildReinforcementQuestions` 新签名，接收 `rescueItems`，输出 `halfBatch` + `eatenBatch` |
| `src/utils/type.ts` | 扩展 `QuizQuestion`；新增 `RescueQueueItem`、`RescueSeverity`、`ReinforcementPhase` |
| `src/utils/constant.ts` | 新增 `STORAGE_KEYS.RESCUE_QUEUE` |
| `src/app/globals.css` | 新增 4 个 token：`--rescue-half`、`--rescue-eaten`、`--rescue-saved`、`--monster-veil` |
| `src/components/english/reading/RecallQuizStack.tsx` | 删除 line 108 `✗ 再看看`；引入 attempt 状态机；二错小卡片 |
| `src/components/english/reading/ParagraphRecallQuiz.tsx` | 同上 |

### 13.2 新增

| 文件 | 作用 |
|---|---|
| `src/components/english/words/MonsterEatScene.tsx` | 把 demo 的 4 个怪兽 SVG + 飞字动画 + 弹层抽成 React 受控组件，props: `{ word, monsterIdx, isSecondPlus, onDismiss }` |
| `src/components/english/words/RescueListBadge.tsx` | 题面顶端横向小条；空时返回 `null` |
| `src/components/english/words/FlashRecallCard.tsx` | 1.5s 闪现卡，含播报 |
| `src/components/english/words/RescueCompletionView.tsx` | 完成页"拯救成果"区块 |
| `src/hooks/useRescueQueue.ts` | 队列状态 + localStorage 持久化 + 补练拼装入口 |

### 13.3 不动

`useWordMastery` / `useWordData` / `useWeeklyPlan` / 数据库 schema / 数学模块 / calc 模块。

---

## 14. 不在本期范围

- 数学模块（lesson34/35/36 的 `❌ 不对哦` 提示）—— 下一期单独立项。
- calc 模块（已经有 `retry` / `wrong` 分层，先观察）。
- "打怪兽独立小游戏"页面（思路 3）—— 若本期上线后效果好再启动。
- 跨设备同步拯救队列（Supabase 新表）—— 若刷新丢失成为问题再加。
- 怪兽角色拓展（目前固定 demo 的 4 只）—— 后续可加更多 SVG。

---

## 15. 待审阅决策点

提交审阅时请重点确认：

1. localStorage 例外（§11.6）是否接受。
2. mastery 写入力度（§8 表）——"被吃 → lost = 双倍 incorrect"是否过重。
3. 阅读模块与单词模块的体验差异（§12）——是否接受不一致。
4. 怪兽弹层第二次起缩到 1.2s（§9.2）——是否进一步缩短或固定时长。
5. 拯救成功后是否需要金币/奖励道具反馈（本设计未含，留给后续）。
