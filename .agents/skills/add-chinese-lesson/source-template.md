# 语文课次源文档模板

用户可将单课内容放在 `docs/chinese/<book-slug>/lessons/<lessonKey>.md`（如 `docs/chinese/g2a/lessons/u1-l1.md`）。

**book slug：** `g{N}a` = N 年级上册，`g{N}b` = N 年级下册（如 `g1b` = 一年级下册）。

Agent 读取后**仍须**按 [validation.md](validation.md) 做网络检索校验，不可跳过。

```markdown
# META
bookSlug: g2a
grade: 2
semester: 上
unit: 1
lesson: 1
lessonKey: u1-l1
title: 小蝌蚪找妈妈
lessonKind: lesson
unitType: reading
requiresRecite: false

# 识字表（认读）
| 字 | 拼音 |
|----|------|
| 两 | liǎng |
| 哪 | nǎ |

# 写字表（会写）
| 字 | 拼音 |
|----|------|
| 两 | liǎng |
| 就 | jiù |

# 读一读记一记
- 披头散发
- 面红耳赤

# 课文
第一段正文。可以多个自然段。

第二段正文。

# 古诗（可选；本课无则省略整节）
## 静夜思
作者: 李白
朝代: 唐
requiresRecite: true

床前明月光，
疑是地上霜。
举头望明月，
低头思故乡。

# 组词（可选；generate-sql 也可后补）
两: 两个、两人
哪: 哪里、哪些
```

## 字段说明

| 节 | 映射 |
|----|------|
| `# META` | `bookSlug`（`g2a` 等）、`units.ts` + SQL `chinese_lessons` |
| `# 识字表` | `lesson-chars.recognize` + `recognizePinyin` |
| `# 写字表` | `lesson-chars.write` + `writePinyin` |
| `# 读一读记一记` | `phrases.ts` + `recall_phrases` |
| `# 课文` | `curated_passages_data.py` → `lesson-passages.ts` |
| `# 古诗` | `poems.ts` |
| `# 组词` | `chars.ts` 的 `phrases[]` |

## 简化输入

用户只在对话里贴内容也可以。最少需要：

1. 年级学期 + 课名（或 lessonKey）
2. 识字表 + 写字表（或教材该页照片）
3. 课文全文（阅读功能需要）

缺项时 Agent 应列出缺什么，**不要编造**。
