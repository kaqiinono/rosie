在 `src/utils/reading-data.ts` 的 `readingPassages` 数组里追加一篇新的课文。**所有阅读相关组件**（PassageView、WordPopup、ParagraphRecallQuiz、Type D 题型）都从这个文件按 `(unit, lesson)` 取数据，**只改数据、不动组件**。

## 前置条件

用户至少必须提供：
1. **课文文本**（贴在对话里 / 放在 `docs/<KEY>.md`）
2. **课次** — 例如 "Unit 6 Lesson 1"

如果两项之一缺失，**先问用户**，不要猜。可选：`title`（不给就从课文首句里挑一个）。

## 执行步骤

### 1. 找到这一课的全部单词
```
grep -n '"Unit X"' src/utils/english-data.ts  # 替换 X 为实际数字
```
列出所有 `word` 值。**特别标注多词短语**（如 `nature reserve` / `boarding school` / `in the wild` / `time off`）—— 这些需要在课文里逐字出现才能高亮。

### 2. 清理课文文本

源文本（尤其是 transcript）经常有：
- 句子中间断行 → 重新合并
- 数字写成英文 ("one thousand one hundred hectare") → 改成 "1,100 hectare"
- 不一致的大小写 ("southern cross" / "Southern Cross") → 统一

整理成 **4–6 段**结构清晰的段落。

### 3. 核对单词在课文中的出现情况

对每个 vocab 词跑一遍：
- 多词短语必须**逐字出现**（"nature reserve" 必须以这种形式出现，"nature... reserve" 不行）
- 单词的复数形式（`exam` → `exams`、`friendship` → `friendships`）自动匹配，**不需要**为复数特别处理课文
- 词形变体（`solve` → `solutions`、`care` → `caring`）**不会自动匹配** —— 这些词不会被高亮，但仍出现在底部 pill 条里。这是预期行为，不要试图修正

如果重点词在课文里完全不出现，向用户报告（可能需要换一篇课文）。

### 4. 追加到 readingPassages

在 `src/utils/reading-data.ts` 的 `readingPassages` 数组里加一项：

```ts
{
  key: 'u6l1',                  // 短 slug，小写无空格
  unit: 'Unit 6',               // 必须与 english-data.ts 完全一致（带空格）
  lesson: 'Lesson 1',           // 必须与 english-data.ts 完全一致（带空格）
  title: 'A School on a Nature Reserve',
  paragraphs: [
    '第一段...',
    '第二段...',
    // 4–6 段
  ],
},
```

**unit/lesson 字符串必须和 `english-data.ts` 一字不差**（包括空格）—— `'Unit 6'` 而不是 `'Unit6'`，`'Lesson 1'` 而不是 `'Lesson1'`。

### 5. 验证

```
pnpm lint                       # 必须 0 errors（warnings 可忽略）
pnpm dev                        # 启动开发服务器
```

打开 `http://localhost:3000/english/words/reading/<key>`，确认：
- [ ] 标题正确显示
- [ ] 大部分（>80%）lesson words 在文中被高亮
- [ ] 多词短语作为**一个** pill 高亮，没有被拆成两个
- [ ] 底部"本课词汇"pill 条列出完整词表
- [ ] 点击任意高亮词弹出包含 IPA / 释义 / 课文原句的卡片

## 触发 Type D 题型 / Today 入口的额外步骤

阅读页本身不需要任何额外配置即可访问。但如果要让：
- 单词卡正面显示"📖 课文原句"区块
- 练习里出现 Type D 课文语境填空
- Today 页出现"📖 建议先读课文"入口

用户需要在**周计划创建**时把这一课标 ⭐ 重点（计划 → 选课 → ⭐）。这会写入 `WeeklyPlan.focusLessonKey`，其他三个模块都根据这个字段决定是否启用上述功能。

如果用户只想测试阅读页本身，可以跳过这步。

## 用户提供的补充信息

$ARGUMENTS
