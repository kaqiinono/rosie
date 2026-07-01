-- AUTO-GENERATED — delete grade-1-down content before re-import
-- Run first (Supabase SQL Editor OK)

delete from public.chinese_lesson_chars where lesson_key in (
  select lesson_key from public.chinese_lessons where grade = 1 and semester = '下'
);
delete from public.chinese_char_entries where grade = 1 and semester = '下';
delete from public.chinese_lessons where grade = 1 and semester = '下';
