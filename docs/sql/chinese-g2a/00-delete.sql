-- AUTO-GENERATED — delete 二年级上册 content before re-import
-- ⚠️ 仅重建该册时使用；首次增量灌库请跳过此文件

delete from public.chinese_lesson_chars where lesson_key in (
  select lesson_key from public.chinese_lessons where grade = 2 and semester = '上'
);
delete from public.chinese_char_entries where grade = 2 and semester = '上';
delete from public.chinese_lessons where grade = 2 and semester = '上';
