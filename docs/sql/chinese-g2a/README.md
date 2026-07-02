# 二年级上册字库灌库（分片 SQL）

**首次灌库：** 跳过 `00-delete.sql`，从 `01-lessons.sql` 起按顺序执行。
**重建该册：** 先跑 `00-delete.sql`，再跑其余分片。

1. `00-delete.sql`
2. `01-lessons.sql`
3. `02-chars-01.sql`
4. `02-chars-02.sql`
5. `02-chars-03.sql`
6. `02-chars-04.sql`
7. `02-chars-05.sql`
8. `02-chars-06.sql`
9. `03-lesson-chars-01.sql`
10. `03-lesson-chars-02.sql`
11. `03-lesson-chars-03.sql`
12. `03-lesson-chars-04.sql`

**校验：** `99-verify.sql`

共 609 字 · 35 课 · 730 条课字编排
（其中 609 字的 structure 由 IDS 分解推断）

重新生成：`python3 packages/chinese/scripts/generate-chinese-upsert.py g2a`
