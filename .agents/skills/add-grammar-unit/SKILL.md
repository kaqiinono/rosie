---
name: add-grammar-unit
description: Add or re-extract an English grammar unit to the Rosie platform — renders PDF pages, extracts via qwen-vl-max Vision LLM, quality-reviews the JSON, uploads page images to Storage, and upserts into Supabase grammar_units via scripts/extract-grammar-unit.mjs. Supports multiple books (essential/intermediate/advanced) via --book flag. Use when the user asks to 添加语法单元, 提取 Unit N, 批量提取语法, re-extract a bad unit, or /add-grammar-unit.
version: 1.3.0
trigger: /add-grammar-unit
---

# /add-grammar-unit — 新增/重提取语法单元

用法：`/add-grammar-unit <unit>`（如 `12`）或 `/add-grammar-unit <a>-<b>`（如 `2-10`）。
指定书：`/add-grammar-unit --book intermediate <unit>`（默认 `essential`）。

架构速记：内容是带 `type` 判别的 jsonb 数据块，渲染层是 type → 组件注册表（未知块型降级
`unsupported` 不崩溃）。数据在 `grammar_units`（复合 PK `(book, unit_number)`，RLS 只读，
写入走 service-role），进度在 `grammar_mastery`（复合 PK `(user_id, book, unit_number)`）。
原文图片存 Supabase Storage `grammar-pages` bucket（路径 `{book}/unit{NNN}/page-{NNNN}.png`），
`grammar_units.page_images` jsonb 列存储 `[{page, path, type, crop?}]`（`crop` 为内容区域
归一化 0-1000 坐标 `{x1,y1,x2,y2}`，新提取的页才有，旧数据无此字段）。前端三 tab：讲解/练习/原文，
页码角标 `p.N` 可点击弹出原文图片预览。
书尾延展位 116-169：附录（appendix-1~7）/补充练习（supp-01~35，仅练习无 lesson）/学习指导
（guide-p272~283）；锚点列 `units`/`supp_entries`/`study_guide_units`（migration 0028）记录
书尾内容与正文单元的关联；`search_text` 列（migration 0029）是讲解块展平的检索文本
（口径与 ai-sync-db 的 grammarBlockLines 一致，不含练习题/答案）。

## 前置条件

- `apps/web/.env.local`：`AI_EMBED_API_KEY`、`AI_EMBED_BASE_URL`、`NEXT_PUBLIC_SUPABASE_URL`、
  `SUPABASE_SERVICE_ROLE_KEY`（缺一不可；缺 API key 报 503 类错误，缺 service-role 拒绝入库）
- `pdftoppm` 可用（brew poppler）
- PDF 按书放置：`docs/english/剑桥初级英语语法.pdf` / `剑桥中级英语语法.pdf` / `剑桥高级英语语法.pdf`
- migration `0025_add_grammar_book_dimension` + `0026_add_grammar_page_images` 已应用；
  `0028`（锚点列）/`0029`（search_text）未应用不阻断——CLI 会逐列降级重试，但建议应用

## 工作流（每个单元）

复制此清单跟踪进度：

```
- [ ] Step 1: 核对页码映射
- [ ] Step 2: 提取（先 --no-upload）
- [ ] Step 3: 质量审核（对照原书页图）
- [ ] Step 4: 入库（--upload-only，含图片上传 + 数据 upsert）
- [ ] Step 5: 页面验证
- [ ] Step 6: 后置同步（AI 知识库 / 锚点）
```

**Step 1: 核对页码映射**

查 `scripts/grammar-page-map.json` 是否有该单元条目（格式 `{ "<unit>": { "pdf": [..], "book": [..] } }`）。
**必须确保 page-map 中有该单元的条目**（pdf 页码 + 书内印刷页码），否则 CLI 会用临时公式导致页码错误。
新增单元前，用 `pdftoppm` 渲染对应 PDF 页并肉眼确认角落印刷页码，补进 page-map。
已知规律（Essential Grammar in Use）：`book_page = pdf_page - 7`（8 个采样点验证恒定），
但仍需逐单元写入 page-map 以确保校验机制生效。

**Step 2: 提取**

```bash
node scripts/extract-grammar-unit.mjs --unit <N> --no-upload [--book <id>]
```

产物落在 `output/grammar-units/<book>/unitNNN/`：`page-NNNN.json`（原始提取）、
`lesson.json` / `exercise.json` / `unit.json`（组装结果，unit.json 是入库载荷）。
批量：`--range A-B`（顺序执行，逐单元失败不阻断后续）。

**书尾内容**用 `--backmatter <key>`：单 key（`appendix-1` / `supp-01` / `guide-p272`）、
逗号列表或同前缀区间（`appendix-1-7`、`supp-1-35`），产物目录为 `appendix-N` / `supp-NN` /
`guide-pNNN`。注意 key 必须零填充（`supp-01` 而非 `supp-1`，区间语法除外）；
补充练习依赖 `_keys/supp-index.json` 练习表，缺失时先跑 `--backmatter supp-index`。

**页码自动校验**：组装时 CLI 自动执行三层校验：
1. LLM 提取的 `bookPage` 与 page-map 期望值比对（一致→通过）
2. 检测 LLM 把 PDF 页码误当印刷页码的常见错误（`⚠` 警告，自动用 page-map 纠正）
3. 跨页连续性检查：两页书内页码应为 N, N+1（不连续→`❌` 错误，需检查 page-map）

校验输出 `✓ unit N: 页码校验通过` 即可继续；出现 `❌` 必须停下来核对。

**Step 3: 质量审核（关键，别跳过）**

打开 `output/grammar-units/<book>/unitNNN/unit.json`，对照 `output/grammar-pages/page-NNNN.png` 逐项核对：

| 检查项 | 标准 |
|--------|------|
| unitNumber / title | 与请求一致；CLI 的 WARN 必须查清 |
| sections 数量 | 与原书 A/B/C 小节一致 |
| 例句 bold 数组 | 加粗词都在句中能找到（找不到则不高亮，需修） |
| 练习 answer | 每题答案非空才可判分；开放题留空 `""`（展示不判分） |
| 填空 prompt | 空格统一为 6 个下划线 `______`，空格数与 answer 可拆分数量匹配 |
| bookPage | **必须与书内印刷页码一致**（非 PDF 页码），page-map 有值时自动覆盖 LLM 输出 |
| page_images | 每页有对应条目，`page` 为书内页码，`type` 为 lesson/exercise；`crop` 如有应包住全部教学内容不切边（缺失仅 `⚠`，不阻断） |
| unsupported 块 | 出现即说明模型输出了未注册块型，见下方「框架扩展」 |

质量不行 → 人工修 `page-NNNN.json` 后重跑 `--unit N --no-upload` 重新组装，
或 `--unit N --no-upload --force` 整体重提取。

**Step 4: 入库**

```bash
node scripts/extract-grammar-unit.mjs --unit <N> --upload-only [--book <id>]
```

幂等入库：**POST 纯插入 → 409 冲突转 PATCH 全字段覆盖**两段式（本项目 PostgREST 对既有行
的 merge-duplicates 冲突检测失效，走 INSERT 分支会报 23502 title NOT NULL，勿改回 upsert）。
`--upload-only` 同时执行：
1. 上传本地 PNG 到 Storage `grammar-pages` bucket（路径 `x-upsert` 幂等覆盖）
2. 写入 `grammar_units` 行（含 `page_images` 列；`search_text` 由
   `scripts/grammar-search-text.mjs` 自动生成，无需手填）

入库后 `unit.json` 三件套建议随代码提交留档。

**Step 5: 页面验证**

`/english/grammar/<N>`：讲解/练习/原文三 tab 渲染、`p.N` 页码角标可点击弹出原文预览、
判题（填空答对变绿）、全部答对后 `grammar_mastery` 写入且首页出 ⭐已掌握。
登录态必须（无 guest 模式）。

**Step 6: 后置同步**

1. **AI 知识库**（有 lesson 的单元才需要）：`node scripts/ai-sync-db.mjs --tables=grammar_units`
   （需 dev server 在跑 + AI_EMBED_*），幂等覆盖，同步后「不不」才能检索到新语法点。
2. **存量 search_text 回填**（仅当存在未经新 upsert 路径入库的旧行）：
   `node scripts/tmp/backfill-grammar-search-text.mjs`（幂等）。
3. **锚点字段**（仅书尾相关）：新增/重提取补充练习后跑
   `node scripts/grammar-backmatter-anchors.mjs`（正文单元的 supp_entries/study_guide_units）与
   `node scripts/grammar-supp-units-patch.mjs`（补充练习的 units 列）；两者均为 PATCH 精确更新。

## ⚠️ 常见失误

| 现象 | 原因 / 处理 |
|------|-------------|
| `❌ 页码校验失败` | page-map 的 book 值错误——渲染 PDF 页肉眼核对角落印刷页码后修正 |
| `⚠ LLM 把 PDF 页码误当书内页码` | 常见现象，CLI 已自动用 page-map 纠正，无需人工干预 |
| `❌ 书内页码不连续` | page-map 的 book 值跳跃——检查是否有空白页/章节分隔页 |
| 页面显示「暂未支持的内容块（spelling_rule）」 | Prompt 允许 `spelling_rule` 但渲染层尚未注册——先走「框架扩展」再批量提取 |
| 练习无法判分 | `answer` 为空被判为开放题；核对原书答案页补齐 |
| 多空答案匹配不上 | `answer` 多空须用 `, ` 或 `. ` 分隔且段数 = 空格数 |
| `unitNumber 不一致` WARN | 页码映射错位（渲染到了别的单元）——修 page-map 重提取 |
| 提取结果明显缺内容 | 模型截断（max_tokens 上限）→ `--force` 重提取，仍失败则考虑单页拆两次提问 |
| 想重提取已入库单元 | 直接再跑一遍全流程（幂等覆盖），无需先删行 |
| 入库报 `23502 title NOT NULL` | PostgREST merge-duplicates 冲突检测失效——CLI 已用 POST→409→PATCH 规避，若自行写脚本勿用 `resolution=merge-duplicates` upsert，改用 PATCH |
| `--backmatter supp-1` 报 key 不存在 | key 须零填充为 `supp-01`（区间语法 `supp-1-35` 除外）|
| 新单元在 AI 助手里搜不到 | 漏跑 Step 6 的知识库同步（`ai-sync-db.mjs --tables=grammar_units`）|

## 框架扩展（新块型 / 新题型）

提取产出未知块型时不要硬塞进现有类型，按四步流程走：
1. `packages/english/src/grammar/types.ts`：union 加成员 + `normalizeBlocks`/`normalizeExercises` 加分支；
2. `LessonView.tsx` 的 `BlockView`（或 `ExerciseView`）加渲染分支；
3. `scripts/extract-grammar-unit.mjs` 的 `EXTRACTION_PROMPT` 同步块型说明；
4. `pnpm --filter @rosie/english typecheck` + 重跑一个单元端到端验证。

## 新增一本书

`book` 维度已入库（migration 0025），新增书只需：
1. `types.ts` 的 `GrammarBookId` union + `GRAMMAR_BOOKS` 注册表追加条目（无需 migration）；
2. CLI `BOOKS` 对象追加 PDF 路径与 `maxUnits`；
3. 准备 PDF 文件放入 `docs/english/`，创建对应的 page-map 文件；
4. 前端路由考虑 book 维度（当前硬编码 essential，后续改为 `/english/grammar/{book}/{unit}`）。
动手前先写设计文档过 review（阶段实施双关卡）。
