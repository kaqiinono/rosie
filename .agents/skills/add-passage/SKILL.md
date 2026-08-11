---
name: add-passage
description: Append a new reading passage to the Rosie English reading module — adds one entry to the readingPassages array in packages/english/src/utils/reading-data.ts (data only; all reading components read from it by (unit, lesson)). Use when the user provides passage text + a lesson key to add a 课文.
version: 1.0.0
trigger: /add-passage
---

# /add-passage — 新增阅读课文

在 `packages/english/src/utils/reading-data.ts` 的 `readingPassages` 数组里追加一篇新的课文。**所有阅读相关组件**（PassageView、WordPopup、ParagraphRecallQuiz、GlossaryPopup、Type D 题型）都从这个文件按 `(unit, lesson)` 取数据，**只改数据、不动组件**。

## 前置条件

用户至少必须提供：
1. **课文文本**（贴在对话里 / 放在 `docs/<KEY>.md`）
2. **课次** — 例如 "Unit 6 Lesson 1"

如果两项之一缺失，**先问用户**，不要猜。可选：`title`（不给就从课文首句里挑一个）。

## 推荐的文档格式

如果用户用 `docs/<KEY>.md` 提供课文，推荐三段式结构：

```markdown
# CONTENT
<课文文本，多段用空行分隔。dialogue 可以保留 **Speaker:** 标记>

# 超纲词汇
word1 /ipa/ 释义：n. 中文释义
word2 /ipa/ 释义：v. 中文释义

## 专有名词（了解即可）
ProperName1：中文释义
ProperName2：中文释义
```

解析规则：
- **`# CONTENT` 段** → 填入 `paragraphs` 数组
- **`# 超纲词汇` 顶层条目** → 进 `glossary`，`category: '超纲词汇'`
- **`## 专有名词` 子条目** → 也进 `glossary`，`category: '专有名词'` + `isProperNoun: true`

`# 超纲词汇` 和 `## 专有名词` 是相对于 `reading-data.ts` 中 lesson 主词表**独立的辅助词表**，专门给"读得磕巴但不需要背"的词做in-passage查词支持。它们不参与 mastery / 回想 / 前测，只在课文里画灰色虚线下划线 + 顶部「📒 难点词」面板里分组列出。

## 执行步骤

### 1. 找到这一课的全部单词
```
grep -n '"unit": "Unit X"' packages/english/src/utils/english-data.ts  # 替换 X 为实际数字
```
列出所有 lesson 对应的 `word` 值。**特别标注多词短语**（如 `nature reserve` / `boarding school` / `in the wild` / `time off`）—— 这些需要在课文里逐字出现才能高亮。

### 2. 清理课文文本

源文本（尤其是 transcript）经常有：
- 句子中间断行 → 重新合并
- 数字写成英文 ("one thousand one hundred hectare") → 改成 "1,100 hectare"
- 不一致的大小写 ("southern cross" / "Southern Cross") → 统一
- Dialogue 里 `**Angela:**` 之类的 markdown 标记 → 保留 "Angela:" 文本形式（去掉 **）

整理成 **4–6 段**结构清晰的段落。Q&A dialogue 可以按"一问一答 = 一段"或"相关主题合并"组织。

### 3. 核对单词在课文中的出现情况

对每个 vocab 词跑一遍：
- 多词短语必须**逐字出现**（"nature reserve" 必须以这种形式出现，"nature... reserve" 不行）
- **常见英语变体会自动匹配**:
  - 复数 `-s` / `-es`: `exam` → `exams`、`box` → `boxes`
  - 第三人称 `-s`: `walk` → `walks`
  - 过去式 `-ed`: `interview` → `interviewed`、`solve` → `solved`(silent-e 自动处理)
  - 进行时 `-ing`: `interview` → `interviewing`、`solve` → `solving`
  - `-y → -ies / -ied`: `try` → `tries` / `tried`
- **不会**自动匹配:
  - 辅音重写形式: `run` → `running`、`swim` → `swimming`
  - 名词派生: `solve` → `solution`、`care` → `careful`
  - 派生名词/形容词: `act` → `active`、`interest` → `interesting`(*实际能匹配,因为 `interest` + `-ing` 走简单后缀*)

如果**所有**重点词在课文里完全不出现，**向用户报告**（可能 dialogue 课文 vocab 是动词不同形式，或词汇要在课文之外教）。不阻塞继续,但要让用户知道。

### 4. 解析 glossary 数据

把 `# 超纲词汇` + `## 专有名词` 转成 `glossary` 数组。每个条目至少要 `word`、`meaningCn`、`category`。鼓励补 `meaningEn`(短句英文释义) 和 `ipa`(若文档没给则查英汉词典或留空)。

```ts
{
  word: 'advert',
  ipa: '/ˈædvɜːt/',
  meaningCn: 'n. 广告',
  meaningEn: 'a short notice promoting a product, job, or service',
  category: '超纲词汇',                  // 来自 # 超纲词汇 顶层
},
{
  word: 'Silva',
  meaningCn: '席尔瓦（学校的名字）',
  meaningEn: 'the name of the school in this passage',
  category: '专有名词',                  // 来自 ## 专有名词 子节
  isProperNoun: true,                    // 重要:专有名词必须打 true
},
```

如果用户引入了**新的 category 字符串**（比如 "动植物与自然"、"户外活动与地理计量"），同时**也要去更新** `packages/english/src/components/reading/GlossaryPanel.tsx` 顶部的 `CATEGORY_EMOJI` 映射，给新 category 配一个 emoji，否则会 fallback 到 `📁`。

### 5. 追加到 readingPassages

在 `packages/english/src/utils/reading-data.ts` 的 `readingPassages` 数组里加一项：

```ts
{
  key: 'u6l1',                  // 短 slug,小写无空格
  unit: 'Unit 6',               // 必须与 english-data.ts 完全一致(带空格)
  lesson: 'Lesson 1',           // 必须与 english-data.ts 完全一致(带空格)
  title: 'A School on a Nature Reserve',
  paragraphs: [
    '第一段...',
    '第二段...',
    // 4–6 段
  ],
  glossary: [                   // 没有难点词的课文可省略此字段
    // 超纲词汇 + 专有名词 entries
  ],
},
```

**unit/lesson 字符串必须和 `english-data.ts` 一字不差**（包括空格）—— `'Unit 6'` 而不是 `'Unit6'`，`'Lesson 1'` 而不是 `'Lesson1'`。

### 6. 验证

```
pnpm lint                       # 必须 0 errors(warnings 可忽略)
pnpm dev                        # 启动开发服务器
```

打开 `http://localhost:3000/english/words/reading/<key>`，确认：
- [ ] 标题正确显示
- [ ] 标题卡顶部出现「📋 前测」+ (如果有 glossary) 「📒 难点词 N」芯片
- [ ] 大部分（>80%）lesson words 在文中被彩色胶囊高亮(若全部未出现见 step 3 说明)
- [ ] 多词短语作为**一个** pill 高亮，没有被拆成两个
- [ ] 课文里 glossary 词被灰色虚线下划线标注（专有名词额外 italic）
- [ ] 点击灰色虚线词弹出难点词卡(EN/中 双语释义 + IPA + 🔊)
- [ ] 点击「📒 难点词」芯片展开分组面板(按 category 分组,每组带 emoji)
- [ ] 点击「📋 前测」芯片打开本课词汇+挖空填词题

## 触发 Type D 题型 / Today 入口的额外步骤

阅读页本身不需要任何额外配置即可访问。但如果要让：
- 单词卡正面显示"📖 课文原句"区块
- 练习里出现 Type D 课文语境填空
- Today 页出现"📖 建议先读课文"入口

用户需要在**周计划创建**时把这一课标 ⭐ 重点（计划 → 选课 → ⭐）。这会写入 `WeeklyPlan.focusLessonKey`，其他三个模块都根据这个字段决定是否启用上述功能。

如果用户只想测试阅读页本身，可以跳过这步。

## 用户提供的补充信息

$ARGUMENTS
