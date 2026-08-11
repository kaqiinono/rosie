---
name: add-stage
description: Use when the user wants to add a brand-new English vocabulary stage (4B, 4C, 5A, ...) to the Rosie platform and provides a source PDF flashcard file or xlsx/md/txt with the words. Architecture is DB-only — primary deliverable is two SQL scripts that load Supabase word_entries; an english-data-{stage}.ts backup file is also generated. Guarantees zero word/field omission, parallelizes via 6 subagents per phase.
version: 2.1.0
trigger: /add-stage
---

# /add-stage — 新增英语单词阶段

用法：`/add-stage <STAGE> <source-file-path>`
示例：`/add-stage 4C docs/4C.pdf`

## 架构前提（必读，2026-06-08 后生效）

Rosie 英语词库是 **DB-only**：
- **Supabase `word_entries` 表是单一真相**——所有用户在所有设备上的数据都从这里读
- **`packages/english/src/utils/english-data.ts` + `english-data-4b.ts` ... 是离线备份**——runtime 完全不引用（`phonics.ts` / `english-helpers.ts` 的 `KW_MAP` / `SYLLABLE_MAP` 兜底已在 2026-06-08 移除）。只有 `/admin/word-audit` 把这些 .ts 当作"文件"来对比 DB
- **`useWordData.ts` 没有 seed 分支**——新 stage 数据**只能**通过 SQL 直接写 DB，写文件没用

DB schema 关键事实：
- 唯一约束：`UNIQUE (unit, lesson, word, stage)`（约束名 `word_entries_business_key`）
- `syllables` 列：**`jsonb`**（不是 text[]）
- `keywords` 列：**`jsonb`**
- `creator` 列：必填 UUID，对应 `auth.users.id`

## 本 skill 产出 3 个文件

| 文件 | 作用 |
|---|---|
| `packages/english/src/utils/english-data-{stage}.ts` | 离线备份 / 版本控制 / 灾难恢复 |
| `docs/{stage}-upsert.sql` | 灌入 word_entries 基础字段（stage/unit/lesson/word/explanation/ipa/example/chinese_def） |
| `docs/{stage}-update-maps.sql` | UPDATE syllables + keywords 两个 jsonb 列 |

---

## 第零步：读现状

读取以下文件校准格式（**不要读其他 stage 的代码**）：

1. `packages/core/src/type.ts` — `WordEntry` 接口
2. `packages/english/src/utils/english-data.ts` 头部 50 行 — 确认 `_RAW_WORDS` 对象写法
3. `packages/english/src/utils/english-data-4b.ts`（如已存在） — 当作格式样板
4. `packages/english/src/hooks/useWordData.ts` — 确认仍然 DB-only（应没有 seed-from-SAMPLE_WORDS 分支）

---

## 第一步：全量提取源文件（零截断）

### PDF（牛津 flashcard 样式）

布局：page N = 12 个 definition 卡（6 行 × 2 列）；page N+1 = 对应 word 卡（含 "Unit X Lesson Y Target/Context/Extension Vocabulary"）。**注意 word 页和 definition 页是镜像配对**——word 卡的 L1 对应 definition 卡的 R1，依此类推。

```
对每一页 1..N（每次 ≤ 20 页）：
  Read(pdf, pages: "X-Y")
  按镜像配对 word ↔ definition
  记录 (word, unit, lesson, explanation)
```

**绝对禁止只读前几页就开始处理。** 即使 40+ 页也必须分段读完。

### xlsx

```bash
node -e "const x=require('xlsx');const wb=x.readFile('docs/X.xlsx');for(const n of wb.SheetNames){console.log(JSON.stringify(x.utils.sheet_to_json(wb.Sheets[n]),null,2))}"
```

期望列：`Stage / Unit / Lesson / 单词 / 释义 / 音标 / 例句`（同 `layout.tsx` 导出表头）。

### md / txt

`Read` 全文，按文档自身格式解析。

**关于 Target / Context / Extension 分类**：PDF 标了但 `WordEntry` 没对应字段 → 直接丢弃。

---

## 第二步：清点 + 用户人工确认（强制 checkpoint）

输出按 Unit/Lesson 分组的清单（含每个 Unit/Lesson 词数 + 全部 word 列表 + 总数），然后问用户："共 X 词，确认无误吗？"

**不要跳过这一步**——这是"数据未遗漏"的人工兜底。

---

## 第三步：DB 预检（约束 + 已有数据）

```sql
-- 跑这个让用户在 Supabase 确认
SELECT COUNT(*) FROM word_entries WHERE stage = '<STAGE>';
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
  WHERE conrelid = 'word_entries'::regclass AND contype = 'u';
```

- 第一查询 = 0 → 干净
- 第一查询 > 0 → 停下问用户：覆盖、追加、终止？默认**不要覆盖**
- 第二查询应该看到 `word_entries_business_key UNIQUE (unit, lesson, word, stage)`。如果没有，告诉用户先建：
  ```sql
  ALTER TABLE word_entries ADD CONSTRAINT word_entries_business_key UNIQUE (unit, lesson, word, stage);
  ```

---

## 第四步：阶段 1 内容生成（6 个并行 subagent）

把第二步的清单存到 `/tmp/<stage>/inputs/unit-{N}.txt`（一行一个 word，格式 `word || explanation`）。

派 6 个 `general-purpose` subagent 并行（在**同一个消息**里发 6 个 Agent tool calls 才能并行），每个负责一个 Unit。

Subagent 任务：为每个 word 生成 `ipa`、`example`、`chineseDef`。完整 prompt 模板（关键 hard rules 节选）：

```
HARD RULES:
- Copy `word` VERBATIM with spaces/punctuation/parens (e.g. "Hang on!", "blog (verb)", "shopping centre (AmE shopping center)")
- Copy `explanation` VERBATIM, character-for-character
- `example` MUST contain the word (any inflection OK)
- `example` 6–15 words, 7-year-old scene (school/family/home/playground/animals/food/holidays)
- `example` MUST match the sense in the explanation (e.g. "active" U7L1 = active volcano, NOT energetic person)
- `ipa` MUST be British English, wrapped in /.../
- `chineseDef` Simplified Chinese, "义项1；义项2" with 半角分号
- Output: ```json fenced single object with `entries[]` + `chineseDefs{}`
```

把 6 个 subagent 输出存到 `/tmp/<stage>/all.json`（合并 entries + chineseDefs）。

---

## 第五步：阶段 2 元数据生成（再 6 个并行 subagent）

为每个唯一 word 生成 `syllables` 和 `keywords`。

**去重**：跨 Unit 重复的 word（如 4B 的 `opinion` 在 U9L3 + U12L1 都有）→ 让最先出现的 Unit 处理，后面的 Unit 跳过。

**强制依据两份规则文档**（2026-06-08 后生效）。Subagent 必须先 `Read` 这两份文档，再生成：
- `docs/rules/phonics_rules.md` — 自然拼读音节划分规则（开/闭音节、元音组合、R 控元音、辅音组合/丛、魔力 E、特殊后缀、静音字母、9 步流程）
- `docs/rules/VOCABULARY_KEYWORD_GUIDE_1.md` — 关键字提取清洗规则（去外壳、去占位词、并列精简、词性对齐、保留否定）

Subagent 任务关键规则：

```
1. syllables: 全小写 string 数组
   严格遵循 docs/rules/phonics_rules.md 的「四、音节划分规则」和「六、9 步流程」：
   - 特殊后缀整体不拆开：na·tion / pic·ture / de·li·cious / con·scious / am·bi·tious
   - 元音组合/R 控元音/魔力 E 当一个音节单位
   - 辅音组合（ch/sh/th/ph/ng/ck/tch/dge）和辅音丛（bl/cl/str/scr ...）整体不拆
   - 单辅音夹在两元音间 → 随后面音节（开音节优先）：o·pen, ba·by
   - 双辅音 → 各归一个音节：but·ter, hap·pen

   多词/特殊形式处理：
   - 多词短语：每个词独立拆，拼起来  "national park" → ["na","tion","al","park"]
   - 带括号：跳过括号内（"blog (verb)" → ["blog"]）
   - 带 AmE 等替代拼写：只拆英式
     "neighbourhood (AmE neighborhood)" → ["neigh","bour","hood"]
   - 带斜杠：当作空格 ("turn left/right" → ["turn","left","right"])

2. keywords: [phrase, color-class] 元组数组
   严格遵循 docs/rules/VOCABULARY_KEYWORD_GUIDE_1.md：
   - 去外壳：删除开头的 to / making you / is the act of / used to describe / (of a person) /
             feeling... / being... / having... / the quality of...
   - 去冠词：删除名词开头的 a / an / the
   - 去占位词：删除 something / someone / somebody / a person / somewhere（核心动宾保留）
   - 去次要从句：when... / if... / especially... / because... 引导词去掉，仅保留核心
   - 并列精简：or / and / ; 连接的近义词只保留第一个；多场景并列合并简化
   - 必须保留否定：not / without / unable to / fail to → 保留否定逻辑或转反义词
   - 词性对齐：动词→[动词+介/副] 或 [动词+宾]；形容词→[副词+形] 或 [核心形]；名词→[修饰+名]
   - 1–2 对：第一对必 kw-red（核心），第二对（可选）kw-gold（补充）
   - 3–6 词为佳
   - phrase **可以是清洗后的改写**，不必是 explanation 的 verbatim 子串
     （但要保留核心语义，便于 UI 高亮匹配时做模糊匹配）

OUTPUT: { "syllables": {...}, "keywords": {...} }
```

存到 `/tmp/<stage>/maps/unit-{N}.json`。

---

## 第六步：合并 + 校验（Python 脚本）

写一个 `/tmp/<stage>/merge.py` 做：

1. 读所有 unit-*.json 合并
2. 校验：
   - entries 数 = 第二步用户确认的数
   - 每个 word 在 chineseDefs 都有 key
   - 每个唯一 word 在 syllables / keywords 都有 key
   - keywords 的 phrase **不应**以 `a ` / `an ` / `the ` / `to ` 开头（违反 VOCABULARY_KEYWORD_GUIDE_1.md 第一节清洗规则）
   - keywords 的 phrase **不应**包含 `something` / `someone` / `somebody` 这类占位词
   - 没有 (unit, lesson, word) 重复
3. 输出 3 个产物：

### 6a. `packages/english/src/utils/english-data-{stage}.ts`

仿 `english-data-4b.ts` 结构。Python 生成，不手写：

```ts
import type { WordEntry } from './type'

/**
 * {STAGE} vocabulary backup — N words across Units X–Y.
 * Generated YYYY-MM-DD from docs/{STAGE}.pdf.
 * NOT imported by runtime code (DB is canonical).
 */
const _RAW_WORDS_{STAGE}: WordEntry[] = [...]

export const SYLLABLE_MAP_{STAGE}: Record<string, string[]> = { ... }
// ⚠️ key 必须是 word.toLowerCase()（匹配 phonics.ts:104 的查询写法）

export const KW_MAP_{STAGE}: Record<string, [string, string][]> = { ... }
// key 与 word 完全一致

export const CHINESE_DEF_MAP_{STAGE}: Record<string, string> = { ... }

export const SAMPLE_WORDS_{STAGE}: WordEntry[] = _RAW_WORDS_{STAGE}.map(w => ({
  ...w,
  chineseDef: CHINESE_DEF_MAP_{STAGE}[w.word] ?? undefined,
  syllables: SYLLABLE_MAP_{STAGE}[w.word.toLowerCase()] ?? undefined,
  keywords: KW_MAP_{STAGE}[w.word] ?? undefined,
}))
```

### 6b. `docs/{stage}-upsert.sql`

**用 DELETE + INSERT，不用 ON CONFLICT**（更稳，不依赖约束顺序，且写出来更易读）：

```sql
BEGIN;
DELETE FROM word_entries WHERE stage = '{STAGE}';
WITH me AS (
  SELECT id FROM auth.users WHERE email = 'YOUR_LOGIN_EMAIL_HERE' LIMIT 1
)
INSERT INTO word_entries
  (creator, stage, unit, lesson, word, explanation, ipa, example, chinese_def)
SELECT me.id, d.stage, d.unit, d.lesson, d.word, d.explanation, d.ipa, d.example, d.chinese_def
FROM me, (VALUES
  ($$4C$$, $$Unit X$$, $$Lesson Y$$, $$word$$, $$explanation$$, $$/ipa/$$, $$example$$, $$chinese$$),
  ...
) AS d(stage, unit, lesson, word, explanation, ipa, example, chinese_def);
COMMIT;
```

关键点：
- `$$...$$` dollar quoting，字符串里有 `'` 或 `"` 都不用转义
- `WITH me AS (...)` 自动查用户 UUID，用户只需替换邮箱
- 单事务，要么全成功要么全回滚

### 6c. `docs/{stage}-update-maps.sql`

**两列都是 jsonb，不要用 text[]**：

```sql
BEGIN;
UPDATE word_entries AS w
SET syllables = d.syl, keywords = d.kw
FROM (VALUES
  ($$word$$, '["a","b","c"]'::jsonb, '[["phrase","kw-red"]]'::jsonb),
  ...
) AS d(word, syl, kw)
WHERE w.stage = '{STAGE}' AND w.word = d.word;
COMMIT;
```

---

## 第七步：交付给用户

输出 3 件套：
1. 备份文件已写在 `packages/english/src/utils/english-data-{stage}.ts`
2. **让用户先跑** `docs/{stage}-upsert.sql`（替换邮箱后）
3. **再跑** `docs/{stage}-update-maps.sql`

每跑完一个 SQL 给一条验证 SQL：

```sql
-- upsert 后
SELECT COUNT(*) FROM word_entries WHERE stage = '{STAGE}';  -- 期望: N

-- update-maps 后
SELECT 
  COUNT(*) FILTER (WHERE syllables IS NOT NULL) AS has_syl,
  COUNT(*) FILTER (WHERE keywords  IS NOT NULL) AS has_kw,
  COUNT(*) AS total
FROM word_entries WHERE stage = '{STAGE}';
-- 期望: 三个都等于 N
```

最后让用户跑 `/admin/word-audit` 对账，理想结果：
- 文件行数 vs DB 行数：备份文件 N / DB N ✓
- 字段缺失：0 ✓
- DB 多余：0（或历史 Excel 导入残留）

---

## Common Mistakes（高频踩坑）

| 错误 | 后果 | 正确做法 |
|---|---|---|
| 只读 PDF 前几页就生成 | 漏一半以上的词 | 严格按 pages 参数读完全部页 |
| 写到 `english-data.ts` 而不是 `english-data-{stage}.ts` | 污染 4A 的"备份样板"文件 | 严格新建 `english-data-{stage}.ts` |
| 想改 `useWordData.ts` 来支持新 stage | 它已经是 DB-only 通用代码，不需要改 | 不要改 |
| SQL 用 `ON CONFLICT (unit,lesson,word,stage)` | 历史上 schema 可能没这个约束 / 命名不同 | 用 DELETE + INSERT 模式 |
| `syllables = ARRAY[...]::text[]` | 列实际是 jsonb，类型不匹配报错 | 两列都用 `'[...]'::jsonb` |
| `word` 字段去空格/标点 | 主键失配 | 逐字照抄 `"Hang on!"` / `"blog (verb)"` |
| `SYLLABLE_MAP` 的 key 没小写 | `phonics.ts:104` 用 `word.toLowerCase()` 查不到 | 必须 lowercase |
| `keywords` 短语带前导 `a / an / the / to` 或 `something / someone` | 违反 VOCABULARY_KEYWORD_GUIDE_1.md 清洗规则 | 严格按规则清洗后再写入 |
| `syllables` 不分特殊后缀（如把 `na-tion` 拆成 `nat-ion`） | 违反 phonics_rules.md 标注优先级 | 特殊后缀整体不拆开 |
| 把 `chineseDef` / `syllables` / `keywords` 写进 `_RAW_WORDS` 对象 | 被 SAMPLE_WORDS 的 spread 派生覆盖为 undefined | 只写进对应的独立 Map |
| 例句不含 word 本身 | 学习场景下学生看不到用法 | 例句必须出现 word 的某种形态 |
| 没去重跨 Unit 重复 word 就调 subagent 生成 syllables/keywords | 两个 subagent 给同一 word 不同输出，合并冲突 | 第五步去重，让最先出现的 Unit 处理 |
| 跳过第二步用户确认 | 漏了词都不知道 | 强制 checkpoint，不能跳 |
| 写完 SQL 就告诉用户"完成" | 用户没跑 SQL，DB 没变化 | 必须明确指引"先跑 upsert 再跑 update-maps，每步验证" |

---

## Red Flags — 停下重新评估

如果你正想这样做，立刻停：

- "PDF 太长，前 10 页采样应该够" → 错，必须读完全部页
- "把 chineseDef 顺手合进 _RAW_WORDS 更利索" → 错，会被派生覆盖
- "写到 english-data.ts 末尾比新建文件简单" → 错，污染备份样板
- "ON CONFLICT 在 useWordData 里见过，肯定可以用" → 错，DB 约束可能没建好；DELETE+INSERT 总是安全
- "syllables 是字符串数组，肯定用 text[]" → 错，DB 列是 jsonb
- "用一个大 subagent 一次生成所有数据" → 错，6 个并行更快、单 subagent 也不易超字符上限
- "顺便改下 useWordData 让新 stage 自动 seed" → 不要，DB-only 的设计就是禁止 seed
- "顺便改下 4A 某个词的 explanation" → 不要，本 skill 严格只追加

---

## 数据完整性兜底：`/admin/word-audit`

灌完两个 SQL 后，让用户登录 → 访问 `/admin/word-audit` → 点"开始对账"。逐项检查：

- 按 stage 分布表：新 stage 行的"文件"=备份文件的 entries 数；"DB"=该 stage 的 DB 行数；两者应相等
- "DB 缺失行" = 0
- "字段缺失" = 0（每个 chineseDef / ipa / example / syllables / keywords 都有）
- "DB 多余行" = 历史 Excel 导入残留（与本次无关）

任何不为 0 的项都要排查回灌。
