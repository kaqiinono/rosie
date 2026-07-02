# 语文模块（@rosie/chinese）—— 设计稿

- 日期：2026-07-01
- 教材首批范围：**一年级下册**（部编版 2022 修订）
- 数据草稿：`docs/chinese/g1b/`（待 review）
- 状态：**Phase 1 MVP + DB 字表已接入**（需在 Supabase 执行建表 + upsert SQL 后联调）

## 背景与目标

Rosie 已有英语（词库 + 阅读）、数学（按课）、口算（熟练度关卡）。新增 **语文模块**，目标：

1. 掌握课本**生字**（认读 410）与**会写字**（200）
2. 掌握**日积月累**（古诗、成语、谚语、名言等）
3. 掌握**古诗词背诵**（课文 3 首 + 园地 4 首）

设计原则：**课文驱动**，与学校进度一致；复用 `@rosie/core` 的 `masteryUtils` 间隔复习；接入 `/today` 周计划。

## 教材结构分析（一年级下册）

### 单元

8 单元，**识字单元**（一、五）与 **阅读单元**（二、三、四、六、七、八）交替：

| 单元 | 类型 | 课文 |
|------|------|------|
| 一 | 识字 | 春夏秋冬、姓氏歌、小青蛙、猜字谜 + 园地一 + 快乐读书吧 |
| 二 | 阅读 | 热爱中国共产党、吃水不忘挖井人、我多想去看看 + 园地二 |
| 三 | 阅读 | 小公鸡和小鸭子、树和喜鹊、怎么都快乐 + 园地三 |
| 四 | 阅读 | **静夜思**、夜色、端午粽 + 园地四 |
| 五 | 识字 | 动物儿歌、古对今、操场上、人之初 + 园地五 |
| 六 | 阅读 | **古诗二首**（池上、小池）、浪花、荷叶圆圆、要下雨了 + 园地六 |
| 七 | 阅读 | 文具的家、一分钟、动物王国开大会、小猴子下山 + 园地七 |
| 八 | 阅读 | 棉花姑娘、咕咚、小壁虎借尾巴 + 园地八 |

### 三类字词（不可混为一谈）

| 类别 | 规模 | 来源 | 学习要求 |
|------|------|------|----------|
| **认读生字** | 410 | 识字表 | 认字、读拼音 |
| **会写生字** | 200 | 写字表 | 笔顺 + 书写 + 认读 |
| **词语词组** | 每课若干 | 「读一读，记一记」 | 识记、填空 |

**关键发现：** 同课 **写字表字未必出现在识字表**（如《春夏秋冬》识字表为「霜吹落降飘游池入」，写字表为「春冬吹花飞入」——「春」「冬」「花」「飞」为复习字）。数据层必须 **分课维护 `recognize[]` + `write[]`**（见 `lesson-chars.ts`），字库再合并去重。

### 语文园地

每单元固定板块，需作为 **独立内容类型** 入库：

| 板块 | 实现优先级 | 说明 |
|------|------------|------|
| 识字加油站 | P1 | 扩展生字，进识字测验 |
| 字词句运用 | P1 | 偏旁归类、形近字、选字填空 → Quiz |
| 书写提示 | P2 | 笔顺规则文案 + 例字 |
| 日积月累 | P1 | 见下表 |
| 口语交际 | 不做 | 难自动化，保留教材说明 |
| 和大人一起读 | P3 | 可当扩展阅读 |

### 日积月累子类型

| 园地 | 类型 | 内容 | 题型 |
|------|------|------|------|
| 一 | 古诗 | 春晓 | 听读 → 填空 → 背诵 |
| 二 | 古诗 | 寻隐者不遇 | 同上 |
| 三 | 古诗 | 赠汪伦 | 同上 |
| 四 | 四字词语 | 尊老爱幼、其乐融融…（8 条） | 释义 / 语境选择 |
| 五 | 歇后语 | 芝麻开花—节节高…（3 条） | 上下句配对 |
| 六 | 谚语 | 朝霞不出门…（4 条） | 情境选择 |
| 七 | 名言 | 不知则问…（3 条） | 出处 / 含义选择 |
| 八 | 古诗 | 画鸡 | 背诵流程 |

### 古诗词（7 首）

| 来源 | 诗名 | 背诵要求 |
|------|------|----------|
| 第四单元 课 7 | 静夜思 | 课文级 · 必背 |
| 第六单元 课 10 | 池上、小池 | 课文级 · 必背 |
| 园地一/二/三/八 | 春晓、寻隐者不遇、赠汪伦、画鸡 | 园地级 · 积累背 |

---

## 总体架构

### 包与依赖

```
packages/chinese/
├── src/
│   ├── index.ts              # barrel：入口卡片、布局组件
│   ├── chinese.css           # 田字格、笔顺动画等模块样式
│   ├── components/
│   │   ├── chars/            # 认字卡、书写、测验
│   │   ├── poems/            # 古诗听背默
│   │   ├── accumulation/     # 日积月累
│   │   └── shared/           # 单元列表、进度色块
│   ├── hooks/
│   │   ├── useCharMastery.ts
│   │   ├── usePhraseMastery.ts
│   │   ├── usePoetryMastery.ts
│   │   ├── useAccumulationMastery.ts
│   │   └── useChineseWeeklyPlan.ts
│   ├── context/
│   │   └── ChineseContext.tsx
│   └── utils/
│       ├── g1b/      # 从 docs/chinese/g1b 迁入或 re-export
│       └── chinese-helpers.ts

apps/web/src/app/chinese/**     # 薄路由壳
```

**依赖 DAG：** `chinese` → `core` / `ui` / `rewards`；可选 `player`（古诗朗读）。不依赖 english/math/calc。

`apps/web/src/app/globals.css` 增加 `@source` 扫描 `packages/chinese/src`。

### 与现有模块对照

| 能力 | 英语 | 语文（本设计） |
|------|------|----------------|
| 最小单元 | 单词 | **汉字** + **词组** |
| 掌握模型 | 认 + 拼 | **认读** / **会写** 分轨 |
| 间隔复习 | `masteryUtils` | 同 |
| 周计划 | `useWeeklyPlan` | `useChineseWeeklyPlan` |
| 错题 | `english_wrong` | `chinese_wrong_items` |
| 阅读 | Reading 三阶段 | 古诗三阶段；课文阅读 P3 |

---

## 掌握度模型

### 会写字（200）

| 维度 | 测验 |
|------|------|
| 认读 | 看字选拼音 / 听音选字 |
| 笔顺 | 动画演示 + 点按笔画序（hanzi-writer） |
| 书写 | 田字格描红（P2） |
| 组词 | 教材词组填空 |

**综合掌握：** 认读 + 笔顺 + 组词均达 stage ≥ 阈值 → 会写「熟」。

### 认读字（仅识字表、不在写字表）

只跟踪 **认读** 一维。

### 古诗

`listen` → `recite_fill`（逐句挖空）→ `recite_full` → `comprehend`（可选）

### 日积月累

按 `kind` 分支：`poem` | `idiom_4` | `xiehouyu` | `proverb` | `quote`，各用独立 quiz 组件。

复用 `@rosie/core` 的 `advanceStage` / `regressStage`，与英语/数学一致。

---

## 路由设计

| 路由 | 功能 | Phase |
|------|------|-------|
| `/chinese` | 首页：8 单元进度 + 三入口（字词 / 古诗 / 日积月累） | P1 |
| `/chinese/units/[unit]` | 单元：课文列表 + 园地 | P1 |
| `/chinese/chars` | 字库浏览（认读/会写筛选） | P1 |
| `/chinese/chars/cards` | 认字卡 | P1 |
| `/chinese/chars/quiz` | 综合测验 | P1 |
| `/chinese/chars/writing` | 笔顺书写（会写字） | P1 ✓ |
| `/chinese/phrases` | 词语练习（组词 + 读一读记一记） | P1 ✓ |
| `/chinese/poems` | 古诗列表 | P1 |
| `/chinese/poems/[id]` | 单诗学习 | P1 |
| `/chinese/accumulation` | 日积月累 | P2 |
| `/chinese/daily` | 今日任务 | P1 |
| `/chinese/wrong` | 错题本 | P2 |
| `/chinese/weekly` | 周计划设置 | P1 |

首页 `/` 或 `/today` 增加 **今日语文** 卡片（与英语/数学/口算并列）。

---

## 周计划

- **周起始：** 周四（与 english/math 一致，`getWeekStart`）
- **参数：** `newRecognizePerDay`（默认 4）、`newWritePerDay`（默认 3）、`reviewEnabled`（默认 true）
- **每日任务：**
  1. 当前课 **新认读字** N 个
  2. 当前课 **新会写字** M 个（若有）
  3. **到期复习字**（`masteryUtils`）
  4. **词组** 2 组（本课 phrases）
  5. **每周 1 首古诗** 或 **1 条日积月累** 复习

**进度门控：** 本课会写字掌握 ≥ 80% → 下一课；单元完成 → 园地复习日。

---

## 数据层（Supabase）

### 静态内容（DB-first，与英语 `word_entries` 同模式）

- **运行时：** `useChineseCharData` 读三张内容表；`localStorage` 缓存。
- **维护：** `packages/chinese/src/utils/g1b/*.ts` 为备份；改数据后跑 `pnpm --filter @rosie/chinese generate-sql` → 在 Supabase **按顺序**执行 `docs/sql/chinese-g1b/*.sql`（见该目录 README）。
- **笔顺来源：** `hanzi-writer-data`；**部首来源：** Make Me A Hanzi + 教材偏旁名称表。灌库时部首/笔顺不得为空。

```sql
-- docs/sql/chinese-char-entries.sql
chinese_char_entries (
  char_key, char, grade, semester,
  pinyin, pinyin_alt[],
  radical, radical_name,          -- NOT NULL
  stroke_count, stroke_order,     -- jsonb NOT NULL（hanzi-writer strokes + medians）
  phrases[], tiers[]
)

chinese_lessons (
  lesson_key, grade, semester, unit, lesson,
  lesson_title, lesson_kind, unit_type,
  sort_order,                     -- 课文顺序（园地 lesson=0 不能单靠 unit/lesson 排序）
  recall_phrases[]                -- 读一读记一记整句（>2 字）
)

chinese_lesson_chars (
  lesson_key, char_key, track, sort_order, pinyin_in_lesson
)
```

古诗 / 日积月累 / 单元元数据（`UNITS`）首批仍用本地 TS；字词进度与周计划已接 Supabase。

### 用户进度表

```sql
-- docs/sql/chinese-char-mastery.sql（待建）
chinese_char_mastery (
  user_id, char_key,           -- e.g. 'g1b::春'
  track,                       -- 'recognize' | 'write'
  correct, incorrect, last_seen,
  stage, next_review_date, is_hard,
  review_history jsonb,
  primary key (user_id, char_key, track)
)

-- docs/sql/chinese-phrase-mastery.sql
chinese_phrase_mastery (
  user_id, phrase_key, ...
)

-- docs/sql/chinese-poetry-mastery.sql
chinese_poetry_mastery (
  user_id, poem_id,
  recite_stage, last_recite_date, ...
)

-- docs/sql/chinese-accumulation-mastery.sql
chinese_accumulation_mastery (
  user_id, item_key, kind, stage, ...
)

-- docs/sql/chinese-weekly-plans.sql
chinese_weekly_plans (
  user_id, week_start, week_start_day,
  new_recognize_per_day, new_write_per_day,
  days jsonb, progress jsonb, ...
)

-- docs/sql/chinese-wrong-items.sql
chinese_wrong_items (
  user_id, item_key, item_type,  -- char | phrase | poem | accumulation
  wrong_kind,                    -- pinyin | stroke | phrase | recite
  resolved, ...
)
```

---

## 实现分期

### Phase 0 — 数据 review（当前）

- [x] PDF 提取草稿：`docs/chinese/g1b/`
- [ ] 人工校对拼音、识字表 410 字、补全 phrases
- [ ] 本设计稿 review

### Phase 1 — MVP（字词 + 古诗 + 周计划）

1. `packages/chinese` 脚手架 + `transpilePackages` + `@source`
2. 迁入 review 后的 g1b 数据
3. `useCharMastery`（recognize / write 分轨）
4. 认字卡 + 拼音测验 + 错题记录
5. 古诗列表 + 填空背诵
6. `useChineseWeeklyPlan` + `/chinese/daily` + `/today` 卡片
7. 首页导航入口

### Phase 2 — 书写 + 词语 + 园地

1. hanzi-writer 笔顺 + 田字格
2. phrases 测验
3. 日积月累（4 种题型）
4. 偏旁 / 形近字 quiz（园地「字词句运用」）

### Phase 3 — 扩展

1. 课文朗读（TTS）
2. 「和大人一起读」
3. 其他年级册别

---

## 关键约束

1. **不迁移其他模块路由**；`apps/web/src/app/chinese/**` 仅为薄壳。
2. **认读与会写分轨**，`lesson-chars.ts` 为周计划选题真相源。
3. **拼音多音字**需数据层支持 `pinyin: string[]`，UI 展示主读音。
4. **口语交际** 不纳入自动化测验。
5. 模块 CSS 在 `chinese.css`，Tailwind 工具类靠 `globals.css` `@source`。

---

## 测试计划（实现后）

- [ ] `pnpm --filter @rosie/chinese typecheck`
- [ ] `pnpm --filter web build`
- [ ] 认字卡：当前课生字顺序与教材一致
- [ ] 会写字在写字测验出现，认读-only 字不出现在笔顺测验
- [ ] 7 首古诗填空背诵流程
- [ ] 周计划周四切换、每日任务数量与设置一致
- [ ] `/today` 语文卡片与 `/chinese/daily` 状态同步
- [ ] 错题本：拼音错与笔顺错分轨展示

---

## 待 review 问题

1. **字库 495 vs 识字表 410：** 多出的字主要为写字表复习字（上册），是否在 UI 标「复习」？
2. **每日新字数量：** 默认 4 认读 + 3 会写是否适合 Rosie？
3. **古诗 TTS：** 先用浏览器 `speechSynthesis` 还是录音资源？
4. **MVP 是否包含园地识字加油站生字？** 建议包含（已录入 `lesson-chars`）。

---

## 参考文件

- 教材 PDF：`docs/tmp/语文一年级下册.pdf`
- 提取脚本：`docs/tmp/extract-chinese-g1b.py`
- 数据草稿：`docs/chinese/g1b/`
- 英语模块参考：`packages/english/CLAUDE.md`
- 掌握度：`packages/core/src/masteryUtils.ts`
