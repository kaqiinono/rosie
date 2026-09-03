# Story 架构与数据约束

执行任务前重新打开下列当前文件；路径和结构可能继续演进，禁止只凭本文改代码。

## 数据与路由

- `packages/english/src/utils/story-types.ts`：`StorySeries` → `StoryVolume` → `StoryChapter`；chapter 含稳定 `key`、序号、标题、段落和章节 glossary。句子锚点由 `splitStorySentences` 生成 `{chapterKey}-sNNN`。
- `packages/english/src/utils/story-data.ts`：聚合 `storySeries`，并按正文为每章筛选助读 glossary；新增书的数据文件应在此注册。
- `packages/english/src/utils/story-*.ts`：当前 Story 数据、录音类型和工具的真实实现。
- `apps/web/src/app/english/words/reading/story/[seriesSlug]/[volumeSlug]/[chapterKey]`：章节阅读；相邻层级分别为系列、分辑和 `full` 整辑连续阅读。
- `packages/english/src/index.ts`：English 单一 barrel；新增公共数据、类型、hook 或组件应按当前约定导出。

## 词汇与难点词

- `StoryReader` 从 `useWordData(user)` 取得完整运行时 `word_entries`，以 `buildWordMatchRegex` / `resolveMatchedWord` 匹配，再按 `(stage, unit, lesson, word)` 去重生成 chapter words。
- 构造 chapter `ReadingPassage` 时使用 `stage: 'story'`、分辑标题作为 `unit`、chapter key 作为 `lesson`；这只是 PassageView 的故事来源标签，不是教材建模。
- `PassageView` 只接收该章命中词；`WordPopup` 显示词库来源与故事来源。不要传整书或整库，否则词卡导航会膨胀。
- glossary 必须章节级、人工审阅且不与已匹配词库重复。`GlossaryPanel` 是 fixed modal 卡片浏览器；新增 category 时检查其 emoji 映射。

## 书签

- `StoryReader` 连续渲染段落和句子锚点，不做响应式分页。
- `useStoryReadingProgress` 按 `(user_id, volume_key)` upsert：保存起始章、首尾完整句的章内 index/text 和 `view_mode`。整辑视口可跨章，因此末句 index 不要求大于首句 index。
- 恢复时先校验稳定 ID 对应文本；必要时以文本回退，并把首句滚到 sticky header 下方。保存只能由用户主动触发。

## 章节录音

- `StoryRecorder` 嵌在每章 header；`storyContentKey(volume, chapter)` 形成 `volumeSlug:chapterKey`。scope 当前只能是 `chapter`。
- `useStoryRecordings` 先调用 `compressAudioToMp3`，再用其返回的真实 `blob/contentType` 决定扩展名。播放器目标为语音级 mono 32 kHz / 64 kbps MP3；转码失败时 helper 可返回原格式，禁止谎报 MP3。
- 每次保存生成独立 UUID 并 insert `reading_recordings`，所以一章允许多条片段。私有 bucket 为 `english-story-recordings`，对象路径首段是 `user.id`，播放/下载使用短期 signed URL。
- 数据库真实约束来自 Story migrations：`story_reading_progress`、`reading_recordings`、chapter-only scope、移除每章唯一录音约束，以及私有 bucket 的 SELECT/INSERT/UPDATE/DELETE owner policies。新增 schema 先用 `supabase migration new <name>`，再审计 RLS、Data API grants（若配置需要）和 Storage upsert 所需权限。

## 集成点

- 阅读首页仅在选中命名 stage `story` 时展示 `StoryShelf`；Story 不进入教材计划、练习或 mastery。
- 新动态路由必须更新 `packages/ui/src/breadcrumb-map.ts` 的 label/labelMap。
- `apps/web/src/lib/ai-catalog-sync.ts` 当前逐章建立 `english:story:<series>:<volume>:<chapter>` 文档和章节 href；新增 Story 必须继续被聚合，除非当前架构已改变。
- 专项回归入口是 `apps/web/tests/english-story-reading.test.ts`；为新增分辑补层级、章节顺序、正文排除项、锚点和关键审计断言。
