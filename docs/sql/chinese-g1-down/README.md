# 一年级下册字库灌库（分片 SQL）

单文件 `chinese-g1-down-upsert.sql` 因笔顺 JSON 过大，Supabase SQL Editor 无法执行。
请在本目录 **按顺序** 在 SQL Editor 中逐文件运行：

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

**校验：** `99-verify.sql`（导入 12 片后运行；`import_complete` 为 `true` 即完整）

共 495 字 · 36 课 · 619 条课字编排

重新生成：`pnpm --filter @rosie/chinese generate-sql`

有 psql 时可一键导入：
```bash
for f in docs/sql/chinese-g1-down/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```
