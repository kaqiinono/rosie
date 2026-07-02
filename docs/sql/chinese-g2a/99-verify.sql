-- 二年级上册灌库完整性校验（导入全部分片后运行）
-- 预期：609 字 · 35 课 · 730 条课字编排

select 'chinese_lessons' as tbl, count(*) as cnt, 35 as expected, count(*) = 35 as ok
from public.chinese_lessons
where grade = 2 and semester = '上'

union all

select 'chinese_char_entries', count(*), 609, count(*) = 609
from public.chinese_char_entries
where grade = 2 and semester = '上'

union all

select 'chinese_lesson_chars', count(*), 730, count(*) = 730
from public.chinese_lesson_chars lc
join public.chinese_lessons l on l.lesson_key = lc.lesson_key
where l.grade = 2 and l.semester = '上';
