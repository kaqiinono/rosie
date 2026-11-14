# 题面与活动编写

用于新卷提取及已有卷修订。以 `packages/exams/src/types/content.ts`、`questions.ts`、`solutions.ts` 和 `validation/` 当前保存契约为准；文档中的早期 demo 描述不是最新字段规范。

## 活动与作答约束

逐活动记录原指令、例题、标签、候选池及来源页，再决定作答方式。`activities` 引用完整的 `instructionIds`、`materialIds`、`questionIds`，包括例题；共享材料/池仍保留完整题组边界。活动编号与原始小题编号分开，不编造原书没有的题号。

| 原题关系 | 作者契约 |
| --- | --- |
| 每题 A/B/C、图片选项 | 使用实际选项和稳定 option ID；图片属于对应选项，不从答案制造干扰项 |
| 共享选项配对 | `matching` 与题组 `optionPools`；`allowReuse` 来自原指令 |
| 一题选择多个回应 | 使用当前 `multiple_choice` 契约，显式 `selectionCount`；无顺序要求时不伪装成多个有序空位 |
| 篇章逐空选词 | `cloze` 与正文 `answerSlots`；每空关联对应题/词池，保留原位选词所需关系 |
| 开放填空、听力信息填写 | 开放 `gap_fill`，保留表格/邮件上下文；数值答案也是字符串，不由答案反造候选池 |
| 常驻手写 | `layout: handwriting`，题目为开放 `gap_fill`，`handwritingSize: letter | word`；可选 `wordBank` 是展示材料，不自动成为强制选择池 |
| 判断/字母分类并支持手写 | handwriting 活动，每题一个开放空；显式 `choicePresentation.kind: judgment | letters` 和原题 `options` 的 value/label；分类点选值沿用 gap 答案契约 |
| 写作、口语 | 保留任务要求、图序、字数及人工 rubric；考官材料保持私有授权边界 |

分类的 T/A/N、S/D、P/F、A/D、✓/✗ 必须保留原题含义与答案值，不因选项个数相同而互换。当前分类默认点选，可切换手写；房间词库等手写活动不因此变成分类题。不能仅凭 VOCABULARY 栏目把整个活动改成手写。

例题保留完整上下文和已给答案，零分、不可作答；例题占用选项与否依据原题。未给出的例题答案不推断。开放题手写提交后需人工批阅，待批阅不计零分；原本不计分的训练仍不计分，不能为了启用交互而修改分值。

## 空位、句界与正文

- `answerSlots` 使用稳定 `questionId`/`gapId`、UTF-16 `start`/`end` 和准确 `sourceText`；表格、邮件按契约带 `row`/`column`。
- `sentences` 使用稳定句子 ID 与 UTF-16 范围。拆标题、改正文后同步维护范围和原文，保留未改内容的 ID；不依赖浏览器临时识别下划线或句界。
- 原位空位已在共享篇章显示时不再造一套重复作答区；题干自身含空位则保留完整题干。不要为消除重复展示而删除真实来源题文，渲染器负责已知的指令/例题去重。
- `gap_fill` 的答案是实际文本；配对答案是 option ID。完整 `acceptedAnswerSets` 保留组合关联，不拼接不同有效组合。

## 图文布局与标题

- 区分人物配文、文章插图、活动共用场景图、图片选项、故事序列与口语图卡。纯文字材料不额外生成配图；布局不同不意味着新增评分题型。
- 人物和文章的图文关系写入 `Material.layout`：稳定分区 ID、可选 `headingBlockId`、`bodyBlockIds`、`imageBlockId`、`imageSide: left | right`。每个材料块在分区中恰好出现一次；续文可无图并占全宽。关系来自原页，不从文件名或块排列猜测。
- 栏目标题用文本块 `presentation.role: heading`，按原文保存 `prefix`/`originalText`；活动指令用 `presentation.role: instruction`、`number`/`originalText`。正文与编号分离，标题/指令不同时带句界或答题空位。
- 材料和选项图片用 `displayWidth`，独立活动插图用 `imageDisplayWidth`；宽度为 80–1200 整数像素，含义是最大显示宽度，实际受容器限制且保持原图比例。同槽位引用保持一致，尺寸修改不重新裁切或绑定。
- 选项 `imageRegion` 为成品图内 0–1 区域；图上 `positions` 为成品图百分比位置。原页 `provenance.sources.region` 则是 PDF 页图内 0–1 裁切区域。重裁后核对成品坐标，不混用三者。
- 缺图时保留材料位置和尺寸，并记录未绑定/加载失败等真实状态；占位不算素材已齐备。替代文本不得泄露正确答案。

## 可审阅交付

覆盖表应能对应“来源页 → 活动指令/栏目 → 完整材料 → 每道计分题及例题 → 空位/选项 → 图片/音频槽位”。提供 `/admin/exams` 整卷预览和 `/admin/exams/images` 原页对照入口，待用户手动核对图文位置、题面完整性和作答方式。

保存仅更新未发布作者内容；审核标记、发布状态和运行验收分别记录。管理端当前支持分块保存及共享字段编辑，保存成功即持久化，不再要求第二次“保存草稿”。后续修订必须读取当前版本，不能用参考包覆盖管理端已保存的更改。
