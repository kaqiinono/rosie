# KET Trainer 1 · Test 3 完整保留测评草稿

来源：《剑桥KET官方模考题精讲精练1》。本目录是用户提供 PDF 的逐页转录草稿，
不是合成夹具，也不是已审核、已发布或可立即开考的试卷。

源文件 SHA-256：`db60e05ceb2c421ea5982b6e092dcfe6b75ca24348a24860bd164f1a97dedada`。
此身份沿用本书既有来源记录；本轮未另做项目检查。`contentSetId` 为
`ket-trainer-1:test-3`，`contentRevisionId` 为 `ket-trainer-1:test-3:revision-1`。
`purpose` 始终为 `reserved`，不得作为未授权专项练习或词卡例句提前开放。

## 本轮实际阅读并用于转录的页面

以下 PDF 页与印刷页均根据页图逐项读取。表中对应关系只是已读页面的记录，
不作为未读页面的统一偏移公式。

| 内容 | PDF 页 | 印刷页 | 本包内容 |
| --- | --- | --- | --- |
| Reading and Writing Part 1 | 79、80 | 78、79 | 1–6，六则独立材料各自成组 |
| Reading and Writing Part 2 | 81、82 | 80、81 | 7–13，三位运动员全文及共同选项池 |
| Reading and Writing Part 3 | 83、84 | 82、83 | 14–18，Isabella 全文与五题 |
| Reading and Writing Part 4 | 85 | 84 | 19–24，Ferry to School 全文及选项 |
| Reading and Writing Part 5 | 86 | 85 | 25–30，Jake 邮件与原书示例 0 |
| Reading and Writing Part 6 | 87 | 86 | 31，邮件写作的三个任务点 |
| Reading and Writing Part 7 | 88 | 87 | 32，三图故事及图片槽位 |
| Listening Part 1 | 89、90 | 88、89 | 1–5，十五个图片选项槽位；音轨标签 55 |
| Listening Part 2 | 91 | 90 | 6–10，Football match 记录表；音轨标签 56 |
| Listening Part 3 | 92 | 91 | 11–15，Hardin Castle 对话题；音轨标签 57 |
| Listening Part 4 | 93 | 92 | 16–20，五段短材料题；音轨标签 58 |
| Listening Part 5 | 94 | 93 | 21–25，共享问题选项池与原书示例 0；音轨标签 59 |
| Test 3 听力原文 | 157、158 | 156、157 | 全部五个 Part；Part 3 对话跨页 |
| Test 3 官方答案与写作范文 | 193 | 192 | 55 道客观题答案、31 与 32 的原书范文 |
| Test 3 Speaking Part 1 考官脚本 | 201 | 200 | 基本信息、季节与节日、食物主题及备用提示 |
| Test 3 Speaking Part 2 考官脚本 | 202 | 201 | 电视节目讨论及后续问答 |
| Test 3 Speaking 图卡 | 209 上半页 | 208 上半页 | 五幅电视节目图片；下半页 Test 4 不属于本卷 |

另查看了 PDF 197–200 的标题以确定 Test 3 考官脚本起点，并查看 PDF 159
确认已进入 Test 4 听力原文；这些相邻测试的内容没有导入本包。
中间页图仅位于被忽略的 `output/exams/ket-trainer-1/test-3-full-review/`，
没有写入客户端目录、公共桶或本包公开导出。

## 覆盖和题组边界

- 正式题包含 Reading and Writing 的 30 道客观题、2 道人工批改写作题，
  Listening 的 25 道客观题，以及 Speaking 的 2 个人工评价 Part。
- Reading Part 5 与 Listening Part 5 各保留一个 `example-0`，明确为原书例题、零分。
  两个例题不计入 55 道客观题，也不产生额外正式题号。
- 阅读 Part 2 的三篇人物材料与选项池、Part 3 的完整文章、Part 4 的完整完形文章、
  Part 5 的完整邮件均留在各自同一题组内。匹配题仍按原印刷编号逐题记录。
- 听力按五个 Part 保存完整材料范围和音轨槽位。Part 2、3、5 的共享独白、对话和
  选项池不拆成不完整材料。Reading Part 2 允许复用人物选项；Listening Part 5
  正式答案按该组非复用选项池记录，示例保持零分。
- Adam 足球短信的材料家族继续使用既有小样本的 `ket-trainer-1:adam-football-plan`。
  原有小样本目录未被修改；其问题和本卷同源，不能作为另一份未见材料重复计数。

## 答案、解析与原文的来源边界

`solutions.private.json` 保存官方答案、两篇原书范文、听力原文和考官脚本。
这些内容不属于学生尚未提交的题面响应。

所有 55 道客观题的答案依据 PDF 193。该答案页没有逐题详解，因此本包的逐题中文
解释均为 `origin: supplement`、`authorship: ai_assisted`、`review: pending`；
它们引用实际阅读材料或听力原文中的证据，并与官方答案自身的 `origin: source`
分开。它们尚未经过人工复核，不能称作官方解析或人工已审解析。

两篇写作范文逐字转录自 PDF 193，`originalScore` 保持 `null`，原书未提供的评语
保持空数组。任务点提示和范文说明单独标为 AI 辅助补充，不推定满分。
口语没有唯一正确答案，保留原考官脚本与补充评价提示，不编造示范回答或官方等级。

Speaking Part 1 的学生提示仅是补充的操作说明，来源为空而且仍待审核；完整问题、
备用提示和考官指令只在私有 `examiner_script` 中。Part 2 学生图卡使用 PDF 209
上半页的独立裁剪引用，避免把 Test 4 的保留材料一并展示。

原书的六分钟誊写答案说明、口语各阶段时间说明只作为私有来源文本保存。
它们不决定软件倒计时、自动跳题、自动提交、重复播放或等待时长。

## 尚未完成、必须继续保留的缺口

- 全部实体仍为 `pending`；`readiness.exam` 明确 `blocked`。页面转录不是管理员审核。
- 音轨 55–59 只有原书标签，尚未绑定授权文件，也未实际听取音频。所有 `segment`
  和 `playback` 为 `null`；不能从印刷文本推断时码、重复次数或等待。
- 15 个听力图片选项、写作三图和口语图卡属于必要的未绑定媒体。三位运动员与
  Isabella 的肖像作为可选槽位保留。所有裁剪坐标均须在实际素材绑定时人工复核；
  原始整页图只预留 `audience: admin`、`purpose: source_page` 的私有槽位。
- Listening 7 的原书答案为 `395 (any convention)`。当前登记数字 `395`；更多文字或
  数字格式应逐项审核后加入，不添加宽泛的自动数值归一规则。Reading 29、30 的原书
  完整形式和缩写分别保留为明确答案变体，不拼接不相关答案。
- 词汇链接暂为空；没有可核实的真实 `word_entries.id` 时不编造 UUID，也不按拼写
  猜测四元组。后续在应用审核层连接实际词库记录。
- 写作、口语评分需已有人工评价流程及经审核的量表。模板范围或本包提示不是官方
  缩放分、通过概率或任何已执行的评分。

## 文件与人工验收

五个标准包文件分别为 `manifest.json`、`content-set.json`、`content.json`、
`solutions.private.json`、`source-pages.json`。来源清单保留正文引用、私有原文引用和
具体图片裁剪引用；没有写入本机 PDF 路径、网盘凭据或媒体直链。

本任务只读取页图并写入文件，**没有执行 validator、测试、lint、typecheck、build、
导入、数据库迁移、审核批准或发布**。后续由用户手动执行内容包校验，并对照上述
已读页面审核文字、选项、原书答案、补充解释、图片裁剪、媒体绑定和完整题组边界。


后续结构整合：原先直接放在题干、没有材料引用的正式写作/口语任务，已将原有任务文字和图卡移入该完整题组的稳定 task-material/family，题干不重复展示。内容与来源不补造，用于统一记录材料首次接触。仍待人工审核，未运行验证。
