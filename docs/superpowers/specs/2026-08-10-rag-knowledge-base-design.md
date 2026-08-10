# RAG 知识库系统设计

> 日期：2026-08-10
> 状态：设计已确认，待实现

## 概述

为 Rosie 学习乐园引入 RAG（检索增强生成）系统，建立英语、数学、语文三科知识库，支持：
1. **知识问答**：孩子向 AI 提问，获得基于知识库的适龄解答
2. **智能出题**：基于知识内容自动生成练习题
3. **弱项强化训练**：AI 分析薄弱点，每日推送个性化训练任务

## 核心约束

- **用户**：小学低年级儿童（Rosie），界面需简洁友好
- **AI 服务**：Qoder API（具体接口后续确认）
- **知识来源**：Supabase 已有结构化数据 + 手动导入外部文本/PDF
- **基础设施**：Supabase pgvector（不引入额外向量数据库）

## 架构选型

**方案 A：Supabase pgvector 全链路（已选定）**

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  前端 UI     │────▶│  Next.js API     │────▶│  Supabase       │
│  (React)     │◀────│  Routes          │◀────│  pgvector + RPC │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │
                             ▼
                     ┌──────────────────┐
                     │  Qoder API       │
                     │  (Embed + Gen)   │
                     └──────────────────┘
```

**选型理由**：
- 零额外基础设施，与现有 RLS 安全策略一致
- 单数据源管理简单，pgvector 性能对单用户场景绰绰有余
- Next.js API Routes 已有服务端逻辑模式，新增 RAG 路由自然

**否决方案**：
- 方案 B（Edge Function）：引入 Deno 技术栈增加复杂度
- 方案 C（独立向量库）：对小规模项目过重

## 数据模型

### 知识库层

```sql
-- 知识文档（原始文档/内容条目）
CREATE TABLE knowledge_documents (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject     text NOT NULL,           -- 'english' | 'math' | 'chinese'
  source_type text NOT NULL,           -- 'db_sync' | 'import'
  source_ref  text,                    -- 来源引用，如 'word_entries:123'
  title       text NOT NULL,
  content     text NOT NULL,
  metadata    jsonb DEFAULT '{}' NOT NULL,  -- grade、semester、unit 等
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 知识片段（Embedding 后的向量块）
-- 冗余 user_id 用于简化 RLS 策略并提升查询性能
-- 系统内置数据（db_sync）user_id 为 NULL，手动导入数据关联实际用户
CREATE TABLE knowledge_chunks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id),  -- NULL = 系统内置数据
  subject     text NOT NULL,
  chunk_index smallint NOT NULL,
  content     text NOT NULL,
  embedding   vector(1536),  -- 维度取决于 Embedding 模型，当前以 1536 为基准；若后续模型变更需迁移
  content_tsv tsvector,      -- 全文检索向量（用于 Hybrid Search）
  metadata    jsonb DEFAULT '{}' NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- 索引策略说明：
-- 初期数据量小时（< 几万条），使用 HNSW 索引（精确检索，无需预热）
-- 数据量增长后可切换为 IVFFlat（需 REINDEX 重建）
CREATE INDEX knowledge_chunks_embedding_idx
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- 全文检索索引（支持 Hybrid Search）
CREATE INDEX knowledge_chunks_tsv_idx
  ON knowledge_chunks USING gin (content_tsv);

-- tsvector 自动更新触发器
CREATE OR REPLACE FUNCTION update_content_tsv() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv := to_tsvector('simple', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_content_tsv
  BEFORE INSERT OR UPDATE ON knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION update_content_tsv();

-- 知识导入记录
CREATE TABLE knowledge_imports (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  subject     text NOT NULL,
  file_name   text,
  file_path   text,                    -- Supabase Storage 路径
  file_type   text,                    -- 'text' | 'pdf_text' | 'pdf_scanned' | 'plain_text'
  content     text NOT NULL DEFAULT '',
  chunk_count integer DEFAULT 0,
  status      text DEFAULT 'pending',  -- pending | extracting | chunking | embedding | done | error
  error_msg   text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 知识库同步状态
CREATE TABLE knowledge_sync_state (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name      text NOT NULL UNIQUE,
  last_synced_at  timestamptz,
  records_synced  integer DEFAULT 0,
  chunks_created  integer DEFAULT 0,
  status          text DEFAULT 'idle',  -- idle | syncing | done | error
  error_msg       text,
  updated_at      timestamptz DEFAULT now()
);
```

### 应用层

```sql
-- AI 对话记录
CREATE TABLE ai_conversations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  session_id      uuid NOT NULL,
  role            text NOT NULL,        -- 'user' | 'assistant'
  content         text NOT NULL,
  sources         jsonb DEFAULT '[]',
  subject         text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ai_conversations_session_idx
  ON ai_conversations(session_id, created_at);

-- AI 生成题目记录（去重 + 质量追踪）
CREATE TABLE ai_generated_questions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  subject         text NOT NULL,
  topic           text,
  question_hash   text NOT NULL,
  question_data   jsonb NOT NULL,
  source          text NOT NULL,        -- 'quiz' | 'training'
  correct         boolean,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ai_questions_hash_idx
  ON ai_generated_questions(question_hash);

-- 每日训练计划
-- 注意：每个 plan_date 可有多条记录（每科一条），
-- training/generate API 一次性为当天所有科目创建计划
CREATE TABLE ai_training_plans (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id),
  plan_date    date NOT NULL,
  subject      text NOT NULL,
  weak_points  jsonb NOT NULL DEFAULT '[]',
  questions    jsonb NOT NULL DEFAULT '[]',
  status       text DEFAULT 'pending',  -- pending | started | completed
  score        integer,
  feedback     text,
  created_at   timestamptz DEFAULT now(),
  completed_at timestamptz
);
```

### 已有依赖表结构参考

弱项分析和智能出题依赖以下已有表，此处列出关键字段供参考（完整结构见 `0001_baseline.sql`）：

**掌握度表（mastery）**：

| 表名 | 学科 | 关键字段 |
|------|------|--------|
| `word_mastery` | 英语 | `user_id`, `word_key`, `correct`, `incorrect`, `stage`, `next_review_date`, `is_hard` |
| `problem_mastery` | 数学 | `user_id`, `problem_key`, `correct`, `incorrect`, `stage`, `next_review_date`, `is_hard` |
| `chinese_char_mastery` | 语文 | `user_id`, `char_key`, `track`(recognize/write), `correct`, `incorrect`, `stage`, `next_review_date`, `is_hard` |

**错题表（wrong）**：

| 表名 | 学科 | 关键字段 |
|------|------|--------|
| `english_wrong` | 英语 | `user_id`, `word_key`, `added_at`, `resolved` |
| `math_wrong` | 数学 | `user_id`, `problem_id`, `added_at`, `resolved` |
| `chinese_wrong_items` | 语文 | `user_id`, `item_key`, `item_type`(char/phrase/accumulation/poem), `wrong_kind`, `resolved` |
| `calc_mistakes` | 口算 | `user_id`, `signature`, `category`(addsub/muldiv/mixed), `consecutive_correct`, `resolved` |

**弱项分析逻辑**：通过聚合上述表的 `is_hard`、`correct/(correct+incorrect)`、`resolved`、`last_seen` 等字段，结合知识库 chunks 检索，生成个性化训练任务。

### 向量检索函数（Hybrid Search）

支持向量相似度 + 全文检索混合检索，解决孩子搜索精确词汇（如特定单词、古诗名）时纯向量检索遗漏的问题。

```sql
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),        -- 查询向量
  query_text text DEFAULT NULL,         -- 原文关键词（用于全文检索）
  match_subject text DEFAULT NULL,
  match_grade smallint DEFAULT NULL,
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.7,
  text_weight float DEFAULT 0.3,        -- 全文检索权重（0-1）
  vector_weight float DEFAULT 0.7       -- 向量检索权重（0-1）
) RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  subject text,
  content text,
  metadata jsonb,
  similarity float                       -- 加权综合分数
)
```

**Hybrid Search 策略**：
- `query_text` 为空时：退化为纯向量检索
- `query_text` 非空时：同时执行向量检索和 `tsvector` 全文检索，按 `vector_weight` / `text_weight` 加权合并排序
- 去重：同一 chunk 被两种方式命中时取最高分

## 知识来源映射

| 学科 | 数据源表 | 映射方式 |
|------|---------|---------|
| 英语 | `word_entries` | 每个单词 → 1 个文档（含释义、音标、例句、拼读规则） |
| 英语 | `vocabulary` | 每条词汇 → 1 个文档 |
| 数学 | `math-content` 课时题目 | 每个课时 → 1 个文档（含该课所有题目文本和知识点） |
| 语文 | `chinese_char_entries` | 每个汉字 → 1 个文档（含拼音、部首、笔画、词语） |
| 语文 | `chinese_lessons` | 每篇课文 → 1 个文档（含课文内容、类型、单元） |
| 通用 | 手动导入 | 文本/PDF → 分块 → 多 chunks |

## 分块策略

- **结构化数据**（单词、汉字）：粒度细，每条记录 = 1 chunk，保留完整元数据
- **长文本**（课文、导入文档）：按 300-500 字分块，相邻块有 50 字重叠
- **数学题目**：按课时聚合，一个课时的所有题目 + 知识点摘要 = 1-2 chunks

### 重叠区域处理

长文本分块的 50 字重叠策略需要注意语意完整性：

1. **句级对齐**：分块边界优先在句号/换行处切分，避免在词中间截断
2. **重叠内容**：相邻 chunk 的重叠区域保留完整句子（而非固定 50 字硬切），确保上下文连贯
3. **元数据继承**：重叠区域的元数据（如 grade、unit、lesson）由所属 document 统一继承，不因重叠而丢失
4. **检索去重**：当同一文档的多个 chunk 被检索命中时，在应用层合并去重，避免重复内容干扰 LLM

## PDF 导入管道

### 架构：本地脚本提取 + 服务端入库

```
┌──────────────────────────────────┐
│  本地环境（脚本执行）              │
│                                  │
│  1. 读取本地 PDF 文件             │
│  2. 逐页渲染为图片 (pdf2pic)      │
│  3. 文字提取 (pdf-parse)          │
│  4. 表格检测 (启发式规则)          │
│  │   ├─ 无表格 → 直接用文字       │
│  │   └─ 有表格 → Vision LLM 提取 │
│  5. 扫描页 → Tesseract.js/Vision │
│  6. 输出结构化 JSON               │
└──────────────┬───────────────────┘
               │  上传 JSON
               ▼
┌──────────────────────────────────┐
│  Next.js API（服务端）             │
│  分块 → Embedding → 写入 pgvector │
└──────────────────────────────────┘
```

**选型理由**：Vercel Serverless 有执行时长限制（Pro 60s），大 PDF 的 OCR 处理易超时，本地脚本不受此限制。

### 脚本使用

```bash
# 提取单个 PDF
npx tsx scripts/extract-pdf.ts \
  --file ./downloads/数学一年级上册.pdf \
  --subject math --grade 1 --semester 上 \
  --output ./extracted/math-g1a.json

# 提取并直接上传到知识库
npx tsx scripts/extract-pdf.ts \
  --file ./downloads/英语课文合集.pdf \
  --subject english --upload

# 批量处理目录
npx tsx scripts/extract-pdf.ts \
  --dir ./downloads/chinese-textbooks/ \
  --subject chinese --upload
```

### PDF 处理策略

| 页面类型 | 处理方式 | 说明 |
|---------|---------|------|
| 纯文字页 | `pdf-parse` 提取 | 快速、零成本 |
| 扫描文字页 | `tesseract.js` OCR | 本地处理，无 API 调用 |
| 含表格页（文本型） | 文字提取 + 视觉 LLM 结构化 | 先提取原始文字，再用 Vision 重建表格结构 |
| 含表格页（扫描型） | 视觉 LLM 直接识别 | 跳过 OCR，一步到位提取结构化内容 |

### 表格检测

采用**两层检测**策略，减少误判导致的昂贵 Vision LLM 调用：

**第一层：文本启发式规则（快速过滤）**
- 文字中出现大量制表符/多空格分隔
- 多行具有相似的列结构（≥ 3 列）
- 包含"表格""合计""总计"等关键词
- 文字密度异常（表格页通常文字少但排列规整）

**第二层：坐标布局分析（精确判定）**
- 利用 `pdf-parse` 返回的文字绝对坐标（x, y 位置）
- 分析行距均匀性：表格行的 y 坐标间距趋于等距
- 分析列对齐：多行文字在相同 x 坐标处出现对齐断点
- 检测网格线：页面中存在水平/垂直线条（部分 PDF 保留线条矢量信息）

**判定逻辑**：第一层 ≥ 2 个信号命中 → 进入第二层坐标分析 → 坐标分析确认后才触发 Vision LLM。
这种两层策略可有效过滤教材中常见的「看图填空」「情景图片」等密集排版页面的误判。

### 视觉 LLM 提取 Prompt

```
你是一个文档内容提取助手。请从这张页面图片中提取所有内容，特别注意：

1. 如果页面包含表格，请用 Markdown 表格格式输出，保留行列结构
2. 合并单元格请用相同内容填充对应的每个单元格
3. 表格中的数学公式用 LaTeX 格式
4. 非表格部分按阅读顺序输出纯文本
5. 用 "---TABLE---" 和 "---TEXT---" 标记不同类型的内容区域
```

### 脚本输出格式

```json
{
  "file": "数学一年级上册.pdf",
  "subject": "math",
  "metadata": { "grade": 1, "semester": "上" },
  "pages": [
    { "page": 1, "type": "text", "content": "..." },
    { "page": 2, "type": "ocr", "content": "..." },
    { "page": 3, "type": "table", "content": "| ... |" }
  ],
  "total_pages": 120,
  "text_pages": 85,
  "ocr_pages": 35
}
```

### 脚本优化策略

- 批量渲染页面 → 并行提交 Vision API（控制并发数）
- 缓存已处理页面到 `.cache/tables/`，支持断点续传
- 可配置 `--skip-tables` 跳过表格检测（快速模式）
- 终端进度条显示处理进度

### 脚本依赖（devDependencies）

```json
{
  "pdf-parse": "^1.1.1",
  "tesseract.js": "^5.0.0",
  "pdf2pic": "^3.1.0",
  "cli-progress": "^3.12.0",
  "sharp": "^0.33.0"
}
```

### 支持的导入方式

| 方式 | 说明 |
|------|------|
| 粘贴文本 | 直接输入/粘贴文本内容 |
| 上传 PDF | 本地脚本提取后上传 JSON |
| 上传 TXT/Markdown | 直接读取文本内容 |
| 数据库同步 | 一键将现有结构化数据批量导入知识库 |

## 核心功能一：知识问答

### 交互流程

```
孩子输入问题（文字/语音）
    │
    ▼
意图识别 & 查询改写（判断学科 + 优化检索词）
    │
    ▼
向量检索 + 元数据过滤（search_knowledge RPC）
    │
    ▼
RAG 生成回答（流式输出，System Prompt 约束儿童友好语气）
```

### 关键设计

| 要素 | 设计 |
|------|------|
| 意图识别 | 自动判断学科，缩小检索范围 |
| 查询改写 | 将口语化问题改写为更适合检索的查询 |
| 上下文记忆 | 保留最近 5 轮对话，支持追问 |
| 安全边界 | 只回答知识库相关内容，非学习问题礼貌拒绝 |
| 引用标注 | 回答中标注知识来源，可点击查看原文 |
| 语音输入 | 复用项目已有录音能力（`@breezystack/lamejs`），录音后通过 Qoder API 的语音转文字（STT）能力转为文本，再走相同问答流程 |

### System Prompt 约束

- 角色：耐心温柔的老师
- 面向小学低年级孩子，用简单易懂的语言
- 适当用 emoji 和鼓励语气
- 只基于知识库内容回答
- 不确定时诚实说"这个我不确定"

## 核心功能二：智能出题

### 出题模式

| 模式 | 触发方式 | 知识检索策略 | 适用场景 |
|------|---------|------------|---------|
| 知识点出题 | 选学科 → 选课时/知识点 | 精确检索该知识点的 chunks | 预习/复习特定内容 |
| 薄弱项出题 | 一键生成 | 检索 mastery 表中 is_hard=true 或正确率低的知识点 | 针对性强化 |
| 随机挑战 | 一键生成 | 跨学科/跨课时随机采样 chunks | 综合能力检测 |

### 支持题型

| 学科 | AI 可生成的题型 |
|------|---------------|
| 英语 | 选择题（看词选义/听音选词）、填空题、拼写题 |
| 数学 | 应用题、概念题（选择/判断）、计算题 |
| 语文 | 选字填空、拼音选择、组词题、课文理解题、古诗填空 |

### 题目输出格式

LLM 返回结构化 JSON：

```json
{
  "subject": "math",
  "grade": 1,
  "topic": "加法基础",
  "questions": [
    {
      "type": "choice",
      "stem": "小明有 3 个苹果，妈妈又给了他 2 个，小明现在有几个苹果？",
      "options": ["4", "5", "6", "3"],
      "answer": "5",
      "explanation": "3 + 2 = 5，把两个数合在一起就是加法！"
    }
  ]
}
```

生成后复用现有练习组件（QuizRunner、AdaptivePlanSession）渲染答题界面。

## 核心功能三：弱项强化训练

### 分析维度

| 维度 | 数据来源 | 判定规则 |
|------|---------|---------|
| 正确率低 | mastery 表 correct/(correct+incorrect) | < 60% 为薄弱 |
| 频繁出错 | wrong 表 | 同一知识点 ≥ 3 次错误 |
| 长期未掌握 | mastery 表 stage | stage 长期未提升 |
| 遗忘退化 | mastery 表 last_seen | 超过 7 天未练习的已学内容 |

### 弱项分析输出

```typescript
interface WeaknessAnalysis {
  subject: string;
  weakPoints: Array<{
    knowledgePoint: string;
    severity: 'high' | 'medium' | 'low';
    evidence: string[];
    relatedChunkIds: string[];
  }>;
  recommendedFocus: string[];
}
```

### 每日推送逻辑

```
每天首次打开 App
    │
    ▼
检查今日是否已有 ai_training_plans
    │
    ├─ 有 → 显示待完成的训练任务
    │
    └─ 无 → 触发弱项分析
              │
              ▼
         查询各科 mastery + wrong 数据
              │
              ▼
         RAG 检索相关知识
              │
              ▼
         SSE 流式逐科生成：
           ├─ 英语完成 → 即时返回英语卡片
           ├─ 数学完成 → 即时返回数学卡片
           └─ 语文完成 → 即时返回语文卡片
              │
              ▼
         每科写入 ai_training_plans（按科分条）
              │
              ▼
         首页显示「今日寻宝任务」卡片
         （正向激励话术，不显示“弱项”字样）
```

## API 设计

### 路由结构

```
apps/web/src/app/api/ai/
├── chat/route.ts           ← 知识问答（SSE 流式）
├── quiz/route.ts           ← 智能出题
├── training/
│   ├── generate/route.ts   ← 生成每日训练
│   └── complete/route.ts   ← 提交训练结果
├── knowledge/
│   ├── upload/route.ts     ← 上传文本内容到知识库
│   ├── sync/route.ts       ← 同步数据库现有数据
│   └── status/route.ts     ← 查询知识库状态/统计
└── search/route.ts         ← 知识库检索（调试用）
```

### `POST /api/ai/chat`

Request:
```json
{
  "message": "string",
  "conversationId": "string (optional)",
  "context": {
    "subject": "string (optional)",
    "lessonId": "string (optional)",
    "grade": "number (optional)"
  }
}
```

Response: SSE 流式逐 token 返回，最终包含 sources 和 messageId。

内部流程：意图识别 → Embedding → 检索 → 组装 Prompt → Qoder API 流式生成 → 保存对话记录。

### `POST /api/ai/quiz`

Request:
```json
{
  "subject": "string",
  "mode": "topic | weakness | random",
  "topicId": "string (optional)",
  "count": "number (1-20)",
  "grade": "number (optional)"
}
```

Response: `{ quizId, subject, questions: [...] }`

内部流程：查询掌握度 → RAG 检索 → 查询已有题目去重 → LLM 生成结构化 JSON → 解析验证。

### `POST /api/ai/training/generate`

Request: `{ "date": "string (optional)" }`

**异步处理模式**（避免 Vercel 60s 超时）：

该接口内部涉及「查询多科 mastery/wrong 数据 → RAG 检索 → LLM 生成 3 科题目 → 写入数据库」的长链路调用，在 Vercel Serverless 上极大概率超过 60s 限制。

**采用 SSE 流式 + 分科返回策略**：

```
前端发起 POST → 服务端 SSE 流式响应
  event: progress { subject: "english", status: "generating" }
  event: subject_done { subject: "english", plan: {...}, questions: [...] }
  event: progress { subject: "math", status: "generating" }
  event: subject_done { subject: "math", plan: {...}, questions: [...] }
  event: progress { subject: "chinese", status: "generating" }
  event: subject_done { subject: "chinese", plan: {...}, questions: [...] }
  event: done { totalQuestions: 9 }
```

- 每科独立生成并即时返回，避免等待全部完成
- 前端收到每科数据后立即渲染对应科目卡片
- 任一科失败不影响其他科，错误通过 `event: error` 事件返回
- 写入 `ai_training_plans` 表按科分条创建

Response（最终）: `{ plans: [{ subject, weakPoints, questions }], totalQuestions }`

### `POST /api/ai/training/complete`

Request: `{ "planId": "string", "answers": [...] }`

Response: `{ score, feedback, updatedWeakPoints: [{ point, trend }] }`

### `POST /api/ai/knowledge/upload`

Request: `{ "subject": "string", "title": "string", "content": "string", "metadata": {...} }`

Response: `{ documentId, chunkCount, status }`

### `POST /api/ai/knowledge/sync`

Request: `{ "subjects": [...], "tables": [...], "force": boolean }`

Response: `{ results: [{ table, recordsProcessed, chunksCreated, errors }] }`

## UI/UX 设计

### 入口结构

- **独立入口**：首页新增「AI 助手」大卡片 → 进入 AI 助手主页
- **学科快捷入口**：数学/英语/语文模块页新增浮动「问 AI」按钮 → 底部抽屉式对话窗口（自动带学科上下文）

### 页面列表

| 页面/组件 | 放置位置 | 说明 |
|----------|---------|------|
| `AiAssistantPage` | `packages/core` | AI 助手主页（对话 + 快捷功能入口） |
| `AiChatPanel` | `packages/core` | 可复用对话面板（主页 + 抽屉共用） |
| `AiFloatingButton` | `packages/core` | 学科页浮动问答按钮 |
| `AiQuizGenerator` | `packages/core` | 智能出题页面 |
| `AiTrainingCard` | `packages/core` | 首页每日训练卡片 |

放在 `packages/core` 因为 AI 功能是跨学科共用的。

### AI 助手主页布局

- 欢迎语 + 示例问题引导
- 「今日训练」卡片（显示待完成训练任务）
- 「智能出题」快捷入口（按学科 + 出题模式选择）
- 底部输入栏（文字 + 语音）

### 对话界面

- 聊天气泡式交互
- AI 回答带引用标注（可点击查看原文）
- 保留最近 5 轮上下文
- 支持语音输入

### 每日训练卡片（首页）

**儿童友好话术设计**：

不直接展示「你的弱项是...」等挫败性语言，采用正向激励包装：

| 内部概念 | 面向孩子的展示 |
|---------|-------------|
| 薄弱项 | 「技能升级挑战」「今日寻宝任务」 |
| 正确率低 | 「快要掌握了，再练一练！」 |
| 频繁出错 | 「这个知识点很调皮，我们一起攻克它！」 |
| 遗忘退化 | 「好久没见面了，复习一下还记得吗？」 |

卡片内容：
- 显示今日挑战任务摘要（如「3 个寻宝任务等你完成！」）
- 每个科目用 emoji + 鼓励语展示（如「🔢 数学：退位减法大冒险！」）
- 显示待训练题目总数
- 一键「开始挑战」按钮

## 技术依赖

### 新增运行时依赖

```json
// packages/core/package.json
{
  "dependencies": {
    "ai": "^4.0.0"
  }
}
```

- `ai`（Vercel AI SDK）：统一 LLM 流式调用、多模型适配

### 新增开发依赖

```json
// package.json (root devDependencies)
{
  "pdf-parse": "^1.1.1",
  "tesseract.js": "^5.0.0",
  "pdf2pic": "^3.1.0",
  "cli-progress": "^3.12.0",
  "sharp": "^0.33.0"
}
```

## 环境变量

```env
# apps/web/.env.local 新增
QODER_API_KEY=xxx           # Qoder API 密钥
QODER_EMBED_MODEL=xxx       # Embedding 模型标识（待确认）
QODER_CHAT_MODEL=xxx        # 对话生成模型标识（待确认）
QODER_VISION_MODEL=xxx      # 视觉模型标识（待确认，用于表格提取）
```

## 新增迁移文件

新增 `supabase/migrations/0004_rag_knowledge_base.sql`，包含：
- pgvector 扩展启用
- `knowledge_documents`、`knowledge_chunks`、`knowledge_imports`、`knowledge_sync_state` 表
- `ai_conversations`、`ai_generated_questions`、`ai_training_plans` 表
- `search_knowledge()` RPC 函数
- 所有新增表的 RLS 策略（基于 `user_id = auth.uid()`）
