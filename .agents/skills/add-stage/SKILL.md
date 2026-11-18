---
name: add-stage
description: Add or extend a Rosie English vocabulary stage such as 4C or FCE from supplied PDF, XLSX, Markdown, or text. Extract the complete source, match shared headwords and senses, and prepare or apply a reviewed incremental import.
version: 3.0.0
trigger: /add-stage
---

# 新增英语词表

用法 `/add-stage <STAGE> <source-file-path>`。课文、故事和 PET 专项题库的独立导入使用各自工作流。这里处理词表及其课程位置。

先读 [共享词库导入规范](../../../packages/english/SHARED-VOCABULARY.md) 中的「审核和导入」，以 [导入器](../../../scripts/import-reviewed-vocabulary.mjs) 的实际输入为准。共享词源保存词头、义项、用法和拼写组，`word_entries.id` 是课程位置 ID。新词表通过 `pnpm vocab:import` 发布。保留已有位置 ID 和历史引用，增量导入不得清空词表、重建旧行或直接写 `word_entries`。

## 提取和校对

- 读完整份资料，包括所有 PDF 页和 XLSX 工作表。逐行保留来源页码或工作表行号、原始拼写、释义、课次、顺序和标签。牛津 flashcard 的相邻释义页和词卡页按镜像配对，词卡左列对应释义右列，逐页核对。XLSX 可按 `Stage / Unit / Lesson / 单词 / 释义 / 音标 / 例句` 识别列，Markdown 和文本按原结构解析。
- 将 `Target / Context / Extension` 写入 `position.vocab_type`，保留作者提供的分级标签。缺少 Unit 或 Lesson 的来源使用明确说明的编排规则，保留来源顺序。每个源行都要对应一个待导入位置、一个已合并位置或一个有原因的待审项。
- 原有释义和教材例句按课程位置保留。需补充时，提供准确词性、音标、简明中文及能体现该义项的例句。教材例句宜简洁、适龄并包含该词或合法词形。需要补音节或高亮关键词时先读 [自然拼读规则](../../../docs/rules/phonics_rules.md) 和 [关键词规则](../../../docs/rules/VOCABULARY_KEYWORD_GUIDE_1.md)，元数据按实际拼写和义项校对。
- 词形按 [现有生成规则](../../../packages/english/src/utils/word-forms.ts) 审核。`position.word_forms` 在规则无法可靠覆盖时保存完整表面形式，短语保留完整短语，必要时用 `disableGenerated` 禁用错误派生。英美拼写共用合法答案时配置审核过的 `spelling.key`、`preferred`、`answers`，按适用义项和语法形式限定范围。

## 匹配共享词源

以数据库返回的词头和义项为依据。第一次预览时可用待核对清单，各行附来源和从资料提取的候选义项。

- **已有词头和义项**直接在 `senses` 引用现有已审核 `senseId`。同一词头拼写重合只用于寻找候选，核对词性、含义及用法范围后再引用。
- **已有词头、新义项或新用法**沿用词头。新义项提供结构化 `partOfSpeech` 和释义，固定用法写到 `senses[].usages`。CEFR 级别可留空；有级别时附具体义项或用法的分级依据。考试词表归属单独保留。
- **全新词头**建立课程位置和已审核义项。大小写敏感词、英美变体、带编辑标注的词头、屈折形式和同形异义先判定身份。既有词头若以资料原始拼写预览仍显示为新词，核实应关联的词头后再发布。用 `source.rawHeadword` 保留资料原文。歧义未解决的行单独待审，避免凭匹配不到就另建词头。
- 不同课重复出现的词保留各课位置。同一词表、单元、课及共享词头只保留一个有效位置，多个来源行或义项合在该位置并保留来源映射。对已经存在的课程位置，使用核实过的 `position.id`，只传有意修改的位置字段。已有词表可追加新课或补充义项，其他位置继续保留。

## 预览和发布

以已审核导入 JSON 和待审清单为主要产物。输入是数组，每项包含 `reviewed`、`source`、`position` 和非空 `senses`。为 `source.key`、`source.revision`、`source.row` 使用稳定值。沿用旧来源时，同一版本同一行的内容保持一致，修改清单时提升版本。

```bash
pnpm vocab:import --input "/absolute/path/to/reviewed.json"
```

预览后按单元和课核对源行总数、课程位置数、独立词头数，以及复用、补义项、新词头和待审数量。核对重复来源、词形、标签及引用。预览的「补义项」只是候选分类，检查现有义项后才决定补充或者改用 `senseId`。遇到待审项时，已审核清单与待审记录分开保存。

任务范围包含线上导入时，只向已确认的 Rosie 项目发布审核完成的清单。使用现有管理员 UUID 和配置。仅请求准备资料时交付清单和预览。首次或大批导入宜先用独立的小样清单对账，再使用全量清单；小样中的同源同版本同一行在全量清单中保持相同内容。

```bash
pnpm vocab:import --input "/absolute/path/to/reviewed.json" --apply --creator "<管理员 UUID>"
```

导入按来源回执分行提交。中断后先核对失败原因及已处理范围，然后用同一份清单重跑。完成后使用 `pnpm vocab:import --audit` 或读取 `vocabulary_positions` 核对目标词表的位置 ID、已审核义项和跨词表复用情况。交付时区分已提取、待审核、已预览和已入库的实际状态。
