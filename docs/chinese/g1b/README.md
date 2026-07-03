# 一年级下册语文教材数据（草稿）

从 `docs/tmp/语文一年级下册.pdf` 经 `pdftotext` + `extract-chinese-g1b.py` 提取。

**状态：已接入 `@rosie/chinese`；变更后请运行 `pnpm --filter @rosie/chinese verify-data`**

## 文件说明

| 文件 | 内容 |
|------|------|
| `types.ts` | TypeScript 类型定义 |
| `units.ts` | 8 单元目录、课文元数据 |
| `lesson-chars.ts` | 每课识字表 + 写字表（原始列表，未跨课去重） |
| `chars.ts` | 全册去重字库（`charKey` = `g1b::{字}`） |
| `phrases.ts` | 「读一读，记一记」词组（部分课文，待补全） |
| `poems.ts` | 7 首古诗（3 课文 + 4 园地） |
| `accumulation.ts` | 日积月累（园地 4–8） |
| `radicals.ts` | 常用偏旁名称表 |
| `stroke-rules.ts` | 书写提示笔顺规则 |
| `stats.json` | 数量统计 |

## 数量核对（见 `stats.json`）

| 指标 | 教材 | 草稿 | 说明 |
|------|------|------|------|
| 写字表 | 200 字 | **200** | 已对齐 |
| 识字表（去重） | 410 字 | **413** | 多 3 字，需核对 |
| 字库 catalog | — | **495** | 识字表 ∪ 写字表；含上册复习字（如「春」「冬」仅出现在写字表） |
| 词组 | — | **85 条** | 10 课「读一读，记一记」，其余课待补 |
| 古诗 | 7 首 | **7** | 已录入 |

## Review 清单

- [ ] 拼音：由 pypinyin 自动生成，多音字需人工校正（如「了」「乐」「好」）
- [ ] 识字表 413 vs 410：核对多出的 3 字
- [ ] `phrases.ts`：目前 10 课，识字课及部分阅读课词组待补
- [ ] 课文原文、背诵标记、`口语交际` / `和大人一起读` 未录入
- [ ] 笔顺数据未包含（实现阶段接 hanzi-writer / Make Me A Hanzi）

## 重新生成

```bash
cd docs/tmp
.venv/bin/python3 extract-chinese-g1b.py
```
