# Dify 知识库 · 数学题库

本目录由 `pnpm corpus:export` 自动生成，可直接上传到 Dify 知识库。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `math/lesson-12.md` … `lesson-47.md` | 按课程分拆，每文件含该讲全部题目（题干+解析+答案+应用链接） |
| `math/_index.md` | 全库索引表（846 题） |

## 上传到 Dify

1. 进入 Dify → **知识库** → **创建知识库** → **导入已有文本**
2. 上传 `math/lesson-*.md`（推荐按课程分拆，检索更准）
3. 分段策略：**按 Markdown 标题分段**（`###` = 单题粒度）
4. 题目有更新后重新运行 `pnpm corpus:export`

## 注意

- 部分题目含图示（`figureNode`），语料中已标注，完整题目请打开应用链接
- 英语词库请从 Supabase `word_entries` 单独导出

生成时间：2026-06-25T03:59:09.941Z
