# PET 词汇与练习导入

`data/source-manifest.json` 记录六份用户提供的 PDF 及 Cambridge 2025 年 8 月版词表的文件名、页数、SHA-256 和提取行数。页码均为 PDF 页码，从 1 开始。

| 来源 | 留存内容 |
| --- | --- |
| 01 核心词汇 | 712 条主题词汇，原始词形、词性、音标、释义及例句单元格 |
| 06 / 07 高频词练习与答案 | 50 组共 500 题。保留词池、题号、题干、答案词形、双语单元格及跨页页码 |
| 08 主题词汇 | 23 个主题共 1,854 条，保留跨主题重复及原始音标 |
| 09 不规则动词 | 96 行、95 个不同动词，保留过去式、过去分词及原始义项。原件末行是 sink |
| 10 Cambridge 2020 适用版 | 3,047 条字母表提取记录、1,875 条主题出现记录、附录一示例及附录文本 |
| Cambridge 2025 年 8 月版 | 3,123 条字母表提取记录，含补录 truck，另有 1,887 条附录二主题出现记录、附录一示例及版本差异记录 |

附录一中的数字、序数、国家及国籍是开放词集，结构化文件留存书中示例。2025 版附录二的原始列排版文本保存在 `sources/cambridge-2025-appendices-text.json`，23 个主题的逐行来源、跨行片段和候选映射保存在 `sources/cambridge-2025-topics.json`。主题映射合并两版 Cambridge 附录及用户提供的主题表。原审核队列 305 行中，303 行已明确词头归属；剩余两行均来自 08 资料，详见 `source-resolutions.json`。字母表版本差异包含排版、注记和词形变更，不能将提取行的增删直接解释为新词数量。

## 词表审核

- `master-vocabulary.json` 的每条候选记录保留来源行 ID、主题、别名和固定位置，可按来源行 ID 查原始词形。每个来源行都带有 `candidateKeys`，原始文字不改写。`sourceHints` 保留拆分后的义项、搭配、缩写和占位说明。`review-queue.json` 当前保留 3 行来源疑点：`08:0019` 的 block/notice 混合标签、`08:0088` 的 light/clothes 标签，以及 `08:1297` 的 guest guide/导游对应问题。前两行保留未分配原因；guest guide 保留为唯一未批准词条，不作为练习答案发布。
- Unicode、空格和撇号规范化后按拼写检索；`caseSensitive: true` 的 `IT`、`May`、`Miss` 与小写 `it`、`may`、`miss` 分开记录。其他同拼写词仍需按词性和义项核定，例如形容词与动词 *live* 的不同读音。
- 英美拼写经明确映射后共用词条，例如 *colour/color*。过去式、过去分词和明确的屈折形式记在词形元数据中，例如 *tooth/teeth*。派生词、不同读音的缩略词及不同词义的词元分别立项，例如 *sleeve/sleeveless*、*laboratory/lab*。`program/programme` 等按义项限定变体关系；不能将所有斜杠标签都视为可互换答案。`leave … alone` 保留分离短语模式，`sb.` 不进入拼写词头。
- 主主题优先采用主题表，缺少主题时归入基础词汇。一个词可带多个主题，`PET Unit 01` 至 `PET Unit 24` 按主主题排列，每课最多 20 个分配位置。以后追加词条时沿用 `allocations.json`，在对应单元的下一个空闲末尾位置追加。已有位置和主键保留。
- `existing-library-overlap.json` 留存规范化前的只读比对：当时非 PET 词库 2,227 行、1,785 个规范化拼写，1,316 个拼写与初始 PET 候选重合。该数不是当前完整匹配结果；后续复用以本地快照及新的候选检索记录为准。复用释义、例句或音标前仍需按词性与义项核对。最终主清单有 3,424 个候选词，`reviewed-words.json` 有 3,423 个已审核词条；guest guide 暂不批准。完整本地匹配过程先复用了 1,329 个候选的已知内容，再对没有匹配的词逐条补齐与核对，普通复数和拼写变体最后归并。
- `source-reconciliation.json` 记录 3,394 → 3,460 的完整键映射、来源调整和大小写拆分；`canonical-key-redirects.json` 记录旧键跳转与不再使用的位置。`notice board` 合入 `noticeboard`，`break time` 复用 `breaktime`。初始 67 词的位置和原有义项 ID 保留，后续词义和词形补充另升内容版本；未发布的 `IT`、`May` 继承原显示词的位置，小写代词/情态动词另追加到基础词单元。`final-identity-reconciliation.json` 记录最终 44 项归并、范围展开和词头修正，3,460 → 3,424。13,200 条结构化来源记录中，13,198 条已映射，另外 2 条有明确待审原因。一次性脚本 `scripts/tmp/reconcile-pet-final-identities.py` 保存原文件备份及完成标记，不执行数据库写入。
- `reviewed-words.json` 收录最终 3,423 个已审核词条，包含释义、英式音标、例句译文、按义项区分的词性及安全词形配置。新增审核词应从主清单引用 `key`，填写 `revision`、`fields` 和 `content`，完成核对后设为 `reviewed: true`。现有记录只会更新明确给出的字段，旧行 ID、创建者与其他列保留。

## 题库审核

`sentence-sets.json` 保留全部 500 道来源题。空格顺序对应 `acceptedAnswerSets` 内层数组的位置，例如第 271 题为 `[["leave", "alone"]]`，第 474 题为 `[["took", "ages"]]`。题干的填空结果可与 07 的完整句对照。源句可能存在语法或措辞问题，候选词池映射也需逐题核对。

`reviewed-sentence-set.json` 是前 10 题的已审核副本。其余 49 组、490 题已完成逐题来源对照审核，记录在 `sentence-review-11-170.json`、`sentence-review-171-330.json`、`sentence-review-331-500.json`；汇总更正在 `sentence-review-audit.json`。原始题干、答案、页码和双语单元格保留，修改后的教学题与原文分开存储。另有六组原创短文专项（学校、旅行、自然三个主题，各一组选择填空和开放填空，每组 6 题）及 8 道不规则词形练习。短文专项参考 Reading Part 5 / Part 6 形式，不是官方试卷或完整模拟考试。来源练习与原创题有不同的组 ID。审核后的组提供题号、词条 `wordKey` 和答案组合。每组作为整体发布，引用的所有词均须有审核词义。导入器使用规范化拼写查找固定位置，在目标库解析真实词条 UUID 后保存题组。

## 手动执行

数据库迁移 `20261113054603_pet_learning.sql` 已于 2026-11-13 应用到当前项目。同日先导入 30 个样例词条和 10 道题，用户确认样例无误后，又增量导入其余 37 个已审核词条及 7 组题。该阶段累计发布 67 个词条及来源内容、8 组共 54 道题（10 道来源句子、36 道短文题、8 道词形题）。随后用户授权全部候选审核后分批导入，并明确不用百炼，由当前助手依据原始资料自行完成内容整理。原有样例词条保留 ID 和学习进度；补充义项和词形时提高内容版本。

本地记录：`output/pet/sample-import-preview.json` 为写入前预览，`output/pet/sample-import-applied.json` 记录导入完成，`output/pet/sample-import-after.json` 的词条、内容与题组差异均为 `unchanged`。该确认使用只读比较，没有重复写入。

后续已审核批次记录：`output/pet/reviewed-import-preview.json` 与 `output/pet/reviewed-import-applied.json`。全量批次记录位于 `output/pet/local-batch-*-{preview,applied}.json`。2026-11-13 最终增量导入已完成：数据库现有 3,423 个 PET 词条和 3,423 条来源内容，核心必默 661 词、阅读高频 499 词、不规则动词 95 词；8 组 54 道已审核题保留。`output/pet/final-import-applied.json` 记录完成，`output/pet/final-import-after.json` 只读比较显示所有词条、内容和题组均 unchanged，无位置冲突。汇总回执为 `data/import-completion.json`。

2026-11-13 句子题追加导入已完成：新增 49 组、490 题，数据库累计 50 组、500 道来源句子题；加上保留的 36 道短文题和 8 道词形题，合计 57 组、544 题。只读回查确认全部 544 个题目 ID 唯一、词条引用有效，3,423 个词条及内容与 57 组题均为 unchanged，位置冲突为零。回执为 `data/sentence-import-completion.json`；导入及回查记录为 `output/pet/sentence-final-{preview,applied,after}.json`。没有改写个人学习进度。


```bash
pnpm pet:import
pnpm pet:import --sample
pnpm pet:import --compare-db
pnpm pet:import --sample --apply --creator YOUR_ADMIN_UUID
pnpm pet:import --apply --creator YOUR_ADMIN_UUID
```

默认只生成 `output/pet/import-report.json`，可用 `--report` 指定路径。报告包含候选数量、审核清单、可发布词和题组，以及仍缺引用的已审核组。`--compare-db` 只读查询目标库，在报告中列出词库重合及待新增、更新、保留的记录和字段。`--sample` 限定 20 个示范词、前 10 道题依赖的 10 个词及该组练习。其余已审核词和练习由完整导入处理。可重复使用 `--set path` 加载额外的题组数组。

实际导入前由维护者应用 PET schema migration。`--apply` 使用 `apps/web/.env.local` 中的 `NEXT_PUBLIC_SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，要求 `--creator` 对应真实的 Supabase 管理员。发现目标库有与固定位置冲突的 PET 词条时会在写入前退出。每个词内部依次保存，全部词条完成后发布题组；`--concurrency 1` 为默认，可显式设置 1–8 个独立词条并发。网络请求遇到限流或服务端暂时错误时会按退避重试。报告串行保存已完成数量；出现错误时等待在途写入结束再退出，中断后可用同一命令按数据库实际状态继续。重复运行保留原词条 UUID 和组 ID。后续修改练习题或义项时同步提高其 `revision`。

## 人工验收顺序

尚未运行构建、项目检查、测试或浏览器验证。数据库迁移与首批样例导入已按后续明确授权完成，并通过只读查询确认迁移历史、表权限、内容数量和题目引用。全量词汇内容已完成本地审核和身份归并，全量已审核词汇的增量导入和只读字段对齐已完成；浏览器功能验收、项目构建/检查/测试仍由用户单独手动触发。句子题审核及增量导入已获后续授权。

1. 查看 `source-manifest.json`、`review-queue.json` 和导入预览，确认候选数不等于已批准发布数。当前项目已应用 `supabase/migrations/20261113054603_pet_learning.sql`，无需重复执行；运行 `--compare-db` 查看字段差异。
2. 样例导入已完成，包括服装主题 20 词和第一组原题另需的 10 个词，共 30 个词条、10 道题。后续重复导入应无新增词条、无 ID 变化，未提供的音频、图片等字段保持原值。
3. 打开 `/english/words/practice/pet`，确认主题、标签和来源可见。创建 PET 主线时默认每批 5 词；已有其他主线时 PET 计划应创建为暂停状态。PET 和 KET／厚海的相同拼写不共享进度。
4. 独立拼写先答错再补练；查看答案再作答；刷新未完成练习；模拟保存失败后重试。首次答案、提示标记和重试应分别保留，不重复提交。同一账号两端修改时应提示版本冲突，同步后继续；另一个账号不能读取该会话。
5. 听音成功才解锁对应输入。播放失败可以重试或跳过，跳过不计错且不能推进复习。短文训练逐题反馈，测评在整组提交后反馈；计时可关闭。
6. 主线第 5 阶段完成后，同步复习列表，首次到期为下一天。首次独立答对后间隔为 3、7、14、30 天，首次错答或提示后答对均回到次日；同一天不能再次推进。日常与专项表现分别查看。
7. 手动运行所需 lint、类型检查及项目构建。已编写的定向回归用例在 `apps/web/tests/pet-exercise-view.test.tsx` 和 `apps/web/tests/pet-session-actions.test.tsx`，覆盖多空顺序、相关答案组合、缺空、旧语法兼容、首次答案、测评反馈、保存重试及云端草稿合并；尚未执行。
8. 词汇导入结束后查看最终差异回执。49 组句子已单独逐题审核；不能因为词条已发布，就自动把新题的原句或答案标记为已审核。后续修正提高相应内容版本，再执行同一增量导入流程。

日常列表优先推荐未练过的内容，再选择较久未练的内容；拼写与听音分别排序。到期复习每次最多 10 词，应用练习每次最多 5 题。内容发布后会话保留当时的题目快照，更新题库不会改变已开始或已完成的题目。

Cambridge 2025 年 8 月版官方来源见 [Cambridge English B1 Preliminary Vocabulary List](https://www.cambridgeenglish.org/Images/506887-b1-preliminary-vocabulary-list.pdf)。

## 全量内容补齐与复核 CLI

本次全量导入采用本地资料优先：`local-reuse-decisions.json` 与三个 `local-reuse-chunk-*-decisions.json` 保存现有词库匹配、逐词修正及复用依据；`source-only-chunk-*-decisions.json` 保存无本地匹配词的原始资料核对和助手补充内容。记录中的本地助手审核不是人工词典编辑签核。词义或身份无法确认时保留 `defer` 原因，复数与拼写重复先列入 `pending-identity-review.json`，归并完成后才发布。`pending-identity-review.json` 现已标记本次归并完成，具体操作、退休位置和仍待核的来源见最终身份审计。

用户于 2026-11-13 明确要求不再调用百炼，改由当前助手依据原始资料自行整理。此前仅对 16 个无本地匹配词尝试服务补全，后续请求返回模型访问拒绝；这些提供方断点没有直接发布。余下工作不依赖外部补全服务。下述 `--run` 仅保留为今后经授权的手动选项，不会自动触发。

`scripts/enrich-pet-vocabulary.mjs` 仅整理本地内容，不写数据库。默认汇总每个未审核候选的原始来源、阅读题语境、已知资料错误与现有词库候选，生成待处理清单。`--run` 才调用现有填词配置：优先使用 `AI_WORD_ENRICH_*`，再回退 `AI_CHAT_*` / `AI_EMBED_*`；不会输出密钥。现有完整词条作为待核对草稿，其他词条先生成草稿，再通过独立请求复核。没有修改的合格草稿只需返回审核结论，需要修正时返回完整内容；缺字段、词元不清或未明确接受的条目保留为待处理，不能发布。

```bash
node --env-file-if-exists=apps/web/.env.local scripts/enrich-pet-vocabulary.mjs
node --env-file-if-exists=apps/web/.env.local scripts/enrich-pet-vocabulary.mjs --run --missing-only --limit 16 --batch-size 8 --concurrency 2
node --env-file-if-exists=apps/web/.env.local scripts/enrich-pet-vocabulary.mjs --run --retry-errors
node --env-file-if-exists=apps/web/.env.local scripts/enrich-pet-vocabulary.mjs --publish-reviewed
```

先复用本地词库时使用 `--missing-only`：必须提供非空的现有词库快照，只选择没有任何本地匹配候选的词，调用与本地发布均保持这个范围。检索会识别 `honour (AmE honor)`、`(verb)` 等旧标签和带空格的斜杠写法；它们只用于查找候选，不自动成为 PET 拼写变体。还会查询来源或已有词条明确记录的屈折形式，并将规则复数回查到有名词来源依据的主表词（如 `shoes` → `shoe`）。这类候选标记 `requiresLemmaAdaptation`，保留 `lookupMatches` 检索依据，不直接复制为草稿；须分别核对词元、音标和义项。`preparation.json` 记录因此排除的候选数，`prepared-packets.json` 中每个选中词仍带有可检查的 `existingCandidates` 数组。

默认断点目录为 `output/pet/enrichment/`：`preparation.json` 记录选择范围，`prepared-packets.json` 留存本批来源内容供调用前查看，`entries/` 保存每词状态、草稿和审核结论，`responses/` 留存提供方原始响应，`report.json` 汇总成功、待处理与失败。请求有超时和限流退避，Ctrl+C 会在当前请求结束后停下。来源、固定位置、质量提示或流水线版本变化会使旧断点失效，须重新复核。`--retry-deferred` 重做待处理内容，`--keys-file` 接受精确词条 key 的 JSON 数组；`--state` 可隔离试运行目录。默认每批 16 词、并发 4，可通过 `--batch-size` / `--concurrency` / `--max-output-tokens` 调整。

`--publish-reviewed` 只将当前来源版本对应、结构完整且已明确接受的结果追加到 `reviewed-words.json`，保留原有审核词条。每条记录包含 `ai-assisted-source-comparison` 方法、生成与复核模型、时间及来源哈希，不标为人工审核。此步骤仍不入库；确认本地内容后使用既有 `pet:import --compare-db` 和显式 `--apply` 分批发布。

最终内容修正还包括 95 条显式词形保护、who/where/there 的基础义项，以及 view 的观点义和 dozens of 的不定数量用法。此次新建且没有学习、计划或题目引用的 chips、holidays 重复行，在完整备份和事务内引用检查后归并到 chip、holiday；保留的词条 ID、位置和所有原有学习记录未变。未清空或重建任何词库。
