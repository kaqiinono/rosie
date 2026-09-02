---
name: add-english-lesson
description: Add or update a complete English textbook lesson in Rosie from page images, scans, or supplied text, including passage data, stage-aware vocabulary references, reading glossary, textbook exercises, grammar summary and Cambridge links, guided writing, reading-page UI integration, tests, and documentation. Use when the user asks to 添加英文 Lesson、录入英语教材一课、把教材图片做成 Rosie 英语课程、补充 reading learningSections，或更新现有英文课的课文/词汇/语法/练习/写作内容。
---

# 添加英文 Lesson

把一课教材内容完整接入 `@rosie/english`。优先做数据录入并复用现有公共组件；仅在当前架构无法表达教材内容时扩展类型或 UI。

## 输入要求

开始前确认或从材料中可靠识别：

- stage、Unit、Lesson；
- 清晰且完整的教材图片、扫描页或文本；
- 用户是否明确要求录入听力；
- 用户希望新增课程还是修订已有课程。

缺少 stage/Unit/Lesson 或正文页时先询问，不猜课程归属。图片有裁切、模糊、缺页或前后页承接时指出缺口；不要编造不可见文本。

## 1. 保护现场并读取约定

1. 从仓库根目录运行 `git status --short` 和相关文件的 `git diff`，识别用户未提交改动。不要覆盖、回退或格式化无关文件。
2. 完整读取根 `AGENTS.md`、`packages/english/AGENTS.md`、`.agents/skills/add-passage/SKILL.md`。
3. 检查当前 `packages/english/src/utils/reading-data.ts`、阅读详情页、`ReadingLearningSections`、`ExerciseView`、相关类型、导出和测试。
4. 以 Stage 5A Unit 1 Lesson 1 的当前实现和 `apps/web/tests/reading-learning-sections.test.ts` 为完整课程范例；不要假定旧文档比当前代码更新。
5. 若数据模型、页面行为或模块约定发生变化，同步更新 `packages/english/AGENTS.md`；纯数据新增无需制造架构文档改动。

## 2. 先结构化教材，不把指令当教材

逐页识别并建立内部清单，明确区分：

- 用户指令、标注和期望；
- 课文正文及段落标题/日期；
- 本课词汇；
- 语法讲解、对比点、时间标志和教材例句；
- 阅读理解、选择、填空、连线等练习；
- 口语活动；
- 写作要求；
- 听力材料。

保留教材顺序、拼写、标点和英美变体。先完成结构化识别再编辑代码。听力默认忽略；只有用户当次明确要求时才录入或接入音频/听力内容。

### 发现新内容时形成适配闭环

教材出现当前数据模型、题型、组件或页面无法表达的新内容时，不得静默忽略、削减成错误题型或只写一次性硬编码：

1. 先确认它确属教材内容，并描述现有能力的具体缺口。
2. 优先组合现有公共能力；仍无法忠实表达时，扩展最小且可复用的数据类型、渲染、交互或判题能力。
3. 同步优化受影响的公共实现，保持向后兼容、stage-aware、移动端可用，并避免单课专用分支。
4. 为新能力补类型、导出、测试和必要的 `packages/english/AGENTS.md` 架构说明。
5. 完成实现后更新本 `add-english-lesson` skill，把已验证的新内容类型、录入规则、复用入口和验证要求沉淀进对应步骤与检查清单；若 `agents/openai.yaml` 的描述已不准确，使用 skill-creator 生成器同步刷新并重新运行 `quick_validate.py`。

只有缺少关键教材信息或扩展会改变产品范围时才暂停询问；不要因程序暂不支持而遗漏用户提供的有效教材内容。

## 3. 审计全阶段词库

1. 搜索现有 stage 的完整词库，不只检查目标 Lesson。检查静态 `english-data-*`、注册/聚合数据及当前运行时约定。
2. 现有词不得重复录入。课程内引用必须使用完整 `(stage, unit, lesson, word)`，并保证 `word` 与词库原值一致，包括括号中的英美拼写说明。
3. 只把理解课文确实需要、且全阶段词库不存在的超纲词、专名和文化词加入 `glossary`。`glossary` 只用于阅读辅助，不进入 mastery、前测或回想。
4. 专名设置 `isProperNoun: true`；提供准确的 `meaningCn`，尽量补简短 `meaningEn` 和可靠 IPA。不要为了“词表更丰富”加入普通易懂词。
5. 新增 glossary category 时检查 `GlossaryPanel` 的 emoji 映射。

## 4. 录入课文

优先遵循并复用 `$add-passage` 的清理、匹配和质量规则，但使用当前 stage-aware 架构：

- 在 `readingPassages` 中使用唯一稳定 key，推荐 `${stage.toLowerCase()}-u{N}l{M}`；
- `stage`、`unit`、`lesson` 必须与词库完全一致；
- 将真正的正文放入 `paragraphs`；
- 将日期、小标题等按索引放入 `paragraphTitles`，绝不混进段落正文；
- 保持段落边界符合教材，不为追求固定段数任意合并；
- 核对重点词和多词短语在正文中的匹配效果。

保留每段后的 `ParagraphRecallQuiz` 能力。不要在阅读详情页新增或挂载 `InlineContextPractice` / “课文语境练习”，因为它与段落回想重复。Type D 在系统其他既有练习入口继续保留，不删除其公共能力。

## 5. 录入学习区

用 `learningSections` 表达教材课后学习内容，并让页面提供“总结 / 语法 / 词汇 / 写作”tab 快速定位。UI 操作应在原页展开、切换或反馈，不默认跳转；复用现有 popup、panel、tab 和练习能力。

### 总结、词汇与教材练习

- 将阅读理解和教材练习组织为清晰的 section/group，忠实保留题意。
- 优先复用 `ExerciseView` 已支持的 `multiple_choice`、`fill_blank`、`matching`；不要另造判题、状态或反馈引擎。
- 练习引用本课词时使用 `ReadingWordRef` 完整元组，并用 `resolveReadingWordRef` 验证可解析。
- 若教材题型无法由现有引擎合理表达，先评估最小通用扩展；不要写仅服务单课的组件。
- 口语内容仅在能形成可读、可操作的原页提示时录入；不要伪造录音评测能力。

### 语法

在语法 tab 顶部提供一眼可见的归纳，至少包含：

- 本课语法是什么；
- 最重要的对比；
- 时间标志或判断线索；
- 教材原句例子。

把归纳内容写入 grammar section 的数据驱动 `summary`（cards、contrasts、decisionGuide、reminders），由通用 `ReadingGrammarSummary` 渲染。新增语法主题时补课程数据，不在组件中硬编码某一课的规则。

通过 `grammarRefs` 链接或衔接现有 Cambridge grammar units，标明 primary / foundation / extension 的角色并核对单元内容确实相关。课内语法练习使用 `learningSections` 和 `ExerciseView`；不要重复写入 `grammar_mastery`，mastery 只属于权威 Cambridge 单元。

### 写作

仅当用户材料包含写作任务时，按教材要求给出明确 prompt、引导问题、建议词和清晰可读的范文。范文应符合目标年级、覆盖教材要求、自然分段，不替学生堆砌超纲表达。材料没有写作任务时不要为了凑齐 tab 而虚构内容；学习区可只显示教材实际提供的 tab。

## 6. 集成与最小改动

1. 优先只改 `reading-data.ts` 和针对该课的数据测试。
2. 需要扩展公共类型或组件时，保持通用、stage-aware，并补齐 `packages/english/src/index.ts` 等现有导出。
3. 教材出现新内容时按“发现新内容时形成适配闭环”补充并优化程序，不以“当前不支持”为由省略。
4. 新页面路由才检查 breadcrumb；已有阅读详情页的数据接入通常不需要新路由。
5. 保留当前页面的阅读模式、`ParagraphRecallQuiz`、词汇弹层、glossary、预习和音频公共能力。
6. 遵循 Tailwind v4、移动优先、无 `any`、客户端组件标记及包依赖 DAG。

## 7. 数据质量检查

- [ ] 教材正文与用户指令已分离，页序和段落无遗漏。
- [ ] stage / Unit / Lesson / key 唯一且与词库一致。
- [ ] `paragraphTitles.length` 与需标题的段落对齐，标题未混入正文。
- [ ] 已搜索该 stage 全阶段词库，无重复词条；所有 `ReadingWordRef` 均能解析。
- [ ] glossary 只含必要的超纲词、专名和文化词，且不与全阶段词库重复。
- [ ] 选择/连线题答案存在于 options；填空答案和题干可判定；题号无冲突。
- [ ] 语法归纳含语法点、对比、时间标志、教材例句，Cambridge 引用准确。
- [ ] 课内练习未写入 `grammar_mastery`。
- [ ] 写作范文符合教材任务和学生水平。
- [ ] 没有教材写作任务时未虚构写作 section；语法总结来自课程数据而非单课组件硬编码。
- [ ] 听力仅在用户明确要求时录入。
- [ ] 每段回想保留，阅读详情页没有额外 `InlineContextPractice`。
- [ ] tab、练习和弹层均在原页工作，未无故跳转或重复实现公共能力。
- [ ] 教材中的新内容均已被忠实表达；新增通用能力有测试和架构说明，并已同步更新本 skill。

## 8. 验证与验收

按改动范围运行：

1. 针对课程数据和阅读学习区的相关 Vitest 测试；新增课程至少测试查找、段落标题分离、glossary 去重、词引用解析、题目答案合法性、section 顺序和 grammarRefs。
2. `pnpm --filter @rosie/english typecheck`。
3. `pnpm lint`。
4. `git diff --check`，再审阅 `git status --short` 与目标文件 diff，确认没有无关改动或用户修改被覆盖。

**不要运行 build，除非用户在当次任务明确授权。** 用户要求手动执行 build 时，只报告未运行及建议命令，不把它伪装成已验证。

完成标准：教材结构完整、全阶段词库零重复、阅读与学习区可由当前 UI 呈现、公共练习引擎得到复用、语法和写作对学生清晰、相关测试/typecheck/lint/diff check 通过。若仓库已有错误，记录准确命令和与本次改动的关系，不掩盖失败。

最终汇报列出修改文件、录入内容摘要、复用的公共能力、验证命令与结果、未运行的 build，以及任何材料缺口或剩余风险。
