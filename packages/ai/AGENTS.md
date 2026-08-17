# @rosie/ai — RAG 知识库 + Rosie Agent

P0 范围：知识 ingest、混合 Agent 问答（blocks/actions）、语音 STT、基础 UI。

## 路由

| 路径                               | 说明                                          |
| ---------------------------------- | --------------------------------------------- |
| `/ai`                              | AI 助手页（`AiAssistantPage`）                |
| `/api/ai/chat`                     | SSE：token → envelope → teaching_state → done |
| `/api/ai/student-profile`          | 当前用户三科学习画像（只读、no-store）        |
| `/api/ai/teaching-sessions`        | 教学会话创建、读取与显式 action 推进          |
| `/api/ai/teaching-sessions/verify` | 用原学科练习记录验证学习结果                  |
| `/api/ai/metrics`                  | 管理员 AI 质量指标（1–90 天）                 |
| `/api/ai/transcribe`               | Whisper STT                                   |
| `/api/ai/knowledge/ingest`         | service role 单文档 ingest                    |
| `/api/ai/knowledge/sync-catalog`   | catalog 全量同步 + 生成 link-manifest         |
| `/api/ai/knowledge/status`         | 文档/chunk 计数                               |

## 包结构

```
src/
├── types.ts                 # AgentResponse, AgentBlock, AgentAction
├── agent/                   # orchestrator, classify-intent, Zod schema
├── server/                  # embed, chunker, ingest, search, chat, transcribe
├── server/tools/            # lookup-*, resolve-links
├── data/link-manifest.json  # catalog sync 生成的 deep link 表
└── components/              # AiChatPanel, AiVoiceInput, agent blocks
```

全局学习页面由 `AiFloatingAssistant` 提供可收起的对话抽屉；它不跳转路由，并把当前 pathname
映射为 `ChatContext` 传给聊天 API。完整 `/ai` 页面用于长对话。浮层在 `/ai`、auth、admin 和
沉浸式页面隐藏，关闭浮层只隐藏 UI，不卸载聊天状态。

## 数据流

```
catalog/DB → upsertKnowledgeDocument → knowledge_documents/chunks
三科学习表 → loadStudentProfile（只读聚合）→ chat system/user prompt
用户语音/文字 → STT(可选) → runAgentOrchestrator → AgentResponse
  → streamAnthropicTokens 润色 → SSE envelope → AiMessageRenderer
显式教学 action → /api/ai/teaching-sessions → ai_teaching_sessions
带 teachingSessionId 的聊天 → 只读教学状态并约束回答，不自动推进状态
原学科练习记录 → verifyTeachingSessionEvidence → 完成教学会话
对话/教学会话聚合 → /api/ai/metrics（不读取回答正文）
```

**Session store 规则**：`ai_conversations` 持久化在 Supabase；每次连续提问只读取当前用户、当前
`session_id` 最近 8 条消息，并在 prompt 中逐条截断。页面内消息列表用 `useState`，不单独建
Zustand cache。`sessionStorage` 仅保存 conversation/session ID，用于同一标签页刷新恢复，不保存作答正文。

**教学状态机**：同一 `conversationId` + 学科复用一条活动的 `ai_teaching_sessions`，阶段依次围绕
`understand → attempt → hint/check → transfer → summary` 推进。提示最多三级；理解、尝试、提示、
检查阶段在调用模型前就隔离完整数学解析与最终答案，同时不向前端发送完整解题 block。
状态机只记录教学过程，不直接写 mastery / wrong。
创建和推进也可通过鉴权后的 `/api/ai/teaching-sessions`；更新使用 `updated_at` 乐观并发控制，
冲突返回 409。只有提交尝试、请求提示、确认理解、完成或放弃等显式行为可以写教学状态。
英语、数学、语文分别采用拼读语境、数量关系、字词句段策略。用户点击“我会了”只进入迁移阶段；
只有教学开始后由原学科组件产生的新正确练习记录，才能通过 `/verify` 完成验证。显式 `complete`
只标记 `self_reported`，验证通过才标记 `verified`，界面和指标不得将二者混为同一种掌握证据。

**学生画像规则**：画像只读取当前登录用户的英语、数学、语文计划、掌握度和错题聚合。
英语优先读取 `adaptive_word_plans` + `adaptive_plan_word_progress`，没有活动自适应计划时回退
`weekly_plans`；语文优先读取 `chinese_roadmap_plans` + 最近一次 lesson run，没有活动路线图时
回退 `chinese_weekly_plans`；数学读取当前权威的多日计划（底层历史表名仍为
`math_weekly_plans`，`plan_data` 是日期数组，日期范围元数据位于 `progress_data.__planMeta`）。
画像用于调整回答难度与提示方式；
不把内部统计、标签或数据库字段直接告诉学生。聊天阶段不得自动
修改 mastery、wrong 或 plan 数据。教学过程状态使用 `ai_teaching_sessions`；普通聊天不推进
教学阶段，也不能作为掌握度证据，掌握度更新必须来自后续可验证的显式学习行为。

## Ingest / Sync

```bash
# 需 apps/web/.env.local：SUPABASE_SERVICE_ROLE_KEY, AI_EMBED_*（Qoter 等 OpenAI-compatible）
pnpm dev   # 另开终端
pnpm ai:sync-catalog --subject=chinese,english,math
pnpm ai:sync-db
pnpm ai:sync-db --limit=100 --resume
pnpm ai:sync-catalog --subject=math --limit=80 --resume
pnpm ai:audit
pnpm ai:sync-all                       # 无需 Codex，会自动复用/启动本地 web 服务
pnpm ai:sync-all --batch=200 --concurrency=8
```

- `ai:sync-catalog` → POST `/api/ai/knowledge/sync-catalog`，写入 Supabase + 更新 `src/data/link-manifest.json`
  - 语文 catalog：课文、古诗、日积月累、看拼音写词语、单元课目录
  - 英语：reading passages；数学：SEA_POOL 题解
- `ai:sync-db` → 同步 `word_entries`、`chinese_char_entries`、`chinese_lessons`
- catalog API 使用 CLI run ID + 进程级 single-flight 防重入：同一次网络重试复用原任务，学科重叠的不同任务返回 409 并退避，避免进度倒退与重复 embedding

## Agent 协议（P0 blocks / actions）

| Block             | 用途                                   |
| ----------------- | -------------------------------------- |
| `text`            | 纯文字                                 |
| `word_card`       | 单词卡片                               |
| `char_card`       | 生字卡片                               |
| `passage_excerpt` | 课文节选                               |
| `math_solution`   | 数学题解（步骤、最终答案、可选题解图） |
| `math_problem`    | 数学题目引用（由应用层嵌入现有作答组件） |
| `poem_recite`     | 古诗稳定引用（由应用层嵌入填空背诵组件） |
| `learning_status` | 三科或单科的掌握度/错题/概况视图请求     |
| `today_tasks`     | 三科或单科的今日任务与计划进度请求       |

| Action         | 用途                              |
| -------------- | --------------------------------- |
| `navigate`     | 通用跳转                          |
| `open_problem` | 数学题（fallback `/math/sea?q=`） |
| `open_reading` | 课文阅读                          |

Deep link 查 `link-manifest.json` + `resolve-links.ts`；**禁止**在 `@rosie/ai` 内 import `@rosie/math`（DAG）。
AI 的数学题解使用 `@rosie/ui` 的 `ProblemSolutionView`，与详情页的
`@rosie/math-kit/.../ProblemSolutionPanel` 共享同一纯展示层。上传图从
`math_problem_images` 只读解析，静态 `analysisImg` 由 catalog metadata 回退；AI 不直接依赖 math-kit。
浮层中的三学科原生卡片由 `apps/web/src/components/AiFloatingAssistantHost.tsx` 注入：
`word_card` 复用英语 `FlashCard`，`char_card` 复用语文 `CharFlashCard`，`math_problem`
复用数学 `EmbeddedMathProblemSession`。学科组件组合必须留在 app 层，禁止从 AI 包反向依赖学科包。
单词卡可在消息内切换到 `SpellTiles` 拼写练习，生字卡可切换到 `CharWriter` 的笔顺演示与描写练习。
英语 `passage_excerpt` 带 passage key 时由应用层复用 `PassageView` 和 `ParagraphRecallQuiz`，
段落回想通过原 `useWordMastery.recordRecallAttempt` 写回；`poem_recite` 复用语文 `PoemRecite`。
`learning_status` 不携带模型生成的统计值；app 层从三科现有 mastery/wrong session stores 实时读取。
浮层根据当前 pathname 查生成后的 link manifest，并把匹配的稳定 sourceRef 作为活动内容上下文；
chat route 会在服务端重新解析 pathname，不信任客户端直接提交的 sourceRef。RAG 搜索通过 metadata
锁定当前内容，因此“这道题/这篇课文”无需重复描述。manifest 未命中时仍回退普通混合检索。
数学 `QuestionLayout` 会在 DOM 上暴露当前可见题目的 `problemId`；浮层只在打开时读取该标记。
chat route 必须再用 link manifest 按 `problemId` 验证并重建 `activeContent`，不得相信客户端的题名或 sourceRef。
练习中未作答的当前题不得返回同题完整题解；服务端需同时校验 `math_practice_attempts`
的 completed 记录。未作答时可给题意、分级提示、易错点，也可检索并完整讲解不同 `problemId`
的相似例题；相似题检索必须排除当前 sourceRef。
app 层共享一套 embedded renderers 给浮层和完整 `/ai` 页面。英语课文复用现有音频按钮；
语文课文复用全文朗读和录音上传，浮层隐藏时通过 `active` 属性停止正在进行的录音。
古诗得分只在存在匹配的活动语文路线计划时追加 lesson run，不擅自推进计划关卡。
后续候选与接入约束见 `docs/ai/embedded-interaction-audit.md`。

## 环境变量

| 变量                                     | 用途                               |
| ---------------------------------------- | ---------------------------------- |
| `AI_EMBED_API_KEY` / `AI_EMBED_BASE_URL` | embedding + STT + chat（Qoter 等） |
| `AI_CHAT_MODEL`                          | chat 模型（默认 `gpt-4o-mini`）    |
| `AI_CHAT_API_KEY` / `AI_CHAT_BASE_URL`   | 可选，单独覆盖 chat endpoint       |
| `AI_STT_BASE_URL`                        | 可选，单独覆盖 STT endpoint        |
| `AI_STT_MODEL`                           | 默认 `whisper-1`；百炼用 `qwen3-asr-flash` |
| `SUPABASE_SERVICE_ROLE_KEY`              | ingest / sync API                  |

## 开发检查

```bash
pnpm --filter @rosie/ai typecheck
pnpm --filter web typecheck
pnpm test -- apps/web/tests/ai/
```

Migration：

- `supabase/migrations/0004_rag_knowledge_base.sql`（需启用 `vector` + `pg_trgm`）
- `supabase/migrations/0015_add_ai_teaching_sessions.sql`（教学会话状态 + own-user RLS）
- `supabase/migrations/0016_enforce_unique_active_ai_teaching_session.sql`（活动会话唯一性）
- `supabase/migrations/0017_reconcile_ai_index_and_scratch_rpc_grants.sql`（索引/函数授权漂移修复）
- `supabase/migrations/0018_make_scratch_working_rpc_security_invoker.sql`（恢复 RLS 执行语义）

## 本地维护脚本优先

耗时、批量、可重复的知识库维护任务必须优先做成 `scripts/*.mjs` CLI，而不是依赖 Codex
逐批执行。脚本应满足：幂等、断点续传、受控并发、限流/5xx退避、状态落库、结束审计、不输出密钥。
新增学科或知识源时，把它注册到 `ai:sync-all`，并保留单数据源命令用于排障。
