# 可选子任务：必记 / 预习 分开练习

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留原来的"全部练习"一键模式；同时在当天有预习词时，提供可选的分开练习入口（必记 / 预习各自独立完成）。任务量少时走原有流程，任务量多时可拆开分两次完成。

**Architecture:** 
- `startStudy` 新增 `subTask: 'all' | 'consolidate' | 'preview'` 参数；`'all'` 走现有逻辑。
- 新增 `currentSubTask` state，仅在 `'consolidate'` / `'preview'` 子任务下追踪子进度。
- `WeekDayProgress` 新增可选字段 `consolidateDone`、`previewDone`、`consolidateScore`、`previewScore`；`quizDone` 语义不变（全天完成）。
- 周视图在"开始练习"按钮下方，当该日同时有必记词和预习词时，显示一行小按钮"分开练习：📘 必记 (N) · 🔖 预习 (N)"。

**Tech Stack:** TypeScript, React hooks, Tailwind CSS v4, Supabase

---

## File Map

| File | Change |
|------|--------|
| `src/utils/type.ts` | 扩展 `WeekDayProgress`，新增 4 个可选字段 |
| `src/components/english/words/WeeklyPlanSession.tsx` | 新增 `currentSubTask` state；`startStudy` 多一个参数；更新 `nextQ` 子任务分支；周视图增加分开练习按钮行；done 屏增加"继续另一个子任务"捷径 |

---

### Task 1: 扩展 `WeekDayProgress` 类型

**Files:**
- Modify: `src/utils/type.ts`

- [ ] **Step 1: 替换 `WeekDayProgress` interface**

找到文件中的 `WeekDayProgress`（约第 166–170 行），替换为：

```typescript
export interface WeekDayProgress {
  quizDone: boolean
  lastScore?: number // 最近一次完成（子任务或全天）的得分 0–100
  completedAt?: string // ISO date
  consolidateDone?: boolean   // 必记子任务已完成
  previewDone?: boolean       // 预习子任务已完成
  consolidateScore?: number   // 0–100
  previewScore?: number       // 0–100
}
```

- [ ] **Step 2: lint**

```bash
pnpm lint
```

期望：无报错（新字段均为可选，向后兼容）。

- [ ] **Step 3: Commit**

```bash
git add src/utils/type.ts
git commit -m "feat(types): add optional sub-task fields to WeekDayProgress"
```

---

### Task 2: 新增 `currentSubTask` state，更新 `startStudy`

**Files:**
- Modify: `src/components/english/words/WeeklyPlanSession.tsx`

- [ ] **Step 1: 新增 `currentSubTask` state**

在 `const [studyDefOnly, setStudyDefOnly] = useState(false)` 行之后插入：

```typescript
const [currentSubTask, setCurrentSubTask] = useState<'all' | 'consolidate' | 'preview'>('all')
```

- [ ] **Step 2: 替换 `startStudy` callback**

将现有 `startStudy` 替换为：

```typescript
const startStudy = useCallback(
  (dateStr: string, subTask: 'all' | 'consolidate' | 'preview' = 'all') => {
    const relevantTypes = subTask === 'preview' ? previewTypes : consolidateTypes
    const anyTypeSelected =
      subTask === 'all'
        ? consolidateTypes.size + previewTypes.size > 0
        : relevantTypes.size > 0
    if (!anyTypeSelected) {
      alert('请至少选择一种题型！')
      return
    }
    const session = buildSessionWords(dateStr)
    const filtered =
      subTask === 'all' ? session : session.filter((s) => s.kind === subTask)
    if (filtered.length === 0) return
    setCurrentSubTask(subTask)
    setWordKeys(filtered.map(({ entry, kind }) => ({ key: wordKey(entry), kind })))
    setStudyIdx(0)
    setStudyWordVisible(false)
    setStudyDefOnly(false)
    setSelectedDate(dateStr)
    setPhase('study')
    setIsImmersive(true)
  },
  [consolidateTypes, previewTypes, buildSessionWords, setIsImmersive],
)
```

注意：原来所有 `startStudy(someDate)` 的调用无需改动（默认参数 `'all'`）。

- [ ] **Step 3: lint**

```bash
pnpm lint
```

期望：无报错。

---

### Task 3: 更新 `nextQ` — 子任务分支保存独立进度

**Files:**
- Modify: `src/components/english/words/WeeklyPlanSession.tsx`

- [ ] **Step 1: 替换 `nextQ` callback**

将现有 `nextQ` useCallback 替换为：

```typescript
const nextQ = useCallback(() => {
  const next = curQ + 1
  if (next >= quizQs.length) {
    const finalScore = quizResultBuffer.current.filter((r) => r.correct).length
    const pct = Math.round((finalScore / quizQs.length) * 100)
    if (selectedDate) {
      const existing = planRef.current.progress[selectedDate] ?? {}

      if (currentSubTask === 'all') {
        // 原有逻辑：整天标记完成
        void updateDayProgress(selectedDate, {
          quizDone: true,
          lastScore: pct,
          completedAt: todayStr(),
        })
      } else {
        // 子任务逻辑：只标记对应子任务，quizDone 当两者均完成时为 true
        const consolidateDone =
          currentSubTask === 'consolidate' ? true : existing.consolidateDone
        const previewDone =
          currentSubTask === 'preview' ? true : existing.previewDone

        const dayIndex = planRef.current.days.findIndex((d) => d.date === selectedDate)
        const session = getDailySessionWords(planRef.current, vocab, masteryMap, dayIndex)
        const hasPreview = session.some((s) => s.kind === 'preview')
        const quizDone =
          consolidateDone === true && (!hasPreview || previewDone === true)

        void updateDayProgress(selectedDate, {
          ...existing,
          quizDone,
          lastScore: pct,
          completedAt: existing.completedAt ?? todayStr(),
          consolidateDone,
          previewDone,
          ...(currentSubTask === 'consolidate'
            ? { consolidateScore: pct }
            : { previewScore: pct }),
        })
      }
    }
    recordBatch(quizResultBuffer.current)
    quizResultBuffer.current = []
    setPhase('done')
  } else {
    setCurQ(next)
  }
}, [curQ, quizQs, selectedDate, currentSubTask, vocab, masteryMap, updateDayProgress, recordBatch])
```

需要确认 `getDailySessionWords` 已在文件顶部 import（当前已有）。`WeekDayProgress` 通过 `type` import 已存在。

- [ ] **Step 2: lint**

```bash
pnpm lint
```

期望：无报错。

- [ ] **Step 3: Commit**

```bash
git add src/components/english/words/WeeklyPlanSession.tsx
git commit -m "feat(session): optional sub-task progress tracking in nextQ"
```

---

### Task 4: 周视图 — 在"开始练习"按钮下方增加分开练习行

**Files:**
- Modify: `src/components/english/words/WeeklyPlanSession.tsx`

这是主要 UI 改动。定位到周视图 selected-day detail 区块中的"开始练习"按钮（约第 665 行）：

```tsx
<button
  onClick={() => startStudy(selectedDate)}
  className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] ..."
>
  {isDone ? '🔄 重新练习' : '🚀 开始练习'}
</button>
```

- [ ] **Step 1: 在 IIFE 内（return 之前）新增子任务派生变量**

在 IIFE 中 `const metCount = ...` 等派生变量之后，在 return 之前插入：

```typescript
const consolidateDoneToday = plan.progress[selectedDate]?.consolidateDone === true
const previewDoneToday = plan.progress[selectedDate]?.previewDone === true
const consolidateScore = plan.progress[selectedDate]?.consolidateScore
const previewScore = plan.progress[selectedDate]?.previewScore
const hasBothKinds = consolidateList.length > 0 && previewList.length > 0
```

- [ ] **Step 2: 将单按钮替换为"主按钮 + 可选分开行"布局**

```tsx
{/* 主按钮：原有全部练习 */}
<button
  onClick={() => startStudy(selectedDate)}
  className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-6 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
>
  {isDone ? '🔄 重新练习' : '🚀 开始练习'}
</button>

{/* 可选分开练习行：仅当同时有必记和预习词时显示 */}
{hasBothKinds && (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-[.65rem] font-bold text-[var(--wm-text-dim)]">分开练习：</span>
    <button
      onClick={() => startStudy(selectedDate, 'consolidate')}
      className={`font-nunito cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[.75rem] font-extrabold transition-all hover:-translate-y-px ${
        consolidateDoneToday
          ? 'border-[rgba(96,165,250,.6)] bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
          : 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.07)] text-[#93c5fd] hover:border-[#60a5fa]'
      }`}
    >
      {consolidateDoneToday
        ? `✓ 必记${consolidateScore !== undefined ? ' ' + consolidateScore + '%' : ''}`
        : `📘 必记 (${consolidateList.length})`}
    </button>
    <button
      onClick={() => startStudy(selectedDate, 'preview')}
      className={`font-nunito cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[.75rem] font-extrabold transition-all hover:-translate-y-px ${
        previewDoneToday
          ? 'border-[rgba(249,115,22,.6)] bg-[rgba(249,115,22,.15)] text-[#f97316]'
          : 'border-[rgba(249,115,22,.35)] bg-[rgba(249,115,22,.07)] text-[#fb923c] hover:border-[#f97316]'
      }`}
    >
      {previewDoneToday
        ? `✓ 预习${previewScore !== undefined ? ' ' + previewScore + '%' : ''}`
        : `🔖 预习 (${previewList.length})`}
    </button>
  </div>
)}
```

- [ ] **Step 3: lint**

```bash
pnpm lint
```

期望：无报错。

- [ ] **Step 4: Commit**

```bash
git add src/components/english/words/WeeklyPlanSession.tsx
git commit -m "feat(week-view): add optional split-practice buttons below main start button"
```

---

### Task 5: done 屏 — 显示子任务标签并提供跳转另一子任务的捷径

**Files:**
- Modify: `src/components/english/words/WeeklyPlanSession.tsx`

- [ ] **Step 1: 在 `if (phase === 'done')` 块顶部新增派生变量**

```typescript
const isSubTask = currentSubTask !== 'all'
const otherSubTask: 'consolidate' | 'preview' =
  currentSubTask === 'consolidate' ? 'preview' : 'consolidate'
const dayIndex2 = selectedDate
  ? plan.days.findIndex((d) => d.date === selectedDate)
  : -1
const sessionForDone =
  isSubTask && dayIndex2 >= 0
    ? getDailySessionWords(plan, vocab, masteryMap, dayIndex2)
    : []
const hasOtherWords = sessionForDone.some((s) => s.kind === otherSubTask)
const otherAlreadyDone =
  otherSubTask === 'consolidate'
    ? plan.progress[selectedDate ?? '']?.consolidateDone === true
    : plan.progress[selectedDate ?? '']?.previewDone === true
```

- [ ] **Step 2: 在 done 屏正确率那行末尾追加子任务标签**

找到：
```tsx
<div className="mb-2 text-[0.875rem] leading-loose text-[var(--wm-text-dim)]">
  正确率 {pct}% · {words.length} 个单词
```

替换为：
```tsx
<div className="mb-2 text-[0.875rem] leading-loose text-[var(--wm-text-dim)]">
  正确率 {pct}% · {words.length} 个{currentSubTask === 'consolidate' ? '必记' : currentSubTask === 'preview' ? '预习' : ''}词
```

- [ ] **Step 3: 在按钮行（`🔄 重新测试` 之后）追加"继续另一子任务"按钮**

找到按钮组 `<div className="flex flex-wrap justify-center gap-2.5">` 内，在最后一个按钮后插入：

```tsx
{isSubTask && hasOtherWords && !otherAlreadyDone && selectedDate && (
  <button
    onClick={() => startStudy(selectedDate, otherSubTask)}
    className={`font-nunito cursor-pointer rounded-[10px] border-0 px-6 py-2.5 text-[.88rem] font-extrabold text-white transition-all hover:-translate-y-px ${
      otherSubTask === 'consolidate'
        ? 'bg-gradient-to-br from-[#1e40af] to-[#60a5fa] shadow-[0_3px_12px_rgba(96,165,250,.3)]'
        : 'bg-gradient-to-br from-[#9a3412] to-[#fb923c] shadow-[0_3px_12px_rgba(249,115,22,.3)]'
    }`}
  >
    {otherSubTask === 'consolidate' ? '📘 继续必记练习 →' : '🔖 继续预习练习 →'}
  </button>
)}
```

- [ ] **Step 4: lint**

```bash
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add src/components/english/words/WeeklyPlanSession.tsx
git commit -m "feat(done-screen): show sub-task label and shortcut to other sub-task"
```

---

### Task 6: 冒烟测试 + build 验证

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm dev
```

- [ ] **Step 2: 打开一个同时有必记和预习词的计划**

进入 `/english/words/daily` → 打开一个含预习词的周计划 → 选中一天。

- [ ] **Step 3: 验证布局**

确认看到：
- 主"🚀 开始练习"按钮（全部词）
- 下方一行小按钮"分开练习：📘 必记 (N) · 🔖 预习 (N)"

- [ ] **Step 4: 走全部练习流程**

点"🚀 开始练习"，完成 study + quiz。确认：
- done 屏正确率行显示"词"（无必记/预习标签，因为 `currentSubTask === 'all'`）
- 无"继续另一子任务"按钮
- 当天卡片变绿（`quizDone: true`）

- [ ] **Step 5: 走必记子任务流程**

刷新，选同一天，点"📘 必记 (N)"小按钮，完成后：
- done 屏显示"必记词"
- 出现"🔖 继续预习练习 →"按钮
- 返回周视图：必记小按钮变为"✓ 必记 XX%"，预习按钮不变
- 当天卡片不是绿色（未全部完成）

- [ ] **Step 6: 走预习子任务流程**

点"🔖 预习 (N)"或 done 屏上的继续按钮，完成后：
- 返回周视图：两个小按钮均显示"✓"，当天卡片变绿

- [ ] **Step 7: 验证只有必记词的天**

选一个无预习词的天。确认"分开练习"行不显示。

- [ ] **Step 8: 验证旧数据向后兼容**

打开一个之前已完成（`quizDone: true` 但无 `consolidateDone`）的计划。确认当天卡片仍显示绿色。

- [ ] **Step 9: production build**

```bash
pnpm build
```

期望：TypeScript 无报错，build 成功。
