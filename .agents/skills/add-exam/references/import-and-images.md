# 导入与原页操作

以下是仓库实现入口，执行时以文件当前版本为准。不要从一次历史任务的管理员、远端项目 ID 或临时脚本推导未来任务参数。

## 来源与包契约

- 来源映射：`scripts/exams-source-map.json`、`scripts/lib/exams/sourceMap.ts`。
- 提取：`scripts/lib/exams/extractSource.ts`。多文件（题卷/答案册/音频）分别记录来源身份；目前导入包对主来源的约束见 `scripts/lib/exams/bundle.ts`，不得把答案册页码冒充题卷页码。遇到不支持的多来源关系先修正契约或记录明确阻塞。
- 完整卷结构优先参考 `packages/exams/source-data/ket-official-four-tests/test-1-full-rendering-v2/`；训练内容参考对应 `*-rendering-v2` 包及当前契约。本地包可能早于管理端后续编辑，不能当作当前远端草稿快照。不要沿用参考卷的身份或审核结论。
- `manifest.json` 需要 schemaVersion、sourceId、sourceSha256、extractionVersion、contentSetId、contentRevisionId、revision；必须与实际内容包一致。
- `source-pages.json` 的结构从 `loadExamBundle` 和现有包读取；列全实际来源引用，不仅封面和第一题。
- 题目 ID 保留 `<source>:test-<N>:<exam|training>:<section>:part-<N>:<original-number>`。题目共享的 family 不随修订任意更换。

原页提取命令（只渲染来源，不自动生成完整题库）：

```sh
pnpm exams:content extract --input <pdf> --source <id> --test <n> --role <exam-or-training> --map <map-json> --output <private-directory>
```

新书先依据实际页内容补来源映射；不要使用其他书的偏移。需要 PDF 渲染器但本机不可用时遵守禁止安装要求，保留内容与缺口，不自动安装。

## 草稿写入

入口：`scripts/import-exam-content.mjs`、`scripts/lib/exams/importDraft.ts`、`checkpoint.ts`，以及 `apps/web/src/lib/exams` 中的服务端保存契约。

如果用户允许独立导入预览，可使用 `pnpm exams:content import-draft --bundle <directory>`；用户禁止检查时不额外执行 validate/预览。实际保存仍经过导入器和服务端的必要校验：

```sh
pnpm exams:content import-draft --bundle <directory> --apply --base-url <existing-app-origin>
```

- 使用已配置的 `EXAMS_ADMIN_ACCESS_TOKEN`，不要在命令、日志、提交文件中暴露令牌。目标为用户现有且授权的服务，不自行启动开发服务器或部署。
- `--resume` 仅用于未完成请求，重放原始身份与载荷；修改输入后不能沿用旧请求。`--update-existing` 只适用于具有成功本地导入回执的同一草稿；遇到他人修改/版本冲突不能强制覆盖。
- 默认回执目录 `output/exams/import-state/`。HTTP 不确定结果先按原请求恢复，不另建重复卷。
- 没有可用应用服务/管理员令牌时，先完成本地包和可进行的原页准备。若当前会话已授权且具备管理连接，可评估现有 service-only RPC 入口；仍必须复用相同结构、真实管理员审计、版本约束与词汇引用校验。不能直接插表绕过这些门禁、伪造用户 JWT 或擅自提权。
- `scripts/tmp/prepare-exams-management-import.mjs` 是特定历史批次的一次性工具，并非通用导入器，不能无改动用于新书。
- 仅凭本地 migration 文件不能宣称远端已应用。缺迁移时报告准确缺口；是否执行迁移遵循当前会话授权。

## 草稿词库自动关联

- 管理端保存前调用 `POST /api/admin/exams/words` 生成关联，再用现有草稿保存接口提交。导入 CLI 和直接保存 RPC 只保存传入的关联。经这些入口导入后，读取刚入库的实时草稿和版本，复用 `apps/web/src/lib/exams/vocabularyMatch.ts` 的 `matchExamVocabulary`，通过 `saveExamDraft` 保存返回的链接。保留同一修订的题面、私有解答、媒体绑定和既有作者关联。
- 匹配考生可见的正文、题干、选项和共用选项池。词库原形、收录的拼写变体、显式词形和英语模块生成的常规词形都算命中，词组按完整词边界匹配。同优先级优先选择本考试级别的词条。用词库释义作为补练参考，保存试卷原文中的实际词形、UTF-16 原文范围和对应题目。
- 自动关联以背景词保存，供试后补练使用。无需逐条判断语境义项或让用户手工关联。私有答案、听力稿和考官稿不参与匹配。复用真实词条 ID 和课程位置快照，避免重复关联、虚构词条或写入学习进度、奖励和计划。
- 保存重试沿用已生成的关联和原请求；版本冲突时停止写入，在确认最新草稿可继续编辑后重新匹配。以保存回执确认完成。若词库不可用或命中超出内容包容量，记录未完成的原因和范围。

## 补充与修订已有卷

- 先读取当前目标修订及版本，再做最小修改；保留题目/材料/槽位 ID、来源、私有解答、媒体绑定和材料家族。旧本地包、旧快照及历史成功回执不能覆盖管理端的新编辑。
- 通用 importer 的回执和管理 RPC/一次性修订脚本的回执不能互认。`scripts/tmp/apply-exam-*.mjs` 属于具体历史批次，不直接用于新卷，也不为绕过 CAS 换 ID。
- 已发布或下架修订目前支持通过既有管理员操作退回同一份草稿再编辑；不要把“发布后不可编辑”写成当前规则。退回、发布须在会话授权范围内，普通补图不自动触发；历史作答继续读取冻结内容/媒体。
- 当前发布不再以来源审核、媒体齐备、材料族或词条快照就绪为门禁。继续准确记录 pending/blocked、缺图缺音与运行限制；不把取消发布门禁解释成免鉴权、免保存结构校验、免媒体访问校验或可以伪造审核结果。

## 图片任务：新来源必须接入原页

相关实现：

- `apps/web/src/lib/exams/imageTasks.ts`、`imageSources.ts`：从实时草稿图片槽位生成任务并读取私有原页。
- `packages/exams/src/types/imageTasks.ts`、`types/content.ts`：任务/来源引用与坐标契约。
- `scripts/prepare-exam-image-pages.mjs`：私有原页上传及索引登记。
- `docs/exams-image-workbench.md`：用户裁图与清理流程。

**已知限制：初版原页准备 CLI 硬编码了四个内容包及两个来源的输入路径。新文件不能直接跑旧命令后宣称准备完成。** 阅读当前脚本；若仍有限制，把本次 bundle 与实际页图路径接入可维护的配置/参数，保留既有来源和删除状态。重复性来源准备应归入 `scripts/` 的可续跑 CLI，不再累积一批一批的私有脚本。若用户只授权内容、不允许改工具，明确记录该阻塞。

每个 question_image 槽位应具备：

1. 实际题目/选项/材料引用；明确 required 与可选用途。
2. `provenance.sources` 中准确的 sourceId、1-based pdfPage、printedPage、role；任务实际选中的来源必须就是所准备的页图。
3. 来源区域使用 **0–1** 的 `{x,y,width,height}`，范围留在页内；不要套用语法模块 0–1000 坐标。无可靠区域时提供准确题号/页码，保持 region 缺省。
4. 原书一题的 A/B/C 图按学生题型布局保留整体或分别槽位；图卡不切掉必需文字，不把教师答案或相邻题泄漏给学生。
5. 选项 `imageRegion` 相对已绑定成品图，活动 `positions` 使用该成品图的百分比坐标；两者均不是原页裁切区域。重裁后重新核对图中编号、选项区域与作答位置。`displayWidth` 只控制显示宽度，不修改原图或媒体绑定。

原页存储：

- 私有 bucket `exam-image-sources`；表 `exam_image_source_pages`。
- 身份为 `<sourceId>:<pdfPage>:<sourceFileHash>`。`source_file_hash` 对应主来源文件实际 hash，`sha256` 对应实际 PNG 字节；同时记录真实 width/height、object_path、state。
- 先上传字节，再登记 ready 索引；保存操作回执。相同身份但不同图片 hash 不静默覆盖，先解释渲染版本或文件差异。
- 页图共用，不为每题复制整页。用户删除后的 state 不因普通重跑复活；需要恢复时才使用当前 CLI 的显式恢复流程。
- 原页不能放 public、公开 Storage URL 或学生内容包。已有原页上传逻辑提供鉴权、私密读取与失败恢复，不绕过它自建公开图链。

准备入口完成对新来源的支持后，按当前 CLI 参数运行实际原页上传。仅在成功回执后计入“原页已准备”；未运行页面时仍写“页面验收未执行”。

## 成品与音频

- **无需手动添加自动裁图路径。** `apps/web/src/lib/exams/imageCrop.ts` 的 `saveExamImageCrop`
  在首次裁图时负责创建上传目录及 `baidu_sync_directories` 后台记录；已有绑定沿用原目录。
  不要求用户在「路径」页添加生成的 `/airosie/exams/<修订哈希>`，不另行调用添加路径 API 或插表。
  自动目录仅从路径管理列表隐藏，底层记录仍用于绑定和媒体访问；不得因列表不显示而重复添加、删除或重建。
  自定义 `BAIDU_EXAMS_UPLOAD_ROOT` 同样由该流程处理。外部音频目录不属于此自动裁图规则，仍遵循现有授权与绑定流程。

- 原页准备成功后，使用 `node --env-file-if-exists=apps/web/.env.proxy.local scripts/prepare-exam-image-crops.mjs --apply --revision <id>` 自动裁切已有参考选区、上传并绑定；默认跳过已有绑定。必要时显式指定真实管理员 `--actor <id>`。复用服务端租约/原请求/版本门禁，私有回执在 `output/exams/image-crops/`，失败重跑相同命令恢复，不删除未完成的回执和 PNG。无选区或缺原页项目明确列出。工作台用于审查与修正，已有图默认直接查看成品。左侧卡片独立记录未审核/有问题/审核通过；自动准备不得替用户写入人工审核通过标记，重裁后原审核标记对新文件失效。沿用上传目录，不另建 public 图床。
- 已有用户裁好的成品可复用现有媒体管理契约准确绑定；未确认对应关系时留待办，不按相似文件名猜题号。
- 音频通过现有 `/admin/sync` 考试媒体面板及服务端绑定契约处理。未提供音频则声明缺失；提供整轨不等于知道逐题时间、重复次数和停顿，播放程序必须有真实依据并保留审核状态。
- 一份卷的图片/音频补充不重建题库，不清空其他槽位，不改变冻结的历史作答修订。
