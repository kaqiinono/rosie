---
name: add-chinese-lesson
description: Add or update 部编版 Chinese textbook lesson content in @rosie/chinese — chars, lesson-passages, poems, recall phrases, accumulation. Requires web search verification against authoritative sources before writing data (no typos, wrong pinyin, or wrong line breaks). Use when adding 语文课文, 生字, 古诗, g2a, g1b, or /add-chinese-lesson.
version: 1.0.0
trigger: /add-chinese-lesson
---

# /add-chinese-lesson — 新增/更新语文课次

用法：
- `/add-chinese-lesson <lessonKey>` — 只处理一课，如 `u2-l3`
- `/add-chinese-lesson <book-slug>` — 处理整册，如 `g2a`（二年级上册）
- 不带参数 — 按用户在 `$ARGUMENTS` 里给的课次/年级处理

在 `@rosie/chinese` 的 TS 备份里录入数据，再 `generate-sql` 灌 Supabase。**运行时读 DB**；TS 是版本控制 + SQL 生成源。规范见 `packages/chinese/CLAUDE.md`。

> **铁律：** 任何字、词、句、拼音、古诗分行写入 TS **之前**，必须先完成 **[内容校验（网络检索）](validation.md)**。校验未通过 → **禁止** merge 数据。

---

## 册别命名（book slug）

**上下册用 `g{N}a` / `g{N}b`，禁止 `grade-up` / `grade-down` / `g{N}-上` 作目录或 charKey 前缀。**

| book slug | 含义 | DB `grade` | DB `semester` |
|-----------|------|------------|---------------|
| `g1a` | 一年级上册 | 1 | `上` |
| `g1b` | 一年级下册 | 1 | `下` |
| `g2a` | 二年级上册 | 2 | `上` |
| `g2b` | 二年级下册 | 2 | `下` |

**charKey 前缀：** `g1b::春`（= 一年级下册的「春」）

辅助函数（写入 TS 时保持一致）：
```ts
// g1a → { grade: 1, semester: '上' }；g2b → { grade: 2, semester: '下' }
function parseBookSlug(slug: string): { grade: number; semester: '上' | '下' }
```

## 仓库结构

| 位置 | 作用 |
|------|------|
| `packages/chinese/src/utils/g{N}a/` 或 `g{N}b/` | 该册 TS 备份（如 `g1b` = 一年级下册） |
| `packages/chinese/scripts/curated_passages_data.py` | 课文原文权威源 → 生成 `lesson-passages.ts` |
| `docs/chinese/<book-slug>/` | 可选：用户提供的源文档 / 草稿 |
| `docs/sql/chinese-<book-slug>/` | 由 `generate-sql` 生成的灌库脚本（如 `chinese-g2a/`） |

**lessonKey 规则：**
- 正课：`u{unit}-l{lesson}`，如 `u3-l5`（lesson 用教材课序，非单元内序号）
- 语文园地：`u{unit}-garden`
- 快乐读书吧：录入 `units.ts` 但不进路线 / 周计划（`lessonKind: 'happy_reading'`）

---

## 第零步：确认范围与源材料

用户至少提供 **一项**（缺则先问，不要猜）：

1. **年级 + 学期**（如 二年级上册 → book slug `g2a`）
2. **课次标识**（`lessonKey` 或「第 X 单元 第 Y 课《标题》」）
3. **源内容**（任选）：教材 PDF / 扫描图 / 贴在对话里 / `docs/chinese/...` 下的 md

推荐用户源文档格式见 [source-template.md](source-template.md)。若用户只给 PDF/图片，先提取为 `docs/chinese/<book-slug>/lessons/<lessonKey>.md` 再往下走。

**确认 checklist（写入前口头汇总给用户）：**
```
第 X 单元 · 《课文标题》（lessonKey: uN-lM）
- 认读字 N 个 · 会写字 M 个
- 课文段落 P 段 · 古诗 K 首 · 读一读记一记 R 条
- 目标册：g2a（二年级上册）· charKey 前缀 g2a::
```

---

## 第一步：内容校验（网络检索）— 强制关卡

**在改任何 TS 文件之前**，对本课全部待写入内容执行校验。

完整流程、检索词模板、对照规则、报告格式 → **[validation.md](validation.md)**。

摘要（必须全部满足才可进入第二步）：

1. 用 **WebSearch** + **WebFetch** 检索至少 **2 个独立来源**（教材 PDF 镜像、人民教育出版社、可信教辅站）
2. 检索词含：`部编版` / `人教版` + `{N}年级{上|下}册` + `{课文标题}` + `课文` / `生字` / `识字表` / `写字表` / `原文`
3. 逐项对照：**汉字**（零错别字）、**拼音**（声调、多音字课内读音）、**古诗/韵文分行**（与教材一致）、**读一读记一记**整句
4. 输出 **校验报告**（模板见 validation.md）；有 🔴 未解决差异 → 停止，向用户列出差异并等待确认
5. 用户源与网络源冲突时：**以部编版现行教材为准**；若无法判定，标 🔴 并询问用户

---

## 第二步：写入 TS 备份

按课更新下列文件（整册新课先确保 `types.ts` / `units.ts` 已存在，可复制 `g1b` 改 book slug 与 charKey 前缀）：

| 内容 | 文件 | 说明 |
|------|------|------|
| 单元目录 | `units.ts` | 课标题、`kind`、`requiresRecite` |
| 课 ↔ 字 | `lesson-chars.ts` | `recognize`/`write` + 对应 `*Pinyin` 数组等长 |
| 字档案 | `chars.ts` | 每字一条；`charKey`、`phrases[]`；部首/笔顺可留空由 generate-sql 补 |
| 读一读记一记 | `phrases.ts` + `chinese_lessons.recall_phrases` | 整句，非单字 |
| 课文原文 | `curated_passages_data.py` | 校验通过后再加；跑 extract 脚本 |
| 古诗 | `poems.ts` | `lines[]` 分行与教材一致 |
| 日积月累 | `accumulation.ts` | 园地谚语/名言等 |
| 偏旁/笔顺规则 | `radicals.ts` / `stroke-rules.ts` | 园地有则加 |

**课文原文写入顺序：**
1. 编辑 `packages/chinese/scripts/curated_passages_data.py` 中该 `lessonKey` 的段落
2. `python3 packages/chinese/scripts/extract-lesson-passages.py`
3. 确认 `g{N}a|b/lesson-passages.ts` 已更新

**多音字：** 拼音以**该课教材标注**为准（如「地」在「地方」vs「慢慢地」），写入 `lesson-chars` 的课内拼音；`chars.ts` 主拼音取该字在本册首次出现时的读音。

**会认字 vs 会写字（教材版式）：**

| 类型 | 教材位置 | 提取来源 |
|------|----------|----------|
| **会认字** (`recognize`) | 课文正文之后、**两条横线之间**的识字行（含拼音，蓝色字为多音字课内读音） | PDF **识字表** 按课划分 |
| **会写字** (`write`) | 会认字**下方**的 **田字格**练字区 | PDF **写字表** 按课划分 |

禁止把写字表的字写入 `recognize`，或把识字表的字写入 `write`。若 PDF 末尾识字表/写字表与某课横线/田字格不一致，**以识字表/写字表为准**（与 `docs/tmp/extract-chinese-g2.py` 一致）。

**去重：** 同一 `charKey` 在 `chars.ts` 只保留一条；`lesson-chars.ts` 可每课重复出现同一字。

---

## 第三步：本地数据校验

```bash
pnpm --filter @rosie/chinese verify-data    # 结构/数量（整册有期望值时再改 verify 脚本）
pnpm --filter @rosie/chinese typecheck
```

手动核对：
- [ ] `recognize.length === recognizePinyin.length`
- [ ] `write.length === writePinyin.length`
- [ ] 课文每个段落能在网络校验源中找到一致表述
- [ ] 古诗每行非空、行数与教材一致
- [ ] 无全角/半角标点混用（统一中文标点）
- [ ] `lessonKey` 在 `units.ts`、`lesson-chars.ts`、passages、poems 间一致

---

## 第四步：生成 SQL 并灌库

```bash
pnpm --filter @rosie/chinese generate-sql
```

- **增量更新单课：** 只跑对应 upsert 片段，或手写 `INSERT ... ON CONFLICT DO UPDATE` — **禁止**对已有数据跑 `00-delete.sql`（见仓库 SQL 规则）
- **全新册首次灌库：** 按 `docs/sql/chinese-<book-slug>/README.md` 顺序；delete 脚本仅用户明确要求重建时使用
- 灌库后跑 `99-verify.sql`（若存在）

---

## 第五步：UI 冒烟（若该册已接路由）

```bash
pnpm dev
```

打开 `/chinese/reading/<lessonKey>`、`/chinese/chars`（筛选到该课）、`/chinese/poems`：
- [ ] 课文分段显示正确
- [ ] 生字认读/会写数量与教材一致
- [ ] 古诗填空行与背诵一致

---

## 新册首次接入（额外步骤）

若用户要开放全新年级册（如二年级上册 `g2a`），除数据外还需：

1. 新建 `packages/chinese/src/utils/g2a/` 数据目录
2. 扩展 SQL 生成脚本，输出到 `docs/sql/chinese-g2a/`
3. `apps/web/src/app/chinese/g2a/page.tsx` + `/chinese/page.tsx` 入口卡片
4. UI / Context 按 `bookSlug` 传参（路由 `/chinese/g2a` 等）；**本 skill 只改数据时不动 UI**，除非用户明确要求开册

---

## 禁止事项

- 未做网络校验就写入字词句
- 凭记忆默写课文/古诗（必须检索对照）
- 用 OCR/PDF 提取结果不经校验直接入库
- 为「凑数」擅自改教材认读/会写划分
- 对生产库跑 delete/truncate 清表

---

## 用户提供的补充信息

$ARGUMENTS

## 延伸阅读

- 网络校验细则：[validation.md](validation.md)
- 推荐源文档格式：[source-template.md](source-template.md)
- 模块架构：`packages/chinese/CLAUDE.md`
