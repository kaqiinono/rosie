-- 为已有 chinese_char_entries 表添加 structure 列（不删数据）
-- 若字库已灌入，请改执行：
--   docs/sql/chinese-char-entries-update-structure-g1-down.sql
-- 该文件会 ADD COLUMN + 对 495 字逐条 UPDATE，无需 00-delete 重灌。

alter table public.chinese_char_entries
  add column if not exists structure text check (
    structure is null
    or structure in ('上下', '左右', '独体', '半包围', '全包围', '上中下')
  );
