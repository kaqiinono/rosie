-- 二年级下册灌库完整性校验（导入全部分片后运行）
-- 预期：593 字 · 36 课 · 715 条课字编排

select 'chinese_lessons' as tbl, count(*) as cnt, 36 as expected, count(*) = 36 as ok
from public.chinese_lessons
where grade = 2 and semester = '下'

union all

select 'chinese_char_entries', count(*), 593, count(*) = 593
from public.chinese_char_entries
where grade = 2 and semester = '下'

union all

select 'chinese_lesson_chars', count(*), 715, count(*) = 715
from public.chinese_lesson_chars lc
join public.chinese_lessons l on l.lesson_key = lc.lesson_key
where l.grade = 2 and l.semester = '下';
