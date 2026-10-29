# 任务课程目录与物料盘点

本文描述证据边界及补录方式。数量是 2026-10-29 本地仓库扫描的观察值，不是固定产品事实，也不代表线上数据库当前状态。

## 可重复生成

从仓库根目录运行：

```bash
node scripts/task-material-catalog.mjs --dry-run > scripts/tmp/task-material-manifest.json
node scripts/task-material-catalog.mjs --out scripts/tmp/task-material-manifest.json --page-size 40 --max-pages 1 > scripts/tmp/task-material-page.json
node scripts/task-material-catalog.mjs --out scripts/tmp/task-material-manifest.json --page-size 40 --resume > scripts/tmp/task-material-resumed.json
```

默认 stdout；只有显式 `--out` 才写 manifest 和默认 `<out>.checkpoint.json`。`--checkpoint` 可指定路径；`--dry-run` 不写这两个文件。输出目录由 CLI 建立。`--fixture file.json` 使用本地 `{records,gaps?}` 源；输出中的 records 以稳定 key 去重，冲突内容报错。游标、页预算、来源 SHA-256、已读记录和缺口保存在 checkpoint；恢复时来源变化会拒绝。重复恢复已完成 checkpoint 结果不变。`--cursor` 没有已读前缀时标记 `cursor_prefix_not_included`，不能宣称完整。重跑不写数据库或注册资产。

Manifest 的 `scan_complete` 表示分页范围已读完，`complete` 另要求没有 `*_source_failed`。已确认缺内容、未核验媒体和缺字段始终保留为 `gaps`，不会因为扫描结束变成“资源齐全”。失败的数学题库保留注册讲次条目和 `problem_source_failed`，不生成虚构题目。当前本地来源完整可读；所有媒体的远端状态仍未核验。

未来单独获准后可使用只读共享目录 feed：

```bash
node scripts/task-material-catalog.mjs --remote-url https://example.org/shared-catalog --allow-remote --max-pages 5 --page-size 100 --rate-ms 250 --out scripts/tmp/shared-catalog.json
```

这不是已实现的业务 API 地址。Feed 必须返回 `{records,gaps?,cursor,complete,revision}`，按 limit 返回最多指定条数，revision 在整个扫描/恢复期间不变；只接受显式 `visibility: "shared"` 的记录。CLI 使用 GET、15 秒请求超时、最多 3 次 429/503 尝试、Retry-After/页间限流、每页大小限制，并拒绝跳转、重复游标和版本漂移。`--max-pages` 在远端模式必须显式给出；每页最多 500 条。未显式开启远端时没有网络读取。CLI 不读项目 env 文件，不读取私有录音，也没有远端写入能力。

## 来源与可用范围

| 范围 | 仓库权威入口 / 证据 | 本次观察 | 缺口和补录 |
| --- | --- | --- | --- |
| 语文 | 三册 `utils/<book>/units.ts` 注册目录；`lesson-chars.ts` 稳定 key/字表备份；`lesson-passages.ts`、`poems.ts`、`accumulation.ts`、看拼写词表 | 107 个带稳定 key 条目；83 个有课文文本，16 个关联古诗、14 个关联积累、63 个关联看拼写词表 | 词库线上以 Supabase 为准，备份不代表实时数据。三册“快乐读书吧”在目录中存在但未找到匹配稳定 key，记 `directory_missing_stable_key` 并保留标题/教材/单元，不杜撰可关联 key。普通课没有园地积累/古诗时是“该资源缺失”，不表示课不存在；按学科录入流程补充逐课文本、稳定关联及词表。 |
| 厚海英语 | `reading-data.ts` 的真实 passage key；`english-data.ts`、历史命名 `english-data-4b.ts`（实际 4A）、`english-data-5a.ts` 的词库备份 | 4A / 5A 共 54 个由真实词汇或课文证明存在的 Lesson；24 篇课文；15 个带 grammar section、9 个带 writing section | 不按 Unit 自动补齐 L1/L2/L3。5A U6 的三个 Lesson 有词库备份而没有课文；保留课程目录，`missing_passage`，不生成阅读链接、页码或录音。线上词库变更须重新读取/盘点。用 English lesson 录入流程补课文及学习段，不能把语法链接当成已核验的线上语法内容。 |
| 数学 | `math-kit/utils/lesson-registry.ts` 的注册讲次；对应 `math-content/utils/g<grade>/lesson<seq>-data.ts(x)` 的真实 PROBLEMS 导出 | 29 讲、1,468 道真实题目，保留 pretest/lesson/homework/workbook/supplement 分类、真实 ID/显示编号/顺序/标签 | `displayId` 仅用于展示。正式引用为 `lesson:group:encoded-real-id`，不同组/讲可同号。题库 group 不自动构成教学段；授课范围由用户明确配置。CLI 导入真实工厂；仅把 `./gong.css` 样式叶映射为空 JSON，不替换工厂/题库。 |
| 剑桥语法 | `grammar/grammar-index.ts` 静态索引 | 当前索引 0 条，标注 `remote_unverified` | 不能据此推断线上已入库单元数，亦不承诺 116 单元均可访问；需获准后查询只读内容目录。 |
| 通用音视频 / 阅读 / 绘本 / Story / 百度 | `audio_assets`、阅读媒体、绘本媒体、Story narration、百度音频文件、每讲 `math_video_lesson_catalog` 是后续核验入口 | 本任务没有远端读取，均标 `remote_unverified` | 由应用层/物料库适配共享资源；只显示已验证的回放匹配。发现命名候选或已知路径不等于文件存在。上传/账号变更后按原同步流程重验。 |

本次 manifest 有 190 个稳定目录记录、566 条资源或字段缺口；完整扫描不等于这些缺口已经补齐。语文认读/会写计数取仓库备份、英语词数取备份去重，不能替代线上数据审计。缺口以本次可重复 CLI 输出为准；不要把本表数量写入产品判断或测试门槛。

## 隐私和共享边界

`task-audio/<user id>/...`、`english-story-recordings`、`reading_recordings` 不进入共享清单；私有 feed 记录只产生通用排除原因。不会导出私人录音路径、签名 URL、任意额外字段。文本资源 ref 只保留应用内学科导航，数学题只保留 `/math/ny/` 导航；不把媒体预览签名写进目录快照。共享资产存储和真实选择器由 Task 7 实现，tasks 只接收 `TaskMaterialAdapter`。

## 课程快照交接

`TasksHost` 使用学科 hook 的真实 ready/error 状态。`createTaskCatalogAdapter().prepareSnapshot(request)` 可按教材、单元、课、教学段筛选；失败返回 `unavailable`，不覆盖既有快照。手动目录使用 `source: 'manual'` 和 `manual_lessons`，任何科目都可用，且不读取内置数学题库。`source` 与 `progression_mode: 'lesson' | 'segment'` 持久化在快照行中；不能仅凭 subject 或空段数组推断推进方式。

教学段只保存用户明确选择的真实 problem key。`completes_lesson?: boolean` 缺省保守 false；只有本讲最后一段可显式 true。`missing_teaching_segments` / `unclosed_teaching_segments` 是 ready 结果的配置 issues，允许先保存部分后续配置；不能当作源加载失败或已学完。运行时遇到未闭合的最后已知段，应返回当前讲 `missing_segment` 并暂停；存在下一同讲显式段时正常推进。Task 2 的编辑器应选择教材/范围、验证当前 cursor，并提供“本讲最后一段”选择。

持久化通过 Task 2 的 `task_save_course` 原子保存课程、规则、快照、cursor 和 bindings。现有 `useTaskData` 已用 user session store 读取 `catalog_snapshots`；不要添加页面 remount selects 或 localStorage 业务数据。带 builder.id 调用 generic `api.save('catalog_snapshots', snapshot)` 会走 UPDATE，不能当作新快照 INSERT。服务器确定 owner/created_at，并按 `(user_id,subject,version)` 复用前验证完整内容；builder 的 version 是非安全用途内容校验值。迁移 `20261029065823_task_catalog_source_and_progression.sql` 仅本地新增，未应用远端。
