# @rosie/english

The English module — **vocabulary** (words) + **reading** (passages) + **grammar** (剑桥初级英语语法)
— extracted as a standalone workspace package so it can be worked on and type-checked in isolation.

**Scope rule for agents:** to change English behavior you almost always only need files in this
package. Read here first; reach into `@rosie/core` / `@rosie/ui` / `@rosie/player` / `@rosie/rewards`
only for the shared primitives below. You should not need to read other subject modules (math, calc,
audio, flipbook).

## What's inside

- **Vocabulary (`components/words/`)** — flash cards, quiz runner, spelling tiles, study/practice
  phases, daily + weekly-plan sessions, mastery panels, monster-eat error feedback, xlsx import.
  Mastery uses the spaced-repetition stage system (logic in `@rosie/core`'s `masteryUtils`).
- **Reading (`components/reading/`)** — passages with glossary/word popups, recall quizzes, and
  **their own audio** stored in `reading_passage_media` (hooks `useReadingPassageMedia` /
  `useReadingPassageAudio`). Reading playback was **decoupled from the audio module**: it builds its
  own play queue via `@rosie/player` directly, with **no ❤️ favorites / audio-collection coupling**.
  A passage may also carry optional `learningSections` for textbook comprehension, contextual
  grammar practice, vocabulary application, and guided writing. Exercise sections reuse the
  grammar `ExerciseView` engine (`fill_blank` / `multiple_choice` / `matching`) rather than
  duplicating answer checking. Existing vocabulary is referenced with the full
  `(stage, unit, lesson, word)` tuple and resolved at runtime; only out-of-library reading aids
  belong in `glossary`. Contextual grammar exercises stay separate from `grammar_mastery` and link
  to the canonical Cambridge unit through `grammarRefs`. Each grammar section also supplies a
  data-driven `summary` (cards, contrasts, decision guide, reminders); `ReadingGrammarSummary`
  must stay lesson-agnostic rather than hard-code one lesson's tense rules.
- **Grammar (`grammar/`)** — 剑桥英语语法系列（essential/intermediate/advanced，按 book 维度分书；
  目前仅 essential 入库）：内容存 Supabase jsonb，渲染层是 type → 组件注册表（未知块型降级为
  unsupported）；讲解/练习/原文三 tab + mastery 进度。详见下方 Grammar 小节。
- **`WordsContext`** — aggregates vocab (`useWordData`), mastery (`useWordMastery`), and filter
  state; all English routes consume it via `useWordsContext()`.
- **`utils/`** — `english-helpers` (`wordKey`/`shuffle`/`hilite`/`parseWordRows`; re-exports
  `getWeekStart` from `@rosie/core`), `english-data*`, `phonics`, `reading-data`
  (`readingPassages`/`buildWordMatchRegex`/`resolveMatchedWord`/`findPassage`/`parseFocusLessonKey`),
  `reading-audio-types`, weekly-plan payload/progress/report builders, `word-enrich`, `speak`.
- **Adaptive word plan (`utils/adaptivePlan*` + `components/words/AdaptivePlan*`)** — task-oriented
  Leitner 5-box plan (spec `docs/superpowers/specs/2026-07-09-adaptive-word-plan-design.md`, gitignored).
  Plan lifecycle statuses: `active` | `paused` | `completed` | `archived`. At most one `active` per
  user; admin pause/resume via `pausePlan`/`activatePlan`; create-while-active yields `paused`;
  `/today` and practice only surface `active`.
  Key semantics: `newWordsPerDay` is a **per-round batch size + daily goal** (not a hard
  ceiling — after the goal is met, another round can still pull a fresh batch to get ahead;
  unfinished same-day activations fill the batch first); box moves at settle use "wrong at
  least once this session" (→ Box 1 +
  `streakWrong++`, due today) while global mastery write-back uses the collapsed final outcome;
  Boss question pressure follows `stats.bossQuestionTier` via `bossQuizTypesForWord` (3 = floor);
  any failed Boss submission increments `bossFailStreak` (tier downgrade only < 60%). Settle does
  remote writes before local state and surfaces a「重试保存」button on failure. In-progress rounds
  are snapshotted to localStorage + `practice_pending_sessions`
  (`adaptivePlanSessionSnapshot.ts`; retained across calendar days until successful settlement or
  explicit discard, so answers survive reloads and device changes). Plan list views use the batched
  `loadProgressForPlans`. Completed rounds settle progress, mastery, exact logs, and
  `adaptive_daily_progress` atomically through `settle_adaptive_practice_round`; homepage cards
  prefer that immutable daily ledger over mutable box-state inference. **Vocab↔plan consistency is maintained at the write side**: `useWordData`'s
  `deleteWord`/`deleteStage` call `archiveAdaptiveProgressForDeletedKeys` (archives matching progress
  rows across all plans + auto-completes plans that become finishable) and `updateWord` calls
  `migrateAdaptiveProgressKey` on unit/lesson/word renames (carries progress to the new key) — both
  only fire when the key truly left the vocab (`keysRemovedFromVocab`; wordKey ignores stage) and
  never throw so word CRUD can't fail on plan cleanup. As a safety net for historical/missed orphans,
  the admin manage page still auto-detects orphaned rows and shows「清理 N 个失效词」
  (`archiveOrphanWords`) only when found. DDL lives in **`sql/adaptive-word-plans.sql`** (tracked
  mirror of the gitignored `docs/sql` copy).

## Grammar (剑桥英语语法 — 多书架构)

**布局**：`grammar/types.ts`（类型 + normalize + `GRAMMAR_BOOKS` 注册表 + `isGrammarBookId` 守卫）、
`grammar/grammar-index.ts`（全量静态索引，Phase 2 由 `--toc` 生成；为空时首页降级为仅展示 DB
已入库单元）、`grammar/hooks/`（overview / unit / mastery，均支持 book 参数）、
`grammar/components/`（GrammarBooksPage / GrammarHomePage / GrammarUnitPage / LessonView /
ExerciseView）。路由壳在 `apps/web/src/app/english/grammar/**`：`/english/grammar` 书籍列表页
（含全局检索）→ `/english/grammar/{book}` 书内单元列表 → `/english/grammar/{book}/{unit}` 单元页；
旧 URL `/english/grammar/<N>` 由 `[book]` 段重定向到 essential。

**多书维度**：`book` 列（`essential` / `intermediate` / `advanced`）已在 DB 和全链路中落地。
- `grammar_units`：复合 PK `(book, unit_number)`，每本书 unit_number 从 1 开始。
- `grammar_mastery`：复合 PK `(user_id, book, unit_number)`。
- `types.ts`：`GrammarBookId` union + `GRAMMAR_BOOKS` 常量注册表（新书只需追加条目，无需 migration）。
- hooks / CLI 均接受 book 参数，默认 `essential`。
- TOC 章节与 BACKMATTER 均按书注册（`GRAMMAR_TOC_SECTIONS_BY_BOOK` / CLI `BACKMATTER_BY_BOOK`），
  目前仅 essential 有数据；无数据的书降级为每 10 单元一组的通用分区。
- 全局检索在首页（书籍列表页）跨书执行，结果按书分区；mastery 全书合并拉取
  （map key `${book}:${unit}` 天然隔离）。
- DDL 在 `0024_add_grammar_module.sql`（建表）+ `0025_add_grammar_book_dimension.sql`（加 book 列）。

**数据流**：内容存 `grammar_units`（lesson/exercises jsonb，RLS 只读，写入走 service-role），
进度存 `grammar_mastery`（完整 RLS）。`useGrammarUnit` 用模块级缓存（key = `book:unitNumber`，
内容是全局静态数据，不用 per-user store）；overview/mastery 走 `createUserSessionStore`。

**内容提取 CLI**：`pnpm grammar:extract`（`scripts/extract-grammar-unit.mjs`）——
`--unit N` / `--range A-B` / `--book <id>` 提取（pdftoppm → qwen-vl-max → 组装 → upsert）；
`--no-upload` 只落地 `output/grammar-units/<book>/unitNNN/`；`--upload-only` 直接读 unit.json
入库；`--force` 忽略缓存。`on_conflict=book,unit_number` 幂等覆盖。
页码映射按书分文件（essential → `scripts/grammar-page-map.json`，其他书 →
`grammar-page-map-{book}.json`）；essential 缺失时用临时公式 `[19+2N, 20+2N]` 兜底，
非 essential 缺 page-map 直接报错（临时公式禁止对新书兜底）。
旧 Tesseract 脚本 `extract-grammar-pdf.mjs` 保留为 `grammar:render-pdf`。

**页码标记**：三层——单元级 `book_pages`（DB 列）、Section/练习组级 `bookPage`（渲染 p.N 角标）、
交叉引用保留原文页码。

**管理员表格编辑**：讲解区所有 `grammar_table` 对管理员显示「编辑表格」，可修改标题/表头/
单元格、增删行列，并在弹窗中实时预览。显式合并区域存入 block 的 `merges`
（`row`/`column`/`rowSpan`/`colSpan`，仅正文坐标）；字段存在时关闭旧版基于空白/重复值的
自动合并推断。`displayType` 显式控制渲染器（当前为 `standard` / `timeline`）；旧版的
“过去 / 现在 / 将来 + 空正文”表会在 normalize 时兼容识别为时间轴。保存由
`grammar-table-mutations.ts` 更新 `lesson` jsonb 并同步单元缓存。
表格内容的局部样式存入可选 `textMarks`，key 为 `title`、`header:N` 或 `body:R:C`，
范围使用纯文本字符 offset；搜索、复制、朗读仍只读 title/headers/rows 原文。编辑单元格文字时
清除该单元格的旧 mark，增删行列等结构操作则清除全表 marks，避免 offset/key 错位。

**管理员练习编辑**：练习 Tab 对管理员显示「管理练习」，点击后在当前 Tab 原地切换为编辑模式，
可新增/复制/排序/删除练习组，
编辑组编号、说明、页码，以及六种题型的题号、题干、答案、选项、关联单元；题目支持增删、
复制和排序，右侧复用 `ExerciseView` 实时预览学生端效果。保存由
`grammar-exercise-mutations.ts` 覆盖 `exercises` jsonb 并同步单元缓存。

**管理员讲解编辑**：讲解 Tab 对管理员显示「管理讲解」，编辑器按
`lesson → sections → blocks → items` 的通用数据层级展示内容。交互以练习编辑器为基准：左侧新建/复制/
排序/删除分区，中间新增和编辑各类型内容块，右侧在原书对照与 `LessonView` 实时预览间切换；内容块、
例句、缩写和拼写示例均支持新增、复制、排序和删除，表格高级编辑可在草稿内直接打开，相关单元也可维护。
`GrammarEditorShared` 提供讲解/练习共用的排序、未保存关闭保护及原书/预览面板。所有操作先作用于本地草稿，确认保存后由
`grammar-lesson-mutations.ts` 整体更新 `lesson` jsonb 并同步单元缓存；不要为特定 Unit 写删除逻辑。

**词汇清单**：`vocabulary_list` 用于原书成排罗列的单词，与 `examples` 共用
`items: GrammarExample[]`，因此管理员可在「例句列表 / 词汇清单」间无损切换。渲染时使用轻量多列清单，
不使用完整例句卡片。旧 `examples` 若包含至少 6 个不含空格的纯单词，normalize 时兼容识别为
`vocabulary_list`；之后保存讲解会固化显式类型。

**情境例句展示**：`example_set.displayType` 为 `cards` / `paragraph`。前者使用编号卡片，
后者使用单一连续阅读区，不显示编号和独立卡片。两者共用 context/items，管理员可无损切换。
旧数据若 context 恰好是 items 所有英文的重复拼接，normalize 时兼容识别为 `paragraph`，
文章渲染时也会隐藏该重复 context。
情境说明使用 `contextMarks`，每条 GrammarExample 的英文/中文/注释样式使用
`textMarks.en` / `textMarks.zh` / `textMarks.note`；所有展示类型共用这些样式元数据，不修改原文。

**规则说明状态**：`rule_text` 保持原块类型，可选 `tone` 为 `info` / `success` /
`warning` / `error`，未设置的旧数据按 `info` 渲染。四种状态使用无边框浅色背景与状态图标。
局部文字样式使用可选 `textMarks`，正文 `text` 始终保持纯文本；编辑正文时清除该块旧 marks，
避免 offset 错位。

**框架扩展四步流程**（新增内容块/题型时）：
1. `types.ts` 加 union 成员 + `normalizeBlocks`/`normalizeExercises` 分支（未知 type 自动归一为
   `unsupported`，永不崩溃）；
2. `LessonView` 的 `BlockView` 或 `ExerciseView` 加渲染分支；
3. 提取 Prompt（`scripts/extract-grammar-unit.mjs` 的 `EXTRACTION_PROMPT`）同步加块类型说明；
4. 重跑一个单元验证端到端。

## Adding phonics rules

Phonics rules live in `utils/phonics.ts` in `PH_RULES_RAW`. They're auto-sorted longest-first
(longer patterns beat shorter prefixes — add 3-letter rules before their 2-letter subsets for
readability). Categories: `ph-r` (R-controlled), `ph-digraph` (vowel combo), `ph-cluster`
(consonant combo), `ph-blend` (consonant blend), `ph-suffix`, `ph-long`, `ph-vowel`. Each
category's color is a CSS variable in this package's own `src/english.css` (`--ph-digraph`, …)
mirrored in `PHONICS_LEGEND` in `phonics.ts`. `english.css` is package-private (imported once from
`src/index.ts`) and also holds the `.ph-*`/`.kw-*` classes, the word-monster (`--wm-*`) + rescue
(`--rescue-*`) vars, the `belly-pop` keyframe, and the reading recall-quiz decorations — none of
this lives in the app's `globals.css`.

## Dependencies (the only things English imports from outside)

- **`@rosie/core`** — Supabase client, `useAuth`, shared types, constants, `masteryUtils`,
  `getWeekStart`.
- **`@rosie/ui`** — shared UI primitives.
- **`@rosie/player`** — base playback engine (reading audio) + `compressAudioToMp3`.
- **`@rosie/rewards`** — shared gamification (stars / wallet / vouchers).
- npm: `react`, `next`, `clsx`, `xlsx`, `@supabase/supabase-js`.

English must never depend on another subject-module package; `core`/`ui`/`player`/`rewards` must
never depend on English.

## Public API & convention

The package exposes a **single barrel** (`src/index.ts`) — there are no name collisions, so there is
no `/pages/*` subpath (unlike calc). Components are re-exported as **named** barrel exports
(`export { default as FlashCard }`); import them as `import { FlashCard } from '@rosie/english'`.

Imports **within** this package are **relative** (`../utils/english-helpers`, `./FlashCard`). Do not
add a path alias — Next compiles this package via `transpilePackages`.

## How it plugs into the app

Routes stay in `apps/web/src/app/english/**` (cards/daily/practice/reading/weekly/grammar + layout)
and import everything from the `@rosie/english` barrel. `reading-data` is **English-owned**; the
audio and flipbook modules consume it from `@rosie/english`.

## Commands

```bash
pnpm --filter @rosie/english typecheck
pnpm --filter @rosie/english lint
```
