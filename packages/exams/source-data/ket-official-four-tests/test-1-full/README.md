# Official four tests — Test 1 complete draft

本目录是《剑桥通用五级考试 KET 青少版官方真题：新题型 1（含答案和超详解析）》Test 1 的完整本地转录草稿，保留 Reading and Writing 7 Parts、Listening 5 Parts、Speaking 2 Parts；不是已经发布或可立即考试的题包。既有独立 Part 1 样本不变，本目录沿用其中真实题目的稳定题目 ID。

## 五文件与状态

- `manifest.json`：来源与版本标识。
- `content-set.json`：官方套题元信息；`purpose: training` 表示用途，原卷所有题组仍是 `role: exam`。
- `content.json`：学生材料与 19 个完整题组；30 道阅读客观题、25 道听力客观题、2 道写作、2 个口语 Part，以及原书的 2 个零分示例（阅读 Part 5 的 example-0、听力 Part 5 的 example-0）。
- `solutions.private.json`：原 key、55 道客观题原书中文逐题解析、4 篇原写作样文及原分数/评论、5 Parts 完整听力录音文稿、2 Parts 考官脚本、原口语示例考官反馈与应试技巧。不可进入学生包或公共 barrel。
- `source-pages.json`：完整 `SourceReference` 数组，含印刷页码、内容角色及用到的裁剪区域；不是仅页码数组。

所有 provenance、分类和 readiness 均为 `pending`，不是人工审核通过。代理转录标记 `authorship: ai_assisted`；本次没有另写冒充原书的解释或标准答案。写作和口语使用人工 rubric，不提供唯一答案。原答案的 date/单复数变体分别写成候选答案组合，仍需人工核对。所有语义、转录与裁剪结果均待人工审核。未运行检查、测试、构建、导入、迁移或发布。

来源为用户提供的本地 `01 KET青少版官方真题 全4套.pdf`，共 164 页扫描件。文件 SHA-256 与既有来源样本一致：

`1e67451d011e83999712119387dc40a5cdc5d260090bfde2758428bd8646c0c6`

`sourceId = ket-official-four-tests`。版权页 PDF 3（无印刷页码）确认 A2 Key for Schools 1 / revised 2020 exam，外研社 2021 年重印，ISBN 978-7-5213-2371-9。以下页码均由实际逐页查看页图及页脚记录，不按固定偏移推算。

## 逐页来源与完整边界

| PDF 页 | 印刷页 | 实际页内容与本包用途 |
| --- | --- | --- |
| 3 | 无 | 版权、版本与 ISBN；元信息依据 |
| 4 | 无 | 全书目录；定位后另行逐页核对 |
| 8 | 7 | 口语概览，Part 1 / 2 时长及考试流程；未给数值评分量表 |
| 9 | 8 | RW Part 1，第 1–3 题 |
| 10 | 9 | RW Part 1，第 4–6 题 |
| 11 | 10 | RW Part 2，第 7–13 题，共享读者选项 |
| 12 | 11 | RW Part 2，Jian / Max / Kojo 三篇完整书评及头像 |
| 13 | 12 | RW Part 3，Pat Tulloch 完整篇章 |
| 14 | 13 | RW Part 3，第 14–18 题 |
| 15 | 14 | RW Part 4，Farnsworth 篇章及第 19–24 题 |
| 16 | 15 | RW Part 5，Rachel 的完整邮件、示例 0、第 25–30 题 |
| 17 | 16 | RW Part 6，第 31 题露营邀请邮件，至少 25 词 |
| 18 | 17 | RW Part 7，第 32 题三图故事，至少 35 词 |
| 19 | 18 | Listening Part 1，第 1–3 题及图片选项 |
| 20 | 19 | Listening Part 1，第 4–5 题及图片选项 |
| 21 | 20 | Listening Part 2，radio camp 表格及第 6–10 题 |
| 22 | 21 | Listening Part 3，Edward / Michaela dance classes，第 11–15 题 |
| 23 | 22 | Listening Part 4，第 16–20 题 |
| 24 | 23 | Listening Part 5，class trip，共享 A–H 选项、示例 0、第 21–25 题 |
| 73 | 72 | Speaking Test 1 Part 1 Phase 1，考官脚本、考官角色脚注、示例视频二维码说明 |
| 74 | 73 | Speaking Part 1 Phase 2，weekends / languages、主问题/备用提示语/展开陈述题 |
| 75 | 74 | Speaking Part 2 Phase 1 / 2，讨论卡指令、追问、时间说明及结束语 |
| 85 | 84 | RW Parts 1–5 原答案 |
| 86 | 85 | 写作 Part 6 原样文 A / B、原评论、分项与总分 |
| 87 | 86 | 写作 Part 7 原样文 A / B、原评论、分项与总分 |
| 88 | 87 | Listening 原答案；Part 1 录音文稿开头 |
| 89 | 88 | Listening Part 1 文稿续、Part 2 开头 |
| 90 | 89 | Listening Part 2 文稿续、Part 3 完整文稿 |
| 91 | 90 | Listening Part 4 文稿，第 16–19 段 |
| 92 | 91 | Listening Part 4 文稿第 20 段、Part 5 开头 |
| 93 | 92 | Listening Part 5 续及答题卡 6 分钟/剩余 1 分钟/结束提示 |
| 94 | 93 | RW 逐题解析，第 1–7 题（第 7 题跨页） |
| 95 | 94 | RW 第 7 题续，第 8–13 题解析 |
| 96 | 95 | RW 第 14–20 题解析 |
| 97 | 96 | RW 第 21–30 题解析；Listening 第 1 题解析开头 |
| 98 | 97 | Listening 第 1 题续、第 2–7 题解析 |
| 99 | 98 | Listening 第 8–14 题解析 |
| 100 | 99 | Listening 第 15–23 题解析（第 23 题跨页） |
| 101 | 100 | Listening 第 23 题续、第 24–25 题解析 |
| 153 | 152 | 原视频示例 Maksim / Ayla-Su，Part 1 原评价与技巧、Part 2 原评价开头 |
| 154 | 153 | Part 2 原评价续与技巧，两名考生四维度整体评价 |
| 160 | 159 | Speaking Test 1 学生图片卡：jeans / sunglasses / trainers / caps / watch |

PDF 5 是已查看的空白页；PDF 76（印刷 75）和 PDF 161（印刷 160）已查看并确认属于 Test 2，未纳入本题包。其余不属于本 Test 1 转录范围的页面没有因此宣称逐页核对完成。

RW Part 1 的六个告示各自是独立题组；Parts 2–7 各保留完整共享篇章、题目或任务。Listening 每 Part 一个完整题组，保留跨页问题与共享选项，不能按扫描页拆练。Speaking 每 Part 一个完整任务；书中没有给两个口语任务编号，ID 末段明确采用 `task`，不伪造印刷题号。Part 1 考官提问只放在私有脚本内，学生内容仅保存 Part 标题；Part 2 学生可见内容是原图片卡问题与图片槽。

## 原答案与反馈的边界

原书中文逐题解析保留在 `explanations` 中，包括说明正确答案的理由和原书对错误选项的说明；不会因为某题 `distractors` 为空就删去原书在连续段落中的干扰项分析。题目 evidence 保留可追溯 key，解析另外保留自己的原解析页引用。原听力文稿保存在私有 `teaching_guidance` notes 中，口语考官脚本单独使用 `examiner_script`，避免将文稿或考官提示提前返回学生。

写作样文保留原学生文本，包括原书拼写/语法错误，不静默润色。Part 6 样文 A / B 总分分别为 15 / 15、9 / 15；原分项分别为 5/5/5、3/3/3。Part 7 样文 A / B 总分分别为 14 / 15、8 / 15；原分项分别为 5/4/5、2/3/3。评论明确标为原书评论，未附加代理评分。

口语 PDF 153–154（印刷 152–153）原反馈提供“语法和词汇、发音、互动交流、总体表现”四维度的文字评价；**这些原页没有数值评分、每维度范围或 band 描述表**。PDF 8（印刷 7）概览与 PDF 73–75（印刷 72–74）考官脚本也没有口语数值量表。不能仅凭本书把四项范围猜成 0–5；模板如使用另一个 Cambridge 官方量表，须保留独立来源，不能把外部量表署为本题包原书内容。这里的示例考官反馈是特定考生的表现评价，不是唯一正确口语答案。

## 媒体与人工复核

5 个听力 Part 各有 `required: true` 的未绑定 audio slot，所有 `segment` / `playback` 均为 null。纸面文稿里的重复、停顿与结束指令只是原文转录，不能据此猜测音频时间戳、倍速、重复次数或可播放状态。整包 `mediaBindingRevisionId` 为 null。

Listening Part 1 的每道三图选项、写作 Part 7 的完整三图故事、Speaking Part 2 的完整五图卡保留必需 image slots；RW Part 2 头像是可选图片槽。未用文字描述代替所需真实图片，也未把 PDF 扫描页放入 public。口语示例视频有独立 review slot，未绑定资源，不声称已观看视频或已取得音轨。图像裁剪仅为待复核坐标；PDF 73 / 75 的学生 Part 标题使用显式局部 crop，与同页私有考官脚本隔离。

本轮只在私有 `output/exams/source-reading/official-test-1-full/` 渲染并查看源页，没有上传或绑定媒体；源 PDF 本地路径不写入 JSON。发布前需人工逐项复核转录、原答案、分类、图像边界、真实媒体与相应量表来源；本目录本身不授权发布、考试或分数计算。


后续结构整合：原先直接放在题干、没有材料引用的正式写作/口语任务，已将原有任务文字和图卡移入该完整题组的稳定 task-material/family，题干不重复展示。内容与来源不补造，用于统一记录材料首次接触。仍待人工审核，未运行验证。
