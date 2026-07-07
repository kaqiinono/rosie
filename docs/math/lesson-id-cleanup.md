# Math 讲次 ID 收尾方案：去掉 legacyId 与 slug

> **目的：** 把讲次身份体系统一为 `lessonKey` + `grade` + `seq`，删除 `legacyId`、`slug` 及所有双轨兼容代码。
>
> **前置：** 路由重构（`/math/ny/{grade}/{seq}`）与题目数据层 `lessonKey` 前缀（如 `2-4-L1`）应已完成。本文档覆盖**尚未收尾**的部分。
>
> **相关已有资产：**
> - DB 迁移：`docs/sql/math-lesson-id-audit.sql`、`docs/sql/math-lesson-id-migrate.sql`
> - 可丢弃数据清理：`docs/sql/math-lesson-id-delete-disposable.sql`
> - JSON / Storage：`scripts/migrate-math-lesson-ids.mjs`
> - 管理端审计：`/admin/math-lesson-id-audit`

---

## 1. 现状与问题

### 1.1 已完成

| 层面 | 状态 |
|------|------|
| URL | `/math/ny/52` → `/math/ny/2/4` |
| App Router | 动态路由 `apps/web/src/app/math/ny/[grade]/[seq]/**` |
| 题目 ID（源码） | `2-4-L1`，非 `52-L1` |
| `courses-data.ts` | `href: '/math/ny/{grade}/{seq}'` |

### 1.2 仍存在的「脏数据 / 双轨」

`legacyId`（如 `52`）和 `slug`（如 `lesson52`）仍在注册表与多处消费方中作为一等字段：

```
lesson-registry.ts          → lessonKey + grade + seq + legacyId + slug
lesson-module-registry.ts   → LESSON_MODULES['lesson52'] + legacyId + slug
sea-data.ts                 → SEA_LESSONS[].id = '52'
plan/page.tsx               → PROBLEM_SETS['52']
MathWeeklyPractice.tsx      → LESSONS[].id = '52'；Number(lessonId) 排序
quiz/page.tsx               → LESSON_META[].id = '52'
quiz/[id]/*.tsx             → LESSON_DATA 键 = '52'
mistakes/page.tsx           → LESSON_META[].id = '34'…
lesson-route-utils.ts       → lessonModuleBySlug(entry.slug)
lesson-grade.ts             → LESSON_GRADE 双键（legacyId + lessonKey）
lesson-registry.ts          → resolveLesson / migrateProblemId / BY_LEGACY
```

**结论：** `legacyId` 和 `slug` 不是业务必需字段，而是迁移期桥接；保留它们说明 ID 体系重构**只完成了一半**。

---

## 2. 目标身份模型

### 2.1 注册表唯一形态

```ts
// packages/math/src/utils/lesson-registry.ts
export type LessonEntry = {
  lessonKey: string  // 全局唯一主键，如 '2-4'
  grade: number      // 年级，如 2
  seq: number        // 年级内讲次序号，如 4
}
```

示例：

```ts
const LESSON_ENTRIES: LessonEntry[] = [
  { lessonKey: '1-12', grade: 1, seq: 12 },
  { lessonKey: '2-4',  grade: 2, seq: 4 },
  // ...
]
```

### 2.2 各层如何推导（不再需要额外 ID）

| 用途 | 来源 |
|------|------|
| 路由 | `lessonRoutePath(entry.grade, entry.seq)` → `/math/ny/2/4` |
| 题目 ID | `problemIdForLesson(entry.lessonKey, 'L1')` → `2-4-L1` |
| 组件查找 | `LESSON_MODULES[entry.lessonKey]` |
| 年级 | `entry.grade` 或 `gradeOf(lessonKey)` |
| 显示「第 N 讲」 | `lessonDisplayLabel(lessonKey)`（一年级 = 教材 seq；二年级起 = 年级内序号） |

### 2.3 源码目录名（实现细节，不进注册表）

`packages/math/src/components/lesson52/`、`lesson52-data.ts` 等**可以暂时保留**——它们只是 import 路径，不必出现在 `LessonEntry` 或 `LESSON_MODULES` 的键里。

可选后续：批量改名为 `lesson-2-4/`、`lesson-2-4-data.ts`（纯机械重构，与身份体系无关）。

---

## 3. 映射表（仅 DB / 一次性迁移参考）

执行 Supabase 迁移或核对数据时使用；**代码收尾完成后不应再依赖此表**。

| legacyId | lessonKey | grade | seq | 旧目录 slug（仅 import） |
|----------|-----------|-------|-----|-------------------------|
| 12 | 1-12 | 1 | 12 | lesson12 |
| 13 | 1-13 | 1 | 13 | lesson13 |
| 15 | 1-15 | 1 | 15 | lesson15 |
| 18 | 1-18 | 1 | 18 | lesson18 |
| 23 | 1-23 | 1 | 23 | lesson23 |
| 29 | 1-29 | 1 | 29 | lesson29 |
| 30 | 1-30 | 1 | 30 | lesson30 |
| 34 | 1-34 | 1 | 34 | lesson34 |
| 35 | 1-35 | 1 | 35 | lesson35 |
| 36 | 1-36 | 1 | 36 | lesson36 |
| 37 | 1-37 | 1 | 37 | lesson37 |
| 38 | 1-38 | 1 | 38 | lesson38 |
| 39 | 1-39 | 1 | 39 | lesson39 |
| 40 | 1-40 | 1 | 40 | lesson40 |
| 41 | 1-41 | 1 | 41 | lesson41 |
| 42 | 1-42 | 1 | 42 | lesson42 |
| 43 | 1-43 | 1 | 43 | lesson43 |
| 44 | 1-44 | 1 | 44 | lesson44 |
| 46 | 1-46 | 1 | 46 | lesson46 |
| 47 | 1-47 | 1 | 47 | lesson47 |
| 49 | 2-1 | 2 | 1 | lesson49 |
| 50 | 2-2 | 2 | 2 | lesson50 |
| 51 | 2-3 | 2 | 3 | lesson51 |
| 52 | 2-4 | 2 | 4 | lesson52 |
| 53 | 2-5 | 2 | 5 | lesson53 |
| 55 | 2-6 | 2 | 6 | lesson55 |

---

## 4. 执行顺序（推荐分 PR）

> **原则：** 先确保 DB / 用户数据已是 `lessonKey`，再删代码里的兼容层；否则删 `migrateProblemId` 会导致旧数据无法解析。

### Phase 0 — 数据层验收（Supabase）

**在改代码前完成。**

1. 运行 `docs/sql/math-lesson-id-audit.sql`，保存结果。
2. （可选）若组卷 / 周计划可丢弃：先跑 `docs/sql/math-lesson-id-delete-disposable.sql`。
3. 跑 `docs/sql/math-lesson-id-migrate.sql`（事务内一次 Run 完）。
4. 跑 `node scripts/migrate-math-lesson-ids.mjs --apply`（及 `--storage` 若需要）。
5. 打开 `/admin/math-lesson-id-audit`，确认 legacy `problem_id` / `lesson_id` 为 0。

**周计划 JSON 注意：** `math_weekly_plans.progress_data` 里的 `lessonIds`、`sectionFilters`、`tagFilters` 的**对象键**可能仍是 legacyId。若未清空周计划表，需额外脚本把 JSON 内键从 `52` 改为 `2-4`（或清空后让用户重建计划）。`lesson_id` 列的 SQL 迁移不覆盖 `progress_data` 内部键。

**验收：**

- [ ] `math_solved` / `math_wrong` / `math_favorites` 无 `52-L1` 形态
- [ ] `math_problem_notes.lesson_id`、`math_problem_images.lesson_id` 均为 `lessonKey`
- [ ] Storage 路径含 `2-4` 而非 `/52/`

---

### Phase 1 — 消费方统一用 `lessonKey`

把所有仍以 legacyId 字符串为键的**应用层数据**改为 `lessonKey`。

#### 1.1 `packages/math/src/utils/sea-data.ts`

```ts
// 前
{ id: '52', title: '第52讲·…', shortTitle: '52·…', ... }

// 后
{ id: '2-4', title: '第4讲·…', shortTitle: '2-4·…', ... }
// 或 title 用 lessonDisplayLabel('2-4') 的文案风格
```

- [ ] `SEA_LESSONS[].id` → `lessonKey`
- [ ] `SEA_LESSON_MAP` 键同步
- [ ] `SeaProblem.lessonId`（由 `lesson.id` 派生）自动正确
- [ ] `apps/web/src/app/math/sea/page.tsx` 筛选逻辑无需改键名以外的逻辑（仍用 `l.id`）

#### 1.2 `apps/web/src/app/math/ny/plan/page.tsx`

```ts
// 前
const PROBLEM_SETS: Record<string, ProblemSet> = { '52': PROBLEMS52, ... }

// 后
const PROBLEM_SETS: Record<string, ProblemSet> = { '2-4': PROBLEMS52, ... }
```

#### 1.3 `packages/math/src/components/MathWeeklyPractice.tsx`

- [ ] `LESSONS[].id` → `lessonKey`（如 `'1-36'` 替代 `'36'`）
- [ ] **删除** `Number(a.lessonId) - Number(b.lessonId)` 排序 → 改用 `compareLessonIds(a, b)`（registry）
- [ ] `weeklyPlan?.lessonId === '36'` → `'1-36'`（或 `lessonKey` 常量）
- [ ] `const currentId = Number(weeklyPlan.lessonId)` → 用 `compareLessonIds` / `lessonByKey` 判断「之前讲次」
- [ ] 错题链接 `href={/math/ny/${prob.lessonId}/...}` → 用 `routeForLesson(lessonByKey(prob.lessonId)!)` 或 `lessonRoutePath(grade, seq)`
- [ ] UI 文案 `第{prob.lessonId}讲` → `lessonDisplayLabel(prob.lessonId)`

#### 1.4 组卷

| 文件 | 改动 |
|------|------|
| `apps/web/src/app/math/ny/quiz/page.tsx` | `LESSON_META[].id` → `lessonKey` |
| `apps/web/src/app/math/ny/quiz/[id]/page.tsx` | `LESSON_DATA` 键 → `lessonKey` |
| `apps/web/src/app/math/ny/quiz/[id]/print/page.tsx` | 同上 |

#### 1.5 其他页面

| 文件 | 改动 |
|------|------|
| `apps/web/src/app/math/mistakes/page.tsx` | `LESSON_META[].id` → `lessonKey`；链接用 canonical 路由 |
| `packages/math/src/utils/favorites-helpers.ts` | 依赖 `SEA_LESSONS` 新 id，通常无需改逻辑 |
| `packages/math/src/admin/MathPdfSliceMatcher.tsx` | `Number(a.lessonId)` 排序 → `compareLessonIds` |

#### 1.6 `packages/core/src/type.ts`

更新注释，明确 `MathWeeklyPlan.lessonId` / `lessonIds` 存 **lessonKey**：

```ts
lessonId: string   // lessonKey，如 "2-4"
lessonIds?: string[]
```

**Phase 1 验收：**

```bash
pnpm --filter @rosie/math typecheck
pnpm build
```

- [ ] 题海筛选、组卷选题、周计划生成/保存、收藏分组均正常
- [ ] 无页面仍用 `gradeOf('52')` 或 `PROBLEM_SETS['52']`

---

### Phase 2 — 模块注册表改用 `lessonKey` 作键

#### 2.1 `packages/math/src/utils/lesson-module-registry.ts`

```ts
// 前
export const LESSON_MODULES: Record<string, LessonModule> = {
  lesson52: { slug: 'lesson52', legacyId: '52', PROBLEMS: P52, ... },
}

export function lessonModuleBySlug(slug: string) { ... }

// 后
export const LESSON_MODULES: Record<string, LessonModule> = {
  '2-4': { PROBLEMS: P52, Provider: Provider52, ... },  // import 仍来自 lesson52/
}

export function lessonModuleByKey(lessonKey: string): LessonModule | undefined {
  return LESSON_MODULES[lessonKey]
}
```

- [ ] `LessonModule` 类型去掉 `slug`、`legacyId` 字段
- [ ] 所有 `lesson52:` 键改为对应 `lessonKey`
- [ ] 删除 `lessonModuleBySlug`（或保留薄别名转发到 `lessonModuleByKey`，随后删除）

#### 2.2 `packages/math/src/utils/lesson-route-utils.ts`

```ts
// 前
const module = lessonModuleBySlug(entry.slug)

// 后
const module = lessonModuleByKey(entry.lessonKey)
```

**Phase 2 验收：**

- [ ] 访问 `/math/ny/2/4` 及子路由（lesson、notes、drafts、mistakes）正常
- [ ] `pnpm build` 通过

---

### Phase 3 — 精简 `lesson-registry.ts`

#### 3.1 删除字段

- [ ] `LessonEntry` 去掉 `legacyId`、`slug`
- [ ] `LESSON_ENTRIES` 每行只保留三列
- [ ] 删除 `BY_LEGACY`、`BY_SLUG`

#### 3.2 删除或收窄 API

| 删除 | 替代 |
|------|------|
| `lessonByLegacyId` | `lessonByKey` |
| `lessonBySlug` | `lessonByKey` |
| `resolveLesson(id)` 双轨 | 只查 `BY_KEY`；或改名为 `lessonByKey` 并删除别名 |
| `lessonKeyFromLegacy` | 不再需要 |
| `legacyIdFromKey` | 不再需要 |
| `migrateProblemId` | DB 迁完后删除；审计页可改为只报告「非法 id」 |
| `buildLegacyToKeyMap` / `buildKeyToLegacyMap` | 删除；映射表仅留本文档 §3 |
| `lessonKeyFromProblemId` 的 legacy 分支 | 只解析 `1-12-L1` / `2-4__SUMMARY` 形态 |

#### 3.3 保留的 API

- `lessonByKey`、`lessonByRoute`、`lessonRoutePath`、`routeForLesson`
- `lessonFromHref`、`problemIdForLesson`、`lessonSummaryProblemId`
- `lessonKeyFromProblemId`（仅新格式）
- `compareLessonIds`（改为只接受 lessonKey）
- `lessonsForGradeRegistry`、`gradesInOrderFromRegistry` 等

#### 3.4 `packages/math/src/index.ts`

- [ ] 删除已废弃 export

**Phase 3 验收：**

```bash
rg 'legacyId|lessonBySlug|lessonByLegacy|migrateProblemId|lessonModuleBySlug' packages/math apps/web
# 应只剩本文档、SQL、迁移脚本、或注释中的历史说明
```

---

### Phase 4 — `lesson-grade.ts` 收尾

```ts
// 前：双键
export const LESSON_GRADE = Object.fromEntries(
  LESSONS.flatMap((e) => [[e.legacyId, e.grade], [e.lessonKey, e.grade]]),
)

// 后：单键
export const LESSON_GRADE: Record<string, number> = Object.fromEntries(
  LESSONS.map((e) => [e.lessonKey, e.grade]),
)
```

- [ ] `gradeOf(lessonId)` 只接受 `lessonKey`
- [ ] 删除 `@deprecated` 注释（若已无 legacy 调用方）
- [ ] `lessonsForGrade` 已返回 `lessonKey[]`（当前已是，确认无回归）

---

### Phase 5 — 管理端与迁移工具

| 文件 | 改动 |
|------|------|
| `packages/math/src/admin/math-lesson-id-audit.ts` | 去掉 legacy 统计分支；或标记为「历史工具」 |
| `packages/math/src/admin/MathLessonIdAuditPage.tsx` | 文案更新 |
| `scripts/migrate-math-lesson-ids.mjs` | `LESSON_MAP` 可保留（一次性工具）；或改为从 registry 生成 |

迁移脚本与 SQL **不删除**（归档用途），但代码运行时路径不得再 import `buildLegacyToKeyMap`。

---

### Phase 6 — 文档与新增讲次流程

更新以下文件，使新讲次**只登记三列**：

| 文件 | 要点 |
|------|------|
| `docs/add-new-lesson.md` | 删除 legacyId / slug 列；ID 表只保留 lessonKey、grade、seq |
| `docs/add-new-lesson/registration.md` | registry 示例、`SEA_LESSONS.id`、`PROBLEM_SETS` 键、quiz `LESSON_META` 均用 lessonKey |
| `docs/add-new-lesson/routes.md` | `lessonModuleByKey` 表述 |
| `.claude/skills/add-lesson/SKILL.md` | 同步 v4+ 流程 |
| `packages/math/CLAUDE.md` | `lessonNN/` 说明为目录约定，非业务 ID |

**新讲次注册示例（收尾后）：**

```ts
// lesson-registry.ts
{ lessonKey: '2-7', grade: 2, seq: 7 },

// lesson-module-registry.ts
'2-7': { PROBLEMS: P56, Provider: Provider56, ... },

// sea-data.ts
{ id: '2-7', title: '第7讲·…', problems: PROBLEMS56, ... },
```

---

### Phase 7（可选）— 目录与文件名统一

非阻塞，可单独 PR：

- `components/lesson52/` → `components/lesson-2-4/`（或 `lesson2-4`）
- `lesson52-data.ts` → `lesson-2-4-data.ts`
- 更新所有 `@rosie/math/...` import
- Provider 命名：`Lesson52Provider` → `Lesson2_4Provider` 或保留旧组件名仅改路径

**不建议**在 Phase 1–6 中同时做，避免 diff 过大。

---

### Phase 8（可选）— 减少重复元数据

收尾后可考虑：

- `MathWeeklyPractice` 的 `LESSONS` 数组与 `SEA_LESSONS` 的标题/emoji 从 `courses-data.ts` 或单一 `lesson-display-meta.ts` 派生，registry 只保留 `lessonKey/grade/seq`。
- 题海 / 组卷通过 `LESSONS` + `lessonModuleByKey` 动态构建 `PROBLEM_SETS`，减少 `plan/page.tsx` 手写映射。

属优化，不是去掉 legacyId 的前置条件。

---

## 5. 完整文件清单

### 必改（Phase 1–4）

```
packages/math/src/utils/lesson-registry.ts
packages/math/src/utils/lesson-module-registry.ts
packages/math/src/utils/lesson-route-utils.ts
packages/math/src/utils/lesson-grade.ts
packages/math/src/utils/sea-data.ts
packages/math/src/index.ts
packages/math/src/components/MathWeeklyPractice.tsx
packages/math/src/utils/favorites-helpers.ts          # 随 SEA_LESSONS 验证
packages/math/src/admin/math-lesson-id-audit.ts       # Phase 5
packages/math/src/admin/MathPdfSliceMatcher.tsx
packages/core/src/type.ts                             # 注释

apps/web/src/app/math/ny/plan/page.tsx
apps/web/src/app/math/ny/quiz/page.tsx
apps/web/src/app/math/ny/quiz/[id]/page.tsx
apps/web/src/app/math/ny/quiz/[id]/print/page.tsx
apps/web/src/app/math/sea/page.tsx                    # 验证
apps/web/src/app/math/mistakes/page.tsx

docs/add-new-lesson.md
docs/add-new-lesson/registration.md
docs/add-new-lesson/routes.md
```

### 测试

```
apps/web/tests/favorites-helpers.test.ts   # 若断言了 legacy id，改为 lessonKey
```

### 不需改（确认即可）

```
apps/web/src/app/math/ny/[grade]/[seq]/**   # 动态路由已用 grade/seq
packages/math/src/components/shared/dynamic-lesson/**
packages/math/src/utils/courses-data.ts     # href 已是 canonical
```

---

## 6. 验收标准（Done 定义）

1. **`LessonEntry` 仅三字段：** `lessonKey`、`grade`、`seq`。
2. **`LESSON_MODULES` 键为 `lessonKey`**，无 `slug` / `legacyId` 字段。
3. **题海、周计划、组卷、收藏** 的讲次 id 均为 `lessonKey`。
4. **无运行时 API** 接受或解析 legacyId（`52`、`lesson52`）。
5. **`lessonKeyFromProblemId`** 只处理 `{grade}-{seq}-…` 与 `…__SUMMARY`。
6. **链接** 全部为 `/math/ny/{grade}/{seq}/…`，无 `/math/ny/52`。
7. **`pnpm typecheck` + `pnpm build`** 通过。
8. **手工冒烟：** `/math/ny/2/4`、题海筛选、组卷、周计划保存、顶栏讲次切换、错题本链接。

---

## 7. 风险与回滚

| 风险 | 缓解 |
|------|------|
| DB 仍有 legacy `problem_id` | Phase 0 审计通过后再删 `migrateProblemId` |
| 周计划 JSON 内 legacy 键 | 清空 `math_weekly_plans` 或写 JSON 键迁移脚本 |
| `Number(lessonId)` 逻辑静默错误 | Phase 1 全文搜索 `Number(.*lessonId` |
| 组卷卷内存储的 lesson 引用 | 可丢弃表已清空则无影响；否则需检查 `math_quiz_papers` JSON |

回滚：按 PR 阶段 revert；DB 迁移在事务中执行，失败应 ROLLBACK。已 COMMIT 的 DB 需从备份恢复，不要靠代码双轨长期兜底。

---

## 8. 建议 PR 拆分

| PR | 内容 |
|----|------|
| PR1 | Phase 0（仅文档 + 运维记录）或运维单独执行 |
| PR2 | Phase 1 消费方（sea、plan、quiz、MathWeeklyPractice、mistakes） |
| PR3 | Phase 2–4 registry + module + grade + 删兼容 API |
| PR4 | Phase 5–6 审计工具与文档 |
| PR5（可选） | Phase 7 目录改名 |

---

## 9. 快速检索命令

```bash
# legacyId / slug 残留
rg 'legacyId|lessonBySlug|lessonByLegacy|migrateProblemId|lessonModuleBySlug|BY_LEGACY' packages/math apps/web

# 仍用 legacy 数字 id 的数据文件
rg "id: '(12|49|52|55)'" packages/math apps/web

# PROBLEM_SETS / LESSON_DATA 旧键
rg "'52':|'49':|'12':" apps/web/src/app/math

# 危险：用数字比较讲次顺序
rg 'Number\(.*lessonId' packages/math apps/web
```

---

*文档版本：2026-07-07 · 与 `feat/refactorid` 路由重构配套*
