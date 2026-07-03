# FAQ

> 常见疑问与操作指引。词库 / 数学讲次录入见「运维指引」；数学每日计划、复习机制见「数学模块机制」。

---

## 运维指引

### 如何添加词库？

英语词库存储在 Supabase **`word_entries` 表**，App 运行时只读数据库（不写本地词库文件）。根据规模有两种做法：

#### 方式 A：管理后台（少量单词 / 日常维护）

适合补几个词、改释义、新建一个小词库。

1. 打开 **`/admin/words`**（管理后台 → 词库管理）
2. **新建词库**：点击「新建词库」，输入 stage 名（如 `4C`）
3. **维护结构**：在左侧选好 stage → Unit → Lesson
4. **添加单词**：
   - **单个添加**：填写单词、释义、音标、例句等；可点 AI 自动填充（需配置 `ANTHROPIC_API_KEY`）
   - **批量添加**：上传 xlsx 或粘贴表格（列：Stage / Unit / Lesson / 单词 / 释义 / 音标 / 例句）
5. **导出备份**：可按当前筛选条件导出 xlsx
6. **核对**：`/admin/word-audit` 对比数据库与备份文件，检查缺漏

| 注意 | 说明 |
|------|------|
| 唯一键 | 同一 `(stage, unit, lesson, word)` 不能重复 |
| 空词库 | 新建 stage 后若尚未加词，结构暂存在浏览器 localStorage，刷新后仍在；**至少添加 1 个单词**后才会写入数据库 |

#### 方式 B：整库导入（新 stage、上百词）

适合从牛津词卡 PDF、教研 xlsx 一次性导入整个 stage（如 4B、4C）。

1. 准备源文件（PDF 词卡 / xlsx / md）
2. 在 Cursor 对话执行 **`/add-stage <STAGE> <源文件路径>`**  
   例：`/add-stage 4C docs/4C.pdf`
3. Skill 会生成：
   - `docs/<STAGE>-upsert.sql` — 灌入基础字段
   - `docs/<STAGE>-update-maps.sql` — 更新音节、关键字等 jsonb 字段
   - `packages/english/src/utils/english-data-<STAGE>.ts` — 离线备份（runtime 不引用）
4. **在 Supabase SQL Editor 依次执行** upsert → update-maps，每步后核对词数
5. 刷新 App，`/english` 词库筛选中应出现新 stage

详细流程与校验规则见仓库内 `.claude/skills/add-stage/SKILL.md`。

---

### 如何添加数学讲次（课程）？

数学每一「讲」= 一个关卡目录 `apps/web/src/app/math/ny/N/`，题目数据在 `packages/math/src/utils/lessonN-data.ts(x)`。推荐用 AI 按规范生成，避免漏注册入口。

#### 推荐流程（`/add-lesson`）

1. **写题目源稿**  
   复制 `docs/math/new-lesson-template.md` → `docs/math/lessons/N.md`（N = 讲次号，如 `48`）  
   填入 summary、课前测、课堂讲解、课后巩固、拓展、附加题等**全部**题目；录入前自己数清总题数。

2. **准备配图（如有）**  
   - 题解配图 → `public/img/math/48-P3.png` 等  
   - 交互题 / 题面 SVG → 在 N.md 中写清组件说明（见 `docs/math/how-to-add-lesson.md`）

3. **触发录入**  
   在 Cursor 对话：`/add-lesson 48`  
   或说明：「按 add-lesson 规范录入第 48 讲，题目在 docs/math/lessons/48.md」

4. **本地验收**（`pnpm dev`）

   | 检查项 | 地址 |
   |--------|------|
   | 年级讲次列表 | `/math` → 对应年级 |
   | 讲次首页与题数 | `/math/ny/48` |
   | 各模块做题 | `/math/ny/48/lesson`、`homework`、`pretest` 等 |
   | 综合题库 | `/math/ny/48/alltest` |
   | 题海 | `/math/sea` |
   | 每日计划可选讲次 | `/math/ny/plan` |

5. **合并前** 运行 `pnpm typecheck` / `pnpm build`

#### 铁律（易踩坑）

| 规则 | 说明 |
|------|------|
| **题目 ID 加讲次前缀** | 如 `48-L1`、`48-H3`，避免跨讲次 ID 碰撞 |
| **8 处入口注册** | 除数据与路由外，还须登记 `courses-data`、`lesson-grade`、`sea-data`、每日计划、组卷等（skill 会处理；手动改代码见 `docs/add-new-lesson/registration.md`） |
| **build 通过 ≠ 页面正常** | 新增 UI 后真机打开看一眼；包内 Tailwind 需在 `globals.css` `@source` 扫描 |

#### 延伸阅读

| 文档 | 内容 |
|------|------|
| [`docs/math/how-to-add-lesson.md`](how-to-add-lesson.md) | 面向家长的图文操作说明 |
| [`docs/add-new-lesson.md`](../add-new-lesson.md) | 技术索引与文件清单 |
| `.claude/skills/add-lesson/SKILL.md` | AI 录入 skill 完整规范 |

---

## 数学模块机制

> 实现代码主要在 `packages/math/`。

---

## 「本周旧讲」的逻辑是什么？

**「本周旧讲」** 是每日计划页里额外出现的一道**旧讲复习题**（紫色区块），与「必做题」分开，也和基于掌握度的「旧讲复习」不是同一套机制。

### 它做什么

- 在计划周期内，**每天（选中的那一天）自动分配 1 道**来自更早讲次的题
- 目标是尽量**均匀覆盖**之前的讲次和题目，而不是按 SM-2 到期推送
- 可以做题、跳过；UI 显示「已覆盖 X/Y 题」

### 题目从哪来

候选池 `priorLessonProbs`（见 `MathWeeklyPractice.tsx`）：

| 规则 | 说明 |
|------|------|
| 讲次范围 | 只取 **讲次编号 < 当前计划主关卡 `lessonId`** 的关卡 |
| 题目来源 | 每讲仅 **课堂讲解、课后巩固、课前测**（不含练习册、附加题） |
| 空讲次 | 没有题目的讲（如纯动画关）跳过 |

多关卡计划时，`lessonId` 使用**主关卡**（当前实现为选中讲次里编号最大的那一讲），「旧讲」相对该主关卡计算。

### 每天怎么选题

核心函数：`pickWeeklyLessonProblem`（`packages/math/src/utils/math-helpers.ts`），由 `useMathWeeklyLessonReview` 调用。

1. **先选哪一讲**
   - 对每讲计算该讲所有题的 `reviewCount` 最小值
   - 选最小值**最小**的讲（覆盖最少的旧讲优先）
   - 平局时选**讲次编号更大**的（更近的旧讲）

2. **再选哪一题**
   - 在该讲内选 `reviewCount` **最少**的一题

3. **排除冲突**
   - 若当天第 36 讲的「知识点复习」已占用某题，会从候选中排除并必要时重选

**分配时机**：首次打开某天时写入 `dailyAssignments[date]`；同一天不会重选，除非与「知识点复习」冲突。

### 完成、跳过与统计

状态持久化在 Supabase 表 `math_weekly_lesson_review`（hook：`useMathWeeklyLessonReview.ts`）：

| 字段 | 含义 |
|------|------|
| `dailyAssignments` | 某天分配到的题目 key |
| `dailyDoneKeys` | 某天已完成的题目 |
| `dailySkipped` | 某天是否跳过 |
| `reviewCounts` | 每题累计被选中并完成次数 |

- **做完**：`markDone` → 该题 `reviewCount + 1`
- **跳过**：当天不再展示，不增加 `reviewCount`
- **自动完成**：若 Supabase 已有该题做题记录（`solveCount > 0`），会自动标记完成

「已覆盖 X/Y 题」= 该旧讲内 `reviewCount > 0` 的题数 / 该讲候选池总题数。

### 与计划页其他复习区块的区别

| 区块 | 机制 | 适用范围 |
|------|------|----------|
| **本周旧讲** | 每天 1 题，按覆盖次数轮转旧讲 | 所有计划 |
| **旧讲复习** | 基于掌握度 / 到期日的间隔复习（`getMathReviewProblemsForDay`） | 非第 36 讲计划 |
| **知识点复习** | 第 36 讲专用，按讲次轮转多题（`useMathRotatingReview`） | 仅 `lessonId === '36'` |
| **错题巩固** | 计划范围内错题本中的题，答对后自动消失 | 计划包含的讲次 |

### 切换计划时

- 状态绑定 `planLessonId`
- 换到不同主关卡的计划时会**重置**，从新计划的旧讲池重新分配

### 相关代码

| 文件 | 职责 |
|------|------|
| `packages/math/src/hooks/useMathWeeklyLessonReview.ts` | 状态加载、每日分配、完成/跳过 |
| `packages/math/src/utils/math-helpers.ts` → `pickWeeklyLessonProblem` | 选题算法 |
| `packages/math/src/components/MathWeeklyPractice.tsx` | UI（`WeeklyLessonSection`）、候选池构建 |

---

## 计划题目分配的逻辑是什么？

创建或修改计划并点击「创建计划 / 保存修改」时，由 `buildMathFlexiblePlan`（`packages/math/src/utils/math-helpers.ts`）**一次性生成**整个计划周期内每天的必做题列表。分配结果写入 `MathWeeklyPlan.days`，保存到 Supabase `math_weekly_plans.plan_data`。

### 第一步：确定候选题目池

从用户在创建页勾选的配置中收集题目：

| 筛选维度 | 规则 |
|----------|------|
| **关卡** | 多选的所有讲次（`lessonIds`） |
| **题目来源** | 每讲启用的 section：课堂讲解 / 课后巩固 / 课前测 / 练习册 / 附加题（`sectionFilters`） |
| **题型** | 每讲启用的 `Problem.tag`（如 `type1`、`type2`…，`tagFilters`）；未配置时默认全部题型 |
| **默认来源** | 新选关卡时默认启用：课堂讲解 + 课后巩固 + 课前测 |

同一道题在池子里只出现一次；多关卡、多来源的题目合并为一个扁平列表。

### 第二步：计算每天题量

```
计划天数 = 结束日期 − 开始日期 + 1（含首尾）
每天题量 = ceil(候选池题目总数 ÷ 计划天数)，至少 1 题
```

UI 预览区的「每天约 N 题」即此值；**用户不能手动改每天题量**，由时间段和题目总数自动推算。

### 第三步：按题型均衡分配到各天

分配目标：在计划周期内排完候选池全部题目，并尽量**均衡覆盖各题型**，且**先易后难**。

#### 题型分组与组内排序

- 题型 key = `{lessonId}::{tag}`（如 `37::type1`），同一讲的不同 tag 各自成组
- 组内题目排序（优先级从高到低）：
  1. **未练习**（`solveCount[problemId] === 0`）优先于已练习
  2. 同练习状态下按 `difficulty`（1→5 星）**升序**
  3. 再按题目 key 稳定排序
- 各组按 `type1 < type2 < …` 及组内最低难度排序，保证整体**从易到难**推进

分配时使用创建计划当下的 `solveCount`（来自 Supabase 做题记录）；**重新保存计划**会按最新练习进度重新分配。

#### 每天怎么选题

对每一天，在当天配额（`problemsPerDay`，最后一天可能更少）内循环：

1. 在**仍有剩余题目**的题型中，按以下顺序排序：
   - **已分配次数少**的题型优先（均衡覆盖）
   - 平局时选**剩余未练习题更多**的题型
   - 再按题型编号小 → 组内最低难度低
2. 取排第一的题型，从该组**尚未分配**的题目里选下一道（组内已按「未练优先 → 难度升序」排好）
3. 重复直到当天配额满或题目池耗尽

#### 举例

某讲有 A/B/C/D/E 五个题型，每天 4 题：

| 天 | 优先逻辑 | 示例分配 |
|----|----------|----------|
| 第 1 天 | 各题型分配次数均为 0，按 A→B→C→D→E 顺序 | A、B、C、D 各 1 题 |
| 第 2 天 | E 未分配过（0 次），A–D 已 1 次；优先 E，再补 A–D | E、A、B、C |
| 第 3 天 | A/B/C 已 2 次，D/E 仅 1 次；优先 D、E | D、E、A、B |

这样可避免连续多天只练同一题型，同时整体仍按题型难度从低到高推进。

### 第四步：写入计划结构

每个计划日对应一条 `MathWeeklyPlanDay`：

```ts
{ date: 'YYYY-MM-DD', problems: [...], optionalProblems: [] }
```

- `problems`：当天必做题（按分配顺序）
- `optionalProblems`：当前灵活计划流程中**恒为空**（旧版 7 天固定计划曾把练习册溢出题放选做，新计划不再区分）

### 与计划创建 UI 的关系

| UI 操作 | 对分配的影响 |
|---------|----------------|
| 改时间段 | 改变天数 → 改变每天题量 → 重新分配 |
| 增删关卡 / 来源 / 题型 | 改变候选池 → 重新分配 |
| 编辑已有计划并保存 | 重新跑分配算法；若关卡与筛选条件不变，可保留已有 `progress` |
| 选日期 | 已有计划占用的日期不可重叠（见 `getOccupiedPlanDates`） |

### 与旧版「周计划」的区别

| | 旧版 `buildMathWeeklyPlan` | 现行 `buildMathFlexiblePlan` |
|--|---------------------------|------------------------------|
| 周期 | 固定 7 天 | 任意起止日期 |
| 关卡 | 单讲 | 多讲 |
| 来源 | 写死：lesson + homework + workbook 前 6 + pretest | 用户勾选 section |
| 题型 | 无筛选，按池子顺序依次填充 | 按 tag 均衡 + 难度升序 |
| 每天题量 | 用户指定 | 自动 `ceil(总数÷天数)` |

旧数据仍可按原结构读取；新建计划一律走 `buildMathFlexiblePlan`。

### 相关代码

| 文件 | 职责 |
|------|------|
| `packages/math/src/utils/math-helpers.ts` → `buildMathFlexiblePlan` | 候选池构建 + 按题型分配 |
| `packages/math/src/utils/math-helpers.ts` → `countFilteredPlanProblems` | 预览「共 N 道题」 |
| `packages/math/src/components/MathWeeklyPractice.tsx` | 创建页 UI、调用分配、保存计划 |
| `packages/math/src/hooks/useMathWeeklyPlan.ts` | 计划持久化（含 `sectionFilters` / `tagFilters` 元数据） |

---

## 「错题巩固」的逻辑是什么？

**「错题巩固」** 是每日计划页里、必做题下方的额外区块，展示当前计划范围内仍在**错题本**（Supabase 表 `math_wrong`）中的题目，方便在计划日一并复习。

### 它做什么

- 每个计划日都会列出**当前仍标记为错题**、且属于本计划讲次（`lessonIds`）的题目
- 与必做题**去重**：若某错题已出现在当天必做题里，只在必做题区展示一次
- 答对后从错题本移除（与关卡内做题逻辑一致），返回计划页后自动不再显示

### 题目从哪来

| 规则 | 说明 |
|------|------|
| 错题来源 | 任意关卡做错时写入 `math_wrong`（`createLessonProvider` → `addWrong`） |
| 讲次范围 | 仅当前计划的 `lessonIds`（多讲计划包含全部选中讲次） |
| 题目来源 | 该讲全部 section（课堂讲解、课后巩固、课前测、练习册、附加题） |
| 排序 | 讲次编号升序，同讲内按题目 key 稳定排序 |

### 完成与进度

- **不计入**必做题进度条与 `doneKeys`；独立展示，无手动勾选
- **视为完成**：该题已不在 `math_wrong` 中（在关卡页答对后会自动删除错题记录）
- 返回计划页时 hook 会在页面重新可见时刷新错题列表

### 与全局错题本的关系

- `/math/mistakes` 展示**所有讲次**的错题；计划页「错题巩固」只展示**本计划讲次**的子集
- 同一道题两处逻辑一致：答对即移出错题本

### 相关代码

| 文件 | 职责 |
|------|------|
| `packages/math/src/hooks/useMathWrong.ts` | 加载 / 刷新错题 ID |
| `packages/math/src/utils/math-helpers.ts` → `buildProblemIdMap` | problemId → 做题链接 |
| `packages/math/src/components/MathWeeklyPractice.tsx` | UI（`wrongByDay`、错题区块） |
| `packages/math/src/components/shared/createLessonProvider.tsx` | 做错写入、答对删除错题 |
